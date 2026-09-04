// ============================================================================
// AI Operations — Operator test control for the private runtime bridge.
//
// Lets an owner/admin inject a synthetic bridge heartbeat for a runtime node so
// the wallboard can be exercised (e.g. flip TRON's Ollama status between
// healthy and degraded) without raw SQL. The browser calls the authenticated
// `simulate-runtime-heartbeat` Edge Function, which writes through the same
// service-role path the real bridge uses and marks the heartbeat as simulated.
//
// This performs no execution and never enables runtime authority — it is a
// test-only heartbeat injection, clearly labelled in the audit trail.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Types ---------------------------------------------------------------------

export type SimulatedOllamaStatus = 'healthy' | 'degraded';

export interface SimulateHeartbeatResult {
  accepted: boolean;
  operation: string;
  nodeKey: string;
  ollamaStatus: string;
  receivedAt: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to simulate a runtime heartbeat.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may simulate a runtime heartbeat.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to simulate a runtime heartbeat.';
    if (/Bridge node not found/i.test(detail)) return 'The runtime node could not be found.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the runtime heartbeat control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to simulate the runtime heartbeat.';
}

// --- Data access ---------------------------------------------------------------

/** Inject a synthetic heartbeat for a runtime node (owner/admin only, server-
 *  enforced). `ollamaStatus` must be `healthy` or `degraded` — it is validated
 *  server-side and never forwards an arbitrary value. */
export async function simulateRuntimeHeartbeat(
  nodeKey: string,
  ollamaStatus: SimulatedOllamaStatus,
): Promise<AiOpsResult<SimulateHeartbeatResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<SimulateHeartbeatResult>(
      'simulate-runtime-heartbeat',
      { body: { node_key: nodeKey, ollama_status: ollamaStatus } },
    );
    if (error) {
      return { data: null, error: sanitiseError(error) };
    }
    if (!data) return { data: null, error: 'The runtime heartbeat control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}