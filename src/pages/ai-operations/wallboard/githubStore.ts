// ============================================================================
// AI Operations — Wallboard GitHub & Repository Health Data Store.
//
// Read-only aggregation over the EXISTING GitHub integration:
//   * list-github-repos edge function — the authoritative live GitHub registry
//     (repo metadata, default branch, visibility, archived, last push time).
//
// The project ↔ repository relationship is NOT re-fetched here. It is reused
// from the deployment ledger (digital_footprint_deployments.github_repo),
// ALREADY loaded by deploymentStore.ts — this store cross-references it via
// getDeploymentData() rather than issuing a duplicate query.
//
// READ ONLY — no repo creation, deletion, archiving, branch changes, PR merges,
// deployment triggers, or workflow rewrites. This store only reads and reports.
//
// PRIVACY: secrets, raw commit bodies, CI logs, and code diffs are NEVER
// selected. Only repo names, default branches, visibility, and activity
// timestamps reach the wallboard.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shape (privacy-safe projection from list-github-repos) --------------

export interface GithubRepoRow {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  fork: boolean;
  private: boolean;
  archived: boolean;
  default_branch: string | null;
  updated_at: string | null;
  pushed_at: string | null;
  created_at: string | null;
}

export interface GithubData {
  loading: boolean;
  lastRefreshed: Date;
  /** True when GitHub was reachable and the registry returned (even if empty). */
  available: boolean;
  error: string | null;
  repos: GithubRepoRow[];
}

function emptySnapshot(): GithubData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    available: false,
    error: null,
    repos: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: GithubData = emptySnapshot();
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

function getSnapshot(): GithubData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current GitHub snapshot. */
export function getGithubData(): GithubData {
  return snapshot;
}

/** Subscribe to the GitHub snapshot (re-renders on refresh). */
export function useGithubData(): GithubData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

export async function refreshGithubData(): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('list-github-repos');
    if (error) {
      const ctx = (error as unknown as { context?: { status?: number } }).context;
      const message =
        ctx?.status === 500
          ? 'GitHub token is not configured or the API is unreachable.'
          : error.message || 'Failed to reach GitHub.';
      throw new Error(message);
    }
    if (data?.error) throw new Error(String(data.error));
    const repos = (data?.repos as GithubRepoRow[]) ?? [];
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      available: true,
      error: null,
      repos,
    };
  } catch (e: unknown) {
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      available: false,
      error: e instanceof Error ? e.message : 'Failed to reach GitHub.',
      repos: [],
    };
  }
  emit();
}