// ============================================================================
// AI Operations — Runtime controls store (Phase 3 Prompt 04).
//
// Shared session state for the runtime safety-control layer. Loads the
// authoritative controls (master kill switch, risk gate, site/agent gates) and
// their append-only history, and routes sensitive changes through the
// `apply_runtime_control_change` SECURITY DEFINER RPC (owner-only master switch,
// reason required, atomic history + audit).
//
// Governance only — no execution is performed here.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getAiRuntimeControls,
  getAiRuntimeControlHistory,
  applyRuntimeControlChange,
  type AiRuntimeControlRow,
  type AiRuntimeControlHistoryRow,
} from '@/lib/ai-operations/runtimeControls';

interface RuntimeControlsState {
  controls: AiRuntimeControlRow[];
  history: AiRuntimeControlHistoryRow[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  changeError: string | null;
}

const EMPTY: RuntimeControlsState = {
  controls: [],
  history: [],
  loading: false,
  error: null,
  saving: false,
  changeError: null,
};

let snapshot: RuntimeControlsState = { ...EMPTY };
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

function getSnapshot(): RuntimeControlsState {
  return snapshot;
}

function setSnapshot(next: RuntimeControlsState) {
  snapshot = next;
  emit();
}

export function useRuntimeControls(): RuntimeControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRuntimeControlsState(): RuntimeControlsState {
  return snapshot;
}

// --- Loaders ------------------------------------------------------------------

export async function refreshControls(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true, error: null });

  const [controlsRes, historyRes] = await Promise.all([
    getAiRuntimeControls(),
    getAiRuntimeControlHistory(200),
  ]);

  const state = getSnapshot();
  if (controlsRes.error) {
    setSnapshot({ ...state, loading: false, error: controlsRes.error });
    return;
  }

  setSnapshot({
    ...state,
    controls: controlsRes.data ?? [],
    history: historyRes.data ?? [],
    loading: false,
    error: null,
  });
}

// --- Actions ------------------------------------------------------------------

export async function changeRuntimeControl(
  controlKey: string,
  next: { enabled: boolean; execution_allowed: boolean },
  reason: string,
): Promise<{ error: string | null }> {
  setSnapshot({ ...getSnapshot(), saving: true, changeError: null });

  const { data, error } = await applyRuntimeControlChange(controlKey, next, reason);

  const state = getSnapshot();
  if (data) {
    setSnapshot({ ...state, saving: false, changeError: null });
    await refreshControls();
    return { error: null };
  }

  setSnapshot({ ...state, saving: false, changeError: error ?? 'Unable to change the runtime control.' });
  return { error: error ?? 'Unable to change the runtime control.' };
}

// --- Selectors ----------------------------------------------------------------

export function findMasterSwitch(controls: AiRuntimeControlRow[]): AiRuntimeControlRow | null {
  return controls.find((c) => c.control_type === 'master_kill_switch') ?? null;
}

export function findRiskGate(controls: AiRuntimeControlRow[]): AiRuntimeControlRow | null {
  return controls.find((c) => c.control_type === 'risk_gate') ?? null;
}

export function findSiteGates(controls: AiRuntimeControlRow[]): AiRuntimeControlRow[] {
  return controls.filter((c) => c.control_type === 'site_execution_gate');
}

export function findAgentGates(controls: AiRuntimeControlRow[]): AiRuntimeControlRow[] {
  return controls.filter((c) => c.control_type === 'agent_execution_gate');
}