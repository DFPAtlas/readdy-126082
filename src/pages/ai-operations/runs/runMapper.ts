// ============================================================================
// AI Operations — Tasks & Runs — run database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase `ai_runs` / `ai_run_steps` rows
// and the existing `AiTaskRun` contract. All DB→frontend field differences are
// handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `run_key` (text, unique) is the stable application identifier used by
//     routes (/ai-operations/runs/:runId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//   * Existing routes keep working because the demo `id` values already equal
//     the `run_key` values.
//
// Live vs demo:
//   * Authoritative run identity/state comes from the live `ai_runs` row:
//     status, priority, risk, environment, site/agent/task resolution, queue
//     position, retry/cost metadata, sanitised result/error summaries, and
//     governance flags.
//   * Display-only wall-clock strings (started/completed/duration), the nested
//     input/result/cost/approval/uat/audit/retry/failure objects, chain
//     visualisation, tags, and notes do not yet have full live persistence, so
//     they are merged from the demo registry as "Demo Supporting Metadata".
//   * Run steps are live (from `ai_run_steps`); the per-step agent label and
//     timing strings fall back to demo supporting metadata where the step row
//     does not resolve them.
// ============================================================================

import type {
  AiTaskRun,
  RunStep,
  RunStatus,
  RunPriority,
  RiskLevel,
  Environment,
  AgentAutonomy,
  TaskType,
  TriggerSource,
  RunStepStatus,
} from '@/pages/ai-operations/types';
import type { AiRunRow, AiRunStepRow } from '@/lib/ai-operations';

// Resolved cross-table maps (site/agent/task/run key & name by UUID), built by
// the Runs context from the live registries. No UUIDs leak into the UI.
export interface RunResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  runKeyById: Map<string, string>;
  taskNameById: Map<string, string>;
  taskTypeById: Map<string, string>;
  taskKeyById: Map<string, string>;
  taskDescriptionById: Map<string, string>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse a numeric cost value into the frontend "£x.xx" string (or "—").
function formatCost(value: number | null): string {
  if (value == null) return '—';
  return `£${value.toFixed(2)}`;
}

// Safe empty defaults for a run with no demo supporting metadata.
function emptySupporting(): Partial<AiTaskRun> {
  return {
    startedTime: '—',
    completedTime: '—',
    duration: '—',
    inputSummary: '',
    model: '—',
    provider: '—',
    tags: [],
    notes: '',
    input: { type: 'Task', source: 'Orchestrator', summary: '', dataClassification: 'Internal', size: '—', timestamp: '—' },
    result: { outcome: '—', summary: '', recordsAffected: '0', nextAction: 'None' },
    failure: null,
    retry: { retryAllowed: true, retryCount: 0, maxAttempts: 3, nextRetry: '—', retryReason: '—', backoffStrategy: 'Exponential (2s → 30s)', requiresApproval: false },
    cost: { model: '—', provider: '—', estimatedTokens: '—', estimatedCost: '—', actualCost: '—', toolCost: '—', totalEstimatedCost: '—' },
    approval: { approvalRequired: false, approvalId: null, approvalState: 'Not required', requestedTime: '—', risk: 'low', approverTeam: 'Group AI Operations' },
    uat: { uatRequired: false, uatStatus: 'Not required', testPlanRef: '—', testsPassed: 0, testsFailed: 0 },
    audit: { auditRequired: true, auditStatus: 'Pending', createdBy: 'Orchestrator', createdAt: '—', lastModifiedBy: 'Orchestrator', lastModifiedAt: '—', completionEvidence: false, verificationEvidence: false },
    chain: [],
  };
}

/**
 * Map a live `ai_run_steps` row to a `RunStep`. Per-step agent label and timing
 * strings fall back to demo supporting metadata (matched by step number) where
 * the step row does not resolve them.
 */
export function mapRunStepRowToStep(
  row: AiRunStepRow,
  agentNameById: Map<string, string>,
  demoStep?: RunStep,
): RunStep {
  return {
    stepNumber: row.step_number,
    name: row.name ?? demoStep?.name ?? 'Step',
    agent: (row.agent_id ? agentNameById.get(row.agent_id) : undefined) ?? demoStep?.agent ?? 'Agent',
    status: (row.status as RunStepStatus) ?? 'pending',
    started: demoStep?.started ?? '—',
    finished: demoStep?.finished ?? '—',
    duration: demoStep?.duration ?? '—',
    inputSummary: row.input_summary ?? demoStep?.inputSummary ?? '',
    outputSummary: row.output_summary ?? demoStep?.outputSummary ?? '',
    errorSummary: row.error_summary ?? demoStep?.errorSummary,
    risk: (row.risk_level as RiskLevel) ?? demoStep?.risk ?? 'low',
    approvalRequired: row.approval_required ?? demoStep?.approvalRequired ?? false,
  };
}

/**
 * Map a live `ai_runs` row to an `AiTaskRun`.
 *
 * @param row      The Supabase `ai_runs` row.
 * @param demoRun  Optional matching demo record (by `run_key`) for supporting
 *                 metadata (timing strings, nested objects, chain, tags).
 * @param ctx      Resolved site/agent/task/run lookup maps.
 * @param stepRows Live `ai_run_steps` rows for this run (empty → demo steps).
 */
export function mapRunRowToRecord(
  row: AiRunRow,
  demoRun: AiTaskRun | undefined,
  ctx: RunResolutionContext,
  stepRows: AiRunStepRow[],
): AiTaskRun {
  const demo = demoRun ?? (emptySupporting() as AiTaskRun);

  // Resolve site/agent/task/run keys & names (no UUIDs in the UI).
  const siteKey = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'group') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? siteKey) : 'Group-wide';
  const agentKey = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? '') : '';
  const agentName = row.agent_id
    ? (ctx.agentNameById.get(row.agent_id) ?? 'Unresolved Agent')
    : demo.agentName || 'Unassigned';
  const taskKey = row.task_id ? (ctx.taskKeyById.get(row.task_id) ?? '') : '';
  const taskName = row.task_id ? (ctx.taskNameById.get(row.task_id) ?? demo.taskName) : demo.taskName;
  const taskType = row.task_id ? (ctx.taskTypeById.get(row.task_id) ?? demo.taskType) : demo.taskType;
  const taskDescription = row.task_id ? (ctx.taskDescriptionById.get(row.task_id) ?? demo.taskDescription) : demo.taskDescription;
  const parentRunKey = row.parent_run_id ? (ctx.runKeyById.get(row.parent_run_id) ?? null) : null;
  const rootRunKey = row.root_run_id ? (ctx.runKeyById.get(row.root_run_id) ?? null) : null;

  // Build live steps where available, else fall back to demo steps.
  const demoStepsByNumber = new Map((demo.steps ?? []).map((s) => [s.stepNumber, s]));
  const steps: RunStep[] =
    stepRows.length > 0
      ? stepRows.map((s) => mapRunStepRowToStep(s, ctx.agentNameById, demoStepsByNumber.get(s.step_number)))
      : demo.steps ?? [];

  return {
    // Stable application identifier — equals the DB `run_key`, keeps routes stable.
    id: row.run_key,
    parentTaskId: taskKey || demo.parentTaskId,
    parentRunId: parentRunKey ?? demo.parentRunId,
    rootRunId: rootRunKey ?? demo.rootRunId,
    correlationId: row.correlation_id ?? demo.correlationId,
    taskName,
    taskDescription,
    taskType: (taskType as TaskType) ?? 'other',
    requestedBy: demo.requestedBy || 'Orchestrator',
    triggerSource: (demo.triggerSource as TriggerSource) ?? 'user',
    siteId: siteKey,
    siteName,
    agentId: agentKey,
    agentName,
    environment: (row.environment as Environment) ?? 'production',
    status: (row.status as RunStatus) ?? 'draft',
    priority: (row.priority as RunPriority) ?? 'normal',
    risk: (row.risk_level as RiskLevel) ?? 'low',
    autonomy: (demo.autonomy as AgentAutonomy) ?? 'limited_automatic',
    queuePosition: row.queue_position ?? null,
    startedTime: demo.startedTime ?? '—',
    completedTime: demo.completedTime ?? '—',
    duration: demo.duration ?? '—',
    createdTime: demo.createdTime ?? formatDate(row.created_at),
    updatedTime: formatDate(row.updated_at),
    attempts: row.attempts ?? 0,
    maxAttempts: row.max_attempts ?? 3,
    retryCount: row.retry_count ?? 0,
    estimatedCost: formatCost(row.estimated_cost),
    actualCost: formatCost(row.actual_cost),
    model: demo.model ?? '—',
    provider: demo.provider ?? '—',
    inputSummary: demo.inputSummary ?? '',
    resultSummary: row.result_summary ?? demo.resultSummary ?? '',
    errorSummary: row.error_summary ?? demo.errorSummary ?? '',
    approvalRequired: row.approval_required ?? false,
    // Approvals are not migrated yet — the reference remains demo supporting metadata.
    approvalId: demo.approvalId ?? null,
    uatRequired: row.uat_required ?? false,
    verificationRequired: row.verification_required ?? false,
    auditRequired: row.audit_required ?? true,
    currentStep: row.current_step ?? 0,
    totalSteps: row.total_steps ?? 0,
    tags: demo.tags ?? [],
    notes: demo.notes ?? '',
    steps,
    chain: demo.chain ?? [],
    input: demo.input,
    result: demo.result,
    failure: demo.failure,
    retry: demo.retry,
    cost: demo.cost,
    approval: demo.approval,
    uat: demo.uat,
    audit: demo.audit,
  };
}