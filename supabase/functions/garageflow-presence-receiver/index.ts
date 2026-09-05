import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// garageflow-presence-receiver — authenticated server-to-server receiver for
// GarageFlow anonymous visitor presence.
//
// Contract:
//   POST /functions/v1/garageflow-presence-receiver
//   Authorization: Bearer <token>
//   Content-Type: application/json
//   {"session_id": "<16-128 chars [A-Za-z0-9_-]>", "event": "page_view"|"heartbeat"}
//
// Responses:
//   200 -> { ok:true, received:true, environment, coalesced }
//   400 -> invalid/malformed payload
//   401 -> missing/invalid credential
//   413 -> payload too large
//   429 -> rate limited
//   500 -> write/backing failure
//   503 -> receiver not configured (missing secret) or site config missing
//
// Security:
//   * Auth is a shared bearer token held in Supabase secrets (never browser
//     code, never a service-role key in the client).
//   * The token determines the environment (production vs test) — never the
//     client. Test tokens write environment='test', which the wall's 5-minute
//     production-only query ignores, so test traffic never pollutes the wall.
//   * site_key / canonical domain are resolved from the trusted ai_sites
//     registry server-side.
//   * The raw session id is HMAC-SHA256'd with a secret + site scope; the raw
//     value is never stored or logged.
//   * No user identity, IP address, URL, query string or page content is ever
//     accepted or persisted.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_KEY = "garageflow";
const CANONICAL_DOMAIN_FALLBACK = "garageflow.uk";
const RECEIVER_MARKER = "garageflow-presence";
const ALLOWED_EVENTS = new Set(["page_view", "heartbeat"]);

const MAX_BODY_BYTES = 4096;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const COALESCE_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

// Constant-time comparison to avoid leaking token length/prefix via timing.
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

  if (error) return false; // fail closed on bookkeeping failure

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

async function writePresence(
  admin: ReturnType<typeof createClient>,
  args: { hashedSession: string; environment: string; domain: string; eventName: string },
): Promise<{ ok: boolean; coalesced: boolean }> {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - COALESCE_WINDOW_SEC * 1000).toISOString();

  // Coalesce: reuse the most recent row for this session+environment within the
  // window, refreshing its activity timestamp instead of inserting a new row.
  const { data: recent, error: recentErr } = await admin
    .from("public_analytics_events")
    .select("id")
    .eq("anonymous_session_hash", args.hashedSession)
    .eq("environment", args.environment)
    .gt("occurred_at", cutoff)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentErr) return { ok: false, coalesced: false };

  if (recent) {
    const { error: updErr } = await admin
      .from("public_analytics_events")
      .update({ occurred_at: now })
      .eq("id", recent.id);
    return { ok: !updErr, coalesced: true };
  }

  const { error: insErr } = await admin.from("public_analytics_events").insert({
    event_name: args.eventName,
    environment: args.environment,
    anonymous_session_hash: args.hashedSession,
    occurred_at: now,
    source_metadata: { domain: args.domain, receiver: RECEIVER_MARKER },
  });

  return { ok: !insErr, coalesced: false };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // --- Auth (fail closed) ----------------------------------------------------
  const authHeader = req.headers.get("authorization") ?? "";
  const supplied = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const prodToken = (Deno.env.get("GARAGEFLOW_PRESENCE_AUTH_TOKEN") ?? "").trim();
  const testToken = (Deno.env.get("GARAGEFLOW_PRESENCE_AUTH_TOKEN_TEST") ?? "").trim();
  const hashSecret = (Deno.env.get("GARAGEFLOW_PRESENCE_HASH_SECRET") ?? "").trim();

  let environment: string | null = null;
  if (prodToken && timingSafeEqual(supplied, prodToken)) environment = "production";
  else if (testToken && timingSafeEqual(supplied, testToken)) environment = "test";

  if (!environment) {
    // Do not reveal which token was wrong or whether secrets are configured.
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!hashSecret) {
    return json({ ok: false, error: "Receiver not configured" }, 503);
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
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Malformed request" }, 400);
  }

  // --- Validation (minimum required payload only) ---------------------------
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  const event = typeof body.event === "string" ? body.event : "";

  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return json({ ok: false, error: "Invalid session_id" }, 400);
  }
  if (!ALLOWED_EVENTS.has(event)) {
    return json({ ok: false, error: "Invalid event" }, 400);
  }

  // --- Service client (service_role) ----------------------------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Missing service configuration" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Resolve trusted site config ------------------------------------------
  const { data: siteRow, error: siteErr } = await admin
    .from("ai_sites")
    .select("site_key, domain")
    .eq("site_key", SITE_KEY)
    .maybeSingle();
  if (siteErr || !siteRow) {
    return json({ ok: false, error: "Site configuration missing" }, 503);
  }
  const domain =
    typeof siteRow.domain === "string" && siteRow.domain.trim()
      ? siteRow.domain.trim().toLowerCase()
      : CANONICAL_DOMAIN_FALLBACK;

  // --- Server-side session hashing ------------------------------------------
  const hashedSession = await hmacSha256Hex(
    hashSecret,
    `${SITE_KEY}:${environment}:${sessionId}`,
  );

  // --- Persistent rate limit ------------------------------------------------
  const rateOk = await checkRateLimit(admin, `${SITE_KEY}:${environment}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rateOk) {
    return json({ ok: false, error: "Rate limit exceeded" }, 429);
  }

  // --- Coalesce + write -----------------------------------------------------
  const eventName = event === "heartbeat" ? "presence_heartbeat" : "page_view";
  const writeResult = await writePresence(admin, {
    hashedSession,
    environment,
    domain,
    eventName,
  });
  if (!writeResult.ok) {
    return json({ ok: false, error: "Failed to store presence" }, 500);
  }

  return json({ ok: true, received: true, environment, coalesced: writeResult.coalesced }, 200);
});
