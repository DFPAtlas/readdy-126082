import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// send-quickguard-support-reply — securely forwards a single DFP Command staff
// reply to the QuickGuard support bridge (receive-dfp-support-reply).
//
//   * verify_jwt = true  → only authenticated DFP Command staff can invoke.
//   * Staff gate         → internal_has_permission("support.tickets.reply"),
//                          the same authorization used for replying to tickets.
//   * Server-resolved    → the browser supplies ONLY `messageId`; the QuickGuard
//                          ticket UUID, reply text, sender name, DFP ticket
//                          number and connector secret are all resolved here.
//   * HMAC-signed        → QUICKGUARD_REPLY_CONNECTOR_SECRET (Edge Function
//                          secret only, never exposed to the client or logs).
//   * Idempotent         → dfpMessageId is the original central message UUID, so
//                          retries never create duplicates on the QuickGuard side.
//
// Secrets: QUICKGUARD_REPLY_CONNECTOR_SECRET (Supabase Edge Function secret).
// ============================================================================

const RECEIVER_URL =
  "https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/receive-dfp-support-reply";

const encoder = new TextEncoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUICKGUARD_REF_RE =
  /^quickguard-ticket:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ---- Staff authorization (reuse the existing DFP Command model) ----
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);

  const { data: canReply } = await userClient.rpc("internal_has_permission", {
    perm: "support.tickets.reply",
  });
  if (!canReply) return json({ success: false, error: "Forbidden" }, 403);

  // ---- Parse the only accepted input ----
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Malformed JSON" }, 400);
  }

  const messageId = typeof body.messageId === "string"
    ? body.messageId.trim()
    : "";
  if (!UUID_RE.test(messageId)) {
    return json({
      success: false,
      error: "messageId is required and must be a valid UUID",
    }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Load central message (service role, post-authorization) ----
  const { data: msg } = await admin
    .from("internal_ticket_messages")
    .select(
      "id, ticket_id, sender_type, sender_user_id, sender_name, sender_email, message_body, is_internal_note, created_at",
    )
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) return json({ success: false, error: "Message not found" }, 404);

  if (msg.sender_type !== "staff") {
    return json({ success: false, error: "Message is not a staff reply" }, 422);
  }
  if (msg.is_internal_note !== false) {
    return json({ success: false, error: "Internal notes cannot be forwarded" }, 422);
  }

  // ---- Load related ticket + site (must be QuickGuard) ----
  const { data: ticket } = await admin
    .from("internal_support_tickets")
    .select("id, ticket_number, site_id, external_reference")
    .eq("id", msg.ticket_id)
    .maybeSingle();

  if (!ticket) return json({ success: false, error: "Ticket not found" }, 404);

  const { data: site } = await admin
    .from("internal_support_sites")
    .select("id, site_slug")
    .eq("id", ticket.site_id)
    .maybeSingle();

  if (!site || site.site_slug !== "quickguard") {
    return json({
      success: false,
      error: "Ticket does not belong to QuickGuard",
    }, 422);
  }

  const ticketNumber = typeof ticket.ticket_number === "string"
    ? ticket.ticket_number
    : "";
  if (!ticketNumber) {
    return json({ success: false, error: "Ticket number is missing" }, 422);
  }

  // ---- Resolve the QuickGuard ticket UUID server-side ----
  const externalReference = typeof ticket.external_reference === "string"
    ? ticket.external_reference
    : "";
  const refMatch = externalReference.match(QUICKGUARD_REF_RE);
  if (!refMatch) {
    return json({
      success: false,
      error: "Ticket has no QuickGuard reference",
    }, 422);
  }
  const quickguardTicketId = refMatch[1];

  // ---- Connector secret (Edge Function secret only) ----
  const secret = Deno.env.get("QUICKGUARD_REPLY_CONNECTOR_SECRET") ?? "";
  if (!secret) {
    return json({
      success: false,
      error: "QuickGuard reply connector unavailable",
    }, 503);
  }

  // ---- Build the outbound payload ----
  const senderName = (typeof msg.sender_name === "string" && msg.sender_name.trim())
    ? msg.sender_name.trim()
    : "QuickGuard Support";

  const payload = {
    siteSlug: "quickguard",
    dfpTicketNumber: ticketNumber,
    quickguardTicketId,
    dfpMessageId: msg.id,
    message: {
      senderName,
      body: msg.message_body,
      createdAt: msg.created_at,
    },
  };

  // Serialize ONCE; hash exactly what is sent.
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(rawBody);
  const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = await hmacSha256Hex(secret, canonical);

  let res: Response;
  try {
    res = await fetch(RECEIVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dfp-timestamp": timestamp,
        "x-dfp-nonce": nonce,
        "x-dfp-signature": signature,
      },
      body: rawBody,
    });
  } catch {
    return json({
      success: false,
      error: "Failed to deliver reply to QuickGuard",
    }, 502);
  }

  let parsed: { success?: boolean; duplicate?: boolean } | null = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  // Duplicate is also SUCCESS (dfpMessageId is idempotent on QuickGuard side).
  const delivered = res.ok &&
    (parsed?.success === true || parsed?.duplicate === true);

  if (delivered) {
    return json({ success: true, duplicate: parsed?.duplicate === true }, 200);
  }

  // Safe, generic connector error — never leak the QuickGuard raw body.
  return json({
    success: false,
    error: "Failed to deliver reply to QuickGuard",
  }, 502);
});
