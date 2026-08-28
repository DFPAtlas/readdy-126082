// ============================================================================
// AI Operations — Runtime gateway (Phase 3 Prompt 05).
//
// The trusted server-side runtime boundary (`ai-runtime-gateway` Edge Function)
// through which all future execution requests must pass. This is DENY-ONLY:
// the gateway evaluates a request against the authoritative 14-gate runtime
// controls and returns a safe decision, but never executes anything.
//
// The browser NEVER writes execution-request history directly — records are
// created only by the gateway using its service-role client (which bypasses
// RLS). The client can only SELECT service identities + execution requests
// (internal staff) and invoke the gateway in evaluation-only mode.
//
// No signing secret, credential, or provider response ever reaches the browser.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Row types -----------------------------------------------------------------

export type ServiceIdentityType = 'dfp_command' | 'scheduler' | 'n8n' | 'internal_runtime' | 'monitoring';

export interface AiRuntimeServiceIdentity {
  id: string;
  identity_key: string;
  name: string;
  identity_type: string;
  environment: string;
  allowed_request_types: string[];
  allowed_site_keys: string[];
  allowed_agent_keys: string[];
  risk_ceiling: string;
  status: string;
  credential_reference: string | null;
  last_authenticated_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiRuntimeExecutionRequest {
  id: string;
  request_key: string;
  idempotency_key: string;
  correlation_id: string | null;
  request_type: string;
  source_type: string;
  source_reference: string | null;
  service_identity_id: string | null;
  user_reference: string | null;
  site_id: string | null;
  agent_id: string | null;
  orchestration_id: string | null;
  run_id: string | null;
  approval_id: string | null;
  environment: string;
  risk_level: string | null;
  requested_action: string | null;
  requested_at: string;
  gate_result: string;
  execution_allowed: boolean;
  blocked_reasons: string[];
  required_gates: string[];
  request_hash: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

// --- Gateway request / response contracts -------------------------------------

export interface GatewayEvaluationPayload {
  idempotency_key: string;
  request_type: string;
  site_key?: string;
  agent_key?: string;
  orchestration_key?: string;
  approval_key?: string;
  requested_action?: string;
  risk_level?: 'green' | 'amber' | 'red';
  environment?: string;
}

export interface GatewayGateResult {
  key: string;
  label: string;
  state: 'pass' | 'block' | 'not_ready' | 'not_required';
  note: string;
}

export interface GatewayEvaluationResult {
  accepted: boolean;
  allowed: boolean;
  blocked: boolean;
  status: string;
  requestKey: string;
  idempotencyKey: string;
  requestHash: string | null;
  evaluatedAt: string;
  reasons: string[];
  requiredGates: string[];
  gates: GatewayGateResult[];
  duplicate: boolean;
  persistError: string | null;
  message: string;
}

// --- Data access --------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to read runtime gateway data.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the runtime gateway.';
    }
  }
  return 'Unable to load runtime gateway data.';
}

async function runQuery<T>(builder: Promise<{ data: T | null; error: unknown }>): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) return { data: null, error: sanitiseError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getAiRuntimeServiceIdentities(): Promise<AiOpsResult<AiRuntimeServiceIdentity[]>> {
  return runQuery<AiRuntimeServiceIdentity[]>(
    supabase.from('ai_runtime_service_identities').select('*').order('identity_key', { ascending: true }),
  );
}

export function getAiRuntimeExecutionRequests(limit = 100): Promise<AiOpsResult<AiRuntimeExecutionRequest[]>> {
  return runQuery<AiRuntimeExecutionRequest[]>(
    supabase.from('ai_runtime_execution_requests').select('*').order('requested_at', { ascending: false }).limit(limit),
  );
}

/**
 * Invoke the deny-only runtime gateway in evaluation mode. The gateway reloads
 * all authoritative state server-side and always returns `allowed = false`
 * while the master kill switch is ON and production is disabled. Never executes.
 */
export async function evaluateExecutionReadiness(
  payload: GatewayEvaluationPayload,
): Promise<AiOpsResult<GatewayEvaluationResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<GatewayEvaluationResult>('ai-runtime-gateway', {
      body: payload,
    });
    if (error) {
      // Surface a safe, renderable message from the function's own error body.
      const context = (error as { context?: { message?: string; error?: string } }).context;
      const msg = context?.error ?? context?.message ?? error.message;
      return { data: null, error: sanitiseError({ message: msg ?? '' }) };
    }
    if (!data) return { data: null, error: 'The runtime gateway returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export interface RuntimeGatewaySummary {
  /** Whether the gateway infrastructure is provisioned + readable. */
  ready: boolean;
  /** Always true — the gateway is deny-only in this phase. */
  denyOnly: boolean;
  requestsEvaluated: number;
  requestsBlocked: number;
  requestsRejected: number;
  lastRequest: AiRuntimeExecutionRequest | null;
}

export function deriveGatewaySummary(requests: AiRuntimeExecutionRequest[]): RuntimeGatewaySummary {
  const evaluated = requests.length;
  const blocked = requests.filter((r) => r.status === 'blocked' || r.execution_allowed === false).length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;
  return {
    ready: true,
    denyOnly: true,
    requestsEvaluated: evaluated,
    requestsBlocked: blocked,
    requestsRejected: rejected,
    lastRequest: evaluated > 0 ? requests[0] : null,
  };
}