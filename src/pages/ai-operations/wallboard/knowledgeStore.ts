// ============================================================================
// AI Operations — Wallboard Knowledge & Memory Data Store.
//
// Read-only monitoring over the Knowledge & Memory / vector health for DFP
// Command. MONITORING-ONLY: no ingestion, no re-indexing, no re-embedding, no
// retrieval probes, no memory writes, no source create/update/delete.
//
// SOURCE AUDIT (Wallboard 49):
//   * Knowledge source registry (ai_knowledge_sources) + agent permissions
//     (ai_knowledge_permissions) — already loaded by the shared group live-data
//     store (getGroupLiveData()) — NOT re-fetched here.
//   * Incident / known-issue memory (ai_incident_memory) — the ONLY additional
//     read fetched here, because it is not part of the group snapshot. Sanitised
//     summaries only (never raw incident logs or private content).
//   * Vector store / embedding pipeline / retrieval probe — NO authoritative
//     runtime source exists. The registry `embedding_state` / `indexing_state`
//     fields are the only vector/indexing signal, surfaced honestly.
//
// Honesty rules honoured here:
//   * There is NO pgvector / vector-service / retrieval-health probe — the view
//     shows UNKNOWN / NOT CONNECTED rather than pretending it is monitored.
//   * There is NO ingestion job queue or memory-write telemetry — only static
//     registry states are surfaced.
//   * Raw vectors, document bodies, prompts, and private memory text are NEVER
//     loaded or displayed.
//
// Privacy: aggregate counts + sanitised memory summaries only. No credentials.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { getAiIncidentMemory, type AiIncidentMemoryRow } from '@/lib/ai-operations';

export interface KnowledgeMemoryData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether ai_incident_memory was readable. */
  memoryAvailability: boolean;
  /** Sanitised known-issue memory rows (active only). */
  memory: AiIncidentMemoryRow[];
}

function emptySnapshot(): KnowledgeMemoryData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    memoryAvailability: false,
    memory: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: KnowledgeMemoryData = emptySnapshot();
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

function getSnapshot(): KnowledgeMemoryData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current knowledge/memory snapshot. */
export function getKnowledgeData(): KnowledgeMemoryData {
  return snapshot;
}

/** Subscribe to the knowledge/memory snapshot (re-renders on refresh). */
export function useKnowledgeData(): KnowledgeMemoryData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

/** Read ai_incident_memory only (read-only; sanitised summaries). */
export async function refreshKnowledgeData(): Promise<void> {
  const res = await getAiIncidentMemory();

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    memoryAvailability: !res.error,
    memory: (res.data ?? []).filter((r) => r.is_active !== false),
  };

  emit();
}