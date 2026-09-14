// ============================================================================
// DFP COMMAND 11 — PROJECT ACTIVITY TIMELINE — TYPES + PURE AGGREGATION
// ============================================================================
// Read-time aggregation over internal_activity_log (canonical) plus the
// project's specialist systems. Nothing here persists data — this only
// normalises existing records into a single chronological timeline with clear
// source provenance, so a project's operating history can be reconstructed
// without opening ten separate systems.
import type { ActivityEntry, Bug, ChangeRequest } from './types';
import type { BudgetEvent } from '@/pages/project-budget/types';
import type { ProjectBuildRun } from './buildUtils';
import type { UatData } from './uatTypes';
import type { SupportTicket, TicketEvent } from '@/types/support-tickets';
import type { MonitoringIncident, MonitoringAlert } from './monitoringTypes';
import type { ProjectIntegration } from './infrastructureTypes';

// ─── Display enums ─────────────────────────────────────────────────────────

export type ActivitySource =
  | 'PROJECT'
  | 'BUILD'
  | 'GITHUB'
  | 'READDY'
  | 'INFRASTRUCTURE'
  | 'AI OPS'
  | 'UAT'
  | 'BUGS'
  | 'CHANGES'
  | 'BUDGET'
  | 'SUPPORT'
  | 'MONITORING'
  | 'DEPLOYMENT'
  | 'SYSTEM';

export type ActivityCategory =
  | 'Lifecycle'
  | 'Configuration'
  | 'Development'
  | 'Testing'
  | 'Operations'
  | 'Commercial'
  | 'Incident'
  | 'Approval'
  | 'Security'
  | 'Deployment'
  | 'Support'
  | 'Automation'
  | 'Unknown';

export type ImportanceLevel = 'NORMAL' | 'IMPORTANT' | 'WARNING' | 'CRITICAL';

export const SOURCE_LABELS: Record<ActivitySource, string> = {
  PROJECT: 'Project',
  BUILD: 'Build',
  GITHUB: 'GitHub',
  READDY: 'Readdy',
  INFRASTRUCTURE: 'Infrastructure',
  'AI OPS': 'AI Ops',
  UAT: 'UAT',
  BUGS: 'Bugs',
  CHANGES: 'Changes',
  BUDGET: 'Budget',
  SUPPORT: 'Support',
  MONITORING: 'Monitoring',
  DEPLOYMENT: 'Deployment',
  SYSTEM: 'System',
};

export const SOURCE_STYLES: Record<ActivitySource, string> = {
  PROJECT: 'bg-foreground-500/10 text-foreground-400',
  BUILD: 'bg-accent-500/10 text-accent-400',
  GITHUB: 'bg-foreground-500/10 text-foreground-300',
  READDY: 'bg-secondary-500/10 text-secondary-300',
  INFRASTRUCTURE: 'bg-sky-500/10 text-sky-400',
  'AI OPS': 'bg-violet-500/10 text-violet-400',
  UAT: 'bg-violet-500/10 text-violet-400',
  BUGS: 'bg-red-500/10 text-red-400',
  CHANGES: 'bg-sky-500/10 text-sky-400',
  BUDGET: 'bg-emerald-500/10 text-emerald-400',
  SUPPORT: 'bg-amber-500/10 text-amber-400',
  MONITORING: 'bg-orange-500/10 text-orange-400',
  DEPLOYMENT: 'bg-emerald-500/10 text-emerald-400',
  SYSTEM: 'bg-foreground-500/10 text-foreground-500',
};

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  Lifecycle: 'Lifecycle',
  Configuration: 'Configuration',
  Development: 'Development',
  Testing: 'Testing',
  Operations: 'Operations',
  Commercial: 'Commercial',
  Incident: 'Incident',
  Approval: 'Approval',
  Security: 'Security',
  Deployment: 'Deployment',
  Support: 'Support',
  Automation: 'Automation',
  Unknown: 'Unknown',
};

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  NORMAL: 'Normal',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
};

export const IMPORTANCE_STYLES: Record<ImportanceLevel, string> = {
  NORMAL: 'bg-foreground-500/10 text-foreground-500',
  IMPORTANT: 'bg-sky-500/10 text-sky-400',
  WARNING: 'bg-amber-500/10 text-amber-400',
  CRITICAL: 'bg-red-500/10 text-red-400',
};

// ─── Unified event shape ───────────────────────────────────────────────────

export interface ActivityEvent {
  /** Stable dedupe key across renders. */
  key: string;
  timestamp: string;
  title: string;
  description: string | null;
  source: ActivitySource;
  category: ActivityCategory;
  importance: ImportanceLevel;
  actor: string | null;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
  deepLink: { label: string; to: string } | null;
}

// ─── Timeline aggregation input ────────────────────────────────────────────

export interface ActivityTimelineInput {
  activityEntries: ActivityEntry[];
  budgetEvents: BudgetEvent[];
  buildRuns: ProjectBuildRun[];
  uat: UatData;
  bugs: Bug[];
  changeRequests: ChangeRequest[];
  supportTickets: SupportTicket[];
  supportEvents: TicketEvent[];
  monitoringIncidents: MonitoringIncident[];
  monitoringAlerts: MonitoringAlert[];
  integration: ProjectIntegration | null;
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function toImportance(severity: string | null | undefined): ImportanceLevel {
  const s = (severity || '').toLowerCase();
  if (s === 'critical' || s === 'urgent') return 'CRITICAL';
  if (s === 'high') return 'WARNING';
  if (s === 'medium') return 'IMPORTANT';
  return 'NORMAL';
}

// ─── Action classifier for internal_activity_log ──────────────────────────

function classifyAction(action: string): {
  source: ActivitySource;
  category: ActivityCategory;
  importance: ImportanceLevel;
} {
  const a = action.toLowerCase();
  if (/budget|cost|spend|revenue|profit|payment|invoice|over.?budget|commercial/.test(a)) {
    return { source: 'BUDGET', category: 'Commercial', importance: /over.?budget|exceed/.test(a) ? 'WARNING' : 'NORMAL' };
  }
  if (/uat|test|defect|approval/.test(a)) {
    return { source: 'UAT', category: 'Testing', importance: /approv|reject/.test(a) ? 'IMPORTANT' : 'NORMAL' };
  }
  if (/support|ticket|incident/.test(a)) {
    return { source: 'SUPPORT', category: 'Support', importance: /critical|escalat|incident/.test(a) ? 'CRITICAL' : 'NORMAL' };
  }
  if (/launch|deploy|release/.test(a)) {
    return { source: 'BUILD', category: 'Deployment', importance: 'IMPORTANT' };
  }
  if (/build|checklist|phase|blocker/.test(a)) {
    return { source: 'BUILD', category: 'Development', importance: /blocker/.test(a) ? 'WARNING' : 'NORMAL' };
  }
  if (/bug|defect/.test(a)) {
    return { source: 'BUGS', category: 'Development', importance: /critical/.test(a) ? 'CRITICAL' : 'NORMAL' };
  }
  if (/github|repository|commit|sha|readdy|supabase|infrastructur|monitor/.test(a)) {
    return { source: 'INFRASTRUCTURE', category: 'Configuration', importance: 'NORMAL' };
  }
  if (/ai |agent|runtime|model|automation/.test(a)) {
    return { source: 'AI OPS', category: 'Automation', importance: /critical|offline|fail/.test(a) ? 'WARNING' : 'NORMAL' };
  }
  if (a === 'deleted') return { source: 'PROJECT', category: 'Lifecycle', importance: 'WARNING' };
  if (a === 'archived' || a === 'restored' || a === 'unarchived') return { source: 'PROJECT', category: 'Lifecycle', importance: 'NORMAL' };
  if (a === 'created') return { source: 'PROJECT', category: 'Lifecycle', importance: 'NORMAL' };
  if (a === 'updated') return { source: 'PROJECT', category: 'Configuration', importance: 'NORMAL' };
  return { source: 'PROJECT', category: 'Unknown', importance: 'NORMAL' };
}

// ─── Aggregation ───────────────────────────────────────────────────────────

export function buildActivityTimeline(input: ActivityTimelineInput): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const seen = new Set<string>();
  const push = (e: ActivityEvent) => {
    if (seen.has(e.key)) return;
    seen.add(e.key);
    events.push(e);
  };

  // 1. Canonical activity log.
  for (const entry of input.activityEntries) {
    const c = classifyAction(entry.action);
    push({
      key: `activity-${entry.id}`,
      timestamp: entry.created_at,
      title: entry.description || entry.action,
      description: null,
      source: c.source,
      category: c.category,
      importance: c.importance,
      actor: entry.user_id ? null : 'System',
      relatedObjectType: entry.entity_type || null,
      relatedObjectId: entry.entity_id != null ? String(entry.entity_id) : null,
      deepLink: null,
    });
  }

  // 2. Budget events (real internal_project_budget_events).
  for (const ev of input.budgetEvents) {
    push({
      key: `budget-${ev.id}`,
      timestamp: ev.created_at,
      title: ev.event_title || ev.event_type,
      description: ev.event_description || (ev.amount ? `Amount: £${ev.amount.toLocaleString()}` : null),
      source: 'BUDGET',
      category: 'Commercial',
      importance: /exceed|over.?budget|blocker/.test((ev.event_type || '').toLowerCase()) ? 'WARNING' : 'NORMAL',
      actor: ev.created_by || null,
      relatedObjectType: 'Budget Event',
      relatedObjectId: ev.id != null ? String(ev.id) : null,
      deepLink: { label: 'Open Budget', to: '/project-budget' },
    });
  }

  // 3. Build runs — checklist started / completed only.
  for (const run of input.buildRuns) {
    const startedAt = run.started_at || run.created_at;
    if (startedAt) {
      push({
        key: `build-start-${run.id}`,
        timestamp: startedAt,
        title: `Build checklist started — ${run.run_name || 'Build run'}`,
        description: null,
        source: 'BUILD',
        category: 'Development',
        importance: 'NORMAL',
        actor: run.owner || null,
        relatedObjectType: 'Build Run',
        relatedObjectId: String(run.id),
        deepLink: { label: 'Open Build', to: '/build-process' },
      });
    }
    if (run.completed_at) {
      push({
        key: `build-done-${run.id}`,
        timestamp: run.completed_at,
        title: `Build checklist completed — ${run.run_name || 'Build run'}`,
        description: null,
        source: 'BUILD',
        category: 'Development',
        importance: 'IMPORTANT',
        actor: run.owner || null,
        relatedObjectType: 'Build Run',
        relatedObjectId: String(run.id),
        deepLink: { label: 'Open Build', to: '/build-process' },
      });
    }
  }

  // 4. UAT — jobs (run started), critical defects, approvals.
  for (const job of input.uat.jobs) {
    if (job.created_at) {
      push({
        key: `uat-job-${job.id}`,
        timestamp: job.created_at,
        title: `UAT run started — ${job.title || 'Test run'}`,
        description: null,
        source: 'UAT',
        category: 'Testing',
        importance: 'NORMAL',
        actor: null,
        relatedObjectType: 'UAT Run',
        relatedObjectId: job.id,
        deepLink: { label: 'Open UAT', to: '/admin/website-uat' },
      });
    }
  }
  for (const fb of input.uat.feedback) {
    if ((fb.severity || '').toLowerCase() === 'critical') {
      push({
        key: `uat-crit-${fb.id}`,
        timestamp: fb.created_at,
        title: `Critical defect raised — ${fb.title || 'Defect'}`,
        description: null,
        source: 'UAT',
        category: 'Testing',
        importance: 'CRITICAL',
        actor: fb.tester_name || null,
        relatedObjectType: 'UAT Defect',
        relatedObjectId: fb.id,
        deepLink: { label: 'Open UAT', to: '/admin/website-uat' },
      });
    }
  }
  for (const ap of input.uat.approvals) {
    const when = ap.decided_at || ap.created_at;
    if (!when) continue;
    const approved = ap.status === 'approved';
    const rejected = ap.status === 'rejected';
    if (!approved && !rejected) continue;
    push({
      key: `uat-approval-${ap.id}`,
      timestamp: when,
      title: approved ? 'UAT approved' : 'UAT rejected',
      description: ap.decision_reason || null,
      source: 'UAT',
      category: 'Approval',
      importance: approved ? 'IMPORTANT' : 'WARNING',
      actor: null,
      relatedObjectType: 'UAT Approval',
      relatedObjectId: ap.id,
      deepLink: { label: 'Open UAT', to: '/admin/website-uat' },
    });
  }

  // 5. Bugs — created + resolved.
  for (const b of input.bugs) {
    if (b.created_at) {
      const critical = b.severity === 'critical';
      push({
        key: `bug-created-${b.id}`,
        timestamp: b.created_at,
        title: critical ? `Critical bug created — ${b.title}` : `Bug created — ${b.title}`,
        description: null,
        source: 'BUGS',
        category: 'Development',
        importance: critical ? 'CRITICAL' : toImportance(b.severity),
        actor: b.assigned_to || null,
        relatedObjectType: 'Bug',
        relatedObjectId: String(b.id),
        deepLink: { label: 'Open Bugs', to: '/bugs' },
      });
    }
    if (b.updated_at && ['fixed', 'resolved', 'closed', 'wont_fix', 'duplicate'].includes(b.status)) {
      push({
        key: `bug-resolved-${b.id}`,
        timestamp: b.updated_at,
        title: `Bug resolved — ${b.title}`,
        description: null,
        source: 'BUGS',
        category: 'Development',
        importance: 'NORMAL',
        actor: b.assigned_to || null,
        relatedObjectType: 'Bug',
        relatedObjectId: String(b.id),
        deepLink: { label: 'Open Bugs', to: '/bugs' },
      });
    }
  }

  // 6. Change requests — approved + implemented.
  for (const cr of input.changeRequests) {
    if (cr.created_at) {
      push({
        key: `change-created-${cr.id}`,
        timestamp: cr.created_at,
        title: `Change request created — ${cr.title}`,
        description: null,
        source: 'CHANGES',
        category: 'Development',
        importance: cr.priority === 'critical' || cr.priority === 'high' ? 'IMPORTANT' : 'NORMAL',
        actor: cr.requested_by || null,
        relatedObjectType: 'Change Request',
        relatedObjectId: String(cr.id),
        deepLink: { label: 'Open Changes', to: '/change-requests' },
      });
    }
    if (cr.updated_at && cr.status === 'approved') {
      push({
        key: `change-approved-${cr.id}`,
        timestamp: cr.updated_at,
        title: `Change request approved — ${cr.title}`,
        description: null,
        source: 'CHANGES',
        category: 'Approval',
        importance: 'IMPORTANT',
        actor: null,
        relatedObjectType: 'Change Request',
        relatedObjectId: String(cr.id),
        deepLink: { label: 'Open Changes', to: '/change-requests' },
      });
    }
    if (cr.updated_at && cr.status === 'completed') {
      push({
        key: `change-implemented-${cr.id}`,
        timestamp: cr.updated_at,
        title: `Change implemented — ${cr.title}`,
        description: null,
        source: 'CHANGES',
        category: 'Development',
        importance: 'IMPORTANT',
        actor: null,
        relatedObjectType: 'Change Request',
        relatedObjectId: String(cr.id),
        deepLink: { label: 'Open Changes', to: '/change-requests' },
      });
    }
  }

  // 7. Support tickets — critical opened, escalated, resolved.
  for (const t of input.supportTickets) {
    if (t.created_at && t.priority === 'critical') {
      push({
        key: `ticket-critical-${t.id}`,
        timestamp: t.created_at,
        title: `Critical ticket opened — ${t.subject}`,
        description: null,
        source: 'SUPPORT',
        category: 'Incident',
        importance: 'CRITICAL',
        actor: t.customer_name || null,
        relatedObjectType: 'Support Ticket',
        relatedObjectId: t.id,
        deepLink: { label: 'Open Ticket', to: `/support-tickets/${t.id}` },
      });
    }
    if (t.resolved_at) {
      push({
        key: `ticket-resolved-${t.id}`,
        timestamp: t.resolved_at,
        title: `Ticket resolved — ${t.subject}`,
        description: null,
        source: 'SUPPORT',
        category: 'Support',
        importance: 'NORMAL',
        actor: t.assigned_to || null,
        relatedObjectType: 'Support Ticket',
        relatedObjectId: t.id,
        deepLink: { label: 'Open Ticket', to: `/support-tickets/${t.id}` },
      });
    }
  }
  // Support event stream — escalation is the headline event.
  for (const ev of input.supportEvents) {
    const type = (ev.event_type || '').toLowerCase();
    if (/escalat/.test(type) || /bug|change|incident/.test(ev.description || '')) {
      push({
        key: `ticket-event-${ev.id}`,
        timestamp: ev.created_at,
        title: ev.description || ev.event_type,
        description: null,
        source: 'SUPPORT',
        category: 'Support',
        importance: /escalat/.test(type) ? 'WARNING' : 'NORMAL',
        actor: ev.actor_type || null,
        relatedObjectType: 'Support Ticket',
        relatedObjectId: ev.ticket_id,
        deepLink: ev.ticket_id ? { label: 'Open Ticket', to: `/support-tickets/${ev.ticket_id}` } : null,
      });
    }
  }

  // 8. Monitoring — incidents + alerts (opened + resolved transitions).
  for (const inc of input.monitoringIncidents) {
    if (inc.created_at) {
      push({
        key: `incident-open-${inc.id}`,
        timestamp: inc.created_at,
        title: `Incident opened — ${inc.incident_title}`,
        description: inc.summary || null,
        source: 'MONITORING',
        category: 'Incident',
        importance: toImportance(inc.severity),
        actor: 'Monitoring Service',
        relatedObjectType: 'Incident',
        relatedObjectId: String(inc.id),
        deepLink: { label: 'Open Monitoring', to: '/system-status' },
      });
    }
    if (inc.resolved_at) {
      push({
        key: `incident-resolved-${inc.id}`,
        timestamp: inc.resolved_at,
        title: `Incident resolved — ${inc.incident_title}`,
        description: null,
        source: 'MONITORING',
        category: 'Incident',
        importance: 'IMPORTANT',
        actor: 'Monitoring Service',
        relatedObjectType: 'Incident',
        relatedObjectId: String(inc.id),
        deepLink: { label: 'Open Monitoring', to: '/system-status' },
      });
    }
  }
  for (const al of input.monitoringAlerts) {
    const when = al.time_detected || al.created_at;
    if (when) {
      push({
        key: `alert-${al.id}`,
        timestamp: when,
        title: `Critical alert — ${al.alert_title}`,
        description: al.notes || null,
        source: 'MONITORING',
        category: 'Incident',
        importance: toImportance(al.severity),
        actor: al.source || 'Monitoring Service',
        relatedObjectType: 'Alert',
        relatedObjectId: String(al.id),
        deepLink: { label: 'Open Monitoring', to: '/system-status' },
      });
    }
  }

  // 9. Integration / configuration records (no fabricated timestamps).
  if (input.integration) {
    const when = input.integration.updated_at || input.integration.created_at;
    if (input.integration.github_repository && when) {
      push({
        key: 'integration-github',
        timestamp: when,
        title: `GitHub repository configured — ${input.integration.github_repository}`,
        description: null,
        source: 'GITHUB',
        category: 'Configuration',
        importance: 'NORMAL',
        actor: null,
        relatedObjectType: 'Repository',
        relatedObjectId: input.integration.github_repository,
        deepLink: { label: 'Open GitHub', to: '/github' },
      });
    }
    if (input.integration.readdy_project_id && when) {
      push({
        key: 'integration-readdy',
        timestamp: when,
        title: 'Readdy project configured',
        description: null,
        source: 'READDY',
        category: 'Configuration',
        importance: 'NORMAL',
        actor: null,
        relatedObjectType: 'Readdy Project',
        relatedObjectId: input.integration.readdy_project_id,
        deepLink: null,
      });
    }
    if (input.integration.monitoring_provider && when) {
      push({
        key: 'integration-monitoring',
        timestamp: when,
        title: `Monitoring configured — ${input.integration.monitoring_provider}`,
        description: null,
        source: 'MONITORING',
        category: 'Configuration',
        importance: 'NORMAL',
        actor: null,
        relatedObjectType: 'Monitoring',
        relatedObjectId: input.integration.monitoring_target || null,
        deepLink: { label: 'Open Monitoring', to: '/system-status' },
      });
    }
  }

  // Newest first.
  return events.sort((a, b) => ts(b.timestamp) - ts(a.timestamp));
}

// ─── Lifecycle milestones (honest, data-backed only) ──────────────────────

export interface LifecycleMilestone {
  key: string;
  label: string;
  reached: boolean;
  timestamp: string | null;
}

export function computeLifecycleMilestones(input: {
  projectCreatedAt: string | null;
  launchedAt: string | null;
  isLive: boolean;
  buildRuns: ProjectBuildRun[];
  uat: UatData;
  monitoringConfigured: boolean;
}): LifecycleMilestone[] {
  const firstBuild = input.buildRuns
    .map((r) => r.started_at || r.created_at)
    .filter(Boolean)
    .sort((a, b) => ts(a) - ts(b))[0] ?? null;
  const firstUat = input.uat.jobs
    .map((j) => j.created_at)
    .filter(Boolean)
    .sort((a, b) => ts(a) - ts(b))[0] ?? null;
  const approval = input.uat.approvals.find((a) => a.status === 'approved');

  return [
    { key: 'created', label: 'Project Created', reached: Boolean(input.projectCreatedAt), timestamp: input.projectCreatedAt },
    { key: 'build', label: 'Build Started', reached: Boolean(firstBuild), timestamp: firstBuild },
    { key: 'uat', label: 'UAT Started', reached: Boolean(firstUat), timestamp: firstUat },
    { key: 'approved', label: 'Approved', reached: Boolean(approval), timestamp: approval ? approval.decided_at || approval.created_at : null },
    { key: 'live', label: 'Live', reached: input.isLive, timestamp: input.launchedAt },
    { key: 'ops', label: 'Operations', reached: input.monitoringConfigured, timestamp: null },
  ];
}

// ─── Filters / search / export (presentation only) ────────────────────────

export type SourceFilter = 'ALL' | ActivitySource | 'CRITICAL';

export const SOURCE_FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'ALL', label: 'All Activity' },
  { value: 'PROJECT', label: 'Lifecycle' },
  { value: 'BUILD', label: 'Build' },
  { value: 'GITHUB', label: 'GitHub / Readdy' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
  { value: 'AI OPS', label: 'AI Ops' },
  { value: 'UAT', label: 'UAT' },
  { value: 'BUGS', label: 'Bugs & Changes' },
  { value: 'BUDGET', label: 'Budget' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'MONITORING', label: 'Monitoring' },
  { value: 'CRITICAL', label: 'Critical Only' },
];

export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

export function applyActivityFilters(
  events: ActivityEvent[],
  opts: { source: SourceFilter; timeRange: TimeRange; search: string },
): ActivityEvent[] {
  const now = Date.now();
  const days: Record<TimeRange, number | null> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    all: null,
  };
  const cutoff = days[opts.timeRange];

  const q = opts.search.trim().toLowerCase();

  return events.filter((e) => {
    if (opts.source === 'CRITICAL' && e.importance !== 'CRITICAL') return false;
    if (opts.source !== 'ALL' && opts.source !== 'CRITICAL' && e.source !== opts.source) return false;
    if (cutoff != null) {
      const t = ts(e.timestamp);
      if (t === 0) return false;
      if (now - t > cutoff * 24 * 60 * 60 * 1000) return false;
    }
    if (q) {
      const haystack = [
        e.title,
        e.description || '',
        e.actor || '',
        e.source,
        e.relatedObjectId || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function activityToCsv(events: ActivityEvent[]): string {
  const header = [
    'timestamp',
    'source',
    'category',
    'importance',
    'title',
    'description',
    'actor',
    'related_object_type',
    'related_object_id',
  ];
  const escape = (v: string | null | undefined): string => {
    const s = (v ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };
  const rows = events.map((e) =>
    [
      e.timestamp,
      e.source,
      e.category,
      e.importance,
      e.title,
      e.description ?? '',
      e.actor ?? '',
      e.relatedObjectType ?? '',
      e.relatedObjectId ?? '',
    ]
      .map(escape)
      .join(','),
  );
  return [header.map(escape).join(','), ...rows].join('\n');
}