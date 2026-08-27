// ============================================================================
// AI Operations — Alerts & Incident Operations — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_alerts, ai_incidents,
// ai_incident_alerts, ai_incident_timeline) and the existing `AiAlert` contract
// plus a lightweight `AiIncident` contract. All DB→frontend field differences
// are handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `alert_key` / `incident_key` (text, unique) are the stable application
//     identifiers used by routes (/ai-operations/alerts/:alertId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`. All FK UUIDs are resolved back to stable
//     keys here via the resolution context.
//
// Live vs demo:
//   * Authoritative registry metadata (identity, title/summary, type/source,
//     severity/priority/status/risk, occurrence count, timestamps, resolution
//     summary, and the resolved site/agent/run/approval/policy/tool/model
//     references) comes from the live rows.
//   * Nested runtime metadata (timeline, diagnostics, known-issue, impact,
//     governance, escalation, recurrence, tags, team names) has no dedicated
//     production tables yet, so it is merged from the demo registry as
//     clearly-labelled "Demo Supporting Metadata". Newly created live records
//     (no demo match) get safe empty defaults.
// ============================================================================

import type {
  AiAlert,
  AlertType,
  AlertStatus,
  Severity,
  IncidentTimelineEvent,
  IncidentImpact,
  IncidentResolution,
  IncidentEscalation,
  IncidentRecurrence,
  AlertDiagnostics,
  AlertKnownIssue,
  AlertGovernance,
} from '@/pages/ai-operations/types';
import type {
  AiAlertRow,
  AiIncidentRow,
  AiIncidentAlertRow,
  AiIncidentTimelineRow,
} from '@/lib/ai-operations';

// Resolved lookup maps, built by the Alerts context from the live registries.
// No UUIDs leak into the UI — every FK is resolved to its stable key here.
export interface AlertResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  runKeyById: Map<string, string>;
  approvalKeyById: Map<string, string>;
  policyKeyById: Map<string, string>;
  policyNameById: Map<string, string>;
  connectionKeyById: Map<string, string>;
  modelKeyById: Map<string, string>;
  incidentKeyByAlertUuid: Map<string, string>;
}

// Lightweight live incident contract (used for incident creation/status and
// the incident list projection). The rich incident workflow UI continues to
// reuse the demo alert's nested metadata via the alert mapper.
export interface AiIncident {
  id: string;
  title: string;
  summary: string;
  siteId: string | null;
  siteName: string;
  severity: Severity;
  priority: string;
  status: AlertStatus;
  incidentType: string;
  leadTeam: string;
  ownerReference: string;
  impactSummary: string;
  suspectedCause: string;
  confirmedCause: string;
  responsePlan: string;
  resolutionSummary: string;
  knownIssueMemoryKey: string | null;
  approvalRequired: boolean;
  securityReviewRequired: boolean;
  uatRequired: boolean;
  startedAt: string;
  resolvedAt: string;
  closedAt: string;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyDiagnostics(): AlertDiagnostics {
  return {
    suspectedCause: '—',
    affectedComponent: '—',
    relatedFailures: '—',
    confidence: '—',
    knownIssueMatch: 'No exact match',
    recommendedInvestigation: '—',
  };
}

function emptyKnownIssue(): AlertKnownIssue {
  return {
    knowledgeId: null,
    note: 'No prior incident on record.',
    previousRootCause: '—',
    previousResolution: '—',
    previousVerification: '—',
  };
}

function emptyImpact(): IncidentImpact {
  return {
    usersAffected: '—',
    sitesAffected: '—',
    serviceImpact: '—',
    financialImpact: '—',
    securityImpact: '—',
    complianceImpact: '—',
    customerImpact: '—',
  };
}

function emptyResolution(): IncidentResolution {
  return {
    status: 'Open',
    summary: '',
    rootCause: '',
    fixReference: '',
    verificationResult: '',
    uatResult: '',
    closedByTeam: '',
    closedAt: '',
  };
}

function emptyEscalation(): IncidentEscalation {
  return {
    level: 'team_review',
    assignedTeam: '—',
    reason: '',
    escalatedAt: '',
    nextEscalation: 'Technical Escalation',
  };
}

function emptyRecurrence(occurrenceCount: number): IncidentRecurrence {
  return {
    recurrenceCount: occurrenceCount,
    firstSeen: '',
    lastSeen: '',
    relatedIncidentIds: [],
    knownIssueRef: '',
    trendState: occurrenceCount > 1 ? 'repeating' : 'new',
  };
}

function emptyGovernance(): AlertGovernance {
  return {
    policyId: null,
    policyName: '—',
    risk: 'green',
    approvalRequired: false,
    minApprovers: 0,
    verificationRequired: false,
    uatRequired: false,
    auditRequired: true,
  };
}

/**
 * Map a live `ai_alerts` row to an `AiAlert`.
 *
 * @param row    The Supabase row.
 * @param ctx    Resolved UUID → stable-key maps (site/agent/run/approval/
 *               policy/connection/model + incident key).
 * @param demo   Optional matching demo record (by `alert_key`) supplying
 *               nested demo supporting metadata.
 */
export function mapAlertRowToRecord(
  row: AiAlertRow,
  ctx: AlertResolutionContext,
  demo?: AiAlert,
): AiAlert {
  const d = demo;
  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id
    ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—')
    : 'Group-wide';
  const agentId = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? null) : null;
  const agentName = row.agent_id
    ? (ctx.agentNameById.get(row.agent_id) ?? d?.agentName ?? '—')
    : '—';

  const occurrenceCount = row.occurrence_count ?? 1;
  const detectedAt = formatTimestamp(row.first_seen_at) || d?.detectedAt || '';
  const updatedAt = formatTimestamp(row.last_seen_at) || d?.updatedAt || detectedAt;
  const acknowledgedAt = formatTimestamp(row.acknowledged_at) || null;
  const incidentId = ctx.incidentKeyByAlertUuid.get(row.id) ?? d?.incidentId ?? '';

  const repeating = d?.repeating ?? occurrenceCount > 1;

  // Nested demo supporting metadata (no dedicated production tables yet).
  const timeline: IncidentTimelineEvent[] = d?.timeline ?? [];
  const diagnostics: AlertDiagnostics = d?.diagnostics ?? emptyDiagnostics();
  const knownIssue: AlertKnownIssue = d?.knownIssue ?? emptyKnownIssue();
  const impactAssessment: IncidentImpact = d?.impactAssessment ?? emptyImpact();
  const governance: AlertGovernance = d?.governance ?? emptyGovernance();
  const escalation: IncidentEscalation = d?.escalation ?? emptyEscalation();
  const recurrence: IncidentRecurrence = d?.recurrence ?? emptyRecurrence(occurrenceCount);

  // Resolution merges the live resolution summary into the demo resolution
  // object (live is authoritative for the summary string).
  const resolution: IncidentResolution = {
    status: d?.resolution.status ?? (row.status === 'closed' ? 'Closed' : row.status === 'resolved' ? 'Resolved' : 'Open'),
    summary: row.resolution_summary ?? d?.resolution.summary ?? '',
    rootCause: d?.resolution.rootCause ?? '',
    fixReference: d?.resolution.fixReference ?? '',
    verificationResult: d?.resolution.verificationResult ?? '',
    uatResult: d?.resolution.uatResult ?? '',
    closedByTeam: d?.resolution.closedByTeam ?? '',
    closedAt: formatTimestamp(row.resolved_at) || d?.resolution.closedAt || '',
  };

  return {
    // Stable application identifier — equals the DB `alert_key`.
    id: row.alert_key,
    incidentId,
    title: row.title,
    description: row.summary ?? '',
    type: (row.alert_type as AlertType) ?? 'other',
    severity: (row.severity as Severity) ?? 'low',
    status: (row.status as AlertStatus) ?? 'new',
    siteId,
    siteName,
    agentId,
    agentName,
    runId: row.run_id ? (ctx.runKeyById.get(row.run_id) ?? null) : null,
    orchestrationId: d?.orchestrationId ?? null,
    approvalId: row.approval_id ? (ctx.approvalKeyById.get(row.approval_id) ?? null) : null,
    toolId: row.connection_id ? (ctx.connectionKeyById.get(row.connection_id) ?? null) : null,
    modelId: row.model_id ? (ctx.modelKeyById.get(row.model_id) ?? null) : null,
    policyId: row.policy_id ? (ctx.policyKeyById.get(row.policy_id) ?? null) : null,
    knowledgeId: d?.knowledgeId ?? null,
    triggerSource: row.source_type ?? d?.triggerSource ?? '',
    detectedAt,
    updatedAt,
    acknowledgedAt,
    assignedTeam: d?.assignedTeam ?? row.acknowledged_by ?? '—',
    escalationTeam: d?.escalationTeam ?? '—',
    impact: d?.impact ?? impactAssessment.serviceImpact,
    affectedService: d?.affectedService ?? '—',
    repeating,
    suggestedAction: d?.suggestedAction ?? row.notes ?? '—',
    resolutionSummary: row.resolution_summary ?? '',
    verificationRequired: d?.verificationRequired ?? row.review_required,
    uatRequired: d?.uatRequired ?? false,
    auditRequired: d?.auditRequired ?? true,
    tags: d?.tags ?? [],
    notes: row.notes ?? d?.notes ?? '',
    timeline,
    diagnostics,
    knownIssue,
    impactAssessment,
    governance,
    resolution,
    escalation,
    recurrence,
  };
}

/**
 * Map a live `ai_incidents` row to a lightweight `AiIncident`.
 * `site_id` is resolved to the stable site key/name (or null for group-wide).
 */
export function mapIncidentRowToRecord(
  row: AiIncidentRow,
  siteKeyById: Map<string, string>,
  siteNameById: Map<string, string>,
): AiIncident {
  const siteId = row.site_id ? (siteKeyById.get(row.site_id) ?? null) : null;
  const siteName = row.site_id ? (siteNameById.get(row.site_id) ?? '—') : 'Group-wide';

  return {
    id: row.incident_key,
    title: row.title,
    summary: row.summary ?? '',
    siteId,
    siteName,
    severity: (row.severity as Severity) ?? 'low',
    priority: row.priority ?? 'normal',
    status: (row.status as AlertStatus) ?? 'new',
    incidentType: row.incident_type ?? 'other',
    leadTeam: row.lead_team ?? '—',
    ownerReference: row.owner_reference ?? '—',
    impactSummary: row.impact_summary ?? '',
    suspectedCause: row.suspected_cause ?? '—',
    confirmedCause: row.confirmed_cause ?? '',
    responsePlan: row.response_plan ?? '—',
    resolutionSummary: row.resolution_summary ?? '',
    knownIssueMemoryKey: row.known_issue_memory_key ?? null,
    approvalRequired: row.approval_required,
    securityReviewRequired: row.security_review_required,
    uatRequired: row.uat_required,
    startedAt: formatTimestamp(row.started_at),
    resolvedAt: formatTimestamp(row.resolved_at),
    closedAt: formatTimestamp(row.closed_at),
  };
}

/**
 * Map an `ai_incident_timeline` row to the frontend timeline event shape.
 */
export function mapTimelineRowToEvent(row: AiIncidentTimelineRow): IncidentTimelineEvent {
  return {
    timestamp: formatTimestamp(row.created_at),
    actor: row.actor_reference ?? '—',
    event: row.event_type ?? row.new_status ?? 'Event',
    summary: row.summary ?? '',
  };
}

/**
 * Resolve an incident → alert link into a `{ incidentKey, alertKey }` pair.
 * `incidentId`/`alertId` are the resolved DB UUIDs (both supplied by the caller
 * from the already-loaded rows).
 */
export function mapIncidentAlertLink(
  link: AiIncidentAlertRow,
  incidentKeyById: Map<string, string>,
  alertKeyById: Map<string, string>,
): { incidentKey: string; alertKey: string } {
  return {
    incidentKey: incidentKeyById.get(link.incident_id) ?? link.incident_id,
    alertKey: alertKeyById.get(link.alert_id) ?? link.alert_id,
  };
}