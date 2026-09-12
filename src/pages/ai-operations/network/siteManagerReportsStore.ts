// ============================================================================
// DFP AI Operations — Site manager reports store (generalised).
//
// Generalises the QuickGuard manager-report reading pattern to EVERY configured
// site manager. Each site manager's autonomous workflow persists its report
// into `ai_site_manager_reports` (site_key + workflow_id); this store reads the
// NEWEST report per exact (site_key, workflow_id) mapping.
//
// Mapping resolution (stable IDs only — never display-name substrings):
//   * The QuickGuard mapping is preserved verbatim (its wall contract is
//     untouched) so its widget keeps rendering identically.
//   * Every other mapping comes from `ai_n8n_workflow_registry`: a workflow row
//     with a `site_id` + `n8n_workflow_id` maps `ai_sites.site_key` →
//     `n8n_workflow_id`. This is the explicit stored site/workflow mapping.
//
// Honesty rules honoured here (shared with the QuickGuard store):
//   * `observed_at` is the ONLY freshness source; `received_at` is used only as
//     an ordering tiebreak and never to make an old observation look fresh.
//   * One fetch PER mapping (never a single globally-limited collection), so a
//     site whose report is outside a global limit is still resolved correctly.
//   * A query failure → UNAVAILABLE; no report row → AWAITING REPORT.
//   * Retains the last successful snapshot on failure with a visible `stale`
//     flag (never silently falls back to fabricated data).
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import {
  QUICKGUARD_SITE_KEY,
  QUICKGUARD_WORKFLOW_ID,
  type ManagerReportRow,
} from '@/pages/ai-operations/wallboard/managerReportStore';

// --- Mapping shape ------------------------------------------------------------

export interface SiteManagerReportMapping {
  /** Stable ai_sites.site_key. */
  siteKey: string;
  /** Stable report workflow id (n8n_workflow_id). */
  workflowId: string;
  /** Human label for the workflow (registry name, falling back to workflow_key). */
  label: string;
}

export interface SiteManagerReportEntry {
  mapping: SiteManagerReportMapping;
  /** Newest report for this exact mapping, or null when none exists yet. */
  report: ManagerReportRow | null;
}

export interface SiteManagerReportsData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether ALL mapping queries succeeded (no query error). */
  available: boolean;
  /** Retained last-good data after a failed refresh. */
  stale: boolean;
  mappings: SiteManagerReportMapping[];
  entries: SiteManagerReportEntry[];
}

function emptySnapshot(): SiteManagerReportsData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    available: false,
    stale: false,
    mappings: [],
    entries: [],
  };
}

// --- External store (module-level) --------------------------------------------

let snapshot: SiteManagerReportsData = emptySnapshot();
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

function getSnapshot(): SiteManagerReportsData {
  return snapshot;
}

export function getSiteManagerReportsData(): SiteManagerReportsData {
  return snapshot;
}

export function useSiteManagerReportsData(): SiteManagerReportsData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Mapping resolution -------------------------------------------------------

/**
 * All configured (site_key, workflow_id) report mappings:
 *   * QuickGuard's explicit mapping (preserved).
 *   * Every n8n registry workflow with a site_id + n8n_workflow_id, resolved by
 *     ai_sites.id → site_key (never a display name or abbreviation).
 * Deduplicated by the (siteKey, workflowId) pair.
 */
export function resolveSiteManagerReportMappings(): SiteManagerReportMapping[] {
  const data = getGroupLiveData();
  const n8n = getN8nData();

  const seen = new Set<string>();
  const mappings: SiteManagerReportMapping[] = [];

  const push = (siteKey: string, workflowId: string, label: string) => {
    const dedupe = `${siteKey}\u0000${workflowId}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    mappings.push({ siteKey, workflowId, label });
  };

  // QuickGuard explicit mapping (preserve contract).
  push(QUICKGUARD_SITE_KEY, QUICKGUARD_WORKFLOW_ID, 'QuickGuard Autonomous Manager');

  // n8n registry mappings (stable ids).
  for (const w of n8n.workflows) {
    if (!w.n8n_workflow_id || !w.site_id) continue;
    const siteKey = data.siteKeyByUuid.get(w.site_id);
    if (!siteKey) continue;
    push(siteKey, w.n8n_workflow_id, w.name ?? w.workflow_key);
  }

  return mappings;
}

// --- Loader -------------------------------------------------------------------

const REPORT_COLUMNS =
  'id,site_key,workflow_id,execution_id,workflow_status,business_health,observed_at,received_at,report';

/** Fetch the newest report per exact site/workflow mapping (parallel queries —
 *  never a single globally-limited collection). Retains last-good on failure. */
export async function refreshSiteManagerReports(): Promise<void> {
  const mappings = resolveSiteManagerReportMappings();

  if (mappings.length === 0) {
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      available: true,
      stale: false,
      mappings: [],
      entries: [],
    };
    emit();
    return;
  }

  let allAvailable = true;

  try {
    const results = await Promise.all(
      mappings.map(async (mapping) => {
        try {
          const { data, error } = await supabase
            .from('ai_site_manager_reports')
            .select(REPORT_COLUMNS)
            .eq('site_key', mapping.siteKey)
            .eq('workflow_id', mapping.workflowId)
            .order('observed_at', { ascending: false })
            .order('received_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            allAvailable = false;
            return { mapping, report: null as ManagerReportRow | null };
          }
          return { mapping, report: (data ?? null) as ManagerReportRow | null };
        } catch {
          allAvailable = false;
          return { mapping, report: null as ManagerReportRow | null };
        }
      }),
    );

    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      available: allAvailable,
      stale: false,
      mappings,
      entries: results,
    };
  } catch {
    // Defensive — retain last-good with a stale flag.
    snapshot = {
      ...snapshot,
      loading: false,
      lastRefreshed: new Date(),
      available: false,
      stale: true,
    };
  }

  emit();
}