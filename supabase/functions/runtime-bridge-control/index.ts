import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge-control — authenticated internal-staff control endpoint for
// the private runtime transport probe (Phase 3 Prompt 10), the controlled
// Ollama sandbox inference probe (Phase 3 Prompt 11A), the controlled n8n
// sandbox workflow probe (Phase 3 Prompt 12), and the controlled multi-runtime
// chain probe (Phase 3 Prompt 13).
//
// This is TRANSPORT TESTING + THREE SINGLE FIXED DIAGNOSTIC PINGS only. It queues
// a safe dry-run transport probe, OR one fixed harmless Ollama generation, OR
// one fixed harmless n8n diagnostic workflow, OR one fixed n8n → Ollama
// diagnostic chain, through the existing private runtime bridge, and reads back
// signed evidence. It NEVER executes an arbitrary n8n workflow, performs
// arbitrary inference, runs an agent, creates a run, calls a tool, retrieves
// knowledge, sends notifications, runs schedules, or mutates business data.
//
// The probes are STRICTLY constrained (fail-closed):
//   * Ollama: only prompt_id = dfp_ollama_ping_v1, model = qwen2.5-coder:7b.
//   * n8n:    only probe_id = dfp_n8n_ping_v1, one fixed diagnostic workflow.
//   * chain:  only probe_id = dfp_runtime_chain_v1 (n8n then Ollama, fixed).
//   * probe_mode is always "sandbox_diagnostic".
//   * Prompt text, model name, workflow reference and payload are generated
//     SERVER-SIDE only. The browser can NEVER supply them — those inputs are
//     ignored.
//
// SECURITY:
//   * verify_jwt = true -> only authenticated users reach this.
//   * internal_role() gate: owner/admin may queue a probe; any internal role
//     (including viewer) may read status only.
//   * Only eight allowlisted operations exist. No generic queue-message endpoint.
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
  //   Queues ONE fixed n8n → Ollama diagnostic chain through the bridge. The
  //   probe_id, mode, workflow reference, model and prompt are FIXED server-side
  //   — the browser can never supply a workflow, URL, model, prompt or payload.
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

    // FIXED safe payload — no workflow ID, no URL, no model, no prompt. The values
    // below are the ONLY ones the local HAL will accept.
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

  return json({ error: "Unknown operation." }, 422);
});
