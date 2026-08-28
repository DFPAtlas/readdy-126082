// ============================================================================
// dfp-runtime-bridge — private local runtime bridge for DFP AI Operations.
//
// This is the OUTBOUND-FIRST local runtime component that runs on a trusted DFP
// runtime machine (Docker container or lightweight Deno service). It dials OUT
// over HTTPS to the DFP `runtime-bridge` Edge Function — the cloud NEVER needs
// direct inbound TCP access to n8n, Ollama, Docker, or the private LAN.
//
// THIS PHASE: connectivity + heartbeat + safe local health relay ONLY.
//
// It NEVER:
//   * executes an n8n workflow or calls a webhook
//   * performs arbitrary Ollama inference (except the single fixed sandbox ping)
//   * runs shell commands, arbitrary HTTP, filesystem, or Docker control
//   * decides to execute queued work while offline (fail-closed — no offline
//     execution mode)
//
// Local check targets are configured HERE (N8N_LOCAL_URL / OLLAMA_LOCAL_URL),
// never supplied by the cloud — the cloud cannot instruct the bridge to
// request arbitrary URLs/IPs/ports/files/commands.
//
// Run locally with: deno run --allow-env --allow-net src/main.ts
// ============================================================================

const enc = new TextEncoder();

// --- Config (from environment; secrets never reported to cloud) --------------
const config = {
  endpoint: (Deno.env.get("DFP_BRIDGE_ENDPOINT") ?? "").trim(),
  identity: (Deno.env.get("DFP_BRIDGE_IDENTITY") ?? "dfp-local-runtime-bridge").trim(),
  signingSecret: (Deno.env.get("DFP_BRIDGE_SIGNING_SECRET") ?? "").trim(),
  nodeKey: (Deno.env.get("DFP_BRIDGE_NODE_KEY") ?? "").trim(),
  nodeName: (Deno.env.get("DFP_BRIDGE_NODE_NAME") ?? "").trim(),
  n8nUrl: (Deno.env.get("N8N_LOCAL_URL") ?? "").trim(),
  n8nSandboxWebhookPath: (Deno.env.get("N8N_SANDBOX_WEBHOOK_PATH") ?? "").trim(),
  ollamaUrl: (Deno.env.get("OLLAMA_LOCAL_URL") ?? "").trim(),
  heartbeatSeconds: parseInt(Deno.env.get("HEARTBEAT_INTERVAL_SECONDS") ?? "60", 10),
  pollSeconds: parseInt(Deno.env.get("POLL_INTERVAL_SECONDS") ?? "30", 10),
};

function log(msg: string) {
  console.log(`[dfp-runtime-bridge] ${new Date().toISOString()} ${msg}`);
}

// --- Fail closed on missing required configuration --------------------------
function assertConfig(): boolean {
  const missing: string[] = [];
  if (!config.endpoint) missing.push("DFP_BRIDGE_ENDPOINT");
  if (!config.signingSecret) missing.push("DFP_BRIDGE_SIGNING_SECRET");
  if (!config.nodeKey) missing.push("DFP_BRIDGE_NODE_KEY");
  if (missing.length > 0) {
    log(`FATAL — missing required configuration: ${missing.join(", ")}. The bridge fails closed (no execution, no outbound traffic).`);
    return false;
  }
  return true;
}

// --- Crypto helpers (mirror the cloud canonical signature) -------------------
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

// --- Outbound signed request -------------------------------------------------
// Canonicalise the request path so the HMAC signature is stable regardless of a
// trailing slash (or repeated trailing slashes) in DFP_BRIDGE_ENDPOINT. The
// cloud verifies against `new URL(req.url).pathname`, which never includes a
// trailing slash, so we sign the same canonical form here to avoid 401
// invalid_signature on every subsequent request.
function canonicalPath(pathname: string): string {
  const stripped = pathname.replace(/^\/functions\/v1/, "");
  const trimmed = stripped.replace(/\/+$/, "");
  return trimmed || "/";
}

async function sendRequest(operation: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  const payload = { operation, message_id: messageId, environment: "production", ...body };
  const rawBody = JSON.stringify(payload);
  const payloadHash = await sha256Hex(rawBody);

  const url = new URL(config.endpoint);
  // Compute the canonical path for HMAC signing only. The actual HTTP request
  // still goes to the full configured endpoint (which includes
  // /functions/v1/runtime-bridge) — we never rewrite the dialled URL.
  const path = canonicalPath(url.pathname);
  const canonical = `${config.identity}\n${timestamp}\n${nonce}\nPOST\n${path}\n${payloadHash}`;
  const signature = await hmacSha256Hex(config.signingSecret, canonical);

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DFP-Identity": config.identity,
        "X-DFP-Timestamp": timestamp,
        "X-DFP-Nonce": nonce,
        "X-DFP-Signature-Version": "v1",
        "X-DFP-Signature": signature,
      },
      body: rawBody,
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    if (!res.ok) {
      log(`request ${operation} failed (${res.status}): ${JSON.stringify(data)}`);
      return null;
    }
    return data;
  } catch (err) {
    log(`request ${operation} network error: ${(err as Error)?.message ?? "unknown"}`);
    return null;
  }
}

// --- Local safe health checks (read-only, sanitised) -------------------------
async function checkN8n(): Promise<{ status: string; latency_ms: number | null }> {
  if (!config.n8nUrl) return { status: "not_configured", latency_ms: null };
  const started = Date.now();
  try {
    const res = await fetch(config.n8nUrl.replace(/\/+$/, "") + "/healthz", { method: "GET" });
    const latencyMs = Date.now() - started;
    return res.ok
      ? { status: "healthy", latency_ms: latencyMs }
      : { status: "degraded", latency_ms: latencyMs };
  } catch {
    return { status: "unavailable", latency_ms: null };
  }
}

async function checkOllama(): Promise<{ status: string; latency_ms: number | null; models: number | null }> {
  if (!config.ollamaUrl) return { status: "not_configured", latency_ms: null, models: null };
  const started = Date.now();
  try {
    const res = await fetch(config.ollamaUrl.replace(/\/+$/, "") + "/api/tags", { method: "GET" });
    const latencyMs = Date.now() - started;
    if (!res.ok) return { status: "degraded", latency_ms: latencyMs, models: null };
    const data = await res.json();
    const models = Array.isArray((data as { models?: unknown[] })?.models)
      ? ((data as { models: unknown[] }).models.length)
      : null;
    return { status: "healthy", latency_ms: latencyMs, models };
  } catch {
    return { status: "unavailable", latency_ms: null, models: null };
  }
}

// --- Sanitised Ollama catalogue relay (Prompt 09C) ----------------------------
// Relays ONLY safe catalogue fields from GET /api/tags: model name, family,
// parameter size, quantisation, local/remote classification, modified timestamp,
// and model count. Never relays prompts, generated content, credentials, raw
// config, or the full API response. NEVER calls /api/generate|/chat|/embed|pull|delete.

function deriveFamily(name: string): string | null {
  const base = name.split(":")[0] ?? "";
  return base.trim() ? base.trim() : null;
}

function deriveParameterSize(name: string, raw: string | null): string | null {
  if (raw) return raw;
  const match = name.match(/(\d+(\.\d+)?[bB])/);
  return match ? match[1] : null;
}

function sanitiseCatalogueModel(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const name = typeof m.name === "string" ? m.name.trim() : "";
  if (!name) return null;

  const details = (m.details && typeof m.details === "object") ? (m.details as Record<string, unknown>) : {};
  const familyRaw = typeof details.family === "string" ? details.family.trim() : null;
  const paramRaw = typeof details.parameter_size === "string" ? details.parameter_size.trim() : null;
  const quantRaw = typeof details.quantization_level === "string" ? details.quantization_level.trim() : null;
  const modifiedAt = typeof m.modified_at === "string" ? m.modified_at : null;

  return {
    name,
    family: familyRaw || deriveFamily(name),
    parameter_size: deriveParameterSize(name, paramRaw),
    quantization: quantRaw,
    classification: /:cloud$/i.test(name) ? "remote" : "local",
    modified_at: modifiedAt,
  };
}

async function fetchOllamaCatalogue(): Promise<Record<string, unknown>[]> {
  if (!config.ollamaUrl) return [];
  try {
    const res = await fetch(config.ollamaUrl.replace(/\/+$/, "") + "/api/tags", { method: "GET" });
    if (!res.ok) return [];
    const data = await res.json();
    const rawModels = Array.isArray((data as { models?: unknown[] })?.models)
      ? ((data as { models: unknown[] }).models)
      : [];
    return rawModels
      .map(sanitiseCatalogueModel)
      .filter((m): m is Record<string, unknown> => m !== null);
  } catch {
    return [];
  }
}

async function relayOllamaCatalogue(): Promise<void> {
  const models = await fetchOllamaCatalogue();
  const result = await sendRequest("report_ollama_catalogue", {
    node_key: config.nodeKey,
    catalogue_at: new Date().toISOString(),
    model_count: models.length,
    models,
  });
  if (result) {
    log(`relayed sanitised Ollama catalogue (${models.length} model(s), catalogue only — no inference).`);
  }
}

// --- Dry-run transport probe handling (Prompt 10) ------------------------------
// On receiving a valid `runtime_transport_probe` control message, HAL ONLY:
//   1. validates message type
//   2. validates expected node key
//   3. validates expiry
//   4. records receipt locally (in-memory/log — no filesystem)
//   5. sends a signed non-executing acknowledgement
// It NEVER calls n8n, Ollama, the filesystem, a shell, or an arbitrary URL.

interface ControlMessage {
  messageKey?: string;
  messageType?: string;
  correlationId?: string | null;
  safePayload?: Record<string, unknown>;
}

// --- Controlled Ollama sandbox inference probe (Prompt 11A) --------------------
// The ONLY permitted Ollama generation is a single fixed, harmless diagnostic
// ping. Prompt text and model are hard-coded here and can NEVER be supplied by
// the cloud or the browser. Unknown prompt IDs fail closed.
const OLLAMA_PROBE_PROMPT_ID = "dfp_ollama_ping_v1";
const OLLAMA_PROBE_MODEL = "qwen2.5-coder:7b";
const OLLAMA_PROBE_MODE = "sandbox_diagnostic";
const OLLAMA_PROBE_PROMPT = "Reply with exactly DFP_OLLAMA_SANDBOX_OK and no other text.";
const OLLAMA_PROBE_MAX_TOKENS = 16;
const OLLAMA_PROBE_TIMEOUT_MS = 30000;
const OLLAMA_PROBE_EXPECTED = "DFP_OLLAMA_SANDBOX_OK";

async function handleTransportProbe(m: ControlMessage): Promise<void> {
  // Reject any unrecognised message type explicitly (fail-closed).
  if (m.messageType !== "runtime_transport_probe") {
    log(`rejected unrecognised control message type: ${m.messageType ?? "(none)"} (ignored, no execution).`);
    return;
  }

  const payload = m.safePayload ?? {};
  const probeKey = typeof payload.probe_key === "string" ? payload.probe_key : "";
  const expectedNodeKey = typeof payload.expected_node_key === "string" ? payload.expected_node_key : "";
  const expiresAt = typeof payload.expires_at === "string" ? payload.expires_at : "";
  const nowIso = new Date().toISOString();

  // 2. Expected node key must match this node.
  if (expectedNodeKey && expectedNodeKey !== config.nodeKey) {
    log(`transport probe ${probeKey || m.messageKey} rejected: expected node ${expectedNodeKey} != ${config.nodeKey}.`);
    const rejectResult = await sendRequest("report_transport_probe_ack", {
      node_key: config.nodeKey,
      probe_key: probeKey,
      original_message_key: m.messageKey ?? "",
      correlation_id: m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : ""),
      received_at: nowIso,
      acknowledged_at: nowIso,
      status: "rejected",
      summary: "Transport probe rejected: expected node key mismatch.",
    });
    log(`transport probe ${probeKey || m.messageKey} rejection acknowledgement ${rejectResult ? (rejectResult.status ?? "sent") : "FAILED"} (transport only — no execution).`);
    return;
  }

  // 3. Stale/expired probes must never be acknowledged as successful.
  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    log(`transport probe ${probeKey || m.messageKey} ignored: probe expired (no ack sent).`);
    return;
  }

  // 4. Record receipt locally (in-memory log only — no filesystem, no service call).
  log(`transport probe ${probeKey || m.messageKey} received and validated (transport only — no execution).`);

  // 5. Send signed non-executing acknowledgement.
  const ackResult = await sendRequest("report_transport_probe_ack", {
    node_key: config.nodeKey,
    probe_key: probeKey,
    original_message_key: m.messageKey ?? "",
    correlation_id: m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : ""),
    received_at: nowIso,
    acknowledged_at: nowIso,
    status: "verified",
    summary: "Transport probe acknowledged. Transport verification only — no execution performed.",
  });
  log(`transport probe ${probeKey || m.messageKey} signed acknowledgement ${ackResult ? (ackResult.status ?? "sent") : "FAILED"} (transport only — no execution).`);
}

// --- Controlled Ollama sandbox inference probe (Prompt 11A) ---------------------
// On receiving a valid `ollama_inference_probe` control message, HAL ONLY runs
// the SINGLE fixed dfp_ollama_ping_v1 generation after validating ALL of:
//   1. message type exactly `ollama_inference_probe`
//   2. expected node is atlas-hal-runtime-01 (== config.nodeKey)
//   3. probe not expired
//   4. probe_mode exactly `sandbox_diagnostic`
//   5. prompt_id exactly `dfp_ollama_ping_v1`
//   6. model exactly `qwen2.5-coder:7b`
// It NEVER accepts arbitrary prompts, arbitrary models, or arbitrary URLs. The
// fixed prompt text is mapped locally from the prompt_id — the cloud only ever
// references the identifier.
async function handleOllamaInferenceProbe(m: ControlMessage): Promise<void> {
  if (m.messageType !== "ollama_inference_probe") {
    log(`rejected unrecognised control message type: ${m.messageType ?? "(none)"} (ignored, no inference).`);
    return;
  }

  const payload = m.safePayload ?? {};
  const probeKey = typeof payload.probe_key === "string" ? payload.probe_key : "";
  const expectedNodeKey = typeof payload.expected_node_key === "string" ? payload.expected_node_key : "";
  const expiresAt = typeof payload.expires_at === "string" ? payload.expires_at : "";
  const probeMode = typeof payload.probe_mode === "string" ? payload.probe_mode : "";
  const promptId = typeof payload.prompt_id === "string" ? payload.prompt_id : "";
  const model = typeof payload.model === "string" ? payload.model : "";
  const correlationId = m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : "");
  const nowIso = new Date().toISOString();

  const report = async (status: string, output: string, latencyMs: number | null) => {
    const res = await sendRequest("report_ollama_inference_probe", {
      node_key: config.nodeKey,
      probe_key: probeKey,
      original_message_key: m.messageKey ?? "",
      correlation_id: correlationId,
      prompt_id: OLLAMA_PROBE_PROMPT_ID,
      model: OLLAMA_PROBE_MODEL,
      probe_mode: OLLAMA_PROBE_MODE,
      status,
      output,
      latency_ms: latencyMs,
      generated_at: nowIso,
    });
    log(`ollama probe ${probeKey || m.messageKey} result report ${res ? (res.status ?? "sent") : "FAILED"} (status=${status}).`);
  };

  // 1. Expected node key must match this node.
  if (expectedNodeKey && expectedNodeKey !== config.nodeKey) {
    log(`ollama probe ${probeKey || m.messageKey} rejected: expected node ${expectedNodeKey} != ${config.nodeKey}.`);
    await report("rejected", "", null);
    return;
  }

  // 2. Stale/expired probes must never run inference.
  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    log(`ollama probe ${probeKey || m.messageKey} ignored: probe expired (no inference).`);
    return;
  }

  // 3. probe_mode must be exactly sandbox_diagnostic.
  if (probeMode !== OLLAMA_PROBE_MODE) {
    log(`ollama probe ${probeKey || m.messageKey} rejected: unexpected probe_mode ${probeMode || "(none)"} (fail closed, no inference).`);
    await report("rejected", "", null);
    return;
  }

  // 4. prompt_id must be exactly dfp_ollama_ping_v1 (unknown IDs fail closed).
  if (promptId !== OLLAMA_PROBE_PROMPT_ID) {
    log(`ollama probe ${probeKey || m.messageKey} rejected: unknown prompt_id ${promptId || "(none)"} (fail closed, no inference).`);
    await report("rejected", "", null);
    return;
  }

  // 5. model must be exactly qwen2.5-coder:7b.
  if (model !== OLLAMA_PROBE_MODEL) {
    log(`ollama probe ${probeKey || m.messageKey} rejected: unexpected model ${model || "(none)"} (fail closed, no inference).`);
    await report("rejected", "", null);
    return;
  }

  // 6. Local Ollama must be configured.
  if (!config.ollamaUrl) {
    log(`ollama probe ${probeKey || m.messageKey} failed: OLLAMA_LOCAL_URL not configured.`);
    await report("failed", "", null);
    return;
  }

  // All validation passed — run the SINGLE fixed generation.
  log(`ollama probe ${probeKey || m.messageKey} validated — running fixed sandbox ping (prompt_id=${OLLAMA_PROBE_PROMPT_ID}, model=${OLLAMA_PROBE_MODEL}).`);

  let output = "";
  let status = "failed";
  let latencyMs: number | null = null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_PROBE_TIMEOUT_MS);
  try {
    const started = Date.now();
    const res = await fetch(config.ollamaUrl.replace(/\/+$/, "") + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_PROBE_MODEL,
        prompt: OLLAMA_PROBE_PROMPT,
        stream: false,
        options: { temperature: 0, num_predict: OLLAMA_PROBE_MAX_TOKENS },
      }),
    });
    latencyMs = Date.now() - started;
    if (!res.ok) {
      log(`ollama probe ${probeKey || m.messageKey} generation failed (${res.status}).`);
    } else {
      const data = await res.json();
      output = typeof (data as { response?: unknown })?.response === "string"
        ? ((data as { response: string }).response)
        : "";
      status = "completed";
      const matchedExpected = output.trim() === OLLAMA_PROBE_EXPECTED;
      log(`ollama probe ${probeKey || m.messageKey} generation returned ${matchedExpected ? "expected" : "unexpected"} output (local sentinel ${matchedExpected ? "matched" : "not matched"}).`);
    }
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    log(`ollama probe ${probeKey || m.messageKey} generation ${aborted ? "timed out" : "network error"}: ${(err as Error)?.message ?? "unknown"}.`);
    status = "failed";
    latencyMs = null;
  } finally {
    clearTimeout(timeoutId);
  }

  const safeOutput = output.trim().slice(0, 100);
  await report(status, safeOutput, latencyMs);
}

// --- Controlled n8n sandbox workflow probe (Prompt 12) --------------------------
// The ONLY n8n workflow execution permitted is the single fixed, harmless
// "DFP Runtime Sandbox Ping" diagnostic, invoked through ONE fixed local n8n
// webhook path (N8N_SANDBOX_WEBHOOK_PATH) configured LOCALLY and never supplied
// by the cloud or the browser. Invalid/missing configuration fails closed. This
// is a diagnostic ping only — it never creates a generic execute-workflow
// capability, never runs a business workflow, and never accepts arbitrary IDs,
// URLs or payloads.
const N8N_SANDBOX_PROBE_ID = "dfp_n8n_ping_v1";
const N8N_SANDBOX_PROBE_MODE = "sandbox_diagnostic";
const N8N_SANDBOX_PROBE_WORKFLOW_ALIAS = "DFP Runtime Sandbox Ping";
const N8N_SANDBOX_PROBE_STATUS = "DFP_N8N_SANDBOX_OK";
// Canonical deterministic expected output (exact string equality, no case folding).
const N8N_SANDBOX_PROBE_EXPECTED_OUTPUT = JSON.stringify({
  status: N8N_SANDBOX_PROBE_STATUS,
  probe: N8N_SANDBOX_PROBE_ID,
});
const N8N_SANDBOX_PROBE_TIMEOUT_MS = 30000;
const N8N_SANDBOX_PROBE_MAX_OUTPUT_CHARS = 200;

// Validate the fixed local webhook path. Reject anything that is empty, an
// absolute URL, contains protocol syntax or a hostname, or does not start with
// the /webhook/ prefix. The path is loaded from local HAL environment only.
function isValidSandboxWebhookPath(path: string): boolean {
  if (!path) return false;
  if (!path.startsWith("/webhook/")) return false;
  if (path.includes("://")) return false; // protocol / absolute URL
  if (path.includes("//")) return false;  // hostname / absolute path signal
  if (!/^\/webhook\/[A-Za-z0-9._-]+$/.test(path)) return false;
  return true;
}

// Bounded recursive search for the workflow's echoed { status, probe } object.
// n8n wraps execution output in version-dependent envelopes, so we search for
// the deterministic result rather than assuming a fixed response shape.
function findSandboxResult(node: unknown, depth: number): { status: string; probe: string } | null {
  if (depth > 6 || !node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findSandboxResult(item, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.status === "string" && typeof obj.probe === "string") {
      return { status: obj.status, probe: obj.probe };
    }
    for (const key of Object.keys(obj)) {
      const r = findSandboxResult(obj[key], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

async function handleN8nSandboxProbe(m: ControlMessage): Promise<void> {
  if (m.messageType !== "n8n_sandbox_probe") {
    log(`rejected unrecognised control message type: ${m.messageType ?? "(none)"} (ignored, no n8n execution).`);
    return;
  }

  const payload = m.safePayload ?? {};
  const probeKey = typeof payload.probe_key === "string" ? payload.probe_key : "";
  const expectedNodeKey = typeof payload.expected_node_key === "string" ? payload.expected_node_key : "";
  const expiresAt = typeof payload.expires_at === "string" ? payload.expires_at : "";
  const probeMode = typeof payload.probe_mode === "string" ? payload.probe_mode : "";
  const probeId = typeof payload.probe_id === "string" ? payload.probe_id : "";
  const correlationId = m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : "");
  const nowIso = new Date().toISOString();

  const report = async (
    status: string,
    verified: boolean,
    safeOutput: string,
    latencyMs: number | null,
    errorCategory: string | null,
  ) => {
    const res = await sendRequest("report_n8n_sandbox_probe", {
      node_key: config.nodeKey,
      probe_key: probeKey,
      original_message_key: m.messageKey ?? "",
      correlation_id: correlationId,
      probe_id: N8N_SANDBOX_PROBE_ID,
      probe_mode: N8N_SANDBOX_PROBE_MODE,
      workflow_reference: N8N_SANDBOX_PROBE_WORKFLOW_ALIAS,
      status,
      verified,
      safe_output: safeOutput,
      latency_ms: latencyMs,
      error_category: errorCategory,
      started_at: nowIso,
      completed_at: new Date().toISOString(),
    });
    log(`n8n probe ${probeKey || m.messageKey} result report ${res ? (res.status ?? "sent") : "FAILED"} (status=${status}, verified=${verified}).`);
  };

  // 1. Expected node key must match this node.
  if (expectedNodeKey && expectedNodeKey !== config.nodeKey) {
    log(`n8n probe ${probeKey || m.messageKey} rejected: expected node ${expectedNodeKey} != ${config.nodeKey}.`);
    await report("rejected", false, "", null, "node_mismatch");
    return;
  }

  // 2. Stale/expired probes must never execute the workflow.
  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    log(`n8n probe ${probeKey || m.messageKey} ignored: probe expired (no n8n execution).`);
    return;
  }

  // 3. probe_mode must be exactly sandbox_diagnostic.
  if (probeMode !== N8N_SANDBOX_PROBE_MODE) {
    log(`n8n probe ${probeKey || m.messageKey} rejected: unexpected probe_mode ${probeMode || "(none)"} (fail closed, no n8n execution).`);
    await report("rejected", false, "", null, "invalid_mode");
    return;
  }

  // 4. probe_id must be exactly dfp_n8n_ping_v1 (unknown IDs fail closed).
  if (probeId !== N8N_SANDBOX_PROBE_ID) {
    log(`n8n probe ${probeKey || m.messageKey} rejected: unknown probe_id ${probeId || "(none)"} (fail closed, no n8n execution).`);
    await report("rejected", false, "", null, "invalid_probe_id");
    return;
  }

  // 5. The fixed local webhook path must be configured and valid.
  if (!isValidSandboxWebhookPath(config.n8nSandboxWebhookPath)) {
    log(`n8n probe ${probeKey || m.messageKey} failed: N8N_SANDBOX_WEBHOOK_PATH not configured or invalid (must be a local /webhook/ path).`);
    await report("failed", false, "", null, "workflow_not_configured");
    return;
  }

  // 6. Local n8n must be configured.
  if (!config.n8nUrl) {
    log(`n8n probe ${probeKey || m.messageKey} failed: N8N_LOCAL_URL not configured.`);
    await report("failed", false, "", null, "n8n_not_configured");
    return;
  }

  // All validation passed — execute the SINGLE fixed diagnostic workflow once.
  log(`n8n probe ${probeKey || m.messageKey} validated — executing fixed sandbox workflow (probe_id=${N8N_SANDBOX_PROBE_ID}).`);

  let safeOutput = "";
  let verified = false;
  let status = "failed";
  let latencyMs: number | null = null;
  let errorCategory: string | null = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_SANDBOX_PROBE_TIMEOUT_MS);
  try {
    const started = Date.now();
    // Fixed local n8n target only — the URL + webhook path are configured
    // locally and never supplied by the cloud/browser.
    const executeUrl = config.n8nUrl.replace(/\/+$/, "") + config.n8nSandboxWebhookPath;
    const res = await fetch(executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        probe: N8N_SANDBOX_PROBE_ID,
        mode: N8N_SANDBOX_PROBE_MODE,
      }),
    });
    latencyMs = Date.now() - started;

    if (!res.ok) {
      log(`n8n probe ${probeKey || m.messageKey} workflow execution failed (${res.status}).`);
      errorCategory = "workflow_http_" + res.status;
    } else {
      const data = await res.json();
      const found = findSandboxResult(data, 0);
      const statusStr = found?.status ?? "";
      const probeStr = found?.probe ?? "";
      safeOutput = JSON.stringify({ status: statusStr, probe: probeStr })
        .slice(0, N8N_SANDBOX_PROBE_MAX_OUTPUT_CHARS);
      verified = safeOutput === N8N_SANDBOX_PROBE_EXPECTED_OUTPUT;
      status = verified ? "completed" : "failed";
      if (!verified) errorCategory = "output_mismatch";
      log(`n8n probe ${probeKey || m.messageKey} workflow returned ${verified ? "expected" : "unexpected"} result (exact match ${verified ? "true" : "false"}).`);
    }
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    log(`n8n probe ${probeKey || m.messageKey} workflow ${aborted ? "timed out" : "network error"}: ${(err as Error)?.message ?? "unknown"}.`);
    status = "failed";
    errorCategory = aborted ? "timeout" : "network_error";
    latencyMs = null;
  } finally {
    clearTimeout(timeoutId);
  }

  await report(status, verified, safeOutput, latencyMs, errorCategory);
}

// --- Controlled multi-runtime chain probe (Prompt 13) ----------------------------
// The ONLY combined diagnostic permitted: run the fixed n8n sandbox ping, then
// (ONLY if n8n succeeded) run the fixed Ollama sandbox ping, then report ONE
// signed combined result. Strictly fixed, fail-closed, no arbitrary values, no
// retry, exactly one request per service, 30s timeout per step. It never runs an
// agent, business workflow, tool, DB action, notification, payment, filesystem or
// shell command. The fixed n8n + Ollama configurations are reused from Prompt 12
// and Prompt 11A respectively — no new URL, workflow, model or prompt is introduced.
const CHAIN_PROBE_MESSAGE_TYPE = "runtime_chain_probe";
const CHAIN_PROBE_ID = "dfp_runtime_chain_v1";
const CHAIN_PROBE_MODE = "sandbox_diagnostic";
const CHAIN_PROBE_TIMEOUT_MS = 30000;

async function handleRuntimeChainProbe(m: ControlMessage): Promise<void> {
  if (m.messageType !== CHAIN_PROBE_MESSAGE_TYPE) {
    log(`rejected unrecognised control message type: ${m.messageType ?? "(none)"} (ignored, no chain execution).`);
    return;
  }

  const payload = m.safePayload ?? {};
  const probeKey = typeof payload.probe_key === "string" ? payload.probe_key : "";
  const expectedNodeKey = typeof payload.expected_node_key === "string" ? payload.expected_node_key : "";
  const expiresAt = typeof payload.expires_at === "string" ? payload.expires_at : "";
  const probeMode = typeof payload.probe_mode === "string" ? payload.probe_mode : "";
  const probeId = typeof payload.probe_id === "string" ? payload.probe_id : "";
  const correlationId = m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : "");
  const startedAtIso = new Date().toISOString();

  const report = async (r: {
    status: string;
    verified: boolean;
    n8nVerified: boolean;
    ollamaVerified: boolean;
    n8nLatencyMs: number | null;
    ollamaLatencyMs: number | null;
    totalLatencyMs: number | null;
    completedSteps: number;
    errorStep: string | null;
    errorCategory: string | null;
  }) => {
    const res = await sendRequest("report_runtime_chain_probe", {
      node_key: config.nodeKey,
      probe_key: probeKey,
      original_message_key: m.messageKey ?? "",
      correlation_id: correlationId,
      probe_id: CHAIN_PROBE_ID,
      probe_mode: CHAIN_PROBE_MODE,
      status: r.status,
      verified: r.verified,
      n8n_verified: r.n8nVerified,
      ollama_verified: r.ollamaVerified,
      n8n_latency_ms: r.n8nLatencyMs,
      ollama_latency_ms: r.ollamaLatencyMs,
      total_latency_ms: r.totalLatencyMs,
      completed_steps: r.completedSteps,
      error_step: r.errorStep,
      error_category: r.errorCategory,
      started_at: startedAtIso,
      completed_at: new Date().toISOString(),
    });
    log(`chain probe ${probeKey || m.messageKey} result report ${res ? (res.status ?? "sent") : "FAILED"} (status=${r.status}, verified=${r.verified}).`);
  };

  // 1. Expected node key must match this node.
  if (expectedNodeKey && expectedNodeKey !== config.nodeKey) {
    log(`chain probe ${probeKey || m.messageKey} rejected: expected node ${expectedNodeKey} != ${config.nodeKey}.`);
    await report({
      status: "rejected", verified: false, n8nVerified: false, ollamaVerified: false,
      n8nLatencyMs: null, ollamaLatencyMs: null, totalLatencyMs: null,
      completedSteps: 0, errorStep: null, errorCategory: "node_mismatch",
    });
    return;
  }

  // 2. Stale/expired probes must never run the chain.
  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    log(`chain probe ${probeKey || m.messageKey} ignored: probe expired (no chain execution).`);
    return;
  }

  // 3. probe_mode must be exactly sandbox_diagnostic.
  if (probeMode !== CHAIN_PROBE_MODE) {
    log(`chain probe ${probeKey || m.messageKey} rejected: unexpected probe_mode ${probeMode || "(none)"} (fail closed, no chain execution).`);
    await report({
      status: "rejected", verified: false, n8nVerified: false, ollamaVerified: false,
      n8nLatencyMs: null, ollamaLatencyMs: null, totalLatencyMs: null,
      completedSteps: 0, errorStep: null, errorCategory: "invalid_mode",
    });
    return;
  }

  // 4. probe_id must be exactly dfp_runtime_chain_v1 (unknown IDs fail closed).
  if (probeId !== CHAIN_PROBE_ID) {
    log(`chain probe ${probeKey || m.messageKey} rejected: unknown probe_id ${probeId || "(none)"} (fail closed, no chain execution).`);
    await report({
      status: "rejected", verified: false, n8nVerified: false, ollamaVerified: false,
      n8nLatencyMs: null, ollamaLatencyMs: null, totalLatencyMs: null,
      completedSteps: 0, errorStep: null, errorCategory: "invalid_probe_id",
    });
    return;
  }

  log(`chain probe ${probeKey || m.messageKey} validated — starting fixed n8n → Ollama diagnostic chain.`);

  // ---------------------------------------------------------------------------
  // STEP 1 — n8n (fixed sandbox ping, exact output). Any failure STOPS the chain
  // and never proceeds to Ollama.
  // ---------------------------------------------------------------------------
  let n8nVerified = false;
  let n8nLatencyMs: number | null = null;
  let n8nError: string | null = null;

  if (!isValidSandboxWebhookPath(config.n8nSandboxWebhookPath)) {
    n8nError = "workflow_not_configured";
  } else if (!config.n8nUrl) {
    n8nError = "n8n_not_configured";
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAIN_PROBE_TIMEOUT_MS);
    try {
      const started = Date.now();
      const executeUrl = config.n8nUrl.replace(/\/+$/, "") + config.n8nSandboxWebhookPath;
      const res = await fetch(executeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ probe: N8N_SANDBOX_PROBE_ID, mode: N8N_SANDBOX_PROBE_MODE }),
      });
      n8nLatencyMs = Date.now() - started;
      if (!res.ok) {
        n8nError = "workflow_http_" + res.status;
      } else {
        const data = await res.json();
        const found = findSandboxResult(data, 0);
        const out = JSON.stringify({ status: found?.status ?? "", probe: found?.probe ?? "" });
        if (out === N8N_SANDBOX_PROBE_EXPECTED_OUTPUT) {
          n8nVerified = true;
        } else {
          n8nError = "output_mismatch";
        }
      }
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      n8nError = aborted ? "timeout" : "network_error";
      n8nLatencyMs = null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!n8nVerified) {
    log(`chain probe ${probeKey || m.messageKey} chain STOPPED at n8n step (${n8nError ?? "not_verified"}). No Ollama call performed.`);
    await report({
      status: "failed", verified: false, n8nVerified: false, ollamaVerified: false,
      n8nLatencyMs, ollamaLatencyMs: null, totalLatencyMs: n8nLatencyMs,
      completedSteps: 0, errorStep: "n8n", errorCategory: n8nError,
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // STEP 2 — Ollama (ONLY after n8n success). Fixed dfp_ollama_ping_v1 config,
  // exact sentinel output, no arbitrary inference.
  // ---------------------------------------------------------------------------
  let ollamaVerified = false;
  let ollamaLatencyMs: number | null = null;
  let ollamaError: string | null = null;

  if (!config.ollamaUrl) {
    ollamaError = "ollama_not_configured";
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAIN_PROBE_TIMEOUT_MS);
    try {
      const started = Date.now();
      const res = await fetch(config.ollamaUrl.replace(/\/+$/, "") + "/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_PROBE_MODEL,
          prompt: OLLAMA_PROBE_PROMPT,
          stream: false,
          options: { temperature: 0, num_predict: OLLAMA_PROBE_MAX_TOKENS },
        }),
      });
      ollamaLatencyMs = Date.now() - started;
      if (!res.ok) {
        ollamaError = "ollama_http_" + res.status;
      } else {
        const data = await res.json();
        const out = typeof (data as { response?: unknown })?.response === "string"
          ? ((data as { response: string }).response).trim()
          : "";
        if (out === OLLAMA_PROBE_EXPECTED) {
          ollamaVerified = true;
        } else {
          ollamaError = "output_mismatch";
        }
      }
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      ollamaError = aborted ? "timeout" : "network_error";
      ollamaLatencyMs = null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const totalLatencyMs = ((n8nLatencyMs ?? 0) + (ollamaLatencyMs ?? 0)) || null;
  const completedSteps = ollamaVerified ? 2 : 1;
  const verified = n8nVerified && ollamaVerified;

  await report({
    status: verified ? "completed" : "failed",
    verified,
    n8nVerified,
    ollamaVerified,
    n8nLatencyMs,
    ollamaLatencyMs,
    totalLatencyMs,
    completedSteps,
    errorStep: ollamaVerified ? null : "ollama",
    errorCategory: ollamaVerified ? null : ollamaError,
  });
}

// --- Controlled registered-agent dry-run probe (Prompt 14) -----------------------
// The ONLY agent-runtime dry-run permitted: resolve the fixed diagnostic agent
// binding (dfp-runtime-diagnostic-agent → qwen2.5-coder:7b) locally and run ONE
// fixed harmless Ollama generation. Prompt text + model are hard-coded here and
// can NEVER be supplied by cloud/browser. No tools, no n8n, no business workflow,
// no DB write, no notification, no filesystem/shell, no autonomous action.
const AGENT_DRY_RUN_PROBE_MESSAGE_TYPE = "agent_dry_run_probe";
const AGENT_DRY_RUN_PROBE_ID = "dfp_agent_dry_run_v1";
const AGENT_DRY_RUN_PROBE_MODE = "sandbox_diagnostic";
const AGENT_DRY_RUN_AGENT_KEY = "dfp-runtime-diagnostic-agent";
const AGENT_DRY_RUN_MODEL = "qwen2.5-coder:7b";
const AGENT_DRY_RUN_PROMPT =
  "You are the DFP Runtime Diagnostic Agent.\n" +
  "This is a controlled sandbox verification.\n" +
  "Perform no action and call no tools.\n" +
  "Reply with exactly:\n" +
  "DFP_AGENT_DRY_RUN_OK";
const AGENT_DRY_RUN_EXPECTED = "DFP_AGENT_DRY_RUN_OK";
const AGENT_DRY_RUN_MAX_TOKENS = 16;
const AGENT_DRY_RUN_TIMEOUT_MS = 30000;

async function handleAgentDryRunProbe(m: ControlMessage): Promise<void> {
  if (m.messageType !== AGENT_DRY_RUN_PROBE_MESSAGE_TYPE) {
    log(`rejected unrecognised control message type: ${m.messageType ?? "(none)"} (ignored, no agent dry-run).`);
    return;
  }

  const payload = m.safePayload ?? {};
  const probeKey = typeof payload.probe_key === "string" ? payload.probe_key : "";
  const expectedNodeKey = typeof payload.expected_node_key === "string" ? payload.expected_node_key : "";
  const expiresAt = typeof payload.expires_at === "string" ? payload.expires_at : "";
  const probeMode = typeof payload.probe_mode === "string" ? payload.probe_mode : "";
  const probeId = typeof payload.probe_id === "string" ? payload.probe_id : "";
  const diagnosticAgentKey = typeof payload.diagnostic_agent_key === "string" ? payload.diagnostic_agent_key : "";
  const resolvedModelReference = typeof payload.resolved_model_reference === "string" ? payload.resolved_model_reference : "";
  const correlationId = m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : "");
  const startedAtIso = new Date().toISOString();

  const report = async (
    status: string,
    verified: boolean,
    safeOutput: string,
    latencyMs: number | null,
    errorCategory: string | null,
  ) => {
    const res = await sendRequest("report_agent_dry_run_probe", {
      node_key: config.nodeKey,
      probe_key: probeKey,
      original_message_key: m.messageKey ?? "",
      correlation_id: correlationId,
      probe_id: AGENT_DRY_RUN_PROBE_ID,
      probe_mode: AGENT_DRY_RUN_PROBE_MODE,
      diagnostic_agent_key: AGENT_DRY_RUN_AGENT_KEY,
      resolved_model_reference: AGENT_DRY_RUN_MODEL,
      status,
      verified,
      safe_output: safeOutput,
      latency_ms: latencyMs,
      error_category: errorCategory,
      started_at: startedAtIso,
      completed_at: new Date().toISOString(),
    });
    log(`agent dry-run probe ${probeKey || m.messageKey} result report ${res ? (res.status ?? "sent") : "FAILED"} (status=${status}, verified=${verified}).`);
  };

  // 1. Expected node key must match this node.
  if (expectedNodeKey && expectedNodeKey !== config.nodeKey) {
    log(`agent dry-run probe ${probeKey || m.messageKey} rejected: expected node ${expectedNodeKey} != ${config.nodeKey}.`);
    await report("rejected", false, "", null, "node_mismatch");
    return;
  }

  // 2. Stale/expired probes must never run inference.
  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    log(`agent dry-run probe ${probeKey || m.messageKey} ignored: probe expired (no agent dry-run).`);
    return;
  }

  // 3. probe_mode must be exactly sandbox_diagnostic.
  if (probeMode !== AGENT_DRY_RUN_PROBE_MODE) {
    log(`agent dry-run probe ${probeKey || m.messageKey} rejected: unexpected probe_mode ${probeMode || "(none)"} (fail closed).`);
    await report("rejected", false, "", null, "invalid_mode");
    return;
  }

  // 4. probe_id must be exactly dfp_agent_dry_run_v1.
  if (probeId !== AGENT_DRY_RUN_PROBE_ID) {
    log(`agent dry-run probe ${probeKey || m.messageKey} rejected: unknown probe_id ${probeId || "(none)"} (fail closed).`);
    await report("rejected", false, "", null, "invalid_probe_id");
    return;
  }

  // 5. diagnostic agent key must be the exact allowed agent.
  if (diagnosticAgentKey !== AGENT_DRY_RUN_AGENT_KEY) {
    log(`agent dry-run probe ${probeKey || m.messageKey} rejected: unexpected diagnostic_agent_key ${diagnosticAgentKey || "(none)"} (fail closed).`);
    await report("rejected", false, "", null, "invalid_agent_key");
    return;
  }

  // 6. resolved model reference must be the exact allowed model.
  if (resolvedModelReference !== AGENT_DRY_RUN_MODEL) {
    log(`agent dry-run probe ${probeKey || m.messageKey} rejected: unexpected resolved_model_reference ${resolvedModelReference || "(none)"} (fail closed).`);
    await report("rejected", false, "", null, "invalid_model_reference");
    return;
  }

  // 7. Local Ollama must be configured.
  if (!config.ollamaUrl) {
    log(`agent dry-run probe ${probeKey || m.messageKey} failed: OLLAMA_LOCAL_URL not configured.`);
    await report("failed", false, "", null, "ollama_not_configured");
    return;
  }

  // All validation passed — run the SINGLE fixed agent→model dry-run generation.
  log(`agent dry-run probe ${probeKey || m.messageKey} validated — running fixed agent→model diagnostic (agent=${AGENT_DRY_RUN_AGENT_KEY}, model=${AGENT_DRY_RUN_MODEL}).`);

  let output = "";
  let verified = false;
  let status = "failed";
  let latencyMs: number | null = null;
  let errorCategory: string | null = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AGENT_DRY_RUN_TIMEOUT_MS);
  try {
    const started = Date.now();
    const res = await fetch(config.ollamaUrl.replace(/\/+$/, "") + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: AGENT_DRY_RUN_MODEL,
        prompt: AGENT_DRY_RUN_PROMPT,
        stream: false,
        options: { temperature: 0, num_predict: AGENT_DRY_RUN_MAX_TOKENS },
      }),
    });
    latencyMs = Date.now() - started;
    if (!res.ok) {
      errorCategory = "ollama_http_" + res.status;
    } else {
      const data = await res.json();
      output = typeof (data as { response?: unknown })?.response === "string"
        ? ((data as { response: string }).response).trim()
        : "";
      // Exact match only — no case folding, no fuzzy matching.
      verified = output === AGENT_DRY_RUN_EXPECTED;
      status = verified ? "completed" : "failed";
      if (!verified) errorCategory = "output_mismatch";
    }
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    status = "failed";
    errorCategory = aborted ? "timeout" : "network_error";
    latencyMs = null;
  } finally {
    clearTimeout(timeoutId);
  }

  const safeOutput = output.slice(0, 100);
  await report(status, verified, safeOutput, latencyMs, errorCategory);
}

// --- Operations --------------------------------------------------------------
async function handshake(): Promise<boolean> {
  const result = await sendRequest("handshake", {
    node_key: config.nodeKey,
    name: config.nodeName || config.nodeKey,
    node_type: "local_runtime",
    software_version: "1.0.0",
    platform: "deno",
    configuration_state: "configured",
    capabilities: ["n8n_health", "n8n_metadata", "ollama_health", "ollama_models", "signed_callbacks", "outbound_https"],
  });
  if (result && (result as { verified?: boolean }).verified) {
    log("handshake verified — bridge registered (execution disabled).");
    return true;
  }
  log("handshake not verified yet (secret/identity/endpoint may not match).");
  return false;
}

async function heartbeat(): Promise<void> {
  const n8n = await checkN8n();
  const ollama = await checkOllama();
  const started = Date.now();
  const result = await sendRequest("heartbeat", {
    node_key: config.nodeKey,
    bridge_timestamp: new Date().toISOString(),
    status: "healthy",
    latency_ms: Date.now() - started,
    n8n_status: n8n.status,
    ollama_status: ollama.status,
    local_services: {
      n8n: { configured: !!config.n8nUrl, status: n8n.status },
      ollama: { configured: !!config.ollamaUrl, status: ollama.status, model_count: ollama.models },
    },
    safe_summary: `Bridge heartbeat: n8n=${n8n.status}, ollama=${ollama.status} (no inference, no workflow).`,
    capabilities: ["n8n_health", "n8n_metadata", "ollama_health", "ollama_models", "signed_callbacks", "outbound_https"],
  });
  if (result) {
    await sendRequest("report_health", {
      node_key: config.nodeKey,
      checks: [
        { service: "n8n", status: n8n.status, latency_ms: n8n.latency_ms, safe_message: "Local n8n /healthz (read-only, no workflow)." },
        { service: "ollama", status: ollama.status, latency_ms: ollama.latency_ms, safe_message: "Local Ollama /api/tags (catalogue only, no inference)." },
        { service: "bridge", status: "healthy", latency_ms: null, safe_message: "Bridge process healthy." },
      ],
    });
  }
}

async function pollControlMessages(): Promise<void> {
  const result = await sendRequest("fetch_control_messages", { node_key: config.nodeKey });
  if (result && Array.isArray((result as { messages?: unknown[] }).messages)) {
    const messages = (result as { messages: unknown[] }).messages as ControlMessage[];
    if (messages.length > 0) {
      log(`received ${messages.length} control message(s) (allowlisted health/capability/transport-probe/ollama-probe only).`);
    }

    // Dry-run transport probes (non-executing) — validate + signed ack.
    const probes = messages.filter((m) => m.messageType === "runtime_transport_probe");
    for (const p of probes) {
      await handleTransportProbe(p);
    }

    // Controlled Ollama inference probes (Prompt 11A) — single fixed sandbox ping.
    const inferenceProbes = messages.filter((m) => m.messageType === "ollama_inference_probe");
    for (const p of inferenceProbes) {
      await handleOllamaInferenceProbe(p);
    }

    // Controlled n8n sandbox workflow probes (Prompt 12) — single fixed diagnostic
    // workflow execution, fail-closed, one invocation per queued probe.
    const n8nProbes = messages.filter((m) => m.messageType === "n8n_sandbox_probe");
    for (const p of n8nProbes) {
      await handleN8nSandboxProbe(p);
    }

    // Controlled multi-runtime chain probes (Prompt 13) — fixed n8n → Ollama
    // diagnostic chain, fail-closed, one invocation per queued probe, no retry.
    const chainProbes = messages.filter((m) => m.messageType === "runtime_chain_probe");
    for (const p of chainProbes) {
      await handleRuntimeChainProbe(p);
    }

    // Controlled registered-agent dry-run probes (Prompt 14) — fixed agent→model
    // diagnostic binding, single fixed Ollama generation, fail-closed, no retry.
    const agentDryRunProbes = messages.filter((m) => m.messageType === "agent_dry_run_probe");
    for (const p of agentDryRunProbes) {
      await handleAgentDryRunProbe(p);
    }

    const wantsCatalogue = messages.some(
      (m) => m.messageType === "ollama_catalogue_request",
    );
    if (wantsCatalogue) {
      await relayOllamaCatalogue();
    }
  }
}

// --- Main loop (outbound-only, fail-closed) -----------------------------------
async function main() {
  if (!assertConfig()) return; // fail closed — no traffic, no execution

  log("starting private runtime bridge (outbound-only, no execution).");

  // Handshake with backoff until verified.
  let verified = false;
  let backoffMs = 5_000;
  while (!verified) {
    verified = await handshake();
    if (verified) break;
    log(`handshake not verified — retrying in ${backoffMs / 1000}s (exponential backoff).`);
    await sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 2, 60_000);
  }

  const heartbeatInterval = Math.max(10, config.heartbeatSeconds) * 1000;
  const pollInterval = config.pollSeconds > 0 ? Math.max(10, config.pollSeconds) * 1000 : 0;
  const catalogueInterval = Math.max(120, config.pollSeconds * 2 || 300) * 1000;

  // Heartbeat loop.
  setInterval(() => {
    void heartbeat();
  }, heartbeatInterval);

  // Catalogue relay loop — sanitised Ollama catalogue only, no inference.
  setInterval(() => {
    void relayOllamaCatalogue();
  }, catalogueInterval);

  // Optional control-message polling (health_request / capability_request only).
  if (pollInterval > 0) {
    setInterval(() => {
      void pollControlMessages();
    }, pollInterval);
  }

  // Kick off immediately.
  void heartbeat();
  void relayOllamaCatalogue();
  if (pollInterval > 0) void pollControlMessages();

  log("heartbeat loop running. Offline = fail closed (no autonomous execution).");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();