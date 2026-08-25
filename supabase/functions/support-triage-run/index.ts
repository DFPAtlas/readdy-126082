import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-triage-run — requests AI ticket triage and dispatches it to the n8n
// "DFP Support — AI Ticket Triage" workflow via a signed server-side request.
//
//   * verify_jwt = true → only authenticated DFP staff can reach this.
//   * Permission gate  → support.triage.run (owner/admin/manager/agent/
//                         developer). Viewer is denied server-side.
//   * n8n config        → N8N_SUPPORT_TRIAGE_URL + N8N_SUPPORT_SHARED_SECRET
//                         (Supabase Dashboard secrets). Never exposed to client.
//   * Read-only         → AI only recommends; it never assigns or mutates the
//                         ticket. Ticket creation is never blocked by n8n.
//   * Identifiers + limited text only — no tokens, secrets or card data.
// ============================================================================

const encoder = new TextEncoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS,
    });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: canRun } = await userClient.rpc("internal_has_permission", {
    perm: "support.triage.run",
  });
  if (!canRun) {
    return json({ error: "You do not have permission to run AI triage." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  // ---- config status check (no secrets returned) ----
  if (body.action === "status") {
    const url = Deno.env.get("N8N_SUPPORT_TRIAGE_URL") ?? "";
    const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
    return json({ configured: Boolean(url && secret) }, 200);
  }

  const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : "";
  if (!UUID_RE.test(ticketId)) {
    return json({ error: "ticket_id is required and must be a valid UUID." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: ticket } = await admin
    .from("internal_support_tickets")
    .select("id, ticket_number, site_id, subject, description, category, priority, customer_user_id, customer_name, customer_email")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return json({ error: "Ticket not found" }, 404);
  }

  const t = ticket as Record<string, unknown>;
  const siteId = typeof t.site_id === "string" ? t.site_id : null;

  let siteName: string | null = null;
  if (siteId) {
    const { data: site } = await admin
      .from("internal_support_sites")
      .select("site_name")
      .eq("id", siteId)
      .maybeSingle();
    siteName = site?.site_name ?? null;
  }

  const { data: run, error: insertErr } = await admin
    .from("support_ticket_triage")
    .insert({
      ticket_id: ticketId,
      status: "queued",
      requested_by: user.id,
      model_provider: "n8n",
    })
    .select("id")
    .single();

  if (insertErr || !run) {
    return json({ error: "Failed to create triage run." }, 500);
  }
  const triageId = run.id as string;

  await admin.from("support_customer_activity").insert({
    staff_user_id: user.id,
    customer_user_id: (typeof t.customer_user_id === "string" ? t.customer_user_id : null) as string | null,
    ticket_id: ticketId,
    site_id: siteId as string | null,
    action: "ai_triage_requested",
    metadata: { triage_id: triageId },
  });

  const n8nUrl = Deno.env.get("N8N_SUPPORT_TRIAGE_URL") ?? "";
  const n8nSecret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";

  if (!n8nUrl || !n8nSecret) {
    const safe = "AI triage is not configured. Contact an administrator.";
    await admin
      .from("support_ticket_triage")
      .update({ status: "unavailable", error_message: safe, completed_at: new Date().toISOString() })
      .eq("id", triageId);
    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: (typeof t.customer_user_id === "string" ? t.customer_user_id : null) as string | null,
      ticket_id: ticketId,
      site_id: siteId as string | null,
      action: "ai_triage_failed",
      metadata: { triage_id: triageId, reason: "n8n_not_configured" },
    });
    return json({ status: "unavailable", triage_id: triageId, message: safe }, 200);
  }

  // Identifiers + limited support text only — never secrets/tokens/card data.
  const payload = {
    triage_id: triageId,
    ticket_id: ticketId,
    ticket_number: typeof t.ticket_number === "string" ? t.ticket_number : null,
    site_id: siteId,
    site_name: siteName,
    subject: typeof t.subject === "string" ? t.subject.slice(0, 500) : null,
    description: typeof t.description === "string" ? t.description.slice(0, 20000) : null,
    category: typeof t.category === "string" ? t.category : null,
    priority: typeof t.priority === "string" ? t.priority : null,
    customer_user_id: typeof t.customer_user_id === "string" ? t.customer_user_id : null,
  };
  const bodyStr = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = await hmacSha256Hex(n8nSecret, `${timestamp}.${bodyStr}`);

  try {
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dfp-timestamp": timestamp,
        "x-dfp-signature": signature,
      },
      body: bodyStr,
    });
    if (!res.ok) throw new Error(`n8n responded ${res.status}`);

    await admin
      .from("support_ticket_triage")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", triageId);

    return json({ status: "running", triage_id: triageId, message: "AI triage started." }, 200);
  } catch {
    const safe = "AI triage could not start because the n8n service is unavailable.";
    await admin
      .from("support_ticket_triage")
      .update({ status: "failed", error_message: safe, completed_at: new Date().toISOString() })
      .eq("id", triageId);
    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: (typeof t.customer_user_id === "string" ? t.customer_user_id : null) as string | null,
      ticket_id: ticketId,
      site_id: siteId as string | null,
      action: "ai_triage_failed",
      metadata: { triage_id: triageId, reason: "n8n_unavailable" },
    });
    return json({ status: "failed", triage_id: triageId, message: safe }, 200);
  }
});
