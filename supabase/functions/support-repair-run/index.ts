import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-repair-run — human-approved account repair execution.
//
//   * verify_jwt = true → only authenticated DFP staff can reach this.
//   * Permission gate  → support.repairs.approve.medium (owner/admin/manager).
//   * Segregation       → a MEDIUM-risk repair cannot be approved by the
//                         staff member who requested it.
//   * Allowlist         → only LOW / MEDIUM action types are executable.
//                         HIGH / CRITICAL are rejected ("Manual admin process").
//   * n8n config        → N8N_SUPPORT_REPAIR_URL + N8N_SUPPORT_SHARED_SECRET
//                         (Supabase Dashboard secrets). Never exposed to client.
//   * Idempotent        → re-approving a completed/executing repair is a no-op;
//                         retries dispatch again without erasing history.
//
// Flow: staff approve → backend verifies permission → mark approved → signed
//       dispatch to n8n → n8n performs + verifies → posts result to
//       support-repair-result callback.
// ============================================================================

const encoder = new TextEncoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

// Strict allowlist: only LOW and MEDIUM repairs are executable.
const EXECUTABLE_REPAIR_TYPES: Record<string, "low" | "medium"> = {
  resend_verification_email: "low",
  resend_password_reset_email: "low",
  retry_failed_email: "low",
  refresh_account_sync: "low",
  retry_failed_webhook: "low",
  rebuild_customer_mapping: "low",
  clear_safe_application_cache: "low",
  unlock_login: "medium",
  reactivate_account: "medium",
  refresh_permissions: "medium",
  refresh_subscription_status: "medium",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: CORS });
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

  const { data: canApprove } = await userClient.rpc("internal_has_permission", {
    perm: "support.repairs.approve.medium",
  });
  if (!canApprove) {
    return json({ error: "You do not have permission to approve repairs." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  // ---- config status check (no secrets returned) ----
  if (body.action === "status") {
    const url = Deno.env.get("N8N_SUPPORT_REPAIR_URL") ?? "";
    const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
    return json({ configured: Boolean(url && secret) }, 200);
  }

  const repairId = typeof body.repair_action_id === "string" ? body.repair_action_id : "";
  if (!UUID_RE.test(repairId)) {
    return json({ error: "repair_action_id is required and must be a valid UUID." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: repair } = await admin
    .from("support_repair_actions")
    .select("*")
    .eq("id", repairId)
    .maybeSingle();

  if (!repair) {
    return json({ error: "Unknown repair action" }, 404);
  }

  const r = repair as Record<string, unknown>;
  const actionType = typeof r.action_type === "string" ? r.action_type : "";
  const status = typeof r.status === "string" ? r.status : "";
  const risk = EXECUTABLE_REPAIR_TYPES[actionType];

  // HIGH / CRITICAL and unknown types are never executable.
  if (!risk) {
    return json({
      status: "blocked",
      message: "This action type requires a manual administrative process and cannot be executed here.",
    }, 200);
  }

  if (status === "rejected" || status === "cancelled") {
    return json({ status: "blocked", message: "This repair was rejected or cancelled and cannot be executed." }, 200);
  }
  if (status === "completed") {
    return json({ status: "completed", message: "This repair is already completed." }, 200);
  }
  if (status === "executing") {
    return json({ status: "executing", message: "This repair is already executing." }, 200);
  }

  const requestedBy = typeof r.requested_by === "string" ? r.requested_by : "";

  // Fresh approval path (draft / pending_approval).
  if (status === "pending_approval" || status === "draft") {
    // Segregation of duties for MEDIUM-risk actions.
    if (risk === "medium" && requestedBy === user.id) {
      return json({
        status: "blocked",
        message: "You cannot approve your own medium-risk repair. Another authorised staff member must approve it.",
      }, 403);
    }

    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: r.customer_id ?? null,
      ticket_id: r.ticket_id ?? null,
      site_id: r.site_id ?? null,
      action: "repair_reviewed",
      metadata: { repair_id: repairId, action_type: actionType, risk_level: risk },
    });

    const approvedAt = new Date().toISOString();
    await admin
      .from("support_repair_actions")
      .update({ status: "approved", approved_by: user.id, approved_at: approvedAt, error_message: null })
      .eq("id", repairId);

    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: r.customer_id ?? null,
      ticket_id: r.ticket_id ?? null,
      site_id: r.site_id ?? null,
      action: "repair_approved",
      metadata: { repair_id: repairId, action_type: actionType, risk_level: risk },
    });
  } else {
    // Retry path (approved-waiting or failed).
    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: r.customer_id ?? null,
      ticket_id: r.ticket_id ?? null,
      site_id: r.site_id ?? null,
      action: "repair_retry_requested",
      metadata: { repair_id: repairId, action_type: actionType, risk_level: risk },
    });
  }

  const n8nUrl = Deno.env.get("N8N_SUPPORT_REPAIR_URL") ?? "";
  const n8nSecret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";

  if (!n8nUrl || !n8nSecret) {
    const safe = "Repair approved, but execution is unavailable because the n8n repair service is not configured.";
    await admin
      .from("support_repair_actions")
      .update({ error_message: safe })
      .eq("id", repairId);
    return json({ status: "approved", message: safe }, 200);
  }

  // Mark executing before dispatch.
  const executedAt = new Date().toISOString();
  await admin
    .from("support_repair_actions")
    .update({ status: "executing", executed_at: executedAt, error_message: null })
    .eq("id", repairId);

  await admin.from("support_customer_activity").insert({
    staff_user_id: user.id,
    customer_user_id: r.customer_id ?? null,
    ticket_id: r.ticket_id ?? null,
    site_id: r.site_id ?? null,
    action: "repair_execution_started",
    metadata: { repair_id: repairId, action_type: actionType, risk_level: risk },
  });

  // Identifiers + validated parameters only — no tokens/passwords/unrelated data.
  const payload = {
    repair_action_id: repairId,
    ticket_id: r.ticket_id ?? null,
    customer_id: r.customer_id ?? null,
    site_id: r.site_id ?? null,
    user_id: r.user_id ?? null,
    action_type: actionType,
    approved_by: user.id,
    approved_at: r.approved_at ?? null,
    parameters: {
      expected_current_status: typeof r.current_value === "string" ? r.current_value : null,
      target_status: typeof r.proposed_value === "string" ? r.proposed_value : null,
    },
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

    return json({ status: "executing", repair_action_id: repairId, message: "Repair approved and executing." }, 200);
  } catch {
    // Preserve the approval — revert to approved (waiting) rather than losing it.
    const safe = "Repair approved, but execution could not start because the n8n repair service is unavailable.";
    await admin
      .from("support_repair_actions")
      .update({ status: "approved", error_message: safe })
      .eq("id", repairId);
    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: r.customer_id ?? null,
      ticket_id: r.ticket_id ?? null,
      site_id: r.site_id ?? null,
      action: "repair_execution_failed",
      metadata: { repair_id: repairId, reason: "n8n_unavailable" },
    });
    return json({ status: "approved", repair_action_id: repairId, message: safe }, 200);
  }
});
