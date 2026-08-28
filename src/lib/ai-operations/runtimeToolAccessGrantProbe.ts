// ============================================================================
// AI Operations — Controlled tool access grant probe (Phase 3 Prompt 16).
//
// UI access to a CLOUD-SIDE authorization check. The browser calls the
// authenticated `runtime-bridge-control` Edge Function, which verifies (fail-
// closed) that the fixed diagnostic agent has exactly ONE narrow read-only
// explicit permission for the fixed registry-only diagnostic tool, and that the
// grant is scope-isolated (no unrelated active tool grants). The diagnostic
// tool remains non-executable and NO tool is ever executed.
//
// This probe NEVER contacts HAL/n8n/Ollama, never executes a tool, never makes
// external HTTP calls, and never creates an executable runtime request. It is a
// pure authorization lookup + audit evidence record.
//
// The probe is STRICTLY constrained (fail-closed). The agent, tool, probe ID,
// mode and permission are FIXED/resolved server-side and can NEVER be supplied
// by the browser:
//   * probe_id          = dfp_tool_access_grant_v1
//   * probe_mode        = authorization_diagnostic
//   * agent             = dfp-runtime-diagnostic-agent
//   * tool              = dfp-runtime-diagnostic-tool
//   * permission        = read (narrowest valid non-executing level)
//   * expected decision = authorized
//   * expected reason   = explicit_tool_permission_present
//   * scope_isolated    = true
//   * tool_executed     = false
//
// The only browser-supplied field is `operation`. Success is the AUTHORIZED
// result (decision=authorized, scope_isolated=true, tool_executed=false); a
// broad/unrelated grant yields a BLOCKED result, never a pass.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side probe values (display only; never sent as overrides) ---

export const TOOL_ACCESS_GRANT_AGENT_KEY = 'dfp-runtime-diagnostic-agent';
export const TOOL_ACCESS_GRANT_AGENT_NAME = 'DFP Runtime Diagnostic Agent';
export const TOOL_ACCESS_GRANT_TOOL_KEY = 'dfp-runtime-diagnostic-tool';
export const TOOL_ACCESS_GRANT_TOOL_NAME = 'DFP Runtime Diagnostic Tool';
export const TOOL_ACCESS_GRANT_PROBE_ID = 'dfp_tool_access_grant_v1';
export const TOOL_ACCESS_GRANT_MODE = 'authorization_diagnostic';
export const TOOL_ACCESS_GRANT_PERMISSION = 'read';
export const TOOL_ACCESS_GRANT_EXPECTED_DECISION = 'authorized';
export const TOOL_ACCESS_GRANT_EXPECTED_REASON = 'explicit_tool_permission_present';

// --- Types ---------------------------------------------------------------------

export type ToolAccessGrantProbeStatus = 'authorized' | 'blocked' | 'failed' | 'not_run';

/** Result of running the controlled tool access grant probe. */
export interface ToolAccessGrantProbeRun {
  accepted: boolean;
  operation: string;
  probeKey: string;
  correlationId: string;
  probeId: string;
  probeMode: string;
  agentKey: string;
  toolKey: string;
  permissionType: string;
  permissionState: string;
  decision: string;
  reason: string;
  scopeIsolated: boolean;
  toolExecuted: boolean;
  status: string;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** A single resolved grant-probe status entry (from audit evidence). */
export interface ToolAccessGrantProbeStatusEntry {
  probeKey: string;
  correlationId: string;
  probeId: string;
  agentKey: string;
  toolKey: string;
  decision: string;
  reason: string;
  permissionState: string | null;
  permissionType: string | null;
  scopeIsolated: boolean;
  toolExecuted: boolean;
  outcome: string;
  occurredAt: string;
  agentId: string | null;
}

/** Resolved grant-probe status payload. */
export interface ToolAccessGrantProbeStatusResult {
  operation: string;
  found: boolean;
  verified: boolean;
  probes: ToolAccessGrantProbeStatusEntry[];
  executionEnabled: boolean;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string; detail?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string; detail?: string } }).context;
    const detail = ctx?.error ?? ctx?.detail ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the tool access grant probe.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may run a tool access grant probe.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage tool access grant probes.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the tool access grant probe control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the tool access grant probe.';
}

// --- Data access ---------------------------------------------------------------

/** Run the controlled tool access grant probe (owner/admin only, server-
 *  enforced). Only `operation` is sent — agent/tool/permission are fixed
 *  server-side. This is cloud-side only: it never contacts HAL, n8n or Ollama
 *  and never executes a tool. */
export async function runToolAccessGrantProbe(): Promise<AiOpsResult<ToolAccessGrantProbeRun>> {
  try {
    const { data, error } = await supabase.functions.invoke<ToolAccessGrantProbeRun>(
      'runtime-bridge-control',
      { body: { operation: 'run_tool_access_grant_probe' } },
    );
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The tool access grant probe control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest grant-probe status from audit evidence (any internal role). */
export async function getToolAccessGrantProbeStatus(
  correlationId?: string,
): Promise<AiOpsResult<ToolAccessGrantProbeStatusResult>> {
  try {
    const body: Record<string, string> = { operation: 'get_tool_access_grant_probe_status' };
    if (correlationId) body.correlation_id = correlationId;
    const { data, error } = await supabase.functions.invoke<ToolAccessGrantProbeStatusResult>(
      'runtime-bridge-control',
      { body },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The tool access grant probe status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const TOOL_ACCESS_GRANT_STATUS_META: Record<
  ToolAccessGrantProbeStatus,
  { label: string; tone: 'emerald' | 'red' | 'secondary' }
> = {
  authorized: { label: 'Authorized', tone: 'emerald' },
  blocked: { label: 'Blocked', tone: 'red' },
  failed: { label: 'Failed', tone: 'red' },
  not_run: { label: 'Not run', tone: 'secondary' },
};

/** Derive a display status from a probe entry. The PASS state is `authorized`
 *  (outcome success + decision authorized + scope_isolated true); `blocked` means
 *  a broad/unrelated grant was detected; `failed` means a precondition failed;
 *  otherwise not run. */
export function deriveToolAccessGrantProbeStatus(
  entry: ToolAccessGrantProbeStatusEntry,
): ToolAccessGrantProbeStatus {
  if (entry.outcome === 'success' && entry.decision === 'authorized' && entry.scopeIsolated === true) return 'authorized';
  if (entry.decision === 'blocked') return 'blocked';
  if (entry.decision === 'failed') return 'failed';
  return 'not_run';
}