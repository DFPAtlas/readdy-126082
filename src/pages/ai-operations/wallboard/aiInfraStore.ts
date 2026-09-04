// ============================================================================
// AI Operations — Wallboard AI Infrastructure Data Store.
//
// Read-only monitoring over the local AI systems (HAL / Tron / Ollama / n8n)
// that run and oversee Digital Footprint automation. MONITORING-ONLY: no
// reboot/shutdown/restart, no SSH, no shell commands, no workflow execution,
// no inference, no server-control of any kind.
//
// SOURCE AUDIT (Wallboard 46):
//   * HAL — the authoritative local runtime host (ai_runtime_bridge_nodes +
//     ai_runtime_bridge_heartbeats), already loaded by the shared
//     runtime-health store (getRuntimeHealthState()) — NOT re-fetched here.
//     The heartbeat relays sanitised n8n / Ollama health + local_services
//     (incl. ollama model_count) + capabilities. The browser never contacts
//     HAL directly.
//   * Ollama local-inference probe — the read-only `dfp_ollama_ping_v1`
//     sandbox probe status (runtime-bridge-control `get_ollama_inference_probe_status`).
//     This is the ONLY thing fetched here: a read-only status read. It never
//     queues a probe and never performs inference.
//   * n8n — reused from the Wallboard 45 n8n store/selectors, NOT re-fetched.
//   * Ollama catalogue — reused from the shared ollamaCatalogueStore, NOT
//     re-fetched.
//   * Master agents — reused from getGroupLiveData(), NOT re-fetched.
//
// Honesty rules honoured here:
//   * Tron / Atlas Tron / Overwatch have NO authoritative registry — they are
//     surfaced as NOT CONNECTED, never invented or simulated.
//   * CPU / RAM / GPU / storage / temperature have NO metric source — they
//     remain "not monitored", never fabricated.
//   * A probe that has never been run is UNKNOWN, never VERIFIED.
//
// Privacy: node capabilities + friendly names + aggregate status only. No SSH
// credentials, API keys, tokens, or private environment variables ever reach
// the wall.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getOllamaInferenceProbeStatus,
  type OllamaProbeStatusResult,
} from '@/lib/ai-operations/runtimeOllamaProbe';

export interface AiInfraData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether the read-only Ollama probe status responded. */
  probeAvailability: boolean;
  /** Latest Ollama inference probe status (null = no response). */
  probe: OllamaProbeStatusResult | null;
}

function emptySnapshot(): AiInfraData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    probeAvailability: false,
    probe: null,
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: AiInfraData = emptySnapshot();
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

function getSnapshot(): AiInfraData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current AI infrastructure snapshot. */
export function getAiInfraData(): AiInfraData {
  return snapshot;
}

/** Subscribe to the AI infrastructure snapshot (re-renders on refresh). */
export function useAiInfraData(): AiInfraData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

/** Read the latest Ollama probe status only (read-only; never queues a probe). */
export async function refreshAiInfraData(): Promise<void> {
  const probeRes = await getOllamaInferenceProbeStatus();

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    probeAvailability: probeRes.error === null && probeRes.data !== null,
    probe: probeRes.data ?? null,
  };

  emit();
}