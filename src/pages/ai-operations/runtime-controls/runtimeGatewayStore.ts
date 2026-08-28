// ============================================================================
// AI Operations — Runtime gateway store (Phase 3 Prompt 05).
//
// Session state for the trusted, deny-only runtime boundary. Loads the
// allowlisted service identities + the append-only execution-request ledger
// (both read-only for internal staff) and exposes an evaluation-only action
// that invokes the `ai-runtime-gateway` Edge Function.
//
// Evaluation is DENY-ONLY: the gateway returns `allowed = false` and never
// executes an agent, n8n workflow, model, tool, or any business action.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getAiRuntimeServiceIdentities,
  getAiRuntimeExecutionRequests,
  evaluateExecutionReadiness,
  deriveGatewaySummary,
  type AiRuntimeServiceIdentity,
  type AiRuntimeExecutionRequest,
  type GatewayEvaluationResult,
  type GatewayEvaluationPayload,
  type RuntimeGatewaySummary,
} from '@/lib/ai-operations/runtimeGateway';

export interface GatewayEvaluationState {
  status: 'idle' | 'evaluating' | 'done';
  result: GatewayEvaluationResult | null;
  error: string | null;
}

interface RuntimeGatewayState {
  serviceIdentities: AiRuntimeServiceIdentity[];
  requests: AiRuntimeExecutionRequest[];
  summary: RuntimeGatewaySummary | null;
  loading: boolean;
  error: string | null;
  evaluation: GatewayEvaluationState;
}

const EMPTY: RuntimeGatewayState = {
  serviceIdentities: [],
  requests: [],
  summary: null,
  loading: false,
  error: null,
  evaluation: { status: 'idle', result: null, error: null },
};

let snapshot: RuntimeGatewayState = { ...EMPTY };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): RuntimeGatewayState {
  return snapshot;
}

function setSnapshot(next: RuntimeGatewayState) {
  snapshot = next;
  emit();
}

export function useRuntimeGateway(): RuntimeGatewayState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRuntimeGatewayState(): RuntimeGatewayState {
  return snapshot;
}

// --- Loader -------------------------------------------------------------------

export async function refreshGateway(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true, error: null });

  const [identitiesRes, requestsRes] = await Promise.all([
    getAiRuntimeServiceIdentities(),
    getAiRuntimeExecutionRequests(200),
  ]);

  const state = getSnapshot();
  if (identitiesRes.error) {
    setSnapshot({ ...state, loading: false, error: identitiesRes.error });
    return;
  }

  const requests = requestsRes.data ?? [];
  setSnapshot({
    ...state,
    serviceIdentities: identitiesRes.data ?? [],
    requests,
    summary: deriveGatewaySummary(requests),
    loading: false,
    error: null,
  });
}

// --- Action (evaluation only — deny-only) -------------------------------------

export async function runReadinessEvaluation(
  payload: GatewayEvaluationPayload,
): Promise<void> {
  setSnapshot({
    ...getSnapshot(),
    evaluation: { status: 'evaluating', result: null, error: null },
  });

  const { data, error } = await evaluateExecutionReadiness(payload);

  const state = getSnapshot();
  if (data) {
    setSnapshot({ ...state, evaluation: { status: 'done', result: data, error: null } });
  } else {
    setSnapshot({ ...state, evaluation: { status: 'done', result: null, error: error ?? 'Unable to evaluate execution readiness.' } });
  }

  // Refresh the ledger so the new (blocked) request is reflected.
  await refreshGateway();
}

export function resetEvaluation(): void {
  setSnapshot({ ...getSnapshot(), evaluation: { status: 'idle', result: null, error: null } });
}