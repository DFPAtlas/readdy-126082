// ============================================================================
// AI Operations — Wallboard QuickGuard Autonomous Manager Report store.
//
// Read-only, live master-report signal for the QuickGuard site's autonomous
// manager workflow. The report is produced by the n8n workflow
// (workflow_id = SzPl8DDm3aBAAOjI, workflow_key = quickguard-autonomous-manager-01)
// and persisted into `ai_site_manager_reports` by the workflow's own observer
// (NOT by DFP Command). This store only READS the newest report — it never
// triggers the workflow, never writes, and never changes any heartbeat.
//
// SOURCE AUDIT:
//   * `ai_site_manager_reports` — authoritative manager-report table.
//   * The newest row for site_key = 'quickguard' + workflow_id = 'SzPl8DDm3aBAAOjI',
//     ordered by observed_at DESC, then received_at DESC, limit 1.
//   * Read via the signed-in Supabase client under existing RLS.
//
// Honesty rules honoured here:
//   * `observed_at` is the ONLY freshness source — `received_at` is used only as
//     an ordering tiebreak and NEVER to make an old observation look fresh.
//   * A query failure is surfaced as UNAVAILABLE, never a fabricated state.
//   * No report row is surfaced as AWAITING REPORT, never a fabricated state.
//   * This is the reporting/health signal — the shared n8n service reachability
//     lives separately in n8nStore and is never conflated with this workflow's
//     reporting status.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// Stable, authoritative references (do not re-derive from names).
export const QUICKGUARD_SITE_KEY = 'quickguard';
export const QUICKGUARD_WORKFLOW_ID = 'SzPl8DDm3aBAAOjI';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface ManagerReportCoverage {
  queryLimits?: Record<string, number>;
  possiblyTruncated?: Record<string, boolean>;
  countsAreObservedRows?: boolean;
}

export interface ManagerRecommendedAction {
  agent?: string | null;
  action?: string | null;
  priority?: string | null;
  autonomous?: boolean;
}

export interface ManagerReportPayload {
  host?: string | null;
  site?: string | null;
  health?: string | null;
  manager?: string | null;
  metrics?: Record<string, number>;
  reasons?: string[];
  coverage?: ManagerReportCoverage;
  overseer?: string | null;
  authority?: Record<string, boolean>;
  observedAt?: string | null;
  operatingMode?: string | null;
  managerVersion?: string | null;
  recommendedActions?: ManagerRecommendedAction[];
}

export interface ManagerReportRow {
  id: string;
  site_key: string;
  workflow_id: string;
  execution_id: string | null;
  workflow_status: string | null;
  business_health: string | null;
  observed_at: string | null;
  received_at: string | null;
  report: ManagerReportPayload | null;
}

export interface ManagerReportData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether the ai_site_manager_reports query succeeded (no error). */
  available: boolean;
  /** Newest report row, or null when no report exists yet. */
  report: ManagerReportRow | null;
}

function emptySnapshot(): ManagerReportData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    available: false,
    report: null,
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: ManagerReportData = emptySnapshot();
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

function getSnapshot(): ManagerReportData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current manager-report snapshot. */
export function getManagerReportData(): ManagerReportData {
  return snapshot;
}

/** Subscribe to the manager-report snapshot (re-renders on refresh). */
export function useManagerReportData(): ManagerReportData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

/** Fetch the newest QuickGuard manager report. A failure only marks the report
 *  unavailable — it never breaks the rest of the wallboard view. */
export async function refreshManagerReportData(): Promise<void> {
  let report: ManagerReportRow | null = null;
  let available = false;

  try {
    const { data, error } = await supabase
      .from('ai_site_manager_reports')
      .select(
        'id,site_key,workflow_id,execution_id,workflow_status,business_health,observed_at,received_at,report',
      )
      .eq('site_key', QUICKGUARD_SITE_KEY)
      .eq('workflow_id', QUICKGUARD_WORKFLOW_ID)
      .order('observed_at', { ascending: false })
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    available = error === null;
    report = (data ?? null) as ManagerReportRow | null;
  } catch {
    available = false;
    report = null;
  }

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    available,
    report,
  };

  emit();
}