// ============================================================================
// AI Operations — Wallboard Infrastructure Data Store.
//
// A read-only aggregation over the EXISTING infrastructure/service registries:
//   * dfp_service_health  — the registered Digital Footprint service health
//     registry (populated server-side by the dfp-health-probe cron). This is
//     the authoritative "registered services" source.
//   * ai_runtime_bridge_nodes / _heartbeats — the local runtime host (HAL),
//     read through the shared runtimeHealthStore (NOT re-fetched here).
//
// READ ONLY — no writes, no new tables, no new monitoring platform. This store
// only fetches dfp_service_health; the HAL host + heartbeat are reused from
// runtimeHealthStore so there is exactly one source of truth for each.
//
// There is deliberately NO physical-device registry (Proxmox / TrueNAS /
// OPNsense / network switches) and no CPU/RAM/disk/temperature metric source in
// the codebase — those are surfaced honestly as "not monitored", never
// fabricated.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shape (minimal projection only) -----------------------------------

export interface InfraServiceRow {
  id: string;
  service: string;
  display_name: string | null;
  category: string | null;
  status: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  message: string | null;
  checked_at: string | null;
  environment: string | null;
}

export interface InfrastructureData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether dfp_service_health was readable (independent of HAL/bridge). */
  availability: boolean;
  services: InfraServiceRow[];
}

function emptySnapshot(): InfrastructureData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: false,
    services: [],
  };
}

// --- External store (module-level) -----------------------------------------

let snapshot: InfrastructureData = emptySnapshot();
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

function getSnapshot(): InfrastructureData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current infrastructure snapshot. */
export function getInfrastructureData(): InfrastructureData {
  return snapshot;
}

/** Subscribe to the infrastructure snapshot (re-renders on refresh). */
export function useInfrastructureData(): InfrastructureData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ----------------------------------------------------------------

export async function refreshInfrastructureData(): Promise<void> {
  const res = await supabase
    .from('dfp_service_health')
    .select('id,service,display_name,category,status,status_code,response_time_ms,message,checked_at,environment')
    .order('category', { ascending: true });

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability: !res.error,
    services: (res.data ?? []) as InfraServiceRow[],
  };

  emit();
}