import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// notify-support-staff — worker that sends queued staff notifications.
//
// Processes queued internal_ticket_notifications records (new_ticket,
// customer_reply, assignment, urgent_ticket, overdue, daily_summary), applies
// each recipient's preferences, sends via Resend, and records the outcome.
// Bounded retry: transient provider failures stay queued (up to 3 attempts);
// permanent failures are marked failed.
//
// Gated by an admin secret so it can be invoked by pg_cron or manually.
//
// Secrets: TICKET_ADMIN_SECRET, RESEND_API_KEY, RESEND_FROM_DOMAIN
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 3;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type NotifType = "new_ticket" | "customer_reply" | "assignment" | "urgent_ticket" | "overdue" | "daily_summary";

interface NotificationRow {
  id: string;
  ticket_id: string | null;
  recipient_user_id: string | null;
  recipient_email: string;
  notification_type: NotifType;
  attempt_count: number;
}

interface PrefRow {
  notify_new_ticket: boolean;
  notify_customer_reply: boolean;
  notify_assignment: boolean;
  notify_overdue: boolean;
  notify_urgent: boolean;
  daily_summary: boolean;
}

function enabledForType(pref: PrefRow | null, role: string | null, type: NotifType): boolean {
  switch (type) {
    case "new_ticket":
      return pref ? pref.notify_new_ticket : role === "owner" || role === "admin";
    case "urgent_ticket":
      return pref ? pref.notify_urgent : role === "owner" || role === "admin";
    case "customer_reply":
      return pref ? pref.notify_customer_reply : true;
    case "assignment":
      return pref ? pref.notify_assignment : true;
    case "overdue":
      return pref ? pref.notify_overdue : false;
    case "daily_summary":
      return pref ? pref.daily_summary : false;
    default:
      return false;
  }
}

function subjectFor(type: NotifType, number: string): string {
  switch (type) {
    case "new_ticket": return `[${number}] New support ticket`;
    case "urgent_ticket": return `[${number}] URGENT: New support ticket`;
    case "customer_reply": return `[${number}] Customer replied`;
    case "assignment": return `[${number}] Ticket assigned to you`;
    case "overdue": return `[${number}] Ticket overdue`;
    case "daily_summary": return `[${number}] Daily support summary`;
    default: return `[${number}] Support notification`;
  }
}

function introFor(type: NotifType): string {
  switch (type) {
    case "new_ticket": return "A new support ticket was received.";
    case "urgent_ticket": return "A new urgent support ticket was received.";
    case "customer_reply": return "A customer replied to a ticket.";
    case "assignment": return "A ticket was assigned to you.";
    case "overdue": return "A ticket is now overdue.";
    case "daily_summary": return "Here is your daily support summary.";
    default: return "You have a new support notification.";
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expected = Deno.env.get("TICKET_ADMIN_SECRET") ?? "";
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!expected || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendDomain = Deno.env.get("RESEND_FROM_DOMAIN");
  if (!resendKey || !resendDomain) {
    return json({ ok: true, status: "not_configured" }, 200);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: queued, error: qErr } = await supabaseAdmin
    .from("internal_ticket_notifications")
    .select("id, ticket_id, recipient_user_id, recipient_email, notification_type, attempt_count")
    .eq("status", "queued")
    .in("notification_type", ["new_ticket", "customer_reply", "assignment", "urgent_ticket", "overdue", "daily_summary"])
    .order("created_at", { ascending: true })
    .limit(50);

  if (qErr || !queued) {
    return json({ error: "Failed to load queue" }, 500);
  }

  const rows = queued as NotificationRow[];

  // Pre-load tickets for the batch to avoid N+1.
  const ticketIds = [...new Set(rows.map((r) => r.ticket_id).filter(Boolean))] as string[];
  const ticketsById: Record<string, { ticket_number: string; subject: string }> = {};
  if (ticketIds.length > 0) {
    const { data: tickets } = await supabaseAdmin
      .from("internal_support_tickets")
      .select("id, ticket_number, subject")
      .in("id", ticketIds);
    for (const t of tickets ?? []) {
      ticketsById[t.id] = t;
    }
  }

  const from = `FootprintCC Support <noreply@${resendDomain}>`;
  let sent = 0;
  let cancelled = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const ticket = row.ticket_id ? ticketsById[row.ticket_id] : null;
    const number = ticket?.ticket_number ?? "N/A";
    const ticketSubject = ticket?.subject ?? "";

    // Resolve preference + role.
    let pref: PrefRow | null = null;
    let role: string | null = null;
    if (row.recipient_user_id) {
      const { data: prefRow } = await supabaseAdmin
        .from("internal_ticket_notification_preferences")
        .select("notify_new_ticket, notify_customer_reply, notify_assignment, notify_overdue, notify_urgent, daily_summary")
        .eq("user_id", row.recipient_user_id)
        .maybeSingle();
      pref = prefRow as PrefRow | null;

      const { data: roleRow } = await supabaseAdmin
        .from("internal_user_roles")
        .select("role")
        .eq("user_id", row.recipient_user_id)
        .maybeSingle();
      role = roleRow?.role ?? null;
    }

    if (!enabledForType(pref, role, row.notification_type)) {
      await supabaseAdmin
        .from("internal_ticket_notifications")
        .update({ status: "cancelled" })
        .eq("id", row.id);
      cancelled++;
      continue;
    }

    const subject = subjectFor(row.notification_type, number);
    const intro = escapeHtml(introFor(row.notification_type));
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#1a1a1a;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;">FootprintCC Support</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${intro}</h1>
        <p style="margin:0 0 8px;font-size:14px;color:#333;">Ticket <strong>${escapeHtml(number)}</strong></p>
        ${ticketSubject ? `<p style="margin:0;font-size:14px;color:#555;">${escapeHtml(ticketSubject)}</p>` : ""}
        <p style="margin:24px 0 0;font-size:13px;color:#888;">Open the Command Centre to review this ticket.</p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [row.recipient_email], subject, html }),
      });

      if (res.ok) {
        let providerId: string | null = null;
        try {
          const b = (await res.json()) as { id?: string };
          providerId = b.id ?? null;
        } catch {
          providerId = null;
        }
        await supabaseAdmin
          .from("internal_ticket_notifications")
          .update({
            status: "sent",
            provider: "resend",
            provider_message_id: providerId,
            attempt_count: row.attempt_count + 1,
            sent_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        sent++;
      } else {
        const attempts = row.attempt_count + 1;
        if (res.status >= 500 && attempts < MAX_ATTEMPTS) {
          await supabaseAdmin
            .from("internal_ticket_notifications")
            .update({ attempt_count: attempts, last_error_code: `resend_${res.status}` })
            .eq("id", row.id);
          skipped++;
        } else {
          await supabaseAdmin
            .from("internal_ticket_notifications")
            .update({
              status: "failed",
              attempt_count: attempts,
              last_error_code: `resend_${res.status}`,
              failed_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          failed++;
        }
      }
    } catch {
      const attempts = row.attempt_count + 1;
      if (attempts < MAX_ATTEMPTS) {
        await supabaseAdmin
          .from("internal_ticket_notifications")
          .update({ attempt_count: attempts, last_error_code: "delivery_error" })
          .eq("id", row.id);
        skipped++;
      } else {
        await supabaseAdmin
          .from("internal_ticket_notifications")
          .update({ status: "failed", attempt_count: attempts, last_error_code: "delivery_error", failed_at: new Date().toISOString() })
          .eq("id", row.id);
        failed++;
      }
    }
  }

  return json({ ok: true, sent, cancelled, failed, skipped }, 200);
});
