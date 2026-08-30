// ============================================================================
// AI Operations — Runtime failure / timeout / recovery governance (Phase 3
// Prompt 23).
//
// UI access to the deterministic failure-governance operations for the
// Prompt 18–22 sandbox diagnostic runtime lifecycle. The browser calls the
// authenticated `runtime-failure-governance` Edge Function, which provides:
//
//   finalize_timed_out_diagnostic_run — owner/admin only. Reads persisted
//     run/task/message/approval state and deterministically closes a dispatched
//     diagnostic run that has no valid signed result after its fixed 2-minute
//     wait window. It NEVER dispatches anything and NEVER retries.
//
//   get_runtime_failure_status — any internal role (read-only). Returns safe
//     failure evidence for a run (or the latest diagnostic run).
//
// STRICTLY fail-closed: retry_count stays 0, max_attempts stays 1, there is
// never a second outbound HAL message, and normal execution stays BLOCKED.
// The browser supplies ONLY `operation` and `run_key` — the timeout window and
// all failure categorisation are fixed server-side.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// Fixed server-side runtime wait window (the browser can never choose this).
export const RUNTIME_WAIT_WINDOW_MS = 2 * 60_000;
export const RUNTIME_WAIT_WINDOW_LABEL = '2 minutes';

export const RUNTIME_FAILURE_CATEGORIES = [
  'runtime_result_timeout',
  'runtime_message_expired',
  'runtime_tool_timeout',
  'runtime_result_failed',
  'runtime_bridge_unreachable',
  'runtime_result_invalid',
  'runtime_duplicate_result',
  'runtime_terminal_state',
] as const;

export type RuntimeFailureCategory = (typeof RUNTIME_FAILURE_CATEGORIES)[number];

// --- Types -------------------------------------------------------------------

export interface RuntimeFailureStatusResult {
  operation: string;
  found: boolean;
  runKey: string | null;
  taskKey: string | null;
  correlationId: string | null;
  runStatus: string | null;
  taskStatus: string | null;
  failureCategory: string | null;
  failedStep: string | null;
  outboundMessageStatus: string | null;
  resultReceived: boolean;
  resultVerified: boolean;
  lateResultReceived: boolean;
  duplicateResultBlocked: boolean;
  bridgeReachable: boolean | null;
  timedOut: boolean;
  incidentKey: string | null;
  incidentStatus: string | null;
  retryCount: number;
  maxAttempts: number;
  executionEnabled: boolean;
}

export interface RuntimeFailureFinalizeResult {
  accepted: boolean;
  operation: string;
  runKey: string;
  taskKey: string;
  correlationId: string;
  failureCategory: string;
  failedStep: string | null;
  runStatus: string;
  taskStatus: string;
  outboundMessageStatus: string;
  retryCount: number;
  maxAttempts: number;
  incidentKey: string | null;
  halDispatch: string;
  executionEnabled: boolean;
  message: string;
  stillWaiting?: boolean;
  error?: string;
  detail?: string;
}

// --- Error sanitisation ------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to manage runtime failure governance.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may finalize a timed-out diagnostic run.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to view runtime failure governance.';
    if (/run_not_found/i.test(detail)) return 'That diagnostic run was not found.';
    if (/run_terminal/i.test(detail)) return 'That run is already in a terminal state — no further changes are possible.';
    if (/run_not_runtime_state/i.test(detail)) return 'That run is not in a dispatchable runtime state.';
    if (/correlation_missing/i.test(detail)) return 'That run has no correlation ID and cannot be finalized.';
    if (/no_outbound_message/i.test(detail)) return 'No outbound diagnostic HAL message exists for this run — nothing to finalize.';
    if (/multiple_outbound_messages/i.test(detail)) return 'More than one outbound HAL message exists for this run — refusing to finalize.';
    if (/result_already_received/i.test(detail)) return 'A valid signed result already exists for this run.';
    if (/runtime_still_within_wait_window/i.test(detail)) return 'The run is still within its fixed wait window — finalize is not permitted yet.';
    if (/run_key_missing/i.test(detail)) return 'A run key is required to finalize a timed-out run.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the runtime failure governance endpoint.';
    if (detail) return detail;
  }
  return 'Unable to manage runtime failure governance.';
}

// --- Data access -------------------------------------------------------------

/** Finalize a dispatched diagnostic run that has exceeded its fixed wait window
 *  with no valid signed result (owner/admin only, server-enforced). */
export async function finalizeTimedOutDiagnosticRun(
  runKey: string,
): Promise<AiOpsResult<RuntimeFailureFinalizeResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<RuntimeFailureFinalizeResult>(
      'runtime-failure-governance',
      { body: { operation: 'finalize_timed_out_diagnostic_run', run_key: runKey } },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The runtime failure governance endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read runtime failure evidence (any internal role, read-only). */
export async function getRuntimeFailureStatus(
  runKey?: string,
): Promise<AiOpsResult<RuntimeFailureStatusResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<RuntimeFailureStatusResult>(
      'runtime-failure-governance',
      { body: { operation: 'get_runtime_failure_status', run_key: runKey ?? '' } },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The runtime failure status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors ---------------------------------------------------------------

export const FAILURE_CATEGORY_META: Record<string, { label: string; tone: 'red' | 'amber' | 'secondary' }> = {
  runtime_result_timeout: { label: 'Result Timeout', tone: 'red' },
  runtime_message_expired: { label: 'Message Expired', tone: 'red' },
  runtime_tool_timeout: { label: 'Tool Timeout', tone: 'red' },
  runtime_result_failed: { label: 'Result Failed', tone: 'red' },
  runtime_bridge_unreachable: { label: 'Bridge Unreachable', tone: 'amber' },
  runtime_result_invalid: { label: 'Invalid Result', tone: 'red' },
  runtime_duplicate_result: { label: 'Duplicate Result', tone: 'amber' },
  runtime_terminal_state: { label: 'Terminal State', tone: 'secondary' },
};

/** A run is considered "failed" for governance purposes when it carries a
 *  failure category or has timed out. */
export function deriveFailureCategory(status: RuntimeFailureStatusResult | null): string | null {
  if (!status) return null;
  if (status.failureCategory) return status.failureCategory;
  if (status.timedOut) return 'runtime_result_timeout';
  return null;
}