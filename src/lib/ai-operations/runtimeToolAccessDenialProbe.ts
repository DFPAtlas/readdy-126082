// ============================================================================
// AI Operations — Controlled tool access denial probe (Phase 3 Prompt 15).
//
// UI access to a CLOUD-SIDE authorization check. The browser calls the
// authenticated `runtime-bridge-control` Edge Function, which verifies (fail-
// closed) that the fixed diagnostic agent is DENIED access to the fixed
// registry-only diagnostic tool because no explicit tool permission exists.
//
// This probe NEVER contacts HAL/n8n/Ollama, never executes a tool, never makes
// external HTTP calls, and never creates an executable runtime request. It is a
// pure authorization lookup + audit evidence record.
//
// The probe is STRICTLY constrained (fail-closed). The agent, tool, probe ID
// and mode are FIXED server-side and can NEVER be supplied by the browser:
//   * probe_id          = dfp_tool_access_denial_v1
//   * probe_mode        = authorization_diagnostic
//   * agent             = dfp-runtime-diagnostic-agent
//   * tool              = dfp-runtime-diagnostic-tool
//   * expected decision = denied
//   * expected reason   = tool_permission_missing
//
// The only browser-supplied field is `operation`. Success is the DENIAL result
// (allowed=false, decision=denied); an unexpected active permission yields a
// BLOCKED result, never a pass.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display only; never sent as overrides) ---

export const TOOL_ACCESS_DENIAL_AGENT_KEY = 'dfp-runtime-diagnostic-agent';
export const TOOL_ACCESS_DENIAL_AGENT_NAME = 'DFP Runtime Diagnostic Agent';
export const TOOL_ACCESS_DENIAL_TOOL_KEY = 'dfp-runtime-diagnostic-tool';
export const TOOL_ACCESS_DENIAL_TOOL_NAME = 'DFP Runtime Diagnostic Tool';
export const TOOL_ACCESS_DENIAL_PROBE_ID = 'dfp_tool_access_denial_v1';
export const TOOL_ACCESS_DENIAL_MODE = 'authorization_diagnostic';
export const TOOL_ACCESS_DENIAL_EXPECTED_DECISION = 'denied';
export const TOOL_ACCESS_DENIAL_EXPECTED_REASON = 'tool_permission_missing';

// --- Types ---------------------------------------------------------------------

export type ToolAccessDenialProbeStatus = 'denied' | 'blocked' | 'failed' | 'not_run';

/** Result of running the controlled tool access denial probe. */
export interface ToolAccessDenialProbeRun {
  accepted: boolean;
  operation: string;
  probeKey: string;
  correlationId: string;
  probeId: string;
  probeMode: string;
  agentKey: string;
  toolKey: string;
  allowed: boolean;
  decision: string;
  reason: string;
  permissionState: string | null;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved denial-probe status entry (from audit evidence). */
export interface ToolAccessDenialProbeStatusEntry {
  probeKey: string;
  correlationId: string;
  probeId: string;
  agentKey: string;
  toolKey: string;
  decision: string;
  reason: string;
  allowed: boolean;
  permissionState: string | null;
  outcome: string;
  occurredAt: string;
  agentId: string | null;
}

/** Resolved denial-probe status payload. */
export interface ToolAccessDenialProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: ToolAccessDenialProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string; detail?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string; detail?: string } }).context;
    const detail = ctx?.error ?? ctx?.detail ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the tool access denial probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may run a tool access denial probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage tool access denial probes.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the tool access denial probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the tool access denial probe.';
}

// --- Data access ---------------------------------------------------------------

/** Run the controlled tool access denial probe (owner/admin only, server-
 *  enforced). Only `operation` is sent — agent/tool/probe are fixed server-side.
 *  This is cloud-side only: it never contacts HAL, n8n or Ollama. */
export async function runToolAccessDenialProbe(): Promise<AiOpsResult<ToolAccessDenialProbeRun>> {
  try {
    const { data, error } = await supabase.functions.invoke<ToolAccessDenialProbeRun>(
      'runtime-bridge-control',
      { body: { operation: 'run_tool_access_denial_probe' } },
    );
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The tool access denial probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest denial-probe status from audit evidence (any internal role). */
export async function getToolAccessDenialProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<ToolAccessDenialProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_tool_access_denial_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<ToolAccessDenialProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The tool access denial probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const TOOL_ACCESS_DENIAL_STATUS_META: Record<
  ToolAccessDenialProbeStatus,
  { label: string; tone: 'emerald' | 'red' | 'secondary' }
> = {
  denied: { label: 'Denied', tone: 'emerald' },
  blocked: { label: 'Blocked', tone: 'red' },
  failed: { label: 'Failed', tone: 'red' },
  not_run: { label: 'Not run', tone: 'secondary' },
};

/** Derive a display status from a probe entry. The PASS state is `denied`
 *  (outcome success + decision denied); `blocked` means an unexpected permission
 *  was present; `failed` means a precondition failed; otherwise not run. */
export function deriveToolAccessDenialProbeStatus(
  entry: ToolAccessDenialProbeStatusEntry,
): ToolAccessDenialProbeStatus {
  if (entry.outcome === 'success' && entry.decision === 'denied') return 'denied';
  if (entry.decision === 'blocked') return 'blocked';
  if (entry.decision === 'failed') return 'failed';
  return 'not_run';
}