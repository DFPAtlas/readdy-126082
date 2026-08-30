import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROBE_TTL_MS = 2 * 60_000;
const HEARTBEAT_FRESH_MS = 2 * 60_000;

const ALLOWED_OPERATIONS = new Set([
  "queue_transport_probe",
  "get_transport_probe_status",
  "queue_ollama_inference_probe",
  "get_ollama_inference_probe_status",
  "queue_n8n_sandbox_probe",
  "get_n8n_sandbox_probe_status",
  "queue_runtime_chain_probe",
  "get_runtime_chain_probe_status",
  "queue_agent_dry_run_probe",
  "get_agent_dry_run_probe_status",
  "run_tool_access_denial_probe",
  "get_tool_access_denial_probe_status",
  "run_tool_access_grant_probe",
  "get_tool_access_grant_probe_status",
  "queue_readonly_tool_probe",
  "get_readonly_tool_probe_status",
  "queue_diagnostic_run",
  "get_diagnostic_run_status",
  "create_approval_gated_run",
  "get_approval_gated_run_status",
  "approve_approval_gated_run",
  "reject_approval_gated_run",
  "dispatch_approved_diagnostic_run",
  "revoke_approved_diagnostic_run",
  "engage_diagnostic_runtime_freeze",
  "release_diagnostic_runtime_freeze",
  "get_diagnostic_runtime_freeze_status",
]);

const PROBE_MESSAGE_TYPE = "runtime_transport_probe";
const ACK_MESSAGE_TYPE = "runtime_transport_probe_ack";

const OLLAMA_PROBE_MESSAGE_TYPE = "ollama_inference_probe";
const OLLAMA_PROBE_RESULT_MESSAGE_TYPE = "ollama_inference_probe_result";

const OLLAMA_PROBE_PROMPT_ID = "dfp_ollama_ping_v1";
const OLLAMA_PROBE_MODEL = "qwen2.5-coder:7b";
const OLLAMA_PROBE_MODE = "sandbox_diagnostic";

const N8N_SANDBOX_PROBE_MESSAGE_TYPE = "n8n_sandbox_probe";
const N8N_SANDBOX_PROBE_RESULT_MESSAGE_TYPE = "n8n_sandbox_probe_result";

const N8N_SANDBOX_PROBE_ID = "dfp_n8n_ping_v1";
const N8N_SANDBOX_PROBE_MODE = "sandbox_diagnostic";
const N8N_SANDBOX_PROBE_WORKFLOW_ALIAS = "DFP Runtime Sandbox Ping";

const CHAIN_PROBE_MESSAGE_TYPE = "runtime_chain_probe";
const CHAIN_PROBE_RESULT_MESSAGE_TYPE = "runtime_chain_probe_result";

const CHAIN_PROBE_ID = "dfp_runtime_chain_v1";
const CHAIN_PROBE_MODE = "sandbox_diagnostic";

const AGENT_DRY_RUN_PROBE_MESSAGE_TYPE = "agent_dry_run_probe";
const AGENT_DRY_RUN_PROBE_RESULT_MESSAGE_TYPE = "agent_dry_run_probe_result";

const AGENT_DRY_RUN_PROBE_ID = "dfp_agent_dry_run_v1";
const AGENT_DRY_RUN_PROBE_MODE = "sandbox_diagnostic";
const AGENT_DRY_RUN_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const AGENT_DRY_RUN_MODEL = "qwen2.5-coder:7b";

const TOOL_ACCESS_DENIAL_PROBE_ID = "dfp_tool_access_denial_v1";
const TOOL_ACCESS_DENIAL_PROBE_MODE = "authorization_diagnostic";
const TOOL_ACCESS_DENIAL_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const TOOL_ACCESS_DENIAL_TOOL_KEY = "dfp-runtime-diagnostic-tool";
const TOOL_ACCESS_DENIAL_EXPECTED_DECISION = "denied";
const TOOL_ACCESS_DENIAL_EXPECTED_REASON = "tool_permission_missing";

const TOOL_ACCESS_GRANT_PROBE_ID = "dfp_tool_access_grant_v1";
const TOOL_ACCESS_GRANT_PROBE_MODE = "authorization_diagnostic";
const TOOL_ACCESS_GRANT_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const TOOL_ACCESS_GRANT_TOOL_KEY = "dfp-runtime-diagnostic-tool";
const TOOL_ACCESS_GRANT_EXPECTED_DECISION = "authorized";
const TOOL_ACCESS_GRANT_EXPECTED_REASON = "explicit_tool_permission_present";
const TOOL_ACCESS_GRANT_NARROW_LEVELS = ["read"];
const TOOL_ACCESS_GRANT_EXECUTING_LEVELS = ["write", "execute", "read_write"];

const READONLY_TOOL_PROBE_MESSAGE_TYPE = "readonly_tool_probe";
const READONLY_TOOL_PROBE_RESULT_MESSAGE_TYPE = "readonly_tool_probe_result";
const READONLY_TOOL_PROBE_ID = "dfp_readonly_tool_v1";
const READONLY_TOOL_PROBE_MODE = "sandbox_diagnostic";
const READONLY_TOOL_PROBE_AGENT_KEY = "dfp-runtime-readonly-tool-agent";
const READONLY_TOOL_PROBE_TOOL_KEY = "dfp-runtime-health-read-tool";
const READONLY_TOOL_PROBE_TOOL_OPERATION = "read_runtime_health_snapshot";
const READONLY_TOOL_PROBE_PERMISSION = "execute";

const DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE = "diagnostic_run_tool_probe";
const DIAGNOSTIC_RUN_RESULT_MESSAGE_TYPE = "diagnostic_run_tool_probe_result";
const DIAGNOSTIC_RUN_PROBE_ID = "dfp_diagnostic_run_v1";
const DIAGNOSTIC_RUN_PROBE_MODE = "sandbox_diagnostic";
const DIAGNOSTIC_RUN_TASK_KEY_PREFIX = "dfp-runtime-health-diagnostic-task";
const DIAGNOSTIC_RUN_TASK_NAME = "DFP Runtime Health Diagnostic Task";
const DIAGNOSTIC_RUN_TASK_TYPE = "runtime_health_diagnostic";
const DIAGNOSTIC_RUN_KEY_PREFIX = "dfp-diagnostic-run-";
const DIAGNOSTIC_RUN_AGENT_KEY = "dfp-runtime-readonly-tool-agent";
const DIAGNOSTIC_RUN_TOOL_KEY = "dfp-runtime-health-read-tool";
const DIAGNOSTIC_RUN_TOOL_OPERATION = "read_runtime_health_snapshot";
const DIAGNOSTIC_RUN_PERMISSION = "execute";
const DIAGNOSTIC_RUN_STEPS = [
  "validate_runtime_gates",
  "validate_agent",
  "validate_tool_permission",
  "dispatch_readonly_tool",
  "verify_signed_result",
  "close_diagnostic_run",
];

const APPROVAL_GATED_QUEUE_MESSAGE_TYPE = "approval_gated_diagnostic_probe";
const APPROVAL_GATED_RESULT_MESSAGE_TYPE = "approval_gated_diagnostic_probe_result";
const APPROVAL_GATED_PROBE_ID = "dfp_approval_run_v1";
const APPROVAL_GATED_PROBE_MODE = "sandbox_diagnostic";
const APPROVAL_GATED_TASK_KEY_PREFIX = "dfp-runtime-health-approval-task";
const APPROVAL_GATED_TASK_NAME = "DFP Runtime Health Approval-Gated Task";
const APPROVAL_GATED_TASK_TYPE = "runtime_health_approval_diagnostic";
const APPROVAL_GATED_RUN_KEY_PREFIX = "dfp-approval-run-";
const APPROVAL_GATED_APPROVAL_KEY_PREFIX = "dfp-approval-";
const APPROVAL_GATED_APPROVAL_TYPE = "runtime_diagnostic_execution";
const APPROVAL_GATED_AGENT_KEY = "dfp-runtime-readonly-tool-agent";
const APPROVAL_GATED_TOOL_KEY = "dfp-runtime-health-read-tool";
const APPROVAL_GATED_TOOL_OPERATION = "read_runtime_health_snapshot";
const APPROVAL_GATED_PERMISSION = "execute";
const APPROVAL_GATED_STEPS = [
  "validate_runtime_gates",
  "validate_agent",
  "validate_tool_permission",
  "require_human_approval",
  "dispatch_readonly_tool",
  "verify_and_close",
];

const APPROVAL_GATED_VALIDITY_MS = 5 * 60_000;
const APPROVAL_CONTEXT_VERSION = "v1";

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

function normaliseIdentity(v: unknown): string {
  return str(v).toLowerCase();
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function auditEvent(
  admin: ReturnType<typeof createClient>,
  eventType: string,
  outcome: string,
  severity: string,
  actor: string,
  notes: string,
  correlationId: string | null = null,
) {
  await admin.from("ai_audit_events").insert({
    audit_key: uid("BRC"),
    occurred_at: new Date().toISOString(),
    event_type: eventType,
    action: "runtime_bridge_control",
    outcome,
    severity,
    actor_type: "human",
    actor_reference: actor,
    trigger_source: "manual",
    environment: "production",
    correlation_id: correlationId,
    notes,
  });
}

async function expireProbeIfNeeded(
  admin: ReturnType<typeof createClient>,
  probe: Record<string, unknown>,
  actor: string,
): Promise<Record<string, unknown>> {
  const expiresAt = str((probe.safe_payload as Record<string, unknown>)?.expires_at);
  if (!expiresAt) return probe;
  const expired = Date.now() > new Date(expiresAt).getTime();
  const status = str(probe.status);
  if (!expired) return probe;
  if (status === "pending" || status === "delivered") {
    await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", str(probe.message_key));
    await auditEvent(admin, "runtime_probe_expired", "expired", "low", actor,
      `Probe ${str(probe.message_key)} expired without a signed result. No execution occurred.`,
      str(probe.correlation_id) || null);
    return { ...probe, status: "expired" };
  }
  return probe;
}

async function resolveNode(
  admin: ReturnType<typeof createClient>,
  nodeKeyParam: string,
): Promise<Record<string, unknown> | null> {
  const { data: nodeRows } = await admin
    .from("ai_runtime_bridge_nodes")
    .select("id, node_key, name, status, last_handshake_at, last_heartbeat_at, last_seen_at")
    .eq(nodeKeyParam ? "node_key" : "status", nodeKeyParam || "reachable")
    .order("last_seen_at", { ascending: false })
    .limit(1);

  const node = nodeRows && nodeRows.length > 0 ? nodeRows[0] : null;
  if (!node) return null;

  if (!node.last_handshake_at) return null;
  const lastBeat = node.last_heartbeat_at ?? node.last_seen_at;
  const beatAge = lastBeat ? Date.now() - new Date(lastBeat as string).getTime() : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(beatAge) || beatAge > HEARTBEAT_FRESH_MS) return null;

  return node;
}

async function resolveDiagnosticAgent(
  admin: ReturnType<typeof createClient>,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_operations_agents")
    .select("id, agent_key, name, status, is_active")
    .eq("agent_key", AGENT_DRY_RUN_AGENT_KEY)
    .eq("is_active", true)
    .in("status", ["active", "registered"])
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

async function resolveDiagnosticModelAssignment(
  admin: ReturnType<typeof createClient>,
  agentId: string,
): Promise<{ ok: boolean; modelReference: string | null; detail: string | null }> {
  const { data: assignRows } = await admin
    .from("ai_agent_model_assignments")
    .select("model_id")
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .limit(1);
  const assignment = assignRows && assignRows.length > 0 ? assignRows[0] : null;
  if (!assignment) return { ok: false, modelReference: null, detail: "model_assignment_missing" };

  const { data: modelRows } = await admin
    .from("ai_operations_models")
    .select("id, model_reference, name, status, is_active")
    .eq("id", assignment.model_id)
    .eq("is_active", true)
    .in("status", ["available", "active"])
    .limit(1);
  const model = modelRows && modelRows.length > 0 ? modelRows[0] : null;
  if (!model) return { ok: false, modelReference: null, detail: "model_inactive_or_missing" };

  const reference = (typeof model.model_reference === "string" && str(model.model_reference)
    ? model.model_reference
    : model.name)?.trim();
  if (reference !== AGENT_DRY_RUN_MODEL) return { ok: false, modelReference: null, detail: "model_reference_mismatch" };

  return { ok: true, modelReference: AGENT_DRY_RUN_MODEL, detail: null };
}

async function resolveDiagnosticTool(
  admin: ReturnType<typeof createClient>,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_tool_connections")
    .select("id, connection_key, name, status, is_active, credential_reference, endpoint_reference, configuration_state")
    .eq("connection_key", TOOL_ACCESS_DENIAL_TOOL_KEY)
    .eq("is_active", true)
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

async function resolveDiagnosticToolAccess(
  admin: ReturnType<typeof createClient>,
  agentId: string,
  toolId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_tool_agent_access")
    .select("id")
    .eq("agent_id", agentId)
    .eq("connection_id", toolId)
    .eq("is_active", true)
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

async function resolveMasterKillSwitch(
  admin: ReturnType<typeof createClient>,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_runtime_controls")
    .select("control_key, enabled, execution_allowed")
    .eq("control_type", "master_kill_switch")
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

// ===========================================================================
// PROMPT 24A — Emergency Runtime Freeze control + server-side queue gates.
// ===========================================================================

const EMERGENCY_FREEZE_CONTROL_KEY = "diagnostic-runtime-emergency-freeze";
const EMERGENCY_FREEZE_CONTROL_TYPE = "runtime_feature_gate";
const EMERGENCY_FREEZE_DISPLAY_NAME = "Diagnostic Runtime Emergency Freeze";

const FREEZE_CONFIGURATION_INVALID_SENTINEL: Record<string, unknown> = Object.freeze({
  __freezeConfigurationInvalid: true,
});

async function ensureEmergencyFreezeControl(
  admin: ReturnType<typeof createClient>,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_runtime_controls")
    .select("id, control_key, control_type, scope_type, environment, enabled, execution_allowed, changed_by, changed_at")
    .eq("control_key", EMERGENCY_FREEZE_CONTROL_KEY)
    .limit(1);
  if (data && data.length > 0) {
    const existingRow = data[0];
    return isEmergencyFreezeConfigurationValid(existingRow)
      ? existingRow
      : FREEZE_CONFIGURATION_INVALID_SENTINEL;
  }

  const nowIso = new Date().toISOString();
  const ins = await admin.from("ai_runtime_controls").insert({
    control_key: EMERGENCY_FREEZE_CONTROL_KEY,
    control_type: EMERGENCY_FREEZE_CONTROL_TYPE,
    enabled: false,
    execution_allowed: true,
    reason: `${EMERGENCY_FREEZE_DISPLAY_NAME} — default DISENGAGED. Blocks only execution-bearing sandbox diagnostic dispatches.`,
    risk_ceiling: null,
    scope_type: "global",
    environment: "sandbox",
    requires_approval: false,
    notes: "Protects ollama/n8n/chain/agent-dry-run/readonly-tool/diagnostic-run/approval-gated dispatch paths only. Monitoring and transport are unaffected.",
    created_at: nowIso,
    updated_at: nowIso,
  }).select("id, control_key, control_type, enabled, execution_allowed, changed_by, changed_at");

  if (ins.error) {
    if (ins.error.code === "23505") {
      const { data: existing } = await admin
        .from("ai_runtime_controls")
        .select("id, control_key, control_type, enabled, execution_allowed, changed_by, changed_at")
        .eq("control_key", EMERGENCY_FREEZE_CONTROL_KEY)
        .limit(1);
      if (existing && existing.length > 0) return existing[0];
      return null;
    }
    return null;
  }
  if (!ins.data || ins.data.length === 0) return null;
  return ins.data[0];
}

function isEmergencyFreezeConfigurationValid(control: Record<string, unknown>): boolean {
  return (
    str(control.control_key) === EMERGENCY_FREEZE_CONTROL_KEY &&
    str(control.control_type) === EMERGENCY_FREEZE_CONTROL_TYPE &&
    str(control.scope_type) === "global" &&
    str(control.environment) === "sandbox"
  );
}

function isFreezeEngaged(control: Record<string, unknown> | null): boolean {
  return !!control && control.enabled === true && control.execution_allowed === false;
}

async function emergencyFreezeEngaged(
  admin: ReturnType<typeof createClient>,
  actor: string,
  correlationId: string | null,
): Promise<boolean> {
  const control = await ensureEmergencyFreezeControl(admin);
  if (control && control.__freezeConfigurationInvalid === true) return true;
  if (!isFreezeEngaged(control)) return false;
  await auditEvent(admin, "runtime_emergency_dispatch_blocked", "blocked", "high", actor,
    "Diagnostic runtime execution is frozen by the emergency freeze control. No outbound dispatch was created.",
    correlationId);
  return true;
}

function emergencyFreezeBlockedResponse(operation: string) {
  return json({
    accepted: false,
    operation,
    detail: "runtime_emergency_freeze_engaged",
    message: "Diagnostic runtime execution is frozen. No runtime dispatch was created.",
    executionEnabled: false,
  }, 409);
}

// ===========================================================================
// PROMPT 24B — existing-work containment on freeze engage.
// ===========================================================================

const EXECUTION_BEARING_MESSAGE_TYPES = new Set([
  OLLAMA_PROBE_MESSAGE_TYPE,
  N8N_SANDBOX_PROBE_MESSAGE_TYPE,
  CHAIN_PROBE_MESSAGE_TYPE,
  AGENT_DRY_RUN_PROBE_MESSAGE_TYPE,
  READONLY_TOOL_PROBE_MESSAGE_TYPE,
  DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE,
  APPROVAL_GATED_QUEUE_MESSAGE_TYPE,
]);

const FREEZE_REASON_BEFORE_DELIVERY = "runtime_emergency_freeze_before_delivery";
const FREEZE_REASON_INFLIGHT = "runtime_emergency_freeze_inflight";

const NON_TERMINAL_RUN_STATUSES = new Set(["queued", "working", "waiting", "awaiting_approval"]);
const NON_TERMINAL_STEP_STATUSES = new Set(["pending", "working", "awaiting_approval"]);

async function resolveRunByReferences(
  admin: ReturnType<typeof createClient>,
  safePayload: Record<string, unknown>,
  correlationId: string | null,
): Promise<Record<string, unknown> | null> {
  const runReference = str(safePayload.run_reference);
  if (runReference) {
    const { data } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id, approval_id")
      .eq("run_key", runReference)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  }
  if (correlationId) {
    const { data } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id, approval_id")
      .eq("correlation_id", correlationId)
      .order("created_at", { ascending: false })
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  }
  return null;
}

async function cancelRunBeforeDelivery(
  admin: ReturnType<typeof createClient>,
  run: Record<string, unknown>,
  engagedAt: string,
): Promise<void> {
  const runId = run.id as string;
  if (!NON_TERMINAL_RUN_STATUSES.has(str(run.status))) return;

  await admin.from("ai_runs").update({
    status: "cancelled",
    error_summary: FREEZE_REASON_BEFORE_DELIVERY,
    completed_at: engagedAt,
    updated_at: engagedAt,
  }).eq("id", runId).in("status", [...NON_TERMINAL_RUN_STATUSES]);

  if (run.task_id) {
    await admin.from("ai_tasks").update({ status: "failed", updated_at: engagedAt }).eq("id", run.task_id);
  }

  await admin.from("ai_run_steps").update({
    status: "failed",
    error_summary: FREEZE_REASON_BEFORE_DELIVERY,
    completed_at: engagedAt,
  }).eq("run_id", runId).in("status", [...NON_TERMINAL_STEP_STATUSES]);
}

async function failRunInflight(
  admin: ReturnType<typeof createClient>,
  run: Record<string, unknown>,
  engagedAt: string,
): Promise<void> {
  const runId = run.id as string;
  if (!NON_TERMINAL_RUN_STATUSES.has(str(run.status))) return;

  await admin.from("ai_runs").update({
    status: "failed",
    error_summary: FREEZE_REASON_INFLIGHT,
    completed_at: engagedAt,
    updated_at: engagedAt,
  }).eq("id", runId).in("status", [...NON_TERMINAL_RUN_STATUSES]);

  if (run.task_id) {
    await admin.from("ai_tasks").update({ status: "failed", updated_at: engagedAt }).eq("id", run.task_id);
  }

  await admin.from("ai_run_steps").update({
    status: "failed",
    error_summary: FREEZE_REASON_INFLIGHT,
    completed_at: engagedAt,
  }).eq("run_id", runId).in("status", [...NON_TERMINAL_STEP_STATUSES]);
}

async function invalidatePendingApproval(
  admin: ReturnType<typeof createClient>,
  run: Record<string, unknown>,
  safePayload: Record<string, unknown>,
  actor: string,
  role: string,
  engagedAt: string,
): Promise<void> {
  const approvalReference = str(safePayload.approval_reference);
  let approval: Record<string, unknown> | null = null;

  if (approvalReference) {
    const { data } = await admin
      .from("ai_approvals")
      .select("id, approval_key, status, decision, decision_actor, decision_at, requested_by, conditions")
      .eq("approval_key", approvalReference)
      .limit(1);
    approval = data && data.length > 0 ? data[0] : null;
  }
  if (!approval && run.approval_id) {
    const { data } = await admin
      .from("ai_approvals")
      .select("id, approval_key, status, decision, decision_actor, decision_at, requested_by, conditions")
      .eq("id", run.approval_id)
      .limit(1);
    approval = data && data.length > 0 ? data[0] : null;
  }

  if (!approval) return;
  if (str(approval.status) !== "approved") return;

  const conditions = (approval.conditions as Record<string, unknown> | null) ?? {};
  const mergedConditions = {
    ...conditions,
    emergency_freeze_invalidated: true,
    emergency_freeze_invalidated_at: engagedAt,
    emergency_freeze_invalidated_reason: FREEZE_REASON_BEFORE_DELIVERY,
  };

  await admin.from("ai_approvals").update({
    status: "rejected",
    decision_reason: "Approved runtime dispatch was invalidated by Emergency Runtime Freeze before HAL delivery.",
    conditions: mergedConditions,
    updated_at: engagedAt,
  }).eq("id", approval.id);

  await admin.from("ai_approval_history").insert({
    approval_id: approval.id,
    event_type: "emergency_freeze_invalidated",
    previous_status: "approved",
    new_status: "rejected",
    decision: null,
    actor_reference: actor,
    actor_role: role,
    reason: "Approved runtime dispatch was invalidated by Emergency Runtime Freeze before HAL delivery.",
    conditions: null,
    approval_count_before: 1,
    approval_count_after: 1,
    created_at: engagedAt,
  });
}

async function containExistingExecutionBearingWork(
  admin: ReturnType<typeof createClient>,
  actor: string,
  role: string,
  engagedAt: string,
): Promise<{ pendingMessagesInvalidated: number; inflightMessagesDetected: number; latestAffectedRunKey: string | null }> {
  const { data: messages } = await admin
    .from("ai_runtime_bridge_messages")
    .select("message_key, message_type, direction, status, correlation_id, safe_payload, created_at")
    .eq("direction", "outbound")
    .order("created_at", { ascending: true });

  let pendingMessagesInvalidated = 0;
  let inflightMessagesDetected = 0;
  let latestAffectedRunKey: string | null = null;

  for (const msg of messages ?? []) {
    const type = str(msg.message_type);
    if (!EXECUTION_BEARING_MESSAGE_TYPES.has(type)) continue;
    const status = str(msg.status);
    const safePayload = (msg.safe_payload as Record<string, unknown>) ?? {};
    const correlationId = str(msg.correlation_id) || null;

    if (status === "pending") {
      pendingMessagesInvalidated += 1;
      const merged = {
        ...safePayload,
        freeze_invalidated: true,
        freeze_invalidated_at: engagedAt,
        freeze_reason: FREEZE_REASON_BEFORE_DELIVERY,
      };
      await admin.from("ai_runtime_bridge_messages").update({
        status: "rejected",
        safe_payload: merged,
        acknowledged_at: engagedAt,
      }).eq("message_key", str(msg.message_key));

      if (type === DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE || type === APPROVAL_GATED_QUEUE_MESSAGE_TYPE) {
        const run = await resolveRunByReferences(admin, safePayload, correlationId);
        if (run) {
          latestAffectedRunKey = str(run.run_key) || latestAffectedRunKey;
          await cancelRunBeforeDelivery(admin, run, engagedAt);
          if (type === APPROVAL_GATED_QUEUE_MESSAGE_TYPE) {
            await invalidatePendingApproval(admin, run, safePayload, actor, role, engagedAt);
          }
        }
      }

      await auditEvent(admin, "runtime_emergency_pending_message_invalidated", "invalidated", "medium", actor,
        `Pending execution-bearing message ${str(msg.message_key)} (${type}) permanently invalidated by emergency freeze before HAL delivery. No execution occurred.`,
        correlationId);
    } else if (status === "delivered" || status === "acknowledged") {
      inflightMessagesDetected += 1;
      const merged = {
        ...safePayload,
        freeze_inflight_marked: true,
        freeze_inflight_marked_at: engagedAt,
      };
      await admin.from("ai_runtime_bridge_messages").update({
        safe_payload: merged,
      }).eq("message_key", str(msg.message_key));

      if (type === DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE || type === APPROVAL_GATED_QUEUE_MESSAGE_TYPE) {
        const run = await resolveRunByReferences(admin, safePayload, correlationId);
        if (run) {
          latestAffectedRunKey = str(run.run_key) || latestAffectedRunKey;
          await failRunInflight(admin, run, engagedAt);
        }
      }

      await auditEvent(admin, "runtime_emergency_inflight_detected", "contained", "medium", actor,
        `Execution-bearing message ${str(msg.message_key)} (${type}) was already delivered to HAL — recorded as potentially in-flight. Freeze engaged after HAL delivery; local work may have started.`,
        correlationId);
    }
  }

  return { pendingMessagesInvalidated, inflightMessagesDetected, latestAffectedRunKey };
}

async function recordDenialProbeEvent(
  admin: ReturnType<typeof createClient>,
  e: {
    eventType: string;
    outcome: string;
    severity: string;
    actor: string;
    correlationId: string;
    agentId: string | null;
    decision: string | null;
    reason: string | null;
    permissionState: string | null;
    probeKey: string;
  },
): Promise<void> {
  await admin.from("ai_audit_events").insert({
    audit_key: uid("TAPA"),
    occurred_at: new Date().toISOString(),
    event_type: e.eventType,
    action: "runtime_bridge_control",
    outcome: e.outcome,
    severity: e.severity,
    agent_id: e.agentId,
    actor_type: "human",
    actor_reference: e.actor,
    trigger_source: "manual",
    environment: "production",
    correlation_id: e.correlationId,
    decision_reason: e.reason,
    notes: JSON.stringify({
      probe_key: e.probeKey,
      probe_id: TOOL_ACCESS_DENIAL_PROBE_ID,
      agent_key: TOOL_ACCESS_DENIAL_AGENT_KEY,
      tool_key: TOOL_ACCESS_DENIAL_TOOL_KEY,
      decision: e.decision,
      reason: e.reason,
      allowed: false,
      permission_state: e.permissionState,
    }),
  });
}

async function recordGrantProbeEvent(
  admin: ReturnType<typeof createClient>,
  e: {
    eventType: string;
    outcome: string;
    severity: string;
    actor: string;
    correlationId: string;
    agentId: string | null;
    decision: string | null;
    reason: string | null;
    permissionState: string | null;
    permissionType: string | null;
    scopeIsolated: boolean | null;
    probeKey: string;
  },
): Promise<void> {
  await admin.from("ai_audit_events").insert({
    audit_key: uid("TAGP"),
    occurred_at: new Date().toISOString(),
    event_type: e.eventType,
    action: "runtime_bridge_control",
    outcome: e.outcome,
    severity: e.severity,
    agent_id: e.agentId,
    actor_type: "human",
    actor_reference: e.actor,
    trigger_source: "manual",
    environment: "production",
    correlation_id: e.correlationId,
    decision_reason: e.reason,
    notes: JSON.stringify({
      probe_key: e.probeKey,
      probe_id: TOOL_ACCESS_GRANT_PROBE_ID,
      agent_key: TOOL_ACCESS_GRANT_AGENT_KEY,
      tool_key: TOOL_ACCESS_GRANT_TOOL_KEY,
      decision: e.decision,
      reason: e.reason,
      allowed: e.decision === "authorized",
      permission_state: e.permissionState,
      permission_type: e.permissionType,
      scope_isolated: e.scopeIsolated,
      tool_executed: false,
      execution_enabled: false,
    }),
  });
}

async function resolveDiagnosticToolAccessDetail(
  admin: ReturnType<typeof createClient>,
  agentId: string,
  toolId: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await admin
    .from("ai_tool_agent_access")
    .select("id, connection_id, agent_id, access_level, is_active, approval_required, environment, risk_limit")
    .eq("agent_id", agentId)
    .eq("connection_id", toolId)
    .eq("is_active", true);
  return data ?? [];
}

async function resolveAgentActiveGrants(
  admin: ReturnType<typeof createClient>,
  agentId: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await admin
    .from("ai_tool_agent_access")
    .select("id, connection_id, access_level")
    .eq("agent_id", agentId)
    .eq("is_active", true);
  return data ?? [];
}

async function resolveReadonlyToolAgent(
  admin: ReturnType<typeof createClient>,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_operations_agents")
    .select("id, agent_key, name, status, is_active, autonomy_level")
    .eq("agent_key", READONLY_TOOL_PROBE_AGENT_KEY)
    .eq("is_active", true)
    .in("status", ["active", "registered"])
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

async function resolveReadonlyTool(
  admin: ReturnType<typeof createClient>,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("ai_tool_connections")
    .select("id, connection_key, name, status, is_active, credential_reference, endpoint_reference, configuration_state")
    .eq("connection_key", READONLY_TOOL_PROBE_TOOL_KEY)
    .eq("is_active", true)
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

async function resolveApprovalGatedApprovalByRefs(
  admin: ReturnType<typeof createClient>,
  approvalKeyParam: string,
  runKeyParam: string,
): Promise<Record<string, unknown> | null> {
  if (approvalKeyParam) {
    const { data } = await admin
      .from("ai_approvals")
      .select("*")
      .eq("approval_key", approvalKeyParam)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  }
  if (runKeyParam) {
    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id")
      .eq("run_key", runKeyParam)
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;
    if (!run) return null;
    const { data } = await admin
      .from("ai_approvals")
      .select("*")
      .eq("run_id", run.id)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  }
  return null;
}

// ===========================================================================
// PROMPT 20 — approval expiry + context binding helpers.
// ===========================================================================

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeysDeep(obj[k]);
    return out;
  }
  return value;
}

function buildApprovalContext(params: {
  agentId: string;
  toolId: string;
  grantId: string;
}): Record<string, unknown> {
  return {
    approval_context_version: APPROVAL_CONTEXT_VERSION,
    probe_id: APPROVAL_GATED_PROBE_ID,
    probe_mode: APPROVAL_GATED_PROBE_MODE,
    environment: "sandbox",
    risk: "low",
    agent_id: params.agentId,
    agent_key: APPROVAL_GATED_AGENT_KEY,
    tool_id: params.toolId,
    tool_key: APPROVAL_GATED_TOOL_KEY,
    tool_operation: APPROVAL_GATED_TOOL_OPERATION,
    tool_permission_id: params.grantId,
    access_level: APPROVAL_GATED_PERMISSION,
  };
}

async function computeApprovalContextHash(context: Record<string, unknown>): Promise<string> {
  return sha256Hex(JSON.stringify(sortKeysDeep(context)));
}

async function currentApprovalContextHash(
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; hash: string | null }> {
  const agent = await resolveReadonlyToolAgent(admin);
  if (!agent || str(agent.autonomy_level) !== "none") return { ok: false, hash: null };
  const tool = await resolveReadonlyTool(admin);
  if (!tool || str(tool.credential_reference) || str(tool.endpoint_reference)) return { ok: false, hash: null };
  const { data: grantRows } = await admin
    .from("ai_tool_agent_access")
    .select("id, connection_id, access_level")
    .eq("agent_id", agent.id)
    .eq("is_active", true);
  const grants = grantRows ?? [];
  if (grants.length !== 1) return { ok: false, hash: null };
  const grant = grants[0];
  if (grant.connection_id !== tool.id || str(grant.access_level) !== APPROVAL_GATED_PERMISSION) {
    return { ok: false, hash: null };
  }
  const context = buildApprovalContext({
    agentId: str(agent.id),
    toolId: str(tool.id),
    grantId: str(grant.id),
  });
  const hash = await computeApprovalContextHash(context);
  return { ok: true, hash };
}

async function revalidateApprovalContext(
  admin: ReturnType<typeof createClient>,
  approval: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string | null }> {
  const stored = str((approval.conditions as Record<string, unknown> | null)?.approval_context_hash);
  if (!stored) return { ok: false, detail: "approval_context_changed" };
  const cur = await currentApprovalContextHash(admin);
  if (!cur.ok || cur.hash !== stored) return { ok: false, detail: "approval_context_changed" };
  return { ok: true, detail: null };
}

async function revalidateApprovalContextForDispatch(
  admin: ReturnType<typeof createClient>,
  approval: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string | null; currentHash: string | null }> {
  const stored = str((approval.conditions as Record<string, unknown> | null)?.approval_context_hash);
  if (!stored) return { ok: true, detail: null, currentHash: null };
  const cur = await currentApprovalContextHash(admin);
  if (!cur.ok) return { ok: false, detail: "approval_context_changed", currentHash: null };
  if (cur.hash !== stored) return { ok: false, detail: "approval_context_changed", currentHash: cur.hash };
  return { ok: true, detail: null, currentHash: cur.hash };
}

async function hasContextChangedAuditEvent(
  admin: ReturnType<typeof createClient>,
  correlationId: string,
): Promise<boolean> {
  if (!correlationId) return false;
  const { data } = await admin
    .from("ai_audit_events")
    .select("audit_key")
    .eq("correlation_id", correlationId)
    .eq("event_type", "approval_context_changed")
    .limit(1);
  return !!(data && data.length > 0);
}

async function permanentlyInvalidateApprovalContext(
  admin: ReturnType<typeof createClient>,
  approval: Record<string, unknown>,
  run: Record<string, unknown>,
  actor: string,
  role: string,
): Promise<void> {
  const invalidatedAt = new Date().toISOString();
  const conditions = (approval.conditions as Record<string, unknown> | null) ?? {};
  const contextHash = str(conditions.approval_context_hash);
  const fingerprint = contextHash ? contextHash.slice(0, 8) : null;
  const mergedConditions = {
    ...conditions,
    context_invalidated: true,
    context_invalidated_reason: "approval_context_changed",
    context_invalidated_at: invalidatedAt,
  };

  await admin.from("ai_approvals").update({
    status: "rejected",
    decision_reason: "Previously approved; authorization context later changed before dispatch. Fresh approval required.",
    conditions: mergedConditions,
    updated_at: invalidatedAt,
  }).eq("id", approval.id);

  await admin.from("ai_approval_history").insert({
    approval_id: approval.id,
    event_type: "context_invalidated",
    previous_status: "approved",
    new_status: "rejected",
    decision: null,
    actor_reference: actor,
    actor_role: role,
    reason: "Authorization context changed after human approval and before dispatch. Approval permanently invalidated; fresh approval required.",
    conditions: null,
    approval_count_before: 1,
    approval_count_after: 1,
    created_at: invalidatedAt,
  });

  await admin.from("ai_run_steps").update({
    status: "failed",
    error_summary: "approval_context_changed",
    completed_at: invalidatedAt,
  }).eq("run_id", run.id).eq("step_number", 5);

  await admin.from("ai_runs").update({
    status: "cancelled",
    error_summary: "approval_context_changed",
    completed_at: invalidatedAt,
    updated_at: invalidatedAt,
  }).eq("id", run.id);

  if (run.task_id) {
    await admin.from("ai_tasks").update({ status: "failed", updated_at: invalidatedAt }).eq("id", run.task_id);
  }

  const corr = str(run.correlation_id) || null;
  const safeNote =
    `Approval ${str(approval.approval_key)} permanently invalidated after authorization-context drift ` +
    `(run ${str(run.run_key)}, fingerprint=${fingerprint ?? "n/a"}). Reason=approval_context_changed. HAL dispatch=blocked.`;

  await auditEvent(admin, "approval_context_changed", "blocked", "high", actor, safeNote, corr);
  await auditEvent(admin, "approval_context_invalidated", "blocked", "high", actor, safeNote, corr);
}

// ===========================================================================
// PROMPT 22 — approval revocation + reviewer eligibility helpers.
// ===========================================================================

async function resolveApproverInternalRole(
  admin: ReturnType<typeof createClient>,
  decisionActor: string,
): Promise<{
  ok: boolean;
  detail: string | null;
  eligible: boolean;
  role: string | null;
  userId: string | null;
  fullName: string | null;
}> {
  const normalized = normaliseIdentity(decisionActor);
  if (!normalized) {
    return { ok: false, detail: "approver_identity_unverifiable", eligible: false, role: null, userId: null, fullName: null };
  }

  let userId: string | null = null;
  if (normalized.includes("@")) {
    try {
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw new Error("list_users_failed");
      const users = (listData as { users?: { id: string; email?: string }[] } | null)?.users ?? [];
      const match = users.find((u) => normaliseIdentity(u.email) === normalized);
      if (!match) throw new Error("no_match");
      userId = match.id;
    } catch {
      return { ok: false, detail: "approver_identity_unverifiable", eligible: false, role: null, userId: null, fullName: null };
    }
  } else {
    userId = decisionActor;
  }

  if (!userId) {
    return { ok: false, detail: "approver_identity_unverifiable", eligible: false, role: null, userId: null, fullName: null };
  }

  const { data: roleRows } = await admin
    .from("internal_user_roles")
    .select("id, user_id, role, status, disabled_at, full_name")
    .eq("user_id", userId)
    .limit(1);
  const roleRow = roleRows && roleRows.length > 0 ? roleRows[0] : null;
  if (!roleRow) {
    return { ok: false, detail: "approver_identity_unverifiable", eligible: false, role: null, userId, fullName: null };
  }

  const approverRole = str(roleRow.role);
  const approverStatus = str(roleRow.status);
  const disabledAt = roleRow.disabled_at ?? null;
  const eligible =
    (approverRole === "owner" || approverRole === "admin") &&
    approverStatus === "active" &&
    disabledAt == null;

  return { ok: true, detail: null, eligible, role: approverRole, userId, fullName: str(roleRow.full_name) || null };
}

async function invalidateApproverEligibility(
  admin: ReturnType<typeof createClient>,
  approval: Record<string, unknown>,
  run: Record<string, unknown>,
  actor: string,
  role: string,
): Promise<void> {
  const invalidatedAt = new Date().toISOString();
  const conditions = (approval.conditions as Record<string, unknown> | null) ?? {};
  const mergedConditions = {
    ...conditions,
    approver_eligibility_invalidated: true,
    approver_eligibility_invalidated_at: invalidatedAt,
  };

  await admin.from("ai_approvals").update({
    status: "rejected",
    decision_reason: "Approving reviewer is no longer an eligible active owner/admin before dispatch.",
    conditions: mergedConditions,
    updated_at: invalidatedAt,
  }).eq("id", approval.id);

  await admin.from("ai_approval_history").insert({
    approval_id: approval.id,
    event_type: "approver_eligibility_invalidated",
    previous_status: "approved",
    new_status: "rejected",
    decision: null,
    actor_reference: actor,
    actor_role: role,
    reason: "Approving reviewer was no longer an eligible active owner/admin before dispatch.",
    conditions: null,
    approval_count_before: 1,
    approval_count_after: 1,
    created_at: invalidatedAt,
  });

  await admin.from("ai_run_steps").update({
    status: "failed",
    error_summary: "approver_no_longer_eligible",
    completed_at: invalidatedAt,
  }).eq("run_id", run.id).eq("step_number", 5);

  await admin.from("ai_runs").update({
    status: "cancelled",
    error_summary: "approver_no_longer_eligible",
    completed_at: invalidatedAt,
    updated_at: invalidatedAt,
  }).eq("id", run.id);

  if (run.task_id) {
    await admin.from("ai_tasks").update({ status: "failed", updated_at: invalidatedAt }).eq("id", run.task_id);
  }

  const corr = str(run.correlation_id) || null;
  const safeNote =
    `Approval ${str(approval.approval_key)} invalidated: approving reviewer no longer eligible before dispatch ` +
    `(run ${str(run.run_key)}). Reason=approver_no_longer_eligible. HAL dispatch=blocked.`;

  await auditEvent(admin, "approver_eligibility_failed", "blocked", "high", actor, safeNote, corr);
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
  if (!ALLOWED_OPERATIONS.has(operation)) return json({ error: "Unknown or disallowed operation." }, 422);

  const actor = user.email ?? user.id;
  const isPrivileged = role === "owner" || role === "admin";

  // ===========================================================================
  // QUEUE_TRANSPORT_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_transport_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to send a transport probe." }, 403);

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      const missing = !node;
      return json({
        error: missing ? "No reachable bridge node found." : "Bridge node heartbeat is stale — probe refused.",
        detail: missing ? "queue_blocked" : "heartbeat_stale",
      }, missing ? 404 : 409);
    }

    const now = new Date();
    const probeKey = uid("PRB");
    const correlationId = uid("COR");
    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      message: "transport verification only",
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "transport_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "runtime_transport_probe_queued", "success", "low", actor,
      `Transport probe ${probeKey} queued for bridge node ${node.node_key}. Transport verification only — no execution.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_transport_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      status: "pending",
      executionEnabled: false,
      message: "Dry-run transport probe queued. This verifies transport only — no execution is performed.",
    });
  }

  // ===========================================================================
  // GET_TRANSPORT_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_transport_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_transport_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const ackRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", ACK_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const ack = ackRows.data && ackRows.data.length > 0 ? ackRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const queuedAt = str(p.created_at);
      const ackedAt = ack ? (str(ack.acknowledged_at) || str(ack.created_at)) : null;

      let roundTripMs: number | null = null;
      if (queuedAt && ackedAt) {
        const delta = new Date(ackedAt).getTime() - new Date(queuedAt).getTime();
        if (Number.isFinite(delta)) roundTripMs = Math.max(0, delta);
      }

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        acknowledgedAt: ackedAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        signedAck: ack ? true : false,
        ackStatus: ack ? (str((ack.safe_payload as Record<string, unknown>)?.status) || str(ack.status)) : null,
        ackSummary: ack ? (str((ack.safe_payload as Record<string, unknown>)?.summary) || null) : null,
        roundTripMs,
      };
    }));

    const verified = results.some((r) => r.status === "acknowledged");

    return json({
      operation: "get_transport_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "Transport verified — no execution performed."
        : "Transport probe status read (no execution performed).",
    });
  }

  // ===========================================================================
  // QUEUE_OLLAMA_INFERENCE_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_ollama_inference_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue an Ollama inference probe." }, 403);

    if (await emergencyFreezeEngaged(admin, actor, null)) {
      return emergencyFreezeBlockedResponse("queue_ollama_inference_probe");
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const now = new Date();
    const probeKey = uid("OLP");
    const correlationId = uid("COR");

    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      probe_mode: OLLAMA_PROBE_MODE,
      prompt_id: OLLAMA_PROBE_PROMPT_ID,
      model: OLLAMA_PROBE_MODEL,
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: OLLAMA_PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "ollama_inference_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "ollama_inference_probe_queued", "success", "low", actor,
      `Ollama sandbox diagnostic probe ${probeKey} queued for node ${node.node_key} ` +
      `(prompt_id=${OLLAMA_PROBE_PROMPT_ID}, model=${OLLAMA_PROBE_MODEL}). ` +
      `Fixed harmless ping only — no arbitrary inference, no execution.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_ollama_inference_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      promptId: OLLAMA_PROBE_PROMPT_ID,
      model: OLLAMA_PROBE_MODEL,
      probeMode: OLLAMA_PROBE_MODE,
      status: "pending",
      executionEnabled: false,
      message: "Ollama sandbox diagnostic probe queued (fixed harmless ping only — no arbitrary inference, no execution).",
    });
  }

  // ===========================================================================
  // GET_OLLAMA_INFERENCE_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_ollama_inference_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", OLLAMA_PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_ollama_inference_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const resRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", OLLAMA_PROBE_RESULT_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const res = resRows.data && resRows.data.length > 0 ? resRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const resPayload = res ? ((res.safe_payload as Record<string, unknown>) ?? {}) : {};
      const queuedAt = str(p.created_at);
      const resultAt = res ? (str(res.acknowledged_at) || str(res.created_at)) : null;

      let roundTripMs: number | null = null;
      if (queuedAt && resultAt) {
        const delta = new Date(resultAt).getTime() - new Date(queuedAt).getTime();
        if (Number.isFinite(delta)) roundTripMs = Math.max(0, delta);
      }

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        resultAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        promptId: str(payload.prompt_id),
        model: str(payload.model),
        probeMode: str(payload.probe_mode),
        hasResult: res ? true : false,
        resultStatus: res ? (str(resPayload.status) || str(res.status)) : null,
        output: res ? (str(resPayload.output) || null) : null,
        verified: res ? (resPayload.verified === true) : false,
        latencyMs: res ? (resPayload.latency_ms ?? null) : null,
        roundTripMs,
      };
    }));

    const verified = results.some((r) => r.verified === true);

    return json({
      operation: "get_ollama_inference_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "Ollama sandbox diagnostic verified — fixed ping returned expected output. No arbitrary inference occurred."
        : "Ollama sandbox diagnostic probe status read (no arbitrary inference occurred).",
    });
  }

  // ===========================================================================
  // QUEUE_N8N_SANDBOX_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_n8n_sandbox_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue an n8n sandbox probe." }, 403);

    if (await emergencyFreezeEngaged(admin, actor, null)) {
      return emergencyFreezeBlockedResponse("queue_n8n_sandbox_probe");
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const now = new Date();
    const probeKey = uid("N8P");
    const correlationId = uid("COR");

    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      probe_mode: N8N_SANDBOX_PROBE_MODE,
      probe_id: N8N_SANDBOX_PROBE_ID,
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: N8N_SANDBOX_PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "n8n_sandbox_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "n8n_sandbox_probe_queued", "success", "low", actor,
      `n8n sandbox diagnostic probe ${probeKey} queued for node ${node.node_key} ` +
      `(probe_id=${N8N_SANDBOX_PROBE_ID}). Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_n8n_sandbox_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      probeId: N8N_SANDBOX_PROBE_ID,
      probeMode: N8N_SANDBOX_PROBE_MODE,
      workflowReference: N8N_SANDBOX_PROBE_WORKFLOW_ALIAS,
      status: "pending",
      executionEnabled: false,
      message: "n8n sandbox diagnostic probe queued (fixed diagnostic workflow only — no arbitrary workflow, payload or business action).",
    });
  }

  // ===========================================================================
  // GET_N8N_SANDBOX_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_n8n_sandbox_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", N8N_SANDBOX_PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_n8n_sandbox_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const resRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", N8N_SANDBOX_PROBE_RESULT_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const res = resRows.data && resRows.data.length > 0 ? resRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const resPayload = res ? ((res.safe_payload as Record<string, unknown>) ?? {}) : {};
      const queuedAt = str(p.created_at);
      const resultAt = res ? (str(res.acknowledged_at) || str(res.created_at)) : null;

      let roundTripMs: number | null = null;
      if (queuedAt && resultAt) {
        const delta = new Date(resultAt).getTime() - new Date(queuedAt).getTime();
        if (Number.isFinite(delta)) roundTripMs = Math.max(0, delta);
      }

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        resultAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        probeId: str(payload.probe_id),
        probeMode: str(payload.probe_mode),
        hasResult: res ? true : false,
        resultStatus: res ? (str(resPayload.status) || str(res.status)) : null,
        workflowReference: res
          ? (str(resPayload.workflow_reference) || N8N_SANDBOX_PROBE_WORKFLOW_ALIAS)
          : N8N_SANDBOX_PROBE_WORKFLOW_ALIAS,
        safeOutput: res ? (str(resPayload.safe_output) || null) : null,
        verified: res ? (resPayload.verified === true) : false,
        errorCategory: res ? (str(resPayload.error_category) || null) : null,
        latencyMs: res ? (resPayload.latency_ms ?? null) : null,
        roundTripMs,
      };
    }));

    const verified = results.some((r) => r.verified === true);

    return json({
      operation: "get_n8n_sandbox_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "n8n sandbox diagnostic verified — fixed workflow returned expected deterministic output. No arbitrary workflow executed."
        : "n8n sandbox diagnostic probe status read (no arbitrary workflow executed).",
    });
  }

  // ===========================================================================
  // QUEUE_RUNTIME_CHAIN_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_runtime_chain_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue a runtime chain probe." }, 403);

    if (await emergencyFreezeEngaged(admin, actor, null)) {
      return emergencyFreezeBlockedResponse("queue_runtime_chain_probe");
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const now = new Date();
    const probeKey = uid("RCP");
    const correlationId = uid("COR");

    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      probe_mode: CHAIN_PROBE_MODE,
      probe_id: CHAIN_PROBE_ID,
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: CHAIN_PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "runtime_chain_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "runtime_chain_probe_queued", "success", "low", actor,
      `Runtime chain probe ${probeKey} queued for node ${node.node_key} ` +
      `(probe_id=${CHAIN_PROBE_ID}). Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_runtime_chain_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      probeId: CHAIN_PROBE_ID,
      probeMode: CHAIN_PROBE_MODE,
      status: "pending",
      executionEnabled: false,
      message: "Runtime chain probe queued (fixed n8n → Ollama diagnostic chain only — no arbitrary workflow, model, prompt or business action).",
    });
  }

  // ===========================================================================
  // GET_RUNTIME_CHAIN_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_runtime_chain_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", CHAIN_PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_runtime_chain_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const resRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", CHAIN_PROBE_RESULT_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const res = resRows.data && resRows.data.length > 0 ? resRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const resPayload = res ? ((res.safe_payload as Record<string, unknown>) ?? {}) : {};
      const queuedAt = str(p.created_at);
      const resultAt = res ? (str(res.acknowledged_at) || str(res.created_at)) : null;

      let roundTripMs: number | null = null;
      if (queuedAt && resultAt) {
        const delta = new Date(resultAt).getTime() - new Date(queuedAt).getTime();
        if (Number.isFinite(delta)) roundTripMs = Math.max(0, delta);
      }

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        resultAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        probeId: str(payload.probe_id),
        probeMode: str(payload.probe_mode),
        hasResult: res ? true : false,
        resultStatus: res ? (str(resPayload.status) || str(res.status)) : null,
        verified: res ? (resPayload.verified === true) : false,
        n8nVerified: res ? (resPayload.n8n_verified === true) : false,
        ollamaVerified: res ? (resPayload.ollama_verified === true) : false,
        n8nLatencyMs: res ? (resPayload.n8n_latency_ms ?? null) : null,
        ollamaLatencyMs: res ? (resPayload.ollama_latency_ms ?? null) : null,
        totalLatencyMs: res ? (resPayload.total_latency_ms ?? null) : null,
        completedSteps: res ? (resPayload.completed_steps ?? 0) : 0,
        errorStep: res ? (str(resPayload.error_step) || null) : null,
        errorCategory: res ? (str(resPayload.error_category) || null) : null,
        roundTripMs,
      };
    }));

    const verified = results.some((r) => r.verified === true);

    return json({
      operation: "get_runtime_chain_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "Runtime chain verified — n8n and Ollama completed the fixed diagnostic chain successfully. No agent, tool or business workflow was executed."
        : "Runtime chain probe status read (controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed).",
    });
  }

  // ===========================================================================
  // QUEUE_AGENT_DRY_RUN_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_agent_dry_run_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue an agent dry-run probe." }, 403);

    if (await emergencyFreezeEngaged(admin, actor, null)) {
      return emergencyFreezeBlockedResponse("queue_agent_dry_run_probe");
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const agent = await resolveDiagnosticAgent(admin);
    if (!agent) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
        `Agent dry-run queue rejected: diagnostic agent ${AGENT_DRY_RUN_AGENT_KEY} not registered/active. No agent dry-run queued.`);
      return json({ error: "Diagnostic agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }

    const modelRes = await resolveDiagnosticModelAssignment(admin, agent.id as string);
    if (!modelRes.ok) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
        `Agent dry-run queue rejected: model assignment invalid (${modelRes.detail}). No agent dry-run queued.`);
      return json({ error: "Diagnostic agent model assignment is invalid.", detail: modelRes.detail ?? "model_assignment_invalid" }, 409);
    }

    const diagTool = await resolveDiagnosticTool(admin);
    if (!diagTool) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
        `Agent dry-run queue rejected: diagnostic tool ${TOOL_ACCESS_DENIAL_TOOL_KEY} not registered. No agent dry-run queued.`);
      return json({ error: "Diagnostic tool is not registered.", detail: "diagnostic_tool_missing" }, 409);
    }
    if (str(diagTool.credential_reference) || str(diagTool.endpoint_reference)) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
        `Agent dry-run queue rejected: diagnostic tool unexpectedly has an executable configuration. No agent dry-run queued.`);
      return json({ error: "Diagnostic tool unexpectedly has an executable configuration.", detail: "diagnostic_tool_not_safe" }, 409);
    }

    const { data: agentGrantRows } = await admin
      .from("ai_tool_agent_access")
      .select("id, connection_id, access_level")
      .eq("agent_id", agent.id as string)
      .eq("is_active", true);
    const agentGrants = agentGrantRows ?? [];

    if (agentGrants.length > 1) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
        `Agent dry-run queue rejected: diagnostic agent holds multiple active tool grants. No agent dry-run queued.`);
      return json({ error: "Diagnostic agent must hold at most one active tool grant.", detail: "tool_access_scope_invalid" }, 409);
    }

    if (agentGrants.length === 1) {
      const grant = agentGrants[0];
      const isExactDiagGrant =
        grant.connection_id === diagTool.id && str(grant.access_level) === "read";

      if (!isExactDiagGrant) {
        const detail =
          grant.connection_id !== diagTool.id
            ? "tool_access_scope_invalid"
            : "tool_access_present";
        await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
          `Agent dry-run queue rejected: diagnostic agent holds a non-exact tool grant ` +
          `(connection=${str(grant.connection_id) === str(diagTool.id) ? "diagnostic" : "unrelated"}, access_level=${str(grant.access_level)}). No agent dry-run queued.`);
        return json({
          error: detail === "tool_access_scope_invalid"
            ? "Diagnostic agent has an active grant to an unrelated tool."
            : "Diagnostic agent has a non-read tool grant (executing or broader than exact read).",
          detail,
        }, 409);
      }
    }

    const now = new Date();
    const probeKey = uid("ADP");
    const correlationId = uid("COR");

    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      probe_id: AGENT_DRY_RUN_PROBE_ID,
      probe_mode: AGENT_DRY_RUN_PROBE_MODE,
      diagnostic_agent_key: AGENT_DRY_RUN_AGENT_KEY,
      resolved_model_reference: AGENT_DRY_RUN_MODEL,
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: AGENT_DRY_RUN_PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "agent_dry_run_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "agent_dry_run_probe_queued", "success", "low", actor,
      `Agent dry-run probe ${probeKey} queued for node ${node.node_key} ` +
      `(probe_id=${AGENT_DRY_RUN_PROBE_ID}, agent=${AGENT_DRY_RUN_AGENT_KEY}, model=${AGENT_DRY_RUN_MODEL}). ` +
      `Controlled agent→model dry-run only — no agent, tool, model or business workflow executed.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_agent_dry_run_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      probeId: AGENT_DRY_RUN_PROBE_ID,
      probeMode: AGENT_DRY_RUN_PROBE_MODE,
      diagnosticAgentKey: AGENT_DRY_RUN_AGENT_KEY,
      resolvedModelReference: AGENT_DRY_RUN_MODEL,
      status: "pending",
      executionEnabled: false,
      message: "Agent dry-run probe queued (fixed registered agent → model dry-run only — no agent, tool, model or business workflow executed).",
    });
  }

  // ===========================================================================
  // GET_AGENT_DRY_RUN_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_agent_dry_run_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", AGENT_DRY_RUN_PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_agent_dry_run_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const resRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", AGENT_DRY_RUN_PROBE_RESULT_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const res = resRows.data && resRows.data.length > 0 ? resRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const resPayload = res ? ((res.safe_payload as Record<string, unknown>) ?? {}) : {};
      const queuedAt = str(p.created_at);
      const resultAt = res ? (str(res.acknowledged_at) || str(res.created_at)) : null;

      let roundTripMs: number | null = null;
      if (queuedAt && resultAt) {
        const delta = new Date(resultAt).getTime() - new Date(queuedAt).getTime();
        if (Number.isFinite(delta)) roundTripMs = Math.max(0, delta);
      }

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        resultAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        probeId: str(payload.probe_id),
        probeMode: str(payload.probe_mode),
        diagnosticAgentKey: str(payload.diagnostic_agent_key) || AGENT_DRY_RUN_AGENT_KEY,
        resolvedModelReference: str(payload.resolved_model_reference) || AGENT_DRY_RUN_MODEL,
        hasResult: res ? true : false,
        resultStatus: res ? (str(resPayload.status) || str(res.status)) : null,
        safeOutput: res ? (str(resPayload.safe_output) || null) : null,
        verified: res ? (resPayload.verified === true) : false,
        errorCategory: res ? (str(resPayload.error_category) || null) : null,
        latencyMs: res ? (resPayload.latency_ms ?? null) : null,
        roundTripMs,
      };
    }));

    const verified = results.some((r) => r.verified === true);

    return json({
      operation: "get_agent_dry_run_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "Registered agent dry-run verified — the diagnostic agent resolved its approved local model and returned the expected sandbox result. No agent, tool or business workflow was executed."
        : "Registered agent dry-run probe status read (controlled agent → model dry-run only — no agent, tool, model or business workflow executed).",
    });
  }

  // ===========================================================================
  // RUN_TOOL_ACCESS_DENIAL_PROBE — owner/admin only. CLOUD-SIDE ONLY.
  // ===========================================================================
  if (operation === "run_tool_access_denial_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to run a tool access denial probe." }, 403);

    const probeKey = uid("TAP");
    const correlationId = uid("COR");

    await recordDenialProbeEvent(admin, {
      eventType: "tool_access_denial_probe_started",
      outcome: "started",
      severity: "low",
      actor,
      correlationId,
      agentId: null,
      decision: null,
      reason: null,
      permissionState: null,
      probeKey,
    });

    const agent = await resolveDiagnosticAgent(admin);
    if (!agent) {
      await recordDenialProbeEvent(admin, {
        eventType: "tool_access_denial_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: null,
        decision: "failed",
        reason: "agent_not_registered",
        permissionState: null,
        probeKey,
      });
      return json({ error: "Diagnostic agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }

    const tool = await resolveDiagnosticTool(admin);
    if (!tool) {
      await recordDenialProbeEvent(admin, {
        eventType: "tool_access_denial_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: tool ? (agent.id as string) : null,
        decision: "failed",
        reason: "diagnostic_tool_missing",
        permissionState: null,
        probeKey,
      });
      return json({ error: "Diagnostic tool is not registered.", detail: "diagnostic_tool_missing" }, 409);
    }

    if (str(tool.credential_reference) || str(tool.endpoint_reference)) {
      await recordDenialProbeEvent(admin, {
        eventType: "tool_access_denial_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "failed",
        reason: "tool_has_executable_config",
        permissionState: null,
        probeKey,
      });
      return json({ error: "Diagnostic tool unexpectedly has an executable configuration.", detail: "tool_has_executable_config" }, 409);
    }

    const access = await resolveDiagnosticToolAccess(admin, agent.id as string, tool.id as string);
    if (access) {
      await recordDenialProbeEvent(admin, {
        eventType: "tool_access_denial_probe_blocked",
        outcome: "blocked",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "blocked",
        reason: "unexpected_tool_permission_present",
        permissionState: "present",
        probeKey,
      });
      return json({
        error: "Unexpected active tool permission present for the diagnostic agent and diagnostic tool.",
        detail: "unexpected_tool_permission_present",
        probeKey,
        correlationId,
        probeId: TOOL_ACCESS_DENIAL_PROBE_ID,
        agentKey: TOOL_ACCESS_DENIAL_AGENT_KEY,
        toolKey: TOOL_ACCESS_DENIAL_TOOL_KEY,
        allowed: false,
        decision: "blocked",
        reason: "unexpected_tool_permission_present",
        permissionState: "present",
        status: "blocked",
        executionEnabled: false,
      }, 409);
    }

    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await recordDenialProbeEvent(admin, {
        eventType: "tool_access_denial_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "failed",
        reason: "kill_switch_state_invalid",
        permissionState: null,
        probeKey,
      });
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    await recordDenialProbeEvent(admin, {
      eventType: "tool_access_denial_probe_verified",
      outcome: "success",
      severity: "low",
      actor,
      correlationId,
      agentId: agent.id as string,
      decision: "denied",
      reason: "tool_permission_missing",
      permissionState: "none",
      probeKey,
    });

    return json({
      accepted: true,
      operation: "run_tool_access_denial_probe",
      probeKey,
      correlationId,
      probeId: TOOL_ACCESS_DENIAL_PROBE_ID,
      probeMode: TOOL_ACCESS_DENIAL_PROBE_MODE,
      agentKey: TOOL_ACCESS_DENIAL_AGENT_KEY,
      toolKey: TOOL_ACCESS_DENIAL_TOOL_KEY,
      allowed: false,
      decision: "denied",
      reason: "tool_permission_missing",
      permissionState: "none",
      status: "verified",
      executionEnabled: false,
      message: "Tool access denial verified — no explicit tool permission exists, so tool execution is denied. No tool or runtime action was executed.",
    });
  }

  // ===========================================================================
  // GET_TOOL_ACCESS_DENIAL_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_tool_access_denial_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_audit_events")
      .select("audit_key, occurred_at, event_type, outcome, agent_id, correlation_id, decision_reason, notes")
      .in("event_type", [
        "tool_access_denial_probe_verified",
        "tool_access_denial_probe_failed",
        "tool_access_denial_probe_blocked",
      ]);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("occurred_at", { ascending: false }).limit(5);

    const { data: eventRows } = await query;
    if (!eventRows || eventRows.length === 0) {
      return json({ operation: "get_tool_access_denial_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes = eventRows.map((e) => {
      let parsed: Record<string, unknown> = {};
      try { parsed = e.notes ? JSON.parse(String(e.notes)) : {}; } catch { parsed = {}; }
      return {
        probeKey: str(parsed.probe_key),
        correlationId: str(e.correlation_id),
        probeId: str(parsed.probe_id) || TOOL_ACCESS_DENIAL_PROBE_ID,
        agentKey: str(parsed.agent_key) || TOOL_ACCESS_DENIAL_AGENT_KEY,
        toolKey: str(parsed.tool_key) || TOOL_ACCESS_DENIAL_TOOL_KEY,
        decision: str(parsed.decision) || str(e.outcome),
        reason: str(parsed.reason) || str(e.decision_reason),
        allowed: false,
        permissionState: str(parsed.permission_state) || null,
        outcome: str(e.outcome),
        occurredAt: str(e.occurred_at),
        agentId: e.agent_id ?? null,
      };
    });

    const verified = probes.some((p) => p.outcome === "success" && p.decision === "denied");

    return json({
      operation: "get_tool_access_denial_probe_status",
      found: true,
      verified,
      probes,
      executionEnabled: false,
      message: verified
        ? "Tool access denial verified — the diagnostic agent was denied access to the diagnostic tool because no explicit tool permission exists. No tool or runtime action was executed."
        : "Tool access denial probe status read (no tool or runtime action was executed).",
    });
  }

  // ===========================================================================
  // RUN_TOOL_ACCESS_GRANT_PROBE — owner/admin only. CLOUD-SIDE ONLY.
  // ===========================================================================
  if (operation === "run_tool_access_grant_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to run a tool access grant probe." }, 403);

    const probeKey = uid("TGP");
    const correlationId = uid("COR");

    await recordGrantProbeEvent(admin, {
      eventType: "tool_access_grant_probe_started",
      outcome: "started",
      severity: "low",
      actor,
      correlationId,
      agentId: null,
      decision: null,
      reason: null,
      permissionState: null,
      permissionType: null,
      scopeIsolated: null,
      probeKey,
    });

    const agent = await resolveDiagnosticAgent(admin);
    if (!agent) {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: null,
        decision: "failed",
        reason: "agent_not_registered",
        permissionState: null,
        permissionType: null,
        scopeIsolated: null,
        probeKey,
      });
      return json({ error: "Diagnostic agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }

    const tool = await resolveDiagnosticTool(admin);
    if (!tool) {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "failed",
        reason: "diagnostic_tool_missing",
        permissionState: null,
        permissionType: null,
        scopeIsolated: null,
        probeKey,
      });
      return json({ error: "Diagnostic tool is not registered.", detail: "diagnostic_tool_missing" }, 409);
    }

    if (str(tool.credential_reference) || str(tool.endpoint_reference)) {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "failed",
        reason: "tool_has_executable_config",
        permissionState: null,
        permissionType: null,
        scopeIsolated: null,
        probeKey,
      });
      return json({ error: "Diagnostic tool unexpectedly has an executable configuration.", detail: "tool_has_executable_config" }, 409);
    }

    const grants = await resolveDiagnosticToolAccessDetail(admin, agent.id as string, tool.id as string);
    if (grants.length !== 1) {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "failed",
        reason: grants.length === 0 ? "explicit_grant_missing" : "multiple_grants_present",
        permissionState: grants.length === 0 ? "none" : "multiple",
        permissionType: null,
        scopeIsolated: null,
        probeKey,
      });
      return json({
        error: "Exactly one active explicit permission is required for the diagnostic agent and diagnostic tool.",
        detail: grants.length === 0 ? "explicit_grant_missing" : "multiple_grants_present",
      }, 409);
    }

    const grant = grants[0];
    const accessLevel = str(grant.access_level);

    if (accessLevel !== "read") {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_blocked",
        outcome: "blocked",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "blocked",
        reason: "permission_too_broad",
        permissionState: "explicit_grant",
        permissionType: accessLevel,
        scopeIsolated: null,
        probeKey,
      });
      return json({
        error: "The diagnostic tool permission is not exact read-only (read).",
        detail: "permission_too_broad",
        probeKey,
        correlationId,
        probeId: TOOL_ACCESS_GRANT_PROBE_ID,
        agentKey: TOOL_ACCESS_GRANT_AGENT_KEY,
        toolKey: TOOL_ACCESS_GRANT_TOOL_KEY,
        permissionType: accessLevel,
        permissionState: "explicit_grant",
        decision: "blocked",
        reason: "permission_too_broad",
        scopeIsolated: false,
        toolExecuted: false,
        status: "blocked",
        executionEnabled: false,
      }, 409);
    }

    const allGrants = await resolveAgentActiveGrants(admin, agent.id as string);
    const unrelatedGrants = allGrants.filter((g) => g.connection_id !== tool.id);
    if (unrelatedGrants.length > 0) {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_blocked",
        outcome: "blocked",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "blocked",
        reason: "permission_scope_too_broad",
        permissionState: "explicit_grant",
        permissionType: accessLevel,
        scopeIsolated: false,
        probeKey,
      });
      return json({
        error: "The diagnostic agent has unrelated active tool grants — permission scope is not isolated to the diagnostic tool.",
        detail: "permission_scope_too_broad",
        probeKey,
        correlationId,
        probeId: TOOL_ACCESS_GRANT_PROBE_ID,
        agentKey: TOOL_ACCESS_GRANT_AGENT_KEY,
        toolKey: TOOL_ACCESS_GRANT_TOOL_KEY,
        permissionType: accessLevel,
        permissionState: "explicit_grant",
        decision: "blocked",
        reason: "permission_scope_too_broad",
        scopeIsolated: false,
        toolExecuted: false,
        status: "blocked",
        executionEnabled: false,
      }, 409);
    }

    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await recordGrantProbeEvent(admin, {
        eventType: "tool_access_grant_probe_failed",
        outcome: "failed",
        severity: "high",
        actor,
        correlationId,
        agentId: agent.id as string,
        decision: "failed",
        reason: "kill_switch_state_invalid",
        permissionState: "explicit_grant",
        permissionType: accessLevel,
        scopeIsolated: true,
        probeKey,
      });
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    await recordGrantProbeEvent(admin, {
      eventType: "tool_access_grant_probe_verified",
      outcome: "success",
      severity: "low",
      actor,
      correlationId,
      agentId: agent.id as string,
      decision: "authorized",
      reason: "explicit_tool_permission_present",
      permissionState: "explicit_grant",
      permissionType: accessLevel,
      scopeIsolated: true,
      probeKey,
    });

    return json({
      accepted: true,
      operation: "run_tool_access_grant_probe",
      probeKey,
      correlationId,
      probeId: TOOL_ACCESS_GRANT_PROBE_ID,
      probeMode: TOOL_ACCESS_GRANT_PROBE_MODE,
      agentKey: TOOL_ACCESS_GRANT_AGENT_KEY,
      toolKey: TOOL_ACCESS_GRANT_TOOL_KEY,
      permissionType: accessLevel,
      permissionState: "explicit_grant",
      decision: "authorized",
      reason: "explicit_tool_permission_present",
      scopeIsolated: true,
      toolExecuted: false,
      status: "verified",
      executionEnabled: false,
      message: "Explicit tool permission verified — one isolated read-only grant exists for the diagnostic agent and diagnostic tool only. No tool or runtime action was executed.",
    });
  }

  // ===========================================================================
  // GET_TOOL_ACCESS_GRANT_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_tool_access_grant_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_audit_events")
      .select("audit_key, occurred_at, event_type, outcome, agent_id, correlation_id, decision_reason, notes")
      .in("event_type", [
        "tool_access_grant_probe_verified",
        "tool_access_grant_probe_failed",
        "tool_access_grant_probe_blocked",
      ]);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("occurred_at", { ascending: false }).limit(5);

    const { data: eventRows } = await query;
    if (!eventRows || eventRows.length === 0) {
      return json({ operation: "get_tool_access_grant_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes = eventRows.map((e) => {
      let parsed: Record<string, unknown> = {};
      try { parsed = e.notes ? JSON.parse(String(e.notes)) : {}; } catch { parsed = {}; }
      return {
        probeKey: str(parsed.probe_key),
        correlationId: str(e.correlation_id),
        probeId: str(parsed.probe_id) || TOOL_ACCESS_GRANT_PROBE_ID,
        agentKey: str(parsed.agent_key) || TOOL_ACCESS_GRANT_AGENT_KEY,
        toolKey: str(parsed.tool_key) || TOOL_ACCESS_GRANT_TOOL_KEY,
        decision: str(parsed.decision) || str(e.outcome),
        reason: str(parsed.reason) || str(e.decision_reason),
        permissionState: str(parsed.permission_state) || null,
        permissionType: str(parsed.permission_type) || null,
        scopeIsolated: parsed.scope_isolated === true,
        toolExecuted: parsed.tool_executed === true,
        outcome: str(e.outcome),
        occurredAt: str(e.occurred_at),
        agentId: e.agent_id ?? null,
      };
    });

    const verified = probes.some((p) => p.outcome === "success" && p.decision === "authorized" && p.scopeIsolated === true);

    return json({
      operation: "get_tool_access_grant_probe_status",
      found: true,
      verified,
      probes,
      executionEnabled: false,
      message: verified
        ? "Explicit tool permission verified — one isolated read-only grant exists for the diagnostic agent and diagnostic tool only. No tool or runtime action was executed."
        : "Tool access grant probe status read (no tool or runtime action was executed).",
    });
  }

  // ===========================================================================
  // QUEUE_READONLY_TOOL_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_readonly_tool_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue a read-only tool probe." }, 403);

    if (await emergencyFreezeEngaged(admin, actor, null)) {
      return emergencyFreezeBlockedResponse("queue_readonly_tool_probe");
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const agent = await resolveReadonlyToolAgent(admin);
    if (!agent) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: dedicated agent ${READONLY_TOOL_PROBE_AGENT_KEY} not registered/active.`);
      return json({ error: "Dedicated read-only tool agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }
    if (str(agent.autonomy_level) !== "none") {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: dedicated agent ${READONLY_TOOL_PROBE_AGENT_KEY} autonomy is not none.`);
      return json({ error: "Dedicated read-only tool agent autonomy is not none.", detail: "agent_autonomy_invalid" }, 409);
    }

    const tool = await resolveReadonlyTool(admin);
    if (!tool) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: callable tool ${READONLY_TOOL_PROBE_TOOL_KEY} not registered.`);
      return json({ error: "Callable read-only tool is not registered.", detail: "tool_missing" }, 409);
    }
    if (str(tool.credential_reference) || str(tool.endpoint_reference)) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: callable tool ${READONLY_TOOL_PROBE_TOOL_KEY} unexpectedly has a credential/endpoint.`);
      return json({ error: "Callable tool unexpectedly has an executable credential/endpoint configuration.", detail: "tool_not_safe" }, 409);
    }

    const { data: agentGrantRows } = await admin
      .from("ai_tool_agent_access")
      .select("id, connection_id, access_level")
      .eq("agent_id", agent.id as string)
      .eq("is_active", true);
    const agentGrants = agentGrantRows ?? [];

    if (agentGrants.length !== 1) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: dedicated agent holds ${agentGrants.length} active tool grant(s) (expected exactly one).`);
      return json({ error: "Dedicated agent must hold exactly one active tool grant.", detail: "tool_access_scope_invalid" }, 409);
    }

    const grant = agentGrants[0];
    if (grant.connection_id !== tool.id || str(grant.access_level) !== READONLY_TOOL_PROBE_PERMISSION) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: dedicated agent grant is not the exact isolated execute grant for the callable tool ` +
        `(connection=${str(grant.connection_id) === str(tool.id) ? "callable" : "unrelated"}, access_level=${str(grant.access_level)}).`);
      return json({ error: "Dedicated agent grant is not the exact isolated execute permission for the callable tool.", detail: "tool_access_scope_invalid" }, 409);
    }

    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high", actor,
        `Read-only tool probe queue rejected: master kill switch not in required ON / execution-blocked state.`);
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    const now = new Date();
    const probeKey = uid("RTP");
    const correlationId = uid("COR");

    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      probe_id: READONLY_TOOL_PROBE_ID,
      probe_mode: READONLY_TOOL_PROBE_MODE,
      agent_key: READONLY_TOOL_PROBE_AGENT_KEY,
      tool_key: READONLY_TOOL_PROBE_TOOL_KEY,
      tool_operation: READONLY_TOOL_PROBE_TOOL_OPERATION,
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: READONLY_TOOL_PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "readonly_tool_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "readonly_tool_probe_queued", "success", "low", actor,
      `Read-only tool probe ${probeKey} queued for node ${node.node_key} ` +
      `(probe_id=${READONLY_TOOL_PROBE_ID}, agent=${READONLY_TOOL_PROBE_AGENT_KEY}, tool=${READONLY_TOOL_PROBE_TOOL_KEY}, operation=${READONLY_TOOL_PROBE_TOOL_OPERATION}). ` +
      `Fixed read-only local health snapshot only — no business data, no mutation.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_readonly_tool_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      probeId: READONLY_TOOL_PROBE_ID,
      probeMode: READONLY_TOOL_PROBE_MODE,
      agentKey: READONLY_TOOL_PROBE_AGENT_KEY,
      toolKey: READONLY_TOOL_PROBE_TOOL_KEY,
      toolOperation: READONLY_TOOL_PROBE_TOOL_OPERATION,
      permission: READONLY_TOOL_PROBE_PERMISSION,
      status: "pending",
      executionEnabled: false,
      message: "Read-only tool probe queued (fixed local runtime health read only — no business data, no mutation, no arbitrary HTTP).",
    });
  }

  // ===========================================================================
  // GET_READONLY_TOOL_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_readonly_tool_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", READONLY_TOOL_PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_readonly_tool_probe_status", found: false, probes: [], executionEnabled: false });
    }

    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const resRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", READONLY_TOOL_PROBE_RESULT_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const res = resRows.data && resRows.data.length > 0 ? resRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const resPayload = res ? ((res.safe_payload as Record<string, unknown>) ?? {}) : {};
      const queuedAt = str(p.created_at);
      const resultAt = res ? (str(res.acknowledged_at) || str(res.created_at)) : null;

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        resultAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        probeId: str(payload.probe_id),
        probeMode: str(payload.probe_mode),
        agentKey: str(payload.agent_key),
        toolKey: str(payload.tool_key),
        toolOperation: str(payload.tool_operation),
        hasResult: res ? true : false,
        resultStatus: res ? (str(resPayload.status) || str(res.status)) : null,
        verified: res ? (resPayload.verified === true) : false,
        n8nStatus: res ? (str(resPayload.n8n_status) || null) : null,
        ollamaStatus: res ? (str(resPayload.ollama_status) || null) : null,
        ollamaModelCount: res ? (resPayload.ollama_model_count ?? null) : null,
        latencyMs: res ? (resPayload.latency_ms ?? null) : null,
        errorCategory: res ? (str(resPayload.error_category) || null) : null,
        signedResult: res ? true : false,
        toolMutation: "NONE",
        businessData: "NONE",
      };
    }));

    const verified = results.some((r) => r.verified === true);

    return json({
      operation: "get_readonly_tool_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "Read-only tool verified — the dedicated agent executed the fixed local runtime health read through HAL. No business data, no mutation."
        : "Read-only tool probe status read (no business data, no mutation).",
    });
  }

  // ===========================================================================
  // QUEUE_DIAGNOSTIC_RUN — owner/admin only.
  // ===========================================================================
  if (operation === "queue_diagnostic_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue a diagnostic run." }, 403);

    if (await emergencyFreezeEngaged(admin, actor, null)) {
      return emergencyFreezeBlockedResponse("queue_diagnostic_run");
    }

    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: master kill switch not in required ON / execution-blocked state.`);
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const agent = await resolveReadonlyToolAgent(admin);
    if (!agent) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: dedicated agent ${DIAGNOSTIC_RUN_AGENT_KEY} not registered/active.`);
      return json({ error: "Dedicated diagnostic agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }
    if (str(agent.autonomy_level) !== "none") {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: dedicated agent autonomy is not none.`);
      return json({ error: "Dedicated diagnostic agent autonomy is not none.", detail: "agent_autonomy_invalid" }, 409);
    }

    const tool = await resolveReadonlyTool(admin);
    if (!tool) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: callable tool ${DIAGNOSTIC_RUN_TOOL_KEY} not registered.`);
      return json({ error: "Callable diagnostic tool is not registered.", detail: "tool_missing" }, 409);
    }
    if (str(tool.credential_reference) || str(tool.endpoint_reference)) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: callable tool unexpectedly has a credential/endpoint.`);
      return json({ error: "Callable diagnostic tool unexpectedly has an executable configuration.", detail: "tool_not_safe" }, 409);
    }

    const { data: agentGrantRows } = await admin
      .from("ai_tool_agent_access")
      .select("id, connection_id, access_level")
      .eq("agent_id", agent.id as string)
      .eq("is_active", true);
    const agentGrants = agentGrantRows ?? [];

    if (agentGrants.length !== 1) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: dedicated agent holds ${agentGrants.length} active tool grant(s) (expected exactly one).`);
      return json({ error: "Dedicated agent must hold exactly one active tool grant.", detail: "tool_access_scope_invalid" }, 409);
    }

    const grant = agentGrants[0];
    if (grant.connection_id !== tool.id || str(grant.access_level) !== DIAGNOSTIC_RUN_PERMISSION) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: dedicated agent grant is not the exact isolated execute grant for the callable tool ` +
        `(connection=${str(grant.connection_id) === str(tool.id) ? "callable" : "unrelated"}, access_level=${str(grant.access_level)}).`);
      return json({ error: "Dedicated agent grant is not the exact isolated execute permission for the callable tool.", detail: "tool_access_scope_invalid" }, 409);
    }

    const { data: activeRuns } = await admin
      .from("ai_runs")
      .select("id, run_key")
      .like("run_key", `${DIAGNOSTIC_RUN_KEY_PREFIX}%`)
      .in("status", ["queued", "working", "waiting"]);
    if (activeRuns && activeRuns.length > 0) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: another diagnostic run of this type is already queued/working (${activeRuns.map((r) => r.run_key).join(", ")}).`);
      return json({ error: "Another diagnostic run of this exact type is already in progress.", detail: "diagnostic_run_in_progress" }, 409);
    }

    const now = new Date();
    const correlationId = uid("COR");
    const runKey = `${DIAGNOSTIC_RUN_KEY_PREFIX}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const taskKey = `${DIAGNOSTIC_RUN_TASK_KEY_PREFIX}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const probeKey = uid("DRP");

    const taskInsert = {
      task_key: taskKey,
      name: DIAGNOSTIC_RUN_TASK_NAME,
      description: "Sandbox AI Operations run that executes the approved fixed read-only runtime health tool and stores the verified result.",
      task_type: DIAGNOSTIC_RUN_TASK_TYPE,
      site_id: null,
      requested_by: actor,
      trigger_source: "manual",
      priority: "low",
      risk_level: "low",
      environment: "sandbox",
      status: "requested",
      approval_required: false,
      verification_required: true,
      uat_required: false,
      audit_required: true,
      notes: JSON.stringify({
        probe_id: DIAGNOSTIC_RUN_PROBE_ID,
        tool_key: DIAGNOSTIC_RUN_TOOL_KEY,
        tool_operation: DIAGNOSTIC_RUN_TOOL_OPERATION,
      }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const taskIns = await admin.from("ai_tasks").insert(taskInsert).select("id");
    if (taskIns.error || !taskIns.data || taskIns.data.length === 0) {
      await auditEvent(admin, "diagnostic_run_failed", "failed", "high", actor,
        `Diagnostic run queue failed: could not create the diagnostic task record.`);
      return json({ error: "Failed to create the diagnostic task record.", detail: "task_create_failed" }, 500);
    }
    const taskId = taskIns.data[0].id as string;

    const runInsert = {
      run_key: runKey,
      task_id: taskId,
      parent_run_id: null,
      root_run_id: null,
      correlation_id: correlationId,
      site_id: null,
      agent_id: agent.id,
      status: "queued",
      priority: "low",
      risk_level: "low",
      environment: "sandbox",
      queue_position: null,
      current_step: 0,
      total_steps: DIAGNOSTIC_RUN_STEPS.length,
      attempts: 1,
      max_attempts: 1,
      retry_count: 0,
      started_at: now.toISOString(),
      completed_at: null,
      approval_required: false,
      verification_required: true,
      uat_required: false,
      audit_required: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const runIns = await admin.from("ai_runs").insert(runInsert).select("id");
    if (runIns.error || !runIns.data || runIns.data.length === 0) {
      await auditEvent(admin, "diagnostic_run_failed", "failed", "high", actor,
        `Diagnostic run queue failed: could not create the diagnostic run record (task=${taskId}).`);
      return json({ error: "Failed to create the diagnostic run record.", detail: "run_create_failed" }, 500);
    }
    const runId = runIns.data[0].id as string;

    const stepRows = DIAGNOSTIC_RUN_STEPS.map((name, idx) => ({
      run_id: runId,
      step_number: idx + 1,
      name,
      agent_id: agent.id,
      status: idx < 4 ? "completed" : "pending",
      risk_level: "low",
      approval_required: false,
      started_at: idx < 4 ? now.toISOString() : null,
      completed_at: idx < 4 ? now.toISOString() : null,
      created_at: now.toISOString(),
    }));
    const stepIns = await admin.from("ai_run_steps").insert(stepRows);
    if (stepIns.error) {
      await auditEvent(admin, "diagnostic_run_failed", "failed", "high", actor,
        `Diagnostic run queue failed: could not create run steps (run=${runKey}).`);
      return json({ error: "Failed to create the diagnostic run steps.", detail: "steps_create_failed" }, 500);
    }

    await admin.from("ai_runs").update({
      current_step: 4,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);

    const safePayload = {
      probe_key: probeKey,
      probe_id: DIAGNOSTIC_RUN_PROBE_ID,
      correlation_id: correlationId,
      task_reference: taskKey,
      run_reference: runKey,
      expected_node_key: node.node_key,
      agent_key: DIAGNOSTIC_RUN_AGENT_KEY,
      tool_key: DIAGNOSTIC_RUN_TOOL_KEY,
      tool_operation: DIAGNOSTIC_RUN_TOOL_OPERATION,
      probe_mode: DIAGNOSTIC_RUN_PROBE_MODE,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "diagnostic_run_tool_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "diagnostic_run_queued", "success", "low", actor,
      `Diagnostic run ${runKey} queued (task=${taskKey}, agent=${DIAGNOSTIC_RUN_AGENT_KEY}, tool=${DIAGNOSTIC_RUN_TOOL_KEY}, operation=${DIAGNOSTIC_RUN_TOOL_OPERATION}). Sandbox diagnostic only — no business data, no mutation.`,
      correlationId);

    await auditEvent(admin, "diagnostic_run_started", "success", "low", actor,
      `Diagnostic run ${runKey} started (${DIAGNOSTIC_RUN_STEPS.length} deterministic steps created, fixed read-only tool dispatched). Sandbox diagnostic only.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_diagnostic_run",
      taskKey,
      runKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      probeId: DIAGNOSTIC_RUN_PROBE_ID,
      probeMode: DIAGNOSTIC_RUN_PROBE_MODE,
      agentKey: DIAGNOSTIC_RUN_AGENT_KEY,
      toolKey: DIAGNOSTIC_RUN_TOOL_KEY,
      toolOperation: DIAGNOSTIC_RUN_TOOL_OPERATION,
      permission: DIAGNOSTIC_RUN_PERMISSION,
      status: "queued",
      totalSteps: DIAGNOSTIC_RUN_STEPS.length,
      executionEnabled: false,
      message: "Diagnostic run queued (fixed read-only runtime health tool through HAL — sandbox diagnostic only).",
    });
  }

  // ===========================================================================
  // GET_DIAGNOSTIC_RUN_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_diagnostic_run_status") {
    const { data: taskRows } = await admin
      .from("ai_tasks")
      .select("id, task_key, name, task_type, status, environment, risk_level, created_at")
      .eq("task_type", DIAGNOSTIC_RUN_TASK_TYPE)
      .like("task_key", `${DIAGNOSTIC_RUN_TASK_KEY_PREFIX}-%`)
      .order("created_at", { ascending: false })
      .limit(1);
    const task = taskRows && taskRows.length > 0 ? taskRows[0] : null;

    if (!task) {
      return json({ operation: "get_diagnostic_run_status", found: false, task: null, run: null, steps: [], signedResult: null, executionEnabled: false });
    }

    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id, run_key, status, current_step, total_steps, correlation_id, started_at, completed_at, error_summary, result_summary, created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;

    if (!run) {
      return json({
        operation: "get_diagnostic_run_status",
        found: true,
        task: {
          taskKey: str(task.task_key),
          name: str(task.name),
          taskType: str(task.task_type),
          status: str(task.status),
          environment: str(task.environment),
          riskLevel: str(task.risk_level),
        },
        run: null,
        steps: [],
        signedResult: null,
        executionEnabled: false,
      });
    }

    const { data: stepRows } = await admin
      .from("ai_run_steps")
      .select("step_number, name, status, completed_at, error_summary")
      .eq("run_id", run.id)
      .order("step_number", { ascending: true });
    const steps = (stepRows ?? []).map((s) => ({
      stepNumber: s.step_number,
      name: s.name,
      status: s.status,
      completedAt: s.completed_at ?? null,
    }));

    const corr = str(run.correlation_id);
    let signedResult = null;
    if (corr) {
      const { data: resRows } = await admin
        .from("ai_runtime_bridge_messages")
        .select("status, safe_payload, acknowledged_at, created_at")
        .eq("direction", "inbound")
        .eq("message_type", DIAGNOSTIC_RUN_RESULT_MESSAGE_TYPE)
        .eq("correlation_id", corr)
        .order("created_at", { ascending: false })
        .limit(1);
      const res = resRows && resRows.length > 0 ? resRows[0] : null;
      if (res) {
        const rp = (res.safe_payload as Record<string, unknown>) ?? {};
        signedResult = {
          verified: rp.verified === true,
          n8nStatus: str(rp.n8n_status) || null,
          ollamaStatus: str(rp.ollama_status) || null,
          ollamaModelCount: rp.ollama_model_count ?? null,
          latencyMs: rp.latency_ms ?? null,
          completedAt: str(res.acknowledged_at) || str(res.created_at),
        };
      }
    }

    return json({
      operation: "get_diagnostic_run_status",
      found: true,
      task: {
        taskKey: str(task.task_key),
        name: str(task.name),
        taskType: str(task.task_type),
        status: str(task.status),
        environment: str(task.environment),
        riskLevel: str(task.risk_level),
      },
      run: {
        runKey: str(run.run_key),
        status: str(run.status),
        currentStep: run.current_step ?? 0,
        totalSteps: run.total_steps ?? DIAGNOSTIC_RUN_STEPS.length,
        correlationId: str(run.correlation_id),
        startedAt: str(run.started_at),
        completedAt: str(run.completed_at),
        errorSummary: str(run.error_summary) || null,
        resultSummary: str(run.result_summary) || null,
      },
      steps,
      signedResult,
      agentKey: DIAGNOSTIC_RUN_AGENT_KEY,
      toolKey: DIAGNOSTIC_RUN_TOOL_KEY,
      toolOperation: DIAGNOSTIC_RUN_TOOL_OPERATION,
      permission: DIAGNOSTIC_RUN_PERMISSION,
      probeId: DIAGNOSTIC_RUN_PROBE_ID,
      probeMode: DIAGNOSTIC_RUN_PROBE_MODE,
      executionEnabled: false,
      businessData: "NONE",
      mutation: "NONE",
      message: "Diagnostic run status read (sandbox diagnostic only — no business data, no mutation).",
    });
  }

  // ===========================================================================
  // CREATE_APPROVAL_GATED_RUN — owner/admin only.
  // ===========================================================================
  if (operation === "create_approval_gated_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to create an approval-gated run." }, 403);

    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: master kill switch not in required ON / execution-blocked state.`);
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const agent = await resolveReadonlyToolAgent(admin);
    if (!agent) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: dedicated agent ${APPROVAL_GATED_AGENT_KEY} not registered/active.`);
      return json({ error: "Dedicated diagnostic agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }
    if (str(agent.autonomy_level) !== "none") {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: dedicated agent autonomy is not none.`);
      return json({ error: "Dedicated diagnostic agent autonomy is not none.", detail: "agent_autonomy_invalid" }, 409);
    }

    const tool = await resolveReadonlyTool(admin);
    if (!tool) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: callable tool ${APPROVAL_GATED_TOOL_KEY} not registered.`);
      return json({ error: "Callable diagnostic tool is not registered.", detail: "tool_missing" }, 409);
    }
    if (str(tool.credential_reference) || str(tool.endpoint_reference)) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: callable tool unexpectedly has a credential/endpoint.`);
      return json({ error: "Callable diagnostic tool unexpectedly has an executable configuration.", detail: "tool_not_safe" }, 409);
    }

    const { data: agentGrantRows } = await admin
      .from("ai_tool_agent_access")
      .select("id, connection_id, access_level")
      .eq("agent_id", agent.id as string)
      .eq("is_active", true);
    const agentGrants = agentGrantRows ?? [];

    if (agentGrants.length !== 1) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: dedicated agent holds ${agentGrants.length} active tool grant(s) (expected exactly one).`);
      return json({ error: "Dedicated agent must hold exactly one active tool grant.", detail: "tool_access_scope_invalid" }, 409);
    }

    const grant = agentGrants[0];
    if (grant.connection_id !== tool.id || str(grant.access_level) !== APPROVAL_GATED_PERMISSION) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated run create rejected: dedicated agent grant is not the exact isolated execute grant for the callable tool ` +
        `(connection=${str(grant.connection_id) === str(tool.id) ? "callable" : "unrelated"}, access_level=${str(grant.access_level)}).`);
      return json({ error: "Dedicated agent grant is not the exact isolated execute permission for the callable tool.", detail: "tool_access_scope_invalid" }, 409);
    }

    const now = new Date();
    const correlationId = uid("COR");
    const runKey = `${APPROVAL_GATED_RUN_KEY_PREFIX}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const taskKey = `${APPROVAL_GATED_TASK_KEY_PREFIX}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const approvalKey = `${APPROVAL_GATED_APPROVAL_KEY_PREFIX}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const approvalContext = buildApprovalContext({
      agentId: str(agent.id),
      toolId: str(tool.id),
      grantId: str(grant.id),
    });
    const approvalContextHash = await computeApprovalContextHash(approvalContext);
    const approvalContextConditions = {
      approval_context_version: APPROVAL_CONTEXT_VERSION,
      approval_context_hash: approvalContextHash,
      probe_id: APPROVAL_GATED_PROBE_ID,
      agent_key: APPROVAL_GATED_AGENT_KEY,
      tool_key: APPROVAL_GATED_TOOL_KEY,
      tool_operation: APPROVAL_GATED_TOOL_OPERATION,
      access_level: APPROVAL_GATED_PERMISSION,
    };

    const taskInsert = {
      task_key: taskKey,
      name: APPROVAL_GATED_TASK_NAME,
      description: "Verify that a persisted AI Operations run cannot dispatch the fixed read-only HAL tool until an explicit human approval exists.",
      task_type: APPROVAL_GATED_TASK_TYPE,
      site_id: null,
      requested_by: actor,
      trigger_source: "manual",
      priority: "low",
      risk_level: "low",
      environment: "sandbox",
      status: "requested",
      approval_required: true,
      verification_required: true,
      uat_required: false,
      audit_required: true,
      notes: JSON.stringify({
        probe_id: APPROVAL_GATED_PROBE_ID,
        agent_key: APPROVAL_GATED_AGENT_KEY,
        tool_key: APPROVAL_GATED_TOOL_KEY,
        tool_operation: APPROVAL_GATED_TOOL_OPERATION,
      }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const taskIns = await admin.from("ai_tasks").insert(taskInsert).select("id");
    if (taskIns.error || !taskIns.data || taskIns.data.length === 0) {
      await auditEvent(admin, "approval_gated_run_failed", "failed", "high", actor,
        `Approval-gated run create failed: could not create the task record.`);
      return json({ error: "Failed to create the approval-gated task record.", detail: "task_create_failed" }, 500);
    }
    const taskId = taskIns.data[0].id as string;

    const runInsert = {
      run_key: runKey,
      task_id: taskId,
      parent_run_id: null,
      root_run_id: null,
      correlation_id: correlationId,
      site_id: null,
      agent_id: agent.id,
      status: "awaiting_approval",
      priority: "low",
      risk_level: "low",
      environment: "sandbox",
      queue_position: null,
      current_step: 3,
      total_steps: APPROVAL_GATED_STEPS.length,
      attempts: 1,
      max_attempts: 1,
      retry_count: 0,
      started_at: now.toISOString(),
      completed_at: null,
      approval_required: true,
      approval_id: null,
      verification_required: true,
      uat_required: false,
      audit_required: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const runIns = await admin.from("ai_runs").insert(runInsert).select("id");
    if (runIns.error || !runIns.data || runIns.data.length === 0) {
      await auditEvent(admin, "approval_gated_run_failed", "failed", "high", actor,
        `Approval-gated run create failed: could not create the run record (task=${taskKey}).`);
      return json({ error: "Failed to create the approval-gated run record.", detail: "run_create_failed" }, 500);
    }
    const runId = runIns.data[0].id as string;

    const stepRows = APPROVAL_GATED_STEPS.map((name, idx) => ({
      run_id: runId,
      step_number: idx + 1,
      name,
      agent_id: agent.id,
      status: idx < 3 ? "completed" : (idx === 3 ? "awaiting_approval" : "pending"),
      risk_level: "low",
      approval_required: idx === 3,
      started_at: idx < 3 ? now.toISOString() : null,
      completed_at: idx < 3 ? now.toISOString() : null,
      created_at: now.toISOString(),
    }));
    const stepIns = await admin.from("ai_run_steps").insert(stepRows);
    if (stepIns.error) {
      await auditEvent(admin, "approval_gated_run_failed", "failed", "high", actor,
        `Approval-gated run create failed: could not create run steps (run=${runKey}).`);
      return json({ error: "Failed to create the approval-gated run steps.", detail: "steps_create_failed" }, 500);
    }

    const approvalInsert = {
      approval_key: approvalKey,
      title: APPROVAL_GATED_TASK_NAME,
      description: "Human approval gate for the fixed read-only runtime health diagnostic tool through HAL.",
      site_id: null,
      agent_id: agent.id,
      run_id: runId,
      requested_action: "Execute the fixed read-only runtime health diagnostic tool through HAL.",
      request_type: APPROVAL_GATED_APPROVAL_TYPE,
      risk_class: "low",
      severity: "low",
      environment: "sandbox",
      status: "pending",
      requested_by: actor,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + APPROVAL_GATED_VALIDITY_MS).toISOString(),
      required_team: "Group AI Operations",
      minimum_approvers: 1,
      current_approval_count: 0,
      business_justification: "Prove that human approval is a real execution gate for the fixed read-only runtime health diagnostic.",
      reasoning_summary: "Sandbox diagnostic only — no business data, no mutation, no arbitrary tool execution.",
      expected_result: "A signed, verified read-only runtime health snapshot, gated behind explicit human approval.",
      potential_impact: "None — local read-only health endpoints only.",
      rollback_available: false,
      verification_required: true,
      uat_required: false,
      audit_required: true,
      conditions: approvalContextConditions,
      notes: JSON.stringify({
        probe_id: APPROVAL_GATED_PROBE_ID,
        agent_key: APPROVAL_GATED_AGENT_KEY,
        tool_key: APPROVAL_GATED_TOOL_KEY,
        tool_operation: APPROVAL_GATED_TOOL_OPERATION,
        approval_type: APPROVAL_GATED_APPROVAL_TYPE,
      }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const approvalIns = await admin.from("ai_approvals").insert(approvalInsert).select("id");
    if (approvalIns.error || !approvalIns.data || approvalIns.data.length === 0) {
      await auditEvent(admin, "approval_gated_run_failed", "failed", "high", actor,
        `Approval-gated run create failed: could not create the approval record (run=${runKey}).`);
      return json({ error: "Failed to create the approval record.", detail: "approval_create_failed" }, 500);
    }
    const approvalId = approvalIns.data[0].id as string;

    await admin.from("ai_runs").update({ approval_id: approvalId, updated_at: now.toISOString() }).eq("id", runId);

    await admin.from("ai_approval_history").insert({
      approval_id: approvalId,
      event_type: "requested",
      previous_status: null,
      new_status: "pending",
      decision: null,
      actor_reference: actor,
      actor_role: role,
      reason: "Approval requested — no HAL dispatch until explicit human approval.",
      conditions: { approval_type: APPROVAL_GATED_APPROVAL_TYPE },
      approval_count_before: 0,
      approval_count_after: 0,
      created_at: now.toISOString(),
    });

    await admin.from("ai_approval_history").insert({
      approval_id: approvalId,
      event_type: "context_bound",
      previous_status: "pending",
      new_status: "pending",
      decision: null,
      actor_reference: actor,
      actor_role: role,
      reason: "Immutable approval authorization context bound (server-side registry IDs + SHA-256 hash).",
      conditions: approvalContextConditions,
      approval_count_before: 0,
      approval_count_after: 0,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "approval_gated_run_created", "success", "low", actor,
      `Approval-gated run ${runKey} created (task=${taskKey}, approval=${approvalKey}, agent=${APPROVAL_GATED_AGENT_KEY}, tool=${APPROVAL_GATED_TOOL_KEY}). Awaiting human approval — HAL dispatch BLOCKED.`,
      correlationId);
    await auditEvent(admin, "approval_requested", "success", "low", actor,
      `Approval ${approvalKey} requested for approval-gated run ${runKey}. No HAL dispatch occurred.`,
      correlationId);
    await auditEvent(admin, "approval_context_bound", "success", "low", actor,
      `Approval ${approvalKey} context bound (fingerprint=${approvalContextHash.slice(0, 8)}). Immutable server-side authorization context.`,
      correlationId);

    return json({
      accepted: true,
      operation: "create_approval_gated_run",
      taskKey,
      runKey,
      approvalKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      probeId: APPROVAL_GATED_PROBE_ID,
      probeMode: APPROVAL_GATED_PROBE_MODE,
      agentKey: APPROVAL_GATED_AGENT_KEY,
      toolKey: APPROVAL_GATED_TOOL_KEY,
      toolOperation: APPROVAL_GATED_TOOL_OPERATION,
      permission: APPROVAL_GATED_PERMISSION,
      status: "awaiting_approval",
      halDispatch: "BLOCKED",
      totalSteps: APPROVAL_GATED_STEPS.length,
      expiresAt: new Date(now.getTime() + APPROVAL_GATED_VALIDITY_MS).toISOString(),
      contextFingerprint: approvalContextHash.slice(0, 8),
      separationOfDutiesRequired: true,
      selfApprovalAllowed: false,
      executionEnabled: false,
      message: "Approval-gated run created. HAL dispatch is BLOCKED until explicit human approval and a separate manual dispatch.",
    });
  }

  // ===========================================================================
  // APPROVE_APPROVAL_GATED_RUN — owner/admin only. Does NOT dispatch HAL.
  // ===========================================================================
  if (operation === "approve_approval_gated_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to approve an approval-gated run." }, 403);

    const approval = await resolveApprovalGatedApprovalByRefs(admin, str(body.approval_key), str(body.run_key));
    if (!approval) {
      return json({ error: "Approval-gated approval not found.", detail: "approval_not_found" }, 404);
    }

    if (str(approval.status) !== "pending") {
      return json({ error: "Approval is not pending a decision.", detail: "approval_not_pending" }, 409);
    }

    const runId = approval.run_id;
    if (!runId) {
      return json({ error: "Approval is not linked to a run.", detail: "approval_run_missing" }, 409);
    }

    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id")
      .eq("id", runId)
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;
    if (!run) {
      return json({ error: "Approval run not found.", detail: "run_not_found" }, 409);
    }
    if (str(run.status) !== "awaiting_approval") {
      return json({ error: "Run is not awaiting approval.", detail: "run_not_awaiting_approval" }, 409);
    }

    const requesterIdentity = normaliseIdentity(approval.requested_by);
    const approverIdentity = normaliseIdentity(actor);
    if (requesterIdentity && approverIdentity && requesterIdentity === approverIdentity) {
      await auditEvent(admin, "approval_self_approval_blocked", "blocked", "high", actor,
        `Self-approval blocked: requester ${requesterIdentity} attempted to approve their own request ` +
        `(approval ${str(approval.approval_key)}, run ${str(run.run_key)}). Reason=self_approval_forbidden. A different owner/admin is required.`,
        str(run.correlation_id) || null);
      return json({
        error: "The requester cannot approve their own runtime request. A different owner or admin must review it.",
        detail: "self_approval_forbidden",
      }, 409);
    }

    const approvalExpiresAt = str(approval.expires_at);
    if (approvalExpiresAt && Date.now() > new Date(approvalExpiresAt).getTime()) {
      const expireNow = new Date().toISOString();
      await admin.from("ai_approvals").update({ status: "expired", updated_at: expireNow }).eq("id", approval.id);
      await admin.from("ai_approval_history").insert({
        approval_id: approval.id,
        event_type: "expired",
        previous_status: "pending",
        new_status: "expired",
        decision: null,
        actor_reference: actor,
        actor_role: role,
        reason: "Approval expired before a human decision — it can no longer be approved.",
        conditions: approval.conditions ?? null,
        approval_count_before: 0,
        approval_count_after: 0,
        created_at: expireNow,
      });
      await admin.from("ai_run_steps").update({
        status: "failed",
        error_summary: "Approval expired before a human decision.",
        completed_at: expireNow,
      }).eq("run_id", runId).eq("step_number", 4);
      await admin.from("ai_runs").update({
        status: "cancelled",
        error_summary: "Approval expired before a human decision.",
        completed_at: expireNow,
        updated_at: expireNow,
      }).eq("id", runId);
      if (run.task_id) {
        await admin.from("ai_tasks").update({ status: "failed", updated_at: expireNow }).eq("id", run.task_id);
      }
      await auditEvent(admin, "approval_expired", "expired", "low", actor,
        `Approval ${str(approval.approval_key)} expired before a human decision (run ${str(run.run_key)}). No HAL dispatch occurred.`,
        str(run.correlation_id) || null);
      return json({ error: "This approval has expired and can no longer be approved.", detail: "approval_expired" }, 409);
    }

    const ctxCheck = await revalidateApprovalContext(admin, approval);
    if (!ctxCheck.ok) {
      await auditEvent(admin, "approval_context_changed", "blocked", "high", actor,
        `Approval ${str(approval.approval_key)} context changed since creation (${ctxCheck.detail}). Approve blocked — a fresh approval is required.`,
        str(run.correlation_id) || null);
      return json({ error: "The approved authorization context has changed since the approval was created. A fresh human approval is required.", detail: "approval_context_changed" }, 409);
    }

    const decisionAt = new Date().toISOString();

    await admin.from("ai_approvals").update({
      status: "approved",
      decision: "approve",
      decision_reason: "Human approved the fixed sandbox diagnostic execution.",
      decision_actor: actor,
      decision_at: decisionAt,
      current_approval_count: 1,
      updated_at: decisionAt,
    }).eq("id", approval.id);

    await admin.from("ai_approval_history").insert({
      approval_id: approval.id,
      event_type: "approved",
      previous_status: "pending",
      new_status: "approved",
      decision: "approve",
      actor_reference: actor,
      actor_role: role,
      reason: "Human approval granted. HAL still NOT dispatched — awaiting explicit manual dispatch.",
      conditions: null,
      approval_count_before: 0,
      approval_count_after: 1,
      created_at: decisionAt,
    });

    await admin.from("ai_approval_history").insert({
      approval_id: approval.id,
      event_type: "separation_of_duties_verified",
      previous_status: "approved",
      new_status: "approved",
      decision: null,
      actor_reference: actor,
      actor_role: role,
      reason: "Independent maker/checker verified — requester and approver are different authenticated humans.",
      conditions: null,
      approval_count_before: 1,
      approval_count_after: 1,
      created_at: decisionAt,
    });

    await admin.from("ai_run_steps").update({
      status: "completed",
      completed_at: decisionAt,
    }).eq("run_id", runId).eq("step_number", 4);

    await auditEvent(admin, "approval_granted", "success", "low", actor,
      `Approval ${str(approval.approval_key)} granted by ${actor} for run ${str(run.run_key)}. ` +
      `separation_of_duties=verified (requester ≠ approver). HAL still NOT dispatched — awaiting manual dispatch.`,
      str(run.correlation_id) || null);

    return json({
      accepted: true,
      operation: "approve_approval_gated_run",
      approvalKey: str(approval.approval_key),
      runKey: str(run.run_key),
      status: "approved",
      halDispatch: "NOT_YET_SENT",
      separationOfDutiesVerified: true,
      executionEnabled: false,
      message: "Approval granted. HAL dispatch has NOT occurred — explicit manual dispatch is required.",
    });
  }

  // ===========================================================================
  // REJECT_APPROVAL_GATED_RUN — owner/admin only. No HAL dispatch, no retry.
  // ===========================================================================
  if (operation === "reject_approval_gated_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to reject an approval-gated run." }, 403);

    const approval = await resolveApprovalGatedApprovalByRefs(admin, str(body.approval_key), str(body.run_key));
    if (!approval) {
      return json({ error: "Approval-gated approval not found.", detail: "approval_not_found" }, 404);
    }

    if (str(approval.status) !== "pending") {
      return json({ error: "Approval is not pending a decision.", detail: "approval_not_pending" }, 409);
    }

    const runId = approval.run_id;
    if (!runId) {
      return json({ error: "Approval is not linked to a run.", detail: "approval_run_missing" }, 409);
    }

    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id")
      .eq("id", runId)
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;
    if (!run) {
      return json({ error: "Approval run not found.", detail: "run_not_found" }, 409);
    }
    if (str(run.status) !== "awaiting_approval") {
      return json({ error: "Run is not awaiting approval.", detail: "run_not_awaiting_approval" }, 409);
    }

    const decisionAt = new Date().toISOString();

    await admin.from("ai_approvals").update({
      status: "rejected",
      decision: "reject",
      decision_reason: "Human rejected the diagnostic execution.",
      decision_actor: actor,
      decision_at: decisionAt,
      updated_at: decisionAt,
    }).eq("id", approval.id);

    await admin.from("ai_approval_history").insert({
      approval_id: approval.id,
      event_type: "rejected",
      previous_status: "pending",
      new_status: "rejected",
      decision: "reject",
      actor_reference: actor,
      actor_role: role,
      reason: "Human rejection — no HAL dispatch, no retry, no replacement approval.",
      conditions: null,
      approval_count_before: 0,
      approval_count_after: 0,
      created_at: decisionAt,
    });

    await admin.from("ai_run_steps").update({
      status: "failed",
      completed_at: decisionAt,
      error_summary: "Rejected by human approval.",
    }).eq("run_id", runId).eq("step_number", 4);

    await admin.from("ai_runs").update({
      status: "cancelled",
      error_summary: "Rejected by human approval.",
      completed_at: decisionAt,
      updated_at: decisionAt,
    }).eq("id", runId);

    if (run.task_id) {
      await admin.from("ai_tasks").update({ status: "failed", updated_at: decisionAt }).eq("id", run.task_id);
    }

    await auditEvent(admin, "approval_rejected", "rejected", "low", actor,
      `Approval ${str(approval.approval_key)} rejected by ${actor}. Run ${str(run.run_key)} cancelled. No HAL dispatch, no retry.`,
      str(run.correlation_id) || null);
    await auditEvent(admin, "approval_gated_run_failed", "failed", "low", actor,
      `Approval-gated run ${str(run.run_key)} cancelled after human rejection. No HAL dispatch occurred.`,
      str(run.correlation_id) || null);

    return json({
      accepted: true,
      operation: "reject_approval_gated_run",
      approvalKey: str(approval.approval_key),
      runKey: str(run.run_key),
      status: "rejected",
      halDispatch: "BLOCKED",
      executionEnabled: false,
      message: "Approval rejected. Run cancelled. No HAL dispatch occurred.",
    });
  }

  // ===========================================================================
  // DISPATCH_APPROVED_DIAGNOSTIC_RUN — owner/admin only.
  // ===========================================================================
  if (operation === "dispatch_approved_diagnostic_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to dispatch an approved diagnostic run." }, 403);

    const approval = await resolveApprovalGatedApprovalByRefs(admin, str(body.approval_key), str(body.run_key));
    if (!approval) {
      return json({ error: "Approval-gated approval not found.", detail: "approval_not_found" }, 404);
    }

    const dispatchPreConditions = (approval.conditions as Record<string, unknown> | null) ?? {};
    if (dispatchPreConditions.approval_revoked === true) {
      await auditEvent(admin, "approval_revocation_blocked", "blocked", "high", actor,
        `Dispatch blocked: approval ${str(approval.approval_key)} was revoked before dispatch. HAL dispatch=blocked.`);
      return json({
        error: "This approval was revoked before dispatch. A fresh approval-gated run is required.",
        detail: "approval_revoked",
      }, 409);
    }

    if (str(approval.status) !== "approved") {
      return json({ error: "Dispatch requires an explicit approved approval.", detail: "approval_not_approved" }, 409);
    }

    const runId = approval.run_id;
    if (!runId) {
      return json({ error: "Approval is not linked to a run.", detail: "approval_run_missing" }, 409);
    }

    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id")
      .eq("id", runId)
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;
    if (!run) {
      return json({ error: "Approval run not found.", detail: "run_not_found" }, 409);
    }

    if (str(run.status) === "completed" || str(run.status) === "failed" || str(run.status) === "cancelled") {
      return json({ error: "Run is already in a terminal state.", detail: "run_terminal" }, 409);
    }

    const sodRequester = normaliseIdentity(approval.requested_by);
    const sodApprover = normaliseIdentity(approval.decision_actor);
    if (!sodRequester || !sodApprover || sodRequester === sodApprover) {
      await auditEvent(admin, "separation_of_duties_invalid", "blocked", "high", actor,
        `Dispatch blocked: separation of duties invalid for approval ${str(approval.approval_key)} ` +
        `(run ${str(run.run_key)}). Requester and approver must be different authenticated humans. Reason=separation_of_duties_invalid.`,
        str(run.correlation_id) || null);
      return json({
        error: "This approval lacks valid maker/checker separation-of-duties evidence. Create a fresh approval.",
        detail: "separation_of_duties_invalid",
      }, 409);
    }

    const approverResolution = await resolveApproverInternalRole(admin, str(approval.decision_actor));
    if (!approverResolution.ok) {
      await auditEvent(admin, "approver_eligibility_failed", "blocked", "high", actor,
        `Dispatch blocked: approving reviewer identity cannot be uniquely resolved for approval ${str(approval.approval_key)} (run ${str(run.run_key)}). HAL dispatch=blocked.`,
        str(run.correlation_id) || null);
      return json({
        error: "The approving reviewer identity cannot be verified. A fresh approval from an eligible checker is required.",
        detail: "approver_identity_unverifiable",
      }, 409);
    }
    if (!approverResolution.eligible) {
      await invalidateApproverEligibility(admin, approval, run, actor, role);
      return json({
        error: "The approving reviewer is no longer an eligible active owner/admin. A fresh approval from an eligible checker is required.",
        detail: "approver_no_longer_eligible",
      }, 409);
    }

    const corr = str(run.correlation_id);
    const { data: existingDispatch } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key")
      .eq("direction", "outbound")
      .eq("message_type", APPROVAL_GATED_QUEUE_MESSAGE_TYPE)
      .eq("correlation_id", corr)
      .limit(1);
    if (existingDispatch && existingDispatch.length > 0) {
      await auditEvent(admin, "approval_reuse_blocked", "blocked", "high", actor,
        `Dispatch blocked: approval-gated run ${str(run.run_key)} already has a dispatched HAL message. An approved approval never authorizes a second dispatch.`,
        corr);
      return json({ error: "This approval has already been dispatched.", detail: "already_dispatched" }, 409);
    }

    const approvalExpiresAt = str(approval.expires_at);
    if (approvalExpiresAt && Date.now() > new Date(approvalExpiresAt).getTime()) {
      const expireNow = new Date().toISOString();
      await admin.from("ai_approvals").update({ status: "expired", updated_at: expireNow }).eq("id", approval.id);
      await admin.from("ai_approval_history").insert({
        approval_id: approval.id,
        event_type: "expired",
        previous_status: "approved",
        new_status: "expired",
        decision: "approve",
        actor_reference: actor,
        actor_role: role,
        reason: "Approved approval expired before dispatch — dispatch blocked.",
        conditions: approval.conditions ?? null,
        approval_count_before: 1,
        approval_count_after: 1,
        created_at: expireNow,
      });
      await admin.from("ai_run_steps").update({
        status: "failed",
        error_summary: "Approval expired before dispatch.",
        completed_at: expireNow,
      }).eq("run_id", runId).eq("step_number", 5);
      await admin.from("ai_runs").update({
        status: "cancelled",
        error_summary: "Approval expired before dispatch.",
        completed_at: expireNow,
        updated_at: expireNow,
      }).eq("id", runId);
      if (run.task_id) {
        await admin.from("ai_tasks").update({ status: "failed", updated_at: expireNow }).eq("id", run.task_id);
      }
      await auditEvent(admin, "approval_expired", "expired", "low", actor,
        `Approved approval ${str(approval.approval_key)} expired before dispatch (run ${str(run.run_key)}). Dispatch blocked.`,
        corr);
      await auditEvent(admin, "approval_dispatch_expired_blocked", "blocked", "low", actor,
        `Dispatch blocked: approval-gated run ${str(run.run_key)} approval expired before dispatch. No HAL message was inserted.`,
        corr);
      return json({ error: "This approval has expired and can no longer be dispatched.", detail: "approval_expired" }, 409);
    }

    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: master kill switch not in required ON / execution-blocked state.`);
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    const approvalConditionsForGate = (approval.conditions as Record<string, unknown> | null) ?? {};
    if (approvalConditionsForGate.context_invalidated === true) {
      await auditEvent(admin, "approval_context_changed", "blocked", "high", actor,
        `Dispatch blocked: approval ${str(approval.approval_key)} was permanently invalidated after prior context drift (run ${str(run.run_key)}). It cannot be reused. A fresh approval is required.`,
        corr);
      return json({
        error: "This approval was permanently invalidated after its authorization context changed. Create a fresh approval-gated run and approval.",
        detail: "approval_context_changed",
      }, 409);
    }

    if (await hasContextChangedAuditEvent(admin, corr)) {
      await permanentlyInvalidateApprovalContext(admin, approval, run, actor, role);
      return json({
        error: "This approval's authorization context previously changed. It is permanently invalid and cannot be reused. Create a fresh approval.",
        detail: "approval_context_changed",
      }, 409);
    }

    const boundContextHash = str((approval.conditions as Record<string, unknown> | null)?.approval_context_hash);
    if (boundContextHash) {
      const ctxRecheck = await revalidateApprovalContextForDispatch(admin, approval);
      if (!ctxRecheck.ok) {
        await permanentlyInvalidateApprovalContext(admin, approval, run, actor, role);
        return json({
          error: "The approved authorization context has changed since approval. This approval is permanently invalidated; a fresh human approval is required.",
          detail: "approval_context_changed",
        }, 409);
      }
    }

    const agent = await resolveReadonlyToolAgent(admin);
    if (!agent) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: dedicated agent ${APPROVAL_GATED_AGENT_KEY} not registered/active.`);
      return json({ error: "Dedicated diagnostic agent is not registered or not active.", detail: "agent_not_registered" }, 409);
    }
    if (str(agent.autonomy_level) !== "none") {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: dedicated agent autonomy is not none.`);
      return json({ error: "Dedicated diagnostic agent autonomy is not none.", detail: "agent_autonomy_invalid" }, 409);
    }

    const tool = await resolveReadonlyTool(admin);
    if (!tool) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: callable tool ${APPROVAL_GATED_TOOL_KEY} not registered.`);
      return json({ error: "Callable diagnostic tool is not registered.", detail: "tool_missing" }, 409);
    }
    if (str(tool.credential_reference) || str(tool.endpoint_reference)) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: callable tool unexpectedly has a credential/endpoint.`);
      return json({ error: "Callable diagnostic tool unexpectedly has an executable configuration.", detail: "tool_not_safe" }, 409);
    }

    const { data: dispatchGrantRows } = await admin
      .from("ai_tool_agent_access")
      .select("id, connection_id, access_level")
      .eq("agent_id", agent.id as string)
      .eq("is_active", true);
    const dispatchGrants = dispatchGrantRows ?? [];
    if (dispatchGrants.length !== 1) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: dedicated agent holds ${dispatchGrants.length} active tool grant(s) (expected exactly one).`);
      return json({ error: "Dedicated agent must hold exactly one active tool grant.", detail: "tool_access_scope_invalid" }, 409);
    }
    const dispatchGrant = dispatchGrants[0];
    if (dispatchGrant.connection_id !== tool.id || str(dispatchGrant.access_level) !== APPROVAL_GATED_PERMISSION) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high", actor,
        `Approval-gated dispatch rejected: dedicated agent grant is not the exact isolated execute grant for the callable tool.`);
      return json({ error: "Dedicated agent grant is not the exact isolated execute permission for the callable tool.", detail: "tool_access_scope_invalid" }, 409);
    }

    const dispatchContext = buildApprovalContext({
      agentId: str(agent.id),
      toolId: str(tool.id),
      grantId: str(dispatchGrant.id),
    });
    const dispatchContextHash = await computeApprovalContextHash(dispatchContext);
    const storedContextHash = str((approval.conditions as Record<string, unknown> | null)?.approval_context_hash);
    if (storedContextHash && dispatchContextHash !== storedContextHash) {
      await permanentlyInvalidateApprovalContext(admin, approval, run, actor, role);
      return json({
        error: "The approved authorization context has changed since approval. This approval is permanently invalidated; a fresh human approval is required.",
        detail: "approval_context_changed",
      }, 409);
    }

    let taskKey = "";
    if (run.task_id) {
      const { data: taskRows } = await admin.from("ai_tasks").select("task_key").eq("id", run.task_id).limit(1);
      taskKey = taskRows && taskRows.length > 0 ? str(taskRows[0].task_key) : "";
    }

    // PROMPT 24A — emergency freeze is the FINAL gate, applied after all
    // Prompt 19–22 checks, immediately before the outbound HAL message insert.
    if (await emergencyFreezeEngaged(admin, actor, corr)) {
      return emergencyFreezeBlockedResponse("dispatch_approved_diagnostic_run");
    }

    const now = new Date();
    const probeKey = uid("AGP");

    const safePayload = {
      probe_key: probeKey,
      probe_id: APPROVAL_GATED_PROBE_ID,
      correlation_id: corr,
      task_reference: taskKey,
      run_reference: str(run.run_key),
      approval_reference: str(approval.approval_key),
      expected_node_key: node.node_key,
      agent_key: APPROVAL_GATED_AGENT_KEY,
      tool_key: APPROVAL_GATED_TOOL_KEY,
      tool_operation: APPROVAL_GATED_TOOL_OPERATION,
      probe_mode: APPROVAL_GATED_PROBE_MODE,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: APPROVAL_GATED_QUEUE_MESSAGE_TYPE,
      correlation_id: corr,
      status: "pending",
      payload_type: "approval_gated_diagnostic_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await admin.from("ai_run_steps").update({
      status: "completed",
      completed_at: now.toISOString(),
    }).eq("run_id", runId).eq("step_number", 5);

    await admin.from("ai_runs").update({
      status: "working",
      current_step: 5,
      updated_at: now.toISOString(),
    }).eq("id", runId);

    await auditEvent(admin, "approved_run_dispatch_queued", "success", "low", actor,
      `Approved approval-gated run ${str(run.run_key)} dispatched ONE fixed HAL message (probe=${APPROVAL_GATED_PROBE_ID}, agent=${APPROVAL_GATED_AGENT_KEY}, tool=${APPROVAL_GATED_TOOL_KEY}). Fixed read-only tool only — no business data, no mutation.`,
      corr);

    return json({
      accepted: true,
      operation: "dispatch_approved_diagnostic_run",
      approvalKey: str(approval.approval_key),
      runKey: str(run.run_key),
      taskKey,
      correlationId: corr,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      probeId: APPROVAL_GATED_PROBE_ID,
      probeMode: APPROVAL_GATED_PROBE_MODE,
      agentKey: APPROVAL_GATED_AGENT_KEY,
      toolKey: APPROVAL_GATED_TOOL_KEY,
      toolOperation: APPROVAL_GATED_TOOL_OPERATION,
      permission: APPROVAL_GATED_PERMISSION,
      status: "dispatched",
      halDispatch: "SENT",
      executionEnabled: false,
      message: "Approved diagnostic run dispatched once. The fixed read-only tool will execute through HAL.",
    });
  }

  // ===========================================================================
  // REVOKE_APPROVED_DIAGNOSTIC_RUN — owner or original checker only.
  // ===========================================================================
  if (operation === "revoke_approved_diagnostic_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to revoke an approval-gated run." }, 403);

    const approval = await resolveApprovalGatedApprovalByRefs(admin, str(body.approval_key), str(body.run_key));
    if (!approval) {
      return json({ error: "Approval-gated approval not found.", detail: "approval_not_found" }, 404);
    }

    if (str(approval.status) !== "approved") {
      return json({ error: "Only an approved approval can be revoked.", detail: "approval_not_approved" }, 409);
    }

    const runId = approval.run_id;
    if (!runId) {
      return json({ error: "Approval is not linked to a run.", detail: "approval_run_missing" }, 409);
    }

    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id, run_key, task_id, status, correlation_id")
      .eq("id", runId)
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;
    if (!run) {
      return json({ error: "Approval run not found.", detail: "run_not_found" }, 409);
    }

    const runStatus = str(run.status);
    if (runStatus === "completed" || runStatus === "failed" || runStatus === "cancelled") {
      return json({ error: "Run is already in a terminal state.", detail: "run_terminal" }, 409);
    }

    const corr = str(run.correlation_id);

    const { data: existingDispatch } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key")
      .eq("direction", "outbound")
      .eq("message_type", APPROVAL_GATED_QUEUE_MESSAGE_TYPE)
      .eq("correlation_id", corr)
      .limit(1);
    if (existingDispatch && existingDispatch.length > 0) {
      await auditEvent(admin, "approval_revocation_blocked", "blocked", "high", actor,
        `Revocation blocked: approval ${str(approval.approval_key)} (run ${str(run.run_key)}) has already been dispatched. An already-dispatched runtime call cannot be revoked as if cancelled.`,
        corr);
      return json({ error: "This approval has already been dispatched and cannot be revoked.", detail: "already_dispatched" }, 409);
    }

    const decisionActor = str(approval.decision_actor);
    const isOriginalChecker = normaliseIdentity(decisionActor) === normaliseIdentity(actor);
    const isOwner = role === "owner";
    if (!isOriginalChecker && !isOwner) {
      await auditEvent(admin, "approval_revocation_blocked", "blocked", "high", actor,
        `Revocation blocked: ${actor} is neither the original checker nor an owner for approval ${str(approval.approval_key)} (run ${str(run.run_key)}). Peer-admin revocation is not permitted.`,
        corr);
      return json({
        error: "Only the original approving checker or an owner may revoke this approval.",
        detail: "revocation_not_authorized",
      }, 403);
    }

    const revokedAt = new Date().toISOString();
    const conditions = (approval.conditions as Record<string, unknown> | null) ?? {};
    const mergedConditions = {
      ...conditions,
      approval_revoked: true,
      approval_revoked_at: revokedAt,
      approval_revoked_by: actor,
      approval_revoked_reason: "manual_revocation",
    };

    await admin.from("ai_approvals").update({
      status: "rejected",
      decision_reason: "Previously approved; approval explicitly revoked before runtime dispatch.",
      conditions: mergedConditions,
      updated_at: revokedAt,
    }).eq("id", approval.id);

    await admin.from("ai_approval_history").insert({
      approval_id: approval.id,
      event_type: "revoked",
      previous_status: "approved",
      new_status: "rejected",
      decision: null,
      actor_reference: actor,
      actor_role: role,
      reason: "Approved runtime authorization was revoked before dispatch.",
      conditions: null,
      approval_count_before: 1,
      approval_count_after: 1,
      created_at: revokedAt,
    });

    await admin.from("ai_run_steps").update({
      status: "failed",
      error_summary: "approval_revoked",
      completed_at: revokedAt,
    }).eq("run_id", runId).eq("step_number", 5);

    await admin.from("ai_runs").update({
      status: "cancelled",
      error_summary: "approval_revoked",
      completed_at: revokedAt,
      updated_at: revokedAt,
    }).eq("id", runId);

    if (run.task_id) {
      await admin.from("ai_tasks").update({ status: "failed", updated_at: revokedAt }).eq("id", run.task_id);
    }

    await auditEvent(admin, "approval_revoked", "blocked", "high", actor,
      `Approval ${str(approval.approval_key)} explicitly revoked by ${actor} before dispatch (run ${str(run.run_key)}, reason=manual_revocation). HAL dispatch=blocked.`,
      corr);

    return json({
      accepted: true,
      operation: "revoke_approved_diagnostic_run",
      approvalKey: str(approval.approval_key),
      runKey: str(run.run_key),
      status: "revoked",
      halDispatch: "BLOCKED",
      executionEnabled: false,
      message: "Approval revoked before dispatch. Run cancelled; a fresh approval-gated run is required.",
    });
  }

  // ===========================================================================
  // GET_APPROVAL_GATED_RUN_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_approval_gated_run_status") {
    const { data: taskRows } = await admin
      .from("ai_tasks")
      .select("id, task_key, name, task_type, status, environment, risk_level, created_at")
      .eq("task_type", APPROVAL_GATED_TASK_TYPE)
      .order("created_at", { ascending: false })
      .limit(1);
    const task = taskRows && taskRows.length > 0 ? taskRows[0] : null;

    if (!task) {
      return json({
        operation: "get_approval_gated_run_status",
        found: false,
        task: null,
        run: null,
        approval: null,
        steps: [],
        signedResult: null,
        halDispatch: "BLOCKED",
        executionEnabled: false,
      });
    }

    const { data: runRows } = await admin
      .from("ai_runs")
      .select("id, run_key, status, current_step, total_steps, correlation_id, approval_id, started_at, completed_at, error_summary, result_summary, created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const run = runRows && runRows.length > 0 ? runRows[0] : null;

    let approval = null;
    let steps: Record<string, unknown>[] = [];
    let signedResult = null;

    if (run) {
      const approvalId = run.approval_id;
      const appQuery = approvalId
        ? admin.from("ai_approvals").select("id, approval_key, status, decision, decision_actor, decision_at, requested_by, current_approval_count, expires_at, conditions").eq("id", approvalId).limit(1)
        : admin.from("ai_approvals").select("id, approval_key, status, decision, decision_actor, decision_at, requested_by, current_approval_count, expires_at, conditions").eq("run_id", run.id).limit(1);
      const { data: appRows } = await appQuery;
      approval = appRows && appRows.length > 0 ? appRows[0] : null;

      const { data: stepRows } = await admin
        .from("ai_run_steps")
        .select("step_number, name, status, completed_at")
        .eq("run_id", run.id)
        .order("step_number", { ascending: true });
      steps = (stepRows ?? []).map((s) => ({
        stepNumber: s.step_number,
        name: s.name,
        status: s.status,
        completedAt: s.completed_at ?? null,
      }));

      const corr = str(run.correlation_id);
      if (corr) {
        const { data: resRows } = await admin
          .from("ai_runtime_bridge_messages")
          .select("status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", APPROVAL_GATED_RESULT_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1);
        const res = resRows && resRows.length > 0 ? resRows[0] : null;
        if (res) {
          const rp = (res.safe_payload as Record<string, unknown>) ?? {};
          signedResult = {
            verified: rp.verified === true,
            n8nStatus: str(rp.n8n_status) || null,
            ollamaStatus: str(rp.ollama_status) || null,
            ollamaModelCount: rp.ollama_model_count ?? null,
            latencyMs: rp.latency_ms ?? null,
            completedAt: str(res.acknowledged_at) || str(res.created_at),
          };
        }
      }
    }

    const approvalExpiresAt = approval ? str(approval.expires_at) : null;
    const approvalIsExpired = approvalExpiresAt ? Date.now() > new Date(approvalExpiresAt).getTime() : false;
    const approvalConditions = (approval?.conditions as Record<string, unknown> | null) ?? {};
    const approvalContextHash = str(approvalConditions.approval_context_hash);
    const approvalContextBound = !!approvalContextHash;
    const contextFingerprint = approvalContextHash ? approvalContextHash.slice(0, 8) : null;

    let contextInvalidated = approvalConditions.context_invalidated === true;
    let contextInvalidatedAt = str(approvalConditions.context_invalidated_at) || null;
    if (!contextInvalidated && approval && str(approval.status) === "approved" && run) {
      const priorDrift = await hasContextChangedAuditEvent(admin, str(run.correlation_id));
      if (priorDrift) {
        contextInvalidated = true;
        contextInvalidatedAt = null;
      }
    }

    let approvalContextMatched = false;
    if (approvalContextBound && !contextInvalidated) {
      const cur = await currentApprovalContextHash(admin);
      approvalContextMatched = cur.ok && cur.hash === approvalContextHash;
    }

    const requestedBy = approval ? str(approval.requested_by) : null;
    const approvedBy = approval ? str(approval.decision_actor) : null;
    const separationOfDutiesRequired = true;
    const selfApprovalAllowed = false;
    const separationOfDutiesVerified = !!requestedBy && !!approvedBy && normaliseIdentity(requestedBy) !== normaliseIdentity(approvedBy);

    const approvalRevoked = approvalConditions.approval_revoked === true;
    const approvalRevokedAt = str(approvalConditions.approval_revoked_at) || null;
    const approvalRevokedBy = str(approvalConditions.approval_revoked_by) || null;
    const approverEligibilityInvalidated = approvalConditions.approver_eligibility_invalidated === true;

    let approverCurrentlyEligible: boolean | null = null;
    let approverCurrentRole: string | null = null;
    if (approval && str(approval.decision_actor)) {
      const approverRes = await resolveApproverInternalRole(admin, str(approval.decision_actor));
      approverCurrentlyEligible = approverRes.eligible;
      approverCurrentRole = approverRes.role;
    }

    let halDispatch = "BLOCKED";
    if (contextInvalidated) {
      halDispatch = "BLOCKED";
    } else if (signedResult) {
      halDispatch = "RESULT_RECEIVED";
    } else if (run && str(run.status) === "working") {
      halDispatch = "SENT";
    } else if (approval && str(approval.status) === "approved") {
      halDispatch = "NOT_YET_SENT";
    }

    return json({
      operation: "get_approval_gated_run_status",
      found: true,
      task: task ? {
        taskKey: str(task.task_key),
        name: str(task.name),
        taskType: str(task.task_type),
        status: str(task.status),
        environment: str(task.environment),
        riskLevel: str(task.risk_level),
      } : null,
      run: run ? {
        runKey: str(run.run_key),
        status: str(run.status),
        currentStep: run.current_step ?? 0,
        totalSteps: run.total_steps ?? APPROVAL_GATED_STEPS.length,
        correlationId: str(run.correlation_id),
        startedAt: str(run.started_at),
        completedAt: str(run.completed_at),
        errorSummary: str(run.error_summary) || null,
        resultSummary: str(run.result_summary) || null,
      } : null,
      approval: approval ? {
        approvalKey: str(approval.approval_key),
        status: str(approval.status),
        decision: str(approval.decision) || null,
        decisionActor: str(approval.decision_actor) || null,
        decisionAt: str(approval.decision_at) || null,
        approvalCount: approval.current_approval_count ?? 0,
        expiresAt: approvalExpiresAt,
        isExpired: approvalIsExpired,
        approvalContextBound,
        approvalContextMatched,
        contextInvalidated,
        contextInvalidatedAt,
        contextFingerprint,
        requestedBy,
        approvedBy,
        separationOfDutiesRequired,
        separationOfDutiesVerified,
        selfApprovalAllowed,
        approvalRevoked,
        approvalRevokedAt,
        approvalRevokedBy,
        approverEligibilityInvalidated,
        approverCurrentlyEligible,
        approverCurrentRole,
      } : null,
      steps,
      signedResult,
      halDispatch,
      agentKey: APPROVAL_GATED_AGENT_KEY,
      toolKey: APPROVAL_GATED_TOOL_KEY,
      toolOperation: APPROVAL_GATED_TOOL_OPERATION,
      permission: APPROVAL_GATED_PERMISSION,
      probeId: APPROVAL_GATED_PROBE_ID,
      probeMode: APPROVAL_GATED_PROBE_MODE,
      executionEnabled: false,
      message: "Approval-gated run status read (sandbox diagnostic only — no business data, no mutation).",
    });
  }

  // ===========================================================================
  // ENGAGE_DIAGNOSTIC_RUNTIME_FREEZE — owner/admin only.
  // ===========================================================================
  if (operation === "engage_diagnostic_runtime_freeze") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to engage the diagnostic runtime freeze." }, 403);

    const control = await ensureEmergencyFreezeControl(admin);
    if (!control) {
      return json({ error: "Failed to resolve the emergency freeze control.", detail: "freeze_control_resolve_failed" }, 500);
    }
    if (control.__freezeConfigurationInvalid === true) {
      return json({ error: "The emergency freeze control has an invalid configuration.", detail: "freeze_control_configuration_invalid" }, 500);
    }

    if (isFreezeEngaged(control)) {
      return json({
        accepted: true,
        alreadyEngaged: true,
        operation: "engage_diagnostic_runtime_freeze",
        engaged: true,
        engagedBy: str(control.changed_by) || null,
        engagedAt: str(control.changed_at) || null,
        normalExecutionBlocked: true,
        masterKillSwitchOn: true,
        productionEnabled: false,
        message: "Diagnostic runtime freeze is already engaged. No duplicate history or audit recorded.",
      });
    }

    const engagedAt = new Date().toISOString();
    const previousEnabled = control.enabled === true;
    const previousExecutionAllowed = control.execution_allowed === true;

    await admin.from("ai_runtime_controls").update({
      enabled: true,
      execution_allowed: false,
      changed_by: actor,
      changed_at: engagedAt,
      updated_at: engagedAt,
    }).eq("id", control.id);

    await admin.from("ai_runtime_control_history").insert({
      control_id: control.id,
      action: "engaged",
      previous_enabled: previousEnabled,
      new_enabled: true,
      previous_execution_allowed: previousExecutionAllowed,
      new_execution_allowed: false,
      actor_reference: actor,
      actor_role: role,
      reason: "Diagnostic runtime emergency freeze engaged — execution-bearing sandbox diagnostic dispatches are blocked.",
      correlation_id: null,
      created_at: engagedAt,
    });

    const containment = await containExistingExecutionBearingWork(admin, actor, role, engagedAt);

    await auditEvent(admin, "runtime_emergency_freeze_engaged", "success", "high", actor,
      `Diagnostic runtime emergency freeze ENGAGED. Execution-bearing sandbox diagnostic dispatches are blocked until owner release. ` +
      `Contained ${containment.pendingMessagesInvalidated} pending message(s) and ${containment.inflightMessagesDetected} in-flight message(s).`,
      null);

    return json({
      accepted: true,
      alreadyEngaged: false,
      operation: "engage_diagnostic_runtime_freeze",
      engaged: true,
      engagedAt,
      engagedBy: actor,
      pendingMessagesInvalidated: containment.pendingMessagesInvalidated,
      inflightMessagesDetected: containment.inflightMessagesDetected,
      latestAffectedRunKey: containment.latestAffectedRunKey,
      normalExecutionBlocked: true,
      masterKillSwitchOn: true,
      productionEnabled: false,
      message: "Diagnostic runtime freeze engaged. All execution-bearing sandbox diagnostic dispatches are now blocked.",
    });
  }

  // ===========================================================================
  // RELEASE_DIAGNOSTIC_RUNTIME_FREEZE — owner ONLY.
  // ===========================================================================
  if (operation === "release_diagnostic_runtime_freeze") {
    if (role !== "owner") return json({ error: "Owner role required to release the diagnostic runtime freeze." }, 403);

    const control = await ensureEmergencyFreezeControl(admin);
    if (!control) {
      return json({ error: "Failed to resolve the emergency freeze control.", detail: "freeze_control_resolve_failed" }, 500);
    }
    if (control.__freezeConfigurationInvalid === true) {
      return json({ error: "The emergency freeze control has an invalid configuration.", detail: "freeze_control_configuration_invalid" }, 500);
    }

    if (!isFreezeEngaged(control)) {
      return json({
        accepted: true,
        alreadyReleased: true,
        operation: "release_diagnostic_runtime_freeze",
        engaged: false,
        releasedBy: str(control.changed_by) || null,
        releasedAt: str(control.changed_at) || null,
        normalExecutionBlocked: true,
        masterKillSwitchOn: true,
        productionEnabled: false,
        message: "Diagnostic runtime freeze is already released. No duplicate history or audit recorded.",
      });
    }

    const releasedAt = new Date().toISOString();
    const previousEnabled = control.enabled === true;
    const previousExecutionAllowed = control.execution_allowed === true;

    await admin.from("ai_runtime_controls").update({
      enabled: false,
      execution_allowed: true,
      changed_by: actor,
      changed_at: releasedAt,
      updated_at: releasedAt,
    }).eq("id", control.id);

    await admin.from("ai_runtime_control_history").insert({
      control_id: control.id,
      action: "released",
      previous_enabled: previousEnabled,
      new_enabled: false,
      previous_execution_allowed: previousExecutionAllowed,
      new_execution_allowed: true,
      actor_reference: actor,
      actor_role: role,
      reason: "Diagnostic runtime emergency freeze released — future execution-bearing sandbox diagnostic dispatches are allowed again. No historical work is replayed.",
      correlation_id: null,
      created_at: releasedAt,
    });

    await auditEvent(admin, "runtime_emergency_freeze_released", "success", "high", actor,
      `Diagnostic runtime emergency freeze RELEASED. Future execution-bearing sandbox diagnostic dispatches are allowed again. No prior messages, runs, approvals, or tasks were replayed or reactivated.`,
      null);

    return json({
      accepted: true,
      alreadyReleased: false,
      operation: "release_diagnostic_runtime_freeze",
      engaged: false,
      releasedAt,
      releasedBy: actor,
      normalExecutionBlocked: true,
      masterKillSwitchOn: true,
      productionEnabled: false,
      message: "Diagnostic runtime freeze released. Future execution-bearing sandbox diagnostic dispatches are allowed again.",
    });
  }

  // ===========================================================================
  // GET_DIAGNOSTIC_RUNTIME_FREEZE_STATUS — any internal role (read-only).
  // ===========================================================================
  if (operation === "get_diagnostic_runtime_freeze_status") {
    const control = await ensureEmergencyFreezeControl(admin);
    if (!control) {
      return json({ error: "Failed to resolve the emergency freeze control.", detail: "freeze_control_resolve_failed" }, 500);
    }
    if (control.__freezeConfigurationInvalid === true) {
      return json({ error: "The emergency freeze control has an invalid configuration.", detail: "freeze_control_configuration_invalid" }, 500);
    }

    const engaged = isFreezeEngaged(control);
    let engagedAt: string | null = null;
    let engagedBy: string | null = null;
    let releasedAt: string | null = null;
    let releasedBy: string | null = null;

    const { data: engRows } = await admin
      .from("ai_runtime_control_history")
      .select("created_at, actor_reference")
      .eq("control_id", control.id)
      .eq("action", "engaged")
      .order("created_at", { ascending: false })
      .limit(1);
    if (engRows && engRows.length > 0) {
      engagedAt = str(engRows[0].created_at) || null;
      engagedBy = str(engRows[0].actor_reference) || null;
    }

    const { data: relRows } = await admin
      .from("ai_runtime_control_history")
      .select("created_at, actor_reference")
      .eq("control_id", control.id)
      .eq("action", "released")
      .order("created_at", { ascending: false })
      .limit(1);
    if (relRows && relRows.length > 0) {
      releasedAt = str(relRows[0].created_at) || null;
      releasedBy = str(relRows[0].actor_reference) || null;
    }

    let pendingMessagesInvalidated = 0;
    let inflightMessagesDetected = 0;
    let latestAffectedRunKey: string | null = null;
    let latestAffectedCorrelationId: string | null = null;

    const latestEngageAt = engagedAt;
    if (latestEngageAt) {
      const { data: containmentEvents } = await admin
        .from("ai_audit_events")
        .select("event_type, correlation_id, occurred_at")
        .in("event_type", [
          "runtime_emergency_pending_message_invalidated",
          "runtime_emergency_inflight_detected",
        ])
        .gte("occurred_at", latestEngageAt)
        .order("occurred_at", { ascending: false })
        .limit(1000);

      for (const ev of containmentEvents ?? []) {
        if (ev.event_type === "runtime_emergency_pending_message_invalidated") pendingMessagesInvalidated += 1;
        else if (ev.event_type === "runtime_emergency_inflight_detected") inflightMessagesDetected += 1;
        if (!latestAffectedCorrelationId && ev.correlation_id) latestAffectedCorrelationId = str(ev.correlation_id);
      }

      if (latestAffectedCorrelationId) {
        const { data: runRows } = await admin
          .from("ai_runs")
          .select("run_key")
          .eq("correlation_id", latestAffectedCorrelationId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (runRows && runRows.length > 0) latestAffectedRunKey = str(runRows[0].run_key);
      }
    }

    return json({
      operation: "get_diagnostic_runtime_freeze_status",
      engaged,
      engagedAt,
      engagedBy,
      releasedAt,
      releasedBy,
      pendingMessagesInvalidated,
      inflightMessagesDetected,
      latestAffectedRunKey,
      latestAffectedCorrelationId,
      normalExecutionBlocked: true,
      masterKillSwitchOn: true,
      productionEnabled: false,
    });
  }

  return json({ error: "Unknown operation." }, 422);
});
