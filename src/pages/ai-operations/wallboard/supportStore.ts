// ============================================================================
// AI Operations — Wallboard Support & SLA Data Store.
//
// Read-only aggregation over the EXISTING DFP Command support architecture.
// This is NOT a second ticketing platform — it reuses the exact sources that
// already drive Support Tickets, Support Teams, Support Sessions and Support
// Repairs, and projects only aggregate / privacy-safe fields for a large wall
// display.
//
// SOURCE AUDIT (Wallboard 41):
//   * support_analytics_overview()  — the existing Prompt-18 analytics RPC;
//     carries the AUTHORITATIVE "SLA at risk" + "SLA breached" definitions
//     (at risk = active with a future due_at; breached = breach timestamp set
//     or due_at < now()). Reused verbatim — no new SLA logic.
//   * internal_team_workload()      — existing team-workload RPC (open /
//     urgent / sla_risk / waiting / escalated per team).
//   * support_repairs_overview()    — existing repair-overview RPC (awaiting
//     approval / executing / failed / completed today).
//   * support_sessions              — session status counts only (no tokens /
//     customer identity / access URLs are ever selected).
//   * internal_support_tickets      — minimal projection (status / site /
//     created_at / priority / escalation / routing) for ticket states, oldest
//     open ticket, site load and escalations. No customer names, emails,
//     subjects or message contents.
//   * internal_support_sites        — site name mapping (stable Group Site
//     Registry identifiers).
//
// PRIVACY: customer names, emails, phones, subjects, descriptions, message
// bodies, session tokens, access URLs and staff identity never reach the wall.
//
// READ ONLY — no ticket creation, no routing/assignment changes, no SLA edits.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface SupportOverviewRow {
  open_tickets: number;
  new_today: number;
  resolved_today: number;
  urgent_tickets: number;
  sla_at_risk: number;
  sla_breached: number;
  unassigned: number;
  needs_review: number;
  pending_repairs: number;
  active_sessions: number;
}

export interface SupportTeamWorkloadRow {
  team_id: string;
  name: string;
  open_tickets: number;
  urgent_tickets: number;
  sla_risk: number;
  waiting_on_staff: number;
  escalated_tickets: number;
}

export interface SupportRepairMetrics {
  awaiting_approval: number;
  executing: number;
  failed: number;
  completed_today: number;
  medium_pending: number;
}

export interface SupportSessionRow {
  status: string | null;
}

export interface SupportTicketRow {
  id: string;
  status: string | null;
  site_id: string | null;
  created_at: string | null;
  priority: string | null;
  escalation_level: number | null;
  routing_status: string | null;
  due_at: string | null;
}

export interface SupportSiteRow {
  id: string;
  site_name: string | null;
  site_slug: string | null;
}

export interface SupportAvailability {
  overview: boolean;
  teamWorkload: boolean;
  repairs: boolean;
  sessions: boolean;
  tickets: boolean;
  sites: boolean;
}

export interface SupportData {
  loading: boolean;
  lastRefreshed: Date;
  availability: SupportAvailability;
  overview: SupportOverviewRow | null;
  teamWorkload: SupportTeamWorkloadRow[];
  repairs: SupportRepairMetrics | null;
  sessions: SupportSessionRow[];
  tickets: SupportTicketRow[];
  sites: SupportSiteRow[];
}

function emptyAvailability(): SupportAvailability {
  return {
    overview: false,
    teamWorkload: false,
    repairs: false,
    sessions: false,
    tickets: false,
    sites: false,
  };
}

function emptySnapshot(): SupportData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: emptyAvailability(),
    overview: null,
    teamWorkload: [],
    repairs: null,
    sessions: [],
    tickets: [],
    sites: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: SupportData = emptySnapshot();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): SupportData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current support snapshot. */
export function getSupportData(): SupportData {
  return snapshot;
}

/** Subscribe to the support snapshot (re-renders on refresh). */
export function useSupportData(): SupportData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch all six sources independently — a single failed source must not break
// the others, and never breaks the whole wallboard view.
export async function refreshSupportData(): Promise<void> {
  const [
    overviewRes,
    teamWorkloadRes,
    repairsRes,
    sessionsRes,
    ticketsRes,
    sitesRes,
  ] = await Promise.all([
    supabase.rpc('support_analytics_overview', { p_site_id: null }),
    supabase.rpc('internal_team_workload'),
    supabase.rpc('support_repairs_overview'),
    supabase.from('support_sessions').select('status'),
    supabase
      .from('internal_support_tickets')
      .select('id,status,site_id,created_at,priority,escalation_level,routing_status,due_at'),
    supabase.from('internal_support_sites').select('id,site_name,site_slug'),
  ]);

  // support_repairs_overview returns { metrics: { ... } } — flatten to metrics.
  const repairsRaw = (repairsRes.data ?? {}) as { metrics?: Record<string, unknown> };
  const repairMetrics: SupportRepairMetrics = {
    awaiting_approval: (repairsRaw.metrics?.awaiting_approval as number) ?? 0,
    executing: (repairsRaw.metrics?.executing as number) ?? 0,
    failed: (repairsRaw.metrics?.failed as number) ?? 0,
    completed_today: (repairsRaw.metrics?.completed_today as number) ?? 0,
    medium_pending: (repairsRaw.metrics?.medium_pending as number) ?? 0,
  };

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability: {
      overview: !overviewRes.error,
      teamWorkload: !teamWorkloadRes.error,
      repairs: !repairsRes.error,
      sessions: !sessionsRes.error,
      tickets: !ticketsRes.error,
      sites: !sitesRes.error,
    },
    overview: !overviewRes.error ? ((overviewRes.data ?? null) as SupportOverviewRow | null) : null,
    teamWorkload: (teamWorkloadRes.data ?? []) as SupportTeamWorkloadRow[],
    repairs: !repairsRes.error ? repairMetrics : null,
    sessions: (sessionsRes.data ?? []) as SupportSessionRow[],
    tickets: (ticketsRes.data ?? []) as SupportTicketRow[],
    sites: (sitesRes.data ?? []) as SupportSiteRow[],
  };

  emit();
}