// ============================================================================
// AI Operations — Controlled read-only tool probe (Phase 3 Prompt 17).
//
// UI access to the FIRST callable read-only diagnostic tool. The browser calls
// the authenticated `runtime-bridge-control` Edge Function, which queues ONE
// fixed read-only tool invocation through the private runtime bridge. The local
// HAL runs the fixed built-in read_runtime_health_snapshot tool (n8n /healthz +
// Ollama /api/tags, GET only) and returns a signed, sanitised result.
//
// The probe is STRICTLY constrained (fail-closed). The agent, tool, permission,
// operation and payload are FIXED/resolved server-side and can NEVER be supplied
// by the browser:
//   * probe_id          = dfp_readonly_tool_v1
//   * probe_mode        = sandbox_diagnostic
//   * agent             = dfp-runtime-readonly-tool-agent
//   * tool              = dfp-runtime-health-read-tool
//   * tool_operation    = read_runtime_health_snapshot
//   * permission        = execute (exact isolated grant)
//
// The only browser-supplied fields are `operation` and `node_key`. This performs
// no mutation, reads no business/customer data, makes no arbitrary HTTP, and
// never enables execution. Verified success is only reported when the backend
// returns `verified === true` (valid sanitised result AND independent cloud-side
// permission revalidation).
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display + node_key only; never sent as
//     agent/tool/operation overrides) ---------------------------------------------

export const READONLY_TOOL_NODE_KEY = 'atlas-hal-runtime-01';
export const READONLY_TOOL_PROBE_ID = 'dfp_readonly_tool_v1';
export const READONLY_TOOL_MODE = 'sandbox_diagnostic';
export const READONLY_TOOL_AGENT_KEY = 'dfp-runtime-readonly-tool-agent';
export const READONLY_TOOL_AGENT_NAME = 'DFP Runtime Read-Only Tool Agent';
export const READONLY_TOOL_TOOL_KEY = 'dfp-runtime-health-read-tool';
export const READONLY_TOOL_TOOL_NAME = 'DFP Runtime Health Read Tool';
export const READONLY_TOOL_TOOL_OPERATION = 'read_runtime_health_snapshot';
export const READONLY_TOOL_PERMISSION = 'execute';
export const READONLY_TOOL_TIMEOUT_SECONDS = 20;

// --- Types ---------------------------------------------------------------------

export type ReadonlyToolProbeStatus =
  | 'pending'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

/** Result of queueing the controlled read-only tool probe. */
export interface ReadonlyToolProbeQueued {
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
  agentKey: string;
  toolKey: string;
  toolOperation: string;
  permission: string;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved read-only tool probe status entry. */
export interface ReadonlyToolProbeStatusEntry {
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
  agentKey: string;
  toolKey: string;
  toolOperation: string;
  hasResult: boolean;
  resultStatus: string | null;
  verified: boolean;
  n8nStatus: string | null;
  ollamaStatus: string | null;
  ollamaModelCount: number | null;
  latencyMs: number | null;
  errorCategory: string | null;
  signedResult: boolean;
  toolMutation: string;
  businessData: string;
}

/** Resolved read-only tool probe status payload. */
export interface ReadonlyToolProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: ReadonlyToolProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the read-only tool probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may queue a read-only tool probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage read-only tool probes.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the probe cannot be queued right now.';
    if (/agent_not_registered|autonomy|tool_missing|tool_not_safe|tool_access|kill_switch/i.test(detail)) return 'The dedicated agent, callable tool or isolated permission is not in the required safe state.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the read-only tool probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the read-only tool probe.';
}

// --- Data access ---------------------------------------------------------------

/** Queue the controlled read-only tool probe (owner/admin only, server-enforced).
 *  Only `operation` + `node_key` are sent — agent/tool/operation are fixed
 *  server-side. */
export async function queueReadonlyToolProbe(
  nodeKey = READONLY_TOOL_NODE_KEY,
): Promise<AiOpsResult<ReadonlyToolProbeQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<ReadonlyToolProbeQueued>('runtime-bridge-control', {
      body: { operation: 'queue_readonly_tool_probe', node_key: nodeKey },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The read-only tool probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest read-only tool probe status (any internal role). */
export async function getReadonlyToolProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<ReadonlyToolProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_readonly_tool_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<ReadonlyToolProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The read-only tool probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const READONLY_TOOL_STATUS_META: Record<
  ReadonlyToolProbeStatus,
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
export function deriveReadonlyToolProbeStatus(entry: ReadonlyToolProbeStatusEntry): ReadonlyToolProbeStatus {
  if (entry.verified === true) return 'completed';
  if (entry.status === 'expired') return 'expired';
  if (entry.status === 'rejected') return 'rejected';
  if (entry.hasResult) return 'failed';
  if (entry.status === 'delivered') return 'delivered';
  return 'pending';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isReadonlyToolProbeTerminal(status: ReadonlyToolProbeStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected' || status === 'expired';
}

/** Human-friendly latency label. */
export function formatReadonlyToolMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}