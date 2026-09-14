// ============================================================================
// DFP COMMAND 14B — PROJECT OPERATIONS — TYPES + PURE AGGREGATION
// ============================================================================
// The Operations layer is a READ-TIME AGGREGATOR + RECORD KEEPER for live
// projects. It never replaces the existing source systems — it reuses
// internal_change_requests for technical debt / improvements and surfaces
// maintenance + review records it owns. Every improvement keeps its real
// source provenance; nothing here fabricates a recommendation.
//
// Core honesty rules ("no fake green"):
//   * a failed query surfaces as UNKNOWN/unavailable, never a silent zero;
//   * technical debt is ONLY a change request explicitly classified as such;
//   * an improvement appears ONLY when a real source record exists;
//   * health trend is UNKNOWN without enough historical data.
import type { Bug, ChangeRequest } from './types';
import type { RecurringCost, CostItem } from '@/pages/project-budget/types';
import type { ProjectIntegration } from './infrastructureTypes';
import type { MonitoringIncident, MonitoringAlert } from './monitoringTypes';
import type { ProjectDeployment } from './deploymentTypes';

// ─── Maintenance ────────────────────────────────────────────────────────────

export type MaintenanceType =
  | 'PLANNED'
  | 'SECURITY'
  | 'INFRASTRUCTURE'
  | 'DATABASE'
  | 'APPLICATION'
  | 'AI'
  | 'MONITORING'
  | 'DEPENDENCY'
  | 'GENERAL';

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  PLANNED: 'Planned',
  SECURITY: 'Security',
  INFRASTRUCTURE: 'Infrastructure',
  DATABASE: 'Database',
  APPLICATION: 'Application',
  AI: 'AI',
  MONITORING: 'Monitoring',
  DEPENDENCY: 'Dependency',
  GENERAL: 'General',
};

export type MaintenanceStatus =
  | 'PLANNED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'BLOCKED';

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  PLANNED: 'Planned',
  READY: 'Ready',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  OVERDUE: 'Overdue',
  BLOCKED: 'Blocked',
};

export const MAINTENANCE_STATUS_STYLES: Record<MaintenanceStatus, string> = {
  PLANNED: 'bg-foreground-500/10 text-foreground-400',
  READY: 'bg-sky-500/10 text-sky-400',
  IN_PROGRESS: 'bg-accent-500/10 text-accent-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-foreground-500/10 text-foreground-600',
  OVERDUE: 'bg-red-500/10 text-red-400',
  BLOCKED: 'bg-orange-500/10 text-orange-400',
};

export const MAINTENANCE_TYPES: MaintenanceType[] = [
  'PLANNED',
  'SECURITY',
  'INFRASTRUCTURE',
  'DATABASE',
  'APPLICATION',
  'AI',
  'MONITORING',
  'DEPENDENCY',
  'GENERAL',
];

export interface MaintenanceItem {
  id: string;
  project_id: number;
  title: string;
  description: string | null;
  maintenance_type: MaintenanceType | null;
  status: MaintenanceStatus;
  priority: string | null;
  planned_start: string | null;
  planned_end: string | null;
  started_at: string | null;
  completed_at: string | null;
  owner: string | null;
  notes: string | null;
  related_bug_id: number | null;
  related_change_id: number | null;
  related_incident_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceInput {
  title: string;
  description?: string | null;
  type: MaintenanceType | null;
  priority: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  owner?: string | null;
  notes?: string | null;
  relatedBugId?: number | null;
  relatedChangeId?: number | null;
  relatedIncidentId?: string | null;
}

/** A maintenance item is "overdue" when its planned window has passed and it
 *  has not yet been completed or cancelled. */
export function isMaintenanceOverdue(item: MaintenanceItem): boolean {
  if (!item.planned_end) return false;
  if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return false;
  const t = new Date(item.planned_end).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export interface MaintenanceSummary {
  total: number;
  planned: number;
  active: number;
  overdue: number;
  completed: number;
  openActions: number;
}

export function computeMaintenanceSummary(items: MaintenanceItem[]): MaintenanceSummary {
  const active = items.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'READY' || m.status === 'PLANNED');
  const overdue = items.filter(isMaintenanceOverdue);
  const completed = items.filter((m) => m.status === 'COMPLETED');
  return {
    total: items.length,
    planned: items.filter((m) => m.status === 'PLANNED').length,
    active: active.length,
    overdue: overdue.length,
    completed: completed.length,
    openActions: active.length,
  };
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export type ReviewType =
  | 'POST_LAUNCH'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'INCIDENT'
  | 'MAINTENANCE'
  | 'RELEASE';

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  POST_LAUNCH: 'Post-Launch',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  INCIDENT: 'Incident',
  MAINTENANCE: 'Maintenance',
  RELEASE: 'Release',
};

export type ReviewStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const REVIEW_STATUS_STYLES: Record<ReviewStatus, string> = {
  DRAFT: 'bg-foreground-500/10 text-foreground-400',
  IN_PROGRESS: 'bg-accent-500/10 text-accent-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-foreground-500/10 text-foreground-600',
};

export interface ProjectReview {
  id: string;
  project_id: number;
  review_type: ReviewType;
  status: ReviewStatus;
  review_date: string | null;
  reviewed_by: string | null;
  summary: string | null;
  what_worked: string | null;
  what_failed: string | null;
  lessons_learned: string | null;
  recommended_actions: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewInput {
  reviewType: ReviewType;
  reviewDate?: string | null;
  summary?: string | null;
  whatWorked?: string | null;
  whatFailed?: string | null;
  lessonsLearned?: string | null;
  recommendedActions?: string | null;
  status?: ReviewStatus;
}

// ─── Improvement backlog / technical debt ───────────────────────────────────

export type ImprovementSource =
  | 'SUPPORT'
  | 'MONITORING'
  | 'INCIDENT'
  | 'BUG'
  | 'UAT'
  | 'AI_OPS'
  | 'MANUAL'
  | 'POST_LAUNCH_REVIEW'
  | 'UNKNOWN';

export const IMPROVEMENT_SOURCE_LABELS: Record<ImprovementSource, string> = {
  SUPPORT: 'Support',
  MONITORING: 'Monitoring',
  INCIDENT: 'Incident',
  BUG: 'Bug',
  UAT: 'UAT',
  AI_OPS: 'AI Ops',
  MANUAL: 'Manual',
  POST_LAUNCH_REVIEW: 'Post-Launch Review',
  UNKNOWN: 'Unknown',
};

export const IMPROVEMENT_SOURCE_STYLES: Record<ImprovementSource, string> = {
  SUPPORT: 'bg-amber-500/10 text-amber-400',
  MONITORING: 'bg-orange-500/10 text-orange-400',
  INCIDENT: 'bg-red-500/10 text-red-400',
  BUG: 'bg-red-500/10 text-red-400',
  UAT: 'bg-violet-500/10 text-violet-400',
  AI_OPS: 'bg-violet-500/10 text-violet-400',
  MANUAL: 'bg-foreground-500/10 text-foreground-400',
  POST_LAUNCH_REVIEW: 'bg-sky-500/10 text-sky-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

/** A change request is technical debt ONLY when its free-text `type` field is
 *  explicitly classified as such — never inferred broadly. */
export const TECHNICAL_DEBT_TYPE = 'technical_debt';

export function isTechnicalDebt(cr: ChangeRequest): boolean {
  return (cr.type ?? '').toLowerCase().replace(/[\s-]/g, '_') === TECHNICAL_DEBT_TYPE;
}

export type BuildIncorporationState = 'NOT PLANNED' | 'PLANNED' | 'IN BUILD' | 'COMPLETED' | 'UNKNOWN';

export const BUILD_INCORPORATION_LABELS: Record<BuildIncorporationState, string> = {
  'NOT PLANNED': 'Not Planned',
  PLANNED: 'Planned',
  'IN BUILD': 'In Build',
  COMPLETED: 'Completed',
  UNKNOWN: 'Unknown',
};

export const BUILD_INCORPORATION_STYLES: Record<BuildIncorporationState, string> = {
  'NOT PLANNED': 'bg-foreground-500/10 text-foreground-500',
  PLANNED: 'bg-sky-500/10 text-sky-400',
  'IN BUILD': 'bg-amber-500/10 text-amber-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export interface ImprovementItem {
  key: string;
  title: string;
  source: ImprovementSource;
  sourceLabel: string;
  priority: string | null;
  status: string;
  buildState: BuildIncorporationState;
  relatedObjectType: string;
  relatedObjectId: string | null;
  createdAt: string | null;
}

export interface TechnicalDebtSummary {
  open: number;
  criticalHigh: number;
  approved: number;
  inProgress: number;
  oldest: { title: string; createdAt: string } | null;
}

function originToSource(origin: string | null | undefined): ImprovementSource {
  switch ((origin ?? '').toLowerCase()) {
    case 'support':
      return 'SUPPORT';
    case 'bug':
      return 'BUG';
    case 'uat':
      return 'UAT';
    case 'ai_ops':
      return 'AI_OPS';
    case 'monitoring':
      return 'MONITORING';
    case 'incident':
      return 'INCIDENT';
    case 'post_launch_review':
      return 'POST_LAUNCH_REVIEW';
    case 'manual':
      return 'MANUAL';
    default:
      return 'UNKNOWN';
  }
}

/** Build incorporation is honest: a change request is "in build / completed"
 *  only via a real bug→build_item link. Otherwise we report NOT PLANNED. */
function crBuildState(cr: ChangeRequest, bugs: Bug[]): BuildIncorporationState {
  if (cr.status === 'completed') return 'COMPLETED';
  const srcBug = cr.source_bug_id != null ? bugs.find((b) => b.id === cr.source_bug_id) : null;
  if (srcBug && srcBug.build_item_id != null) return 'IN BUILD';
  if (srcBug) return 'PLANNED';
  return 'NOT PLANNED';
}

export function computeTechnicalDebtSummary(
  changeRequests: ChangeRequest[],
): TechnicalDebtSummary {
  const debt = changeRequests.filter(isTechnicalDebt);
  const open = debt.filter((c) => !['completed', 'rejected'].includes(c.status));
  const oldest = open
    .map((c) => ({ title: c.title, createdAt: c.created_at ?? '' }))
    .filter((x) => x.createdAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] ?? null;

  return {
    open: open.length,
    criticalHigh: open.filter((c) => c.priority === 'critical' || c.priority === 'high').length,
    approved: debt.filter((c) => c.status === 'approved').length,
    inProgress: debt.filter((c) => c.status === 'in_progress' || c.status === 'testing').length,
    oldest,
  };
}

/** Assembles the improvement backlog from real source records only. A change
 *  request that is not technical debt and not already rejected/completed is an
 *  improvement candidate; maintenance items surface as operational follow-ups
 *  with explicit MANUAL provenance. Nothing is fabricated. */
export function buildImprovementBacklog(
  changeRequests: ChangeRequest[],
  bugs: Bug[],
  maintenance: MaintenanceItem[],
): ImprovementItem[] {
  const items: ImprovementItem[] = [];

  for (const cr of changeRequests) {
    if (isTechnicalDebt(cr)) continue;
    if (cr.status === 'rejected' || cr.status === 'completed') continue;
    const source = originToSource(cr.origin);
    items.push({
      key: `cr-${cr.id}`,
      title: cr.title,
      source,
      sourceLabel: cr.origin ? originToSource(cr.origin) : 'UNKNOWN',
      priority: cr.priority,
      status: cr.status,
      buildState: crBuildState(cr, bugs),
      relatedObjectType: 'Change Request',
      relatedObjectId: String(cr.id),
      createdAt: cr.created_at ?? null,
    });
  }

  for (const m of maintenance) {
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') continue;
    items.push({
      key: `maint-${m.id}`,
      title: m.title,
      source: 'MANUAL',
      sourceLabel: 'MANUAL',
      priority: m.priority,
      status: isMaintenanceOverdue(m) ? 'OVERDUE' : m.status,
      buildState: 'NOT PLANNED',
      relatedObjectType: 'Maintenance',
      relatedObjectId: m.id,
      createdAt: m.created_at,
    });
  }

  return items.sort((a, b) => {
    const pa = a.priority === 'critical' ? 0 : a.priority === 'high' ? 1 : 2;
    const pb = b.priority === 'critical' ? 0 : b.priority === 'high' ? 1 : 2;
    if (pa !== pb) return pa - pb;
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

// ─── Health trend (honest — no invented numeric score) ─────────────────────

export type HealthTrend = 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'UNKNOWN';

export const HEALTH_TREND_LABELS: Record<HealthTrend, string> = {
  IMPROVING: 'Improving',
  STABLE: 'Stable',
  DEGRADING: 'Degrading',
  UNKNOWN: 'Unknown',
};

export const HEALTH_TREND_STYLES: Record<HealthTrend, string> = {
  IMPROVING: 'bg-emerald-500/10 text-emerald-400',
  STABLE: 'bg-sky-500/10 text-sky-400',
  DEGRADING: 'bg-red-500/10 text-red-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400',
};

export function computeHealthTrend(
  incidents: MonitoringIncident[],
  alerts: MonitoringAlert[],
): HealthTrend {
  const resolved = (r: { resolved_at?: string | null; created_at?: string | null }) =>
    r.resolved_at ?? null;
  const opened = (r: { created_at?: string | null }) => r.created_at ?? null;

  const incidentTimes = incidents
    .map((i) => ({ opened: opened(i), resolved: resolved(i) }))
    .filter((x) => x.opened);
  const alertTimes = alerts
    .map((a) => ({ opened: (a.time_detected ?? a.created_at) ?? null, resolved: null }))
    .filter((x) => x.opened);

  const points = [...incidentTimes, ...alertTimes];
  // Need enough history to infer a trend.
  if (points.length < 3) return 'UNKNOWN';

  const now = Date.now();
  const recent = points.filter((p) => now - new Date(p.opened as string).getTime() <= 30 * 24 * 60 * 60 * 1000).length;
  const total = points.length;
  if (total === 0) return 'UNKNOWN';

  // A loose directional signal: more than half of all incidents/alerts occurred
  // in the last 30 days → DEGRADING; a shrinking recent share → IMPROVING.
  const recentShare = recent / total;
  if (recentShare >= 0.6) return 'DEGRADING';
  if (recentShare <= 0.3) return 'IMPROVING';
  return 'STABLE';
}

// ─── Recurring cost review (read-only commercial check) ────────────────────

export interface RecurringCostReview {
  active: RecurringCost[];
  upcomingRenewals: RecurringCost[];
  overdue: CostItem[];
  needsReview: RecurringCost[];
}

export function computeRecurringCostReview(
  recurringCosts: RecurringCost[],
  costItems: CostItem[],
): RecurringCostReview {
  const now = Date.now();
  const in30 = now + 30 * 24 * 60 * 60 * 1000;

  const active = recurringCosts.filter((r) => r.status === 'active');
  const upcomingRenewals = active.filter((r) => {
    if (!r.next_payment_date) return false;
    const t = new Date(r.next_payment_date).getTime();
    return !Number.isNaN(t) && t > now && t <= in30;
  });
  const overdue = costItems.filter(
    (c) =>
      (c.payment_status === 'unpaid' || c.payment_status === 'pending') &&
      c.due_date &&
      new Date(c.due_date).getTime() < now,
  );
  const needsReview = active.filter((r) => !r.auto_renew || r.next_payment_date == null);

  return { active, upcomingRenewals, overdue, needsReview };
}

// ─── Dependency review (read-only) ─────────────────────────────────────────

export type DependencyState = 'CONFIGURED' | 'UNKNOWN' | 'NEEDS_REVIEW';

export const DEPENDENCY_STATE_STYLES: Record<DependencyState, string> = {
  CONFIGURED: 'bg-emerald-500/10 text-emerald-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400',
  NEEDS_REVIEW: 'bg-amber-500/10 text-amber-400',
};

export interface DependencyRow {
  key: string;
  label: string;
  state: DependencyState;
  detail: string | null;
}

export function buildDependencyReview(integration: ProjectIntegration | null): DependencyRow[] {
  const configured = (v: string | null | undefined) => Boolean(v && v.trim() !== '');
  return [
    { key: 'hosting', label: 'Hosting', state: configured(integration?.production_provider) || configured(integration?.production_url) ? 'CONFIGURED' : 'UNKNOWN', detail: integration?.production_provider ?? integration?.production_url ?? null },
    { key: 'supabase', label: 'Supabase', state: configured(integration?.supabase_project_ref) ? 'CONFIGURED' : 'UNKNOWN', detail: integration?.supabase_project_name ?? integration?.supabase_project_ref ?? null },
    { key: 'runtime', label: 'Runtime', state: configured(integration?.runtime_node) ? 'CONFIGURED' : 'UNKNOWN', detail: integration?.runtime_node ?? null },
    { key: 'ai_models', label: 'AI Models', state: 'UNKNOWN', detail: null },
    { key: 'monitoring', label: 'Monitoring', state: configured(integration?.monitoring_provider) ? 'CONFIGURED' : 'UNKNOWN', detail: integration?.monitoring_provider ?? null },
    { key: 'domains', label: 'Domains', state: configured(integration?.dns_provider) || configured(integration?.dns_zone) ? 'CONFIGURED' : 'UNKNOWN', detail: integration?.dns_provider ?? integration?.dns_zone ?? null },
    { key: 'external_services', label: 'External Services', state: 'UNKNOWN', detail: null },
  ];
}

// ─── Security review (read-only placeholder — never claims an audit) ───────

export type SecurityReviewState = 'CLEAR' | 'FINDINGS_OPEN' | 'REVIEW_REQUIRED' | 'UNKNOWN';

export const SECURITY_REVIEW_STYLES: Record<SecurityReviewState, string> = {
  CLEAR: 'bg-emerald-500/10 text-emerald-400',
  FINDINGS_OPEN: 'bg-red-500/10 text-red-400',
  REVIEW_REQUIRED: 'bg-amber-500/10 text-amber-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400',
};

export function deriveSecurityReviewState(
  maintenance: MaintenanceItem[],
  hasSecuritySource: boolean,
): SecurityReviewState {
  // No dedicated security-findings source exists in this scope, so unless a
  // real SECURITY maintenance finding is present, we honestly report UNKNOWN
  // rather than claim an audit has occurred.
  const openSecurity = maintenance.filter(
    (m) =>
      m.maintenance_type === 'SECURITY' &&
      m.status !== 'COMPLETED' &&
      m.status !== 'CANCELLED',
  );
  if (openSecurity.length > 0) return 'FINDINGS_OPEN';
  if (hasSecuritySource) return 'REVIEW_REQUIRED';
  return 'UNKNOWN';
}

// ─── Current release / review snapshot inputs (used by the review workspace) ─

export interface ReviewSnapshotContext {
  project: { project_name: string; launched_at: string | null; status: string };
  integration: ProjectIntegration | null;
  deployments: ProjectDeployment[];
  incidents: MonitoringIncident[];
  alerts: MonitoringAlert[];
  criticalBugs: number;
  supportLoad: { open: number; critical: number };
  budgetPosition: string | null;
  monitoringLabel: string;
  backlogCount: number;
}