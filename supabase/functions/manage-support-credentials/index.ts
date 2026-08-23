import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// manage-support-credentials — secure issuance / revocation / rotation of
// per-site ticket-ingestion credentials.
//
// The raw secret is generated here, stored ONLY as a SHA-256 hash + an
// AES-GCM ciphertext, and returned exactly once in the issue response.
// No raw secret is ever written to the database.
//
// Gated by a shared admin secret (x-admin-secret header) so it is not callable
// from a public browser. Set TICKET_ADMIN_SECRET in the Supabase Dashboard.
// ============================================================================

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
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

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Admin gate.
  const expected = Deno.env.get("TICKET_ADMIN_SECRET") ?? "";
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!expected || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "issue") {
      const siteSlug = String(body.siteSlug ?? "").trim();
      const clientName = String(body.clientName ?? "").trim();
      const integrationMode = String(body.integrationMode ?? "public_form");
      const allowedOrigins: string[] = Array.isArray(body.allowedOrigins)
        ? body.allowedOrigins.map((o: unknown) => String(o))
        : [];
      const turnstileRequired = body.turnstileRequired === true;
      const elevatedPriorityAllowed = body.elevatedPriorityAllowed === true;

      if (!siteSlug || !clientName) {
        return json({ error: "siteSlug and clientName are required" }, 400);
      }
      if (!["public_form", "server_to_server"].includes(integrationMode)) {
        return json({ error: "integrationMode must be public_form or server_to_server" }, 400);
      }
      if (integrationMode === "public_form" && allowedOrigins.length === 0) {
        return json({ error: "public_form credentials require at least one allowed origin" }, 400);
      }

      const { data: site } = await supabaseAdmin
        .from("internal_support_sites")
        .select("id")
        .eq("site_slug", siteSlug)
        .maybeSingle();
      if (!site) {
        return json({ error: "Site not found" }, 404);
      }

      const keyPrefix = "dfp_" + randomHex(6);
      const secret = randomHex(32);
      const secretHash = await sha256Hex(secret);
      const secretCiphertext = await encryptSecret(secret);

      const { error } = await supabaseAdmin.from("internal_ticket_api_clients").insert({
        site_id: site.id,
        client_name: clientName,
        integration_mode: integrationMode,
        key_prefix: keyPrefix,
        secret_hash: secretHash,
        secret_ciphertext: secretCiphertext,
        allowed_origins: allowedOrigins,
        turnstile_required: turnstileRequired,
        elevated_priority_allowed: elevatedPriorityAllowed,
      });

      if (error) {
        return json({ error: "Failed to issue credential" }, 500);
      }

      // Returned exactly once — store it securely on the client.
      return json({ keyPrefix, secret, integrationMode, allowedOrigins }, 201);
    }

    if (action === "revoke") {
      const keyPrefix = String(body.keyPrefix ?? "").trim();
      if (!keyPrefix) {
        return json({ error: "keyPrefix is required" }, 400);
      }
      const { error } = await supabaseAdmin
        .from("internal_ticket_api_clients")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("key_prefix", keyPrefix);
      if (error) {
        return json({ error: "Failed to revoke credential" }, 500);
      }
      return json({ revoked: true, keyPrefix }, 200);
    }

    if (action === "list") {
      const siteSlug = String(body.siteSlug ?? "").trim();
      if (!siteSlug) {
        return json({ error: "siteSlug is required" }, 400);
      }
      const { data: site } = await supabaseAdmin
        .from("internal_support_sites")
        .select("id")
        .eq("site_slug", siteSlug)
        .maybeSingle();
      if (!site) {
        return json({ error: "Site not found" }, 404);
      }
      const { data } = await supabaseAdmin
        .from("internal_ticket_api_clients")
        .select("id, client_name, integration_mode, key_prefix, allowed_origins, turnstile_required, elevated_priority_allowed, is_active, last_used_at, revoked_at")
        .eq("site_id", site.id)
        .order("created_at", { ascending: false });
      return json({ clients: data ?? [] }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch {
    return json({ error: "Malformed request" }, 400);
  }
});
