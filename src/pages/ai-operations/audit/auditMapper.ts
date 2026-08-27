// ============================================================================
// AI Operations — Audit & Evidence — audit database ↔ frontend mapper.
//
// A single clean mapping between the Supabase `ai_audit_events` row and the
// existing `AiAuditEvent` contract. No mapping logic leaks into JSX.
//
// ID strategy:
//   * `audit_key` (text, unique) is the stable application identifier used by
//     routes (/ai-operations/audit/:auditId).
//   * The database `id` (UUID) remains the internal primary key.
//
// Live vs demo:
//   * Authoritative audit base (event type, action, outcome, severity, site/
//     agent/run/approval linkage, actor, trigger, risk, environment, before/
//     after summaries, decision reason, verification/UAT state, integrity,
//     review flag, notes) comes from the live `ai_audit_events` row.
//   * Nested supporting metadata (orchestration/alert/policy/tool/model/
//     knowledge references, full verification/uat/governance sub-objects) has
//     no production column, so it is merged from the demo registry as
//     "Demo Supporting Metadata" where available.
// ============================================================================

import type {
  AiAuditEvent,
  AuditEventType,
  AuditOutcome,
  AuditVerification,
  AuditUatEvidence,
  AuditGovernance,
  AuditIntegrityState,
  AuditEvidence,
  EvidenceType,
  EvidenceStatus,
  ActorType,
  Environment,
  RiskClass,
  Severity,
} from '@/pages/ai-operations/types';
import type { AiAuditEventRow, AiAuditEvidenceRow } from '@/lib/ai-operations';

// Resolved cross-table maps (site/agent/run/approval key & name by UUID),
// built by the Audit context from the live registries. No UUIDs leak into UI.
export interface AuditResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  runKeyById: Map<string, string>;
  approvalKeyById: Map<string, string>;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function emptyVerification(): AuditVerification {
  return {
    required: false,
    status: 'N/A',
    agent: '',
    checksPerformed: [],
    result: '',
    evidenceAvailable: false,
    failureSummary: '',
  };
}

function emptyUat(): AuditUatEvidence {
  return {
    required: false,
    reference: '',
    testsPassed: 0,
    testsFailed: 0,
    blockingFailures: false,
    finalStatus: 'Not required',
  };
}

function emptyGovernance(risk: RiskClass): AuditGovernance {
  return {
    policyEvaluated: '',
    riskClassification: risk,
    approvalRequired: false,
    approvalDecision: 'N/A',
    decisionActor: '',
    separationOfDuties: false,
    overrideUsed: false,
    reason: '',
  };
}

// Build a minimal verification object from the live verification_state summary
// when no demo supporting metadata exists (e.g. a newly recorded event).
function verificationFromState(state: string | null): AuditVerification {
  if (!state || state === 'not_required') return emptyVerification();
  return {
    required: true,
    status: state,
    agent: '',
    checksPerformed: [],
    result: state,
    evidenceAvailable: state === 'Passed',
    failureSummary: state === 'Failed' ? 'Verification failed.' : '',
  };
}

function uatFromState(state: string | null): AuditUatEvidence {
  if (!state || state === 'not_required') return emptyUat();
  return {
    required: true,
    reference: '',
    testsPassed: 0,
    testsFailed: 0,
    blockingFailures: state === 'Failed',
    finalStatus: state,
  };
}

/**
 * Map a live `ai_audit_events` row to an `AiAuditEvent`.
 *
 * @param row          The Supabase `ai_audit_events` row.
 * @param demo         Optional matching demo record (by `audit_key`) for
 *                     supporting metadata (nested verification/uat/governance,
 *                     orchestration/alert/policy/tool/model/knowledge refs).
 * @param evidenceKeys Resolved `evidence_key` list attached to this event.
 * @param ctx          Resolved site/agent/run/approval lookup maps.
 */
export function mapAuditEventRowToRecord(
  row: AiAuditEventRow,
  demo: AiAuditEvent | undefined,
  evidenceKeys: string[],
  ctx: AuditResolutionContext,
): AiAuditEvent {
  // Resolve site key/name (no UUIDs in UI). Null site = group-wide.
  const siteKey = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'group') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? siteKey) : 'Group-wide';

  const agentKey = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? '') : '';
  const agentName = row.agent_id
    ? (ctx.agentNameById.get(row.agent_id) ?? 'Unresolved Agent')
    : (demo?.agentName ?? 'Unassigned');

  const runKey = row.run_id ? (ctx.runKeyById.get(row.run_id) ?? null) : null;
  const approvalKey = row.approval_id ? (ctx.approvalKeyById.get(row.approval_id) ?? null) : null;

  const risk = (row.risk_level as RiskClass) ?? (demo?.risk ?? 'green');
  const verification = demo ? demo.verification : verificationFromState(row.verification_state);
  const uat = demo ? demo.uat : uatFromState(row.uat_state);
  const governance = demo ? demo.governance : emptyGovernance(risk);

  return {
    // Stable application identifier — equals the DB `audit_key`.
    id: row.audit_key,
    timestamp: formatDateTime(row.occurred_at) || demo?.timestamp || '—',
    eventType: (row.event_type as AuditEventType) ?? (demo?.eventType ?? 'other'),
    action: row.action ?? demo?.action ?? 'Audit event',
    outcome: (row.outcome as AuditOutcome) ?? (demo?.outcome ?? 'informational'),
    severity: (row.severity as Severity) ?? (demo?.severity ?? 'low'),
    siteId: siteKey,
    siteName,
    agentId: agentKey || null,
    agentName,
    runId: runKey ?? demo?.runId ?? null,
    orchestrationId: demo?.orchestrationId ?? null,
    approvalId: approvalKey ?? demo?.approvalId ?? null,
    alertId: demo?.alertId ?? null,
    policyId: demo?.policyId ?? null,
    toolId: demo?.toolId ?? null,
    modelId: demo?.modelId ?? null,
    knowledgeId: demo?.knowledgeId ?? null,
    uatReference: demo?.uatReference ?? '',
    actorType: (row.actor_type as ActorType) ?? (demo?.actorType ?? 'system'),
    actorTeam: row.actor_reference ?? demo?.actorTeam ?? '',
    triggerSource: row.trigger_source ?? demo?.triggerSource ?? 'system',
    risk,
    environment: (row.environment as Environment) ?? (demo?.environment ?? 'production'),
    beforeState: row.before_summary ?? demo?.beforeState ?? '',
    afterState: row.after_summary ?? demo?.afterState ?? '',
    decisionReason: row.decision_reason ?? demo?.decisionReason ?? '',
    evidenceIds: evidenceKeys.length ? evidenceKeys : (demo?.evidenceIds ?? []),
    verification,
    uat,
    governance,
    correlationId: row.correlation_id ?? demo?.correlationId ?? '',
    integrityState: (row.integrity_state as AuditIntegrityState) ?? (demo?.integrityState ?? 'unknown'),
    reviewRequired: row.review_required ?? demo?.reviewRequired ?? false,
    notes: row.notes ?? demo?.notes ?? '',
  };
}

/**
 * Map a live `ai_audit_evidence` row to an `AuditEvidence`. `auditKeyByEventId`
 * resolves the evidence's parent event to its stable `audit_key` (no UUIDs).
 */
export function mapEvidenceRowToRecord(
  row: AiAuditEvidenceRow,
  auditKeyByEventId: Map<string, string>,
): AuditEvidence {
  return {
    id: row.evidence_key,
    type: (row.evidence_type as EvidenceType) ?? 'other',
    title: row.title ?? 'Evidence',
    source: row.source ?? '',
    timestamp: formatDateTime(row.captured_at) || '—',
    integrityState: (row.integrity_state as AuditIntegrityState) ?? 'unknown',
    required: row.required,
    status: (row.status as EvidenceStatus) ?? 'available',
    relatedRecordId: row.audit_event_id ? (auditKeyByEventId.get(row.audit_event_id) ?? null) : null,
  };
}