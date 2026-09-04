// ============================================================================
// AI Operations — Wallboard Deployments & Releases Data Store.
//
// Read-only aggregation over the EXISTING deployment/release registries:
//   * digital_footprint_deployments — the deployment record ledger (repo,
//     branch, commit, build status, deployment status, timestamps).
//   * operational_releases — the production release ledger (version, git ref,
//     owner, summary, rollback notes, previous stable version).
//
// The LIVE deployment health signal is read from dfp_service_health
// ("deployment" service) — ALREADY fetched by infrastructureStore.ts, so it is
// NOT re-fetched here (reused via getInfrastructureData()).
//
// READ ONLY — no deploys, no rollbacks, no CI/CD, no GitHub workflows, no new
// tables. This view never triggers a build or a release. It only reports.
//
// PRIVACY: build_errors and full release notes/edge-function payloads are
// deliberately NOT selected — raw logs and secret-bearing metadata never reach
// the wallboard. Only concise commit/version identifiers are surfaced.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface DeploymentRow {
  id: string;
  project_id: string | null;
  github_repo: string | null;
  branch: string | null;
  latest_commit: string | null;
  build_status: string | null;
  deployment_status: string | null;
  deployed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReleaseRow {
  id: string;
  version: string | null;
  status: string | null;
  release_date: string | null;
  git_ref: string | null;
  release_owner: string | null;
  summary: string | null;
  frontend_deployment_ref: string | null;
  previous_stable_version: string | null;
  rollback_notes: string | null;
  created_at: string | null;
}

export interface DeploymentData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether digital_footprint_deployments was readable. */
  deploymentsAvailability: boolean;
  /** Whether operational_releases was readable. */
  releasesAvailability: boolean;
  deployments: DeploymentRow[];
  releases: ReleaseRow[];
}

function emptySnapshot(): DeploymentData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    deploymentsAvailability: false,
    releasesAvailability: false,
    deployments: [],
    releases: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: DeploymentData = emptySnapshot();
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

function getSnapshot(): DeploymentData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current deployment snapshot. */
export function getDeploymentData(): DeploymentData {
  return snapshot;
}

/** Subscribe to the deployment snapshot (re-renders on refresh). */
export function useDeploymentData(): DeploymentData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch both registries independently — a single failed source must not break
// the other, and never breaks the whole wallboard view.
export async function refreshDeploymentData(): Promise<void> {
  const [deploymentsRes, releasesRes] = await Promise.all([
    supabase
      .from('digital_footprint_deployments')
      .select('id,project_id,github_repo,branch,latest_commit,build_status,deployment_status,deployed_at,created_at,updated_at')
      .order('deployed_at', { ascending: false }),
    supabase
      .from('operational_releases')
      .select('id,version,status,release_date,git_ref,release_owner,summary,frontend_deployment_ref,previous_stable_version,rollback_notes,created_at')
      .order('release_date', { ascending: false }),
  ]);

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    deploymentsAvailability: !deploymentsRes.error,
    releasesAvailability: !releasesRes.error,
    deployments: (deploymentsRes.data ?? []) as DeploymentRow[],
    releases: (releasesRes.data ?? []) as ReleaseRow[],
  };

  emit();
}