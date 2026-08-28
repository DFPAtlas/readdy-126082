import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// ai-runtime-callback — secure inbound machine-message boundary for DFP AI
// Operations (Phase 3 Prompt 07).
//
// This is the trusted server-side endpoint that future n8n runtime workflows
// will use to communicate BACK to DFP Command. This phase is CALLBACK
// VERIFICATION + GOVERNANCE RECORDING ONLY — it never executes an agent,
// triggers a workflow, creates/updates a Run, completes an orchestration step,
// approves anything, calls a model/tool, retrieves knowledge, sends
// notifications, or mutates business/site data.
//
// Authentication (fail-closed, machine → no internal-staff JWT):
//   * Signed headers: X-DFP-Identity, X-DFP-Timestamp, X-DFP-Nonce,
//     X-DFP-Signature-Version, X-DFP-Signature.
//   * Canonical HMAC-SHA256 over: identity \n timestamp \n nonce \n method \n
//     path \n payload-hash (deterministic, never ambiguous JSON).
//   * Signing secret = DFP_N8N_RUNTIME_SIGNING_KEY (server-side only). If it is
//     not configured → fails closed with `configuration_missing`.
//   * Service identity `dfp-n8n-runtime` is revalidated server-side (type n8n,
//     environment match, allowlisted credential reference). The identity may
//     remain BLOCKED for execution — callback auth and execution permission are
//     separate concepts.
//   * Timestamp window (±5 min), nonce replay protection, idempotent message_id.
//
// Deny-only safety properties:
//   * Strict 64 KB body limit; invalid JSON / unknown versions / unknown
//     message types / unknown payload types are rejected.
//   * connector_handshake / connector_heartbeat are recorded (no execution).
//   * dispatch_ack / workflow_progress / workflow_result / workflow_error are
//     record/reject-only: no authorised dispatch exists, so they never mutate
//     ai_runs or ai_orchestrations and return "BLOCKED — no authorised
//     dispatch exists".
//   * Callback `payload` is DATA only — never interpreted as SQL/URL/command/
//     tool/model/function. Raw result bodies are never persisted (only safe
//     summary + hashes + validated identifiers).
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, x-dfp-identity, x-dfp-timestamp, x-dfp-nonce, x-dfp-signature-version, x-dfp-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNING_SECRET_NAME = "DFP_N8N_RUNTIME_SIGNING_KEY";
const IDENTITY_KEY = "dfp-n8n-runtime";
const IDENTITY_TYPE = "n8n";
const SOURCE_SYSTEM = "n8n";
const SIGNATURE_VERSION = "v1";
const TIMESTAMP_WINDOW_MS = 5 * 60_000; // ±5 minutes
const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const MAX_SUMMARY_CHARS = 500;

const ALLOWED_MESSAGE_TYPES = new Set([
  "connector_handshake",
  "connector_heartbeat",
  "dispatch_ack",
  "workflow_progress",
  "workflow_result",
  "workflow_error",
]);

const EXECUTION_CALLBACK_TYPES = new Set([
  "dispatch_ack",
  "workflow_progress",
  "workflow_result",
  "workflow_error",
]);

const ALLOWED_PAYLOAD_TYPES = new Set([
  "handshake",
  "status_summary",
  "result_reference",
  "error_summary",
  "progress_summary",
]);

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

async function resolveId(
  admin: ReturnType<typeof createClient>,
  table: string,
  keyColumn: string,
  keyValue: string | null,
): Promise<string | null> {
  if (!keyValue) return null;
  const { data } = await admin.from(table).select("id").eq(keyColumn, keyValue).limit(1);
  return data && data.length > 0 ? (data[0].id as string) : null;
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

  // --- Signature version -----------------------------------------------------
  if (sigVersion !== SIGNATURE_VERSION) {
    return json({ error: "invalid_message", detail: "unknown_signature_version" }, 400);
  }

  // --- Timestamp window ------------------------------------------------------
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

  // --- Server-side service-identity validation -------------------------------
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: idRows } = await admin
    .from("ai_runtime_service_identities")
    .select("id, identity_key, identity_type, environment, credential_reference, status")
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
  const version = str(body.version);
  if (version !== "v1") return json({ error: "invalid_message", detail: "unsupported_version" }, 400);

  const messageId = str(body.message_id);
  if (!messageId) return json({ error: "invalid_message", detail: "missing_message_id" }, 400);

  const messageType = str(body.message_type);
  if (!ALLOWED_MESSAGE_TYPES.has(messageType)) {
    return json({ error: "unknown_message_type" }, 422);
  }

  const sourceSystem = str(body.source_system);
  const sourceIdentity = str(body.source_identity);
  if (sourceSystem !== SOURCE_SYSTEM || sourceIdentity !== IDENTITY_KEY) {
    return json({ error: "invalid_message", detail: "source_mismatch" }, 400);
  }

  const environment = str(body.environment);
  if (environment !== (idRow.environment ?? "production")) {
    return json({ error: "invalid_message", detail: "unexpected_environment" }, 400);
  }

  const occurredAtRaw = str(body.occurred_at);
  const occurredAt = Date.parse(occurredAtRaw);
  if (!occurredAtRaw || !Number.isFinite(occurredAt)) {
    return json({ error: "invalid_message", detail: "invalid_timestamp" }, 400);
  }

  const payloadType = str(body.payload_type);
  if (!ALLOWED_PAYLOAD_TYPES.has(payloadType)) {
    return json({ error: "unknown_payload_type" }, 422);
  }

  const requestKey = str(body.request_key) || null;
  const correlationId = str(body.correlation_id) || null;
  const workflowKey = str(body.workflow_key) || null;
  const siteKey = str(body.site_key) || null;
  const agentKey = str(body.agent_key) || null;
  const orchestrationKey = str(body.orchestration_key) || null;
  const idempotencyKey = str(body.idempotency_key) || null;
  const safeSummary = typeof body.safe_summary === "string"
    ? body.safe_summary.slice(0, MAX_SUMMARY_CHARS)
    : null;
  const outcome = typeof body.outcome === "string" ? body.outcome.slice(0, 200) : null;

  const nonceHash = await sha256Hex(nonce);
  const now = new Date();
  const receivedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + TIMESTAMP_WINDOW_MS).toISOString();

  // --- Idempotency (duplicate message_id → deterministic result) --------------
  const { data: dupRows } = await admin
    .from("ai_runtime_callbacks")
    .select("callback_key, message_id, verification_state, processing_state, rejected_reason")
    .eq("message_id", messageId)
    .limit(1);
  if (dupRows && dupRows.length > 0) {
    const d = dupRows[0];
    return json({
      accepted: true,
      duplicate: true,
      callbackKey: d.callback_key,
      messageId: d.message_id,
      verificationState: d.verification_state,
      processingState: d.processing_state,
      rejectedReason: d.rejected_reason ?? null,
      message: "This message was already recorded. No duplicate processing occurred.",
    });
  }

  // --- Replay protection (nonce reuse) ---------------------------------------
  const { data: nonceRows } = await admin
    .from("ai_runtime_callbacks")
    .select("id")
    .eq("nonce_hash", nonceHash)
    .limit(1);
  if (nonceRows && nonceRows.length > 0) {
    // Authenticated but replayed — a meaningful governance event, not noise.
    await admin.from("ai_audit_events").insert({
      audit_key: uid("CBK"),
      occurred_at: receivedAt,
      event_type: "runtime_callback_replay_blocked",
      action: "runtime_callback",
      outcome: "blocked",
      severity: "medium",
      actor_type: "system",
      actor_reference: identity,
      trigger_source: "machine",
      environment,
      notes: `Replayed runtime callback nonce detected for identity ${identity}. Message ${messageId}.`,
    });
    return json({ error: "replay_detected" }, 409);
  }

  // --- Correlation resolution (server-side, authoritative) --------------------
  let executionRequestId: string | null = null;
  let executionAllowed = false;
  if (requestKey) {
    const { data: reqRows } = await admin
      .from("ai_runtime_execution_requests")
      .select("id, request_key, correlation_id, execution_allowed")
      .eq("request_key", requestKey)
      .limit(1);
    const reqRow = reqRows && reqRows.length > 0 ? reqRows[0] : null;
    if (reqRow) {
      executionRequestId = reqRow.id as string;
      executionAllowed = reqRow.execution_allowed === true;
    }
  }

  const siteId = await resolveId(admin, "ai_sites", "site_key", siteKey);
  const agentId = await resolveId(admin, "ai_operations_agents", "agent_key", agentKey);
  const orchestrationId = await resolveId(admin, "ai_orchestrations", "orchestration_key", orchestrationKey);

  // --- Deny-only processing decision -----------------------------------------
  const isExecutionCallback = EXECUTION_CALLBACK_TYPES.has(messageType);

  let verificationState = "verified";
  let processingState = "recorded";
  let rejectedReason: string | null = null;
  let finalOutcome: string | null = outcome;

  if (isExecutionCallback) {
    // Workflow execution callbacks require an authorised dispatch. Execution
    // Dispatch = Not Started, and every existing request has execution_allowed
    // = false, so these are record/reject-only — never mutate Runs/Orchestrations.
    if (!requestKey || !executionRequestId) {
      rejectedReason = "correlation_mismatch";
      processingState = "blocked";
      verificationState = "verified";
    } else if (!executionAllowed) {
      rejectedReason = "dispatch_not_authorised";
      processingState = "blocked";
      verificationState = "verified";
    } else {
      // Defensive: should be unreachable while dispatch is disabled.
      rejectedReason = "dispatch_not_authorised";
      processingState = "blocked";
      verificationState = "verified";
    }
    finalOutcome = null; // never record a workflow "success" outcome without dispatch
  }

  // --- Persist append-only callback record (service-role → bypasses RLS) ------
  const callbackKey = uid("CBK");
  const { error: insertError } = await admin.from("ai_runtime_callbacks").insert({
    callback_key: callbackKey,
    message_id: messageId,
    idempotency_key: idempotencyKey,
    correlation_id: correlationId,
    callback_type: messageType,
    source_system: sourceSystem,
    service_identity_id: idRow.id as string,
    execution_request_id: executionRequestId,
    workflow_key: workflowKey,
    site_id: siteId,
    agent_id: agentId,
    orchestration_id: orchestrationId,
    run_id: null, // never resolved — no Run mutation is permitted
    environment,
    signature_version: SIGNATURE_VERSION,
    nonce_hash: nonceHash,
    payload_hash: payloadHash,
    verification_state: verificationState,
    processing_state: processingState,
    outcome: finalOutcome,
    safe_summary: safeSummary,
    received_at: receivedAt,
    occurred_at: new Date(occurredAt).toISOString(),
    expires_at: expiresAt,
    rejected_reason: rejectedReason,
  });

  // --- Audit (meaningful authenticated events only; never claims execution) --
  if (!insertError) {
    if (messageType === "connector_handshake") {
      await admin.from("ai_audit_events").insert({
        audit_key: uid("CBK"),
        occurred_at: receivedAt,
        event_type: "runtime_callback_handshake_verified",
        action: "runtime_callback",
        outcome: "success",
        severity: "low",
        actor_type: "system",
        actor_reference: identity,
        trigger_source: "machine",
        environment,
        correlation_id: correlationId,
        notes: `n8n callback handshake verified (signature + identity + nonce). No run, agent or workflow was executed. Callback ${callbackKey}.`,
      });
    } else if (isExecutionCallback) {
      await admin.from("ai_audit_events").insert({
        audit_key: uid("CBK"),
        occurred_at: receivedAt,
        event_type: "runtime_callback_rejected",
        action: "runtime_callback",
        outcome: "blocked",
        severity: "medium",
        actor_type: "system",
        actor_reference: identity,
        trigger_source: "machine",
        environment,
        correlation_id: correlationId,
        notes: `Execution callback ${messageType} recorded but not processed: ${rejectedReason}. No run/orchestration mutation occurred.`,
      });
    } else {
      await admin.from("ai_audit_events").insert({
        audit_key: uid("CBK"),
        occurred_at: receivedAt,
        event_type: "runtime_callback_received",
        action: "runtime_callback",
        outcome: "success",
        severity: "low",
        actor_type: "system",
        actor_reference: identity,
        trigger_source: "machine",
        environment,
        correlation_id: correlationId,
        notes: `Authenticated runtime callback ${messageType} recorded (no execution). Callback ${callbackKey}.`,
      });
    }
  }

  // --- Safe response ---------------------------------------------------------
  if (isExecutionCallback) {
    return json({
      accepted: !insertError,
      allowed: false,
      blocked: true,
      callbackKey,
      messageId,
      verificationState,
      processingState,
      rejectedReason,
      message: "BLOCKED — no authorised dispatch exists. Callback recorded only; no run, agent or workflow state was mutated.",
    }, 200);
  }

  return json({
    accepted: !insertError,
    allowed: false,
    blocked: false,
    callbackKey,
    messageId,
    verificationState,
    processingState,
    rejectedReason,
    message: "Callback accepted for verification and recorded. No execution occurred.",
  });
});
