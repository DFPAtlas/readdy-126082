// ============================================================================
// AI Operations — Local Ollama catalogue store (Phase 3 Prompt 09C).
//
// A single module-level store that loads the relayed sanitised local Ollama
// catalogue + the live model registry and derives the deterministic comparison.
// Shared by Models & Providers, Model Detail, Agent Detail, Orchestrator,
// Runtime Health, Live Operations and the Wallboard. Display-only — it never
// contacts Ollama, never performs inference, and never mutates the registry.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getLatestOllamaCatalogue,
  compareCatalogueToRegistry,
  type OllamaCatalogue,
  type CatalogueComparison,
} from '@/lib/ai-operations/runtimeOllama';
import {
  getAiOperationsModels,
  type AiOperationsModelRow,
} from '@/lib/ai-operations';

interface OllamaCatalogueState {
  catalogue: OllamaCatalogue | null;
  comparison: CatalogueComparison | null;
  registry: AiOperationsModelRow[];
  loading: boolean;
  error: string | null;
}

const EMPTY: OllamaCatalogueState = {
  catalogue: null,
  comparison: null,
  registry: [],
  loading: false,
  error: null,
};

let snapshot: OllamaCatalogueState = { ...EMPTY };
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

function getSnapshot(): OllamaCatalogueState {
  return snapshot;
}

function setSnapshot(next: OllamaCatalogueState) {
  snapshot = next;
  emit();
}

export function useOllamaCatalogue(): OllamaCatalogueState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getOllamaCatalogueState(): OllamaCatalogueState {
  return snapshot;
}

/** Load the relayed catalogue + registry and derive the comparison. */
export async function refreshOllamaCatalogue(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true, error: null });

  const [catalogueRes, modelsRes] = await Promise.all([
    getLatestOllamaCatalogue(),
    getAiOperationsModels(),
  ]);

  const state = getSnapshot();
  if (catalogueRes.error) {
    setSnapshot({ ...state, loading: false, error: catalogueRes.error });
    return;
  }
  if (modelsRes.error) {
    setSnapshot({ ...state, loading: false, error: modelsRes.error });
    return;
  }

  const catalogue = catalogueRes.data ?? null;
  const registry = modelsRes.data ?? [];
  const comparison = compareCatalogueToRegistry(catalogue, registry);

  setSnapshot({
    ...state,
    catalogue,
    registry,
    comparison,
    loading: false,
    error: null,
  });
}