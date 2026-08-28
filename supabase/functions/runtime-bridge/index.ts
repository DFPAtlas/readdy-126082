import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge — secure OUTBOUND-FIRST private-runtime bridge API for DFP AI
// Operations (Phase 3 Prompt 08 + 09C + 10 + 11A).
//
// The trusted server-side endpoint that a local trusted runtime machine (the
// `dfp-runtime-bridge` local service) calls OUTBOUND over HTTPS. The cloud never
// requires direct inbound TCP access to n8n / Ollama / Docker / private LAN.
// This phase is CONNECTIVITY + HEARTBEAT + SAFE HEALTH RELAY + SANITISED OLLAMA
// CATALOGUE RELAY + DRY-RUN TRANSPORT PROBE (Prompt 10) + CONTROLLED OLLAMA
// SANDBOX INFERENCE PROBE (Prompt 11A).
//
// It NEVER:
//   * executes an agent or n8n workflow
//   * performs arbitrary Ollama inference (the ONLY generation allowed is the
//     single fixed dfp_ollama_ping_v1 sandbox diagnostic, mapped server-side)
//   * calls a model/tool, retrieves knowledge, sends notifications
//   * creates/updates a Run or mutates orchestration execution state
//   * runs schedules or performs remediation
//   * proxies arbitrary URLs/IPs/ports/files/shell commands
//   * mutates the ai_operations_models registry automatically
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
// report_transport_probe_ack, report_ollama_inference_probe.
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

const ALLOWED_OPERATIONS = new Set([
  "handshake",
  "heartbeat",
  "report_health",
  "report_capabilities",
  "report_ollama_catalogue",
  "fetch_control_messages",
  "report_transport_probe_ack",
  "report_ollama_inference_probe",
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
]);

// Control messages that have their own distinct signed-result lifecycle (they
// must NOT be marked "acknowledged" on fetch — they await a signed result).
const PROBE_CONTROL_TYPES = new Set(["runtime_transport_probe", "ollama_inference_probe"]);

const ALLOWED_PROBE_ACK_STATUSES = new Set(["verified", "rejected"]);

// Terminal result statuses the HAL may report for an Ollama probe.
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
  //   Persisted as an inbound ollama_catalogue_response message with
  //   source=local_bridge. Compared against ai_operations_models (deterministic,
  //   audit-only — the registry is NEVER mutated). NO inference, NO prompts,
  //   NO embeddings, NO pull/delete.
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

    // Deterministic registry comparison for audit only — never mutate registry.
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
      // Probe-type messages keep a distinct "delivered" lifecycle (they await a
      // signed result); all other control messages are marked acknowledged here.
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
  // REPORT_TRANSPORT_PROBE_ACK — signed acknowledgement for a dry-run transport
  //   probe (Prompt 10). The bridge replies with a NON-EXECUTING ack. The cloud
  //   validates: authenticated identity (already done), correct node, original
  //   outbound probe exists, correlation matches, not expired, and not already
  //   acknowledged. Never trusts caller-provided status blindly.
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

    // Original outbound probe must exist and be the correct direction/type.
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

    // Correct node + correlation must match.
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

    // Expiry check — an expired probe must never be acknowledged as successful.
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

    // Idempotency — a probe already acknowledged returns its existing state.
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

    // Deterministic status transition (never running/executing/completed_workflow).
    const finalStatus = ackStatus === "verified" ? "acknowledged" : "rejected";

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: acknowledgedAtLocal,
    }).eq("message_key", originalMessageKey);

    // Persist the signed ack as an inbound message (transport evidence).
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
  // REPORT_OLLAMA_INFERENCE_PROBE — signed result for the single fixed Ollama
  //   sandbox diagnostic (Prompt 11A). The local HAL reports the output of the
  //   ONE fixed dfp_ollama_ping_v1 generation. The cloud validates: correct
  //   node, original outbound probe exists, correlation matches, prompt_id/model
  //   are the fixed values, not expired, and not already recorded. The output is
  //   stored as signed evidence; "verified" is true ONLY when the output exactly
  //   equals DFP_OLLAMA_SANDBOX_OK. No arbitrary prompt/model is ever accepted.
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

    // Original outbound probe must exist and be the correct direction/type.
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

    // Correct node + correlation must match.
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

    // Fixed constraints — the reported prompt_id/model must be the fixed values.
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

    // Expiry check — an expired probe must never record a successful result.
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

    // Idempotency — a probe already in a terminal state returns existing state.
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

    // Determine verified: output must exactly equal the fixed expected string.
    const verified = output.trim() === OLLAMA_PROBE_EXPECTED_OUTPUT;
    const finalStatus = verified && resultStatus === "completed" ? "completed"
      : resultStatus === "completed" ? "failed"
      : resultStatus;

    await admin.from("ai_runtime_bridge_messages").update({
      status: finalStatus,
      acknowledged_at: generatedAt,
    }).eq("message_key", originalMessageKey);

    // Persist the signed result as an inbound message (evidence).
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

  return json({ error: "unknown_operation" }, 422);
});
