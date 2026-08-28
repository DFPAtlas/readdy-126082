// ============================================================================
// AI Operations — Master Orchestrator — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_orchestrations,
// ai_orchestration_steps, ai_orchestration_candidates, ai_orchestration_decisions)
// and the existing `AiOrchestration` contract. All DB↔frontend field
// differences are handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `orchestration_key` is the stable application identifier used by routes
//     (/ai-operations/orchestrator/:orchestrationId). DB UUIDs are never
//     exposed as the frontend `id`.
//   * All FK UUIDs (site/agent/run/approval) are resolved back to stable keys
//     here via the resolution context.
//
// Live vs demo:
//   * Authoritative registry metadata (identity, request type/source/action,
//     site, environment, priority, risk, status, classification, selected
//     agent, run/approval links, policy/permission result, approval flags,
//     blocked reason, failure/fallback strategy, result summary) comes from
//     live rows.
//   * Nested/derived metadata (classification detail, site-resolution detail,
//     agent-selection detail, candidate scoring, plan steps, workflow chain,
//     permission gate checks, risk assessment, approval gate, capacity,
//     verification/uat/audit, timeline) has no fully-structured production
//     representation yet, so it is merged from the demo registry as
//     clearly-labelled "Demo Supporting Metadata".
//
// Safety: no execution occurs, no secrets or hidden chain-of-thought are
// mapped. `execution_allowed` is FALSE for all migrated records.
// ============================================================================

import type {
  AiOrchestration,
  OrchestrationStatus,
  OrchestrationStage,
  TriggerSource,
  TaskType,
  RunPriority,
  RiskLevel,
  RiskClass,
  Environment,
  OrchestrationClassification,
  OrchestrationSiteResolution,
  OrchestrationAgentSelection,
  AgentCandidate,
  ExecutionPlanStep,
  OrchestratorEvent,
  PermissionGateCheck,
  OrchestrationRiskAssessment,
  OrchestrationApprovalGate,
  OrchestrationCapacity,
  FailureStrategy,
  RequiredTool,
  OrchestrationVerification,
  OrchestrationUat,
  OrchestrationAudit,
  RunChainNode,
} from '@/pages/ai-operations/types';
import type {
  AiOrchestrationRow,
  AiOrchestrationStepRow,
  AiOrchestrationCandidateRow,
  AiOrchestrationDecisionRow,
} from '@/lib/ai-operations';

// Resolved lookup maps, built by the Orchestrator context from the live
// registries. No UUIDs leak into the UI — every FK is resolved to its key here.
export interface OrchestratorResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  runKeyById: Map<string, string>;
  approvalKeyById: Map<string, string>;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asStringArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Derive a risk class from a free-form risk level (low → green, medium → amber,
// high/critical → red). Used only for new live records without a demo match.
function riskClassFromLevel(risk: string | null | undefined): RiskClass {
  if (risk === 'high' || risk === 'critical') return 'red';
  if (risk === 'medium') return 'amber';
  return 'green';
}

const DEFAULT_STAGES: { stage: OrchestrationStage; state: 'completed' | 'current' | 'blocked' | 'not_required' | 'pending' }[] = [
  { stage: 'receive', state: 'completed' },
  { stage: 'classify', state: 'completed' },
  { stage: 'identify_site', state: 'completed' },
  { stage: 'assess_risk', state: 'completed' },
  { stage: 'select_agent', state: 'current' },
  { stage: 'plan', state: 'pending' },
  { stage: 'check_permissions', state: 'pending' },
  { stage: 'approval_gate', state: 'pending' },
  { stage: 'execute', state: 'pending' },
  { stage: 'verify', state: 'pending' },
  { stage: 'uat', state: 'pending' },
  { stage: 'audit', state: 'pending' },
  { stage: 'complete', state: 'pending' },
];

function emptyClassification(row: AiOrchestrationRow): OrchestrationClassification {
  return {
    requestSummary: row.description ?? '',
    trigger: (row.request_source as TriggerSource) ?? 'manual',
    detectedIntent: row.requested_action ?? row.classification ?? 'Other',
    detectedSite: '—',
    confidence: row.classification_confidence ?? '—',
    taskType: (row.request_type as TaskType) ?? 'other',
    priority: (row.priority as RunPriority) ?? 'normal',
    risk: (row.risk_level as RiskLevel) ?? 'low',
    environment: (row.environment as Environment) ?? 'production',
  };
}

function emptySiteResolution(): OrchestrationSiteResolution {
  return { selectedSite: '—', confidence: '—', alternatives: [], operationalStatus: 'healthy', aiStatus: 'active', capabilityMatch: '—' };
}

function emptyAgentSelection(): OrchestrationAgentSelection {
  return {
    name: '—', scope: 'Group-wide', category: 'other', status: 'active', health: 'healthy',
    autonomy: 'limited_automatic', workload: '—', queue: 0, capabilityMatch: '—',
    permissionMatch: '—', tools: [], selectionScore: 0, selectionReason: 'Not yet selected',
  };
}

function emptyPermissionGate(): PermissionGateCheck[] {
  return [
    { name: 'Agent enabled', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Site assignment valid', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Environment allowed', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Data permission', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Tool permission', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Action permission', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Risk / autonomy compatible', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Approval satisfied', state: 'not_required', note: 'Planning metadata only' },
    { name: 'Audit enabled', state: 'not_required', note: 'Planning metadata only' },
  ];
}

function emptyRiskAssessment(row: AiOrchestrationRow): OrchestrationRiskAssessment {
  return {
    overallRisk: (row.risk_level as RiskLevel) ?? 'low',
    riskClass: riskClassFromLevel(row.risk_level),
    dataImpact: '—', customerImpact: '—', financialImpact: '—', securityImpact: '—',
    complianceImpact: '—', reversibility: '—', approvalRequired: row.approval_required,
  };
}

function emptyApprovalGate(row: AiOrchestrationRow): OrchestrationApprovalGate {
  return {
    approvalId: null, status: 'draft', risk: (row.risk_level as RiskLevel) ?? 'low',
    requiredTeam: '—', minApprovers: 0, currentApprovals: 0, expiry: '—', blocking: false,
  };
}

function emptyCapacity(): OrchestrationCapacity {
  return { primaryAgent: '—', capacity: 'available', activeTasks: 0, queue: 0, availability: '—', fallbackAgent: '—', fallbackReason: '—', estimatedWait: '—' };
}

function emptyFailureStrategy(row: AiOrchestrationRow): FailureStrategy {
  return { policy: row.failure_strategy ?? 'retry same agent', failedStep: '—', retryCount: 0, fallback: row.fallback_strategy ?? '—', nextAction: 'None' };
}

function emptyVerification(): OrchestrationVerification {
  return { required: false, agent: '—', checks: '—', expectedOutcome: '—', evidence: '—' };
}

function emptyUat(): OrchestrationUat {
  return { required: false, agent: '—', testRef: '—', tests: 0, requiredPassState: '—', status: 'Not required' };
}

function emptyAudit(): OrchestrationAudit {
  return { required: false, runRefs: [], approvalRef: '—', evidenceRequired: '—', completionRequired: false };
}

/**
 * Map a live `ai_orchestrations` row to an `AiOrchestration`.
 *
 * @param row   The Supabase row.
 * @param ctx   Resolved UUID → stable-key maps.
 * @param demo  Optional matching demo record (by `orchestration_key`) supplying
 *              nested demo supporting metadata.
 */
export function mapOrchestrationRowToRecord(
  row: AiOrchestrationRow,
  ctx: OrchestratorResolutionContext,
  demo?: AiOrchestration,
): AiOrchestration {
  const d = demo;

  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—') : 'Group-wide';

  const selectedAgentKey = row.selected_agent_id ? (ctx.agentKeyById.get(row.selected_agent_id) ?? null) : null;
  const selectedAgentName = row.selected_agent_id ? (ctx.agentNameById.get(row.selected_agent_id) ?? d?.primaryAgentName ?? '—') : (d?.primaryAgentName ?? '—');

  const rootRunId = row.run_id ? (ctx.runKeyById.get(row.run_id) ?? null) : (d?.rootRunId ?? null);
  const approvalId = row.approval_id ? (ctx.approvalKeyById.get(row.approval_id) ?? null) : (d?.approvalId ?? null);

  const classification: OrchestrationClassification = d?.classification ?? emptyClassification(row);
  // Overlay the live confidence where present (authoritative).
  if (row.classification_confidence) classification.confidence = row.classification_confidence;
  if (row.classification) classification.detectedIntent = row.classification;

  const siteResolution: OrchestrationSiteResolution = d?.siteResolution ?? {
    ...emptySiteResolution(),
    selectedSite: siteName,
  };

  const agentSelection: OrchestrationAgentSelection = d?.agentSelection ?? {
    ...emptyAgentSelection(),
    name: selectedAgentName,
    selectionReason: selectedAgentKey ? 'Selected agent' : 'Not yet selected',
  };

  const permissionGate: PermissionGateCheck[] = d?.permissionGate ?? emptyPermissionGate();

  const riskAssessment: OrchestrationRiskAssessment = d?.riskAssessment ?? emptyRiskAssessment(row);

  const approvalGate: OrchestrationApprovalGate = d?.approvalGate ?? {
    ...emptyApprovalGate(row),
    approvalId,
  };

  const capacity: OrchestrationCapacity = d?.capacity ?? {
    ...emptyCapacity(),
    primaryAgent: selectedAgentName,
  };

  const failureStrategy: FailureStrategy = d?.failureStrategy ?? emptyFailureStrategy(row);

  const tools: RequiredTool[] = d?.tools ?? [];

  const verification: OrchestrationVerification = d?.verification ?? emptyVerification();
  const uat: OrchestrationUat = d?.uat ?? emptyUat();
  const audit: OrchestrationAudit = d?.audit ?? emptyAudit();

  return {
    // Stable application identifier — equals the DB `orchestration_key`.
    id: row.orchestration_key,
    correlationId: row.correlation_id ?? d?.correlationId ?? '—',
    title: row.title,
    description: row.description ?? d?.description ?? '',
    triggerSource: (row.request_source as TriggerSource) ?? d?.triggerSource ?? 'manual',
    requestedBy: row.requested_by ?? d?.requestedBy ?? '—',
    siteId,
    siteName,
    detectedIntent: row.requested_action ?? d?.detectedIntent ?? row.classification ?? 'Other',
    taskType: (row.request_type as TaskType) ?? d?.taskType ?? 'other',
    priority: (row.priority as RunPriority) ?? d?.priority ?? 'normal',
    risk: (row.risk_level as RiskLevel) ?? d?.risk ?? 'low',
    riskClass: d?.riskClass ?? riskClassFromLevel(row.risk_level),
    environment: (row.environment as Environment) ?? d?.environment ?? 'production',
    status: (row.status as OrchestrationStatus) ?? d?.status ?? 'received',
    currentStage: d?.currentStage ?? 'select_agent',
    primaryAgentId: selectedAgentKey ?? d?.primaryAgentId ?? '—',
    primaryAgentName: selectedAgentName,
    supportingAgentIds: d?.supportingAgentIds ?? [],
    candidateAgentIds: d?.candidateAgentIds ?? [],
    rootRunId,
    approvalId,
    approvalRequired: row.approval_required,
    verificationRequired: row.verification_required,
    uatRequired: row.uat_required,
    auditRequired: row.audit_required,
    estimatedCost: d?.estimatedCost ?? '—',
    resultSummary: row.result_summary ?? d?.resultSummary ?? '',
    failureSummary: row.blocked_reason ?? d?.failureSummary ?? null,
    createdAt: d?.createdAt ?? formatTimestamp(row.created_at),
    updatedAt: d?.updatedAt ?? formatTimestamp(row.updated_at),
    startedAt: d?.startedAt ?? '—',
    completedAt: d?.completedAt ?? (row.completed_at ? formatTimestamp(row.completed_at) : '—'),
    stages: d?.stages ?? DEFAULT_STAGES,
    classification,
    siteResolution,
    agentSelection,
    candidates: d?.candidates ?? [],
    plan: d?.plan ?? [],
    workflow: d?.workflow ?? [],
    permissionGate,
    riskAssessment,
    approvalGate,
    capacity,
    failureStrategy,
    tools,
    verification,
    uat,
    audit,
    events: d?.events ?? [],
  };
}

/**
 * Map a live `ai_orchestration_steps` row to an `ExecutionPlanStep`.
 * `tool_references` is a JSONB array; the first tool is used as the step tool.
 */
export function mapStepRowToPlan(
  row: AiOrchestrationStepRow,
  ctx: OrchestratorResolutionContext,
): ExecutionPlanStep {
  const tools = asStringArray(row.tool_references);
  const agentKey = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? null) : null;
  const agentName = row.agent_id ? (ctx.agentNameById.get(row.agent_id) ?? '—') : '—';

  return {
    number: row.step_number,
    agentId: agentKey ?? (row.step_type === 'human_approval' ? 'human' : '—'),
    agentName: row.step_type === 'human_approval' ? 'Human Approval' : agentName,
    action: row.name ?? '—',
    tool: tools[0] ?? '—',
    risk: (row.risk_level as RiskLevel) ?? 'low',
    approvalRequired: row.approval_required,
    status: (row.status as ExecutionPlanStep['status']) ?? 'pending',
    runId: null,
  };
}

/**
 * Map a live `ai_orchestration_candidates` row to an `AgentCandidate`.
 * `capability_score` is used to derive the human-readable capability match
 * string (score values are registry-derived percentages).
 */
export function mapCandidateRowToCandidate(
  row: AiOrchestrationCandidateRow,
  ctx: OrchestratorResolutionContext,
): AgentCandidate {
  const agentKey = ctx.agentKeyById.get(row.agent_id) ?? 'unknown';
  const agentName = ctx.agentNameById.get(row.agent_id) ?? '—';
  const cap = row.capability_score != null ? `${row.capability_score}%` : '—';

  return {
    agentId: agentKey,
    agentName,
    eligibility: row.eligible ? 'Eligible' : 'Ineligible',
    score: row.score != null ? Number(row.score) : 0,
    health: 'healthy',
    capacity: 'available',
    capabilityMatch: cap,
    permissionMatch: '—',
    reason: row.rejection_reason ?? row.selection_reason ?? '—',
    selected: row.rank === 1 && row.eligible,
  };
}

/**
 * Map a live `ai_orchestration_decisions` row to an `OrchestratorEvent`
 * (the append-oriented routing-decision timeline).
 */
export function mapDecisionRowToEvent(row: AiOrchestrationDecisionRow): OrchestratorEvent {
  const typeLabel =
    row.decision_type === 'request_classified' ? 'Request classified' :
    row.decision_type === 'site_resolved' ? 'Site resolved' :
    row.decision_type === 'agent_considered' ? 'Agent considered' :
    row.decision_type === 'agent_selected' ? 'Agent selected' :
    row.decision_type === 'routing_blocked' ? 'Routing blocked' :
    row.decision_type === 'approval_required' ? 'Approval required' :
    row.decision_type === 'permission_checked' ? 'Permissions checked' :
    row.decision_type === 'policy_checked' ? 'Policy checked' :
    row.decision_type === 'tool_requirement_checked' ? 'Tool requirement checked' :
    row.decision_type === 'model_requirement_checked' ? 'Model requirement checked' :
    row.decision_type === 'knowledge_requirement_checked' ? 'Knowledge requirement checked' :
    row.decision_type === 'fallback_selected' ? 'Fallback selected' :
    (row.decision_type ?? 'Decision');

  return {
    timestamp: formatTimestamp(row.created_at),
    event: typeLabel,
    actor: row.actor_reference ?? 'Orchestrator',
    summary: row.decision ? `${row.decision}${row.reason ? ` — ${row.reason}` : ''}` : (row.reason ?? ''),
  };
}

// Rich, append-oriented routing-decision timeline item for the Orchestrator
// Detail "Routing Decisions" panel. Carries the safe actor type + reference
// and the display-safe result/reason (never hidden chain-of-thought).
export interface OrchestrationDecisionTimeline {
  timestamp: string;
  decisionType: string;
  label: string;
  result: string;
  reason: string;
  actorType: string;
  actorReference: string;
}

export function mapDecisionRowToTimeline(row: AiOrchestrationDecisionRow): OrchestrationDecisionTimeline {
  const label =
    row.decision_type === 'request_classified' ? 'Request Classified' :
    row.decision_type === 'site_resolved' ? 'Site Resolved' :
    row.decision_type === 'agent_considered' ? 'Agent Considered' :
    row.decision_type === 'agent_selected' ? 'Agent Selected' :
    row.decision_type === 'routing_blocked' ? 'Routing Blocked' :
    row.decision_type === 'approval_required' ? 'Approval Required' :
    row.decision_type === 'permission_checked' ? 'Permissions Checked' :
    row.decision_type === 'policy_checked' ? 'Policy Checked' :
    row.decision_type === 'tool_requirement_checked' ? 'Tool Requirement Checked' :
    row.decision_type === 'model_requirement_checked' ? 'Model Requirement Checked' :
    row.decision_type === 'knowledge_requirement_checked' ? 'Knowledge Requirement Checked' :
    row.decision_type === 'fallback_selected' ? 'Fallback Selected' :
    (row.decision_type ?? 'Decision');

  return {
    timestamp: formatTimestamp(row.created_at),
    decisionType: row.decision_type ?? 'decision',
    label,
    result: row.decision ?? '—',
    reason: row.reason ?? '',
    actorType: row.actor_type ?? 'system',
    actorReference: row.actor_reference ?? 'Orchestrator',
  };
}

export type { RunChainNode };