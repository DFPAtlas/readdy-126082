import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge — secure OUTBOUND-FIRST private-runtime bridge API for DFP AI
// Operations.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, x-dfp-identity, x-dfp-timestamp, x-dfp-nonce, x-dfp-signature-version, x-dfp-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNING_SECRET_NAME = "DFP_RUNTIME_BRIDGE_SIGNING_KEY";
const IDENTITY_KEY = "dfp-local-runtime-bridge";
const IDENTITY_TYPE = "internal_runtime";
const SOURCE_SYSTEM = "dfp_runtime_bridge";
const SIGNATURE_VERSION = "v1";
const TIMESTAMP_WINDOW_MS = 5 * 60_000; // ±5 minutes
const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const MAX_SUMMARY_CHARS = 500;
const MAX_CATALOGUE_MODELS = 200;
const MAX_NAME_CHARS = 200;
const MAX_META_CHARS = 120;
const PROBE_TTL_MS = 2 * 60_000;

const OLLAMA_PROBE_MESSAGE_TYPE = "ollama_inference_probe";
const OLLAMA_PROBE_RESULT_MESSAGE_TYPE = "ollama_inference_probe_result";
const OLLAMA_PROBE_PROMPT_ID = "dfp_ollama_ping_v1";
const OLLAMA_PROBE_MODEL = "qwen2.5-coder:7b";
const OLLAMA_PROBE_MODE = "sandbox_diagnostic";
const OLLAMA_PROBE_EXPECTED_OUTPUT = "DFP_OLLAMA_SANDBOX_OK";
const MAX_OUTPUT_CHARS = 100;

const N8N_SANDBOX_PROBE_MESSAGE_TYPE = "n8n_sandbox_probe";
const N8N_SANDBOX_PROBE_RESULT_MESSAGE_TYPE = "n8n_sandbox_probe_result";
const N8N_SANDBOX_PROBE_ID = "dfp_n8n_ping_v1";
const N8N_SANDBOX_PROBE_MODE = "sandbox_diagnostic";
const N8N_SANDBOX_PROBE_WORKFLOW_ALIAS = "DFP Runtime Sandbox Ping";
const N8N_SANDBOX_PROBE_STATUS = "DFP_N8N_SANDBOX_OK";
const N8N_SANDBOX_PROBE_EXPECTED_OUTPUT = JSON.stringify({
  status: N8N_SANDBOX_PROBE_STATUS,
  probe: N8N_SANDBOX_PROBE_ID,
});
const MAX_N8N_OUTPUT_CHARS = 200;

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
const AGENT_DRY_RUN_EXPECTED_OUTPUT = "DFP_AGENT_DRY_RUN_OK";
const MAX_AGENT_OUTPUT_CHARS = 100;

const READONLY_TOOL_PROBE_MESSAGE_TYPE = "readonly_tool_probe";
const READONLY_TOOL_PROBE_RESULT_MESSAGE_TYPE = "readonly_tool_probe_result";
const READONLY_TOOL_PROBE_ID = "dfp_readonly_tool_v1";
const READONLY_TOOL_PROBE_MODE = "sandbox_diagnostic";
const READONLY_TOOL_PROBE_AGENT_KEY = "dfp-runtime-readonly-tool-agent";
const READONLY_TOOL_PROBE_TOOL_KEY = "dfp-runtime-health-read-tool";
const READONLY_TOOL_PROBE_TOOL_OPERATION = "read_runtime_health_snapshot";
const READONLY_TOOL_PROBE_PERMISSION = "execute";
const READONLY_TOOL_ALLOWED_SERVICE_STATES = new Set(["healthy", "degraded", "unavailable"]);

const DIAGNOSTIC_RUN_PROBE_MESSAGE_TYPE = "diagnostic_run_tool_probe";
const DIAGNOSTIC_RUN_PROBE_RESULT_MESSAGE_TYPE = "diagnostic_run_tool_probe_result";
const DIAGNOSTIC_RUN_PROBE_ID = "dfp_diagnostic_run_v1";
const DIAGNOSTIC_RUN_PROBE_MODE = "sandbox_diagnostic";
const DIAGNOSTIC_RUN_TASK_KEY = "dfp-runtime-health-diagnostic-task";
const DIAGNOSTIC_RUN_STEP_COUNT = 6;

const APPROVAL_GATED_PROBE_MESSAGE_TYPE = "approval_gated_diagnostic_probe";
const APPROVAL_GATED_PROBE_RESULT_MESSAGE_TYPE = "approval_gated_diagnostic_probe_result";
const APPROVAL_GATED_PROBE_ID = "dfp_approval_run_v1";
const APPROVAL_GATED_PROBE_MODE = "sandbox_diagnostic";
const APPROVAL_GATED_TASK_KEY_PREFIX = "dfp-runtime-health-approval-task";
const APPROVAL_GATED_STEP_COUNT = 6;

const ALLOWED_OPERATIONS = new Set([
  "handshake",
  "heartbeat",
  "report_health",
  "report_capabilities",
  "report_ollama_catalogue",
  "fetch_control_messages",
  "report_transport_probe_ack",
  "report_ollama_inference_probe",
  "report_n8n_sandbox_probe",
  "report_runtime_chain_probe",
  "report_agent_dry_run_probe",
  "report_readonly_tool_probe",
  "report_diagnostic_run_tool_probe",
  "report_approval_gated_diagnostic_probe",
]);

const ALLOWED_CAPABILITIES = new Set([
  "n8n_health",
  "n8n_metadata",
  "ollama_health",
  "ollama_models",
  "signed_callbacks",
  "outbound_https",
]);

const ALLOWED_LOCAL_SERVICES = new Set(["n8n", "ollama", "bridge"]);

const ALLOWED_STATUSES = new Set([
  "healthy", "degraded", "unavailable", "not_configured", "unknown",
]);

const ALLOWED_CONTROL_MESSAGE_TYPES = new Set([
  "health_request",
  "capability_request",
  "ollama_catalogue_request",
  "ollama_catalogue_response",
  "runtime_transport_probe",
  "ollama_inference_probe",
  "n8n_sandbox_probe",
  "runtime_chain_probe",
  "agent_dry_run_probe",
  "readonly_tool_probe",
  "diagnostic_run_tool_probe",
  "approval_gated_diagnostic_probe",
]);

const PROBE_CONTROL_TYPES = new Set([
  "runtime_transport_probe",
  "ollama_inference_probe",
  "n8n_sandbox_probe",
  "runtime_chain_probe",
  "agent_dry_run_probe",
  "readonly_tool_probe",
  "diagnostic_run_tool_probe",
  "approval_gated_diagnostic_probe",
]);

const ALLOWED_PROBE_ACK_STATUSES = new Set(["verified", "rejected"]);

const ALLOWED_RESULT_STATUSES = new Set(["completed", "failed", "rejected"]);

const ALLOWED_CATALOGUE_CLASSIFICATIONS = new Set(["local", "remote"]);

const enc = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeIpClass(v: unknown): string | null {
  const s = str(v);
  const allowed = new Set(["private", "tailscale", "local", "cloud", "unknown"]);
  return allowed.has(s) ? s : null;
}

async function auditEvent(
  admin: ReturnType<typeof createClient>,
  eventType: string,
  outcome: string,
  severity: string,
  notes: string,
  extra: Record<string, unknown> = {},
) {
  await admin.from("ai_audit_events").insert({
    audit_key: uid("BRG"),
    occurred_at: new Date().toISOString(),
    event_type: eventType,
    action: "runtime_bridge",
    outcome,
    severity,
    actor_type: "system",
    actor_reference: IDENTITY_KEY,
    trigger_source: "machine",
    environment: "production",
    notes,
    ...extra,
  });
}

function sanitiseCatalogueModel(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const name = str(m.name).slice(0, MAX_NAME_CHARS);
  if (!name) return null;

  const family = str(m.family).slice(0, MAX_META_CHARS) || null;
  const parameterSize = str(m.parameter_size).slice(0, MAX_META_CHARS) || null;
  const quantization = str(m.quantization).slice(0, MAX_META_CHARS) || null;
  const modifiedAt = str(m.modified_at) || null;
  const classification = ALLOWED_CATALOGUE_CLASSIFICATIONS.has(str(m.classification))
    ? str(m.classification)
    : (/[:\s]cloud$/i.test(name) ? "remote" : "local");

  return {
    name,
    family,
    parameter_size: parameterSize,
    quantization,
    classification,
    modified_at: modifiedAt,
  };
}

function normaliseModelName(s: string): string {
  return s.trim().toLowerCase();
}

async function compareCatalogueToRegistry(
  admin: ReturnType<typeof createClient>,
  models: Record<string, unknown>[],
): Promise<{ present: number; missing: number; unregistered: number }> {
  const { data: regRows } = await admin
    .from("ai_operations_models")
    .select("name, model_reference, display_name, hosting_type, is_active")
    .eq("hosting_type", "local")
    .eq("is_active", true);

  const localNames = new Set(models.map((m) => normaliseModelName(str(m.name))));
  const localBases = new Map<string, string>();
  for (const m of models) {
    const name = str(m.name);
    const base = name.split(":")[0] ?? "";
    if (base) localBases.set(normaliseModelName(base), name);
  }

  let present = 0;
  let missing = 0;
  for (const row of regRows ?? []) {
    const keys = [row.name, row.model_reference, row.display_name]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map(normaliseModelName);
    const exact = keys.some((k) => localNames.has(k));
    const familyMatch = keys.some((k) => localBases.has(k));
    if (exact || familyMatch) present += 1;
    else missing += 1;
  }

  const regKeySet = new Set<string>();
  for (const row of regRows ?? []) {
    for (const k of [row.name, row.model_reference, row.display_name]) {
      if (typeof k === "string" && k.trim().length > 0) {
        regKeySet.add(normaliseModelName(k));
        regKeySet.add(normaliseModelName(k.split(":")[0] ?? ""));
      }
    }
  }
  const localEntries = models.filter((m) => str(m.classification) === "local");
  const unregistered = localEntries.filter((m) => {
    const n = normaliseModelName(str(m.name));
    const base = normaliseModelName((str(m.name).split(":")[0] ?? ""));
    return !regKeySet.has(n) && !regKeySet.has(base);
  }).length;

  return { present, missing, unregistered };
}

async function validateDiagnosticAgentAndModel(
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; detail: string | null }> {
  const { data: agentRows } = await admin
    .from("ai_operations_agents")
    .select("id, agent_key, status, is_active")
    .eq("agent_key", AGENT_DRY_RUN_AGENT_KEY)
    .eq("is_active", true)
    .in("status", ["active", "registered"])
    .limit(1);
  const agent = agentRows && agentRows.length > 0 ? agentRows[0] : null;
  if (!agent) return { ok: false, detail: "diagnostic_agent_invalid" };

  const { data: assignRows } = await admin
    .from("ai_agent_model_assignments")
    .select("model_id")
    .eq("agent_id", agent.id)
    .eq("is_active", true)
    .limit(1);
  const assignment = assignRows && assignRows.length > 0 ? assignRows[0] : null;
  if (!assignment) return { ok: false, detail: "model_assignment_missing" };

  const { data: modelRows } = await admin
    .from("ai_operations_models")
    .select("id, model_reference, name, status, is_active")
    .eq("id", assignment.model_id)
    .eq("is_active", true)
    .in("status", ["available", "active"])
    .limit(1);
  const model = modelRows && modelRows.length > 0 ? modelRows[0] : null;
  if (!model) return { ok: false, detail: "model_inactive_or_missing" };

  const reference = (typeof model.model_reference === "string" && str(model.model_reference)
    ? model.model_reference
    : model.name)?.trim();
  if (reference !== AGENT_DRY_RUN_MODEL) return { ok: false, detail: "model_reference_mismatch" };

  return { ok: true, detail: null };
}

async function validateReadonlyToolGrant(
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; detail: string | null }> {
  const { data: agentRows } = await admin
    .from("ai_operations_agents")
    .select("id, agent_key, status, is_active, autonomy_level")
    .eq("agent_key", READONLY_TOOL_PROBE_AGENT_KEY)
    .eq("is_active", true)
    .in("status", ["active", "registered"])
    .limit(1);
  const agent = agentRows && agentRows.length > 0 ? agentRows[0] : null;
  if (!agent) return { ok: false, detail: "readonly_tool_agent_invalid" };
  if (str(agent.autonomy_level) !== "none") return { ok: false, detail: "agent_autonomy_invalid" };

  const { data: toolRows } = await admin
    .from("ai_tool_connections")
    .select("id, connection_key, status, is_active, credential_reference, endpoint_reference")
    .eq("connection_key", READONLY_TOOL_PROBE_TOOL_KEY)
    .eq("is_active", true)
    .limit(1);
  const tool = toolRows && toolRows.length > 0 ? toolRows[0] : null;
  if (!tool) return { ok: false, detail: "readonly_tool_missing" };
  if (str(tool.credential_reference) || str(tool.endpoint_reference)) return { ok: false, detail: "tool_not_safe" };

  const { data: grantRows } = await admin
    .from("ai_tool_agent_access")
    .select("id, connection_id, access_level")
    .eq("agent_id", agent.id)
    .eq("is_active", true);
  const grants = grantRows ?? [];
  if (grants.length !== 1) return { ok: false, detail: "tool_access_scope_invalid" };
  const grant = grants[0];
  if (grant.connection_id !== tool.id || str(grant.access_level) !== READONLY_TOOL_PROBE_PERMISSION) {
    return { ok: false, detail: "tool_access_scope_invalid" };
  }

  return { ok: true, detail: null };
}

async function validateApprovalGatedApproval(
  admin: ReturnType<typeof createClient>,
  runReference: string,
  approvalReference: string,
  taskReference: string,
  dispatchCreatedAt: string,
): Promise<{ ok: boolean; detail: string | null }> {
  if (!approvalReference) return { ok: false, detail: "approval_reference_missing" };

  const { data: approvalRows } = await admin
    .from("ai_approvals")
    .select("id, approval_key, status, run_id, decision, decision_at, expires_at, conditions")
    .eq("approval_key", approvalReference)
    .limit(1);
  const approval = approvalRows && approvalRows.length > 0 ? approvalRows[0] : null;
  if (!approval) return { ok: false, detail: "approval_not_found" };
  if (str(approval.status) !== "approved" && str(approval.status) !== "completed") {
    return { ok: false, detail: "approval_not_approved" };
  }
  if (str(approval.decision) !== "approve") return { ok: false, detail: "approval_not_decided" };

  const { data: runRows } = await admin
    .from("ai_runs")
    .select("id, run_key, task_id")
    .eq("run_key", runReference)
    .limit(1);
  const run = runRows && runRows.length > 0 ? runRows[0] : null;
  if (!run) return { ok: false, detail: "run_not_found" };
  if (approval.run_id !== run.id) return { ok: false, detail: "approval_run_mismatch" };

  if (taskReference) {
    const { data: taskRows } = await admin
      .from("ai_tasks")
      .select("id, task_key")
      .eq("id", run.task_id)
      .limit(1);
    const task = taskRows && taskRows.length > 0 ? taskRows[0] : null;
    if (!task || str(task.task_key) !== taskReference) return { ok: false, detail: "approval_task_mismatch" };
  }

  // Prompt 20: decision timestamp must exist and precede dispatch.
  const decisionAt = str(approval.decision_at);
  if (!decisionAt) return { ok: false, detail: "approval_decision_missing" };
  const createdAt = str(dispatchCreatedAt);
  if (createdAt) {
    if (new Date(decisionAt).getTime() > new Date(createdAt).getTime()) {
      return { ok: false, detail: "approval_not_before_dispatch" };
    }
  }

  // Prompt 20: dispatch must have occurred before the approval expiry (legacy-safe).
  const expiresAt = str(approval.expires_at);
  if (expiresAt && createdAt) {
    if (new Date(createdAt).getTime() > new Date(expiresAt).getTime()) {
      return { ok: false, detail: "approval_expired_at_dispatch" };
    }
  }

  // Prompt 20: approval context must be bound to the fixed agent/tool/operation (legacy-safe).
  const conditions = (approval.conditions as Record<string, unknown> | null) ?? {};
  const contextHash = str(conditions.approval_context_hash);
  if (contextHash) {
    if (str(conditions.agent_key) !== READONLY_TOOL_PROBE_AGENT_KEY) return { ok: false, detail: "approval_context_agent_mismatch" };
    if (str(conditions.tool_key) !== READONLY_TOOL_PROBE_TOOL_KEY) return { ok: false, detail: "approval_context_tool_mismatch" };
    if (str(conditions.tool_operation) !== READONLY_TOOL_PROBE_TOOL_OPERATION) return { ok: false, detail: "approval_context_operation_mismatch" };
    if (str(conditions.access_level) !== READONLY_TOOL_PROBE_PERMISSION) return { ok: false, detail: "approval_context_access_mismatch" };
  }

  return { ok: true, detail: null };
}

async function finalizeDiagnosticRun(
  admin: ReturnType<typeof createClient>,
  runKey: string,
  verified: boolean,
  result: {
    n8nStatus: string;
    ollamaStatus: string;
    ollamaModelCount: number | null;
    latencyMs: number | null;
    completedAt: string;
    errorCategory: string | null;
  },
): Promise<string | null> {
  if (!runKey) return null;

  const { data: runRows } = await admin
    .from("ai_runs")
    .select("id, task_id")
    .eq("run_key", runKey)
    .limit(1);
  const run = runRows && runRows.length > 0 ? runRows[0] : null;
  if (!run) return null;

  if (verified) {
    await admin.from("ai_run_steps")
      .update({ status: "completed", completed_at: result.completedAt })
      .eq("run_id", run.id)
      .in("status", ["pending", "working"]);

    const resultSummary =
      `Read-only tool verified: n8n=${result.n8nStatus}, ollama=${result.ollamaStatus}, ` +
      `models=${result.ollamaModelCount === null ? "n/a" : result.ollamaModelCount}, ` +
      `latency=${result.latencyMs === null ? "n/a" : result.latencyMs + "ms"}. Sandbox diagnostic only.`;

    await admin.from("ai_runs").update({
      status: "completed",
      current_step: DIAGNOSTIC_RUN_STEP_COUNT,
      completed_at: result.completedAt,
      result_summary: resultSummary,
      error_summary: null,
      updated_at: result.completedAt,
    }).eq("id", run.id);

    if (run.task_id) {
      await admin.from("ai_tasks").update({
        status: "completed",
        updated_at: result.completedAt,
      }).eq("id", run.task_id);
    }
  } else {
    const errorSummary = result.errorCategory ?? "signed_result_not_verified";

    await admin.from("ai_run_steps")
      .update({ status: "failed", error_summary: errorSummary, completed_at: result.completedAt })
      .eq("run_id", run.id)
      .eq("step_number", 5);

    await admin.from("ai_runs").update({
      status: "failed",
      error_summary: errorSummary,
      completed_at: result.completedAt,
      updated_at: result.completedAt,
    }).eq("id", run.id);

    if (run.task_id) {
      await admin.from("ai_tasks").update({
        status: "failed",
        updated_at: result.completedAt,
      }).eq("id", run.task_id);
    }
  }

  return run.id as string;
}

async function finalizeApprovalGatedRun(
  admin: ReturnType<typeof createClient>,
  runReference: string,
  approvalReference: string,
  verified: boolean,
  result: {
    n8nStatus: string;
    ollamaStatus: string;
    ollamaModelCount: number | null;
    latencyMs: number | null;
    completedAt: string;
    errorCategory: string | null;
  },
): Promise<string | null> {
  if (!runReference) return null;

  const { data: runRows } = await admin
    .from("ai_runs")
    .select("id, task_id")
    .eq("run_key", runReference)
    .limit(1);
  const run = runRows && runRows.length > 0 ? runRows[0] : null;
  if (!run) return null;

  if (verified) {
    await admin.from("ai_run_steps")
      .update({ status: "completed", completed_at: result.completedAt })
      .eq("run_id", run.id)
      .in("status", ["pending", "working", "awaiting_approval"]);

    const resultSummary =
      `Read-only tool verified (approval-gated): n8n=${result.n8nStatus}, ollama=${result.ollamaStatus}, ` +
      `models=${result.ollamaModelCount === null ? "n/a" : result.ollamaModelCount}, ` +
      `latency=${result.latencyMs === null ? "n/a" : result.latencyMs + "ms"}. Sandbox diagnostic only.`;

    await admin.from("ai_runs").update({
      status: "completed",
      current_step: APPROVAL_GATED_STEP_COUNT,
      completed_at: result.completedAt,
      result_summary: resultSummary,
      error_summary: null,
      updated_at: result.completedAt,
    }).eq("id", run.id);

    if (run.task_id) {
      await admin.from("ai_tasks").update({
        status: "completed",
        updated_at: result.completedAt,
      }).eq("id", run.task_id);
    }
  } else {
    const errorSummary = result.errorCategory ?? "signed_result_not_verified";

    await admin.from("ai_run_steps")
      .update({ status: "failed", error_summary: errorSummary, completed_at: result.completedAt })
      .eq("run_id", run.id)
      .eq("step_number", 6);

    await admin.from("ai_runs").update({
      status: "failed",
      error_summary: errorSummary,
      completed_at: result.completedAt,
      updated_at: result.completedAt,
    }).eq("id", run.id);

    if (run.task_id) {
      await admin.from("ai_tasks").update({
        status: "failed",
        updated_at: result.completedAt,
      }).eq("id", run.task_id);
    }
  }

  if (approvalReference) {
    const { data: appRows } = await admin
      .from("ai_approvals")
      .select("id, status")
      .eq("approval_key", approvalReference)
      .limit(1);
    const app = appRows && appRows.length > 0 ? appRows[0] : null;
    if (app) {
      await admin.from("ai_approvals").update({
        status: "completed",
        updated_at: result.completedAt,
      }).eq("id", app.id);

      await admin.from("ai_approval_history").insert({
        approval_id: app.id,
        event_type: "consumed",
        previous_status: str(app.status),
        new_status: "completed",
        decision: null,
        actor_reference: IDENTITY_KEY,
        actor_role: "system",
        reason: verified
          ? "Approval consumed after a verified signed result."
          : "Approval consumed after the authorized single attempt failed.",
        conditions: null,
        approval_count_before: 1,
        approval_count_after: 1,
        created_at: result.completedAt,
      });
    }
  }

  return run.id as string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Message envelope exceeds the 64 KB size limit." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody || "");
  } catch {
    return json({ error: "invalid_message" }, 400);
  }

  const identity = (req.headers.get("x-dfp-identity") ?? "").trim();
  const timestamp = (req.headers.get("x-dfp-timestamp") ?? "").trim();
  const nonce = (req.headers.get("x-dfp-nonce") ?? "").trim();
  const sigVersion = (req.headers.get("x-dfp-signature-version") ?? "").trim();
  const signature = (req.headers.get("x-dfp-signature") ?? "").trim();

  const signingSecret = (Deno.env.get(SIGNING_SECRET_NAME) ?? "").trim();
  if (!signingSecret) {
    return json({ error: "configuration_missing" }, 503);
  }

  if (sigVersion !== SIGNATURE_VERSION) {
    return json({ error: "invalid_message", detail: "unknown_signature_version" }, 400);
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > TIMESTAMP_WINDOW_MS) {
    return json({ error: "stale_timestamp" }, 401);
  }

  const payloadHash = await sha256Hex(rawBody);
  const method = "POST";
  const path = new URL(req.url).pathname;
  const canonical = `${identity}\n${timestamp}\n${nonce}\n${method}\n${path}\n${payloadHash}`;
  const expected = await hmacSha256Hex(signingSecret, canonical);
  const signatureOk = identity && nonce && timingSafeEqual(expected.toLowerCase(), signature.toLowerCase());

  if (!signatureOk) {
    return json({ error: "invalid_signature" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: idRows } = await admin
    .from("ai_runtime_service_identities")
    .select("id, identity_key, identity_type, environment, credential_reference")
    .eq("identity_key", identity)
    .limit(1);
  const idRow = idRows && idRows.length > 0 ? idRows[0] : null;

  const identityValid =
    idRow &&
    idRow.identity_key === IDENTITY_KEY &&
    idRow.identity_type === IDENTITY_TYPE &&
    idRow.credential_reference === SIGNING_SECRET_NAME;

  if (!identityValid) {
    return json({ error: "unknown_identity" }, 403);
  }

  const operation = str(body.operation);
  if (!ALLOWED_OPERATIONS.has(operation)) {
    return json({ error: "unknown_operation" }, 422);
  }

  const messageId = str(body.message_id);
  if (!messageId) return json({ error: "invalid_message", detail: "missing_message_id" }, 400);

  const environment = str(body.environment) || "production";
  if (environment !== (idRow.environment ?? "production")) {
    return json({ error: "invalid_message", detail: "unexpected_environment" }, 400);
  }

  const nonceHash = await sha256Hex(nonce);
  const now = new Date();
  const receivedAt = now.toISOString();

  const { data: dupRows } = await admin
    .from("ai_runtime_bridge_messages")
    .select("message_key, message_id, status")
    .eq("message_id", messageId)
    .limit(1);
  if (dupRows && dupRows.length > 0) {
    return json({
      accepted: true,
      duplicate: true,
      messageKey: dupRows[0].message_key,
      messageId,
      message: "This bridge message was already recorded. No duplicate processing occurred.",
    });
  }

  const { data: nonceRows } = await admin
    .from("ai_runtime_bridge_messages")
    .select("id")
    .eq("nonce_hash", nonceHash)
    .limit(1);
  if (nonceRows && nonceRows.length > 0) {
    await auditEvent(admin, "runtime_bridge_replay_blocked", "blocked", "medium",
      `Replayed bridge nonce detected for identity ${identity}. Message ${messageId}.`);
    return json({ error: "replay_detected" }, 409);
  }

  const nodeKey = str(body.node_key);
  const correlationId = str(body.correlation_id) || null;

  let nodeId: string | null = null;
  let nodeRow: Record<string, unknown> | null = null;
  if (nodeKey) {
    const { data: nodeRows } = await admin
      .from("ai_runtime_bridge_nodes")
      .select("id, node_key, status, last_heartbeat_at, last_seen_at")
      .eq("node_key", nodeKey)
      .limit(1);
    nodeRow = nodeRows && nodeRows.length > 0 ? nodeRows[0] : null;
    nodeId = nodeRow ? (nodeRow.id as string) : null;
  }

  const insertMessage = async (type: string, payloadType: string | null, safePayload: unknown) => {
    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: type,
      correlation_id: correlationId,
      status: "recorded",
      payload_type: payloadType,
      safe_payload: safePayload ?? null,
      payload_hash: payloadHash,
      created_at: receivedAt,
    });
  };

  // ===========================================================================
  // HANDSHAKE
  // ===========================================================================
  if (operation === "handshake") {
    if (!nodeKey) return json({ error: "node_key is required." }, 400);

    const name = str(body.name) || nodeKey;
    const nodeType = str(body.node_type) || "local_runtime";
    const softwareVersion = str(body.software_version) || null;
    const platform = str(body.platform) || null;
    const configurationState = str(body.configuration_state) || "unknown";
    const ipClass = safeIpClass(body.last_ip_class);
    const capabilities = Array.isArray(body.capabilities)
      ? (body.capabilities as string[]).filter((c) => ALLOWED_CAPABILITIES.has(c))
      : [];

    const upsert = {
      node_key: nodeKey,
      name,
      node_type: nodeType,
      environment,
      service_identity_id: idRow.id as string,
      status: "registered",
      connection_mode: "outbound",
      software_version: softwareVersion,
      platform,
      capabilities,
      last_handshake_at: receivedAt,
      last_heartbeat_at: receivedAt,
      last_seen_at: receivedAt,
      last_ip_class: ipClass,
      configuration_state: configurationState,
      execution_enabled: false,
      notes: "Registered via authenticated outbound bridge handshake. Execution disabled (transport only).",
    };

    let resolvedNodeId: string | null = null;
    if (nodeRow) {
      await admin.from("ai_runtime_bridge_nodes").update(upsert).eq("id", nodeRow.id);
      resolvedNodeId = nodeRow.id as string;
    } else {
      const { data: ins } = await admin
        .from("ai_runtime_bridge_nodes")
        .insert(upsert)
        .select("id")
        .single();
      resolvedNodeId = ins ? (ins.id as string) : null;
    }

    if (resolvedNodeId) {
      await admin.from("ai_runtime_bridge_heartbeats").insert({
        heartbeat_key: uid("HB"),
        node_id: resolvedNodeId,
        message_id: messageId,
        received_at: receivedAt,
        bridge_timestamp: receivedAt,
        status: "registered",
        capabilities,
        safe_summary: "Bridge handshake verified (signature + identity + nonce). No execution occurred.",
        payload_hash: payloadHash,
      });
      await insertMessage("handshake_request", "handshake", {
        capabilities,
        software_version: softwareVersion,
        platform,
      });
      await auditEvent(admin, "runtime_bridge_registered", "success", "low",
        `Private runtime bridge node ${nodeKey} registered via authenticated handshake. Execution disabled.`);
      await auditEvent(admin, "runtime_bridge_handshake_verified", "success", "low",
        `Bridge handshake verified for node ${nodeKey} (signature + identity + nonce). No run/agent/workflow executed.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "handshake",
      nodeKey,
      verified: !!resolvedNodeId,
      executionEnabled: false,
      message: "Bridge handshake verified and recorded. Runtime execution remains disabled.",
    });
  }

  if (!nodeKey || !nodeId) {
    return json({ error: "Unknown bridge node — handshake required first." }, 404);
  }

  // ===========================================================================
  // HEARTBEAT
  // ===========================================================================
  if (operation === "heartbeat") {
    const bridgeTimestamp = str(body.bridge_timestamp) || receivedAt;
    const status = ALLOWED_STATUSES.has(str(body.status)) ? str(body.status) : "unknown";
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const n8nStatus = ALLOWED_STATUSES.has(str(body.n8n_status)) ? str(body.n8n_status) : null;
    const ollamaStatus = ALLOWED_STATUSES.has(str(body.ollama_status)) ? str(body.ollama_status) : null;
    const localServices = typeof body.local_services === "object" && body.local_services !== null ? body.local_services : null;
    const capabilities = Array.isArray(body.capabilities)
      ? (body.capabilities as string[]).filter((c) => ALLOWED_CAPABILITIES.has(c))
      : [];
    const safeSummary = typeof body.safe_summary === "string"
      ? body.safe_summary.slice(0, MAX_SUMMARY_CHARS)
      : null;

    const prevSeen = nodeRow?.last_seen_at as string | null | undefined;
    const wasOffline = prevSeen
      ? Date.now() - new Date(prevSeen).getTime() > 5 * 60_000
      : false;

    await admin.from("ai_runtime_bridge_nodes").update({
      last_heartbeat_at: receivedAt,
      last_seen_at: receivedAt,
      status: "reachable",
      capabilities,
      execution_enabled: false,
    }).eq("id", nodeId);

    await admin.from("ai_runtime_bridge_heartbeats").insert({
      heartbeat_key: uid("HB"),
      node_id: nodeId,
      message_id: messageId,
      received_at: receivedAt,
      bridge_timestamp: new Date(bridgeTimestamp).toISOString(),
      status,
      latency_ms: latencyMs,
      n8n_status: n8nStatus,
      ollama_status: ollamaStatus,
      local_services: localServices,
      capabilities,
      safe_summary: safeSummary,
      payload_hash: payloadHash,
    });

    await insertMessage("heartbeat", "status_summary", {
      status,
      latency_ms: latencyMs,
      n8n_status: n8nStatus,
      ollama_status: ollamaStatus,
    });

    if (wasOffline) {
      await auditEvent(admin, "runtime_bridge_recovered", "success", "low",
        `Bridge node ${nodeKey} recovered after being offline/stale (heartbeat resumed). No execution occurred.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "heartbeat",
      nodeKey,
      receivedAt,
      executionEnabled: false,
      message: "Heartbeat recorded. Runtime execution remains disabled.",
    });
  }

  // ===========================================================================
  // REPORT_HEALTH
  // ===========================================================================
  if (operation === "report_health") {
    const checks = Array.isArray(body.checks) ? body.checks : [];
    const rows: Record<string, unknown>[] = [];
    for (const c of checks) {
      const svc = str((c as Record<string, unknown>)?.service);
      if (!ALLOWED_LOCAL_SERVICES.has(svc)) continue;
      const status = ALLOWED_STATUSES.has(str((c as Record<string, unknown>)?.status))
        ? str((c as Record<string, unknown>)?.status)
        : "unknown";
      const latencyMs = typeof (c as Record<string, unknown>)?.latency_ms === "number" ? (c as Record<string, unknown>).latency_ms : null;
      const safeMessage = typeof (c as Record<string, unknown>)?.safe_message === "string"
        ? ((c as Record<string, unknown>).safe_message as string).slice(0, MAX_SUMMARY_CHARS)
        : null;
      rows.push({
        check_key: uid("CHK"),
        sweep_key: null,
        connection_key: `${nodeKey}:${svc}`,
        system_slug: svc,
        category: svc,
        checked_at: receivedAt,
        status,
        reachable: status === "healthy",
        authenticated: null,
        latency_ms: latencyMs,
        configuration_state: status === "not_configured" ? "missing" : "configured",
        error_category: null,
        safe_message: safeMessage,
        environment,
        source: "local_bridge",
        initiated_by: nodeKey,
        trigger_type: "bridge",
      });
    }

    if (rows.length > 0) {
      await admin.from("ai_runtime_health_checks").insert(rows);
    }

    const n8nRow = rows.find((r) => r.system_slug === "n8n");
    const ollamaRow = rows.find((r) => r.system_slug === "ollama");

    await admin.from("ai_runtime_bridge_nodes").update({
      last_seen_at: receivedAt,
      status: "reachable",
      execution_enabled: false,
    }).eq("id", nodeId);

    await insertMessage("health_response", "status_summary", {
      services: rows.map((r) => ({ service: r.system_slug, status: r.status })),
    });

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_health",
      nodeKey,
      recorded: rows.length,
      n8nStatus: n8nRow?.status ?? null,
      ollamaStatus: ollamaRow?.status ?? null,
      executionEnabled: false,
      message: "Local health relayed (sanitised, no secrets). Runtime execution remains disabled.",
    });
  }

  // ===========================================================================
  // REPORT_CAPABILITIES
  // ===========================================================================
  if (operation === "report_capabilities") {
    const capabilities = Array.isArray(body.capabilities)
      ? (body.capabilities as string[]).filter((c) => ALLOWED_CAPABILITIES.has(c))
      : [];

    await admin.from("ai_runtime_bridge_nodes").update({
      capabilities,
      last_seen_at: receivedAt,
      execution_enabled: false,
    }).eq("id", nodeId);

    await insertMessage("capability_response", "capabilities", { capabilities });
    await auditEvent(admin, "runtime_bridge_capabilities_updated", "success", "low",
      `Bridge node ${nodeKey} capabilities updated: ${capabilities.join(", ") || "none"}. Execution disabled.`);

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_capabilities",
      nodeKey,
      capabilities,
      executionEnabled: false,
      message: "Capabilities updated (allowlisted only). Runtime execution remains disabled.",
    });
  }

  // ===========================================================================
  // REPORT_OLLAMA_CATALOGUE
  // ===========================================================================
  if (operation === "report_ollama_catalogue") {
    const rawModels = Array.isArray(body.models) ? (body.models as unknown[]) : [];
    const catalogueAt = str(body.catalogue_at) || receivedAt;

    const models = rawModels
      .map(sanitiseCatalogueModel)
      .filter((m): m is Record<string, unknown> => m !== null)
      .slice(0, MAX_CATALOGUE_MODELS);

    const safePayload = {
      source: "local_bridge",
      catalogue_at: catalogueAt,
      model_count: models.length,
      models,
    };

    await admin.from("ai_runtime_bridge_nodes").update({
      last_seen_at: receivedAt,
      status: "reachable",
      execution_enabled: false,
    }).eq("id", nodeId);

    await insertMessage("ollama_catalogue_response", "ollama_catalogue", safePayload);

    const comparison = await compareCatalogueToRegistry(admin, models);

    await auditEvent(admin, "ollama_catalogue_verified", "success", "low",
      `Local Ollama catalogue relayed via bridge: ${models.length} model(s), ` +
      `${comparison.present} registered+present, ${comparison.missing} registered+missing, ` +
      `${comparison.unregistered} present+unregistered. Catalogue only — no inference occurred.`);

    if (comparison.missing > 0 || comparison.unregistered > 0) {
      await auditEvent(admin, "ollama_registry_mismatch_detected", "review_required", "medium",
        `Ollama catalogue ↔ model registry mismatch: ${comparison.missing} registered model(s) missing locally, ` +
        `${comparison.unregistered} local model(s) not registered. Registry NOT auto-mutated (no pull, no registration).`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_ollama_catalogue",
      nodeKey,
      modelCount: models.length,
      registeredPresent: comparison.present,
      registeredMissing: comparison.missing,
      presentUnregistered: comparison.unregistered,
      executionEnabled: false,
      message: "Sanitised Ollama catalogue relayed (catalogue only — no inference). Registry not mutated.",
    });
  }

  // ===========================================================================
  // FETCH_CONTROL_MESSAGES
  // ===========================================================================
  if (operation === "fetch_control_messages") {
    const { data: pending } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, message_type, correlation_id, payload_type, safe_payload, created_at")
      .eq("node_id", nodeId)
      .eq("direction", "outbound")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    const messages = (pending ?? []).filter((m) =>
      ALLOWED_CONTROL_MESSAGE_TYPES.has(m.message_type as string),
    );

    if (messages.length > 0) {
      const probeKeys = messages
        .filter((m) => PROBE_CONTROL_TYPES.has(m.message_type as string))
        .map((m) => m.message_key);
      const otherKeys = messages
        .filter((m) => !PROBE_CONTROL_TYPES.has(m.message_type as string))
        .map((m) => m.message_key);

      if (probeKeys.length > 0) {
        await admin.from("ai_runtime_bridge_messages").update({
          status: "delivered",
          acknowledged_at: receivedAt,
        }).in("message_key", probeKeys);
      }
      if (otherKeys.length > 0) {
        await admin.from("ai_runtime_bridge_messages").update({
          status: "acknowledged",
          acknowledged_at: receivedAt,
        }).in("message_key", otherKeys);
      }
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "fetch_control_messages",
      nodeKey,
      messages: messages.map((m) => ({
        messageKey: m.message_key,
        messageType: m.message_type,
        correlationId: m.correlation_id,
        payloadType: m.payload_type,
        safePayload: m.safe_payload,
        createdAt: m.created_at,
      })),
      executionEnabled: false,
      message: "Pending control messages returned (allowlisted types only). No execution control exists.",
    });
  }

  // ===========================================================================
  // REPORT_TRANSPORT_PROBE_ACK
  // ===========================================================================
  if (operation === "report_transport_probe_ack") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const ackCorrelationId = str(body.correlation_id);
    const receivedAtLocal = str(body.received_at);
    const acknowledgedAtLocal = str(body.acknowledged_at) || receivedAtLocal || receivedAt;
    const ackStatus = ALLOWED_PROBE_ACK_STATUSES.has(str(body.status)) ? str(body.status) : "rejected";
    const summary = str(body.summary).slice(0, MAX_SUMMARY_CHARS) || "Transport probe acknowledgement.";

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for a transport probe ack." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", "runtime_transport_probe")
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "runtime_transport_probe_rejected", "rejected", "medium",
        `Transport probe ack rejected: no matching outbound probe for key ${originalMessageKey}. No execution occurred.`);
      return json({ error: "Original transport probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "runtime_transport_probe_rejected", "rejected", "high",
        `Transport probe ack rejected: node mismatch for probe ${probeKey || originalMessageKey}. No execution occurred.`);
      return json({ error: "Probe ack node does not match the originating node." }, 403);
    }
    if (ackCorrelationId && (orig.correlation_id as string | null) !== ackCorrelationId) {
      await auditEvent(admin, "runtime_transport_probe_rejected", "rejected", "high",
        `Transport probe ack rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. No execution occurred.`);
      return json({ error: "Probe ack correlation ID does not match." }, 409);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && orig.status !== "acknowledged") {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "runtime_transport_probe_expired", "expired", "low",
        `Transport probe ${probeKey || originalMessageKey} expired before a valid acknowledgement. No execution occurred.`);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_transport_probe_ack",
        status: "expired",
        executionEnabled: false,
        message: "Transport probe expired — acknowledgement not accepted.",
      });
    }

    if (orig.status === "acknowledged") {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_transport_probe_ack",
        status: "acknowledged",
        executionEnabled: false,
        message: "Transport probe already acknowledged — no duplicate evidence created.",
      });
    }

    const finalStatus = ackStatus === "verified" ? "acknowledged" : "rejected";

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: acknowledgedAtLocal,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: "runtime_transport_probe_ack",
      correlation_id: ackCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "transport_probe_ack",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        received_at: receivedAtLocal,
        status: ackStatus,
        summary,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    if (finalStatus === "acknowledged") {
      await auditEvent(admin, "runtime_transport_probe_verified", "success", "low",
        `Transport probe ${probeKey || originalMessageKey} verified via signed acknowledgement. Transport only — no execution occurred.`);
    } else {
      await auditEvent(admin, "runtime_transport_probe_rejected", "rejected", "medium",
        `Transport probe ${probeKey || originalMessageKey} rejected by bridge (${summary}). No execution occurred.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_transport_probe_ack",
      status: finalStatus,
      duplicate: false,
      executionEnabled: false,
      message: finalStatus === "acknowledged"
        ? "Transport probe acknowledged — no execution performed."
        : "Transport probe rejected — no execution performed.",
    });
  }

  // ===========================================================================
  // REPORT_OLLAMA_INFERENCE_PROBE
  // ===========================================================================
  if (operation === "report_ollama_inference_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const promptId = str(body.prompt_id);
    const model = str(body.model);
    const probeMode = str(body.probe_mode);
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const output = str(body.output).slice(0, MAX_OUTPUT_CHARS);
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const generatedAt = str(body.generated_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for an Ollama inference probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", OLLAMA_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "ollama_inference_probe_rejected", "rejected", "medium",
        `Ollama probe result rejected: no matching outbound probe for key ${originalMessageKey}. No inference occurred.`);
      return json({ error: "Original Ollama inference probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "ollama_inference_probe_rejected", "rejected", "high",
        `Ollama probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. No inference occurred.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "ollama_inference_probe_rejected", "rejected", "high",
        `Ollama probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. No inference occurred.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (promptId && promptId !== OLLAMA_PROBE_PROMPT_ID) {
      await auditEvent(admin, "ollama_inference_probe_rejected", "rejected", "high",
        `Ollama probe result rejected: unexpected prompt_id ${promptId} for probe ${probeKey || originalMessageKey}. No inference occurred.`);
      return json({ error: "Unexpected prompt_id — probe result rejected." }, 422);
    }
    if (model && model !== OLLAMA_PROBE_MODEL) {
      await auditEvent(admin, "ollama_inference_probe_rejected", "rejected", "high",
        `Ollama probe result rejected: unexpected model ${model} for probe ${probeKey || originalMessageKey}. No inference occurred.`);
      return json({ error: "Unexpected model — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "ollama_inference_probe_expired", "expired", "low",
        `Ollama probe ${probeKey || originalMessageKey} expired before a valid result. No inference recorded.`);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_ollama_inference_probe",
        status: "expired",
        executionEnabled: false,
        message: "Ollama probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_ollama_inference_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "Ollama probe already recorded — no duplicate evidence created.",
      });
    }

    const verified = output.trim() === OLLAMA_PROBE_EXPECTED_OUTPUT;
    const finalStatus = verified && resultStatus === "completed" ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: generatedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: OLLAMA_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "ollama_inference_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        prompt_id: promptId || OLLAMA_PROBE_PROMPT_ID,
        model: model || OLLAMA_PROBE_MODEL,
        probe_mode: probeMode || OLLAMA_PROBE_MODE,
        status: finalStatus,
        output,
        verified,
        latency_ms: latencyMs,
        generated_at: generatedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    if (verified) {
      await auditEvent(admin, "ollama_inference_probe_verified", "success", "low",
        `Ollama sandbox diagnostic probe ${probeKey || originalMessageKey} verified — fixed ping returned expected output. No arbitrary inference occurred.`);
    } else {
      await auditEvent(admin, "ollama_inference_probe_failed", "failed", "medium",
        `Ollama sandbox diagnostic probe ${probeKey || originalMessageKey} did not return expected fixed output (status=${finalStatus}). No arbitrary inference occurred.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_ollama_inference_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "Ollama sandbox diagnostic verified — fixed ping returned expected output. No arbitrary inference occurred."
        : "Ollama sandbox diagnostic recorded — no arbitrary inference occurred.",
    });
  }

  // ===========================================================================
  // REPORT_N8N_SANDBOX_PROBE
  // ===========================================================================
  if (operation === "report_n8n_sandbox_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const probeId = str(body.probe_id);
    const probeMode = str(body.probe_mode);
    const workflowReference = str(body.workflow_reference).slice(0, MAX_NAME_CHARS) || N8N_SANDBOX_PROBE_WORKFLOW_ALIAS;
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const safeOutput = str(body.safe_output).slice(0, MAX_N8N_OUTPUT_CHARS);
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const errorCategory = str(body.error_category).slice(0, MAX_META_CHARS) || null;
    const startedAt = str(body.started_at) || receivedAt;
    const completedAt = str(body.completed_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for an n8n sandbox probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", N8N_SANDBOX_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "n8n_sandbox_probe_rejected", "rejected", "medium",
        `n8n sandbox probe result rejected: no matching outbound probe for key ${originalMessageKey}. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Original n8n sandbox probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "n8n_sandbox_probe_rejected", "rejected", "high",
        `n8n sandbox probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "n8n_sandbox_probe_rejected", "rejected", "high",
        `n8n sandbox probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (probeId && probeId !== N8N_SANDBOX_PROBE_ID) {
      await auditEvent(admin, "n8n_sandbox_probe_rejected", "rejected", "high",
        `n8n sandbox probe result rejected: unexpected probe_id ${probeId} for probe ${probeKey || originalMessageKey}. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected probe_id — probe result rejected." }, 422);
    }
    if (probeMode && probeMode !== N8N_SANDBOX_PROBE_MODE) {
      await auditEvent(admin, "n8n_sandbox_probe_rejected", "rejected", "high",
        `n8n sandbox probe result rejected: unexpected probe_mode ${probeMode} for probe ${probeKey || originalMessageKey}. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected probe_mode — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "n8n_sandbox_probe_expired", "expired", "low",
        `n8n sandbox probe ${probeKey || originalMessageKey} expired before a valid result. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_n8n_sandbox_probe",
        status: "expired",
        executionEnabled: false,
        message: "n8n sandbox probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_n8n_sandbox_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "n8n sandbox probe already recorded — no duplicate evidence created.",
      });
    }

    const verified = safeOutput === N8N_SANDBOX_PROBE_EXPECTED_OUTPUT;
    const finalStatus = verified && resultStatus === "completed" ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: completedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: N8N_SANDBOX_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "n8n_sandbox_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        probe_id: probeId || N8N_SANDBOX_PROBE_ID,
        probe_mode: probeMode || N8N_SANDBOX_PROBE_MODE,
        workflow_reference: workflowReference,
        status: finalStatus,
        verified,
        safe_output: safeOutput,
        latency_ms: latencyMs,
        error_category: errorCategory,
        started_at: startedAt,
        completed_at: completedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    if (verified) {
      await auditEvent(admin, "n8n_sandbox_probe_verified", "success", "low",
        `n8n sandbox diagnostic probe ${probeKey || originalMessageKey} verified — fixed diagnostic workflow returned expected deterministic output. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
    } else {
      await auditEvent(admin, "n8n_sandbox_probe_failed", "failed", "medium",
        `n8n sandbox diagnostic probe ${probeKey || originalMessageKey} did not return expected fixed output (status=${finalStatus}). Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_n8n_sandbox_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "n8n sandbox diagnostic verified — fixed workflow returned expected deterministic output. Controlled n8n diagnostic workflow only — no agent, tool, model or business workflow executed."
        : "n8n sandbox diagnostic recorded — controlled diagnostic workflow only, no agent/tool/model/business workflow executed.",
    });
  }

  // ===========================================================================
  // REPORT_RUNTIME_CHAIN_PROBE
  // ===========================================================================
  if (operation === "report_runtime_chain_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const probeId = str(body.probe_id);
    const probeMode = str(body.probe_mode);
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const n8nVerified = body.n8n_verified === true;
    const ollamaVerified = body.ollama_verified === true;
    const verified = body.verified === true && n8nVerified && ollamaVerified;
    const n8nLatencyMs = typeof body.n8n_latency_ms === "number" && body.n8n_latency_ms >= 0 ? body.n8n_latency_ms : null;
    const ollamaLatencyMs = typeof body.ollama_latency_ms === "number" && body.ollama_latency_ms >= 0 ? body.ollama_latency_ms : null;
    const totalLatencyMs = typeof body.total_latency_ms === "number" && body.total_latency_ms >= 0 ? body.total_latency_ms : null;
    const completedSteps = typeof body.completed_steps === "number" && body.completed_steps >= 0 ? body.completed_steps : 0;
    const errorStep = str(body.error_step).slice(0, MAX_META_CHARS) || null;
    const errorCategory = str(body.error_category).slice(0, MAX_META_CHARS) || null;
    const startedAt = str(body.started_at) || receivedAt;
    const completedAt = str(body.completed_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for a runtime chain probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", CHAIN_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "runtime_chain_probe_rejected", "rejected", "medium",
        `Runtime chain probe result rejected: no matching outbound probe for key ${originalMessageKey}. Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Original runtime chain probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "runtime_chain_probe_rejected", "rejected", "high",
        `Runtime chain probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "runtime_chain_probe_rejected", "rejected", "high",
        `Runtime chain probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (probeId && probeId !== CHAIN_PROBE_ID) {
      await auditEvent(admin, "runtime_chain_probe_rejected", "rejected", "high",
        `Runtime chain probe result rejected: unexpected probe_id ${probeId} for probe ${probeKey || originalMessageKey}. Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected probe_id — probe result rejected." }, 422);
    }
    if (probeMode && probeMode !== CHAIN_PROBE_MODE) {
      await auditEvent(admin, "runtime_chain_probe_rejected", "rejected", "high",
        `Runtime chain probe result rejected: unexpected probe_mode ${probeMode} for probe ${probeKey || originalMessageKey}. Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected probe_mode — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "runtime_chain_probe_expired", "expired", "low",
        `Runtime chain probe ${probeKey || originalMessageKey} expired before a valid result. Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_runtime_chain_probe",
        status: "expired",
        executionEnabled: false,
        message: "Runtime chain probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_runtime_chain_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "Runtime chain probe already recorded — no duplicate evidence created.",
      });
    }

    const finalStatus = verified && resultStatus === "completed" ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: completedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: CHAIN_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "runtime_chain_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        probe_id: probeId || CHAIN_PROBE_ID,
        probe_mode: probeMode || CHAIN_PROBE_MODE,
        status: finalStatus,
        verified,
        n8n_verified: n8nVerified,
        ollama_verified: ollamaVerified,
        n8n_latency_ms: n8nLatencyMs,
        ollama_latency_ms: ollamaLatencyMs,
        total_latency_ms: totalLatencyMs,
        completed_steps: completedSteps,
        error_step: errorStep,
        error_category: errorCategory,
        started_at: startedAt,
        completed_at: completedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    if (verified) {
      await auditEvent(admin, "runtime_chain_probe_verified", "success", "low",
        `Runtime chain probe ${probeKey || originalMessageKey} verified — fixed n8n → Ollama diagnostic chain completed successfully. Controlled n8n diagnostic workflow + Ollama sandbox inference only — no agent, tool, model or business workflow executed.`);
    } else {
      await auditEvent(admin, "runtime_chain_probe_failed", "failed", "medium",
        `Runtime chain probe ${probeKey || originalMessageKey} did not fully verify (n8n_verified=${n8nVerified}, ollama_verified=${ollamaVerified}, status=${finalStatus}, error_step=${errorStep ?? "none"}). Controlled n8n → Ollama diagnostic chain only — no agent, tool, model or business workflow executed.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_runtime_chain_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "Runtime chain verified — n8n and Ollama completed the fixed diagnostic chain successfully. No agent, tool or business workflow was executed."
        : "Runtime chain recorded — controlled n8n → Ollama diagnostic chain only, no agent/tool/model/business workflow executed.",
    });
  }

  // ===========================================================================
  // REPORT_AGENT_DRY_RUN_PROBE
  // ===========================================================================
  if (operation === "report_agent_dry_run_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const probeId = str(body.probe_id);
    const probeMode = str(body.probe_mode);
    const diagnosticAgentKey = str(body.diagnostic_agent_key);
    const resolvedModelReference = str(body.resolved_model_reference);
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const safeOutput = str(body.safe_output).slice(0, MAX_AGENT_OUTPUT_CHARS);
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const errorCategory = str(body.error_category).slice(0, MAX_META_CHARS) || null;
    const startedAt = str(body.started_at) || receivedAt;
    const completedAt = str(body.completed_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for an agent dry-run probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", AGENT_DRY_RUN_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "medium",
        `Agent dry-run probe result rejected: no matching outbound probe for key ${originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Original agent dry-run probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high",
        `Agent dry-run probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high",
        `Agent dry-run probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (probeId && probeId !== AGENT_DRY_RUN_PROBE_ID) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high",
        `Agent dry-run probe result rejected: unexpected probe_id ${probeId} for probe ${probeKey || originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected probe_id — probe result rejected." }, 422);
    }
    if (probeMode && probeMode !== AGENT_DRY_RUN_PROBE_MODE) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high",
        `Agent dry-run probe result rejected: unexpected probe_mode ${probeMode} for probe ${probeKey || originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected probe_mode — probe result rejected." }, 422);
    }
    if (diagnosticAgentKey && diagnosticAgentKey !== AGENT_DRY_RUN_AGENT_KEY) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high",
        `Agent dry-run probe result rejected: unexpected diagnostic_agent_key ${diagnosticAgentKey} for probe ${probeKey || originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected diagnostic_agent_key — probe result rejected." }, 422);
    }
    if (resolvedModelReference && resolvedModelReference !== AGENT_DRY_RUN_MODEL) {
      await auditEvent(admin, "agent_dry_run_probe_rejected", "rejected", "high",
        `Agent dry-run probe result rejected: unexpected resolved_model_reference ${resolvedModelReference} for probe ${probeKey || originalMessageKey}. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({ error: "Unexpected resolved_model_reference — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "agent_dry_run_probe_expired", "expired", "low",
        `Agent dry-run probe ${probeKey || originalMessageKey} expired before a valid result. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_agent_dry_run_probe",
        status: "expired",
        executionEnabled: false,
        message: "Agent dry-run probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_agent_dry_run_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "Agent dry-run probe already recorded — no duplicate evidence created.",
      });
    }

    const outputVerified = safeOutput.trim() === AGENT_DRY_RUN_EXPECTED_OUTPUT;
    const recheck = await validateDiagnosticAgentAndModel(admin);

    const verified = outputVerified && recheck.ok && resultStatus === "completed";
    const finalStatus = verified && resultStatus === "completed" ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;
    const finalErrorCategory = !outputVerified ? "output_mismatch"
      : (!recheck.ok ? (recheck.detail ?? "cloud_revalidation_failed") : errorCategory);

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: completedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: AGENT_DRY_RUN_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "agent_dry_run_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        probe_id: probeId || AGENT_DRY_RUN_PROBE_ID,
        probe_mode: probeMode || AGENT_DRY_RUN_PROBE_MODE,
        diagnostic_agent_key: diagnosticAgentKey || AGENT_DRY_RUN_AGENT_KEY,
        resolved_model_reference: resolvedModelReference || AGENT_DRY_RUN_MODEL,
        status: finalStatus,
        verified,
        safe_output: safeOutput,
        latency_ms: latencyMs,
        error_category: finalErrorCategory,
        started_at: startedAt,
        completed_at: completedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    if (verified) {
      await auditEvent(admin, "agent_dry_run_probe_verified", "success", "low",
        `Agent dry-run probe ${probeKey || originalMessageKey} verified — fixed agent → model diagnostic returned expected sentinel and cloud revalidated the registered agent + model assignment. Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
    } else {
      await auditEvent(admin, "agent_dry_run_probe_failed", "failed", "medium",
        `Agent dry-run probe ${probeKey || originalMessageKey} did not verify (status=${finalStatus}, error=${finalErrorCategory ?? "none"}). Controlled agent → model dry-run only — no agent, tool, model or business workflow executed.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_agent_dry_run_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "Registered agent dry-run verified — the diagnostic agent resolved its approved local model and returned the expected sandbox result. No agent, tool or business workflow was executed."
        : "Registered agent dry-run recorded — controlled agent → model dry-run only, no agent/tool/model/business workflow executed.",
    });
  }

  // ===========================================================================
  // REPORT_READONLY_TOOL_PROBE
  // ===========================================================================
  if (operation === "report_readonly_tool_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const probeId = str(body.probe_id);
    const probeMode = str(body.probe_mode);
    const agentKey = str(body.agent_key);
    const toolKey = str(body.tool_key);
    const toolOperation = str(body.tool_operation);
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const n8nStatus = READONLY_TOOL_ALLOWED_SERVICE_STATES.has(str(body.n8n_status)) ? str(body.n8n_status) : "unavailable";
    const ollamaStatus = READONLY_TOOL_ALLOWED_SERVICE_STATES.has(str(body.ollama_status)) ? str(body.ollama_status) : "unavailable";
    const ollamaModelCount = typeof body.ollama_model_count === "number" && body.ollama_model_count >= 0 ? body.ollama_model_count : null;
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const errorCategory = str(body.error_category).slice(0, MAX_META_CHARS) || null;
    const startedAt = str(body.started_at) || receivedAt;
    const completedAt = str(body.completed_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for a read-only tool probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", READONLY_TOOL_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "medium",
        `Read-only tool probe result rejected: no matching outbound probe for key ${originalMessageKey}. No tool executed.`);
      return json({ error: "Original read-only tool probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. No tool executed.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. No tool executed.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (probeId && probeId !== READONLY_TOOL_PROBE_ID) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: unexpected probe_id ${probeId}. No tool executed.`);
      return json({ error: "Unexpected probe_id — probe result rejected." }, 422);
    }
    if (probeMode && probeMode !== READONLY_TOOL_PROBE_MODE) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: unexpected probe_mode ${probeMode}. No tool executed.`);
      return json({ error: "Unexpected probe_mode — probe result rejected." }, 422);
    }
    if (agentKey && agentKey !== READONLY_TOOL_PROBE_AGENT_KEY) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: unexpected agent_key ${agentKey}. No tool executed.`);
      return json({ error: "Unexpected agent_key — probe result rejected." }, 422);
    }
    if (toolKey && toolKey !== READONLY_TOOL_PROBE_TOOL_KEY) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: unexpected tool_key ${toolKey}. No tool executed.`);
      return json({ error: "Unexpected tool_key — probe result rejected." }, 422);
    }
    if (toolOperation && toolOperation !== READONLY_TOOL_PROBE_TOOL_OPERATION) {
      await auditEvent(admin, "readonly_tool_probe_rejected", "rejected", "high",
        `Read-only tool probe result rejected: unexpected tool_operation ${toolOperation}. No tool executed.`);
      return json({ error: "Unexpected tool_operation — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "readonly_tool_probe_expired", "expired", "low",
        `Read-only tool probe ${probeKey || originalMessageKey} expired before a valid result. No tool executed.`);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_readonly_tool_probe",
        status: "expired",
        executionEnabled: false,
        message: "Read-only tool probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_readonly_tool_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "Read-only tool probe already recorded — no duplicate evidence created.",
      });
    }

    const recheck = await validateReadonlyToolGrant(admin);

    const verified = resultStatus === "completed" && recheck.ok;
    const finalStatus = verified ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;
    const finalErrorCategory = !recheck.ok ? (recheck.detail ?? "cloud_revalidation_failed") : errorCategory;

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: completedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: READONLY_TOOL_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "readonly_tool_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        probe_id: probeId || READONLY_TOOL_PROBE_ID,
        probe_mode: probeMode || READONLY_TOOL_PROBE_MODE,
        agent_key: agentKey || READONLY_TOOL_PROBE_AGENT_KEY,
        tool_key: toolKey || READONLY_TOOL_PROBE_TOOL_KEY,
        tool_operation: toolOperation || READONLY_TOOL_PROBE_TOOL_OPERATION,
        status: finalStatus,
        verified,
        n8n_status: n8nStatus,
        ollama_status: ollamaStatus,
        ollama_model_count: ollamaModelCount,
        latency_ms: latencyMs,
        error_category: finalErrorCategory,
        started_at: startedAt,
        completed_at: completedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    if (verified) {
      await auditEvent(admin, "readonly_tool_probe_verified", "success", "low",
        `Read-only tool probe ${probeKey || originalMessageKey} verified — dedicated agent executed the fixed local runtime health read (n8n=${n8nStatus}, ollama=${ollamaStatus}, models=${ollamaModelCount ?? "null"}). No business data, no mutation.`);
    } else {
      await auditEvent(admin, "readonly_tool_probe_failed", "failed", "medium",
        `Read-only tool probe ${probeKey || originalMessageKey} did not verify (status=${finalStatus}, error=${finalErrorCategory ?? "none"}). No business data, no mutation.`);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_readonly_tool_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "Read-only tool verified — fixed local runtime health read executed safely. No business data, no mutation."
        : "Read-only tool recorded — fixed local runtime health read only, no business data, no mutation.",
    });
  }

  // ===========================================================================
  // REPORT_DIAGNOSTIC_RUN_TOOL_PROBE
  // ===========================================================================
  if (operation === "report_diagnostic_run_tool_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const probeId = str(body.probe_id);
    const probeMode = str(body.probe_mode);
    const agentKey = str(body.agent_key);
    const toolKey = str(body.tool_key);
    const toolOperation = str(body.tool_operation);
    const taskReference = str(body.task_reference);
    const runReference = str(body.run_reference);
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const n8nStatus = READONLY_TOOL_ALLOWED_SERVICE_STATES.has(str(body.n8n_status)) ? str(body.n8n_status) : "unavailable";
    const ollamaStatus = READONLY_TOOL_ALLOWED_SERVICE_STATES.has(str(body.ollama_status)) ? str(body.ollama_status) : "unavailable";
    const ollamaModelCount = typeof body.ollama_model_count === "number" && body.ollama_model_count >= 0 ? body.ollama_model_count : null;
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const errorCategory = str(body.error_category).slice(0, MAX_META_CHARS) || null;
    const startedAt = str(body.started_at) || receivedAt;
    const completedAt = str(body.completed_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for a diagnostic run tool probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", DIAGNOSTIC_RUN_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "medium",
        `Diagnostic run tool probe result rejected: no matching outbound probe for key ${originalMessageKey}. No tool executed.`);
      return json({ error: "Original diagnostic run tool probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. No tool executed.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. No tool executed.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (probeId && probeId !== DIAGNOSTIC_RUN_PROBE_ID) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: unexpected probe_id ${probeId}. No tool executed.`);
      return json({ error: "Unexpected probe_id — probe result rejected." }, 422);
    }
    if (probeMode && probeMode !== DIAGNOSTIC_RUN_PROBE_MODE) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: unexpected probe_mode ${probeMode}. No tool executed.`);
      return json({ error: "Unexpected probe_mode — probe result rejected." }, 422);
    }
    if (agentKey && agentKey !== READONLY_TOOL_PROBE_AGENT_KEY) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: unexpected agent_key ${agentKey}. No tool executed.`);
      return json({ error: "Unexpected agent_key — probe result rejected." }, 422);
    }
    if (toolKey && toolKey !== READONLY_TOOL_PROBE_TOOL_KEY) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: unexpected tool_key ${toolKey}. No tool executed.`);
      return json({ error: "Unexpected tool_key — probe result rejected." }, 422);
    }
    if (toolOperation && toolOperation !== READONLY_TOOL_PROBE_TOOL_OPERATION) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: unexpected tool_operation ${toolOperation}. No tool executed.`);
      return json({ error: "Unexpected tool_operation — probe result rejected." }, 422);
    }
    if (taskReference && taskReference !== DIAGNOSTIC_RUN_TASK_KEY) {
      await auditEvent(admin, "diagnostic_run_rejected", "rejected", "high",
        `Diagnostic run tool probe result rejected: unexpected task_reference ${taskReference}. No tool executed.`);
      return json({ error: "Unexpected task_reference — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "diagnostic_run_expired", "expired", "low",
        `Diagnostic run tool probe ${probeKey || originalMessageKey} expired before a valid result. No tool executed.`);
      const expiredRunId = await finalizeDiagnosticRun(admin, runReference, false, {
        n8nStatus, ollamaStatus, ollamaModelCount, latencyMs, completedAt, errorCategory: "expired",
      });
      const expiredExtra = expiredRunId ? { run_id: expiredRunId } : {};
      await auditEvent(admin, "diagnostic_run_failed", "failed", "medium",
        `Diagnostic run ${runReference || "(unknown)"} failed: probe expired before a signed result. No normal execution occurred.`, expiredExtra);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_diagnostic_run_tool_probe",
        status: "expired",
        executionEnabled: false,
        message: "Diagnostic run tool probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_diagnostic_run_tool_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "Diagnostic run tool probe already recorded — no duplicate evidence created.",
      });
    }

    const recheck = await validateReadonlyToolGrant(admin);

    const verified = resultStatus === "completed" && recheck.ok;
    const finalStatus = verified ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;
    const finalErrorCategory = !recheck.ok ? (recheck.detail ?? "cloud_revalidation_failed") : errorCategory;

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: completedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: DIAGNOSTIC_RUN_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "diagnostic_run_tool_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        probe_id: probeId || DIAGNOSTIC_RUN_PROBE_ID,
        probe_mode: probeMode || DIAGNOSTIC_RUN_PROBE_MODE,
        agent_key: agentKey || READONLY_TOOL_PROBE_AGENT_KEY,
        tool_key: toolKey || READONLY_TOOL_PROBE_TOOL_KEY,
        tool_operation: toolOperation || READONLY_TOOL_PROBE_TOOL_OPERATION,
        task_reference: taskReference || DIAGNOSTIC_RUN_TASK_KEY,
        run_reference: runReference,
        status: finalStatus,
        verified,
        n8n_status: n8nStatus,
        ollama_status: ollamaStatus,
        ollama_model_count: ollamaModelCount,
        latency_ms: latencyMs,
        error_category: finalErrorCategory,
        started_at: startedAt,
        completed_at: completedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    const finalizedRunId = await finalizeDiagnosticRun(admin, runReference, verified, {
      n8nStatus, ollamaStatus, ollamaModelCount, latencyMs, completedAt, errorCategory: finalErrorCategory,
    });
    const runExtra = finalizedRunId ? { run_id: finalizedRunId } : {};

    if (verified) {
      await auditEvent(admin, "diagnostic_run_tool_verified", "success", "low",
        `Diagnostic run tool probe ${probeKey || originalMessageKey} verified — fixed read-only tool returned a sanitised snapshot (n8n=${n8nStatus}, ollama=${ollamaStatus}, models=${ollamaModelCount ?? "null"}). No business data, no mutation.`, runExtra);
      await auditEvent(admin, "diagnostic_run_completed", "success", "low",
        `Diagnostic run ${runReference || "(unknown)"} completed — 6 steps closed and signed evidence persisted. Sandbox diagnostic only.`, runExtra);
    } else {
      await auditEvent(admin, "diagnostic_run_failed", "failed", "medium",
        `Diagnostic run ${runReference || "(unknown)"} failed (error=${finalErrorCategory ?? "none"}). No retry, no second tool call, no normal execution.`, runExtra);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_diagnostic_run_tool_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "Diagnostic run tool probe verified — run lifecycle, steps and signed evidence persisted. No business data, no mutation."
        : "Diagnostic run tool probe recorded — sandbox diagnostic only, no business data, no mutation.",
    });
  }

  // ===========================================================================
  // REPORT_APPROVAL_GATED_DIAGNOSTIC_PROBE
  // ===========================================================================
  if (operation === "report_approval_gated_diagnostic_probe") {
    const probeKey = str(body.probe_key);
    const originalMessageKey = str(body.original_message_key);
    const resultCorrelationId = str(body.correlation_id);
    const probeId = str(body.probe_id);
    const probeMode = str(body.probe_mode);
    const agentKey = str(body.agent_key);
    const toolKey = str(body.tool_key);
    const toolOperation = str(body.tool_operation);
    const taskReference = str(body.task_reference);
    const runReference = str(body.run_reference);
    const approvalReference = str(body.approval_reference);
    const resultStatus = ALLOWED_RESULT_STATUSES.has(str(body.status)) ? str(body.status) : "failed";
    const n8nStatus = READONLY_TOOL_ALLOWED_SERVICE_STATES.has(str(body.n8n_status)) ? str(body.n8n_status) : "unavailable";
    const ollamaStatus = READONLY_TOOL_ALLOWED_SERVICE_STATES.has(str(body.ollama_status)) ? str(body.ollama_status) : "unavailable";
    const ollamaModelCount = typeof body.ollama_model_count === "number" && body.ollama_model_count >= 0 ? body.ollama_model_count : null;
    const latencyMs = typeof body.latency_ms === "number" && body.latency_ms >= 0 ? body.latency_ms : null;
    const errorCategory = str(body.error_category).slice(0, MAX_META_CHARS) || null;
    const startedAt = str(body.started_at) || receivedAt;
    const completedAt = str(body.completed_at) || receivedAt;

    if (!originalMessageKey) {
      return json({ error: "original_message_key is required for an approval-gated diagnostic probe result." }, 400);
    }

    const { data: origRows } = await admin
      .from("ai_runtime_bridge_messages")
      .select("message_key, node_id, correlation_id, status, safe_payload, created_at")
      .eq("message_key", originalMessageKey)
      .eq("direction", "outbound")
      .eq("message_type", APPROVAL_GATED_PROBE_MESSAGE_TYPE)
      .limit(1);
    const orig = origRows && origRows.length > 0 ? origRows[0] : null;

    if (!orig) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "medium",
        `Approval-gated diagnostic probe result rejected: no matching outbound probe for key ${originalMessageKey}. No tool executed.`);
      return json({ error: "Original approval-gated diagnostic probe not found." }, 404);
    }

    if ((orig.node_id as string | null) !== nodeId) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: node mismatch for probe ${probeKey || originalMessageKey}. No tool executed.`);
      return json({ error: "Probe result node does not match the originating node." }, 403);
    }
    if (resultCorrelationId && (orig.correlation_id as string | null) !== resultCorrelationId) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: correlation mismatch for probe ${probeKey || originalMessageKey}. No tool executed.`);
      return json({ error: "Probe result correlation ID does not match." }, 409);
    }

    if (probeId && probeId !== APPROVAL_GATED_PROBE_ID) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: unexpected probe_id ${probeId}. No tool executed.`);
      return json({ error: "Unexpected probe_id — probe result rejected." }, 422);
    }
    if (probeMode && probeMode !== APPROVAL_GATED_PROBE_MODE) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: unexpected probe_mode ${probeMode}. No tool executed.`);
      return json({ error: "Unexpected probe_mode — probe result rejected." }, 422);
    }
    if (agentKey && agentKey !== READONLY_TOOL_PROBE_AGENT_KEY) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: unexpected agent_key ${agentKey}. No tool executed.`);
      return json({ error: "Unexpected agent_key — probe result rejected." }, 422);
    }
    if (toolKey && toolKey !== READONLY_TOOL_PROBE_TOOL_KEY) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: unexpected tool_key ${toolKey}. No tool executed.`);
      return json({ error: "Unexpected tool_key — probe result rejected." }, 422);
    }
    if (toolOperation && toolOperation !== READONLY_TOOL_PROBE_TOOL_OPERATION) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: unexpected tool_operation ${toolOperation}. No tool executed.`);
      return json({ error: "Unexpected tool_operation — probe result rejected." }, 422);
    }
    if (!taskReference || !runReference || !approvalReference) {
      await auditEvent(admin, "approval_gated_run_rejected", "rejected", "high",
        `Approval-gated diagnostic probe result rejected: missing task/run/approval reference. No tool executed.`);
      return json({ error: "Missing task/run/approval reference — probe result rejected." }, 422);
    }

    const origPayload = (orig.safe_payload as Record<string, unknown>) ?? {};
    const expiresAt = str(origPayload.expires_at);
    const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

    if (expired && !ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", originalMessageKey);
      await auditEvent(admin, "approval_gated_run_expired", "expired", "low",
        `Approval-gated diagnostic probe ${probeKey || originalMessageKey} expired before a valid result. No tool executed.`);
      const expiredRunId = await finalizeApprovalGatedRun(admin, runReference, approvalReference, false, {
        n8nStatus, ollamaStatus, ollamaModelCount, latencyMs, completedAt, errorCategory: "expired",
      });
      const expiredExtra = {
        ...(expiredRunId ? { run_id: expiredRunId } : {}),
        correlation_id: str(orig.correlation_id) || null,
      };
      await auditEvent(admin, "approval_gated_run_failed", "failed", "medium",
        `Approval-gated run ${runReference || "(unknown)"} failed: probe expired before a signed result. No normal execution occurred.`, expiredExtra);
      return json({
        accepted: true,
        allowed: false,
        blocked: false,
        operation: "report_approval_gated_diagnostic_probe",
        status: "expired",
        executionEnabled: false,
        message: "Approval-gated diagnostic probe expired — result not accepted.",
      });
    }

    if (ALLOWED_RESULT_STATUSES.has(str(orig.status))) {
      return json({
        accepted: true,
        duplicate: true,
        operation: "report_approval_gated_diagnostic_probe",
        status: str(orig.status),
        executionEnabled: false,
        message: "Approval-gated diagnostic probe already recorded — no duplicate evidence created.",
      });
    }

    const grantRecheck = await validateReadonlyToolGrant(admin);
    const approvalRecheck = await validateApprovalGatedApproval(
      admin, runReference, approvalReference, taskReference, str(orig.created_at),
    );

    const verified = resultStatus === "completed" && grantRecheck.ok && approvalRecheck.ok;
    const finalStatus = verified ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;
    const finalErrorCategory = !grantRecheck.ok
      ? (grantRecheck.detail ?? "cloud_revalidation_failed")
      : (!approvalRecheck.ok ? (approvalRecheck.detail ?? "approval_revalidation_failed") : errorCategory);

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: completedAt,
    }).eq("message_key", originalMessageKey);

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: messageId,
      nonce_hash: nonceHash,
      node_id: nodeId,
      direction: "inbound",
      message_type: APPROVAL_GATED_PROBE_RESULT_MESSAGE_TYPE,
      correlation_id: resultCorrelationId || (orig.correlation_id as string | null),
      status: "recorded",
      payload_type: "approval_gated_diagnostic_probe_result",
      safe_payload: {
        probe_key: probeKey,
        original_message_key: originalMessageKey,
        node_key: nodeKey,
        probe_id: probeId || APPROVAL_GATED_PROBE_ID,
        probe_mode: probeMode || APPROVAL_GATED_PROBE_MODE,
        agent_key: agentKey || READONLY_TOOL_PROBE_AGENT_KEY,
        tool_key: toolKey || READONLY_TOOL_PROBE_TOOL_KEY,
        tool_operation: toolOperation || READONLY_TOOL_PROBE_TOOL_OPERATION,
        task_reference: taskReference,
        run_reference: runReference,
        approval_reference: approvalReference,
        status: finalStatus,
        verified,
        n8n_status: n8nStatus,
        ollama_status: ollamaStatus,
        ollama_model_count: ollamaModelCount,
        latency_ms: latencyMs,
        error_category: finalErrorCategory,
        started_at: startedAt,
        completed_at: completedAt,
      },
      payload_hash: payloadHash,
      created_at: receivedAt,
    });

    const finalizedRunId = await finalizeApprovalGatedRun(admin, runReference, approvalReference, verified, {
      n8nStatus, ollamaStatus, ollamaModelCount, latencyMs, completedAt, errorCategory: finalErrorCategory,
    });
    const runExtra = {
      ...(finalizedRunId ? { run_id: finalizedRunId } : {}),
      correlation_id: str(orig.correlation_id) || null,
    };

    if (verified) {
      await auditEvent(admin, "approval_gated_tool_verified", "success", "low",
        `Approval-gated tool probe ${probeKey || originalMessageKey} verified — approved fixed read-only tool returned a sanitised snapshot (n8n=${n8nStatus}, ollama=${ollamaStatus}, models=${ollamaModelCount ?? "null"}). Approval consumed. No business data, no mutation.`, runExtra);
      await auditEvent(admin, "approval_gated_run_completed", "success", "low",
        `Approval-gated run ${runReference || "(unknown)"} completed — 6 steps closed, signed evidence persisted, approval consumed. Sandbox diagnostic only.`, runExtra);
    } else {
      await auditEvent(admin, "approval_gated_run_failed", "failed", "medium",
        `Approval-gated run ${runReference || "(unknown)"} failed (error=${finalErrorCategory ?? "none"}). No retry, no second tool call, no normal execution.`, runExtra);
    }

    return json({
      accepted: true,
      allowed: false,
      blocked: false,
      operation: "report_approval_gated_diagnostic_probe",
      status: finalStatus,
      verified,
      duplicate: false,
      executionEnabled: false,
      message: verified
        ? "Approval-gated tool probe verified — run lifecycle, steps, approval consumption and signed evidence persisted. No business data, no mutation."
        : "Approval-gated tool probe recorded — sandbox diagnostic only, no business data, no mutation.",
    });
  }

  return json({ error: "unknown_operation" }, 422);
});
