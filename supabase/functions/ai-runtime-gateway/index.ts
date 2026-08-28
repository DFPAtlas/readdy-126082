import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// ai-runtime-gateway — central, trusted, DENY-ONLY runtime boundary for DFP AI
// Operations (Phase 3 Prompt 05).
//
// This is the ONLY intended entry point for future AI Operations execution
// requests. For this phase it ALWAYS evaluates a request and NEVER executes
// it. The Master Kill Switch is ON and Production Enabled = 0, so every
// production request is blocked. No agent, n8n workflow, model, tool,
// knowledge retrieval, notification, or schedule is ever triggered here.
//
// Caller authentication (fail-closed):
//   * Human/internal UI → Bearer JWT, resolved via public.internal_role().
//   * Machine (scheduler / n8n / internal) → HMAC-SHA256 signed headers,
//     verified against DFP_RUNTIME_SIGNING_SECRET + the allowlisted
//     ai_runtime_service_identities registry. Secret is server-side only and
//     never leaves this function.
//   * Anything else → 401. Anonymous requests always fail.
//
// Deny-only safety properties:
//   * Allowlisted request types only (unknown action → rejected).
//   * Idempotency key required; replays return the stored result (no duplicate
//     attempt). Replay/staleness checks are server-side.
//   * Deterministic SHA-256 request hash over safe envelope fields (tamper
//     evidence / duplicate detection) — secrets never hashed or persisted.
//   * Site / agent / orchestration / approval / policy / runtime controls are
//     all reloaded server-side (browser metadata is never trusted).
//   * Health freshness + configuration readiness are verified from persisted
//     state. Stale / missing / unverified → block.
//   * Scheduler handshake UNVERIFIED → scheduled requests blocked.
//   * All 14 gates are evaluated deterministically (same order as the client
//     evaluator). Execution dispatch is NOT STARTED.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-dfp-runtime-identity, x-dfp-runtime-signature, x-dfp-runtime-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_REQUEST_TYPES = new Set([
  "evaluate_orchestration",
  "request_agent_run",
  "scheduled_agent_run",
  "retry_run",
  "remediation_request",
]);

// Required runtime-dependency systems per request type (config + health gates).
const REQUEST_DEPENDENCIES: Record<string, string[]> = {
  evaluate_orchestration: [],
  request_agent_run: ["n8n", "openai"],
  scheduled_agent_run: ["n8n", "openai"],
  retry_run: ["n8n", "openai"],
  remediation_request: ["n8n"],
};

// Server-side secret-presence map (values never read beyond emptiness).
const CONFIG_REQUIRED: Record<string, string[]> = {
  n8n: ["N8N_URL", "N8N_API_KEY"],
  ollama: ["OLLAMA_URL"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  resend: ["RESEND_API_KEY"],
  stripe: ["STRIPE_SECRET_KEY"],
  github: ["GITHUB_TOKEN"],
};

const TIMESTAMP_WINDOW_MS = 5 * 60_000; // 5 minutes
const HEALTH_FRESHNESS_MS = 15 * 60_000; // 15 minutes
const PRODUCTION_ENABLED = false; // authoritative — remains 0 in this phase
const RUNTIME_AVAILABLE = false; // no execution runtime — dispatch NOT STARTED

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

interface Gate {
  key: string;
  label: string;
  state: "pass" | "block" | "not_ready" | "not_required";
  note: string;
}

interface EvaluationInput {
  environment: string;
  productionEnabled: boolean;
  master: { enabled: boolean; execution_allowed: boolean } | null;
  site: { active: boolean; gateAllowed: boolean } | null;
  hasSite: boolean;
  agent: { active: boolean; gateAllowed: boolean } | null;
  hasAgent: boolean;
  riskLevel: "green" | "amber" | "red" | null;
  riskCeiling: "green" | "amber" | "red" | null;
  policyEffect: "allow" | "allow_with_conditions" | "require_approval" | "restrict" | "deny" | "audit_only" | null;
  approvalState: "approved" | "pending" | "rejected" | "expired" | "none" | null;
  runtimeConfigured: boolean;
  runtimeHealthy: boolean;
  toolsReady: boolean;
  modelReady: boolean;
  knowledgeReady: boolean;
  schedulerVerified: boolean;
  isScheduled: boolean;
  runtimeAvailable: boolean;
}

function evaluateGates(input: EvaluationInput): { allowed: boolean; gates: Gate[]; reasons: string[]; requiredGates: string[] } {
  const gates: Gate[] = [];
  const reasons: string[] = [];
  const requiredGates: string[] = [];
  const push = (key: string, label: string, state: Gate["state"], note: string) => {
    gates.push({ key, label, state, note });
    if (state === "block") {
      reasons.push(note);
      requiredGates.push(label);
    }
  };

  // 1. Master Kill Switch
  if (!input.master) push("master_kill_switch", "Master Kill Switch", "block", "Master kill switch is not provisioned — execution is blocked by default.");
  else if (input.master.enabled && !input.master.execution_allowed) push("master_kill_switch", "Master Kill Switch", "block", "Master kill switch is ON — all execution is blocked.");
  else if (input.master.execution_allowed) push("master_kill_switch", "Master Kill Switch", "pass", "Master kill switch allows execution.");
  else push("master_kill_switch", "Master Kill Switch", "block", "Master kill switch does not allow execution.");

  // 2. Environment
  push("environment", "Environment", "pass", `Target environment is ${input.environment}.`);

  // 3. Production Enabled
  push("production_enabled", "Production Enabled", input.productionEnabled ? "pass" : "block", input.productionEnabled ? "Production execution is enabled." : "Production execution is disabled (Production Enabled = 0).");

  // 4. Site Gate
  if (!input.hasSite) push("site_gate", "Site Execution Gate", "not_required", "No site scope — site gate not required.");
  else if (input.site && input.site.active && input.site.gateAllowed) push("site_gate", "Site Execution Gate", "pass", "Site execution is explicitly allowed.");
  else push("site_gate", "Site Execution Gate", "block", "Site execution is not allowed (default deny).");

  // 5. Agent Gate
  if (!input.hasAgent) push("agent_gate", "Agent Execution Gate", "not_required", "No agent scope — agent gate not required.");
  else if (input.agent && input.agent.active && input.agent.gateAllowed) push("agent_gate", "Agent Execution Gate", "pass", "Agent execution is explicitly allowed.");
  else push("agent_gate", "Agent Execution Gate", "block", "Agent execution is not allowed (default deny).");

  // 6. Runtime Configuration
  push("runtime_config", "Runtime Configuration", input.runtimeConfigured ? "pass" : "block", input.runtimeConfigured ? "Required runtime dependencies are configured." : "Required runtime dependencies are not configured.");

  // 7. Runtime Health
  push("runtime_health", "Runtime Health", input.runtimeHealthy ? "pass" : "block", input.runtimeHealthy ? "Required runtime dependencies are healthy and fresh." : "Required runtime dependencies are not healthy / not verified (or health evidence is stale).");

  // 8. Security Policy
  switch (input.policyEffect) {
    case "allow": push("policy", "Security Policy", "pass", "Policy allows the requested action."); break;
    case "audit_only": push("policy", "Security Policy", "pass", "Policy is audit-only (non-blocking)."); break;
    case "allow_with_conditions": push("policy", "Security Policy", "not_ready", "Policy allows with conditions — conditions must be evaluated."); break;
    case "require_approval": push("policy", "Security Policy", "block", "Policy requires approval before execution."); break;
    case "restrict":
    case "deny": push("policy", "Security Policy", "block", `Policy ${input.policyEffect}s the requested action.`); break;
    default: push("policy", "Security Policy", "block", "No policy result available — execution blocked.");
  }

  // 9. Risk Gate
  if (input.riskLevel && input.riskCeiling) {
    const order = { green: 0, amber: 1, red: 2 } as const;
    push("risk_gate", "Risk Gate", order[input.riskLevel] > order[input.riskCeiling] ? "block" : "pass", order[input.riskLevel] > order[input.riskCeiling] ? `Risk ${input.riskLevel.toUpperCase()} exceeds the ${input.riskCeiling.toUpperCase()} ceiling.` : `Risk ${input.riskLevel.toUpperCase()} is within the ${input.riskCeiling.toUpperCase()} ceiling.`);
  } else push("risk_gate", "Risk Gate", "not_ready", "Risk level or ceiling is not defined.");

  // 10. Human Approval
  switch (input.approvalState) {
    case "approved": push("approval", "Human Approval", "pass", "Approval granted (does not independently enable execution)."); break;
    case "pending": push("approval", "Human Approval", "block", "Approval is still pending."); break;
    case "rejected": push("approval", "Human Approval", "block", "Approval was rejected."); break;
    case "expired": push("approval", "Human Approval", "block", "Approval has expired."); break;
    default: push("approval", "Human Approval", "not_ready", "No approval state — approval is required.");
  }

  // 11. Required Tool Access
  push("tools", "Required Tool Access", input.toolsReady ? "pass" : "block", input.toolsReady ? "Required tools are accessible." : "Required tool access is missing.");

  // 12. Required Model Assignment
  push("model", "Required Model Assignment", input.modelReady ? "pass" : "block", input.modelReady ? "A model is assigned." : "No model is assigned.");

  // 13. Required Knowledge Access
  push("knowledge", "Required Knowledge Access", input.knowledgeReady ? "pass" : "block", input.knowledgeReady ? "Required knowledge is accessible." : "Required knowledge access is missing.");

  // 14. Execution Runtime Available (+ scheduler handshake for scheduled)
  if (input.isScheduled) {
    push("scheduler", "Scheduler Handshake", input.schedulerVerified ? "pass" : "block", input.schedulerVerified ? "Scheduler handshake verified." : "Scheduler handshake is unverified — scheduled execution is blocked.");
  }
  push("runtime", "Execution Runtime Available", input.runtimeAvailable ? "pass" : "block", input.runtimeAvailable ? "Execution runtime is available." : "Execution runtime is not available (dispatch not started).");

  const allowed = !gates.some((g) => g.state === "block");
  return { allowed, gates, reasons, requiredGates };
}

function secretPresent(name: string): boolean {
  return (Deno.env.get(name) ?? "").trim().length > 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- Caller resolution (fail closed) --------------------------------------
  const authHeader = req.headers.get("authorization") ?? "";
  let caller:
    | { kind: "human"; email: string; id: string }
    | { kind: "machine"; identityKey: string; identityId: string | null }
    | null = null;

  if (authHeader.startsWith("Bearer ")) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: role } = await userClient.rpc("internal_role");
      if (role) caller = { kind: "human", email: user.email ?? user.id, id: user.id };
    }
  }

  if (!caller) {
    // Machine / signed-request path — prepared verification infrastructure.
    const identity = (req.headers.get("x-dfp-runtime-identity") ?? "").trim();
    const signature = (req.headers.get("x-dfp-runtime-signature") ?? "").trim();
    const tsRaw = (req.headers.get("x-dfp-runtime-timestamp") ?? "").trim();
    const signingSecret = (Deno.env.get("DFP_RUNTIME_SIGNING_SECRET") ?? "").trim();

    if (identity && signature && tsRaw && signingSecret) {
      const rawBody = await req.clone().text();
      const bodyHash = await sha256Hex(rawBody);
      const tsNum = Number(tsRaw);
      const fresh = Number.isFinite(tsNum) && Math.abs(Date.now() - tsNum) <= TIMESTAMP_WINDOW_MS;
      const canonical = `${identity}\n${tsRaw}\n${bodyHash}`;
      const expected = await hmacSha256Hex(signingSecret, canonical);
      const okSig = timingSafeEqual(expected.toLowerCase(), signature.toLowerCase());

      if (okSig && fresh) {
        const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { data: idRows } = await admin.from("ai_runtime_service_identities").select("id, status, is_active, expires_at").eq("identity_key", identity).limit(1);
        const idRow = idRows && idRows.length > 0 ? idRows[0] : null;
        const now = new Date();
        const notExpired = !idRow?.expires_at || new Date(idRow.expires_at) > now;
        const allowed = idRow && idRow.status !== "blocked" && idRow.status !== "disabled" && idRow.is_active === true && notExpired;
        if (allowed) {
          caller = { kind: "machine", identityKey: identity, identityId: idRow.id };
        } else {
          return json({ error: "Unknown or blocked service identity." }, 403);
        }
      } else {
        return json({ error: "Invalid or stale machine signature." }, 401);
      }
    } else {
      // Machine path not configured (no signing secret) → fail closed.
      return json({ error: "Unauthorized" }, 401);
    }
  }

  // --- Parse + validate body -------------------------------------------------
  let rawBody = "";
  let body: Record<string, unknown> = {};
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody || "");
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  if (!idempotencyKey) return json({ error: "idempotency_key is required." }, 400);

  const requestType = typeof body.request_type === "string" ? body.request_type : "";
  if (!ALLOWED_REQUEST_TYPES.has(requestType)) return json({ error: "Unknown or disallowed request type." }, 422);

  const environment = typeof body.environment === "string" && body.environment ? body.environment : "production";
  const siteKey = typeof body.site_key === "string" ? body.site_key : null;
  const agentKey = typeof body.agent_key === "string" ? body.agent_key : null;
  const orchestrationKey = typeof body.orchestration_key === "string" ? body.orchestration_key : null;
  const approvalKey = typeof body.approval_key === "string" ? body.approval_key : null;
  const requestedAction = typeof body.requested_action === "string" ? body.requested_action : null;
  const riskLevelRaw = typeof body.risk_level === "string" ? body.risk_level : null;
  const riskLevel = riskLevelRaw === "amber" || riskLevelRaw === "red" || riskLevelRaw === "green" ? riskLevelRaw : null;
  const requestedAtRaw = typeof body.requested_at === "string" ? body.requested_at : null;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // --- Replay / staleness checks --------------------------------------------
  if (requestedAtRaw) {
    const ts = Date.parse(requestedAtRaw);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_WINDOW_MS) {
      return json({ error: "Request timestamp outside the allowed window (stale or replayed)." }, 422);
    }
  }

  // Idempotency — repeated key must not create a duplicate attempt.
  const { data: existing } = await admin
    .from("ai_runtime_execution_requests")
    .select("request_key, idempotency_key, request_hash, status, gate_result, execution_allowed, blocked_reasons, required_gates, requested_at, created_at")
    .eq("idempotency_key", idempotencyKey)
    .limit(1);

  if (existing && existing.length > 0) {
    const e = existing[0];
    return json({
      accepted: true,
      allowed: e.execution_allowed,
      blocked: true,
      status: e.status,
      requestKey: e.request_key,
      idempotencyKey: e.idempotency_key,
      requestHash: e.request_hash,
      evaluatedAt: e.requested_at,
      reasons: e.blocked_reasons ?? [],
      requiredGates: e.required_gates ?? [],
      gates: [],
      duplicate: true,
      message: "A request with this idempotency key was already evaluated. No duplicate attempt was created.",
    });
  }

  // --- Deterministic request hash (safe fields only, no secrets) -------------
  const requestHash = await sha256Hex(
    [requestType, siteKey ?? "", agentKey ?? "", orchestrationKey ?? "", requestedAction ?? "", riskLevel ?? "", requestedAtRaw ?? "", idempotencyKey, environment].join("\n"),
  );

  // --- Server-side reload of authoritative state ----------------------------
  const { data: masterRows } = await admin.from("ai_runtime_controls").select("*").eq("control_type", "master_kill_switch").limit(1);
  const masterRow = masterRows && masterRows.length > 0 ? masterRows[0] : null;
  const { data: riskRows } = await admin.from("ai_runtime_controls").select("*").eq("control_type", "risk_gate").limit(1);
  const riskRow = riskRows && riskRows.length > 0 ? riskRows[0] : null;

  let siteRow: Record<string, unknown> | null = null;
  if (siteKey) {
    const { data: rows } = await admin.from("ai_sites").select("id, site_key, environment, is_active").eq("site_key", siteKey).limit(1);
    siteRow = rows && rows.length > 0 ? rows[0] : null;
  }

  let agentRow: Record<string, unknown> | null = null;
  if (agentKey) {
    const { data: rows } = await admin.from("ai_operations_agents").select("id, agent_key, site_id, environment, is_active, status").eq("agent_key", agentKey).limit(1);
    agentRow = rows && rows.length > 0 ? rows[0] : null;
  }

  let orchestrationRow: Record<string, unknown> | null = null;
  if (orchestrationKey) {
    const { data: rows } = await admin.from("ai_orchestrations").select("id, orchestration_key, site_id, selected_agent_id, approval_id, approval_required, risk_level, policy_result, permission_result, execution_allowed, status").eq("orchestration_key", orchestrationKey).limit(1);
    orchestrationRow = rows && rows.length > 0 ? rows[0] : null;
  }

  let approvalState: "approved" | "pending" | "rejected" | "expired" | "none" = "none";
  let approvalId: string | null = null;
  const approvalRef = approvalKey ?? (orchestrationRow?.approval_id as string | null) ?? null;
  if (approvalRef) {
    const { data: appRows } = await admin.from("ai_approvals").select("id, status").or(`approval_key.eq.${approvalRef},id.eq.${approvalRef}`).limit(1);
    const appRow = appRows && appRows.length > 0 ? appRows[0] : null;
    if (appRow) {
      approvalId = appRow.id as string;
      const s = String(appRow.status ?? "");
      if (s === "approved" || s === "approved_with_conditions") approvalState = "approved";
      else if (s === "rejected") approvalState = "rejected";
      else if (s === "expired") approvalState = "expired";
      else approvalState = "pending";
    }
  }

  const policyEffect = (() => {
    const p = String(orchestrationRow?.policy_result ?? "");
    const perm = String(orchestrationRow?.permission_result ?? "");
    if (p === "deny" || perm === "deny") return "deny" as const;
    if (p === "restrict" || perm === "restrict") return "restrict" as const;
    if (p === "require_approval") return "require_approval" as const;
    if (p === "allow") return "allow" as const;
    return null;
  })();

  // Site / agent gates (default deny).
  let siteGateAllowed = false;
  if (siteRow) {
    const { data: gates } = await admin.from("ai_runtime_controls").select("*").eq("control_type", "site_execution_gate").eq("site_id", siteRow.id as string).limit(1);
    const g = gates && gates.length > 0 ? gates[0] : null;
    siteGateAllowed = !!(g && g.enabled === true && g.execution_allowed === true);
  }
  let agentGateAllowed = false;
  if (agentRow) {
    const { data: gates } = await admin.from("ai_runtime_controls").select("*").eq("control_type", "agent_execution_gate").eq("agent_id", agentRow.id as string).limit(1);
    const g = gates && gates.length > 0 ? gates[0] : null;
    agentGateAllowed = !!(g && g.enabled === true && g.execution_allowed === true);
  }

  // Configuration readiness (required deps present server-side).
  const requiredSystems = REQUEST_DEPENDENCIES[requestType] ?? [];
  const runtimeConfigured = requiredSystems.every((sys) => (CONFIG_REQUIRED[sys] ?? []).every((n) => secretPresent(n)));

  // Health freshness (latest persisted check per required system).
  let runtimeHealthy = false;
  if (requiredSystems.length === 0) {
    runtimeHealthy = false; // no deps → still not independently "healthy"; execution blocked anyway
  } else {
    const freshCutoff = new Date(Date.now() - HEALTH_FRESHNESS_MS).toISOString();
    let allFresh = true;
    for (const sys of requiredSystems) {
      const { data: checks } = await admin
        .from("ai_runtime_health_checks")
        .select("status, checked_at")
        .eq("system_slug", sys)
        .order("checked_at", { ascending: false })
        .limit(1);
      const latest = checks && checks.length > 0 ? checks[0] : null;
      if (!latest || latest.status !== "healthy" || new Date(latest.checked_at as string) < new Date(freshCutoff)) {
        allFresh = false;
        break;
      }
    }
    runtimeHealthy = allFresh;
  }

  const isScheduled = requestType === "scheduled_agent_run";

  // --- Evaluate the 14 gates (deny-only) ------------------------------------
  const decision = evaluateGates({
    environment,
    productionEnabled: PRODUCTION_ENABLED,
    master: masterRow ? { enabled: masterRow.enabled === true, execution_allowed: masterRow.execution_allowed === true } : null,
    site: siteRow ? { active: siteRow.is_active === true, gateAllowed: siteGateAllowed } : null,
    hasSite: !!siteKey,
    agent: agentRow ? { active: agentRow.is_active === true, gateAllowed: agentGateAllowed } : null,
    hasAgent: !!agentKey,
    riskLevel: (riskLevel ?? (orchestrationRow?.risk_level as "green" | "amber" | "red" | undefined) ?? null) as "green" | "amber" | "red" | null,
    riskCeiling: (riskRow?.risk_ceiling as "green" | "amber" | "red" | null) ?? "green",
    policyEffect,
    approvalState,
    runtimeConfigured,
    runtimeHealthy,
    toolsReady: false,
    modelReady: false,
    knowledgeReady: false,
    schedulerVerified: false,
    isScheduled,
    runtimeAvailable: RUNTIME_AVAILABLE,
  });

  const allowed = decision.allowed;
  const status = allowed ? "blocked" : "blocked"; // deny-only: always blocked in this phase
  const requestKey = uid("REQ");
  const correlationId = uid("COR");
  const now = new Date();
  const evaluatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + TIMESTAMP_WINDOW_MS).toISOString();

  // --- Persist append-only request record (service-role → bypasses RLS) ------
  const { error: insertError } = await admin.from("ai_runtime_execution_requests").insert({
    request_key: requestKey,
    idempotency_key: idempotencyKey,
    correlation_id: correlationId,
    request_type: requestType,
    source_type: caller.kind,
    source_reference: caller.kind === "human" ? caller.email : caller.identityKey,
    service_identity_id: caller.kind === "machine" ? caller.identityId : null,
    user_reference: caller.kind === "human" ? caller.email : null,
    site_id: siteRow ? (siteRow.id as string) : null,
    agent_id: agentRow ? (agentRow.id as string) : null,
    orchestration_id: orchestrationRow ? (orchestrationRow.id as string) : null,
    run_id: null,
    approval_id: approvalId,
    environment,
    risk_level: riskLevel ?? (orchestrationRow?.risk_level as string | null) ?? null,
    requested_action: requestedAction,
    requested_at: evaluatedAt,
    gate_result: "blocked",
    execution_allowed: false,
    blocked_reasons: decision.reasons,
    required_gates: decision.requiredGates,
    request_hash: requestHash,
    status,
    expires_at: expiresAt,
  });

  // --- Audit (single event per non-duplicate request; never claims execution)
  const eventType = insertError ? "runtime_execution_request_rejected" : "runtime_execution_request_blocked";
  await admin.from("ai_audit_events").insert({
    audit_key: uid("AUD"),
    occurred_at: evaluatedAt,
    event_type: eventType,
    action: "runtime_execution_request",
    outcome: "blocked",
    severity: "medium",
    actor_type: caller.kind === "human" ? "human" : "system",
    actor_reference: caller.kind === "human" ? caller.email : caller.identityKey,
    trigger_source: caller.kind,
    environment,
    correlation_id: correlationId,
    risk_level: riskLevel ?? (orchestrationRow?.risk_level as string | null) ?? "green",
    notes: `Runtime execution request ${requestType} evaluated: execution denied (master kill switch ON / production disabled). Request ${requestKey}.`,
  });

  return json({
    accepted: !insertError,
    allowed: false,
    blocked: true,
    status: "blocked",
    requestKey,
    idempotencyKey,
    requestHash,
    evaluatedAt,
    reasons: decision.reasons,
    requiredGates: decision.requiredGates,
    gates: decision.gates,
    duplicate: false,
    persistError: insertError ? "Execution request history could not be saved." : null,
    message: "Request accepted for evaluation and blocked. No execution occurred.",
  });
});
