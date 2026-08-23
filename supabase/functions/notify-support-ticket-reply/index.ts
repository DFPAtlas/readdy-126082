import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// notify-support-ticket-reply — customer email for a public staff reply.
//
// Authenticated owner/admin only. Creates an idempotent notification record,
// mints a scoped reply token, sends via Resend with controlled threading
// headers + a signed Reply-To, and records the outcome. A previously-failed
// send can be retried (the failed record is reused rather than duplicated).
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY, RESEND_FROM_DOMAIN, SUPPORT_REPLY_TO_EMAIL,
//   TICKET_HASH_PEPPER
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(token: string): Promise<string> {
  const pepper = Deno.env.get("TICKET_HASH_PEPPER") ?? "";
  return hmacSha256Hex(pepper, token);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: roleRow } = await supabaseAdmin
    .from("internal_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "owner" && roleRow?.role !== "admin") {
    return json({ error: "Forbidden" }, 403);
  }

  let body: { ticket_id?: string; message_id?: string; message_body?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const ticketId = body.ticket_id ?? "";
  const messageId = body.message_id ?? "";
  const replyBody = body.message_body ?? "";
  if (!ticketId || !messageId) return json({ error: "Missing ticket or message" }, 400);

  const { data: ticket } = await supabaseAdmin
    .from("internal_support_tickets")
    .select("id, ticket_number, customer_email, customer_name, subject, site_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) return json({ error: "Ticket not found" }, 404);
  if (!ticket.customer_email) {
    return json({ ok: true, status: "no_recipient" }, 200);
  }

  const customerEmail = ticket.customer_email;
  const idempotencyKey = await sha256Hex(`staff_reply:${ticketId}:${messageId}:${customerEmail.toLowerCase()}`);

  const { data: existing } = await supabaseAdmin
    .from("internal_ticket_notifications")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing && existing.status !== "failed") {
    return json({ ok: true, status: existing.status, idempotent: true }, 200);
  }

  const { data: siteSettings } = await supabaseAdmin
    .from("internal_support_site_settings")
    .select("notify_staff_reply")
    .eq("site_id", ticket.site_id)
    .maybeSingle();
  if (siteSettings && siteSettings.notify_staff_reply === false) {
    return json({ ok: true, status: "disabled" }, 200);
  }

  // Reuse a previously-failed record, otherwise create a fresh one.
  let notificationId: string | undefined = existing?.id as string | undefined;
  if (notificationId) {
    await supabaseAdmin
      .from("internal_ticket_notifications")
      .update({ status: "queued", last_error_code: null, failed_at: null })
      .eq("id", notificationId);
  } else {
    const { data: notifInsert } = await supabaseAdmin
      .from("internal_ticket_notifications")
      .insert({
        ticket_id: ticketId,
        message_id: messageId,
        recipient_email: customerEmail,
        notification_type: "staff_reply",
        provider: "resend",
        idempotency_key: idempotencyKey,
        status: "queued",
      })
      .select("id")
      .single()
      .catch(() => null);
    notificationId = notifInsert?.id as string | undefined;
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendDomain = Deno.env.get("RESEND_FROM_DOMAIN");
  if (!resendKey || !resendDomain) {
    if (notificationId) {
      await supabaseAdmin
        .from("internal_ticket_notifications")
        .update({ status: "failed", last_error_code: "not_configured", failed_at: new Date().toISOString() })
        .eq("id", notificationId);
    }
    return json({ ok: true, status: "not_configured" }, 200);
  }

  let replyToAddress: string | undefined;
  const replyBase = Deno.env.get("SUPPORT_REPLY_TO_EMAIL") ?? "";
  if (replyBase.includes("@")) {
    const [localPart, domain] = replyBase.split("@");
    const token = randomHex(24);
    const tokenHashed = await tokenHash(token);
    await supabaseAdmin.from("internal_ticket_reply_tokens").insert({
      ticket_id: ticketId,
      customer_email: customerEmail,
      token_hash: tokenHashed,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    replyToAddress = `${localPart}+${token}@${domain}`;
  }

  const threadRoot = `<ticket-${ticketId}@support>`;
  const outgoingMessageId = `<staff-${messageId}@support>`;

  const { data: lastCustomerMsg } = await supabaseAdmin
    .from("internal_ticket_messages")
    .select("email_message_id")
    .eq("ticket_id", ticketId)
    .eq("sender_type", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const inReplyTo = lastCustomerMsg?.email_message_id ?? threadRoot;

  const from = `Digital Footprint Support <noreply@${resendDomain}>`;
  const name = escapeHtml(ticket.customer_name ?? "there");
  const number = escapeHtml(ticket.ticket_number ?? "");
  const subject = `[${ticket.ticket_number ?? ""}] New reply from FootprintCC Support`;
  const bodyHtml = escapeHtml(replyBody).replace(/\n/g, "<br>");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#1a1a1a;">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;">Ticket ${number}</p>
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;">Hi ${name},</h1>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${bodyHtml}</div>
      <p style="margin:24px 0 0;font-size:13px;color:#888;">If you need anything else, just reply to this email.</p>
    </div>
  `;

  const payload: Record<string, unknown> = {
    from,
    to: [customerEmail],
    subject,
    html,
    headers: {
      "Message-ID": outgoingMessageId,
      "In-Reply-To": inReplyTo,
      "References": `${threadRoot} ${inReplyTo}`,
    },
  };
  if (replyToAddress) payload.reply_to = replyToAddress;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let resBody: { id?: string; message?: string } | null = null;
    try {
      resBody = (await res.json()) as { id?: string; message?: string };
    } catch {
      resBody = null;
    }

    if (!res.ok) {
      if (notificationId) {
        await supabaseAdmin
          .from("internal_ticket_notifications")
          .update({
            status: "failed",
            last_error_code: `resend_${res.status}`,
            attempt_count: 1,
            failed_at: new Date().toISOString(),
          })
          .eq("id", notificationId);
      }
      return json({ ok: true, status: "failed", detail: resBody?.message ?? `Resend ${res.status}` }, 200);
    }

    if (notificationId) {
      await supabaseAdmin
        .from("internal_ticket_notifications")
        .update({
          status: "sent",
          provider_message_id: resBody?.id ?? null,
          attempt_count: 1,
          sent_at: new Date().toISOString(),
        })
        .eq("id", notificationId);
    }

    return json({ ok: true, status: "sent" }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delivery error";
    if (notificationId) {
      await supabaseAdmin
        .from("internal_ticket_notifications")
        .update({
          status: "failed",
          last_error_code: "delivery_error",
          attempt_count: 1,
          failed_at: new Date().toISOString(),
        })
        .eq("id", notificationId);
    }
    return json({ ok: true, status: "failed", detail: message }, 200);
  }
});
