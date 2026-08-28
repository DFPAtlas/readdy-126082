// ============================================================================
// AI Operations — n8n runtime connector store (Phase 3 Prompt 06).
//
// Session state for the read-only n8n metadata adapter. Loads the approved
// workflow registry (internal staff read-only) and exposes read-only connector
// actions: status, list workflows, validate mapping, and dispatch preview.
//
// DISPATCH PREVIEW is DRY-RUN / DENY-ONLY: the connector returns `BLOCKED` and
// never executes an n8n workflow, webhook, run, agent, model or tool.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getAiN8nWorkflowRegistry,
  getN8nConnectorStatus,
  listN8nWorkflows,
  validateN8nMapping,
  previewN8nDispatch,
  deriveN8nSummary,
  type AiN8nWorkflowRegistryRow,
  type N8nConnectionState,
  type N8nWorkflowSummary,
  type N8nConnectorSummary,
  type N8nValidateMappingResult,
  type N8nDispatchPreviewResult,
  type N8nDispatchPreviewPayload,
} from '@/lib/ai-operations/runtimeN8n';

export interface N8nPreviewState {
  status: 'idle' | 'running' | 'done';
  result: N8nDispatchPreviewResult | null;
  error: string | null;
}

interface RuntimeN8nState {
  registry: AiN8nWorkflowRegistryRow[];
  connection: N8nConnectionState | null;
  discovered: N8nWorkflowSummary[];
  discoveredError: string | null;
  summary: N8nConnectorSummary | null;
  loading: boolean;
  error: string | null;
  preview: N8nPreviewState;
  lastValidation: { key: string; result: N8nValidateMappingResult } | null;
}

const EMPTY: RuntimeN8nState = {
  registry: [],
  connection: null,
  discovered: [],
  discoveredError: null,
  summary: null,
  loading: false,
  error: null,
  preview: { status: 'idle', result: null, error: null },
  lastValidation: null,
};

let snapshot: RuntimeN8nState = { ...EMPTY };
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

function getSnapshot(): RuntimeN8nState {
  return snapshot;
}

function setSnapshot(next: RuntimeN8nState) {
  snapshot = next;
  emit();
}

export function useRuntimeN8n(): RuntimeN8nState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRuntimeN8nState(): RuntimeN8nState {
  return snapshot;
}

// --- Loader -------------------------------------------------------------------

export async function refreshN8n(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true, error: null });

  const [registryRes, statusRes] = await Promise.all([
    getAiN8nWorkflowRegistry(),
    getN8nConnectorStatus(),
  ]);

  const state = getSnapshot();
  if (registryRes.error) {
    setSnapshot({ ...state, loading: false, error: registryRes.error });
    return;
  }

  const registry = registryRes.data ?? [];
  setSnapshot({
    ...state,
    registry,
    connection: statusRes.data?.connection ?? null,
    summary: deriveN8nSummary(registry),
    loading: false,
    error: null,
  });
}

// --- Actions (read-only) -------------------------------------------------------

export async function discoverN8nWorkflows(): Promise<void> {
  const { data, error } = await listN8nWorkflows();
  const state = getSnapshot();
  if (data) {
    setSnapshot({ ...state, discovered: data.workflows, discoveredError: null });
  } else {
    setSnapshot({ ...state, discovered: [], discoveredError: error ?? 'Unable to discover n8n workflows.' });
  }
}

export async function verifyN8nMapping(workflowKey: string): Promise<void> {
  const { data, error } = await validateN8nMapping(workflowKey);
  const state = getSnapshot();
  if (data) {
    setSnapshot({ ...state, lastValidation: { key: workflowKey, result: data } });
  }
  // Refresh the registry so last_verified_at / runtime_status reflect the check.
  await refreshN8n();
  if (error) {
    setSnapshot({ ...getSnapshot(), error });
  }
}

export async function runN8nDispatchPreview(payload: N8nDispatchPreviewPayload): Promise<void> {
  setSnapshot({ ...getSnapshot(), preview: { status: 'running', result: null, error: null } });

  const { data, error } = await previewN8nDispatch(payload);

  const state = getSnapshot();
  if (data) {
    setSnapshot({ ...state, preview: { status: 'done', result: data, error: null } });
  } else {
    setSnapshot({ ...state, preview: { status: 'done', result: null, error: error ?? 'Unable to preview dispatch.' } });
  }
}

export function resetN8nPreview(): void {
  setSnapshot({ ...getSnapshot(), preview: { status: 'idle', result: null, error: null } });
}