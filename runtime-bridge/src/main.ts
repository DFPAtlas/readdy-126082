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
//   * performs Ollama inference (no prompt / generation / embeddings)
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
async function sendRequest(operation: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  const payload = { operation, message_id: messageId, environment: "production", ...body };
  const rawBody = JSON.stringify(payload);
  const payloadHash = await sha256Hex(rawBody);

  const url = new URL(config.endpoint);
  const path = url.pathname;
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
    await sendRequest("report_transport_probe_ack", {
      node_key: config.nodeKey,
      probe_key: probeKey,
      original_message_key: m.messageKey ?? "",
      correlation_id: m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : ""),
      received_at: nowIso,
      acknowledged_at: nowIso,
      status: "rejected",
      summary: "Transport probe rejected: expected node key mismatch.",
    });
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
  await sendRequest("report_transport_probe_ack", {
    node_key: config.nodeKey,
    probe_key: probeKey,
    original_message_key: m.messageKey ?? "",
    correlation_id: m.correlationId ?? (typeof payload.correlation_id === "string" ? payload.correlation_id : ""),
    received_at: nowIso,
    acknowledged_at: nowIso,
    status: "verified",
    summary: "Transport probe acknowledged. Transport verification only — no execution performed.",
  });
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
      log(`received ${messages.length} control message(s) (allowlisted health/capability/transport-probe only).`);
    }

    // Dry-run transport probes (non-executing) — validate + signed ack.
    const probes = messages.filter((m) => m.messageType === "runtime_transport_probe");
    for (const p of probes) {
      await handleTransportProbe(p);
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