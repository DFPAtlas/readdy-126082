// ============================================================================
// AI Operations — Operations Wall widget configuration store.
//
// A single read-only subscription over the persistent `ai_site_widgets`
// configuration (one widget per `ai_sites.id`). The wall's site modules and
// master-agent rows are derived from this snapshot — there is NO hard-coded
// site membership anywhere in the wall.
//
// Resilience contract (Prompt 3/3):
//   * On a successful fetch, the snapshot is replaced and `stale` clears.
//   * On a FAILED fetch, the last successful configuration is RETAINED and a
//     visible `stale` flag is set — the wall never silently falls back to
//     hard-coded defaults (which could resurrect hidden widgets).
//   * A brand-new device with no prior success shows an empty estate plus the
//     stale warning; it never fabricates sites.
//
// Refresh is driven through the existing wallboard refresh lifecycle
// (page.tsx → performRefresh), so dashboard changes reach the wall without a
// redeployment.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { getWallWidgetConfigs, type WallWidgetConfigRow } from '@/lib/ai-operations/wallWidgetConfig';

export interface WidgetConfigData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether the most recent fetch succeeded. */
  availability: boolean;
  /** Last successfully loaded widgets (retained across failed fetches). */
  widgets: WallWidgetConfigRow[];
  /** True when we are showing retained data after a failed fetch. */
  stale: boolean;
  /** User-safe error message from the most recent failed fetch (null when ok). */
  lastError: string | null;
}

function emptySnapshot(): WidgetConfigData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: false,
    widgets: [],
    stale: false,
    lastError: null,
  };
}

// --- External store (module-level) --------------------------------------------

let snapshot: WidgetConfigData = emptySnapshot();
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

function getSnapshot(): WidgetConfigData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current widget-config snapshot. */
export function getWidgetConfigData(): WidgetConfigData {
  return snapshot;
}

/** Subscribe to the widget-config snapshot (re-renders on refresh). */
export function useWidgetConfigData(): WidgetConfigData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

/** Fetch the saved widget configuration, retaining the last good config on
 *  failure (with a visible stale flag) instead of wiping the wall. */
export async function refreshWidgetConfigData(): Promise<void> {
  let result: Awaited<ReturnType<typeof getWallWidgetConfigs>>;
  try {
    result = await getWallWidgetConfigs();
  } catch (err) {
    // getWallWidgetConfigs never throws by contract, but guard defensively.
    snapshot = {
      ...snapshot,
      loading: false,
      lastRefreshed: new Date(),
      availability: false,
      stale: true,
      lastError: 'Unable to load widget configuration.',
    };
    emit();
    return;
  }

  if (result.error) {
    // Retain the last successful configuration and flag it as stale.
    snapshot = {
      ...snapshot,
      loading: false,
      lastRefreshed: new Date(),
      availability: false,
      stale: true,
      lastError: result.error,
    };
  } else {
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      availability: true,
      widgets: result.data ?? [],
      stale: false,
      lastError: null,
    };
  }

  emit();
}