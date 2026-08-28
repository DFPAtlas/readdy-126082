// ============================================================================
// AI Operations — Controlled registered-agent dry-run probe (Phase 3 Prompt 14).
//
// UI access to the fixed registered-agent → model dry-run. The browser calls the
// authenticated `runtime-bridge-control` Edge Function, which queues ONE fixed,
// harmless diagnostic through the private runtime bridge. The local HAL resolves
// the fixed diagnostic agent binding and runs ONE fixed Ollama generation.
//
// The probe is STRICTLY constrained (fail-closed). The agent identity, model,
// prompt and payload are FIXED server-side and can NEVER be supplied by the
// browser:
//   * probe_id          = dfp_agent_dry_run_v1
//   * probe_mode        = sandbox_diagnostic
//   * agent             = dfp-runtime-diagnostic-agent
//   * model             = qwen2.5-coder:7b
//
// The only browser-supplied fields are `operation` and an optional `node_key`.
// This performs no arbitrary inference, no tool/workflow/business action, no
// agent/tool/model autonomous action, and never enables execution. Verified
// success is only reported when the backend returns `verified === true` (exact
// sentinel output AND cloud-side registry revalidation).
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display + node_key only; never sent as
//     agent/model/prompt overrides) ---------------------------------------------

export const AGENT_DRY_RUN_NODE_KEY = 'atlas-hal-runtime-01';
export const AGENT_DRY_RUN_PROBE_ID = 'dfp_agent_dry_run_v1';
export const AGENT_DRY_RUN_MODE = 'sandbox_diagnostic';
export const AGENT_DRY_RUN_AGENT_KEY = 'dfp-runtime-diagnostic-agent';
export const AGENT_DRY_RUN_AGENT_NAME = 'DFP Runtime Diagnostic Agent';
export const AGENT_DRY_RUN_MODEL = 'qwen2.5-coder:7b';
export const AGENT_DRY_RUN_EXPECTED_OUTPUT = 'DFP_AGENT_DRY_RUN_OK';
export const AGENT_DRY_RUN_TIMEOUT_SECONDS = 30;

// --- Types ---------------------------------------------------------------------

export type AgentDryRunProbeStatus =
  | 'pending'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

/** Result of queueing the controlled registered-agent dry-run probe. */
export interface AgentDryRunProbeQueued {
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
  diagnosticAgentKey: string;
  resolvedModelReference: string;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved agent dry-run probe status entry. */
export interface AgentDryRunProbeStatusEntry {
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
  diagnosticAgentKey: string;
  resolvedModelReference: string;
  hasResult: boolean;
  resultStatus: string | null;
  safeOutput: string | null;
  verified: boolean;
  errorCategory: string | null;
  latencyMs: number | null;
  roundTripMs: number | null;
}

/** Resolved agent dry-run probe status payload. */
export interface AgentDryRunProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: AgentDryRunProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the agent dry-run probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may queue an agent dry-run probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage agent dry-run probes.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the probe cannot be queued right now.';
    if (/agent_not_registered|model_assignment|model_inactive|model_reference|tool_access/i.test(detail)) return 'The diagnostic agent or its model assignment is not in the required registered state.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the agent dry-run probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the agent dry-run probe.';
}

// --- Data access ---------------------------------------------------------------

/** Queue the controlled registered-agent dry-run probe (owner/admin only, server-
 *  enforced). Only `operation` + `node_key` are sent — agent/model/prompt are
 *  fixed server-side. */
export async function queueAgentDryRunProbe(
  nodeKey = AGENT_DRY_RUN_NODE_KEY,
): Promise<AiOpsResult<AgentDryRunProbeQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<AgentDryRunProbeQueued>('runtime-bridge-control', {
      body: { operation: 'queue_agent_dry_run_probe', node_key: nodeKey },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The agent dry-run probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest agent dry-run probe status (any internal role). */
export async function getAgentDryRunProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<AgentDryRunProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_agent_dry_run_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<AgentDryRunProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The agent dry-run probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const AGENT_DRY_RUN_STATUS_META: Record<
  AgentDryRunProbeStatus,
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
export function deriveAgentDryRunProbeStatus(entry: AgentDryRunProbeStatusEntry): AgentDryRunProbeStatus {
  if (entry.verified === true) return 'completed';
  if (entry.status === 'expired') return 'expired';
  if (entry.status === 'rejected') return 'rejected';
  if (entry.hasResult) return 'failed';
  if (entry.status === 'delivered') return 'delivered';
  return 'pending';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isAgentDryRunProbeTerminal(status: AgentDryRunProbeStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected' || status === 'expired';
}

/** Human-friendly latency label. */
export function formatAgentDryRunMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}