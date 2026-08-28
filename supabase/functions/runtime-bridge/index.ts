import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge — secure OUTBOUND-FIRST private-runtime bridge API for DFP AI
// Operations (Phase 3 Prompt 08 + 09C + 10 + 11A + 12 + 13 + 14 + 17).
//
// The trusted server-side endpoint that a local trusted runtime machine (the
// `dfp-runtime-bridge` local service) calls OUTBOUND over HTTPS. The cloud never
// requires direct inbound TCP access to n8n / Ollama / Docker / private LAN.
// This phase is CONNECTIVITY + HEARTBEAT + SAFE HEALTH RELAY + SANITISED OLLAMA
// CATALOGUE RELAY + DRY-RUN TRANSPORT PROBE (Prompt 10) + CONTROLLED OLLAMA
// SANDBOX INFERENCE PROBE (Prompt 11A) + CONTROLLED N8N SANDBOX WORKFLOW PROBE
// (Prompt 12) + CONTROLLED MULTI-RUNTIME CHAIN PROBE (Prompt 13) + CONTROLLED
// REGISTERED-AGENT DRY-RUN PROBE (Prompt 14) + CONTROLLED READ-ONLY TOOL PROBE
// (Prompt 17).
//
// It NEVER:
//   * executes an agent or a business n8n workflow (the ONLY n8n execution is
//     the single fixed `DFP Runtime Sandbox Ping` diagnostic, Prompt 12/13)
//   * performs arbitrary Ollama inference (the ONLY generation allowed is the
//     single fixed dfp_ollama_ping_v1 sandbox diagnostic + the single fixed
//     dfp_agent_dry_run_v1 agent dry-run diagnostic, mapped server-side)
//   * calls a model/tool, retrieves knowledge, sends notifications
//   * creates/updates a Run or mutates orchestration execution state
//   * runs schedules or performs remediation
//   * proxies arbitrary URLs/IPs/ports/files/shell commands
//   * mutates the ai_operations_models registry automatically
//   * reads business/customer data or mutates anything (the ONLY callable tool
//     is the fixed read-only runtime health snapshot, Prompt 17)
//
// Machine authentication (fail-closed, no internal-staff JWT):
//   * Signed headers: X-DFP-Identity, X-DFP-Timestamp, X-DFP-Nonce,
//     X-DFP-Signature-Version, X-DFP-Signature.
//   * Canonical HMAC-SHA256 over identity \n timestamp \n nonce \n method \n
//     path \n payload-hash.
//   * Signing secret = DFP_RUNTIME_BRIDGE_SIGNING_KEY (server-side only).
//   * Service identity `dfp-local-runtime-bridge` revalidated server-side;
//     `execution_enabled` on every node is forced FALSE.
//   * ±5-minute timestamp window, nonce replay protection, idempotent message_id.
//
// Allowlisted operations: handshake, heartbeat, report_health,
// report_capabilities, report_ollama_catalogue, fetch_control_messages,
// report_transport_probe_ack, report_ollama_inference_probe,
// report_n8n_sandbox_probe, report_runtime_chain_probe,
// report_agent_dry_run_probe, report_readonly_tool_probe.
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
const PROBE_TTL_MS = 2 * 60_000; // transport probe expires in 2 minutes

// --- Controlled Ollama sandbox inference probe (Prompt 11A) ------------------
const OLLAMA_PROBE_MESSAGE_TYPE = "ollama_inference_probe";
const OLLAMA_PROBE_RESULT_MESSAGE_TYPE = "ollama_inference_probe_result";
// The ONLY permitted probe values (must match the local HAL exactly).
const OLLAMA_PROBE_PROMPT_ID = "dfp_ollama_ping_v1";
const OLLAMA_PROBE_MODEL = "qwen2.5-coder:7b";
const OLLAMA_PROBE_MODE = "sandbox_diagnostic";
const OLLAMA_PROBE_EXPECTED_OUTPUT = "DFP_OLLAMA_SANDBOX_OK";
const MAX_OUTPUT_CHARS = 100;

// --- Controlled n8n sandbox workflow probe (Prompt 12) ------------------------
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

// --- Controlled multi-runtime chain probe (Prompt 13) -------------------------
const CHAIN_PROBE_MESSAGE_TYPE = "runtime_chain_probe";
const CHAIN_PROBE_RESULT_MESSAGE_TYPE = "runtime_chain_probe_result";
const CHAIN_PROBE_ID = "dfp_runtime_chain_v1";
const CHAIN_PROBE_MODE = "sandbox_diagnostic";

// --- Controlled registered-agent dry-run probe (Prompt 14) --------------------
const AGENT_DRY_RUN_PROBE_MESSAGE_TYPE = "agent_dry_run_probe";
const AGENT_DRY_RUN_PROBE_RESULT_MESSAGE_TYPE = "agent_dry_run_probe_result";
const AGENT_DRY_RUN_PROBE_ID = "dfp_agent_dry_run_v1";
const AGENT_DRY_RUN_PROBE_MODE = "sandbox_diagnostic";
const AGENT_DRY_RUN_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const AGENT_DRY_RUN_MODEL = "qwen2.5-coder:7b";
const AGENT_DRY_RUN_EXPECTED_OUTPUT = "DFP_AGENT_DRY_RUN_OK";
const MAX_AGENT_OUTPUT_CHARS = 100;

// --- Controlled read-only tool probe (Prompt 17) ------------------------------
const READONLY_TOOL_PROBE_MESSAGE_TYPE = "readonly_tool_probe";
const READONLY_TOOL_PROBE_RESULT_MESSAGE_TYPE = "readonly_tool_probe_result";
const READONLY_TOOL_PROBE_ID = "dfp_readonly_tool_v1";
const READONLY_TOOL_PROBE_MODE = "sandbox_diagnostic";
const READONLY_TOOL_PROBE_AGENT_KEY = "dfp-runtime-readonly-tool-agent";
const READONLY_TOOL_PROBE_TOOL_KEY = "dfp-runtime-health-read-tool";
const READONLY_TOOL_PROBE_TOOL_OPERATION = "read_runtime_health_snapshot";
const READONLY_TOOL_PROBE_PERMISSION = "execute";
const READONLY_TOOL_ALLOWED_SERVICE_STATES = new Set(["healthy", "degraded", "unavailable"]);

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
]);

// Allowlisted capabilities only — never shell/arbitrary_http/filesystem/docker.
const ALLOWED_CAPABILITIES = new Set([
  "n8n_health",
  "n8n_metadata",
  "ollama_health",
  "ollama_models",
  "signed_callbacks",
  "outbound_https",
]);

// Allowlisted local service slugs for report_health (no arbitrary targets).
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
]);

// Control messages that have their own distinct signed-result lifecycle (they
// must NOT be marked "acknowledged" on fetch — they await a signed result).
const PROBE_CONTROL_TYPES = new Set([
  "runtime_transport_probe",
  "ollama_inference_probe",
  "n8n_sandbox_probe",
  "runtime_chain_probe",
  "agent_dry_run_probe",
  "readonly_tool_probe",
]);

const ALLOWED_PROBE_ACK_STATUSES = new Set(["verified", "rejected"]);

// Terminal result statuses the HAL may report for an Ollama/n8n/chain/agent/readonly probe.
const ALLOWED_RESULT_STATUSES = new Set(["completed", "failed", "rejected"]);

// Safe Ollama catalogue fields — never prompts / content / credentials / raw config.
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

// --- Sanitised Ollama catalogue helpers (Prompt 09C) --------------------------

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

/** Deterministic catalogue→registry comparison for audit only. Never mutates
 *  the registry. Returns { present, missing, unregistered }. */
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

// Cloud-side revalidation of the diagnostic agent + model assignment. The bridge
// never trusts HAL-supplied values alone — it re-queries the registry before
// marking any agent dry-run result verified.
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

// Cloud-side revalidation of the dedicated read-only tool agent + tool + exact
// isolated execute permission (Prompt 17). The bridge never trusts HAL-supplied
// values alone — it re-queries the registries before marking the result verified.
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- Read raw body (size-limited) ------------------------------------------
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

  // --- Fail closed when signing is not configured ----------------------------
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

  // --- Canonical HMAC-SHA256 signature ---------------------------------------
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

  // --- Server-side service-identity validation -------------------------------
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

  // --- Envelope field validation ---------------------------------------------
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

  // --- Idempotency -----------------------------------------------------------
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

  // --- Replay protection -----------------------------------------------------
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
  // REPORT_OLLAMA_CATALOGUE — relay sanitised local Ollama /api/tags catalogue.
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
  // REPORT_RUNTIME_CHAIN_PROBE — signed combined result for the fixed multi-
  //   runtime diagnostic chain (Prompt 13).
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
  // REPORT_AGENT_DRY_RUN_PROBE — signed result for the fixed registered-agent
  //   dry-run (Prompt 14).
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

    // Exact output verification (no case folding / fuzzy matching).
    const outputVerified = safeOutput.trim() === AGENT_DRY_RUN_EXPECTED_OUTPUT;

    // Cloud independently re-checks the registered diagnostic agent + model
    // assignment before marking the result verified.
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
  // REPORT_READONLY_TOOL_PROBE — signed result for the first callable read-only
  //   tool (Prompt 17). The local HAL reports the sanitised local runtime health
  //   snapshot (n8n /healthz + Ollama /api/tags, GET only). The cloud validates:
  //   correct node, original outbound probe exists, correlation matches, probe_id/
  //   mode/agent_key/tool_key/tool_operation are the fixed values, not expired,
  //   not already recorded. The cloud INDEPENDENTLY re-checks the dedicated agent,
  //   tool, and exact isolated execute permission before marking verified. It
  //   stores ONLY the sanitised snapshot — never raw responses, model names, URLs,
  //   credentials or business data.
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

    // Cloud independently re-validates the dedicated agent + tool + exact isolated
    // execute permission before marking the result verified. Never trust HAL alone.
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

  return json({ error: "unknown_operation" }, 422);
});
