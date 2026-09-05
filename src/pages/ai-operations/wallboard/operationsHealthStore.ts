// ============================================================================
// AI Operations — Wallboard Operations Health store.
//
// Read-only snapshot from the authenticated `operations-health` Edge Function,
// which performs a lightweight server-side Supabase database read + Storage
// service check and returns ONLY status + latency + sampled time (no rows,
// bucket names, secrets, URLs or database content).
//
// This is the authoritative live source for the Core Systems SUPABASE and
// STORAGE rows, and the cloud round-trip signal for the NETWORK (DFP
// CONNECTIVITY) row. Never derived from registry/configuration state.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

export type OperationsHealthServiceStatus = 'healthy' | 'degraded' | 'unavailable';

export interface OperationsHealthService {
  status: OperationsHealthServiceStatus;
  latency_ms: number;
}

export interface OperationsHealthSnapshot {
  sampled_at: string | null;
  database: OperationsHealthService;
  storage: OperationsHealthService;
}

export interface OperationsHealthData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether the operations-health Edge Function returned a valid snapshot. */
  availability: boolean;
  snapshot: OperationsHealthSnapshot | null;
}

function emptySnapshot(): OperationsHealthData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: false,
    snapshot: null,
  };
}

let snapshot: OperationsHealthData = emptySnapshot();
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

function getSnapshot(): OperationsHealthData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current operations-health snapshot. */
export function getOperationsHealthData(): OperationsHealthData {
  return snapshot;
}

/** Subscribe to the operations-health snapshot (re-renders on refresh). */
export function useOperationsHealthData(): OperationsHealthData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function normaliseStatus(value: unknown): OperationsHealthServiceStatus {
  if (value === 'healthy' || value === 'degraded') return value;
  return 'unavailable';
}

/** Invoke the authenticated operations-health Edge Function and store the
 *  sanitised snapshot. A failed/unavailable round trip is surfaced honestly as
 *  availability=false (never fabricated into a healthy state). */
export async function refreshOperationsHealthData(): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('operations-health', { body: {} });
    if (error || !data) {
      snapshot = { loading: false, lastRefreshed: new Date(), availability: false, snapshot: null };
      emit();
      return;
    }
    const d = data as Record<string, unknown>;
    const db = (d.database as Record<string, unknown> | null) ?? {};
    const storage = (d.storage as Record<string, unknown> | null) ?? {};
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      availability: true,
      snapshot: {
        sampled_at: typeof d.sampled_at === 'string' ? d.sampled_at : null,
        database: {
          status: normaliseStatus(db.status),
          latency_ms: typeof db.latency_ms === 'number' && db.latency_ms >= 0 ? db.latency_ms : 0,
        },
        storage: {
          status: normaliseStatus(storage.status),
          latency_ms: typeof storage.latency_ms === 'number' && storage.latency_ms >= 0 ? storage.latency_ms : 0,
        },
      },
    };
    emit();
  } catch {
    snapshot = { loading: false, lastRefreshed: new Date(), availability: false, snapshot: null };
    emit();
  }
}