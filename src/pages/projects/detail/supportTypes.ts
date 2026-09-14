// ============================================================================
// DFP COMMAND 09 — PROJECT SUPPORT / INCIDENT TYPES + PURE HELPERS
// ============================================================================
// Read-time aggregation over the existing central Support system. Nothing here
// persists new status — every value is derived honestly from stored records.
import type { SupportTicket } from '@/types/support-tickets';
import type { Bug, ChangeRequest } from './types';

// ─── Display-only project support status ────────────────────────────────────

export type ProjectSupportStatus =
  | 'CLEAR'
  | 'ACTIVE'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'UNKNOWN'
  | 'NOT CONFIGURED';

export const SUPPORT_STATUS_LABELS: Record<ProjectSupportStatus, string> = {
  CLEAR: 'Clear',
  ACTIVE: 'Active',
  DEGRADED: 'Degraded',
  CRITICAL: 'Critical',
  UNKNOWN: 'Unknown',
  'NOT CONFIGURED': 'Not Configured',
};

export const SUPPORT_STATUS_STYLES: Record<ProjectSupportStatus, string> = {
  CLEAR: 'bg-emerald-500/10 text-emerald-400',
  ACTIVE: 'bg-sky-500/10 text-sky-400',
  DEGRADED: 'bg-amber-500/10 text-amber-400',
  CRITICAL: 'bg-red-500/10 text-red-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400',
  'NOT CONFIGURED': 'bg-foreground-500/10 text-foreground-500',
};

// ─── Ticket state helpers ───────────────────────────────────────────────────

const OPEN_STATUSES = ['new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_staff'];
const RESOLVED_STATUSES = ['resolved', 'closed'];

export function isOpenTicket(ticket: SupportTicket): boolean {
  return OPEN_STATUSES.includes(ticket.status);
}

export function isResolvedTicket(ticket: SupportTicket): boolean {
  return RESOLVED_STATUSES.includes(ticket.status);
}

/** Operational incidents at project scope = open critical/urgent tickets.
 *  Honest: AI-ops (`ai_incidents`) and monitoring records are keyed to
 *  `ai_sites`/`client_websites`, not `internal_projects`, so they are not
 *  fabricated here — they are surfaced via deep links instead. */
export function supportIncidents(tickets: SupportTicket[]): SupportTicket[] {
  return tickets.filter(
    (t) => isOpenTicket(t) && (t.priority === 'critical' || t.priority === 'urgent'),
  );
}

// ─── Summary (display only) ─────────────────────────────────────────────────

export interface SupportSummary {
  openTickets: number;
  critical: number;
  highPriority: number;
  openIncidents: number;
  linkedBugs: number;
  pendingChanges: number;
  awaitingCustomer: number;
  awaitingInternal: number;
  resolvedThisMonth: number;
}

export function computeSupportSummary(
  tickets: SupportTicket[],
  bugs: Bug[],
  changeRequests: ChangeRequest[],
): SupportSummary {
  const open = tickets.filter(isOpenTicket);
  const critical = open.filter((t) => t.priority === 'critical').length;
  const highPriority = open.filter((t) => t.priority === 'high' || t.priority === 'urgent').length;
  const awaitingCustomer = tickets.filter((t) => t.status === 'waiting_on_customer').length;
  const awaitingInternal = tickets.filter((t) => t.status === 'waiting_on_staff').length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const resolvedThisMonth = tickets.filter((t) => {
    if (!isResolvedTicket(t)) return false;
    if (!t.resolved_at) return false;
    const d = new Date(t.resolved_at);
    return !Number.isNaN(d.getTime()) && d >= monthStart;
  }).length;

  const linkedBugs = bugs.filter((b) => b.support_ticket_id != null).length;
  const pendingChanges = changeRequests.filter(
    (c) => c.support_ticket_id != null && !['completed', 'rejected'].includes(c.status),
  ).length;

  return {
    openTickets: open.length,
    critical,
    highPriority,
    openIncidents: supportIncidents(tickets).length,
    linkedBugs,
    pendingChanges,
    awaitingCustomer,
    awaitingInternal,
    resolvedThisMonth,
  };
}

// ─── Status derivation (honest) ─────────────────────────────────────────────

export function deriveSupportStatus(
  tickets: SupportTicket[],
  hasError: boolean,
): ProjectSupportStatus {
  if (hasError) return 'UNKNOWN';
  if (tickets.length === 0) return 'NOT CONFIGURED';
  const open = tickets.filter(isOpenTicket);
  if (open.length === 0) return 'CLEAR';
  if (open.some((t) => t.priority === 'critical')) return 'CRITICAL';
  if (open.some((t) => t.priority === 'high' || t.priority === 'urgent')) return 'DEGRADED';
  return 'ACTIVE';
}

// ─── SLA helpers (real due_at only — no fabricated targets) ─────────────────

export type SlaState = 'breached' | 'at_risk' | 'within_sla' | 'none';

export function slaState(ticket: SupportTicket): SlaState {
  if (!ticket.due_at) return 'none';
  if (isResolvedTicket(ticket)) return 'within_sla';
  const due = new Date(ticket.due_at).getTime();
  if (Number.isNaN(due)) return 'none';
  const now = Date.now();
  if (due < now) return 'breached';
  // At risk if due within the next 4 hours.
  if (due - now <= 4 * 60 * 60 * 1000) return 'at_risk';
  return 'within_sla';
}

export const SLA_STYLES: Record<SlaState, string> = {
  breached: 'bg-red-500/10 text-red-400',
  at_risk: 'bg-amber-500/10 text-amber-400',
  within_sla: 'bg-emerald-500/10 text-emerald-400',
  none: 'bg-foreground-500/10 text-foreground-500',
};

export const SLA_LABELS: Record<SlaState, string> = {
  breached: 'Breached',
  at_risk: 'At Risk',
  within_sla: 'Within SLA',
  none: 'No due date',
};

// ─── Traceability lookups ───────────────────────────────────────────────────

export function linkedBugForTicket(bugs: Bug[], ticketId: string): Bug | null {
  return bugs.find((b) => b.support_ticket_id === ticketId) ?? null;
}

export function linkedChangeForTicket(
  changeRequests: ChangeRequest[],
  ticketId: string,
): ChangeRequest | null {
  return changeRequests.find((c) => c.support_ticket_id === ticketId) ?? null;
}

// ─── Incident source label (project-scope is always Support today) ──────────

export const INCIDENT_SOURCE_LABEL = 'SUPPORT';
export const INCIDENT_SOURCE_STYLE = 'bg-red-500/10 text-red-400';