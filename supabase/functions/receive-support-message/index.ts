import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// receive-support-message — server-to-server receiver for customer follow-up
// messages from QuickGuard. Appends a new customer message to the EXISTING
// central DFP ticket (never creates a ticket).
//
//   * verify_jwt = false — authentication is HMAC-signed server-to-server,
//     reusing the exact credential model from receive-support-ticket.
//   * Reuses the existing QuickGuard server_to_server credential resolved via
//     x-dfp-key from internal_ticket_api_clients.
//   * Idempotent via internal_ticket_messages.external_message_id
//     (quickguard-message:<UUID>), backed by a partial unique index.
//   * Inserts with sender_type='customer' and is_internal_note=false so the
//     existing customer-reply notification + last-activity triggers keep
//     working unchanged.
//
// Secrets: TICKET_CREDENTIAL_ENCRYPTION_KEY (Supabase Edge Function secret).
// ============================================================================

const MAX_BODY_BYTES = 64_000;
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const MAX_MESSAGE_BODY = 20_000;

const SITE_SLUG = "quickguard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dfp-site, x-dfp-key, x-dfp-timestamp, x-dfp-nonce, x-dfp-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function correlationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    keyData,
    encoder.encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("TICKET_CREDENTIAL_ENCRYPTION_KEY") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decryptSecret(cipher: string): Promise<string> {
  const key = await getEncryptionKey();
  const full = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  const iv = full.slice(0, 12);
  const ct = full.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return decoder.decode(pt);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const requestId = correlationId();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ---- Read raw body ONCE for HMAC verification ----
  let rawBody: string;
  let body: Record<string, unknown>;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return json({ success: false, error: "Content-Type must be application/json" }, 415);
    }
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) {
      return json({ success: false, error: "Request body too large" }, 413);
    }
    rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return json({ success: false, error: "Request body too large" }, 413);
    }
    body = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Invalid request body" }, 400);
    }
  } catch {
    return json({ success: false, error: "Malformed JSON" }, 400);
  }

  try {
    // ---- Required headers ----
    const siteSlugHeader = cleanText(req.headers.get("x-dfp-site"));
    const keyPrefix = cleanText(req.headers.get("x-dfp-key"));
    const timestamp = cleanText(req.headers.get("x-dfp-timestamp"));
    const nonce = cleanText(req.headers.get("x-dfp-nonce"));
    const signature = cleanText(req.headers.get("x-dfp-signature"));

    if (siteSlugHeader !== SITE_SLUG) {
      return json({ success: false, error: "Unrecognised site" }, 401);
    }
    if (!keyPrefix || !timestamp || !nonce || !signature) {
      return json({ success: false, error: "Missing signature headers" }, 401);
    }

    // ---- Resolve the QuickGuard site ----
    const { data: site } = await supabaseAdmin
      .from("internal_support_sites")
      .select("id, site_slug, is_active")
      .eq("site_slug", SITE_SLUG)
      .maybeSingle();

    if (!site) {
      return json({ success: false, error: "Source not recognised" }, 401);
    }
    if (!site.is_active) {
      return json({ success: false, error: "Source is inactive" }, 403);
    }

    // ---- Resolve the existing active server_to_server credential ----
    const { data: creds } = await supabaseAdmin
      .from("internal_ticket_api_clients")
      .select(
        "id, key_prefix, secret_ciphertext, integration_mode, is_active",
      )
      .eq("site_id", site.id)
      .eq("key_prefix", keyPrefix)
      .eq("integration_mode", "server_to_server")
      .eq("is_active", true);

    const credential = creds?.[0] ?? null;
    if (!credential) {
      return json({ success: false, error: "Invalid credentials" }, 401);
    }

    // ---- HMAC verification (matches receive-support-ticket) ----
    const secret = credential.secret_ciphertext
      ? await decryptSecret(credential.secret_ciphertext)
      : null;
    if (!secret) {
      return json({ success: false, error: "Credential verification failed" }, 401);
    }

    const tsMs = Date.parse(timestamp);
    if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > TIMESTAMP_WINDOW_MS) {
      return json({ success: false, error: "Request timestamp out of range" }, 401);
    }

    const bodyHash = await sha256Hex(rawBody);
    const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
    const expected = await hmacSha256Hex(secret, canonical);
    if (!timingSafeEqual(expected, signature.toLowerCase())) {
      return json({ success: false, error: "Invalid signature" }, 401);
    }

    // ---- Parse + validate payload ----
    const siteSlug = cleanText(body.siteSlug);
    const dfpTicketNumber = cleanText(body.dfpTicketNumber);
    const quickguardTicketId = cleanText(body.quickguardTicketId);
    const quickguardMessageId = cleanText(body.quickguardMessageId);

    const msgObj = (body.message ?? {}) as Record<string, unknown>;
    const messageBody = cleanText(msgObj.body);
    const createdAtRaw = cleanText(msgObj.createdAt);

    if (siteSlug !== SITE_SLUG) {
      return json({ success: false, error: "siteSlug must be quickguard" }, 400);
    }
    if (!dfpTicketNumber) {
      return json({ success: false, error: "dfpTicketNumber is required" }, 400);
    }
    if (!UUID_RE.test(quickguardTicketId)) {
      return json({ success: false, error: "quickguardTicketId is invalid" }, 400);
    }
    if (!UUID_RE.test(quickguardMessageId)) {
      return json({ success: false, error: "quickguardMessageId is invalid" }, 400);
    }
    if (!messageBody) {
      return json({ success: false, error: "message.body is required" }, 400);
    }
    if (messageBody.length > MAX_MESSAGE_BODY) {
      return json({ success: false, error: "message.body is too long" }, 400);
    }
    const createdAtMs = Date.parse(createdAtRaw);
    if (!createdAtRaw || Number.isNaN(createdAtMs)) {
      return json({ success: false, error: "message.createdAt is invalid" }, 400);
    }

    // ---- Match the existing central ticket (site + number + reference) ----
    const externalReference = `quickguard-ticket:${quickguardTicketId}`;
    const { data: ticket } = await supabaseAdmin
      .from("internal_support_tickets")
      .select(
        "id, ticket_number, site_id, external_reference, customer_name, customer_email, customer_user_id, status",
      )
      .eq("site_id", site.id)
      .eq("ticket_number", dfpTicketNumber)
      .eq("external_reference", externalReference)
      .maybeSingle();

    if (!ticket) {
      return json({ success: false, error: "Ticket not found" }, 404);
    }

    const externalMessageId = `quickguard-message:${quickguardMessageId}`;

    // ---- Idempotency: has this external message already been ingested? ----
    const { data: existing } = await supabaseAdmin
      .from("internal_ticket_messages")
      .select("id")
      .eq("external_message_id", externalMessageId)
      .maybeSingle();

    if (existing) {
      // Safe duplicate: update last_used_at, return duplicate success.
      await supabaseAdmin
        .from("internal_ticket_api_clients")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", credential.id);
      return json({
        success: true,
        duplicate: true,
        ticketNumber: ticket.ticket_number,
      }, 200);
    }

    // ---- Insert the customer message (triggers handle last-activity + notify) ----
    const metadata = {
      source: "quickguard",
      quickguard_message_id: quickguardMessageId,
      quickguard_ticket_id: quickguardTicketId,
    };

    const { error: insertErr } = await supabaseAdmin
      .from("internal_ticket_messages")
      .insert({
        ticket_id: ticket.id,
        sender_type: "customer",
        sender_user_id: ticket.customer_user_id ?? null,
        sender_name: ticket.customer_name ?? null,
        sender_email: ticket.customer_email ?? null,
        message_body: messageBody,
        message_format: "plain_text",
        is_internal_note: false,
        is_read: false,
        external_message_id: externalMessageId,
        metadata,
        created_at: new Date(createdAtMs).toISOString(),
      });

    if (insertErr) {
      // Could be a concurrent duplicate race on the unique index.
      const { data: raced } = await supabaseAdmin
        .from("internal_ticket_messages")
        .select("id")
        .eq("external_message_id", externalMessageId)
        .maybeSingle();
      if (raced) {
        await supabaseAdmin
          .from("internal_ticket_api_clients")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", credential.id);
        return json({
          success: true,
          duplicate: true,
          ticketNumber: ticket.ticket_number,
        }, 200);
      }
      return json({ success: false, error: "Failed to save message", requestId }, 500);
    }

    // ---- Set status to waiting_on_staff for an active ticket ----
    const terminal = ["resolved", "closed", "spam"];
    if (!terminal.includes(ticket.status as string)) {
      await supabaseAdmin
        .from("internal_support_tickets")
        .update({ status: "waiting_on_staff" })
        .eq("id", ticket.id);
    }

    // ---- Mark credential used ----
    await supabaseAdmin
      .from("internal_ticket_api_clients")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", credential.id);

    return json({
      success: true,
      duplicate: false,
      ticketNumber: ticket.ticket_number,
    }, 201);
  } catch {
    return json({ success: false, error: "Internal error", requestId }, 500);
  }
});
