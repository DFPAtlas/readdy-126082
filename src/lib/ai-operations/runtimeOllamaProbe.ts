// ============================================================================
// AI Operations — Controlled Ollama sandbox inference probe (Phase 3 Prompt 11B).
//
// UI access to the existing Prompt 11A controlled diagnostic probe. The browser
// calls the authenticated `runtime-bridge-control` Edge Function, which queues
// ONE fixed, harmless Ollama generation through the private runtime bridge.
//
// The probe is STRICTLY constrained (fail-closed). Prompt text and model name
// are FIXED server-side and can NEVER be supplied by the browser:
//   * prompt_id  = dfp_ollama_ping_v1
//   * model      = qwen2.5-coder:7b
//   * probe_mode = sandbox_diagnostic
//
// The only browser-supplied fields are `operation` and an optional `node_key`.
// This performs no arbitrary inference, no agent/workflow/tool/business action,
// and never enables execution. Verified success is only reported when the
// backend returns `verified === true`.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display + node_key only; never sent as
//     prompt/model overrides) --------------------------------------------------

export const OLLAMA_PROBE_NODE_KEY = 'atlas-hal-runtime-01';
export const OLLAMA_PROBE_MODEL = 'qwen2.5-coder:7b';
export const OLLAMA_PROBE_PROMPT_ID = 'dfp_ollama_ping_v1';
export const OLLAMA_PROBE_MODE = 'sandbox_diagnostic';
export const OLLAMA_PROBE_MAX_TOKENS = 16;
export const OLLAMA_PROBE_TIMEOUT_SECONDS = 30;
export const OLLAMA_PROBE_EXPECTED_OUTPUT = 'DFP_OLLAMA_SANDBOX_OK';

// --- Types ---------------------------------------------------------------------

export type OllamaProbeStatus =
  | 'pending'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

/** Result of queueing the controlled Ollama sandbox probe. */
export interface OllamaProbeQueued {
  accepted: boolean;
  operation: string;
  probeKey: string;
  correlationId: string;
  nodeKey: string;
  nodeName: string | null;
  requestedAt: string;
  expiresAt: string;
  promptId: string;
  model: string;
  probeMode: string;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved Ollama probe status entry. */
export interface OllamaProbeStatusEntry {
  probeKey: string;
  messageKey: string;
  correlationId: string;
  nodeId: string | null;
  status: string;
  queuedAt: string;
  resultAt: string | null;
  expiresAt: string;
  expectedNodeKey: string;
  promptId: string;
  model: string;
  probeMode: string;
  hasResult: boolean;
  resultStatus: string | null;
  output: string | null;
  verified: boolean;
  latencyMs: number | null;
  roundTripMs: number | null;
}

/** Resolved Ollama probe status payload. */
export interface OllamaProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: OllamaProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the Ollama sandbox probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may queue an Ollama sandbox probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage Ollama probes.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the probe cannot be queued right now.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the Ollama probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the Ollama sandbox probe.';
}

// --- Data access ---------------------------------------------------------------

/** Queue the controlled Ollama sandbox probe (owner/admin only, server-enforced).
 *  Only `operation` + `node_key` are sent — prompt/model/mode are fixed server-side. */
export async function queueOllamaInferenceProbe(
  nodeKey = OLLAMA_PROBE_NODE_KEY,
): Promise<AiOpsResult<OllamaProbeQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<OllamaProbeQueued>('runtime-bridge-control', {
      body: { operation: 'queue_ollama_inference_probe', node_key: nodeKey },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The Ollama probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest Ollama probe status (any internal role). */
export async function getOllamaInferenceProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<OllamaProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_ollama_inference_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<OllamaProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The Ollama probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const OLLAMA_PROBE_STATUS_META: Record<
  OllamaProbeStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  pending: { label: 'Pending', tone: 'secondary' },
  delivered: { label: 'Delivered', tone: 'amber' },
  completed: { label: 'Completed', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'red' },
};

/** Derive a display status from a probe entry. `verified === true` is the only
 *  success signal; a result without verification is a failure; otherwise fall
 *  back to the stored outbound status. */
export function deriveOllamaProbeStatus(entry: OllamaProbeStatusEntry): OllamaProbeStatus {
  if (entry.verified === true) return 'completed';
  if (entry.status === 'expired') return 'expired';
  if (entry.status === 'rejected') return 'rejected';
  if (entry.hasResult) return 'failed';
  if (entry.status === 'delivered') return 'delivered';
  return 'pending';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isOllamaProbeTerminal(status: OllamaProbeStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected' || status === 'expired';
}

/** Human-friendly latency label. */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}