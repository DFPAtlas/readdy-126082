// ============================================================================
// DFP COMMAND — Runtime Resilience store (HAL + TRON).
//
// A thin module-level store over the existing Runtime Resilience service layer
// (src/lib/ai-operations/runtimeResilience.ts). No Supabase queries or state
// evaluation live here — it only holds the last composed/evaluated view and
// exposes a refresh + subscribe API, mirroring the other wallboard stores.
//
// The standalone Runtime Resilience band was removed from the wall; HAL/TRON
// resilience now renders inside the Compute Core cards, the estate summary
// renders inside the DFP Relay centre, and recovery events flow through the
// Live Events ticker. They all read this store synchronously via
// getRuntimeResilienceView(), and re-render through useWallData().
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  loadRuntimeResilience,
  type RuntimeResilienceView,
} from '@/lib/ai-operations/runtimeResilience';

let view: RuntimeResilienceView | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RuntimeResilienceView | null {
  return view;
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to the resilience view (re-renders on each refresh). */
export function useRuntimeResilience(): RuntimeResilienceView | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Read the latest composed resilience view (synchronous getter). */
export function getRuntimeResilienceView(): RuntimeResilienceView | null {
  return view;
}

/** Refresh the resilience view from the service layer. Safe to call on the
 *  wallboard refresh cadence; failures leave the previous view intact. */
export async function refreshRuntimeResilience(): Promise<void> {
  try {
    const next = await loadRuntimeResilience();
    view = next;
  } catch {
    view = null;
  }
  emit();
}