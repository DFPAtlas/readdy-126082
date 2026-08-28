// ============================================================================
// AI Operations — Controlled multi-runtime chain probe (Phase 3 Prompt 13).
//
// UI access to the fixed n8n → Ollama diagnostic chain. The browser calls the
// authenticated `runtime-bridge-control` Edge Function, which queues ONE fixed,
// harmless diagnostic chain through the private runtime bridge. The local HAL
// runs the fixed n8n sandbox ping first, then (only if n8n succeeded) the fixed
// Ollama sandbox ping, then reports ONE signed combined result.
//
// The probe is STRICTLY constrained (fail-closed). The workflow, model, prompt
// and payload are FIXED server-side and can NEVER be supplied by the browser:
//   * probe_id    = dfp_runtime_chain_v1
//   * probe_mode  = sandbox_diagnostic
//   * n8n step    = DFP Runtime Sandbox Ping (dfp_n8n_ping_v1)
//   * Ollama step = dfp_ollama_ping_v1 / qwen2.5-coder:7b
//
// The only browser-supplied fields are `operation` and an optional `node_key`.
// This executes no arbitrary workflow, no arbitrary inference, no agent/tool/
// business action, and never enables execution. Verified success is only
// reported when the backend returns `verified === true` (n8n AND Ollama both
// verified).
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display + node_key only; never sent as
//     workflow/model/prompt overrides) ------------------------------------------

export const CHAIN_PROBE_NODE_KEY = 'atlas-hal-runtime-01';
export const CHAIN_PROBE_PROBE_ID = 'dfp_runtime_chain_v1';
export const CHAIN_PROBE_MODE = 'sandbox_diagnostic';
export const CHAIN_PROBE_TIMEOUT_SECONDS = 30;
export const CHAIN_PROBE_N8N_ALIAS = 'DFP Runtime Sandbox Ping';
export const CHAIN_PROBE_OLLAMA_MODEL = 'qwen2.5-coder:7b';
export const CHAIN_PROBE_N8N_EXPECTED = 'DFP_N8N_SANDBOX_OK';
export const CHAIN_PROBE_OLLAMA_EXPECTED = 'DFP_OLLAMA_SANDBOX_OK';

// --- Types ---------------------------------------------------------------------

export type RuntimeChainProbeStatus =
  | 'pending'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

/** Result of queueing the controlled runtime chain probe. */
export interface RuntimeChainProbeQueued {
  accepted: boolean;
  operation: string;
  probeKey: string;
  correlationId: string;
  nodeKey: string;
  nodeName: string | null;
  requestedAt: string;
  expiresAt: string;
  probeId: string;
  probeMode: string;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved runtime chain probe status entry. */
export interface RuntimeChainProbeStatusEntry {
  probeKey: string;
  messageKey: string;
  correlationId: string;
  nodeId: string | null;
  status: string;
  queuedAt: string;
  resultAt: string | null;
  expiresAt: string;
  expectedNodeKey: string;
  probeId: string;
  probeMode: string;
  hasResult: boolean;
  resultStatus: string | null;
  verified: boolean;
  n8nVerified: boolean;
  ollamaVerified: boolean;
  n8nLatencyMs: number | null;
  ollamaLatencyMs: number | null;
  totalLatencyMs: number | null;
  completedSteps: number;
  errorStep: string | null;
  errorCategory: string | null;
  roundTripMs: number | null;
}

/** Resolved runtime chain probe status payload. */
export interface RuntimeChainProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: RuntimeChainProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the runtime chain probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may queue a runtime chain probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage runtime chain probes.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the chain probe cannot be queued right now.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the runtime chain probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the runtime chain probe.';
}

// --- Data access ---------------------------------------------------------------

/** Queue the controlled runtime chain probe (owner/admin only, server-enforced).
 *  Only `operation` + `node_key` are sent — workflow/model/prompt are fixed server-side. */
export async function queueRuntimeChainProbe(
  nodeKey = CHAIN_PROBE_NODE_KEY,
): Promise<AiOpsResult<RuntimeChainProbeQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<RuntimeChainProbeQueued>('runtime-bridge-control', {
      body: { operation: 'queue_runtime_chain_probe', node_key: nodeKey },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The runtime chain probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest runtime chain probe status (any internal role). */
export async function getRuntimeChainProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<RuntimeChainProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_runtime_chain_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<RuntimeChainProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The runtime chain probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const CHAIN_PROBE_STATUS_META: Record<
  RuntimeChainProbeStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  pending: { label: 'Pending', tone: 'secondary' },
  delivered: { label: 'Delivered', tone: 'amber' },
  completed: { label: 'Completed', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'red' },
};

/** Derive a display status from a chain probe entry. `verified === true` is the
 *  only success signal (requires both n8n and Ollama verified). */
export function deriveChainProbeStatus(entry: RuntimeChainProbeStatusEntry): RuntimeChainProbeStatus {
  if (entry.verified === true) return 'completed';
  if (entry.status === 'expired') return 'expired';
  if (entry.status === 'rejected') return 'rejected';
  if (entry.hasResult) return 'failed';
  if (entry.status === 'delivered') return 'delivered';
  return 'pending';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isChainProbeTerminal(status: RuntimeChainProbeStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected' || status === 'expired';
}

/** Human-friendly latency label. */
export function formatChainMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}