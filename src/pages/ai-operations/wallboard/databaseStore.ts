// ============================================================================
// AI Operations — Wallboard Database & Supabase Data Store.
//
// Read-only monitoring over database/backend operational health for the Digital
// Footprint group. MONITORING-ONLY: no schema changes, no RLS changes, no
// grants, no destructive SQL, no migration execution, no SQL editor.
//
// SOURCE AUDIT (Wallboard 44):
//   * `internal_supabase_monitors` — the authoritative Supabase project
//     registry. Each row is a monitored backend with per-service status for
//     DATABASE / AUTH / STORAGE / EDGE FUNCTIONS / REALTIME, plus key-config
//     flags and last-check time. This is the SAME source the System Status →
//     Supabase tab reads. Multiple projects are supported (no single-project
//     assumption).
//   * `internal_edge_function_monitors` — the authoritative Edge Function
//     monitor registry (function_name, status, last success/failure).
//   * `internal_projects` — the project registry for the friendly site
//     relationship (project_id → project_name).
//   * The LIVE per-service latency probe (`supabase_database` / `supabase_auth`
//     / `supabase_storage`) is read from `dfp_service_health` — ALREADY fetched
//     by infrastructureStore.ts, so it is NOT re-fetched here (reused via
//     getInfrastructureData()).
//   * Backup risk is reused from backupStore.ts — never duplicated.
//
// Privacy: `supabase_url`, `function_url`, `required_env_vars`, and raw error
// messages are NEVER selected. Only booleans (key configured?), status labels,
// friendly names, timestamps and response times reach the wall.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface SupabaseMonitorRow {
  id: number;
  project_id: number;
  supabase_project_name: string;
  anon_key_configured: boolean;
  service_role_configured: boolean;
  database_status: string | null;
  auth_status: string | null;
  storage_status: string | null;
  edge_functions_status: string | null;
  realtime_status: string | null;
  last_checked_at: string | null;
}

export interface EdgeFunctionMonitorRow {
  id: number;
  project_id: number;
  function_name: string;
  status: string | null;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  last_success_at: string | null;
  last_failure_at: string | null;
}

export interface ProjectRow {
  id: number;
  project_name: string;
}

export interface DatabaseData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether internal_supabase_monitors was readable. */
  monitorsAvailability: boolean;
  /** Whether internal_edge_function_monitors was readable. */
  edgeFunctionsAvailability: boolean;
  /** Whether internal_projects was readable. */
  projectsAvailability: boolean;
  monitors: SupabaseMonitorRow[];
  edgeFunctions: EdgeFunctionMonitorRow[];
  projects: ProjectRow[];
}

function emptySnapshot(): DatabaseData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    monitorsAvailability: false,
    edgeFunctionsAvailability: false,
    projectsAvailability: false,
    monitors: [],
    edgeFunctions: [],
    projects: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: DatabaseData = emptySnapshot();
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

function getSnapshot(): DatabaseData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current database snapshot. */
export function getDatabaseData(): DatabaseData {
  return snapshot;
}

/** Subscribe to the database snapshot (re-renders on refresh). */
export function useDatabaseData(): DatabaseData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch all three registries independently — a single failed source must not
// break the others, and never breaks the whole wallboard view.
export async function refreshDatabaseData(): Promise<void> {
  const [monitorsRes, edgeRes, projectsRes] = await Promise.all([
    supabase
      .from('internal_supabase_monitors')
      .select(
        'id,project_id,supabase_project_name,anon_key_configured,service_role_configured,database_status,auth_status,storage_status,edge_functions_status,realtime_status,last_checked_at',
      )
      .order('id', { ascending: true }),
    supabase
      .from('internal_edge_function_monitors')
      .select(
        'id,project_id,function_name,status,last_status_code,last_response_time_ms,last_success_at,last_failure_at',
      )
      .order('id', { ascending: true }),
    supabase.from('internal_projects').select('id,project_name').order('project_name', { ascending: true }),
  ]);

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    monitorsAvailability: !monitorsRes.error,
    edgeFunctionsAvailability: !edgeRes.error,
    projectsAvailability: !projectsRes.error,
    monitors: (monitorsRes.data ?? []) as SupabaseMonitorRow[],
    edgeFunctions: (edgeRes.data ?? []) as EdgeFunctionMonitorRow[],
    projects: (projectsRes.data ?? []) as ProjectRow[],
  };

  emit();
}