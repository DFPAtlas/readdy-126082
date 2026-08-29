// ============================================================================
// AI Operations — Human approval-gated diagnostic run (Phase 3 Prompt 19).
//
// UI access to the FIRST human-approval-gated runtime-backed diagnostic
// lifecycle. The browser calls the authenticated `runtime-bridge-control` Edge
// Function, which creates a fixed diagnostic task + run + six deterministic
// steps + ONE approval — but queues NO HAL message. HAL dispatch is blocked
// until an explicit human approval exists AND a separate manual dispatch is
// issued. After dispatch, the local HAL runs the Prompt 17 read-only tool
// exactly once; the cloud independently revalidates the approval + agent/tool/
// isolated permission before marking the run verified and consuming the
// approval. This proves approval is a REAL execution gate.
//
// STRICTLY constrained (fail-closed). Task, agent, tool, operation, approval
// policy and payload are FIXED/resolved server-side and can NEVER be supplied
// by the browser. The only browser-supplied fields are `operation`, `node_key`
// (create/dispatch) and `approval_key` (approve/reject/dispatch). This performs
// no mutation, reads no business/customer data, makes no arbitrary HTTP,
// performs no model inference, and never enables normal execution.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Fixed server-side values (display + node_key/approval_key only; never sent
//     as task/agent/tool/operation overrides) -----------------------------------

export const APPROVAL_GATED_NODE_KEY = 'atlas-hal-runtime-01';
export const APPROVAL_GATED_PROBE_ID = 'dfp_approval_run_v1';
export const APPROVAL_GATED_MODE = 'sandbox_diagnostic';
export const APPROVAL_GATED_TASK_KEY_PREFIX = 'dfp-runtime-health-approval-task';
export const APPROVAL_GATED_TASK_NAME = 'DFP Runtime Health Approval-Gated Task';
export const APPROVAL_GATED_TASK_TYPE = 'runtime_health_approval_diagnostic';
export const APPROVAL_GATED_RUN_KEY_PREFIX = 'dfp-approval-run-';
export const APPROVAL_GATED_APPROVAL_KEY_PREFIX = 'dfp-approval-';
export const APPROVAL_GATED_APPROVAL_TYPE = 'runtime_diagnostic_execution';
export const APPROVAL_GATED_AGENT_KEY = 'dfp-runtime-readonly-tool-agent';
export const APPROVAL_GATED_AGENT_NAME = 'DFP Runtime Read-Only Tool Agent';
export const APPROVAL_GATED_TOOL_KEY = 'dfp-runtime-health-read-tool';
export const APPROVAL_GATED_TOOL_NAME = 'DFP Runtime Health Read Tool';
export const APPROVAL_GATED_TOOL_OPERATION = 'read_runtime_health_snapshot';
export const APPROVAL_GATED_PERMISSION = 'execute';
export const APPROVAL_GATED_STEPS = [
  'validate_runtime_gates',
  'validate_agent',
  'validate_tool_permission',
  'require_human_approval',
  'dispatch_readonly_tool',
  'verify_and_close',
];

// --- Types ---------------------------------------------------------------------

export type ApprovalGatedState =
  | 'not_started'
  | 'awaiting_approval'
  | 'approved'
  | 'dispatched'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'expired';

export interface ApprovalGatedStep {
  stepNumber: number;
  name: string;
  status: string;
  completedAt: string | null;
}

export interface ApprovalGatedSignedResult {
  verified: boolean;
  n8nStatus: string | null;
  ollamaStatus: string | null;
  ollamaModelCount: number | null;
  latencyMs: number | null;
  completedAt: string | null;
}

/** Resolved approval-gated run status payload. */
export interface ApprovalGatedRunStatusResult {
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
  approval: {
    approvalKey: string;
    status: string;
    decision: string | null;
    decisionActor: string | null;
    decisionAt: string | null;
    approvalCount: number;
    expiresAt: string | null;
    isExpired: boolean;
    approvalContextBound: boolean;
    approvalContextMatched: boolean;
    contextFingerprint: string | null;
  } | null;
  steps: ApprovalGatedStep[];
  signedResult: ApprovalGatedSignedResult | null;
  halDispatch: string;
  agentKey: string;
  toolKey: string;
  toolOperation: string;
  permission: string;
  probeId: string;
  probeMode: string;
  executionEnabled: boolean;
  message: string;
}

/** Result of a create/approve/reject/dispatch action. */
export interface ApprovalGatedActionResult {
  accepted: boolean;
  operation: string;
  taskKey?: string;
  runKey?: string;
  approvalKey?: string;
  correlationId?: string;
  nodeKey?: string;
  nodeName?: string | null;
  probeId?: string;
  probeMode?: string;
  agentKey?: string;
  toolKey?: string;
  toolOperation?: string;
  permission?: string;
  status?: string;
  halDispatch?: string;
  totalSteps?: number;
  executionEnabled?: boolean;
  message?: string;
  error?: string;
  detail?: string;
}

// --- Error sanitisation --------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string; context?: { error?: string; message?: string } }).message ?? '';
    const ctx = (err as { context?: { error?: string; message?: string } }).context;
    const detail = ctx?.error ?? ctx?.message ?? msg;
    if (/Unauthorized/i.test(detail)) return 'You must be signed in to manage the approval-gated run.';
    if (/Owner or admin role required/i.test(detail)) return 'Only an owner or admin may create, approve, reject or dispatch this run.';
    if (/Internal staff access required/i.test(detail)) return 'Internal staff access is required to manage approval-gated runs.';
    if (/reachable|heartbeat|stale/i.test(detail)) return 'No reachable bridge node is available — the run cannot proceed right now.';
    if (/already_dispatched/i.test(detail)) return 'This approval has already been dispatched — an approved approval never authorizes a second dispatch.';
    if (/approval_not_approved/i.test(detail)) return 'Dispatch requires an explicit human approval first.';
    if (/approval_not_pending/i.test(detail)) return 'This approval is no longer pending a decision.';
    if (/approval_expired/i.test(detail)) return 'This approval has expired and can no longer be approved or dispatched. A fresh approval is required.';
    if (/approval_context_changed/i.test(detail)) return 'The approved authorization context changed after approval. A fresh human approval is required.';
    if (/approval_expired_at_dispatch|approval_not_before_dispatch|approval_decision_missing/i.test(detail)) return 'The approval was not valid at dispatch time — signed evidence was rejected.';
    if (/agent_not_registered|autonomy|tool_missing|tool_not_safe|tool_access|kill_switch/i.test(detail)) return 'The dedicated agent, callable tool or isolated permission is not in the required safe state.';
    if (/network|fetch|failed to fetch/i.test(detail)) return 'Unable to reach the approval-gated run control endpoint.';
    if (detail) return detail;
  }
  return 'Unable to manage the approval-gated run.';
}

// --- Data access ---------------------------------------------------------------

/** Create the approval-gated run (owner/admin only). Creates task + run + six
 *  steps + one approval, but queues NO HAL message. */
export async function createApprovalGatedRun(
  nodeKey = APPROVAL_GATED_NODE_KEY,
): Promise<AiOpsResult<ApprovalGatedActionResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<ApprovalGatedActionResult>('runtime-bridge-control', {
      body: { operation: 'create_approval_gated_run', node_key: nodeKey },
    });
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The approval-gated run control endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Approve the pending approval (owner/admin only). Does NOT dispatch HAL. */
export async function approveApprovalGatedRun(
  approvalKey: string,
): Promise<AiOpsResult<ApprovalGatedActionResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<ApprovalGatedActionResult>('runtime-bridge-control', {
      body: { operation: 'approve_approval_gated_run', approval_key: approvalKey },
    });
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The approval-gated approve endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Reject the pending approval (owner/admin only). No HAL dispatch, no retry. */
export async function rejectApprovalGatedRun(
  approvalKey: string,
): Promise<AiOpsResult<ApprovalGatedActionResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<ApprovalGatedActionResult>('runtime-bridge-control', {
      body: { operation: 'reject_approval_gated_run', approval_key: approvalKey },
    });
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The approval-gated reject endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Dispatch the approved run exactly once (owner/admin only). */
export async function dispatchApprovedDiagnosticRun(
  approvalKey: string,
  nodeKey = APPROVAL_GATED_NODE_KEY,
): Promise<AiOpsResult<ApprovalGatedActionResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<ApprovalGatedActionResult>('runtime-bridge-control', {
      body: { operation: 'dispatch_approved_diagnostic_run', approval_key: approvalKey, node_key: nodeKey },
    });
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The approval-gated dispatch endpoint returned no result.' };
    if (data.error) return { data, error: data.error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

/** Read the latest approval-gated run status (any internal role). */
export async function getApprovalGatedRunStatus(): Promise<AiOpsResult<ApprovalGatedRunStatusResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<ApprovalGatedRunStatusResult>(
      'runtime-bridge-control',
      { body: { operation: 'get_approval_gated_run_status' } },
    );
    if (error) return { data: null, error: sanitiseError(error) };
    if (!data) return { data: null, error: 'The approval-gated run status endpoint returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Selectors -----------------------------------------------------------------

export const APPROVAL_GATED_STATE_META: Record<
  ApprovalGatedState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  not_started: { label: 'Not started', tone: 'secondary' },
  awaiting_approval: { label: 'Awaiting Approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'emerald' },
  dispatched: { label: 'Dispatched', tone: 'amber' },
  completed: { label: 'Completed', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'red' },
};

/** Derive the lifecycle state from an approval-gated status payload. */
export function deriveApprovalGatedState(result: ApprovalGatedRunStatusResult): ApprovalGatedState {
  if (!result.run) return 'not_started';
  if (result.signedResult?.verified === true) return 'completed';
  if (result.approval?.isExpired === true) return 'expired';
  const runStatus = result.run.status;
  const approvalStatus = result.approval?.status;
  if (approvalStatus === 'expired') return 'expired';
  if (runStatus === 'failed') return 'failed';
  if (runStatus === 'cancelled' || approvalStatus === 'rejected') return 'rejected';
  if (runStatus === 'working') return 'dispatched';
  if (approvalStatus === 'approved') return 'approved';
  if (runStatus === 'awaiting_approval') return 'awaiting_approval';
  return 'awaiting_approval';
}

/** Terminal states — polling must stop once reached (never auto-retry). */
export function isApprovalGatedTerminal(state: ApprovalGatedState): boolean {
  return state === 'completed' || state === 'failed' || state === 'rejected' || state === 'expired';
}

/** Human-friendly latency label. */
export function formatApprovalGatedMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Human-friendly HAL dispatch label. */
export function formatHalDispatch(halDispatch: string | undefined): string {
  switch (halDispatch) {
    case 'NOT_YET_SENT': return 'NOT YET SENT';
    case 'SENT': return 'SENT';
    case 'RESULT_RECEIVED': return 'RESULT RECEIVED';
    case 'BLOCKED': return 'BLOCKED';
    default: return halDispatch ?? 'BLOCKED';
  }
}