// ============================================================================
// AI Operations — Wallboard Sites & Services Data Store.
//
// Read-only monitoring over public website + external service availability for
// the Digital Footprint group. MONITORING-ONLY: no probes from the browser, no
// DNS changes, no deployment/certificate changes, no restart controls.
//
// SOURCE AUDIT (Wallboard 29):
//   * Group Site Registry (`ai_sites`) — the AUTHORITATIVE site list. Already
//     loaded by the shared group live-data store (groupLiveDataStore → data.sites),
//     so it is NOT re-fetched here. Site availability is derived from the
//     application-level `operational_status` field (deeper than a bare HTTP 200).
//   * Website reachability / response-time / SSL — `internal_monitored_websites`
//     (the existing uptime + certificate monitor, populated server-side). This is
//     the ONLY response-time/SSL source in the system, so it is fetched here and
//     joined onto the registry by normalised domain. NOTE: its monitored domains
//     differ from the `ai_sites` registry domains and its readings are stale —
//     both are surfaced honestly (a stale reading is never shown as current, and
//     an unmatched site is "not monitored", never fabricated).
//   * Public service dependencies (`dfp_service_health`) — ALREADY fetched by
//     infrastructureStore.ts and reused here (getInfrastructureServices()); NOT
//     re-fetched.
//   * Online visitors — ALREADY derived from built-in analytics by the wallboard
//     selectors (getUsersOnline / wallboard_online_presence); reused, not refetched.
//
// Privacy: only friendly labels are exposed. No project_id, no credentials.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shape (friendly projection only) ------------------------------------

export interface MonitoredWebsiteRow {
  id: number;
  website_name: string | null;
  url: string | null;
  environment: string | null;
  status: string | null;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  last_checked_at: string | null;
  ssl_status: string | null;
  expected_status_code: number | null;
}

export interface SiteMonitorData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether internal_monitored_websites was readable. */
  availability: boolean;
  websites: MonitoredWebsiteRow[];
}

function emptySnapshot(): SiteMonitorData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: false,
    websites: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: SiteMonitorData = emptySnapshot();
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

function getSnapshot(): SiteMonitorData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current site-monitor snapshot. */
export function getSiteMonitorData(): SiteMonitorData {
  return snapshot;
}

/** Subscribe to the site-monitor snapshot (re-renders on refresh). */
export function useSiteMonitorData(): SiteMonitorData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch only friendly fields (website name/url/state/latency/SSL/last-check).
// A single failed query never breaks the rest of the wallboard.
export async function refreshSiteMonitorData(): Promise<void> {
  const res = await supabase
    .from('internal_monitored_websites')
    .select(
      'id,website_name,url,environment,status,last_status_code,last_response_time_ms,last_checked_at,ssl_status,expected_status_code',
    )
    .order('website_name', { ascending: true });

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability: !res.error,
    websites: (res.data ?? []) as MonitoredWebsiteRow[],
  };

  emit();
}