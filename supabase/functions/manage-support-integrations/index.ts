import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// manage-support-integrations — secure admin operations for the support-ticket
// integration administration area:
//   * issue_credential   — generate secret, store hash + AES-GCM ciphertext,
//                          return the raw secret exactly once
//   * rotate_credential  — issue a replacement, optionally revoke the old one
//   * revoke_credential  — deactivate a credential (preserves history)
//   * health_test        — non-ticket-creating configuration / connectivity
//                          checks (never a live ticket submission)
//   * create_test_ticket — owner/admin-only internal test ticket (clearly
//                          marked, no customer notification, no auto repair)
//
// The caller is the authenticated Command Centre user (verify_jwt). The role
// is re-checked server-side against internal_user_roles — owner/admin only.
// No raw secret is ever written to logs or the database.
//
// Optional `keyPrefixBase` (default "dfp_") allows site-specific prefixes,
// e.g. "qg_" for the QuickGuard server-to-server bridge. It must match
// /^[a-z][a-z0-9]{0,7}_$/ and is appended with 6 random bytes.
// ============================================================================

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...CORS,
      "Content-Type": "application/json",
    },
    status,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("TICKET_CREDENTIAL_ENCRYPTION_KEY") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(plain: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain));
  const ctBytes = new Uint8Array(ct);
  const full = new Uint8Array(12 + ctBytes.length);
  full.set(iv, 0);
  full.set(ctBytes, 12);
  let bin = "";
  for (let i = 0; i < full.length; i++) bin += String.fromCharCode(full[i]);
  return btoa(bin);
}

async function decryptSecret(cipher: string): Promise<string> {
  const key = await getEncryptionKey();
  const full = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  const iv = full.slice(0, 12);
  const ct = full.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return decoder.decode(pt);
}

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function correlationId(): string {
  return randomHex(8);
}

const isValidOrigin = (o: string) => {
  if (typeof o !== "string" || !o) return false;
  if (o === "*") return false;
  if (o.includes("*")) return false;
  try {
    const u = new URL(o);
    if (!["https:", "http:"].includes(u.protocol)) return false;
    if (u.pathname && u.pathname !== "/") return false;
    if (u.search || u.hash) return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
};

const isValidKeyPrefixBase = (s: string) => /^[a-z][a-z0-9]{0,7}_$/.test(s);

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const TEST_CATEGORIES = new Set([
  "general", "technical", "account", "billing", "access",
  "bug", "complaint", "feature_request", "security", "other",
]);
const TEST_PRIORITIES = new Set(["low", "normal", "high"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS,
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authHeader } } },
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Re-check the Command Centre role server-side (never trust the client).
  const { data: roleRow } = await supabaseAdmin
    .from("internal_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!roleRow || !["owner", "admin"].includes(roleRow.role as string)) {
    return json({ error: "Forbidden" }, 403);
  }

  const logAudit = async (entityType: string, action: string, description: string, meta: Record<string, unknown>) => {
    await supabaseAdmin.from("internal_activity_log").insert({
      user_id: user.id,
      description,
      entity_type: entityType,
      action,
      metadata: meta,
    }).then(({ error }) => { if (error) console.warn("audit log failed:", error.message); });
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed request" }, 400);
  }

  const action = String(body.action ?? "");

  const getSite = async (siteId: unknown) => {
    if (typeof siteId !== "string" || !siteId) return null;
    const { data } = await supabaseAdmin
      .from("internal_support_sites")
      .select("id, site_name, site_slug")
      .eq("id", siteId)
      .maybeSingle();
    return data ?? null;
  };

  const readKeyPrefixBase = () => {
    const raw = typeof body.keyPrefixBase === "string" ? body.keyPrefixBase.trim() : "dfp_";
    if (!isValidKeyPrefixBase(raw)) return null;
    return raw;
  };

  const persistCredential = async (args: {
    siteId: string; clientName: string; integrationMode: string;
    allowedOrigins: string[]; turnstileRequired: boolean;
    elevatedPriorityAllowed: boolean; expiresAt: string | null;
    keyPrefixBase: string;
  }) => {
    const keyPrefix = args.keyPrefixBase + randomHex(6);
    const secret = randomHex(32);
    const secretHash = await sha256Hex(secret);
    const secretCiphertext = await encryptSecret(secret);

    const { error } = await supabaseAdmin.from("internal_ticket_api_clients").insert({
      site_id: args.siteId,
      client_name: args.clientName,
      integration_mode: args.integrationMode,
      key_prefix: keyPrefix,
      secret_hash: secretHash,
      secret_ciphertext: secretCiphertext,
      allowed_origins: args.allowedOrigins,
      turnstile_required: args.turnstileRequired,
      elevated_priority_allowed: args.elevatedPriorityAllowed,
      expires_at: args.expiresAt,
    });
    if (error) throw new Error("Failed to persist credential");
    return { keyPrefix, secret };
  };

  try {
    if (action === "issue_credential") {
      const site = await getSite(body.siteId);
      if (!site) return json({ error: "Site not found" }, 404);

      const clientName = String(body.clientName ?? "").trim();
      const integrationMode = String(body.integrationMode ?? "public_form");
      const allowedOrigins: string[] = Array.isArray(body.allowedOrigins)
        ? body.allowedOrigins.filter((o): o is string => typeof o === "string")
        : [];
      const expiresAt = body.expiresAt ? String(body.expiresAt) : null;
      const keyPrefixBase = readKeyPrefixBase();
      if (keyPrefixBase === null) return json({ error: "Invalid key prefix base" }, 400);

      if (!clientName) return json({ error: "Client name is required" }, 400);
      if (!["public_form", "server_to_server"].includes(integrationMode)) {
        return json({ error: "Invalid integration mode" }, 400);
      }
      for (const o of allowedOrigins) {
        if (!isValidOrigin(o)) return json({ error: `Invalid origin: ${o}` }, 400);
      }
      if (integrationMode === "public_form" && allowedOrigins.length === 0) {
        return json({ error: "public_form credentials require at least one allowed origin" }, 400);
      }

      const { keyPrefix, secret } = await persistCredential({
        siteId: site.id,
        clientName,
        integrationMode,
        allowedOrigins,
        turnstileRequired: body.turnstileRequired === true,
        elevatedPriorityAllowed: body.elevatedPriorityAllowed === true,
        expiresAt,
        keyPrefixBase,
      });

      await logAudit("support_credential", "created",
        `Credential "${clientName}" created for ${site.site_name}`,
        { site_id: site.id, key_prefix: keyPrefix, integration_mode: integrationMode });

      return json({ keyPrefix, secret, integrationMode, allowedOrigins, siteSlug: site.site_slug }, 201);
    }

    if (action === "rotate_credential") {
      const site = await getSite(body.siteId);
      if (!site) return json({ error: "Site not found" }, 404);

      const oldKeyPrefix = String(body.oldKeyPrefix ?? "").trim();
      const clientName = String(body.clientName ?? "").trim();
      const integrationMode = String(body.integrationMode ?? "public_form");
      const allowedOrigins: string[] = Array.isArray(body.allowedOrigins)
        ? body.allowedOrigins.filter((o): o is string => typeof o === "string")
        : [];
      const revokeOld = body.revokeOld !== false; // default: revoke immediately
      const keyPrefixBase = readKeyPrefixBase();
      if (keyPrefixBase === null) return json({ error: "Invalid key prefix base" }, 400);

      if (!oldKeyPrefix) return json({ error: "oldKeyPrefix is required" }, 400);
      if (!clientName) return json({ error: "Client name is required" }, 400);
      for (const o of allowedOrigins) {
        if (!isValidOrigin(o)) return json({ error: `Invalid origin: ${o}` }, 400);
      }

      const { keyPrefix, secret } = await persistCredential({
        siteId: site.id,
        clientName,
        integrationMode,
        allowedOrigins,
        turnstileRequired: body.turnstileRequired === true,
        elevatedPriorityAllowed: body.elevatedPriorityAllowed === true,
        expiresAt: null,
        keyPrefixBase,
      });

      let revoked = false;
      if (revokeOld) {
        const { error } = await supabaseAdmin
          .from("internal_ticket_api_clients")
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq("key_prefix", oldKeyPrefix)
          .eq("site_id", site.id);
        revoked = !error;
      }

      await logAudit("support_credential", "rotated",
        `Credential rotated for ${site.site_name} (old ${oldKeyPrefix} → ${keyPrefix})`,
        { site_id: site.id, old_key_prefix: oldKeyPrefix, key_prefix: keyPrefix, revoked_old: revoked });

      return json({ keyPrefix, secret, integrationMode, allowedOrigins, revokedOld: revoked }, 201);
    }

    if (action === "revoke_credential") {
      const keyPrefix = String(body.keyPrefix ?? "").trim();
      const siteId = typeof body.siteId === "string" ? body.siteId : null;
      if (!keyPrefix) return json({ error: "keyPrefix is required" }, 400);

      const query = supabaseAdmin
        .from("internal_ticket_api_clients")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("key_prefix", keyPrefix);
      if (siteId) query.eq("site_id", siteId);
      const { error } = await query;
      if (error) return json({ error: "Failed to revoke credential" }, 500);

      await logAudit("support_credential", "revoked",
        `Credential ${keyPrefix} revoked`,
        { site_id: siteId, key_prefix: keyPrefix });

      return json({ revoked: true, keyPrefix }, 200);
    }

    if (action === "health_test") {
      const site = await getSite(body.siteId);
      if (!site) return json({ error: "Site not found" }, 404);

      const corrId = correlationId();
      const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; detail: string }> = [];

      checks.push({
        name: "site_active",
        status: "pass",
        detail: `Site "${site.site_name}" is registered`,
      });

      const { data: clients } = await supabaseAdmin
        .from("internal_ticket_api_clients")
        .select("id, client_name, integration_mode, key_prefix, secret_ciphertext, allowed_origins, is_active, revoked_at")
        .eq("site_id", site.id);

      const active = (clients ?? []).filter((c) => c.is_active && !c.revoked_at);
      if (active.length === 0) {
        checks.push({ name: "credential", status: "fail", detail: "No active credential — issue one before connecting" });
      } else {
        checks.push({ name: "credential", status: "pass", detail: `${active.length} active credential(s)` });
      }

      for (const c of clients ?? []) {
        const label = `${c.integration_mode} · ${c.key_prefix}`;
        if (c.integration_mode === "server_to_server") {
          try {
            if (!c.secret_ciphertext) {
              checks.push({ name: "auth", status: "fail", detail: `${label}: no stored secret` });
            } else {
              await decryptSecret(c.secret_ciphertext);
              checks.push({ name: "auth", status: "pass", detail: `${label}: signing secret verifiable` });
            }
          } catch {
            checks.push({
              name: "auth", status: "fail",
              detail: `${label}: secret decryption failed — TICKET_CREDENTIAL_ENCRYPTION_KEY may be missing or rotated`,
            });
          }
        }
        for (const o of c.allowed_origins ?? []) {
          if (!isValidOrigin(o)) {
            checks.push({ name: "origin", status: "fail", detail: `${label}: invalid origin "${o}"` });
          } else {
            checks.push({ name: "origin", status: "pass", detail: `${label}: origin "${o}" valid` });
          }
        }
        if ((c.allowed_origins ?? []).length === 0 && c.integration_mode === "public_form") {
          checks.push({ name: "origin", status: "fail", detail: `${label}: public_form requires at least one origin` });
        }
      }

      const failed = checks.some((c) => c.status === "fail");
      const overall = failed ? "needs_attention" : "ok";

      await logAudit("support_site", "health_test",
        `Integration health test run for ${site.site_name}`,
        { site_id: site.id, correlation_id: corrId, overall });

      return json({ correlationId: corrId, overall, checks, site: { id: site.id, slug: site.site_slug } }, 200);
    }

    if (action === "create_test_ticket") {
      const siteId = typeof body.siteId === "string" ? body.siteId : "";
      const { data: site } = await supabaseAdmin
        .from("internal_support_sites")
        .select("id, site_name, site_slug, project_id, is_active")
        .eq("id", siteId)
        .maybeSingle();
      if (!site) return json({ error: "Site not found" }, 404);
      if (!site.is_active) return json({ error: "Site is inactive" }, 403);

      const customerName = String(body.customerName ?? "").trim();
      const customerEmail = String(body.customerEmail ?? "").trim();
      const subject = String(body.subject ?? "").trim();
      const description = String(body.description ?? "").trim();
      const category = String(body.category ?? "");
      const priority = String(body.priority ?? "normal");

      if (!customerName) return json({ error: "Customer name is required" }, 400);
      if (!customerEmail) return json({ error: "Email is required" }, 400);
      if (!isValidEmail(customerEmail)) return json({ error: "Email is invalid" }, 400);
      if (!subject) return json({ error: "Subject is required" }, 400);
      if (!description) return json({ error: "Description is required" }, 400);
      if (!TEST_CATEGORIES.has(category)) return json({ error: "Invalid category" }, 400);
      if (!TEST_PRIORITIES.has(priority)) return json({ error: "Invalid priority" }, 400);

      // Clearly mark the test ticket and prefix the subject.
      const testSubject = `[TEST] ${subject}`;
      const metadata = {
        is_test: true,
        test_source: "dfp_command_admin_test",
      };

      const { data: result, error: rpcErr } = await supabaseAdmin.rpc(
        "internal_create_support_ticket",
        {
          p_site_id: site.id,
          p_project_id: site.project_id ?? null,
          p_external_reference: null,
          p_customer_user_id: null,
          p_customer_name: customerName,
          p_customer_email: customerEmail,
          p_customer_phone: null,
          p_subject: testSubject,
          p_description: description,
          p_category: category,
          p_priority: priority,
          p_source: "admin",
          p_metadata: metadata,
          p_nonce_hash: null,
          p_idempotency_hash: null,
        },
      );

      if (rpcErr) {
        return json({ error: "Failed to create test ticket" }, 500);
      }

      const created = (result ?? {}) as { status?: string; ticket_id?: string; ticket_number?: string };
      const ticketId = created.ticket_id ?? null;
      const ticketNumber = created.ticket_number ?? null;

      await logAudit("support_ticket", "test_ticket_created",
        `Test ticket ${ticketNumber ?? ""} created for ${site.site_name}`,
        { site_id: site.id, ticket_id: ticketId, ticket_number: ticketNumber });

      return json({ success: true, ticketId, ticketNumber }, 201);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: "Internal error", requestId: correlationId() }, 500);
  }
});
