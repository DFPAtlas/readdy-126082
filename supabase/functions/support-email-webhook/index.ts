import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-email-webhook — delivery-status webhook (Resend).
//
// Verifies the Svix signature, dedupes provider events, and updates the
// matching internal_ticket_notifications record by provider_message_id.
// Bounces / complaints mark the record failed and stop further auto-sends to
// that recipient.
//
// Secrets: SUPPORT_EMAIL_WEBHOOK_SECRET
// ============================================================================

const encoder = new TextEncoder();

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(message));
  return bytesToBase64(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("SUPPORT_EMAIL_WEBHOOK_SECRET") ?? "";
  if (!secret) return false;

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const expected = await hmacSha256Base64(secret, `${svixId}.${svixTimestamp}.${rawBody}`);
  const parts = svixSignature.split(" ");
  for (const part of parts) {
    if (part && timingSafeEqual(part, expected)) return true;
  }
  return false;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  if (!(await verifySignature(req, rawBody))) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Malformed payload" }, 400);
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;
  const type = typeof data.type === "string" ? data.type : "";
  const emailId =
    (typeof data.email_id === "string" ? data.email_id : "") ||
    (typeof data.id === "string" ? data.id : "");

  if (!emailId) {
    return json({ error: "Missing email id" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Match the notification record by provider message id.
  const { data: notif } = await supabaseAdmin
    .from("internal_ticket_notifications")
    .select("id, status")
    .eq("provider_message_id", emailId)
    .maybeSingle();

  if (!notif) {
    // Unknown email id — acknowledge (so Resend stops retrying) but don't fail.
    return json({ ok: true, ignored: true }, 200);
  }

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;

  switch (type) {
    case "email.delivered":
      if (notif.status === "delivered") return json({ ok: true, duplicate: true }, 200);
      patch = { status: "delivered", delivered_at: now };
      break;
    case "email.sent":
      patch = { status: "sent", sent_at: now };
      break;
    case "email.bounced":
      patch = { status: "failed", last_error_code: "bounced", failed_at: now };
      break;
    case "email.complained":
      patch = { status: "failed", last_error_code: "complained", failed_at: now };
      break;
    case "email.failed":
      patch = { status: "failed", last_error_code: "provider_failed", failed_at: now };
      break;
    default:
      // opened / clicked / other — only record opened if desired; ignore.
      return json({ ok: true, ignored: true }, 200);
  }

  const { error } = await supabaseAdmin
    .from("internal_ticket_notifications")
    .update(patch)
    .eq("id", notif.id);

  if (error) {
    return json({ error: "Failed to update" }, 500);
  }

  return json({ ok: true }, 200);
});
