import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge — secure OUTBOUND-FIRST private-runtime bridge API for DFP AI
// Operations (Phase 3 Prompt 08).
//
// The trusted server-side endpoint that a local trusted runtime machine (the
// `dfp-runtime-bridge` local service) calls OUTBOUND over HTTPS. The cloud never
// requires direct inbound TCP access to n8n / Ollama / Docker / private LAN.
// This phase is CONNECTIVITY + HEARTBEAT + SAFE HEALTH RELAY ONLY.
//
// It NEVER:
//   * executes an agent or n8n workflow
//   * performs Ollama inference
//   * calls a model/tool, retrieves knowledge, sends notifications
//   * creates/updates a Run or mutates orchestration execution state
//   * runs schedules or performs remediation
//   * proxies arbitrary URLs/IPs/ports/files/shell commands
//
// Machine authentication (fail-closed, no internal-staff JWT):
//   * Signed headers: X-DFP-Identity, X-DFP-Timestamp, X-DFP-Nonce,
//     X-DFP-Signature-Version, X-DFP-Signature.
//   * Canonical HMAC-SHA256 over identity \n timestamp \n nonce \n method \n
//     path \n payload-hash.
//   * Signing secret = DFP_RUNTIME_BRIDGE_SIGNING_KEY (server-side only). If it
//     is not configured → fails closed with `configuration_missing`.
//   * Service identity `dfp-local-runtime-bridge` is revalidated server-side.
//     Callback/connectivity auth is separate from execution permission — the
//     identity remains BLOCKED for execution, and `execution_enabled` on every
//     node is forced FALSE.
//   * ±5-minute timestamp window, nonce replay protection (hashed + reuse
//     rejected), idempotent message_id (duplicates return the stored result).
//
// Allowlisted operations only: handshake, heartbeat, report_health,
// report_capabilities, fetch_control_messages. Unknown → reject. No arbitrary
// URL proxy is possible — local check targets are configured in the bridge
// itself, never supplied by the cloud.
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

const ALLOWED_OPERATIONS = new Set([
  "handshake",
  "heartbeat",
  "report_health",
  "report_capabilities",
  "fetch_control_messages",
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

const ALLOWED_CONTROL_MESSAGE_TYPES = new Set(["health_request", "capability_request"]);

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

  // --- Idempotency (duplicate message_id → stored result, no re-process) ------
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

  // --- Replay protection (nonce reuse) ---------------------------------------
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

  // Resolve node (for non-handshake operations).
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

  // --- Helper: persist the inbound message ledger row ------------------------
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
  // HANDSHAKE — register node, record handshake evidence, NO execution.
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

    // Upsert node — execution_enabled is ALWAYS forced false.
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

  // Node required for all remaining operations.
  if (!nodeKey || !nodeId) {
    return json({ error: "Unknown bridge node — handshake required first." }, 404);
  }

  // ===========================================================================
  // HEARTBEAT — outbound connectivity evidence, persisted state. NO execution.
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
  // REPORT_HEALTH — relay sanitised LOCAL n8n / Ollama / bridge health only.
  //   Persisted into ai_runtime_health_checks with source='local_bridge' so the
  //   cloud-vs-local distinction is preserved. NO inference, NO workflow, NO
  //   arbitrary targets.
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
  // REPORT_CAPABILITIES — update allowlisted capabilities only.
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
  // FETCH_CONTROL_MESSAGES — return only allowlisted pending control messages.
  //   health_request / capability_request only. NO execute/run/call/shell.
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
      const keys = messages.map((m) => m.message_key);
      await admin.from("ai_runtime_bridge_messages").update({
        status: "acknowledged",
        acknowledged_at: receivedAt,
      }).in("message_key", keys);
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

  return json({ error: "unknown_operation" }, 422);
});
