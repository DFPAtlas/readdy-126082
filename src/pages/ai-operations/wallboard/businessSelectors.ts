// ============================================================================
// AI Operations — Wallboard Business KPI selectors.
//
// Pure read-only derivations over the business snapshot (see businessStore.ts).
// These produce high-level, distance-readable business KPIs for the wallboard.
//
// Rules honoured here:
//   * Revenue is derived ONLY from authoritative payment data (invoice
//     amount_paid / amount_outstanding + collected checkout starting payments),
//     never from leads, page views, or forecasts.
//   * Pipeline (open-lead estimated value) is kept separate and labelled.
//   * Unavailable/empty financial data is shown as "Unavailable"/"Not tracked",
//     never silently as £0.
//   * GBP only — non-GBP rows are excluded rather than summed.
//   * Time periods use Europe/London boundaries.
// ============================================================================

import { getBusinessData, type BusinessLeadRow } from '@/pages/ai-operations/wallboard/businessStore';

export type BusinessKpiStatus = 'live' | 'unavailable';

export interface BusinessKpi {
  label: string;
  value: string | number;
  status: BusinessKpiStatus;
  /** Small context label, e.g. "pipeline — not revenue". */
  note?: string;
  accent: string;
  icon: string;
}

export interface BusinessKpiGroup {
  title: string;
  icon: string;
  kpis: BusinessKpi[];
}

export interface BusinessKpis {
  groups: BusinessKpiGroup[];
  sourceState: 'live' | 'partial' | 'unavailable';
}

// --- Helpers ----------------------------------------------------------------

function isGbp(currency: string | null | undefined): boolean {
  return (currency ?? '').toLowerCase() === 'gbp';
}

function pounds(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function minorToPounds(n: number | null | undefined): number {
  return pounds(n) / 100;
}

const gbpFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function fmtMoney(n: number): string {
  return gbpFormat.format(n);
}

function monthlyAmount(amount: number, interval: string | null): number {
  switch ((interval ?? '').toLowerCase()) {
    case 'weekly':
      return amount * 4.345;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
    case 'annual':
      return amount / 12;
    case 'monthly':
    default:
      return amount;
  }
}

const CHECKOUT_PAID = ['paid', 'succeeded', 'complete', 'completed', 'captured'];

function isPaidCheckout(status: string | null | undefined): boolean {
  return CHECKOUT_PAID.includes((status ?? '').toLowerCase());
}

const LEAD_CLOSED = ['won', 'lost', 'closed'];

function isLeadOpen(l: BusinessLeadRow): boolean {
  if (l.archived_at) return false;
  return !LEAD_CLOSED.includes((l.status ?? '').toLowerCase());
}

// --- Europe/London time boundaries -----------------------------------------

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

function londonParts(date: Date): { y: number; m: number; d: number; dow: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    dow: weekdays.indexOf(p.weekday),
  };
}

function startOfLondonDay(y: number, m: number, d: number): number {
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  return utcGuess - londonOffsetMs(new Date(utcGuess));
}

function startOfTodayLondon(now: Date): number {
  const p = londonParts(now);
  return startOfLondonDay(p.y, p.m, p.d);
}

function startOfThisMonthLondon(now: Date): number {
  const p = londonParts(now);
  return startOfLondonDay(p.y, p.m, 1);
}

// --- KPI derivation ---------------------------------------------------------

export function getBusinessKpis(): BusinessKpis {
  const data = getBusinessData();
  const a = data.availability;
  const now = new Date();

  const todayStart = startOfTodayLondon(now);
  const monthStart = startOfThisMonthLondon(now);

  const kpi = (
    label: string,
    value: string | number,
    status: BusinessKpiStatus,
    accent: string,
    icon: string,
    note?: string,
  ): BusinessKpi => ({ label, value, status, accent, icon, note });

  const countKpi = (
    label: string,
    ok: boolean,
    value: number,
    accent: string,
    icon: string,
    note?: string,
  ): BusinessKpi => kpi(label, ok ? value : 'Unavailable', ok ? 'live' : 'unavailable', accent, icon, note);

  // --- SALES ---------------------------------------------------------------
  const openLeads = data.leads.filter(isLeadOpen);
  const newLeadsToday = data.leads.filter((l) => l.created_at && new Date(l.created_at).getTime() >= todayStart).length;
  const newClientsMonth = data.clients.filter((c) => c.created_at && new Date(c.created_at).getTime() >= monthStart).length;
  const activeClients = data.clients.filter(
    (c) => !c.archived_at && (c.status ?? '').toLowerCase() === 'active',
  ).length;

  const salesKpis: BusinessKpi[] = [
    countKpi('New Leads Today', a.leads, newLeadsToday, 'text-accent-400', 'ri-user-add-line'),
    countKpi('Open Leads', a.leads, openLeads.length, 'text-foreground-100', 'ri-user-search-line'),
    countKpi('New Clients This Month', a.clients, newClientsMonth, 'text-emerald-400', 'ri-building-2-line'),
    countKpi('Active Clients', a.clients, activeClients, 'text-foreground-100', 'ri-team-line'),
  ];

  // --- DELIVERY ------------------------------------------------------------
  const inBuild = data.projects.filter((p) => p.status === 'building').length;
  const live = data.projects.filter((p) => p.status === 'live').length;
  const inPlanning = data.projects.filter((p) => p.status === 'idea').length;

  const deliveryKpis: BusinessKpi[] = [
    countKpi('Active Projects', a.projects, inBuild + live, 'text-accent-400', 'ri-rocket-2-line'),
    countKpi('In Build', a.projects, inBuild, 'text-amber-400', 'ri-hammer-line'),
    countKpi('Live', a.projects, live, 'text-emerald-400', 'ri-global-line'),
    countKpi('In Planning', a.projects, inPlanning, 'text-foreground-200', 'ri-lightbulb-line', 'pipeline'),
  ];

  // --- REVENUE -------------------------------------------------------------
  let revenueMonth = 0;
  let outstanding = 0;
  let pipeline = 0;

  for (const inv of data.invoices) {
    if (!isGbp(inv.currency)) continue;
    if (inv.archived_at || inv.cancelled_at || inv.written_off_at) continue;
    if (inv.paid_at && new Date(inv.paid_at).getTime() >= monthStart) {
      revenueMonth += pounds(inv.amount_paid);
    }
    outstanding += pounds(inv.amount_outstanding);
  }

  for (const o of data.checkout) {
    if (!isGbp(o.currency)) continue;
    const paid = isPaidCheckout(o.payment_status);
    if (paid && o.created_at && new Date(o.created_at).getTime() >= monthStart) {
      revenueMonth += minorToPounds(o.starting_payment_minor);
    }
    if (!paid) {
      outstanding += minorToPounds(o.remaining_balance_minor);
    }
  }

  for (const l of openLeads) {
    if (isGbp(l.currency)) pipeline += pounds(l.estimated_value);
  }

  const activeSubs = data.subscriptions.filter((s) =>
    ['active', 'trialing'].includes((s.status ?? '').toLowerCase()),
  );
  let recurring = 0;
  if (a.subscriptions) {
    recurring = activeSubs.reduce(
      (acc, s) => acc + (isGbp(s.currency) ? monthlyAmount(pounds(s.amount), s.interval) : 0),
      0,
    );
  }

  const revenueOk = a.invoices && a.checkout;
  const recurringStatus: BusinessKpiStatus = !a.subscriptions
    ? 'unavailable'
    : activeSubs.length > 0
      ? 'live'
      : 'unavailable';
  const recurringValue = !a.subscriptions
    ? 'Unavailable'
    : activeSubs.length > 0
      ? fmtMoney(recurring)
      : 'Not tracked';

  const revenueKpis: BusinessKpi[] = [
    kpi(
      'Revenue This Month',
      revenueOk ? fmtMoney(revenueMonth) : 'Unavailable',
      revenueOk ? 'live' : 'unavailable',
      'text-emerald-400',
      'ri-money-pound-circle-line',
    ),
    kpi(
      'Outstanding',
      revenueOk ? fmtMoney(outstanding) : 'Unavailable',
      revenueOk ? 'live' : 'unavailable',
      'text-amber-400',
      'ri-time-line',
    ),
    kpi(
      'Sales Pipeline',
      a.leads ? fmtMoney(pipeline) : 'Unavailable',
      a.leads ? 'live' : 'unavailable',
      'text-secondary-300',
      'ri-filter-3-line',
      'pipeline — not revenue',
    ),
    kpi(
      'Recurring Revenue',
      recurringValue,
      recurringStatus,
      'text-foreground-100',
      'ri-refresh-line',
    ),
  ];

  // --- UAT -----------------------------------------------------------------
  const activeTests = data.uatAssignments.filter((x) =>
    ['in_progress', 'testing'].includes((x.status ?? '').toLowerCase()),
  ).length;
  const awaitingApproval = data.uatAssignments.filter(
    (x) => (x.status ?? '').toLowerCase() === 'submitted',
  ).length;
  const approvalsCompleted = data.uatApprovals.filter(
    (x) => (x.status ?? '').toLowerCase() === 'approved',
  ).length;
  const awaitingPayment = data.uatPayments.filter(
    (x) => !['paid', 'rejected', 'cancelled'].includes((x.status ?? '').toLowerCase()),
  ).length;

  const uatKpis: BusinessKpi[] = [
    countKpi('Active Tests', a.uatAssignments, activeTests, 'text-accent-400', 'ri-flask-line'),
    countKpi('Awaiting Approval', a.uatAssignments, awaitingApproval, 'text-amber-400', 'ri-shield-check-line'),
    countKpi('Approvals Completed', a.uatApprovals, approvalsCompleted, 'text-emerald-400', 'ri-check-double-line'),
    countKpi('Awaiting Tester Payment', a.uatPayments, awaitingPayment, 'text-red-400', 'ri-bank-card-line'),
  ];

  // --- Overall source state -------------------------------------------------
  const coreAvailable = a.leads && a.clients && a.projects;
  const allAvailable =
    coreAvailable && a.invoices && a.checkout && a.uatAssignments && a.uatApprovals && a.uatPayments;
  const sourceState: BusinessKpis['sourceState'] = data.loading
    ? 'unavailable'
    : allAvailable
      ? 'live'
      : coreAvailable
        ? 'partial'
        : 'unavailable';

  return {
    groups: [
      { title: 'Sales', icon: 'ri-user-add-line', kpis: salesKpis },
      { title: 'Delivery', icon: 'ri-rocket-2-line', kpis: deliveryKpis },
      { title: 'Revenue', icon: 'ri-money-pound-circle-line', kpis: revenueKpis },
      { title: 'UAT', icon: 'ri-flask-line', kpis: uatKpis },
    ],
    sourceState,
  };
}