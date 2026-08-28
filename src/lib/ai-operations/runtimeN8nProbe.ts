// ============================================================================
// AI Operations — Controlled n8n sandbox workflow probe (Phase 3 Prompt 12).
//
// UI access to the fixed n8n sandbox diagnostic workflow. The browser calls the
// authenticated `runtime-bridge-control` Edge Function, which queues ONE fixed,
// harmless n8n diagnostic workflow through the private runtime bridge.
//
// The probe is STRICTLY constrained (fail-closed). The workflow reference and
// payload are FIXED server-side and can NEVER be supplied by the browser:
//   * probe_id = dfp_n8n_ping_v1
//   * probe_mode = sandbox_diagnostic
//   * workflow = DFP Runtime Sandbox Ping (diagnostic alias only)
//
// The only browser-supplied fields are `operation` and an optional `node_key`.
// This executes no arbitrary workflow, no agent/tool/model/business action, and
// never enables execution. Verified success is only reported when the backend
// returns `verified === true`.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display + node_key only; never sent as
//     workflow/payload overrides) ------------------------------------------------

export const N8N_PROBE_NODE_KEY = 'atlas-hal-runtime-01';
export const N8N_PROBE_PROBE_ID = 'dfp_n8n_ping_v1';
export const N8N_PROBE_MODE = 'sandbox_diagnostic';
export const N8N_PROBE_WORKFLOW_ALIAS = 'DFP Runtime Sandbox Ping';
export const N8N_PROBE_TIMEOUT_SECONDS = 30;
export const N8N_PROBE_EXPECTED_STATUS = 'DFP_N8N_SANDBOX_OK';

// --- Types ---------------------------------------------------------------------

export type N8nProbeStatus =
  | 'pending'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

/** Result of queueing the controlled n8n sandbox probe. */
export interface N8nProbeQueued {
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
  workflowReference: string;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved n8n sandbox probe status entry. */
export interface N8nProbeStatusEntry {
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
  workflowReference: string;
  safeOutput: string | null;
  verified: boolean;
  errorCategory: string | null;
  latencyMs: number | null;
  roundTripMs: number | null;
}

/** Resolved n8n sandbox probe status payload. */
export interface N8nProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: N8nProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the n8n sandbox probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may queue an n8n sandbox probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage n8n probes.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the probe cannot be queued right now.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the n8n probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the n8n sandbox probe.';
}

// --- Data access ---------------------------------------------------------------

/** Queue the controlled n8n sandbox probe (owner/admin only, server-enforced).
 *  Only `operation` + `node_key` are sent — workflow/payload are fixed server-side. */
export async function queueN8nSandboxProbe(
  nodeKey = N8N_PROBE_NODE_KEY,
): Promise<AiOpsResult<N8nProbeQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<N8nProbeQueued>('runtime-bridge-control', {
      body: { operation: 'queue_n8n_sandbox_probe', node_key: nodeKey },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The n8n probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest n8n sandbox probe status (any internal role). */
export async function getN8nSandboxProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<N8nProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_n8n_sandbox_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<N8nProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The n8n probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const N8N_PROBE_STATUS_META: Record<
  N8nProbeStatus,
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
export function deriveN8nProbeStatus(entry: N8nProbeStatusEntry): N8nProbeStatus {
  if (entry.verified === true) return 'completed';
  if (entry.status === 'expired') return 'expired';
  if (entry.status === 'rejected') return 'rejected';
  if (entry.hasResult) return 'failed';
  if (entry.status === 'delivered') return 'delivered';
  return 'pending';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isN8nProbeTerminal(status: N8nProbeStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected' || status === 'expired';
}

/** Human-friendly latency label. */
export function formatN8nMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}