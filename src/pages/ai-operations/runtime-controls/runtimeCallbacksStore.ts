// ============================================================================
// AI Operations — Runtime callback boundary store (Phase 3 Prompt 07).
//
// Session state for the secure inbound machine-message boundary. Loads the
// append-only `ai_runtime_callbacks` ledger (internal staff read-only) and
// derives a fail-closed safety summary. The browser can never insert a
// callback row — records are created only by the `ai-runtime-callback` Edge
// Function using its service-role client.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getAiRuntimeCallbacks,
  deriveCallbackSummary,
  type AiRuntimeCallback,
  type CallbackBoundarySummary,
} from '@/lib/ai-operations/runtimeCallbacks';

interface RuntimeCallbacksState {
  callbacks: AiRuntimeCallback[];
  summary: CallbackBoundarySummary | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: RuntimeCallbacksState = {
  callbacks: [],
  summary: null,
  loading: false,
  error: null,
};

let snapshot: RuntimeCallbacksState = { ...EMPTY };
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

function getSnapshot(): RuntimeCallbacksState {
  return snapshot;
}

function setSnapshot(next: RuntimeCallbacksState) {
  snapshot = next;
  emit();
}

export function useRuntimeCallbacks(): RuntimeCallbacksState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRuntimeCallbacksState(): RuntimeCallbacksState {
  return snapshot;
}

export async function refreshCallbacks(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true, error: null });

  const res = await getAiRuntimeCallbacks(200);
  const state = getSnapshot();
  if (res.error) {
    setSnapshot({ ...state, loading: false, error: res.error });
    return;
  }

  const callbacks = res.data ?? [];
  setSnapshot({
    ...state,
    callbacks,
    summary: deriveCallbackSummary(callbacks),
    loading: false,
    error: null,
  });
}