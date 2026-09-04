// ============================================================================
// AI Operations — Wallboard Support & SLA Selectors.
//
// Deterministic, read-only derivation over the support snapshot (loaded by
// supportStore.ts). NO writes, no ticket mutation, no routing/SLA changes.
// This layer only groups, buckets and counts what the store already loaded.
//
// SLA definitions — reused verbatim from the existing
// support_analytics_overview() RPC (Prompt 18), never re-derived here:
//   * at risk  = active with a future due_at (clock running, not yet breached)
//   * breached = active with a breach timestamp set, or due_at < now()
//
// TICKET STATE GROUPS (presentation only — the source workflow is untouched):
//   NEW / ACTIVE / WAITING / RESOLVED / CLOSED. 'spam' is excluded.
//
// PRIVACY — only aggregate counts and ages reach the wall. Customer names,
// emails, subjects, message contents, session tokens and staff identity are
// never selected by the store.
// ============================================================================

import {
  getSupportData,
  type SupportTicketRow,
} from '@/pages/ai-operations/wallboard/supportStore';

// --- Types ------------------------------------------------------------------

export type SourceState = 'live' | 'partial' | 'unavailable';

export type SupportKpiStatus = 'live' | 'unavailable';

export interface SupportKpi {
  label: string;
  value: string | number;
  status: SupportKpiStatus;
  note?: string;
  accent: string;
  icon: string;
}

export interface SupportKpiGroup {
  title: string;
  icon: string;
  kpis: SupportKpi[];
}

export interface TeamLoadStat {
  name: string;
  open: number;
  urgent: number;
  slaRisk: number;
}

export interface SiteLoadStat {
  site: string;
  count: number;
}

export interface TicketStateStat {
  state: 'NEW' | 'ACTIVE' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  count: number;
}

export interface SupportResult {
  sourceState: SourceState;
  hasAnyData: boolean;
  groups: SupportKpiGroup[];
  teamLoad: TeamLoadStat[];
  siteLoad: SiteLoadStat[];
  ticketStates: TicketStateStat[];
  oldestOpenAge: string | null;
  oldestOpenAvailable: boolean;
  activeEscalations: number;
  criticalEscalations: number;
  escalationsAvailable: boolean;
  pendingSessions: number;
  expiredSessions: number;
  revokedSessions: number;
  sessionsAvailable: boolean;
  repairs: { awaitingApproval: number; executing: number; failed: number; completedToday: number } | null;
  repairsAvailable: boolean;
}

// --- Helpers ----------------------------------------------------------------

const ACTIVE_STATUSES = new Set(['new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_staff']);

function isActive(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has((status ?? '').toLowerCase());
}

function ts(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Compact age such as "1d 6h" / "2h 15m" / "9m". */
function formatAge(iso: string | null | undefined): string | null {
  const t = ts(iso);
  if (t == null) return null;
  const diffMs = Date.now() - t;
  if (diffMs < 0) return '0m';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function num(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

// --- Public selector --------------------------------------------------------

export function getSupport(): SupportResult {
  const data = getSupportData();
  const a = data.availability;

  const overview = data.overview;
  const overviewOk = a.overview && overview != null;

  // Ticket state grouping (from the minimal ticket projection).
  const stateMap = new Map<TicketStateStat['state'], number>();
  for (const t of data.tickets) {
    const s = (t.status ?? '').toLowerCase();
    if (s === 'new') stateMap.set('NEW', (stateMap.get('NEW') ?? 0) + 1);
    else if (s === 'open' || s === 'in_progress') stateMap.set('ACTIVE', (stateMap.get('ACTIVE') ?? 0) + 1);
    else if (s === 'waiting_on_customer' || s === 'waiting_on_staff') stateMap.set('WAITING', (stateMap.get('WAITING') ?? 0) + 1);
    else if (s === 'resolved') stateMap.set('RESOLVED', (stateMap.get('RESOLVED') ?? 0) + 1);
    else if (s === 'closed') stateMap.set('CLOSED', (stateMap.get('CLOSED') ?? 0) + 1);
  }
  const stateOrder: TicketStateStat['state'][] = ['NEW', 'ACTIVE', 'WAITING', 'RESOLVED', 'CLOSED'];
  const ticketStates: TicketStateStat[] = stateOrder
    .map((state) => ({ state, count: stateMap.get(state) ?? 0 }))
    .filter((s) => s.count > 0);

  // Oldest open ticket age (authoritative created_at).
  const activeTickets = data.tickets.filter((t) => isActive(t.status));
  let oldestOpenAge: string | null = null;
  let oldestTs: number | null = null;
  for (const t of activeTickets) {
    const tMs = ts(t.created_at);
    if (tMs != null && (oldestTs == null || tMs < oldestTs)) oldestTs = tMs;
  }
  if (oldestTs != null) {
    oldestOpenAge = formatAge(new Date(oldestTs).toISOString());
  }

  // Site load (aggregate active tickets by stable site id).
  const siteNameById = new Map<string, string>();
  for (const s of data.sites) {
    siteNameById.set(s.id, s.site_name ?? 'Unknown site');
  }
  const siteMap = new Map<string, number>();
  for (const t of activeTickets) {
    if (!t.site_id) continue;
    siteMap.set(t.site_id, (siteMap.get(t.site_id) ?? 0) + 1);
  }
  const siteLoad: SiteLoadStat[] = [...siteMap.entries()]
    .map(([id, count]) => ({ site: siteNameById.get(id) ?? 'Unknown site', count }))
    .sort((x, y) => y.count - x.count || x.site.localeCompare(y.site));

  // Escalations (authoritative escalation_level / routing_status).
  const activeEscalations = activeTickets.filter(
    (t) => num(t.escalation_level) > 0 || t.routing_status === 'escalated',
  ).length;
  const criticalEscalations = activeTickets.filter(
    (t) => (t.priority ?? '').toLowerCase() === 'critical',
  ).length;

  // Team load (from internal_team_workload).
  const teamLoad: TeamLoadStat[] = data.teamWorkload
    .map((t) => ({
      name: t.name,
      open: num(t.open_tickets),
      urgent: num(t.urgent_tickets),
      slaRisk: num(t.sla_risk),
    }))
    .sort((x, y) => y.open - x.open || x.name.localeCompare(y.name));

  // Sessions (status counts only).
  const sessionCount = (statuses: string[]): number =>
    data.sessions.filter((s) => statuses.includes((s.status ?? '').toLowerCase())).length;
  const activeSessions = sessionCount(['active']);
  const pendingSessions = sessionCount(['requested', 'approved']);
  const expiredSessions = sessionCount(['expired']);
  const revokedSessions = sessionCount(['revoked']);

  // Repairs.
  const repairs = data.repairs;

  // --- KPI construction -----------------------------------------------------
  const countKpi = (
    label: string,
    ok: boolean,
    value: number,
    accent: string,
    icon: string,
    note?: string,
  ): SupportKpi => ({
    label,
    value: ok ? value : 'Unavailable',
    status: ok ? 'live' : 'unavailable',
    accent,
    icon,
    note,
  });

  const textKpi = (
    label: string,
    ok: boolean,
    value: string | null,
    accent: string,
    icon: string,
    note?: string,
  ): SupportKpi => ({
    label,
    value: ok && value != null ? value : 'Unavailable',
    status: ok && value != null ? 'live' : 'unavailable',
    accent,
    icon,
    note,
  });

  const queue: SupportKpi[] = [
    countKpi('Open', overviewOk, overview?.open_tickets ?? 0, 'text-foreground-100', 'ri-inbox-line'),
    countKpi('Urgent', overviewOk, overview?.urgent_tickets ?? 0, overviewOk && (overview?.urgent_tickets ?? 0) > 0 ? 'text-red-400' : 'text-foreground-200', 'ri-error-warning-line'),
    countKpi('Unassigned', overviewOk, overview?.unassigned ?? 0, 'text-amber-400', 'ri-user-unfollow-line'),
    countKpi('Needs Review', overviewOk, overview?.needs_review ?? 0, 'text-secondary-300', 'ri-question-line'),
  ];

  const sla: SupportKpi[] = [
    countKpi('At Risk', overviewOk, overview?.sla_at_risk ?? 0, 'text-amber-400', 'ri-alarm-line'),
    countKpi('Breached', overviewOk, overview?.sla_breached ?? 0, overviewOk && (overview?.sla_breached ?? 0) > 0 ? 'text-red-400' : 'text-foreground-200', 'ri-timer-flash-line'),
    textKpi('Oldest Open', a.tickets, oldestOpenAge, 'text-foreground-100', 'ri-time-line'),
  ];

  const today: SupportKpi[] = [
    countKpi('Opened Today', overviewOk, overview?.new_today ?? 0, 'text-accent-400', 'ri-mail-add-line'),
    countKpi('Resolved Today', overviewOk, overview?.resolved_today ?? 0, 'text-emerald-400', 'ri-check-double-line'),
  ];

  const access: SupportKpi[] = [
    countKpi('Active Sessions', a.sessions, activeSessions, 'text-emerald-400', 'ri-eye-line'),
    countKpi('Pending Sessions', a.sessions, pendingSessions, 'text-amber-400', 'ri-hourglass-line'),
    countKpi('Repairs Awaiting Approval', a.repairs, repairs?.awaiting_approval ?? 0, 'text-amber-400', 'ri-tools-line'),
  ];

  // --- Source state ---------------------------------------------------------
  const coreReadable = a.overview && a.tickets;
  const anyReadable = coreReadable || a.teamWorkload || a.repairs || a.sessions;
  const allReadable = a.overview && a.tickets && a.teamWorkload && a.repairs && a.sessions;
  let sourceState: SourceState = 'unavailable';
  if (allReadable) sourceState = 'live';
  else if (anyReadable) sourceState = 'partial';

  return {
    sourceState,
    hasAnyData: data.tickets.length > 0 || overviewOk,
    groups: [
      { title: 'Queue', icon: 'ri-inbox-line', kpis: queue },
      { title: 'SLA', icon: 'ri-timer-line', kpis: sla },
      { title: 'Today', icon: 'ri-calendar-event-line', kpis: today },
      { title: 'Support Access', icon: 'ri-shield-user-line', kpis: access },
    ],
    teamLoad,
    siteLoad,
    ticketStates,
    oldestOpenAge,
    oldestOpenAvailable: a.tickets,
    activeEscalations,
    criticalEscalations,
    escalationsAvailable: a.tickets,
    pendingSessions,
    expiredSessions,
    revokedSessions,
    sessionsAvailable: a.sessions,
    repairs: a.repairs ? repairs : null,
    repairsAvailable: a.repairs,
  };
}

/** Documented SLA definitions, surfaced for transparency on the wall. */
export function getSlaDefinition(): string {
  return 'at risk = active with future due · breached = breach timestamp or overdue';
}