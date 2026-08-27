// ============================================================================
// AI Operations — Human Approvals — approval database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase `ai_approvals` row and the
// existing `AiApproval` contract. All DB→frontend field differences are
// handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `approval_key` (text, unique) is the stable application identifier used
//     by routes (/ai-operations/approvals/:approvalId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//
// Live vs demo:
//   * Authoritative approval identity/state comes from the live `ai_approvals`
//     row: title, description, status, risk/severity, environment, request
//     type/action, site/agent/run linkage, approver counts, sanitised
//     justification/reasoning/result/impact/rollback summaries, governance
//     flags, and the latest decision fields.
//   * Nested supporting metadata (evidence list, full impact sub-object,
//     rollback detail, separation of duties, append-only decision history,
//     execution-gate checks, recommendation block, timing display strings)
//     has no production table yet, so it is merged from the demo registry as
//     "Demo Supporting Metadata".
// ============================================================================

import type {
  AiApproval,
  ApprovalDecisionType,
  ApprovalStatus,
  RiskClass,
  RiskLevel,
  RequestType,
  Environment,
} from '@/pages/ai-operations/types';
import type { AiApprovalRow } from '@/lib/ai-operations';

// Resolved cross-table maps (site/agent/run key & name by UUID), built by the
// Approvals context from the live registries. No UUIDs leak into the UI.
export interface ApprovalResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  runKeyById: Map<string, string>;
}

// Parse the JSONB `conditions` column (array of strings) back to a single
// human-readable string. Accepts an array, a bare string, or null.
function conditionsToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter((x) => typeof x === 'string').join('; ');
  if (typeof value === 'string') return value;
  return '';
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

function formatDecisionTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} · ${hh}:${mm}`;
}

// Safe empty defaults for an approval with no demo supporting metadata
// (e.g. a newly created live approval).
function emptySupporting(): Partial<AiApproval> {
  return {
    actionCategory: 'Other',
    requestedAt: '—',
    approvalTeam: 'Group AI Operations',
    requiredRole: 'AI Operations Lead',
    expiryTime: '—',
    expiryState: 'no_expiry',
    evidenceSummary: '',
    affectedSystems: [],
    affectedRecords: '—',
    parentRunId: null,
    taskId: null,
    recommendation: {
      recommendation: 'Pending review.',
      confidence: '—',
      reasoningSummary: '',
      expectedOutcome: '',
      alternativeConsidered: '',
      whyApprovalRequired: '',
      riskIfApproved: '',
      riskIfRejected: '',
      riskIfDelayed: '',
    },
    evidence: [],
    impact: {
      systemsAffected: '',
      sitesAffected: '',
      usersAffected: '',
      recordsAffected: '—',
      serviceInterruptionExpected: false,
      estimatedDowntime: 'None',
      customerImpact: '',
      financialImpact: '',
      securityImpact: '',
      complianceImpact: '',
      reversibility: 'Unknown',
    },
    rollback: {
      available: false,
      method: '',
      estimatedTime: '—',
      backupRef: '—',
      owner: 'Group AI Operations',
      validation: '',
    },
    requirement: {
      requiredTeam: 'Group AI Operations',
      requiredRole: 'AI Operations Lead',
      minApprovers: 1,
      currentApprovals: 0,
      maxPermittedRisk: 'medium',
      separationOfDutiesRequired: true,
      expiry: '—',
      uatRequired: false,
      verificationRequired: false,
      auditRequired: true,
    },
    separation: {
      requestingAgent: '—',
      recommendingAgent: '—',
      approverTeam: 'Group AI Operations',
      executingAgent: '—',
      verifyingAgent: 'Verification Agent',
      uatAgent: 'UAT Agent',
    },
    history: [],
    executionGate: [],
  };
}

/**
 * Map a live `ai_approvals` row to an `AiApproval`.
 *
 * @param row      The Supabase `ai_approvals` row.
 * @param demo     Optional matching demo record (by `approval_key`) for
 *                 supporting metadata (evidence, impact, rollback detail,
 *                 separation, history, gate checks, display strings).
 * @param ctx      Resolved site/agent/run lookup maps.
 */
export function mapApprovalRowToRecord(
  row: AiApprovalRow,
  demo: AiApproval | undefined,
  ctx: ApprovalResolutionContext,
): AiApproval {
  const d = demo ?? (emptySupporting() as AiApproval);

  // Resolve site/agent/run keys & names (no UUIDs in the UI).
  const siteKey = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'group') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? siteKey) : 'Group-wide';
  const agentKey = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? '') : '';
  const agentName = row.agent_id
    ? (ctx.agentNameById.get(row.agent_id) ?? 'Unresolved Agent')
    : d.agentName || 'Unassigned';
  const runKey = row.run_id ? (ctx.runKeyById.get(row.run_id) ?? null) : null;

  // Latest decision fields (authoritative live base).
  const decisionType = row.decision ? (row.decision as ApprovalDecisionType) : (d.decision?.type ?? null);
  const decisionConditions = row.conditions != null ? conditionsToString(row.conditions) : (d.decision?.conditions ?? '');

  // Merge live base metadata into the nested `requirement` object so the
  // ApprovalRequirements section reflects live approver counts.
  const requirement = {
    ...d.requirement,
    requiredTeam: row.required_team ?? d.requirement.requiredTeam,
    minApprovers: row.minimum_approvers ?? d.requirement.minApprovers,
    currentApprovals: row.current_approval_count ?? d.requirement.currentApprovals,
    uatRequired: row.uat_required ?? d.requirement.uatRequired,
    verificationRequired: row.verification_required ?? d.requirement.verificationRequired,
    auditRequired: row.audit_required ?? d.requirement.auditRequired,
  };

  const rollback = {
    ...d.rollback,
    available: row.rollback_available,
    method: row.rollback_summary ?? d.rollback.method,
  };

  return {
    // Stable application identifier — equals the DB `approval_key`.
    id: row.approval_key,
    title: row.title ?? d.title,
    description: row.description ?? d.description,
    siteId: siteKey,
    siteName,
    agentId: agentKey,
    agentName,
    runId: runKey ?? d.runId ?? null,
    parentRunId: d.parentRunId ?? null,
    taskId: d.taskId ?? null,
    requestType: (row.request_type as RequestType) ?? d.requestType,
    requestedAction: row.requested_action ?? d.requestedAction,
    actionCategory: d.actionCategory,
    riskClass: (row.risk_class as RiskClass) ?? d.riskClass,
    severity: (row.severity as RiskLevel) ?? d.severity,
    environment: (row.environment as Environment) ?? 'production',
    status: (row.status as ApprovalStatus) ?? 'pending',
    requestedBy: row.requested_by ?? d.requestedBy,
    requestedAt: d.requestedAt ?? '—',
    approvalTeam: d.approvalTeam,
    requiredRole: d.requiredRole,
    minApprovers: row.minimum_approvers ?? d.minApprovers,
    approvalCount: row.current_approval_count ?? d.approvalCount,
    expiryTime: d.expiryTime ?? '—',
    expiryState: d.expiryState ?? 'no_expiry',
    businessJustification: row.business_justification ?? d.businessJustification,
    aiReasoning: row.reasoning_summary ?? d.aiReasoning,
    evidenceSummary: d.evidenceSummary ?? '',
    expectedResult: row.expected_result ?? d.expectedResult,
    potentialImpact: row.potential_impact ?? d.potentialImpact,
    affectedSystems: d.affectedSystems ?? [],
    affectedRecords: d.affectedRecords ?? '—',
    rollbackAvailable: row.rollback_available,
    rollbackSummary: row.rollback_summary ?? d.rollbackSummary,
    verificationRequired: row.verification_required,
    uatRequired: row.uat_required,
    auditRequired: row.audit_required,
    decision: {
      type: decisionType,
      reason: row.decision_reason ?? d.decision?.reason ?? '',
      timestamp: formatDecisionTime(row.decision_at) || d.decision?.timestamp || '',
      actor: row.decision_actor ?? d.decision?.actor ?? '',
      conditions: decisionConditions,
    },
    notes: row.notes ?? d.notes,
    createdAt: formatDate(row.created_at) || d.createdAt,
    updatedAt: formatDate(row.updated_at) || d.updatedAt,
    recommendation: d.recommendation,
    evidence: d.evidence,
    impact: d.impact,
    rollback,
    requirement,
    separation: d.separation,
    history: d.history,
    executionGate: d.executionGate,
  };
}