import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge-control — authenticated internal-staff control endpoint for
// the private runtime transport probe (Phase 3 Prompt 10), the controlled
// Ollama sandbox inference probe (Phase 3 Prompt 11A), the controlled n8n
// sandbox workflow probe (Phase 3 Prompt 12), the controlled multi-runtime
// chain probe (Phase 3 Prompt 13), the controlled registered-agent dry-run
// probe (Phase 3 Prompt 14), the controlled tool access denial probe
// (Phase 3 Prompt 15), the controlled tool access grant probe (Phase 3
// Prompt 16), the controlled read-only tool probe (Phase 3 Prompt 17), and the
// controlled runtime-backed diagnostic run (Phase 3 Prompt 18).
//
// This is TRANSPORT TESTING + SINGLE FIXED DIAGNOSTIC PINGS + cloud-side
// authorization checks + ONE allowlisted read-only tool invocation + ONE fixed
// persisted diagnostic task/run lifecycle. It queues a safe dry-run transport
// probe, OR one fixed harmless Ollama generation, OR one fixed harmless n8n
// diagnostic workflow, OR one fixed n8n → Ollama diagnostic chain, OR one fixed
// registered-agent → model dry-run, OR one fixed built-in read-only runtime
// health tool (n8n /healthz + Ollama /api/tags, GET only), OR creates one fixed
// diagnostic task + run + six steps that dispatch that same read-only tool,
// through the existing private runtime bridge, and reads back signed evidence.
// It also verifies (cloud-side only, never contacting HAL) that the fixed
// diagnostic agent is denied access to a registry-only diagnostic tool (denial
// probe) and, separately, that an explicit read-only grant for that same
// diagnostic tool is resolved as AUTHORIZED without any tool execution (grant
// probe). It NEVER executes an arbitrary n8n workflow, performs arbitrary
// inference, runs an arbitrary agent, creates an arbitrary run/task, calls a
// tool, retrieves knowledge, sends notifications, runs schedules, reads
// business data, or mutates data.
//
// The probes are STRICTLY constrained (fail-closed):
//   * Ollama: only prompt_id = dfp_ollama_ping_v1, model = qwen2.5-coder:7b.
//   * n8n:    only probe_id = dfp_n8n_ping_v1, one fixed diagnostic workflow.
//   * chain:  only probe_id = dfp_runtime_chain_v1 (n8n then Ollama, fixed).
//   * agent:  only probe_id = dfp_agent_dry_run_v1, diagnostic agent
//             dfp-runtime-diagnostic-agent → qwen2.5-coder:7b (fixed, zero tools).
//   * denial: only probe_id = dfp_tool_access_denial_v1, fixed diagnostic agent
//             + registry-only diagnostic tool, expected DENIED
//             (tool_permission_missing). Cloud-side only — no HAL/n8n/Ollama.
//   * grant:  only probe_id = dfp_tool_access_grant_v1, fixed diagnostic agent
//             + registry-only diagnostic tool, expected AUTHORIZED
//             (explicit_tool_permission_present), read-only, scope-isolated.
//             Cloud-side only — no HAL/n8n/Ollama, no tool execution.
//   * readonly tool: only probe_id = dfp_readonly_tool_v1, dedicated agent
//             dfp-runtime-readonly-tool-agent → built-in dfp-runtime-health-read-
//             tool (execute grant), operation read_runtime_health_snapshot.
//             Fixed local read-only health read only — no business data, no
//             mutation, no arbitrary HTTP.
//   * diagnostic run: only probe_id = dfp_diagnostic_run_v1, fixed task
//             dfp-runtime-health-diagnostic-task → run → six steps → the same
//             read-only tool dispatch. Sandbox diagnostic only — no arbitrary
//             task/agent/tool/payload, no business data, no mutation.
//   * probe_mode is always "sandbox_diagnostic" (or "authorization_diagnostic"
//     for the denial and grant probes).
//   * Prompt text, model name, workflow reference, agent identity, tool identity,
//     task identity, operation and payload are generated SERVER-SIDE only. The
//     browser can NEVER supply them — those inputs are ignored.
//
// SECURITY:
//   * verify_jwt = true -> only authenticated users reach this.
//   * internal_role() gate: owner/admin may queue/run; any internal role
//     (including viewer) may read status only.
//   * Only eighteen allowlisted operations exist. No generic queue-message endpoint.
//   * Probe payloads are strictly limited to safe metadata — no URLs, commands,
//     workflow IDs, arbitrary prompts, SQL, or file paths.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROBE_TTL_MS = 2 * 60_000; // probe expires in 2 minutes
const HEARTBEAT_FRESH_MS = 2 * 60_000; // heartbeat must be < 2 min old

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
]);

const PROBE_MESSAGE_TYPE = "runtime_transport_probe";
const ACK_MESSAGE_TYPE = "runtime_transport_probe_ack";

const OLLAMA_PROBE_MESSAGE_TYPE = "ollama_inference_probe";
const OLLAMA_PROBE_RESULT_MESSAGE_TYPE = "ollama_inference_probe_result";

// The ONLY permitted Ollama diagnostic values — fixed server-side. The browser
// can never override these.
const OLLAMA_PROBE_PROMPT_ID = "dfp_ollama_ping_v1";
const OLLAMA_PROBE_MODEL = "qwen2.5-coder:7b";
const OLLAMA_PROBE_MODE = "sandbox_diagnostic";

const N8N_SANDBOX_PROBE_MESSAGE_TYPE = "n8n_sandbox_probe";
const N8N_SANDBOX_PROBE_RESULT_MESSAGE_TYPE = "n8n_sandbox_probe_result";

// The ONLY permitted n8n diagnostic values — fixed server-side. The browser can
// never override these.
const N8N_SANDBOX_PROBE_ID = "dfp_n8n_ping_v1";
const N8N_SANDBOX_PROBE_MODE = "sandbox_diagnostic";
const N8N_SANDBOX_PROBE_WORKFLOW_ALIAS = "DFP Runtime Sandbox Ping";

// --- Controlled multi-runtime chain probe (Prompt 13) -------------------------
const CHAIN_PROBE_MESSAGE_TYPE = "runtime_chain_probe";
const CHAIN_PROBE_RESULT_MESSAGE_TYPE = "runtime_chain_probe_result";

// The ONLY permitted chain diagnostic values — fixed server-side. The browser
// can never override these.
const CHAIN_PROBE_ID = "dfp_runtime_chain_v1";
const CHAIN_PROBE_MODE = "sandbox_diagnostic";

// --- Controlled registered-agent dry-run probe (Prompt 14) --------------------
const AGENT_DRY_RUN_PROBE_MESSAGE_TYPE = "agent_dry_run_probe";
const AGENT_DRY_RUN_PROBE_RESULT_MESSAGE_TYPE = "agent_dry_run_probe_result";

// The ONLY permitted agent dry-run diagnostic values — fixed server-side. The
// browser can never override these.
const AGENT_DRY_RUN_PROBE_ID = "dfp_agent_dry_run_v1";
const AGENT_DRY_RUN_PROBE_MODE = "sandbox_diagnostic";
const AGENT_DRY_RUN_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const AGENT_DRY_RUN_MODEL = "qwen2.5-coder:7b";

// --- Controlled tool access denial probe (Prompt 15) --------------------------
const TOOL_ACCESS_DENIAL_PROBE_ID = "dfp_tool_access_denial_v1";
const TOOL_ACCESS_DENIAL_PROBE_MODE = "authorization_diagnostic";
const TOOL_ACCESS_DENIAL_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const TOOL_ACCESS_DENIAL_TOOL_KEY = "dfp-runtime-diagnostic-tool";
const TOOL_ACCESS_DENIAL_EXPECTED_DECISION = "denied";
const TOOL_ACCESS_DENIAL_EXPECTED_REASON = "tool_permission_missing";

// --- Controlled tool access grant probe (Prompt 16) ----------------------------
const TOOL_ACCESS_GRANT_PROBE_ID = "dfp_tool_access_grant_v1";
const TOOL_ACCESS_GRANT_PROBE_MODE = "authorization_diagnostic";
const TOOL_ACCESS_GRANT_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const TOOL_ACCESS_GRANT_TOOL_KEY = "dfp-runtime-diagnostic-tool";
const TOOL_ACCESS_GRANT_EXPECTED_DECISION = "authorized";
const TOOL_ACCESS_GRANT_EXPECTED_REASON = "explicit_tool_permission_present";
// Narrow / read-only-equivalent access levels (non-executing) vs broad/executing.
// Prompt 16B — EXACT read only. Any non-read level (restricted/write/execute/
// read_write) is blocked with reason permission_too_broad.
const TOOL_ACCESS_GRANT_NARROW_LEVELS = ["read"];
const TOOL_ACCESS_GRANT_EXECUTING_LEVELS = ["write", "execute", "read_write"];

// --- Controlled read-only tool probe (Prompt 17) -------------------------------
const READONLY_TOOL_PROBE_MESSAGE_TYPE = "readonly_tool_probe";
const READONLY_TOOL_PROBE_RESULT_MESSAGE_TYPE = "readonly_tool_probe_result";
const READONLY_TOOL_PROBE_ID = "dfp_readonly_tool_v1";
const READONLY_TOOL_PROBE_MODE = "sandbox_diagnostic";
const READONLY_TOOL_PROBE_AGENT_KEY = "dfp-runtime-readonly-tool-agent";
const READONLY_TOOL_PROBE_TOOL_KEY = "dfp-runtime-health-read-tool";
const READONLY_TOOL_PROBE_TOOL_OPERATION = "read_runtime_health_snapshot";
// Invocation requires the execute access level (read is non-invoking per Prompt
// 16). This dedicated agent holds exactly one isolated execute grant.
const READONLY_TOOL_PROBE_PERMISSION = "execute";

// --- Controlled runtime-backed diagnostic run (Prompt 18) ----------------------
// The FIRST real AI Operations task/run lifecycle. A fixed diagnostic task
// (dfp-runtime-health-diagnostic-task) → run → six deterministic steps → one
// fixed read-only tool dispatch through HAL → signed result → run verification →
// audit close. Reuses the Prompt 17 dedicated identity and callable tool. No
// arbitrary task/agent/tool/payload, no business data, no mutation, no model
// inference. Normal execution stays BLOCKED.
const DIAGNOSTIC_RUN_QUEUE_MESSAGE_TYPE = "diagnostic_run_tool_probe";
const DIAGNOSTIC_RUN_RESULT_MESSAGE_TYPE = "diagnostic_run_tool_probe_result";
const DIAGNOSTIC_RUN_PROBE_ID = "dfp_diagnostic_run_v1";
const DIAGNOSTIC_RUN_PROBE_MODE = "sandbox_diagnostic";
const DIAGNOSTIC_RUN_TASK_KEY = "dfp-runtime-health-diagnostic-task";
const DIAGNOSTIC_RUN_TASK_NAME = "DFP Runtime Health Diagnostic Task";
const DIAGNOSTIC_RUN_TASK_TYPE = "runtime_health_diagnostic";
const DIAGNOSTIC_RUN_KEY_PREFIX = "dfp-diagnostic-run-";
// Reuses the Prompt 17 dedicated identity + callable tool.
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

// Lazily expire any pending/delivered probe whose expires_at has passed.
// Idempotent — only transitions a row that is still pending/delivered.
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

// Resolve the most reachable, freshly-heartbeating bridge node. Shared by all
// queue operations.
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

// Resolve the fixed diagnostic agent from the existing registry (fail closed).
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

// Resolve the diagnostic agent's model assignment through the existing registry
// and confirm it resolves to the fixed local model. Fail closed on any mismatch.
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

// Resolve the fixed registry-only diagnostic tool (fail closed).
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

// Resolve any ACTIVE agent→tool access grant between the diagnostic agent and
// the diagnostic tool. Returns the grant row if present, else null.
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

// Resolve the master kill switch control (must remain ON with execution blocked).
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

// Record safe denial-probe audit evidence. Only safe identifiers — no secrets,
// no endpoints, no credentials, no prompt/business data.
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

// Record safe grant-probe audit evidence. Only safe identifiers — no secrets,
// no endpoints, no credentials, no prompt/business data.
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

// Resolve the active agent→tool access grants (full rows with access_level).
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

// Resolve ALL active tool grants for an agent (for the negative isolation check).
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

// Resolve the dedicated read-only tool execution agent (Prompt 17). Fail closed.
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

// Resolve the fixed callable read-only diagnostic tool (Prompt 17). It must have
// no credential and no endpoint (built-in HAL tool only).
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

    // Prompt 16A — strict tool-grant isolation gate for Prompt 14.
    // Prompt 14 may proceed only when the diagnostic agent has either:
    //   A. ZERO active tool grants, OR
    //   B. EXACTLY ONE active grant matching the exact Prompt 16 diagnostic grant
    //      (dfp-runtime-diagnostic-agent → dfp-runtime-diagnostic-tool, access_level="read").
    // Anything else fails closed. No tool is executed; no HAL/n8n/Ollama is contacted.

    // 1) Resolve the fixed diagnostic tool and confirm it remains non-executable.
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

    // 2) Query ALL active tool grants for the diagnostic agent (fail-closed).
    const { data: agentGrantRows } = await admin
      .from("ai_tool_agent_access")
      .select("id, connection_id, access_level")
      .eq("agent_id", agent.id as string)
      .eq("is_active", true);
    const agentGrants = agentGrantRows ?? [];

    // Multiple or duplicate active grants → reject.
    if (agentGrants.length > 1) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high", actor,
        `Agent dry-run queue rejected: diagnostic agent holds multiple active tool grants. No agent dry-run queued.`);
      return json({ error: "Diagnostic agent must hold at most one active tool grant.", detail: "tool_access_scope_invalid" }, 409);
    }

    // Exactly one active grant → allow ONLY the exact Prompt 16 read grant.
    if (agentGrants.length === 1) {
      const grant = agentGrants[0];
      const isExactDiagGrant =
        grant.connection_id === diagTool.id && str(grant.access_level) === "read";

      if (!isExactDiagGrant) {
        // Unrelated tool grant → scope invalid; matching tool but broader level → executing/broad.
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
        agentId: agent.id as string,
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

    // Negative isolation check — the agent must hold no OTHER active grant, and
    // no broad/wildcard grant. Registry inspection only (no tool calls).
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

    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    // 1) Dedicated agent must exist, be active, and have autonomy none.
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

    // 2) Fixed callable tool must exist with no credential and no endpoint.
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

    // 3) Exactly one active grant for this agent, pointing to this tool only, with
    //    the exact invocation permission (execute). No unrelated grants allowed.
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

    // 4) Master kill switch must remain ON with execution blocked.
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
  //   Creates the FIRST persisted AI Operations task/run lifecycle. Strict
  //   isolation validation before queueing: caller owner/admin, master kill
  //   switch ON / execution blocked, fresh HAL heartbeat, fixed agent active +
  //   autonomy none, fixed callable tool with no credential/endpoint, exactly one
  //   active execute grant to this tool only, and no other active diagnostic run
  //   of this type. Then creates one task + one run + six deterministic steps and
  //   queues ONE fixed HAL message (diagnostic_run_tool_probe). No tool is invoked
  //   here — the outbound message instructs HAL to run the fixed read-only tool.
  // ===========================================================================
  if (operation === "queue_diagnostic_run") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to queue a diagnostic run." }, 403);

    // 2) Master kill switch must remain ON with execution blocked.
    const master = await resolveMasterKillSwitch(admin);
    if (!master || master.enabled !== true || master.execution_allowed !== false) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high", actor,
        `Diagnostic run queue rejected: master kill switch not in required ON / execution-blocked state.`);
      return json({ error: "Master kill switch is not in the required ON / execution-blocked state.", detail: "kill_switch_state_invalid" }, 409);
    }

    // 5) HAL bridge must be fresh/reachable.
    const node = await resolveNode(admin, str(body.node_key));
    if (!node) {
      return json({
        error: "No reachable, freshly-heartbeating bridge node found.",
        detail: "queue_blocked",
      }, 404);
    }

    // 6) Fixed agent must exist, be active, and have autonomy none.
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

    // 7) Fixed callable tool must exist with no credential and no endpoint.
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

    // 11–13) Exactly one active execute grant for this agent → this tool only.
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

    // 15) No other active diagnostic run of this exact type already running.
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
    const probeKey = uid("DRP");

    // 1) CREATE TASK RECORD (existing ai_tasks schema).
    const taskInsert = {
      task_key: DIAGNOSTIC_RUN_TASK_KEY,
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

    // 2) CREATE RUN RECORD (existing ai_runs schema).
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

    // 3) CREATE DETERMINISTIC RUN STEPS. Steps 1–4 are validated/dispatched
    //    synchronously at queue time; steps 5–6 await the signed result.
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

    // 4) QUEUE ONE FIXED HAL MESSAGE (diagnostic_run_tool_probe).
    const safePayload = {
      probe_key: probeKey,
      probe_id: DIAGNOSTIC_RUN_PROBE_ID,
      correlation_id: correlationId,
      task_reference: DIAGNOSTIC_RUN_TASK_KEY,
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
      `Diagnostic run ${runKey} queued (task=${DIAGNOSTIC_RUN_TASK_KEY}, agent=${DIAGNOSTIC_RUN_AGENT_KEY}, tool=${DIAGNOSTIC_RUN_TOOL_KEY}, operation=${DIAGNOSTIC_RUN_TOOL_OPERATION}). Sandbox diagnostic only — no business data, no mutation.`,
      correlationId);

    await auditEvent(admin, "diagnostic_run_started", "success", "low", actor,
      `Diagnostic run ${runKey} started (${DIAGNOSTIC_RUN_STEPS.length} deterministic steps created, fixed read-only tool dispatched). Sandbox diagnostic only.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_diagnostic_run",
      taskKey: DIAGNOSTIC_RUN_TASK_KEY,
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
      .eq("task_key", DIAGNOSTIC_RUN_TASK_KEY)
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

  return json({ error: "Unknown operation." }, 422);
});
