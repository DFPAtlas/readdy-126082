import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-dfp-scheduler-token",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function secretsMatch(expected: string, provided: string): Promise<boolean> {
  if (!expected || !provided) return false;
  const encoder = new TextEncoder();
  const [expectedHash, providedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
  ]);
  const a = new Uint8Array(expectedHash);
  const b = new Uint8Array(providedHash);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Vault-backed scheduler token is used by the database trigger. Retain the
  // legacy ticket secret only for a controlled migration window.
  const schedulerExpected = (
    Deno.env.get("DFP_SCHEDULER_SECRET") ?? Deno.env.get("dfp_scheduler_secret") ?? ""
  ).trim();
  const schedulerProvided = (req.headers.get("x-dfp-scheduler-token") ?? "").trim();
  const legacyExpected = (Deno.env.get("TICKET_WEBHOOK_SECRET") ?? "").trim();
  const legacyProvided = (req.headers.get("x-webhook-secret") ?? "").trim();
  const authorised =
    await secretsMatch(schedulerExpected, schedulerProvided) ||
    await secretsMatch(legacyExpected, legacyProvided);
  if (!authorised) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const record = body?.record ?? body;
    if (!record?.id || !record?.ticket_title) {
      return json({ error: "Missing ticket payload" }, 400);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    if (!resendKey || !resendDomain) {
      return json({ error: "Resend not configured (missing RESEND_API_KEY or RESEND_FROM_DOMAIN)" }, 500);
    }

    const from = `Footprint Command Centre <noreply@${resendDomain}>`;
    const title = escapeHtml(record.ticket_title ?? "No subject");
    const name = escapeHtml(record.submitted_by ?? "Unknown");
    const email = escapeHtml(record.submitted_email ?? "No email");
    const priority = escapeHtml(record.priority ?? "Medium");
    const description = escapeHtml((record.ticket_description ?? "").slice(0, 2000));
    const ref = (record.id ?? "").toString().slice(0, 8).toUpperCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Resolve recipients: owner + admins.
    const { data: roleRows } = await supabaseAdmin
      .from("internal_user_roles")
      .select("user_id")
      .in("role", ["owner", "admin"]);

    const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
    const recipients: string[] = [];
    for (const uid of userIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      const mail = u?.user?.email;
      if (mail) recipients.push(mail);
    }

    if (recipients.length === 0) {
      return json({ error: "No recipient found" }, 500);
    }

    const subject = `New support ticket ${ref}: ${title}`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#1a1a1a;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;">New support ticket</p>
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;">${title}</h1>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <tr>
            <td style="padding:8px 0;color:#888;width:110px;">From</td>
            <td style="padding:8px 0;">${name} &lt;${email}&gt;</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#888;">Priority</td>
            <td style="padding:8px 0;">${priority}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#888;">Ref</td>
            <td style="padding:8px 0;">${ref}</td>
          </tr>
        </table>

        <div style="background:#f5f5f5;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${description || "No message body."}</div>

        <p style="margin:24px 0 0;font-size:13px;color:#888;">Reply directly to ${email} to get back to the customer. You can also manage this ticket in your Command Centre.</p>
      </div>
    `;

    // 1) Notify the team (owner + admins).
    const teamRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });

    if (!teamRes.ok) {
      const text = await teamRes.text();
      return json({ error: `Resend error ${teamRes.status}: ${text}` }, 500);
    }

    // 2) Auto-reply confirmation to the customer.
    let customerSent = false;
    const customerEmail = (record.submitted_email ?? "").toString().trim();
    if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      const customerSubject = `We received your request (${ref})`;
      const customerHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#1a1a1a;">
          <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;">Request received</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Thanks, ${name} — we're on it.</h1>

          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#333;">We've received your message and our team will get back to you shortly. Here's a summary of what you sent us:</p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
            <tr>
              <td style="padding:8px 0;color:#888;width:110px;">Ref</td>
              <td style="padding:8px 0;">${ref}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;">Subject</td>
              <td style="padding:8px 0;">${title}</td>
            </tr>
          </table>

          <div style="background:#f5f5f5;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${description || "No message body."}</div>

          <p style="margin:24px 0 0;font-size:13px;color:#888;">If you need to add anything, just reply to this email with your ref number ${ref}.</p>
        </div>
      `;

      const customerRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [customerEmail], subject: customerSubject, html: customerHtml }),
      });

      customerSent = customerRes.ok;
    }

    return json({ ok: true, recipients, customerSent, customerEmail: customerEmail || null }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ error: message }, 500);
  }
});
