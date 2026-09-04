// ============================================================================
// AI Operations — Wallboard Daily Command Briefing selectors.
//
// A pure, DETERMINISTIC summary layer over the EXISTING Wallboard 19–30
// sources. No new data is queried, no new store exists, no polling is added,
// and no AI narrative service is used. Every line is a templated reformatting
// of an authoritative selector already wired into the wallboard.
//
// Honesty rules honoured here:
//   * "All systems normal" is never claimed when any required source is
//     unavailable — a partial/unavailable source is stated explicitly.
//   * Attention items reuse the SAME authoritative states that already feed
//     Wallboard 22 Incident Mode (plus the non-incident signals: backup STALE,
//     overdue projects, urgent tickets, UAT/approval backlog). Critical items
//     are intentionally excluded here because Incident Mode overrides this
//     view when a CRITICAL incident exists.
//   * "Recent changes" are derived ONLY from the existing audit-event history
//     (occurred_at since yesterday, Europe/London) and the lead registry — no
//     change is inferred without historical evidence.
//   * The reporting day is the current UK calendar day (Europe/London).
//   * No customer identity, staff data, email, ticket content, or financial
//     transaction detail is surfaced — aggregate operational figures only.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getSitesServicesSummary } from '@/pages/ai-operations/wallboard/siteSelectors';
import { getInfrastructureSummary } from '@/pages/ai-operations/wallboard/infrastructureSelectors';
import { getBackupSummary } from '@/pages/ai-operations/wallboard/backupSelectors';
import { getPowerSummary } from '@/pages/ai-operations/wallboard/powerSelectors';
import { getSecuritySummary } from '@/pages/ai-operations/wallboard/securitySelectors';
import {
  getBusinessKpis,
  type BusinessKpi,
  type BusinessKpiGroup,
} from '@/pages/ai-operations/wallboard/businessSelectors';
import { getWorkloadSummary } from '@/pages/ai-operations/wallboard/workloadSelectors';
import { getUsersOnline, getWallboardIncidents } from '@/pages/ai-operations/wallboard/selectors';
import { getBusinessData } from '@/pages/ai-operations/wallboard/businessStore';

// --- Tones & status ----------------------------------------------------------

export type BriefingTone = 'emerald' | 'amber' | 'red' | 'secondary';
export type BriefingStatus = 'live' | 'partial' | 'unavailable';

// --- Europe/London date helpers ---------------------------------------------

function londonParts(date: Date, types: Intl.DateTimeFormatPartTypes[]): Record<string, string> {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return p;
}

/** e.g. "THURSDAY 03 SEPTEMBER 2026" — the current UK calendar day. */
export function getBriefingDateLabel(now: Date = new Date()): string {
  const p = londonParts(now, []);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`.toUpperCase();
}

function londonOffsetMs(date: Date): number {
  const p = londonParts(date, []);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month === undefined ? 0 : monthIndex(p.month)),
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

function monthIndex(monthName: string): number {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const idx = months.indexOf(monthName);
  return idx >= 0 ? idx : 0;
}

function startOfYesterdayLondon(now: Date): number {
  const yesterday = new Date(now.getTime() - 86_400_000);
  const p = londonParts(yesterday, []);
  const utcGuess = Date.UTC(Number(p.year), monthIndex(p.month), Number(p.day), 0, 0, 0);
  return utcGuess - londonOffsetMs(new Date(utcGuess));
}

// --- Model -------------------------------------------------------------------

export interface SystemLine {
  key: string;
  label: string;
  detail: string;
  tone: BriefingTone;
  status: BriefingStatus;
}

export interface BusinessFigure {
  label: string;
  value: string | number | null;
  status: BriefingStatus;
  icon: string;
}

export interface OperationFigure {
  label: string;
  value: number | null;
  status: BriefingStatus;
  tone: BriefingTone;
}

export interface AttentionItem {
  key: string;
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'attention';
}

export interface RecentChange {
  key: string;
  time: string;
  text: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export interface DailyBriefing {
  dateLabel: string;
  sourceState: BriefingStatus;
  headline: string;
  headlineTone: BriefingTone;

  systems: SystemLine[];
  business: BusinessFigure[];
  operations: OperationFigure[];
  attention: AttentionItem[];
  hasAttention: boolean;
  recentChanges: RecentChange[];
  hasRecentChanges: boolean;

  usersOnlineTotal: number | null;
}

// --- Business KPI helpers ----------------------------------------------------

function findKpi(groups: BusinessKpiGroup[], groupTitle: string, label: string): BusinessKpi | undefined {
  return groups.find((g) => g.title === groupTitle)?.kpis.find((k) => k.label === label);
}

function kpiNumber(k: BusinessKpi | undefined): number | null {
  if (!k || k.status !== 'live' || typeof k.value !== 'number') return null;
  return k.value;
}

function kpiText(k: BusinessKpi | undefined): string | null {
  if (!k || k.status !== 'live') return null;
  return String(k.value);
}

// --- Tone / status normalisation --------------------------------------------

function normTone(t: string | undefined): BriefingTone {
  return (t as BriefingTone) ?? 'secondary';
}

function toStatus(s: string | undefined): BriefingStatus {
  if (s === 'live') return 'live';
  if (s === 'partial') return 'partial';
  return 'unavailable';
}

// --- The briefing ------------------------------------------------------------

export function getDailyBriefing(): DailyBriefing {
  const now = new Date();
  const data = getGroupLiveData();

  const sites = getSitesServicesSummary();
  const infra = getInfrastructureSummary();
  const backup = getBackupSummary();
  const power = getPowerSummary();
  const security = getSecuritySummary();
  const workload = getWorkloadSummary();
  const businessKpis = getBusinessKpis();
  const usersOnline = getUsersOnline();
  const incidents = getWallboardIncidents();
  const business = getBusinessData();

  // --- SYSTEMS ---------------------------------------------------------------
  const systems: SystemLine[] = [
    {
      key: 'sites',
      label: 'SITES',
      detail: sites.sourceState === 'unavailable' ? 'Site registry unavailable.' : `${sites.online}/${sites.total} online · ${sites.degraded} degraded · ${sites.offline} offline`,
      tone: normTone(sites.tone),
      status: toStatus(sites.sourceState),
    },
    {
      key: 'infrastructure',
      label: 'INFRASTRUCTURE',
      detail: infra.sourceState === 'unavailable' ? 'Infrastructure source unavailable.' : `${infra.healthy} healthy · ${infra.degraded} degraded · ${infra.offline} offline`,
      tone: infra.offline > 0 ? 'red' : infra.degraded > 0 ? 'amber' : 'emerald',
      status: toStatus(infra.sourceState),
    },
    {
      key: 'backup',
      label: 'BACKUPS',
      detail: backup.sourceState === 'unavailable' ? 'Backup source unavailable.' : backup.detail,
      tone: normTone(backup.tone),
      status: toStatus(backup.sourceState),
    },
    {
      key: 'power',
      label: 'POWER',
      detail: power.sourceStatus === 'not_connected' ? 'Power monitoring not connected.' : power.sourceStatus === 'unavailable' ? 'Power source unavailable.' : power.detail,
      tone: power.sourceStatus === 'live' ? normTone(power.tone) : 'secondary',
      status: power.sourceStatus === 'live' ? 'live' : 'unavailable',
    },
    {
      key: 'security',
      label: 'SECURITY',
      detail: security.sourceState === 'unavailable' ? 'Security source unavailable.' : security.detail,
      tone: normTone(security.tone),
      status: toStatus(security.sourceState),
    },
  ];

  // --- BUSINESS --------------------------------------------------------------
  const newLeadsToday = kpiNumber(findKpi(businessKpis.groups, 'Sales', 'New Leads Today'));
  const revenueMonth = kpiText(findKpi(businessKpis.groups, 'Revenue', 'Revenue This Month'));
  const activeProjects = kpiNumber(findKpi(businessKpis.groups, 'Delivery', 'Active Projects'));
  const outstanding = kpiText(findKpi(businessKpis.groups, 'Revenue', 'Outstanding'));

  const businessFigures: BusinessFigure[] = [
    { label: 'New Leads Today', value: newLeadsToday, status: business.availability.leads ? 'live' : 'unavailable', icon: 'ri-user-add-line' },
    { label: 'Revenue This Month', value: revenueMonth, status: business.availability.invoices && business.availability.checkout ? 'live' : 'unavailable', icon: 'ri-money-pound-circle-line' },
    { label: 'Active Projects', value: activeProjects, status: business.availability.projects ? 'live' : 'unavailable', icon: 'ri-rocket-2-line' },
    { label: 'Outstanding', value: outstanding, status: business.availability.invoices && business.availability.checkout ? 'live' : 'unavailable', icon: 'ri-time-line' },
  ];

  // --- OPERATIONS ------------------------------------------------------------
  const operations: OperationFigure[] = [
    { label: 'Open Tickets', value: workload.ticketsStatus === 'unavailable' ? null : workload.openTickets, status: workload.ticketsStatus, tone: 'secondary' },
    { label: 'Urgent', value: workload.ticketsStatus === 'unavailable' ? null : workload.urgentTickets, status: workload.ticketsStatus, tone: workload.urgentTickets > 0 ? 'amber' : 'secondary' },
    { label: 'UAT Awaiting', value: workload.uatStatus === 'unavailable' ? null : workload.uatAwaitingApproval, status: workload.uatStatus, tone: workload.uatAwaitingApproval > 0 ? 'amber' : 'secondary' },
    { label: 'Pending Approvals', value: workload.approvalsStatus === 'unavailable' ? null : workload.pendingApprovals, status: workload.approvalsStatus, tone: workload.pendingApprovals > 0 ? 'amber' : 'secondary' },
    { label: 'AI Tasks Running', value: workload.aiStatus === 'unavailable' ? null : workload.runningTasks, status: workload.aiStatus, tone: 'emerald' },
    { label: 'Failed AI Tasks', value: workload.aiStatus === 'unavailable' ? null : workload.failedTasks, status: workload.aiStatus, tone: workload.failedTasks > 0 ? 'red' : 'secondary' },
  ];

  // --- ATTENTION REQUIRED (prioritised, non-critical actionable) -------------
  const attention: AttentionItem[] = [];

  // 1. High incidents (critical are overridden by Incident Mode).
  const highIncidents = incidents.incidents.filter((i) => i.severity === 'high').slice(0, 3);
  for (const i of highIncidents) {
    attention.push({
      key: `incident-${i.id}`,
      label: i.title,
      detail: `${i.sourceLabel} · ${i.affectedService}`,
      severity: 'high',
    });
  }

  // 3. Backup / security risks (non-incident signals).
  if (backup.sourceState !== 'unavailable' && backup.stale > 0) {
    attention.push({
      key: 'backup-stale',
      label: `${backup.stale} backup target${backup.stale > 1 ? 's' : ''} stale`,
      detail: backup.detail,
      severity: 'high',
    });
  }
  if (security.sourceState !== 'unavailable' && security.connectionsDegraded > 0) {
    attention.push({
      key: 'security-degraded',
      label: `${security.connectionsDegraded} service connection${security.connectionsDegraded > 1 ? 's' : ''} degraded`,
      detail: security.detail,
      severity: 'attention',
    });
  }

  // 4. Blocked / overdue projects.
  if (workload.projectsStatus !== 'unavailable' && workload.overdueProjects > 0) {
    attention.push({
      key: 'overdue-projects',
      label: `${workload.overdueProjects} overdue project${workload.overdueProjects > 1 ? 's' : ''}`,
      detail: 'Target launch date has passed.',
      severity: 'attention',
    });
  }

  // 5. Urgent support.
  if (workload.ticketsStatus !== 'unavailable' && workload.urgentTickets > 0) {
    attention.push({
      key: 'urgent-tickets',
      label: `${workload.urgentTickets} urgent ticket${workload.urgentTickets > 1 ? 's' : ''}`,
      detail: 'Unresolved urgent support.',
      severity: 'high',
    });
  }

  // 6. UAT / approval backlog.
  if (workload.uatStatus !== 'unavailable' && workload.uatAwaitingApproval > 0) {
    attention.push({
      key: 'uat-awaiting',
      label: `${workload.uatAwaitingApproval} UAT awaiting approval`,
      detail: 'Tester work submitted for review.',
      severity: 'attention',
    });
  }
  if (workload.approvalsStatus !== 'unavailable' && workload.pendingApprovals > 0) {
    attention.push({
      key: 'pending-approvals',
      label: `${workload.pendingApprovals} approval${workload.pendingApprovals > 1 ? 's' : ''} pending`,
      detail: `${workload.highPriorityApprovals} high-priority`,
      severity: 'attention',
    });
  }

  // --- RECENT CHANGES (since yesterday, Europe/London) -----------------------
  const yesterdayStart = startOfYesterdayLondon(now);
  const recentChanges: RecentChange[] = [];

  // New leads since yesterday (authoritative lead registry).
  if (business.availability.leads) {
    const newLeads = business.leads.filter(
      (l) => l.created_at && new Date(l.created_at).getTime() >= yesterdayStart,
    ).length;
    if (newLeads > 0) {
      recentChanges.push({
        key: 'new-leads',
        time: 'today',
        text: `${newLeads} new lead${newLeads > 1 ? 's' : ''} received since yesterday`,
        tone: 'emerald',
      });
    }
  }

  // Audit events since yesterday (the authoritative "what changed" history).
  const auditSince = data.auditEvents
    .filter((e) => e.occurred_at && new Date(e.occurred_at).getTime() >= yesterdayStart)
    .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))
    .slice(0, 5);

  for (const e of auditSince) {
    const site = e.site_id ? (data.siteNameByUuid.get(e.site_id) ?? 'Group-wide') : 'Group-wide';
    const action = e.action ?? e.event_type ?? 'Audit event';
    const t = e.occurred_at ? new Date(e.occurred_at) : null;
    const time = t && !Number.isNaN(t.getTime())
      ? t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '—';
    const tone: RecentChange['tone'] =
      e.outcome === 'failed' || e.outcome === 'blocked' ? 'red' : e.outcome === 'success' || e.outcome === 'approved' ? 'emerald' : 'secondary';
    recentChanges.push({
      key: `audit-${e.audit_key}`,
      time,
      text: `${site} · ${action}`,
      tone,
    });
  }

  // --- HEADLINE (deterministic, honest) --------------------------------------
  const systemsUnavailable = systems.some((s) => s.status === 'unavailable');
  const anyAttention = attention.length > 0;

  let headline: string;
  let headlineTone: BriefingTone;

  if (data.mode === 'unavailable') {
    headline = 'Monitoring sources unavailable — no briefing can be produced.';
    headlineTone = 'secondary';
  } else if (anyAttention) {
    const count = attention.length;
    headline = `${count} item${count > 1 ? 's' : ''} require attention — ${attention[0].label}.`;
    headlineTone = 'amber';
  } else if (systemsUnavailable) {
    headline = 'Most systems healthy, but some monitoring sources are unavailable.';
    headlineTone = 'secondary';
  } else {
    headline = 'No critical issues. All monitored services healthy. No urgent approvals or blockers.';
    headlineTone = 'emerald';
  }

  // --- Overall source state --------------------------------------------------
  const anyPartial = systems.some((s) => s.status === 'partial');
  const sourceState: BriefingStatus = data.mode === 'unavailable'
    ? 'unavailable'
    : systemsUnavailable
      ? 'partial'
      : anyPartial
        ? 'partial'
        : 'live';

  return {
    dateLabel: getBriefingDateLabel(now),
    sourceState,
    headline,
    headlineTone,
    systems,
    business: businessFigures,
    operations,
    attention,
    hasAttention: anyAttention,
    recentChanges,
    hasRecentChanges: recentChanges.length > 0,
    usersOnlineTotal: usersOnline.total,
  };
}