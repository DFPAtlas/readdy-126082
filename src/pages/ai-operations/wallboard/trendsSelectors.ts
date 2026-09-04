// ============================================================================
// AI Operations — Wallboard Trends & Historical Context selectors.
//
// A lightweight, DETERMINISTIC historical-context layer over the EXISTING
// wallboard stores (businessStore, workloadStore, the shared group live-data
// snapshot, and backupStore). This is deliberately NOT an analytics platform
// and NOT a data warehouse: every trend is recomputed client-side from full
// timestamped lists the stores already load on the normal 30s refresh. No new
// query, no new table, no new polling, no AI, no synthetic history.
//
// Honesty rules honoured here:
//   * A trend is only shown when the underlying source has at least two
//     timestamped records (enough to form a real "current vs previous"
//     comparison). One isolated point is reported "insufficient history".
//   * UNKNOWN / UNAVAILABLE is never converted to 0, and 0 is never converted
//     to "no data": a successful-but-empty source is a genuine zero (stable),
//     while a failed source is "unavailable".
//   * Direction has metric-specific meaning — increasing revenue is positive,
//     increasing failed runs / incidents / alerts / tickets is negative.
//   * Periods use Europe/London day/week/month boundaries.
//   * No customer/staff identity, ticket content, or transaction detail is
//     ever surfaced — aggregate counts and totals only.
// ============================================================================

import { getBusinessData, type BusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { getWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import { getBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

// --- Types -------------------------------------------------------------------

export type TrendStatus = 'live' | 'unavailable' | 'insufficient';
export type TrendDirection = 'up' | 'down' | 'flat';
export type TrendVerdict = 'improving' | 'worsening' | 'stable' | 'unavailable';
export type TrendPolarity = 'positive' | 'negative';

export interface TrendMetric {
  key: string;
  label: string;
  periodLabel: string;
  current: number | null;
  previous: number | null;
  currentDisplay: string;
  previousDisplay: string;
  direction: TrendDirection | null;
  verdict: TrendVerdict;
  status: TrendStatus;
  polarity: TrendPolarity;
  icon: string;
  /** Daily counts (oldest→newest) for the last 7 days, or null if not charted. */
  series: number[] | null;
}

export interface TrendSection {
  title: string;
  icon: string;
  metrics: TrendMetric[];
}

export interface IncidentContext {
  today: number | null;
  week: number | null;
  mttrHours: number | null;
  mttrCount: number;
}

export interface SparklineSeries {
  key: string;
  label: string;
  tone: 'emerald' | 'red' | 'amber' | 'accent';
  series: number[];
  dayLabels: string[];
}

export interface WallboardTrends {
  sourceState: 'live' | 'partial' | 'unavailable';
  periodNote: string;
  sections: TrendSection[];
  incidents: IncidentContext;
  sparklines: SparklineSeries[];
  hasAnyData: boolean;
}

// --- Europe/London time helpers ---------------------------------------------

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface LondonDate {
  y: number;
  m: number;
  d: number;
  dow: number;
}

function londonParts(date: Date): LondonDate {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    dow: WEEKDAYS.indexOf(p.weekday),
  };
}

function londonOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

function startOfLondonDay(y: number, m: number, d: number): number {
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  return utcGuess - londonOffsetMs(new Date(utcGuess));
}

interface Boundaries {
  todayStart: number;
  yesterdayStart: number;
  thisWeekStart: number;
  lastWeekStart: number;
  monthStart: number;
  lastMonthStart: number;
}

function computeBoundaries(now: Date): Boundaries {
  const p = londonParts(now);
  const todayStart = startOfLondonDay(p.y, p.m, p.d);

  const yp = londonParts(new Date(now.getTime() - DAY_MS));
  const yesterdayStart = startOfLondonDay(yp.y, yp.m, yp.d);

  // Weeks start on Monday.
  const daysSinceMonday = (p.dow + 6) % 7;
  const thisWeekStart = todayStart - daysSinceMonday * DAY_MS;
  const lastWeekStart = thisWeekStart - 7 * DAY_MS;

  const monthStart = startOfLondonDay(p.y, p.m, 1);
  const lmp = londonParts(new Date(Date.UTC(p.y, p.m - 2, 15)));
  const lastMonthStart = startOfLondonDay(lmp.y, lmp.m, 1);

  return { todayStart, yesterdayStart, thisWeekStart, lastWeekStart, monthStart, lastMonthStart };
}

// --- Counting helpers --------------------------------------------------------

function ts(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  return Number.isNaN(d) ? null : d;
}

function countBetween(timestamps: (string | null | undefined)[], start: number, end: number): number {
  let n = 0;
  for (const iso of timestamps) {
    const t = ts(iso);
    if (t != null && t >= start && t < end) n += 1;
  }
  return n;
}

/** Daily buckets (oldest→newest) over `days` days ending today (inclusive). */
function dailySeries(timestamps: (string | null | undefined)[], todayStart: number, days: number): number[] {
  const out = new Array(days).fill(0);
  for (const iso of timestamps) {
    const t = ts(iso);
    if (t == null) continue;
    const dayIdx = Math.floor((t - todayStart) / DAY_MS);
    const idx = days - 1 + dayIdx;
    if (idx >= 0 && idx < days) out[idx] += 1;
  }
  return out;
}

function dayLabels(todayStart: number, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(WEEKDAYS[londonParts(new Date(todayStart - i * DAY_MS)).dow]);
  }
  return out;
}

// --- Direction / verdict -----------------------------------------------------

function compare(current: number, previous: number, polarity: TrendPolarity): { direction: TrendDirection; verdict: TrendVerdict } {
  if (current > previous) {
    return { direction: 'up', verdict: polarity === 'negative' ? 'worsening' : 'improving' };
  }
  if (current < previous) {
    return { direction: 'down', verdict: polarity === 'negative' ? 'improving' : 'worsening' };
  }
  return { direction: 'flat', verdict: 'stable' };
}

// --- Money -------------------------------------------------------------------

const gbpFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const CHECKOUT_PAID = ['paid', 'succeeded', 'complete', 'completed', 'captured'];

function isGbp(currency: string | null | undefined): boolean {
  return (currency ?? '').toLowerCase() === 'gbp';
}

// --- Metric builder ----------------------------------------------------------

interface MetricInput {
  key: string;
  label: string;
  periodLabel: string;
  icon: string;
  polarity: TrendPolarity;
  available: boolean;
  current: number;
  previous: number;
  total: number;
  format?: (n: number) => string;
  series?: number[] | null;
}

function buildMetric(input: MetricInput): TrendMetric {
  const fmt = input.format ?? ((n: number) => String(n));
  let status: TrendStatus;
  if (!input.available) status = 'unavailable';
  else if (input.total < 2) status = 'insufficient';
  else status = 'live';

  const canCompare = status === 'live';
  const cmp = canCompare
    ? compare(input.current, input.previous, input.polarity)
    : { direction: null as TrendDirection | null, verdict: 'unavailable' as TrendVerdict };

  return {
    key: input.key,
    label: input.label,
    periodLabel: input.periodLabel,
    current: canCompare ? input.current : null,
    previous: canCompare ? input.previous : null,
    currentDisplay: canCompare ? fmt(input.current) : '—',
    previousDisplay: canCompare ? fmt(input.previous) : '—',
    direction: cmp.direction,
    verdict: cmp.verdict,
    status,
    polarity: input.polarity,
    icon: input.icon,
    series: input.series ?? null,
  };
}

// --- The trends derivation ---------------------------------------------------

export function getWallboardTrends(): WallboardTrends {
  const now = new Date();
  const b = computeBoundaries(now);

  const data = getGroupLiveData();
  const business = getBusinessData();
  const workload = getWorkloadData();
  const backup = getBackupData();

  // ---- BUSINESS -------------------------------------------------------------
  const leadsTimestamps = business.leads.map((l) => l.created_at);
  const leadsToday = countBetween(leadsTimestamps, b.todayStart, now.getTime());
  const leadsYesterday = countBetween(leadsTimestamps, b.yesterdayStart, b.todayStart);
  const leadsSeries = dailySeries(leadsTimestamps, b.todayStart, 7);

  // Revenue (GBP paid only) across month boundaries.
  const paidInvoiceRows = business.invoices.filter(
    (i) => isGbp(i.currency) && !i.archived_at && !i.cancelled_at && !i.written_off_at && i.paid_at,
  );
  const paidCheckoutRows = business.checkout.filter(
    (o) => isGbp(o.currency) && CHECKOUT_PAID.includes((o.payment_status ?? '').toLowerCase()),
  );

  let revenueMonth = 0;
  let revenueLastMonth = 0;
  for (const i of paidInvoiceRows) {
    const t = ts(i.paid_at);
    if (t == null) continue;
    const amt = i.amount_paid ?? 0;
    if (t >= b.monthStart) revenueMonth += amt;
    else if (t >= b.lastMonthStart && t < b.monthStart) revenueLastMonth += amt;
  }
  for (const o of paidCheckoutRows) {
    const t = ts(o.created_at);
    if (t == null) continue;
    const amt = (o.starting_payment_minor ?? 0) / 100;
    if (t >= b.monthStart) revenueMonth += amt;
    else if (t >= b.lastMonthStart && t < b.monthStart) revenueLastMonth += amt;
  }
  const revenueTotalTxns = paidInvoiceRows.length + paidCheckoutRows.length;

  const projectTimestamps = business.projects.map((p) => p.created_at);
  const projectsWeek = countBetween(projectTimestamps, b.thisWeekStart, now.getTime());
  const projectsLastWeek = countBetween(projectTimestamps, b.lastWeekStart, b.thisWeekStart);

  // ---- OPERATIONS -----------------------------------------------------------
  const ticketTimestamps = workload.tickets.map((t) => t.created_at);
  const ticketsToday = countBetween(ticketTimestamps, b.todayStart, now.getTime());
  const ticketsYesterday = countBetween(ticketTimestamps, b.yesterdayStart, b.todayStart);
  const ticketsSeries = dailySeries(ticketTimestamps, b.todayStart, 7);

  const completedRunTimestamps = data.runs
    .filter((r) => r.status === 'completed')
    .map((r) => r.completed_at ?? r.updated_at);
  const completedToday = countBetween(completedRunTimestamps, b.todayStart, now.getTime());
  const completedYesterday = countBetween(completedRunTimestamps, b.yesterdayStart, b.todayStart);
  const completedSeries = dailySeries(completedRunTimestamps, b.todayStart, 7);

  const failedRunTimestamps = data.runs
    .filter((r) => ['failed', 'blocked'].includes(r.status))
    .map((r) => r.completed_at ?? r.updated_at);
  const failedWeek = countBetween(failedRunTimestamps, b.thisWeekStart, now.getTime());
  const failedLastWeek = countBetween(failedRunTimestamps, b.lastWeekStart, b.thisWeekStart);
  const failedSeries = dailySeries(failedRunTimestamps, b.todayStart, 7);

  const uatSubmissionTimestamps = workload.uatAssignments
    .map((x) => x.submitted_at)
    .filter((v): v is string => v != null);
  const uatWeek = countBetween(uatSubmissionTimestamps, b.thisWeekStart, now.getTime());
  const uatLastWeek = countBetween(uatSubmissionTimestamps, b.lastWeekStart, b.thisWeekStart);

  const approvalDecisionTimestamps = data.approvals
    .map((a) => a.decision_at)
    .filter((v): v is string => v != null);
  const approvalsWeek = countBetween(approvalDecisionTimestamps, b.thisWeekStart, now.getTime());
  const approvalsLastWeek = countBetween(approvalDecisionTimestamps, b.lastWeekStart, b.thisWeekStart);

  // ---- SYSTEMS --------------------------------------------------------------
  const incidentStartTimestamps = data.incidents.map((i) => i.started_at);
  const incidentsWeek = countBetween(incidentStartTimestamps, b.thisWeekStart, now.getTime());
  const incidentsLastWeek = countBetween(incidentStartTimestamps, b.lastWeekStart, b.thisWeekStart);
  const incidentsToday = countBetween(incidentStartTimestamps, b.todayStart, now.getTime());

  const securityAlertTimestamps = data.alerts.map((a) => a.first_seen_at);
  const alertsWeek = countBetween(securityAlertTimestamps, b.thisWeekStart, now.getTime());
  const alertsLastWeek = countBetween(securityAlertTimestamps, b.lastWeekStart, b.thisWeekStart);

  const backupSuccessTimestamps = backup.records
    .filter((r) => (r.status ?? '').toLowerCase() === 'completed')
    .map((r) => r.completed_at);
  const backupSuccessWeek = countBetween(backupSuccessTimestamps, b.thisWeekStart, now.getTime());
  const backupSuccessLastWeek = countBetween(backupSuccessTimestamps, b.lastWeekStart, b.thisWeekStart);

  const backupFailedTimestamps = backup.records
    .filter((r) => ['failed', 'error'].includes((r.status ?? '').toLowerCase()))
    .map((r) => r.completed_at);
  const backupFailedWeek = countBetween(backupFailedTimestamps, b.thisWeekStart, now.getTime());
  const backupFailedLastWeek = countBetween(backupFailedTimestamps, b.lastWeekStart, b.thisWeekStart);

  // ---- Incident context (MTTR from authoritative timestamps) ----------------
  let mttrMs = 0;
  let mttrCount = 0;
  for (const i of data.incidents) {
    if (!['resolved', 'closed'].includes((i.status ?? '').toLowerCase())) continue;
    const s = ts(i.started_at);
    const e = ts(i.resolved_at) ?? ts(i.closed_at);
    if (s != null && e != null && e >= s) {
      mttrMs += e - s;
      mttrCount += 1;
    }
  }
  const mttrHours = mttrCount > 0 ? mttrMs / mttrCount / 3_600_000 : null;

  // ---- Sections -------------------------------------------------------------
  const money = (n: number) => gbpFormat.format(n);

  const sections: TrendSection[] = [
    {
      title: 'Business',
      icon: 'ri-line-chart-line',
      metrics: [
        buildMetric({
          key: 'leads',
          label: 'New Leads',
          periodLabel: 'today vs yesterday',
          icon: 'ri-user-add-line',
          polarity: 'positive',
          available: business.availability.leads,
          current: leadsToday,
          previous: leadsYesterday,
          total: leadsTimestamps.filter((t) => ts(t) != null).length,
          series: leadsSeries,
        }),
        buildMetric({
          key: 'revenue',
          label: 'Revenue (paid)',
          periodLabel: 'this month vs last month',
          icon: 'ri-money-pound-circle-line',
          polarity: 'positive',
          available: business.availability.invoices && business.availability.checkout,
          current: revenueMonth,
          previous: revenueLastMonth,
          total: revenueTotalTxns,
          format: money,
        }),
        buildMetric({
          key: 'projects',
          label: 'New Projects',
          periodLabel: 'this week vs last week',
          icon: 'ri-rocket-2-line',
          polarity: 'positive',
          available: business.availability.projects,
          current: projectsWeek,
          previous: projectsLastWeek,
          total: projectTimestamps.filter((t) => ts(t) != null).length,
        }),
      ],
    },
    {
      title: 'Operations',
      icon: 'ri-tools-line',
      metrics: [
        buildMetric({
          key: 'tickets',
          label: 'New Tickets',
          periodLabel: 'today vs yesterday',
          icon: 'ri-customer-service-2-line',
          polarity: 'negative',
          available: workload.availability.tickets,
          current: ticketsToday,
          previous: ticketsYesterday,
          total: ticketTimestamps.filter((t) => ts(t) != null).length,
          series: ticketsSeries,
        }),
        buildMetric({
          key: 'completed-tasks',
          label: 'Completed AI Tasks',
          periodLabel: 'today vs yesterday',
          icon: 'ri-check-double-line',
          polarity: 'positive',
          available: data.availability.runs,
          current: completedToday,
          previous: completedYesterday,
          total: completedRunTimestamps.filter((t) => ts(t) != null).length,
          series: completedSeries,
        }),
        buildMetric({
          key: 'uat',
          label: 'UAT Submissions',
          periodLabel: 'this week vs last week',
          icon: 'ri-flask-line',
          polarity: 'positive',
          available: workload.availability.uatAssignments,
          current: uatWeek,
          previous: uatLastWeek,
          total: uatSubmissionTimestamps.length,
        }),
        buildMetric({
          key: 'approvals',
          label: 'Approvals Decided',
          periodLabel: 'this week vs last week',
          icon: 'ri-shield-check-line',
          polarity: 'positive',
          available: data.availability.approvals,
          current: approvalsWeek,
          previous: approvalsLastWeek,
          total: approvalDecisionTimestamps.length,
        }),
      ],
    },
    {
      title: 'Systems',
      icon: 'ri-server-line',
      metrics: [
        buildMetric({
          key: 'incidents',
          label: 'Incidents Opened',
          periodLabel: 'this week vs last week',
          icon: 'ri-alert-line',
          polarity: 'negative',
          available: data.availability.incidents,
          current: incidentsWeek,
          previous: incidentsLastWeek,
          total: incidentStartTimestamps.filter((t) => ts(t) != null).length,
        }),
        buildMetric({
          key: 'failed-runs',
          label: 'Failed AI Runs',
          periodLabel: 'this week vs last week',
          icon: 'ri-close-circle-line',
          polarity: 'negative',
          available: data.availability.runs,
          current: failedWeek,
          previous: failedLastWeek,
          total: failedRunTimestamps.filter((t) => ts(t) != null).length,
          series: failedSeries,
        }),
        buildMetric({
          key: 'security-alerts',
          label: 'Security Alerts',
          periodLabel: 'this week vs last week',
          icon: 'ri-shield-cross-line',
          polarity: 'negative',
          available: data.availability.alerts,
          current: alertsWeek,
          previous: alertsLastWeek,
          total: securityAlertTimestamps.filter((t) => ts(t) != null).length,
        }),
        buildMetric({
          key: 'backup-success',
          label: 'Backup Success',
          periodLabel: 'this week vs last week',
          icon: 'ri-archive-line',
          polarity: 'positive',
          available: backup.recordsAvailability,
          current: backupSuccessWeek,
          previous: backupSuccessLastWeek,
          total: backupSuccessTimestamps.filter((t) => ts(t) != null).length,
        }),
        buildMetric({
          key: 'backup-failed',
          label: 'Backup Failures',
          periodLabel: 'this week vs last week',
          icon: 'ri-error-warning-line',
          polarity: 'negative',
          available: backup.recordsAvailability,
          current: backupFailedWeek,
          previous: backupFailedLastWeek,
          total: backupFailedTimestamps.filter((t) => ts(t) != null).length,
        }),
      ],
    },
  ];

  // ---- Sparklines -----------------------------------------------------------
  const labels = dayLabels(b.todayStart, 7);
  const sparklines: SparklineSeries[] = [
    { key: 'leads', label: 'Leads', tone: 'accent', series: leadsSeries, dayLabels: labels },
    { key: 'tickets', label: 'Tickets', tone: 'amber', series: ticketsSeries, dayLabels: labels },
    { key: 'completed', label: 'Completed', tone: 'emerald', series: completedSeries, dayLabels: labels },
    { key: 'failed', label: 'Failed', tone: 'red', series: failedSeries, dayLabels: labels },
  ];

  // ---- Source state ---------------------------------------------------------
  const allMetrics = sections.flatMap((s) => s.metrics);
  const liveCount = allMetrics.filter((m) => m.status !== 'unavailable').length;
  const availableCount = allMetrics.filter((m) => m.status === 'live' || m.status === 'insufficient').length;
  const hasAnyData = availableCount > 0;

  let sourceState: WallboardTrends['sourceState'];
  if (liveCount === allMetrics.length) sourceState = 'live';
  else if (hasAnyData) sourceState = 'partial';
  else sourceState = 'unavailable';

  const periodNote = 'periods use Europe/London boundaries · no synthetic history';

  return {
    sourceState,
    periodNote,
    sections,
    incidents: {
      today: data.availability.incidents ? incidentsToday : null,
      week: data.availability.incidents ? incidentsWeek : null,
      mttrHours,
      mttrCount,
    },
    sparklines,
    hasAnyData,
  };
}