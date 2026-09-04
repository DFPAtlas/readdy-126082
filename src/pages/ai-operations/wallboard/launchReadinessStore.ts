// ============================================================================
// AI Operations — Wallboard Group Launch Readiness Data Store.
//
// Read-only aggregation over the EXISTING build-process checklist ITEMS — the
// authoritative per-item launch-blocker + mandatory-check source. This store
// fetches ONLY the item-level data that the Project Portfolio (Wallboard 39)
// deliberately left out; everything else (projects, build runs, UAT, Group
// Site Registry) is reused from the existing portfolioStore, and deployment
// state is reused from deploymentStore.
//
// SOURCE: `internal_build_process_run_items` — the same table the Build
// Process "Launch Readiness" tab reads. Each item carries phase / stage_title /
// item_title plus `is_required`, `is_launch_blocker` and `checked`, which is
// enough to derive a blocker CATEGORY (UAT / PAYMENT / LEGAL / SECURITY /
// DEPLOYMENT / CONFIGURATION) and mandatory-check completion WITHOUT exposing
// any sensitive defect detail.
//
// PRIVACY: item notes, blocker_notes, owner and due dates are deliberately NOT
// selected — only category-level aggregates ever reach the wall.
//
// READ ONLY — no checklist mutation, no launch changes, no new tables.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shape (minimal, privacy-safe projection only) -----------------------

export interface LaunchReadinessItemRow {
  id: number;
  run_id: number;
  stage_title: string | null;
  item_title: string | null;
  is_required: boolean;
  is_launch_blocker: boolean;
  checked: boolean;
  status: string | null;
  updated_at: string | null;
}

export interface LaunchReadinessData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether internal_build_process_run_items was readable. */
  itemsAvailability: boolean;
  items: LaunchReadinessItemRow[];
}

function emptySnapshot(): LaunchReadinessData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    itemsAvailability: false,
    items: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: LaunchReadinessData = emptySnapshot();
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

function getSnapshot(): LaunchReadinessData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current launch-readiness snapshot. */
export function getLaunchReadinessData(): LaunchReadinessData {
  return snapshot;
}

/** Subscribe to the launch-readiness snapshot (re-renders on refresh). */
export function useLaunchReadinessData(): LaunchReadinessData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

export async function refreshLaunchReadinessData(): Promise<void> {
  const res = await supabase
    .from('internal_build_process_run_items')
    .select('id,run_id,stage_title,item_title,is_required,is_launch_blocker,checked,status,updated_at')
    .order('run_id', { ascending: true });

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    itemsAvailability: !res.error,
    items: (res.data ?? []) as LaunchReadinessItemRow[],
  };

  emit();
}