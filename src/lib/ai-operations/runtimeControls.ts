// ============================================================================
// AI Operations — Runtime controls & execution gates (Phase 3 Prompt 04).
//
// The central runtime safety-control layer: the authoritative group-wide master
// kill switch, per-site / per-agent execution gates, the risk ceiling, and a
// deterministic, fail-closed execution-gate evaluator.
//
// This is governance ONLY. Nothing here executes an agent, triggers n8n, calls a
// model, runs a tool, retrieves knowledge, sends a notification, or enables
// production runtime. The evaluator always blocks unless every required gate
// passes, and defaults to BLOCKED when any dependency is unknown.
//
// Sensitive control changes run through the `apply_runtime_control_change`
// SECURITY DEFINER RPC (atomic update + history + audit; owner-only for the
// master switch). The browser never performs a raw table write for these.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Row types -----------------------------------------------------------------

export type RuntimeControlType =
  | 'master_kill_switch'
  | 'site_execution_gate'
  | 'agent_execution_gate'
  | 'risk_gate'
  | 'runtime_feature_gate';

export type RuntimeControlScope = 'global' | 'group' | 'site' | 'agent';

export interface AiRuntimeControlRow {
  id: string;
  control_key: string;
  control_type: RuntimeControlType;
  scope_type: RuntimeControlScope | null;
  scope_reference: string | null;
  site_id: string | null;
  agent_id: string | null;
  environment: string;
  enabled: boolean;
  execution_allowed: boolean;
  reason: string | null;
  risk_ceiling: string | null;
  requires_approval: boolean;
  expires_at: string | null;
  changed_by: string | null;
  changed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiRuntimeControlHistoryRow {
  id: string;
  control_id: string;
  action: string;
  previous_enabled: boolean;
  new_enabled: boolean;
  previous_execution_allowed: boolean;
  new_execution_allowed: boolean;
  actor_reference: string | null;
  actor_role: string | null;
  reason: string | null;
  correlation_id: string | null;
  created_at: string;
}

// --- Data access --------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to change runtime controls.';
    }
    if (/Only the owner/i.test(msg)) {
      return 'Only the owner may change the master kill switch.';
    }
    if (/reason is required/i.test(msg)) {
      return 'A reason is required for any control change.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the runtime controls service.';
    }
  }
  return 'Unable to change the runtime control.';
}

async function runQuery<T>(
  builder: Promise<{ data: T | null; error: unknown }>,
): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) return { data: null, error: sanitiseError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getAiRuntimeControls(): Promise<AiOpsResult<AiRuntimeControlRow[]>> {
  return runQuery<AiRuntimeControlRow[]>(
    supabase.from('ai_runtime_controls').select('*').order('control_type', { ascending: true }),
  );
}

export function getAiRuntimeControlHistory(
  limit = 100,
): Promise<AiOpsResult<AiRuntimeControlHistoryRow[]>> {
  return runQuery<AiRuntimeControlHistoryRow[]>(
    supabase
      .from('ai_runtime_control_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

// Server-side atomic control change. `enabled` + `execution_allowed` are the only
// mutable execution-affecting fields; a reason is mandatory. The RPC enforces
// owner-only for the master switch and appends history + audit transactionally.
export function applyRuntimeControlChange(
  controlKey: string,
  next: { enabled: boolean; execution_allowed: boolean },
  reason: string,
): Promise<AiOpsResult<{ ok: boolean; control_key: string; correlation_id: string }>> {
  return runQuery(
    supabase.rpc('apply_runtime_control_change', {
      p_control_key: controlKey,
      p_new_enabled: next.enabled,
      p_new_execution_allowed: next.execution_allowed,
      p_reason: reason,
    }) as Promise<{ data: { ok: boolean; control_key: string; correlation_id: string } | null; error: unknown }>,
  );
}

// --- Execution-gate evaluation -------------------------------------------------

export type GateState = 'pass' | 'block' | 'not_ready' | 'not_required';

export interface GateResult {
  key: string;
  label: string;
  state: GateState;
  note: string;
}

export type RuntimeExecutionState =
  | 'BLOCKED'
  | 'ARMED_BUT_DISABLED'
  | 'READY_FOR_PILOT'
  | 'EXECUTION_ENABLED';

export interface RuntimeExecutionDecision {
  allowed: boolean;
  blocked: boolean;
  reasons: string[];
  requiredGates: string[];
  gates: GateResult[];
  evaluatedAt: string;
  state: RuntimeExecutionState;
}

export interface RuntimeGateContext {
  /** Authoritative master kill switch row (or null if not yet provisioned). */
  masterKillSwitch: { enabled: boolean; execution_allowed: boolean } | null;
  environment: string | null;
  productionEnabled: boolean;
  /** Site gate row for the target site (null = default deny). */
  siteGate: { enabled: boolean; execution_allowed: boolean } | null;
  hasSite: boolean;
  /** Agent gate row for the target agent (null = default deny). */
  agentGate: { enabled: boolean; execution_allowed: boolean } | null;
  hasAgent: boolean;
  riskLevel: 'green' | 'amber' | 'red' | null;
  riskCeiling: 'green' | 'amber' | 'red' | null;
  /** Live approval status (pending/rejected/expired → block). */
  approvalState: 'approved' | 'pending' | 'rejected' | 'expired' | 'none' | null;
  /** Live security-policy effect for the requested action. */
  policyEffect: 'allow' | 'allow_with_conditions' | 'require_approval' | 'restrict' | 'deny' | 'audit_only' | null;
  /** True when every required runtime dependency is configured + reachable. */
  runtimeConfigured: boolean;
  /** True when every required runtime dependency is healthy. */
  runtimeHealthy: boolean;
  /** Required tool access present. */
  toolsReady: boolean;
  /** Required model assignment present. */
  modelReady: boolean;
  /** Required knowledge access present. */
  knowledgeReady: boolean;
  /** Scheduler handshake verified (blocks scheduled execution when false). */
  schedulerVerified: boolean;
  /** Execution runtime currently available. */
  runtimeAvailable: boolean;
}

/**
 * Deterministic, fail-closed runtime execution decision. Gate order is fixed:
 * Master Kill Switch → Environment → Production Enabled → Site → Agent →
 * Runtime Configuration → Runtime Health → Security Policy → Risk →
 * Human Approval → Tool Access → Model Assignment → Knowledge Access →
 * Execution Runtime.
 *
 * Any blocking gate (or unknown safety dependency) → execution denied.
 */
export function evaluateRuntimeExecution(ctx: RuntimeGateContext): RuntimeExecutionDecision {
  const gates: GateResult[] = [];
  const reasons: string[] = [];
  const requiredGates: string[] = [];
  const evaluatedAt = new Date().toISOString();

  const push = (key: string, label: string, state: GateState, note: string) => {
    gates.push({ key, label, state, note });
    if (state === 'block') {
      reasons.push(note);
      requiredGates.push(label);
    }
  };

  // 1. Master Kill Switch
  if (!ctx.masterKillSwitch) {
    push('master_kill_switch', 'Master Kill Switch', 'block', 'Master kill switch is not provisioned — execution is blocked by default.');
  } else if (ctx.masterKillSwitch.enabled && !ctx.masterKillSwitch.execution_allowed) {
    push('master_kill_switch', 'Master Kill Switch', 'block', 'Master kill switch is ON — all execution is blocked.');
  } else if (ctx.masterKillSwitch.execution_allowed) {
    push('master_kill_switch', 'Master Kill Switch', 'pass', 'Master kill switch allows execution.');
  } else {
    push('master_kill_switch', 'Master Kill Switch', 'block', 'Master kill switch does not allow execution.');
  }

  // 2. Environment
  if (!ctx.environment) {
    push('environment', 'Environment', 'block', 'No target environment specified.');
  } else {
    push('environment', 'Environment', 'pass', `Target environment is ${ctx.environment}.`);
  }

  // 3. Production Enabled
  if (ctx.productionEnabled) {
    push('production_enabled', 'Production Enabled', 'pass', 'Production execution is enabled.');
  } else {
    push('production_enabled', 'Production Enabled', 'block', 'Production execution is disabled (Production Enabled = 0).');
  }

  // 4. Site Gate
  if (!ctx.hasSite) {
    push('site_gate', 'Site Execution Gate', 'not_required', 'No site scope — site gate not required.');
  } else if (ctx.siteGate?.enabled && ctx.siteGate.execution_allowed) {
    push('site_gate', 'Site Execution Gate', 'pass', 'Site execution is explicitly allowed.');
  } else {
    push('site_gate', 'Site Execution Gate', 'block', 'Site execution is not allowed (default deny).');
  }

  // 5. Agent Gate
  if (!ctx.hasAgent) {
    push('agent_gate', 'Agent Execution Gate', 'not_required', 'No agent scope — agent gate not required.');
  } else if (ctx.agentGate?.enabled && ctx.agentGate.execution_allowed) {
    push('agent_gate', 'Agent Execution Gate', 'pass', 'Agent execution is explicitly allowed.');
  } else {
    push('agent_gate', 'Agent Execution Gate', 'block', 'Agent execution is not allowed (default deny).');
  }

  // 6. Runtime Configuration
  if (ctx.runtimeConfigured) {
    push('runtime_config', 'Runtime Configuration', 'pass', 'Required runtime dependencies are configured.');
  } else {
    push('runtime_config', 'Runtime Configuration', 'block', 'Required runtime dependencies are not configured.');
  }

  // 7. Runtime Health
  if (ctx.runtimeHealthy) {
    push('runtime_health', 'Runtime Health', 'pass', 'Required runtime dependencies are healthy.');
  } else {
    push('runtime_health', 'Runtime Health', 'block', 'Required runtime dependencies are not healthy / not verified.');
  }

  // 8. Security Policy
  switch (ctx.policyEffect) {
    case 'allow':
      push('policy', 'Security Policy', 'pass', 'Policy allows the requested action.');
      break;
    case 'audit_only':
      push('policy', 'Security Policy', 'pass', 'Policy is audit-only (non-blocking).');
      break;
    case 'allow_with_conditions':
      push('policy', 'Security Policy', 'not_ready', 'Policy allows with conditions — conditions must be evaluated.');
      break;
    case 'require_approval':
      push('policy', 'Security Policy', 'block', 'Policy requires approval before execution.');
      break;
    case 'restrict':
    case 'deny':
      push('policy', 'Security Policy', 'block', `Policy ${ctx.policyEffect}s the requested action.`);
      break;
    default:
      push('policy', 'Security Policy', 'block', 'No policy result available — execution blocked.');
  }

  // 9. Risk Gate
  if (ctx.riskLevel && ctx.riskCeiling) {
    const order = { green: 0, amber: 1, red: 2 } as const;
    if (order[ctx.riskLevel] > order[ctx.riskCeiling]) {
      push('risk_gate', 'Risk Gate', 'block', `Risk ${ctx.riskLevel.toUpperCase()} exceeds the ${ctx.riskCeiling.toUpperCase()} ceiling.`);
    } else {
      push('risk_gate', 'Risk Gate', 'pass', `Risk ${ctx.riskLevel.toUpperCase()} is within the ${ctx.riskCeiling.toUpperCase()} ceiling.`);
    }
  } else {
    push('risk_gate', 'Risk Gate', 'not_ready', 'Risk level or ceiling is not defined.');
  }

  // 10. Human Approval
  switch (ctx.approvalState) {
    case 'approved':
      push('approval', 'Human Approval', 'pass', 'Approval granted (does not independently enable execution).');
      break;
    case 'pending':
      push('approval', 'Human Approval', 'block', 'Approval is still pending.');
      break;
    case 'rejected':
      push('approval', 'Human Approval', 'block', 'Approval was rejected.');
      break;
    case 'expired':
      push('approval', 'Human Approval', 'block', 'Approval has expired.');
      break;
    default:
      push('approval', 'Human Approval', 'not_ready', 'No approval state — approval is required.');
  }

  // 11. Required Tool Access
  push('tools', 'Required Tool Access', ctx.toolsReady ? 'pass' : 'block', ctx.toolsReady ? 'Required tools are accessible.' : 'Required tool access is missing.');

  // 12. Required Model Assignment
  push('model', 'Required Model Assignment', ctx.modelReady ? 'pass' : 'block', ctx.modelReady ? 'A model is assigned.' : 'No model is assigned.');

  // 13. Required Knowledge Access
  push('knowledge', 'Required Knowledge Access', ctx.knowledgeReady ? 'pass' : 'block', ctx.knowledgeReady ? 'Required knowledge is accessible.' : 'Required knowledge access is missing.');

  // 14. Execution Runtime Available
  if (ctx.runtimeAvailable) {
    push('runtime', 'Execution Runtime Available', 'pass', 'Execution runtime is available.');
  } else {
    push('runtime', 'Execution Runtime Available', 'block', 'Execution runtime is not available.');
  }

  const blocked = gates.some((g) => g.state === 'block');
  const allowed = !blocked;

  const state: RuntimeExecutionState = allowed
    ? ctx.masterKillSwitch?.execution_allowed && ctx.productionEnabled
      ? 'EXECUTION_ENABLED'
      : ctx.masterKillSwitch?.execution_allowed
        ? 'ARMED_BUT_DISABLED'
        : 'READY_FOR_PILOT'
    : 'BLOCKED';

  return { allowed, blocked, reasons, requiredGates, gates, evaluatedAt, state };
}

/** The current, honest group-wide context — master switch ON, production 0,
 *  scheduler unverified, dependencies unconfigured. Used by surface-level
 *  summaries (Live Ops / Wallboard) that have no specific site/agent target. */
export function buildDefaultGateContext(
  masterKillSwitch: { enabled: boolean; execution_allowed: boolean } | null,
): RuntimeGateContext {
  return {
    masterKillSwitch,
    environment: 'production',
    productionEnabled: false,
    siteGate: null,
    hasSite: false,
    agentGate: null,
    hasAgent: false,
    riskLevel: 'green',
    riskCeiling: 'green',
    approvalState: null,
    policyEffect: null,
    runtimeConfigured: false,
    runtimeHealthy: false,
    toolsReady: false,
    modelReady: false,
    knowledgeReady: false,
    schedulerVerified: false,
    runtimeAvailable: false,
  };
}