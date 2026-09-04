// ============================================================================
// AI Operations — Wallboard Backups & Recovery Data Store.
//
// Read-only monitoring over backup & recovery state for the Digital Footprint
// group. MONITORING-ONLY: no backup jobs, no restore, no retention changes, no
// delete/snapshot controls.
//
// SOURCE AUDIT (Wallboard 28):
//   * `backup_records` — the authoritative backup registry (holds last
//     success, verification status and friendly destination per target).
//   * `restore_drills` — the authoritative restore/test registry.
//   * The LIVE health signal (is the backup currently stale/failed) is read
//     from `dfp_service_health` ("backups" service) — ALREADY fetched by
//     infrastructureStore.ts, so it is NOT re-fetched here (reused via
//     getInfrastructureData()).
//   * `bs_backup_checks`, `digital_footprint_backups`, `bs_restore_exercises`,
//     `bs_recovery_runs` / `bs_recovery_checks`, `bs_operational_snapshots` and
//     `restore_tests` all exist but are EMPTY (0 rows) — no additional data.
//   * There is NO Proxmox / TrueNAS / ZFS / Docker / NAS / GitHub-source /
//     off-site backup telemetry anywhere in the system — those are surfaced
//     honestly as "not monitored" (backup gaps), never fabricated.
//
// Privacy: only friendly labels are exposed. provider_reference, evidence
// summaries, user ids and obfuscated environment strings are never selected.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface BackupRecordRow {
  id: string;
  backup_type: string | null;
  backup_scope: string | null;
  provider: string | null;
  environment: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  encryption_status: string | null;
  verification_status: string | null;
  verified_at: string | null;
  retention_until: string | null;
  notes: string | null;
}

export interface RestoreDrillRow {
  id: string;
  drill_reference: string | null;
  status: string | null;
  planned_at: string | null;
  completed_at: string | null;
  database_result: string | null;
  storage_result: string | null;
  application_result: string | null;
  recovery_time_minutes: number | null;
  recovery_point_gap_minutes: number | null;
  issues_found: string | null;
}

export interface BackupData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether backup_records was readable (independent of restore_drills). */
  recordsAvailability: boolean;
  /** Whether restore_drills was readable. */
  drillsAvailability: boolean;
  records: BackupRecordRow[];
  drills: RestoreDrillRow[];
}

function emptySnapshot(): BackupData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    recordsAvailability: false,
    drillsAvailability: false,
    records: [],
    drills: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: BackupData = emptySnapshot();
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

function getSnapshot(): BackupData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current backup snapshot. */
export function getBackupData(): BackupData {
  return snapshot;
}

/** Subscribe to the backup snapshot (re-renders on refresh). */
export function useBackupData(): BackupData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch both registries independently — a single failed source must not break
// the other, and never breaks the whole wallboard view.
export async function refreshBackupData(): Promise<void> {
  const [recordsRes, drillsRes] = await Promise.all([
    supabase
      .from('backup_records')
      .select(
        'id,backup_type,backup_scope,provider,environment,status,started_at,completed_at,encryption_status,verification_status,verified_at,retention_until,notes',
      )
      .order('completed_at', { ascending: false }),
    supabase
      .from('restore_drills')
      .select(
        'id,drill_reference,status,planned_at,completed_at,database_result,storage_result,application_result,recovery_time_minutes,recovery_point_gap_minutes,issues_found',
      )
      .order('planned_at', { ascending: false }),
  ]);

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    recordsAvailability: !recordsRes.error,
    drillsAvailability: !drillsRes.error,
    records: (recordsRes.data ?? []) as BackupRecordRow[],
    drills: (drillsRes.data ?? []) as RestoreDrillRow[],
  };

  emit();
}