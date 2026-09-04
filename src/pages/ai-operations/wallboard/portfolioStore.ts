// ============================================================================
// AI Operations — Wallboard Project Portfolio Data Store.
//
// Read-only aggregation over the EXISTING DFP Command project/build/UAT
// registries. This is NOT a second project-management system — it reuses the
// same sources that already drive the Build Process, Website UAT and
// Deployments surfaces, and only projects friendly fields for a large wall
// display.
//
// SOURCE AUDIT (Wallboard 39):
//   * `internal_projects` — the AUTHORITATIVE active project registry (name,
//     slug, stage, priority, owner, target launch date). This is the same
//     registry the Build Process page reads, so the portfolio is never a
//     hard-coded list.
//   * `internal_build_process_runs` — the build checklists (keyed by
//     project_id) carrying launch-blocker + completion state. This is the
//     authoritative launch-readiness and blocker source.
//   * `uat_projects` — the existing UAT system (status / completion /
//     approval dates).
//   * Group Site Registry (`ai_sites`) — ALREADY loaded by the shared group
//     live-data store and reused via selectors (not re-fetched here) for live
//     site health.
//   * `digital_footprint_deployments` — the deployment ledger, ALREADY loaded
//     by deploymentStore.ts (not re-fetched here). Cross-referenced only.
//
// PRIVACY: private notes/descriptions/objectives/scope/exclusions, revenue,
// costs and any sensitive metadata are deliberately NOT selected. Only
// friendly labels, stage, priority, owner initials and dates reach the wall.
//
// READ ONLY — no project creation, no stage mutation, no launch changes.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface PortfolioProjectRow {
  id: number;
  project_name: string | null;
  project_slug: string | null;
  status: string | null;
  priority: string | null;
  owner: string | null;
  target_launch_date: string | null;
  launched_at: string | null;
  is_client_build: boolean;
  is_internal_tool: boolean;
}

export interface PortfolioBuildRunRow {
  id: number;
  project_id: number | null;
  run_name: string | null;
  run_status: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items: number | null;
  completed_items: number | null;
  launch_blockers_remaining: number | null;
  updated_at: string | null;
}

export interface PortfolioUatRow {
  id: string;
  name: string | null;
  status: string | null;
  completion_date: string | null;
  approval_date: string | null;
  updated_at: string | null;
}

export interface PortfolioData {
  loading: boolean;
  lastRefreshed: Date;
  projectsAvailability: boolean;
  buildRunsAvailability: boolean;
  uatAvailability: boolean;
  projects: PortfolioProjectRow[];
  buildRuns: PortfolioBuildRunRow[];
  uatProjects: PortfolioUatRow[];
}

function emptySnapshot(): PortfolioData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    projectsAvailability: false,
    buildRunsAvailability: false,
    uatAvailability: false,
    projects: [],
    buildRuns: [],
    uatProjects: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: PortfolioData = emptySnapshot();
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

function getSnapshot(): PortfolioData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current portfolio snapshot. */
export function getPortfolioData(): PortfolioData {
  return snapshot;
}

/** Subscribe to the portfolio snapshot (re-renders on refresh). */
export function usePortfolioData(): PortfolioData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch all three registries independently — a single failed source must not
// break the others, and never breaks the whole wallboard view.
export async function refreshPortfolioData(): Promise<void> {
  const [projectsRes, buildRunsRes, uatRes] = await Promise.all([
    supabase
      .from('internal_projects')
      .select('id,project_name,project_slug,status,priority,owner,target_launch_date,launched_at,is_client_build,is_internal_tool')
      .order('id', { ascending: true }),
    supabase
      .from('internal_build_process_runs')
      .select('id,project_id,run_name,run_status,started_at,completed_at,total_items,completed_items,launch_blockers_remaining,updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('uat_projects')
      .select('id,name,status,completion_date,approval_date,updated_at')
      .order('updated_at', { ascending: false }),
  ]);

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    projectsAvailability: !projectsRes.error,
    buildRunsAvailability: !buildRunsRes.error,
    uatAvailability: !uatRes.error,
    projects: (projectsRes.data ?? []) as PortfolioProjectRow[],
    buildRuns: (buildRunsRes.data ?? []) as PortfolioBuildRunRow[],
    uatProjects: (uatRes.data ?? []) as PortfolioUatRow[],
  };

  emit();
}