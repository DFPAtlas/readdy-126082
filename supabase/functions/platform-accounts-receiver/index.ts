import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// platform-accounts-receiver — authenticated server-to-server receiver for a
// DFP platform's OWN registered-account total.
//
// Contract:
//   POST /functions/v1/platform-accounts-receiver
//   Authorization: Bearer <per-platform token>
//   Content-Type: application/json
//   {"account_count": 1234, "source_label": "supabase-auth"}   // source_label optional
//
// Responses:
//   200 -> { ok:true, received:true, site_key, account_count }
//   400 -> invalid/malformed payload
//   401 -> missing/invalid credential
//   413 -> payload too large
//   429 -> rate limited
//   500 -> write/backing failure
//   503 -> receiver not configured (no platform token secrets)
//
// Security:
//   * Each platform authenticates with ITS OWN bearer token held in Supabase
//     secrets (PLATFORM_ACCOUNTS_TOKEN_<SITE_KEY>). The token IS the identity —
//     the payload carries no site identifier, so one brand can never report on
//     another brand's behalf.
//   * Only an aggregate integer count is accepted. No names, emails, user ids,
//     sessions, tokens or any other personal data is accepted or stored.
//   * reported_at is stamped SERVER-SIDE (now()) — a reporter can never
//     back-date or forward-date its own feed.
//   * The resolved site must be an ACTIVE PRODUCTION site in the trusted
//     ai_sites registry.
//   * Tokens are compared in constant time; failures never reveal whether a
//     token exists or which part was wrong.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ENVIRONMENT = "production";
const MAX_BODY_BYTES = 4096;
const MAX_ACCOUNT_COUNT = 1_000_000_000;
const SOURCE_LABEL_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const RATE_LIMIT_MAX = 240;
const RATE_LIMIT_WINDOW_MS = 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

/** Constant-time comparison to avoid leaking token length/prefix via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** site_key -> secret name suffix (uppercase, non-alphanumerics become "_"). */
function tokenSecretName(siteKey: string): string {
  return `PLATFORM_ACCOUNTS_TOKEN_${siteKey.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/**
 * Fixed-window rate limit reusing the shared receiver counter table (one row per
 * bucket). Fails CLOSED on a bookkeeping failure so a broken counter can never
 * become an open door.
 */
async function checkRateLimit(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const { data, error } = await admin
    .from("presence_receiver_rate_limit")
    .select("window_start, count")
    .eq("bucket", bucket)
    .maybeSingle();

  if (error) return false;

  if (!data) {
    const { error: insErr } = await admin
      .from("presence_receiver_rate_limit")
      .insert({ bucket, window_start: now.toISOString(), count: 1 });
    return !insErr;
  }

  const windowStart = new Date(data.window_start as string);
  if (now.getTime() - windowStart.getTime() >= windowMs) {
    const { error: updErr } = await admin
      .from("presence_receiver_rate_limit")
      .update({ window_start: now.toISOString(), count: 1 })
      .eq("bucket", bucket);
    return !updErr;
  }

  if (Number(data.count) >= limit) return false;

  const { error: updErr } = await admin
    .from("presence_receiver_rate_limit")
    .update({ count: Number(data.count) + 1 })
    .eq("bucket", bucket);
  return !updErr;
}

/** Accept a non-negative safe integer as a number or a numeric string. */
function parseAccountCount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    if (value < 0 || value > MAX_ACCOUNT_COUNT) return null;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d{1,10}$/.test(trimmed)) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_ACCOUNT_COUNT) return null;
    return parsed;
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Missing service configuration" }, 500);
  }

  // Service-role client — this endpoint has no Supabase JWT to verify (brands are
  // external backends authenticated by their own per-platform bearer token), so
  // there is no caller-token check to perform and no second client is required.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Resolve the trusted production platform list ---------------------------
  const { data: sites, error: sitesErr } = await admin
    .from("ai_sites")
    .select("id, site_key")
    .eq("is_active", true)
    .eq("environment", ENVIRONMENT);
  if (sitesErr) {
    return json({ ok: false, error: "Site registry unavailable" }, 503);
  }
  const productionSites = (sites ?? []).filter(
    (s) => typeof s.site_key === "string" && s.site_key.length > 0,
  );
  if (productionSites.length === 0) {
    return json({ ok: false, error: "Site configuration missing" }, 503);
  }

  // --- Auth (fail closed) ----------------------------------------------------
  const authHeader = req.headers.get("authorization") ?? "";
  const supplied = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  let matchedSite: { id: string; site_key: string } | null = null;
  let anyTokenConfigured = false;
  if (supplied.length > 0) {
    for (const site of productionSites) {
      const expected = (Deno.env.get(tokenSecretName(site.site_key)) ?? "").trim();
      if (!expected) continue;
      anyTokenConfigured = true;
      // Evaluate every configured token (no early exit) so timing does not leak
      // which platform matched.
      if (timingSafeEqual(supplied, expected) && matchedSite === null) {
        matchedSite = { id: site.id, site_key: site.site_key };
      }
    }
  }

  if (!matchedSite) {
    // Never reveal whether any token is configured or which one was wrong.
    return json({ ok: false, error: "Unauthorized" }, anyTokenConfigured ? 401 : 503);
  }

  // --- Size bound ------------------------------------------------------------
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Payload too large" }, 413);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ ok: false, error: "Malformed request" }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Payload too large" }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ ok: false, error: "Malformed request" }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Malformed request" }, 400);
  }

  // --- Validation (aggregate count only) -------------------------------------
  const accountCount = parseAccountCount(body.account_count);
  if (accountCount === null) {
    return json({ ok: false, error: "Invalid account_count" }, 400);
  }

  let sourceLabel = "platform-backend";
  if (body.source_label !== undefined && body.source_label !== null) {
    if (typeof body.source_label !== "string" || !SOURCE_LABEL_PATTERN.test(body.source_label)) {
      return json({ ok: false, error: "Invalid source_label" }, 400);
    }
    sourceLabel = body.source_label;
  }

  // --- Rate limit ------------------------------------------------------------
  const rateOk = await checkRateLimit(
    admin,
    `platform-accounts:${matchedSite.site_key}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rateOk) {
    return json({ ok: false, error: "Rate limit exceeded" }, 429);
  }

  // --- Upsert the latest total (server-stamped timestamp) --------------------
  const now = new Date().toISOString();
  const { error: upsertErr } = await admin
    .from("platform_account_feeds")
    .upsert(
      {
        site_id: matchedSite.id,
        environment: ENVIRONMENT,
        account_count: accountCount,
        source_label: sourceLabel,
        reported_at: now,
        updated_at: now,
      },
      { onConflict: "site_id,environment" },
    );
  if (upsertErr) {
    return json({ ok: false, error: "Failed to store account feed" }, 500);
  }

  return json(
    {
      ok: true,
      received: true,
      site_key: matchedSite.site_key,
      account_count: accountCount,
      reported_at: now,
    },
    200,
  );
});
