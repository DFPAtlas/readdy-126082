// ============================================================================
// AI Operations — Runtime callback boundary (Phase 3 Prompt 07).
//
// The secure inbound machine-message boundary that future n8n runtime
// workflows use to communicate back to DFP Command. The `ai-runtime-callback`
// Edge Function verifies signed machine callbacks (HMAC-SHA256, nonce replay
// protection, timestamp window, service-identity validation) and records
// sanitised metadata to the append-only `ai_runtime_callbacks` ledger.
//
// This phase is CALLBACK VERIFICATION + GOVERNANCE RECORDING ONLY. Callbacks
// never execute an agent, trigger a workflow, create/update a Run, complete an
// orchestration step, or mutate business/site data. The browser can only
// SELECT the ledger (internal staff) — callback rows are inserted server-side
// by the callback function using its service-role client (bypasses RLS).
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Row types -----------------------------------------------------------------

export type CallbackVerificationState = 'verified' | 'rejected' | 'pending';
export type CallbackProcessingState = 'recorded' | 'blocked' | 'ignored';

export interface AiRuntimeCallback {
  id: string;
  callback_key: string;
  message_id: string;
  idempotency_key: string | null;
  correlation_id: string | null;
  callback_type: string;
  source_system: string;
  service_identity_id: string | null;
  execution_request_id: string | null;
  workflow_key: string | null;
  site_id: string | null;
  agent_id: string | null;
  orchestration_id: string | null;
  run_id: string | null;
  environment: string;
  signature_version: string | null;
  nonce_hash: string | null;
  payload_hash: string | null;
  verification_state: string;
  processing_state: string;
  outcome: string | null;
  safe_summary: string | null;
  received_at: string;
  occurred_at: string | null;
  expires_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

// --- Data access --------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to read the runtime callback ledger.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the runtime callback ledger.';
    }
  }
  return 'Unable to load runtime callback data.';
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

export function getAiRuntimeCallbacks(limit = 100): Promise<AiOpsResult<AiRuntimeCallback[]>> {
  return runQuery<AiRuntimeCallback[]>(
    supabase.from('ai_runtime_callbacks').select('*').order('received_at', { ascending: false }).limit(limit),
  );
}

// --- Selectors -----------------------------------------------------------------

export interface CallbackBoundarySummary {
  /** Whether the callback boundary infrastructure + ledger are provisioned/readable. */
  ready: boolean;
  total: number;
  verified: number;
  rejected: number;
  blocked: number;
  handshakes: number;
  lastHandshake: AiRuntimeCallback | null;
  lastCallback: AiRuntimeCallback | null;
}

export function deriveCallbackSummary(callbacks: AiRuntimeCallback[]): CallbackBoundarySummary {
  const handshakes = callbacks.filter((c) => c.callback_type === 'connector_handshake');
  const lastHandshake = handshakes.length > 0 ? handshakes[0] : null;
  return {
    ready: true,
    total: callbacks.length,
    verified: callbacks.filter((c) => c.verification_state === 'verified').length,
    rejected: callbacks.filter((c) => c.verification_state === 'rejected' || c.rejected_reason).length,
    blocked: callbacks.filter((c) => c.processing_state === 'blocked').length,
    handshakes: handshakes.length,
    lastHandshake,
    lastCallback: callbacks.length > 0 ? callbacks[0] : null,
  };
}