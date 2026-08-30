import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-failure-governance — Phase 3 Prompt 23 + Prompt 23A + Prompt 23C.
// Deterministic runtime failure / timeout / recovery governance for the
// Prompt 18–22 sandbox diagnostic runtime lifecycle.
//
// Operations:
//   finalize_timed_out_diagnostic_run  — owner/admin only
//   get_runtime_failure_status         — any internal role (read-only)
//
// Prompt 23A changes:
//   * ATOMIC TERMINAL CLAIM — the finaliser conditionally transitions the run
//     (WHERE status IN queued/working/waiting) BEFORE any side effect, so a
//     valid result that wins the race can never be overwritten (completed →
//     failed is impossible).
//   * BRIDGE-UNREACHABLE — a timeout whose expected node heartbeat is stale is
//     attributed to runtime_bridge_unreachable and audited as such.
//   * INCIDENT IDEMPOTENCY — one incident per correlation_id.
//
// Prompt 23C changes:
//   * INCIDENT STATUS — new runtime diagnostic failure incidents use
//     status = "new" (valid) instead of "open" (invalid CHECK).
//   * INCIDENT PRIORITY — priority = "normal" instead of "medium" (invalid).
//   * INSERT ERROR HANDLING — a failed ai_incidents insert is captured and
//     audited (runtime_failure_incident_create_failed, severity medium); the
//     already-failed run lifecycle is never resurrected or retried.
//
// SECURITY: verify_jwt = true -> only authenticated internal staff reach this.
//   * finalize_* is owner/admin only.
//   * get_runtime_failure_status is read-only for any internal role.
//
// The finaliser NEVER dispatches anything. It only reads persisted state and
// deterministically closes a run that has no valid signed result after its
// fixed 2-minute wait window. max_attempts stays 1, retry_count stays 0, and
// there is never a second outbound HAL message.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fixed 2-minute runtime wait window — aligns with the bridge probe TTL.
// The browser can NEVER supply a timeout; this is a server constant.
const RUNTIME_WAIT_WINDOW_MS = 2 * 60_000;

const DIAGNOSTIC_RUN_KEY_PREFIX = "dfp-diagnostic-run-";
const APPROVAL_GATED_RUN_KEY_PREFIX = "dfp-approval-run-";
const DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE = "diagnostic_run_tool_probe";
const DIAGNOSTIC_RUN_RESULT_MESSAGE_TYPE = "diagnostic_run_tool_probe_result";
const APPROVAL_GATED_QUEUE_MESSAGE_TYPE = "approval_gated_diagnostic_probe";
const APPROVAL_GATED_RESULT_MESSAGE_TYPE = "approval_gated_diagnostic_probe_result";

const RUNTIME_FAILURE_CATEGORIES = new Set([
  "runtime_result_timeout",
  "runtime_message_expired",
  "runtime_tool_timeout",
  "runtime_result_failed",
  "runtime_bridge_unreachable",
  "runtime_result_invalid",
  "runtime_duplicate_result",
  "runtime_terminal_state",
]);

// Only these failure categories warrant an AI Operations incident. Governance
// denials (rejection, revocation, context drift, self-approval, viewer denial)
// are decisions, not runtime incidents, and must never create one.
const RUNTIME_INCIDENT_CATEGORIES = new Set([
  "runtime_result_timeout",
  "runtime_tool_timeout",
  "runtime_bridge_unreachable",
  "runtime_result_failed",
]);

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);
const NON_TERMINAL_RUNTIME_STATUSES = new Set(["queued", "working", "waiting"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function auditEvent(
  admin: ReturnType<typeof createClient>,
  eventType: string,
  outcome: string,
  severity: string,
  actor: string,
  notes: string,
  correlationId: string | null = null,
  runId: string | null = null,
) {
  await admin.from("ai_audit_events").insert({
    audit_key: uid("RFG"),
    occurred_at: new Date().toISOString(),
    event_type: eventType,
    action: "runtime_failure_governance",
    outcome,
    severity,
    actor_type: "human",
    actor_reference: actor,
    trigger_source: "manual",
    environment: "production",
    correlation_id: correlationId,
    run_id: runId,
    notes,
  });
}

async function createRuntimeFailureIncident(
  admin: ReturnType<typeof createClient>,
  e: {
    failureCategory: string;
    runKey: string;
    taskKey: string;
    correlationId: string | null;
    nodeKey: string | null;
    failedStep: string | null;
    actor: string;
  },
): Promise<string | null> {
  if (!RUNTIME_INCIDENT_CATEGORIES.has(e.failureCategory)) return null;

  // Prompt 23A — incident idempotency: one runtime diagnostic failure incident
  // per correlation_id. Reuse, never duplicate.
  if (e.correlationId) {
    const { data: existingInc } = await admin
      .from("ai_incidents")
      .select("incident_key")
      .eq("correlation_id", e.correlationId)
      .eq("incident_type", "runtime_diagnostic_failure")
      .order("created_at", { ascending: true })
      .limit(1);
    if (existingInc && existingInc.length > 0) {
      return str(existingInc[0].incident_key) || null;
    }
  }

  const nowIso = new Date().toISOString();
  const incidentKey = uid("INC");
  const title = `Runtime Diagnostic Failure — ${e.failureCategory}`;
  const summary =
    `Diagnostic run ${e.runKey || "n/a"} failed with category ${e.failureCategory}` +
    (e.failedStep ? ` at step ${e.failedStep}` : "") +
    `. Sandbox diagnostic only — no production execution, no retry.`;

  const ins = await admin.from("ai_incidents").insert({
    incident_key: incidentKey,
    title,
    summary,
    site_id: null,
    severity: "low",
    priority: "normal",
    status: "new",
    incident_type: "runtime_diagnostic_failure",
    environment: "sandbox",
    lead_team: "Group AI Operations",
    owner_reference: null,
    correlation_id: e.correlationId,
    impact_summary: "None — sandbox diagnostic. No business data, no mutation, no production execution.",
    diagnostics_summary:
      `run=${e.runKey || "n/a"} · task=${e.taskKey || "n/a"} · node=${e.nodeKey || "n/a"} · ` +
      `step=${e.failedStep || "n/a"} · category=${e.failureCategory}`,
    suspected_cause: null,
    confirmed_cause: null,
    response_plan: null,
    resolution_summary: null,
    prevention_summary: null,
    known_issue_memory_key: null,
    approval_required: false,
    security_review_required: false,
    uat_required: false,
    started_at: nowIso,
    acknowledged_at: null,
    resolved_at: null,
    closed_at: null,
    is_active: true,
    notes: JSON.stringify({
      run_key: e.runKey,
      task_key: e.taskKey,
      node_key: e.nodeKey,
      failure_category: e.failureCategory,
      failed_step: e.failedStep,
    }),
    created_at: nowIso,
    updated_at: nowIso,
  }).select("id");

  const insError = ins.error;
  const incidentId = ins.data && ins.data.length > 0 ? (ins.data[0].id as string) : null;
  if (!incidentId) {
    const dbCode = insError && insError.code ? String(insError.code).slice(0, 80) : "unknown";
    await auditEvent(admin, "runtime_failure_incident_create_failed", "failed", "medium", e.actor,
      `Runtime failure incident creation failed for run ${e.runKey || "n/a"} (category=${e.failureCategory}, db_code=${dbCode}). No retry; run lifecycle unchanged.`,
      e.correlationId);
    return null;
  }

  await admin.from("ai_incident_timeline").insert({
    incident_id: incidentId,
    event_type: "runtime_dispatched",
    previous_status: null,
    new_status: "new",
    actor_reference: e.actor,
    actor_role: "system",
    summary: `Runtime diagnostic failure incident opened for run ${e.runKey || "n/a"} (${e.failureCategory}).`,
    created_at: nowIso,
  });

  const timelineEventType =
    e.failureCategory === "runtime_bridge_unreachable"
      ? "bridge_unreachable"
      : e.failureCategory === "runtime_result_failed"
        ? "runtime_result_failed"
        : "runtime_timeout";

  await admin.from("ai_incident_timeline").insert({
    incident_id: incidentId,
    event_type: timelineEventType,
    previous_status: "new",
    new_status: "new",
    actor_reference: e.actor,
    actor_role: "system",
    summary: `Failure category ${e.failureCategory} recorded for run ${e.runKey || "n/a"}. No retry, no duplicate execution.`,
    created_at: nowIso,
  });

  await auditEvent(admin, "runtime_failure_incident_created", "created", "low", e.actor,
    `Runtime diagnostic failure incident ${incidentKey} created for run ${e.runKey || "n/a"} (category=${e.failureCategory}). No retry, no duplicate execution.`,
    e.correlationId);

  return incidentKey;
}

async function resolveNode(
  admin: ReturnType<typeof createClient>,
  nodeKeyParam: string,
): Promise<Record<string, unknown> | null> {
  if (!nodeKeyParam) return null;
  const { data } = await admin
    .from("ai_runtime_bridge_nodes")
    .select("node_key, status, last_heartbeat_at, last_seen_at")
    .eq("node_key", nodeKeyParam)
    .limit(1);
  const node = data && data.length > 0 ? data[0] : null;
  if (!node) return null;
  const lastBeat = node.last_heartbeat_at ?? node.last_seen_at;
  if (!lastBeat) return null;
  const age = Date.now() - new Date(lastBeat as string).getTime();
  if (!Number.isFinite(age) || age > 2 * 60_000) return null;
  return node;
}

async function finalizeTimedOutDiagnosticRun(
  admin: ReturnType<typeof createClient>,
  actor: string,
  role: string,
  runKeyParam: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const runKey = runKeyParam;
  if (!runKey) {
    return { status: 400, body: { error: "run_key is required.", detail: "run_key_missing" } };
  }

  const { data: runRows } = await admin
    .from("ai_runs")
    .select("id, run_key, task_id, approval_id, status, correlation_id, started_at")
    .eq("run_key", runKey)
    .limit(1);
  const run = runRows && runRows.length > 0 ? runRows[0] : null;
  if (!run) {
    return { status: 404, body: { error: "Run not found.", detail: "run_not_found" } };
  }

  const runStatus = str(run.status);
  if (TERMINAL_RUN_STATUSES.has(runStatus)) {
    return { status: 409, body: { error: "Run is already in a terminal state.", detail: "run_terminal" } };
  }
  if (!NON_TERMINAL_RUNTIME_STATUSES.has(runStatus)) {
    return { status: 409, body: { error: "Run is not in a dispatchable runtime state.", detail: "run_not_runtime_state" } };
  }

  const corr = str(run.correlation_id);
  if (!corr) {
    return { status: 409, body: { error: "Run has no correlation ID.", detail: "correlation_missing" } };
  }

  // Exactly one outbound diagnostic HAL message is required.
  const { data: outboundRows } = await admin
    .from("ai_runtime_bridge_messages")
    .select("message_key, status, safe_payload, created_at")
    .eq("direction", "outbound")
    .in("message_type", [DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE, APPROVAL_GATED_QUEUE_MESSAGE_TYPE])
    .eq("correlation_id", corr)
    .order("created_at", { ascending: true });
  if (!outboundRows || outboundRows.length === 0) {
    return { status: 409, body: { error: "No outbound diagnostic HAL message exists for this run.", detail: "no_outbound_message" } };
  }
  if (outboundRows.length > 1) {
    return { status: 409, body: { error: "More than one outbound diagnostic HAL message exists for this run.", detail: "multiple_outbound_messages" } };
  }
  const outbound = outboundRows[0];

  // No valid terminal inbound signed result may exist.
  const { data: inboundRows } = await admin
    .from("ai_runtime_bridge_messages")
    .select("message_key, safe_payload")
    .eq("direction", "inbound")
    .in("message_type", [DIAGNOSTIC_RUN_RESULT_MESSAGE_TYPE, APPROVAL_GATED_RESULT_MESSAGE_TYPE])
    .eq("correlation_id", corr)
    .order("created_at", { ascending: false });
  const hasValidResult = (inboundRows ?? []).some((r) => {
    const p = (r.safe_payload as Record<string, unknown>) ?? {};
    return p.verified === true;
  });
  if (hasValidResult) {
    return { status: 409, body: { error: "A valid signed result already exists for this run.", detail: "result_already_received" } };
  }

  // Timeout eligibility: outbound TTL expired OR fixed wait window exceeded.
  const outboundPayload = (outbound.safe_payload as Record<string, unknown>) ?? {};
  const expiresAt = str(outboundPayload.expires_at);
  const createdAt = str(outbound.created_at) || str(outboundPayload.requested_at);
  const nowMs = Date.now();
  const ttlExpired = expiresAt ? nowMs > new Date(expiresAt).getTime() : false;
  const windowExceeded = createdAt ? nowMs - new Date(createdAt).getTime() > RUNTIME_WAIT_WINDOW_MS : false;

  if (!ttlExpired && !windowExceeded) {
    return {
      status: 409,
      body: {
        error: "The run is still within its runtime wait window.",
        detail: "runtime_still_within_wait_window",
        stillWaiting: true,
      },
    };
  }

  const nodeKey = str(outboundPayload.expected_node_key);
  const nodeReachable = nodeKey ? !!(await resolveNode(admin, nodeKey)) : true;

  // Prompt 23A — resolve the best deterministic failure category. If the
  // outbound probe timed out AND the expected bridge node heartbeat is
  // stale/unreachable, attribute the failure to the unreachable bridge rather
  // than a bare timeout.
  const bridgeUnreachable = !!nodeKey && !nodeReachable;
  const failureCategory = bridgeUnreachable ? "runtime_bridge_unreachable" : "runtime_result_timeout";

  const failedAt = new Date().toISOString();
  const isApprovalGated = str(run.run_key).startsWith(APPROVAL_GATED_RUN_KEY_PREFIX);
  const verifyStepNumber = isApprovalGated ? 6 : 5;

  // =========================================================================
  // ATOMIC TERMINAL CLAIM — obtain terminal ownership BEFORE any side effect.
  // The conditional update guarantees completed → failed is impossible even
  // under a timeout/result race. If zero rows change, a valid result (or
  // another terminal transition) won and we must never overwrite it.
  // =========================================================================
  const claim = await admin
    .from("ai_runs")
    .update({
      status: "failed",
      error_summary: failureCategory,
      completed_at: failedAt,
      updated_at: failedAt,
    })
    .eq("id", run.id)
    .in("status", ["queued", "working", "waiting"])
    .select("id, status");

  const claimed = claim.data && claim.data.length === 1;
  if (!claimed) {
    // The race was lost — a competing terminal transition already closed the
    // run. Re-read and return a safe terminal-state result. Never overwrite.
    const { data: reRows } = await admin
      .from("ai_runs")
      .select("id, status")
      .eq("id", run.id)
      .limit(1);
    const re = reRows && reRows.length > 0 ? reRows[0] : null;
    const reStatus = re ? str(re.status) : "unknown";
    return {
      status: 409,
      body: {
        error: reStatus === "completed"
          ? "A valid result completed the run before timeout finalisation."
          : "Run already reached a terminal state; timeout finalisation skipped.",
        detail: "runtime_terminal_state",
        runStatus: reStatus,
        halDispatch: "BLOCKED",
        executionEnabled: false,
      },
    };
  }

  // Terminal ownership obtained — perform side effects in deterministic order.

  // Mark the outbound message expired (preserve it — never delete or replace).
  if (str(outbound.status) === "pending" || str(outbound.status) === "delivered") {
    await admin.from("ai_runtime_bridge_messages")
      .update({ status: "expired" })
      .eq("message_key", str(outbound.message_key));
  }

  // Fail the verification step + any remaining unfinished close steps.
  await admin.from("ai_run_steps")
    .update({ status: "failed", error_summary: failureCategory, completed_at: failedAt })
    .eq("run_id", run.id)
    .eq("step_number", verifyStepNumber);
  await admin.from("ai_run_steps")
    .update({ status: "failed", error_summary: failureCategory, completed_at: failedAt })
    .eq("run_id", run.id)
    .in("status", ["pending", "working"]);

  // (ai_runs already transitioned via the atomic claim — no second update.)

  let taskKey = "";
  if (run.task_id) {
    const { data: taskRows } = await admin
      .from("ai_tasks").select("task_key").eq("id", run.task_id).limit(1);
    taskKey = taskRows && taskRows.length > 0 ? str(taskRows[0].task_key) : "";
    await admin.from("ai_tasks").update({ status: "failed", updated_at: failedAt }).eq("id", run.task_id);
  }

  // Approval-gated: preserve authorization history and consume the approval
  // (one runtime attempt WAS dispatched). Never revert to pending, never reuse.
  if (isApprovalGated) {
    const approvalId = run.approval_id;
    const appQuery = approvalId
      ? admin.from("ai_approvals").select("id, status, decision, decision_actor, decision_at").eq("id", approvalId).limit(1)
      : admin.from("ai_approvals").select("id, status, decision, decision_actor, decision_at").eq("run_id", run.id).limit(1);
    const { data: appRows } = await appQuery;
    const approval = appRows && appRows.length > 0 ? appRows[0] : null;
    if (approval) {
      await admin.from("ai_approvals").update({ status: "completed", updated_at: failedAt }).eq("id", approval.id);
      await admin.from("ai_approval_history").insert({
        approval_id: approval.id,
        event_type: "consumed",
        previous_status: str(approval.status),
        new_status: "completed",
        decision: null,
        actor_reference: actor,
        actor_role: role,
        reason: "Authorized single runtime attempt was dispatched and timed out. Approval consumed — not reusable.",
        conditions: null,
        approval_count_before: 1,
        approval_count_after: 1,
        created_at: failedAt,
      });
    }
  }

  let failedStepName: string | null = null;
  const { data: stepRows } = await admin
    .from("ai_run_steps").select("name").eq("run_id", run.id).eq("step_number", verifyStepNumber).limit(1);
  failedStepName = stepRows && stepRows.length > 0 ? str(stepRows[0].name) : null;

  if (bridgeUnreachable) {
    await auditEvent(admin, "runtime_bridge_unreachable", "failed", "medium", actor,
      `Runtime bridge node ${nodeKey} was unreachable (stale heartbeat) when diagnostic run ${runKey} timed out. No retry, no duplicate HAL dispatch.`,
      corr, run.id);
  }

  await auditEvent(admin, "runtime_timeout_detected", "failed", "medium", actor,
    `Runtime diagnostic run ${runKey} exceeded its fixed wait window with no valid signed result. No retry, no duplicate HAL dispatch.`,
    corr, run.id);
  await auditEvent(admin, "runtime_timeout_finalized", "failed", "medium", actor,
    `Runtime diagnostic run ${runKey} finalized as failed (category=${failureCategory}, step=${failedStepName ?? "n/a"}). Task failed. No retry, no duplicate execution.`,
    corr, run.id);

  const incidentKey = await createRuntimeFailureIncident(admin, {
    failureCategory,
    runKey,
    taskKey,
    correlationId: corr,
    nodeKey,
    failedStep: failedStepName,
    actor,
  });

  return {
    status: 200,
    body: {
      accepted: true,
      operation: "finalize_timed_out_diagnostic_run",
      runKey,
      taskKey,
      correlationId: corr,
      failureCategory,
      failedStep: failedStepName,
      runStatus: "failed",
      taskStatus: "failed",
      outboundMessageStatus: "expired",
      retryCount: 0,
      maxAttempts: 1,
      incidentKey,
      halDispatch: "BLOCKED",
      executionEnabled: false,
      message: "Timed-out diagnostic run finalized as failed. No retry, no duplicate HAL dispatch.",
    },
  };
}

async function getRuntimeFailureStatus(
  admin: ReturnType<typeof createClient>,
  runKeyParam: string,
): Promise<Record<string, unknown>> {
  let run: Record<string, unknown> | null = null;
  if (runKeyParam) {
    const { data } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id, started_at, completed_at, error_summary")
      .eq("run_key", runKeyParam)
      .limit(1);
    run = data && data.length > 0 ? data[0] : null;
  } else {
    const { data } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id, started_at, completed_at, error_summary")
      .order("created_at", { ascending: false })
      .limit(50);
    const candidates = (data ?? []).filter((r) =>
      str(r.run_key).startsWith(DIAGNOSTIC_RUN_KEY_PREFIX) ||
      str(r.run_key).startsWith(APPROVAL_GATED_RUN_KEY_PREFIX),
    );
    run = candidates.length > 0 ? candidates[0] : null;
  }

  if (!run) {
    return {
      operation: "get_runtime_failure_status",
      found: false,
      runKey: runKeyParam || null,
      retryCount: 0,
      maxAttempts: 1,
      executionEnabled: false,
    };
  }

  const corr = str(run.correlation_id);

  let taskKey: string | null = null;
  let taskStatus: string | null = null;
  if (run.task_id) {
    const { data: taskRows } = await admin.from("ai_tasks").select("task_key, status").eq("id", run.task_id).limit(1);
    if (taskRows && taskRows.length > 0) {
      taskKey = str(taskRows[0].task_key);
      taskStatus = str(taskRows[0].status);
    }
  }

  let outboundMessageStatus: string | null = null;
  let nodeKey: string | null = null;
  if (corr) {
    const { data: outRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("status, safe_payload")
      .eq("direction", "outbound")
      .in("message_type", [DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE, APPROVAL_GATED_QUEUE_MESSAGE_TYPE])
      .eq("correlation_id", corr)
      .order("created_at", { ascending: false })
      .limit(1);
    const out = outRows && outRows.length > 0 ? outRows[0] : null;
    outboundMessageStatus = out ? str(out.status) : null;
    nodeKey = out ? str((out.safe_payload as Record<string, unknown> | null)?.expected_node_key) : null;
  }

  let resultReceived = false;
  let resultVerified = false;
  if (corr) {
    const { data: inRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("status, safe_payload")
      .eq("direction", "inbound")
      .in("message_type", [DIAGNOSTIC_RUN_RESULT_MESSAGE_TYPE, APPROVAL_GATED_RESULT_MESSAGE_TYPE])
      .eq("correlation_id", corr)
      .order("created_at", { ascending: false })
      .limit(1);
    const inMsg = inRows && inRows.length > 0 ? inRows[0] : null;
    resultReceived = !!inMsg;
    resultVerified = inMsg ? ((inMsg.safe_payload as Record<string, unknown> | null)?.verified === true) : false;
  }

  let lateResultReceived = false;
  let duplicateResultBlocked = false;
  if (corr) {
    const { data: lateRows } = await admin.from("ai_audit_events").select("audit_key")
      .eq("correlation_id", corr).eq("event_type", "runtime_late_result_received").limit(1);
    lateResultReceived = !!(lateRows && lateRows.length > 0);
    const { data: dupRows } = await admin.from("ai_audit_events").select("audit_key")
      .eq("correlation_id", corr).eq("event_type", "runtime_duplicate_result_blocked").limit(1);
    duplicateResultBlocked = !!(dupRows && dupRows.length > 0);
  }

  let incidentKey: string | null = null;
  let incidentStatus: string | null = null;
  if (corr) {
    const { data: incRows } = await admin.from("ai_incidents").select("incident_key, status")
      .eq("correlation_id", corr).order("created_at", { ascending: false }).limit(1);
    if (incRows && incRows.length > 0) {
      incidentKey = str(incRows[0].incident_key);
      incidentStatus = str(incRows[0].status);
    }
  }

  let failedStep: string | null = null;
  const { data: fStepRows } = await admin.from("ai_run_steps").select("name")
    .eq("run_id", run.id).eq("status", "failed").order("step_number", { ascending: true }).limit(1);
  failedStep = fStepRows && fStepRows.length > 0 ? str(fStepRows[0].name) : null;

  const bridgeReachable = nodeKey ? !!(await resolveNode(admin, nodeKey)) : null;

  const errorSummary = str(run.error_summary);
  const timedOut = errorSummary === "runtime_result_timeout" || outboundMessageStatus === "expired";
  const failureCategory = RUNTIME_FAILURE_CATEGORIES.has(errorSummary)
    ? errorSummary
    : (timedOut ? "runtime_result_timeout" : null);

  return {
    operation: "get_runtime_failure_status",
    found: true,
    runKey: str(run.run_key),
    taskKey,
    correlationId: corr || null,
    runStatus: str(run.status),
    taskStatus,
    failureCategory,
    failedStep,
    outboundMessageStatus,
    resultReceived,
    resultVerified,
    lateResultReceived,
    duplicateResultBlocked,
    bridgeReachable,
    timedOut,
    incidentKey,
    incidentStatus,
    retryCount: 0,
    maxAttempts: 1,
    executionEnabled: false,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: role } = await userClient.rpc("internal_role");
  if (!role) return json({ error: "Internal staff access required." }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const operation = str(body.operation);
  const actor = user.email ?? user.id;
  const isPrivileged = role === "owner" || role === "admin";

  if (operation === "finalize_timed_out_diagnostic_run") {
    if (!isPrivileged) {
      return json({ error: "Owner or admin role required to finalize a timed-out diagnostic run." }, 403);
    }
    const res = await finalizeTimedOutDiagnosticRun(admin, actor, role, str(body.run_key));
    return json(res.body, res.status);
  }

  if (operation === "get_runtime_failure_status") {
    const res = await getRuntimeFailureStatus(admin, str(body.run_key));
    return json(res, 200);
  }

  return json({ error: "Unknown or disallowed operation." }, 422);
});
