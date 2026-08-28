// ============================================================================
// AI Operations — Runtime-backed diagnostic run (Phase 3 Prompt 18).
//
// UI access to the FIRST real AI Operations task/run lifecycle backed by the
// proven HAL read-only tool. The browser calls the authenticated
// `runtime-bridge-control` Edge Function, which creates a fixed diagnostic task
// + run + six deterministic steps, then queues ONE fixed HAL message that runs
// the Prompt 17 read-only tool. The local HAL reports a signed result; the cloud
// independently revalidates the agent/tool/isolated permission before marking
// the run verified and closing task + run + steps.
//
// The probe is STRICTLY constrained (fail-closed). Task, agent, tool, operation
// and payload are FIXED/resolved server-side and can NEVER be supplied by the
// browser. The only browser-supplied fields are `operation` and `node_key`.
// This performs no mutation, reads no business/customer data, makes no arbitrary
// HTTP, performs no model inference, and never enables normal execution.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side values (display + node_key only; never sent as
//     task/agent/tool/operation overrides) -----------------------------------------

export const DIAGNOSTIC_RUN_NODE_KEY = 'atlas-hal-runtime-01';
export const DIAGNOSTIC_RUN_PROBE_ID = 'dfp_diagnostic_run_v1';
export const DIAGNOSTIC_RUN_MODE = 'sandbox_diagnostic';
export const DIAGNOSTIC_RUN_TASK_KEY = 'dfp-runtime-health-diagnostic-task';
export const DIAGNOSTIC_RUN_TASK_NAME = 'DFP Runtime Health Diagnostic Task';
export const DIAGNOSTIC_RUN_TASK_TYPE = 'runtime_health_diagnostic';
export const DIAGNOSTIC_RUN_KEY_PREFIX = 'dfp-diagnostic-run-';
export const DIAGNOSTIC_RUN_AGENT_KEY = 'dfp-runtime-readonly-tool-agent';
export const DIAGNOSTIC_RUN_AGENT_NAME = 'DFP Runtime Read-Only Tool Agent';
export const DIAGNOSTIC_RUN_TOOL_KEY = 'dfp-runtime-health-read-tool';
export const DIAGNOSTIC_RUN_TOOL_NAME = 'DFP Runtime Health Read Tool';
export const DIAGNOSTIC_RUN_TOOL_OPERATION = 'read_runtime_health_snapshot';
export const DIAGNOSTIC_RUN_PERMISSION = 'execute';
export const DIAGNOSTIC_RUN_STEPS = [
  'validate_runtime_gates',
  'validate_agent',
  'validate_tool_permission',
  'dispatch_readonly_tool',
  'verify_signed_result',
  'close_diagnostic_run',
];

// --- Types ---------------------------------------------------------------------

export type DiagnosticRunStatus =
  | 'queued'
  | 'working'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

export interface DiagnosticRunStep {
  stepNumber: number;
  name: string;
  status: string;
  completedAt: string | null;
}

export interface DiagnosticRunSignedResult {
  verified: boolean;
  n8nStatus: string | null;
  ollamaStatus: string | null;
  ollamaModelCount: number | null;
  latencyMs: number | null;
  completedAt: string | null;
}

/** Result of queueing the controlled diagnostic run. */
export interface DiagnosticRunQueued {
  accepted: boolean;
  operation: string;
  taskKey: string;
  runKey: string;
  correlationId: string;
  nodeKey: string;
  nodeName: string | null;
  probeId: string;
  probeMode: string;
  agentKey: string;
  toolKey: string;
  toolOperation: string;
  permission: string;
  status: string;
  totalSteps: number;
  executionEnabled: boolean;
  message: string;
  error?: string;
  detail?: string;
}

/** Resolved diagnostic run status payload. */
export interface DiagnosticRunStatusResult {
  operation: string;
  found: boolean;
  task: {
    taskKey: string;
    name: string;
    taskType: string;
    status: string;
    environment: string;
    riskLevel: string | null;
  } | null;
  run: {
    runKey: string;
    status: string;
    currentStep: number;
    totalSteps: number;
    correlationId: string;
    startedAt: string | null;
    completedAt: string | null;
    errorSummary: string | null;
    resultSummary: string | null;
  } | null;
  steps: DiagnosticRunStep[];
  signedResult: DiagnosticRunSignedResult | null;
  agentKey: string;
  toolKey: string;
  toolOperation: string;
  permission: string;
  probeId: string;
  probeMode: string;
  executionEnabled: boolean;
  businessData: string;
  mutation: string;
  message: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to run the diagnostic task.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may queue a diagnostic run.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage diagnostic runs.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the diagnostic run cannot be queued right now.';
    if (/in_progress/i.test(detail)) return 'Another diagnostic run of this type is already in progress.';
    if (/agent_not_registered|autonomy|tool_missing|tool_not_safe|tool_access|kill_switch/i.test(detail)) return 'The dedicated agent, callable tool or isolated permission is not in the required safe state.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the diagnostic run control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to run the diagnostic task.';
}

// --- Data access ---------------------------------------------------------------

/** Queue the controlled diagnostic run (owner/admin only, server-enforced).
 *  Only `operation` + `node_key` are sent — task/agent/tool/operation are fixed
 *  server-side. */
export async function queueDiagnosticRun(
  nodeKey = DIAGNOSTIC_RUN_NODE_KEY,
): Promise<AiOpsResult<DiagnosticRunQueued>> {
  try {
    const { data, error } = await supabase.functions.invoke<DiagnosticRunQueued>('runtime-bridge-control', {
      body: { operation: 'queue_diagnostic_run', node_key: nodeKey },
    });
    if (error) {
      const detail = sanitiseError(error);
      return { data: null, error: detail };
    }
    if (!data) return { data: null, error: 'The diagnostic run control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest diagnostic run status (any internal role). */
export async function getDiagnosticRunStatus(): Promise<AiOpsResult<DiagnosticRunStatusResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<DiagnosticRunStatusResult>(
      'runtime-bridge-control',
      { body: { operation: 'get_diagnostic_run_status' } },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The diagnostic run status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const DIAGNOSTIC_RUN_STATUS_META: Record<
  DiagnosticRunStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  queued: { label: 'Queued', tone: 'secondary' },
  working: { label: 'Working', tone: 'amber' },
  completed: { label: 'Completed', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'red' },
};

/** Derive a display status from a diagnostic run payload. `signedResult.verified`
 *  is the only success signal; a signed result without verification is a failure;
 *  otherwise fall back to the stored run status. */
export function deriveDiagnosticRunStatus(result: DiagnosticRunStatusResult): DiagnosticRunStatus {
  const runStatus = result.run?.status;
  if (result.signedResult?.verified === true) return 'completed';
  if (runStatus === 'failed') return 'failed';
  if (runStatus === 'completed') return 'failed'; // completed without signed evidence
  if (result.signedResult && !result.signedResult.verified) return 'failed';
  if (runStatus === 'queued') return 'queued';
  if (runStatus === 'working') return 'working';
  return 'queued';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isDiagnosticRunTerminal(status: DiagnosticRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected' || status === 'expired';
}

/** Human-friendly latency label. */
export function formatDiagnosticRunMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}