// ============================================================================
// AI Operations — Wallboard Sales Pipeline Selectors.
//
// Deterministic, read-only derivation over the business snapshot (leads +
// lead_follow_ups + lead_stage_history, all loaded by businessStore.ts). NO
// writes, no stage mutation, no new CRM. This layer only classifies, buckets
// and counts what the store already loaded.
//
// CONVERSION DEFINITION (documented, company-approved):
//   conversion = won opportunities / closed opportunities
//   - "won"  = a lead explicitly converted (converted_to_client OR
//              converted_to_project set), or stage in (won/converted).
//   - "lost" = a lead with lost_reason set, or stage in (lost).
//   - "closed" = won + lost.
//   - When closed = 0, conversion is reported as "n/a" (never 0%).
//
// STAGE MAPPING — reuses the Lead Engine `stage` values (new / contacted /
// qualified / proposal / won / lost) mapped to wallboard presentation stages.
// Unrecognised stages are surfaced as UNKNOWN, never guessed.
//
// PRIVACY — only aggregate counts/value reach the wall. Names, emails, phones,
// enquiry contents, lost reasons and per-salesperson data are never selected.
// ============================================================================

import { getBusinessData, type BusinessLeadRow, type BusinessFollowUpRow } from '@/pages/ai-operations/wallboard/businessStore';

// --- Types ------------------------------------------------------------------

export type SalesStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST' | 'UNKNOWN';

export type SourceState = 'live' | 'partial' | 'unavailable';

export type LeadSourceBucket = 'Website' | 'Campaign' | 'Referral' | 'Direct' | 'Other';

export type SalesKpiStatus = 'live' | 'unavailable';

export interface SalesKpi {
  label: string;
  value: string | number;
  status: SalesKpiStatus;
  note?: string;
  accent: string;
  icon: string;
}

export interface SalesKpiGroup {
  title: string;
  icon: string;
  kpis: SalesKpi[];
}

export interface LeadSourceStat {
  bucket: LeadSourceBucket;
  count: number;
}

export interface PipelineStageStat {
  stage: SalesStage;
  count: number;
}

export interface SalesTrend {
  /** Direction of the comparison, or null when no meaningful history exists. */
  direction: 'up' | 'down' | 'flat' | null;
  /** Absolute delta (current minus previous period). */
  delta: number;
  /** Whether the comparison is meaningful (either period has data). */
  meaningful: boolean;
}

export interface SalesPipeline {
  sourceState: SourceState;
  hasAnyData: boolean;
  groups: SalesKpiGroup[];
  sourceBreakdown: LeadSourceStat[];
  stageBreakdown: PipelineStageStat[];
  conversionRate: number | null;
  newBusinessTrend: SalesTrend;
  wonTrend: SalesTrend;
}

// --- Lead classification ----------------------------------------------------

function mapStage(raw: string | null | undefined): SalesStage {
  switch ((raw ?? '').toLowerCase().trim()) {
    case 'new':
      return 'NEW';
    case 'contacted':
      return 'CONTACTED';
    case 'qualified':
      return 'QUALIFIED';
    case 'proposal':
      return 'PROPOSAL';
    case 'won':
    case 'converted':
    case 'closed_won':
      return 'WON';
    case 'lost':
    case 'closed_lost':
      return 'LOST';
    default:
      return 'UNKNOWN';
  }
}

interface ClassifiedLead {
  stage: SalesStage;
  won: boolean;
  lost: boolean;
  closed: boolean;
  open: boolean;
}

function classifyLead(l: BusinessLeadRow): ClassifiedLead {
  const mapped = mapStage(l.stage);
  const won = !!l.converted_to_client || !!l.converted_to_project || mapped === 'WON';
  const lost = !!l.lost_reason || mapped === 'LOST';
  const archived = !!l.archived_at;
  return {
    stage: won ? 'WON' : lost ? 'LOST' : mapped,
    won,
    lost,
    closed: won || lost,
    open: !archived && !won && !lost,
  };
}

// --- Lead source bucketing --------------------------------------------------

function bucketSource(l: BusinessLeadRow): LeadSourceBucket {
  if (l.campaign) return 'Campaign';
  const s = (l.source ?? '').toLowerCase().trim();
  if (!s || s === 'unknown' || s === 'none') return 'Other';
  if (s.includes('campaign')) return 'Campaign';
  if (s.includes('referral') || s.includes('partner') || s.includes('affiliate')) return 'Referral';
  if (s.includes('direct')) return 'Direct';
  // Remaining known source identifiers (contact_page, website, form, etc.)
  // are website enquiries.
  return 'Website';
}

// --- Europe/London time boundaries ------------------------------------------

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

function startOfWeekLondon(now: Date): number {
  const p = londonParts(now);
  // Monday-start week.
  const monday = p.d - ((p.dow + 6) % 7);
  return startOfLondonDay(p.y, p.m, monday);
}

function startOfMonthLondon(now: Date): number {
  const p = londonParts(now);
  return startOfLondonDay(p.y, p.m, 1);
}

function startOfPrevWeekLondon(now: Date): number {
  return startOfWeekLondon(now) - 7 * 86400000;
}

function startOfPrevMonthLondon(now: Date): number {
  const p = londonParts(now);
  const prevM = p.m - 1;
  const y = prevM === 0 ? p.y - 1 : p.y;
  const m = prevM === 0 ? 12 : prevM;
  return startOfLondonDay(y, m, 1);
}

// --- Money formatting (GBP only) --------------------------------------------

function isGbp(currency: string | null | undefined): boolean {
  return (currency ?? '').toLowerCase() === 'gbp';
}

function pounds(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

const gbpFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function fmtMoney(n: number): string {
  return gbpFormat.format(n);
}

function ts(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

// --- Public selector --------------------------------------------------------

export function getSalesPipeline(): SalesPipeline {
  const data = getBusinessData();
  const a = data.availability;
  const now = new Date();

  const todayStart = startOfTodayLondon(now);
  const weekStart = startOfWeekLondon(now);
  const monthStart = startOfMonthLondon(now);
  const prevWeekStart = startOfPrevWeekLondon(now);
  const prevMonthStart = startOfPrevMonthLondon(now);

  const classified = data.leads.map(classifyLead);
  const openLeads = classified.filter((c) => c.open);
  const wonLeads = classified.filter((c) => c.won);
  const lostLeads = classified.filter((c) => c.lost);

  // --- Counts ---------------------------------------------------------------
  const newToday = data.leads.filter((l) => {
    const t = ts(l.created_at);
    return t != null && t >= todayStart;
  }).length;
  const newThisWeek = data.leads.filter((l) => {
    const t = ts(l.created_at);
    return t != null && t >= weekStart;
  }).length;
  const newLastWeek = data.leads.filter((l) => {
    const t = ts(l.created_at);
    return t != null && t >= prevWeekStart && t < weekStart;
  }).length;

  const qualified = openLeads.filter((c) => c.stage === 'QUALIFIED').length;
  const proposals = openLeads.filter((c) => c.stage === 'PROPOSAL').length;

  const wonThisMonth = data.leads.filter((l) => {
    const c = classifyLead(l);
    if (!c.won) return false;
    const t = ts(l.converted_at);
    return t != null && t >= monthStart;
  }).length;
  const wonLastMonth = data.leads.filter((l) => {
    const c = classifyLead(l);
    if (!c.won) return false;
    const t = ts(l.converted_at);
    return t != null && t >= prevMonthStart && t < monthStart;
  }).length;

  // Lost timing uses stage_changed_at (when it moved to lost) as the closest
  // authoritative timestamp, falling back to last_activity_at / updated_at.
  const lostThisMonth = data.leads.filter((l) => {
    const c = classifyLead(l);
    if (!c.lost) return false;
    const t = ts(l.stage_changed_at) ?? ts(l.last_activity_at);
    return t != null && t >= monthStart;
  }).length;

  // --- Pipeline value (open, GBP only — clearly NOT revenue) ----------------
  let openPipelineValue = 0;
  for (const l of openLeads) {
    if (isGbp(l.currency)) openPipelineValue += pounds(l.estimated_value);
  }

  // --- Conversion rate (documented definition) ------------------------------
  const closedTotal = wonLeads.length + lostLeads.length;
  const conversionRate = closedTotal > 0 ? wonLeads.length / closedTotal : null;

  // --- Follow-up health (authoritative lead_follow_ups due dates) -----------
  const dueToday = data.followUps.filter((f) => {
    if (f.completed_at) return false;
    const t = ts(f.due_at);
    return t != null && t >= todayStart && t < todayStart + 86400000;
  }).length;
  const overdue = data.followUps.filter((f) => {
    if (f.completed_at) return false;
    const t = ts(f.due_at);
    return t != null && t < todayStart;
  }).length;
  const awaitingContact = openLeads.filter((c) => c.stage === 'NEW').length;

  // --- KPI construction -----------------------------------------------------
  const countKpi = (
    label: string,
    ok: boolean,
    value: number,
    accent: string,
    icon: string,
    note?: string,
  ): SalesKpi => ({
    label,
    value: ok ? value : 'Unavailable',
    status: ok ? 'live' : 'unavailable',
    accent,
    icon,
    note,
  });

  const moneyKpi = (
    label: string,
    ok: boolean,
    value: number,
    accent: string,
    icon: string,
    note?: string,
  ): SalesKpi => ({
    label,
    value: ok ? fmtMoney(value) : 'Unavailable',
    status: ok ? 'live' : 'unavailable',
    accent,
    icon,
    note,
  });

  const newBusiness: SalesKpi[] = [
    countKpi('New Today', a.leads, newToday, 'text-accent-400', 'ri-user-add-line'),
    countKpi('New This Week', a.leads, newThisWeek, 'text-accent-400', 'ri-calendar-event-line'),
    countKpi('Open Leads', a.leads, openLeads.length, 'text-foreground-100', 'ri-user-search-line'),
  ];

  const pipeline: SalesKpi[] = [
    countKpi('Qualified', a.leads, qualified, 'text-emerald-400', 'ri-filter-3-line'),
    countKpi('Proposals', a.leads, proposals, 'text-amber-400', 'ri-file-list-3-line'),
    moneyKpi('Open Pipeline Value', a.leads, openPipelineValue, 'text-secondary-300', 'ri-money-pound-circle-line', 'pipeline — not revenue'),
  ];

  const conversion: SalesKpi[] = [
    countKpi('Won This Month', a.leads, wonThisMonth, 'text-emerald-400', 'ri-trophy-line'),
    countKpi('Lost This Month', a.leads, lostThisMonth, 'text-red-400', 'ri-close-circle-line'),
    {
      label: 'Conversion Rate',
      value: !a.leads ? 'Unavailable' : conversionRate == null ? 'n/a' : `${Math.round(conversionRate * 100)}%`,
      status: a.leads ? 'live' : 'unavailable',
      accent: 'text-foreground-100',
      icon: 'ri-percent-line',
      note: conversionRate == null ? 'no closed opportunities' : 'won / closed',
    },
  ];

  const followUp: SalesKpi[] = [
    countKpi('Due Today', a.followUps, dueToday, 'text-amber-400', 'ri-alarm-line'),
    countKpi('Overdue', a.followUps, overdue, overdue > 0 ? 'text-red-400' : 'text-foreground-200', 'ri-time-line'),
    countKpi('Awaiting First Contact', a.leads, awaitingContact, 'text-secondary-300', 'ri-hourglass-line'),
  ];

  // --- Source breakdown -----------------------------------------------------
  const sourceMap = new Map<LeadSourceBucket, number>();
  for (const l of data.leads) {
    const b = bucketSource(l);
    sourceMap.set(b, (sourceMap.get(b) ?? 0) + 1);
  }
  const bucketOrder: LeadSourceBucket[] = ['Website', 'Campaign', 'Referral', 'Direct', 'Other'];
  const sourceBreakdown: LeadSourceStat[] = bucketOrder
    .map((bucket) => ({ bucket, count: sourceMap.get(bucket) ?? 0 }))
    .filter((s) => s.count > 0);

  // --- Stage breakdown (open pipeline distribution) -------------------------
  const stageOrder: SalesStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
  const stageMap = new Map<SalesStage, number>();
  for (const c of classified) {
    stageMap.set(c.stage, (stageMap.get(c.stage) ?? 0) + 1);
  }
  const stageBreakdown: PipelineStageStat[] = stageOrder
    .map((stage) => ({ stage, count: stageMap.get(stage) ?? 0 }))
    .filter((s) => s.count > 0);

  // --- Trends (only where real timestamps support a comparison) -------------
  const newDelta = newThisWeek - newLastWeek;
  const wonDelta = wonThisMonth - wonLastMonth;
  const dir = (delta: number): 'up' | 'down' | 'flat' =>
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  const newBusinessTrend: SalesTrend = {
    direction: newLastWeek > 0 || newThisWeek > 0 ? dir(newDelta) : null,
    delta: newDelta,
    meaningful: newLastWeek > 0 || newThisWeek > 0,
  };
  const wonTrend: SalesTrend = {
    direction: wonLastMonth > 0 || wonThisMonth > 0 ? dir(wonDelta) : null,
    delta: wonDelta,
    meaningful: wonLastMonth > 0 || wonThisMonth > 0,
  };

  // --- Source state ---------------------------------------------------------
  const anyReadable = a.leads || a.followUps || a.stageHistory;
  const allReadable = a.leads && a.followUps && a.stageHistory;
  let sourceState: SourceState = 'unavailable';
  if (allReadable) sourceState = 'live';
  else if (anyReadable) sourceState = 'partial';

  return {
    sourceState,
    hasAnyData: data.leads.length > 0,
    groups: [
      { title: 'New Business', icon: 'ri-user-add-line', kpis: newBusiness },
      { title: 'Pipeline', icon: 'ri-filter-3-line', kpis: pipeline },
      { title: 'Conversion', icon: 'ri-percent-line', kpis: conversion },
      { title: 'Follow-up', icon: 'ri-alarm-line', kpis: followUp },
    ],
    sourceBreakdown,
    stageBreakdown,
    conversionRate,
    newBusinessTrend,
    wonTrend,
  };
}

/** Documented conversion definition, surfaced for transparency on the wall. */
export function getConversionDefinition(): string {
  return 'won opportunities / closed opportunities';
}