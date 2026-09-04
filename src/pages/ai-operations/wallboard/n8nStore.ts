// ============================================================================
// AI Operations — Wallboard N8N Automation & Workflow Data Store.
//
// Read-only monitoring over n8n automation/workflow health for the Digital
// Footprint group. MONITORING-ONLY: no workflow execution, no activate/
// deactivate/edit/delete, no retry/stop, no credential controls.
//
// SOURCE AUDIT (Wallboard 45):
//   * `n8n-runtime-connector` Edge Function `status` operation — the
//     authoritative LIVE n8n instance health check (configured / reachable /
//     authenticated), performed server-side against N8N_URL + N8N_API_KEY.
//     Credentials never reach the browser.
//   * `ai_n8n_workflow_registry` — the authoritative workflow registry
//     (workflow_key → name, workflow_type, environment, runtime_status,
//     execution_mode, is_active, node_count, trigger_types, risk_level,
//     site_id, agent_id, last_verified_at, last_seen_updated_at).
//   * `ai_runtime_callbacks` — the n8n callback channel (workflow_key,
//     callback_type, outcome, safe_summary, occurred_at, environment). This is
//     the only execution/history signal available (n8n does not persist
//     executions into DFP Command). Bounded to the latest 100 rows.
//   * n8n local/cloud runtime health — reused from the shared runtime-health
//     store (getRuntimeHealthState()), NOT re-fetched here.
//   * Site/agent names — reused from getGroupLiveData() resolution maps, NOT
//     re-fetched here.
//
// Privacy: N8N_URL / N8N_API_KEY are server-side only. connector_key,
// allowed_request_types, notes, description, purpose, and raw callback payload
// hashes / nonces / signatures are NEVER selected. Only friendly names, states,
// timestamps and safe summaries reach the wall.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getN8nConnectorStatus,
  type N8nConnectionState,
} from '@/lib/ai-operations/runtimeN8n';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface N8nWorkflowRegistryRow {
  id: string;
  workflow_key: string;
  n8n_workflow_id: string | null;
  name: string | null;
  workflow_type: string | null;
  environment: string;
  runtime_status: string;
  execution_mode: string;
  is_active: boolean;
  node_count: number | null;
  trigger_types: string[];
  risk_level: string | null;
  site_id: string | null;
  agent_id: string | null;
  last_verified_at: string | null;
  last_seen_updated_at: string | null;
}

export interface N8nCallbackRow {
  id: string;
  workflow_key: string | null;
  callback_type: string | null;
  outcome: string | null;
  environment: string | null;
  safe_summary: string | null;
  occurred_at: string | null;
}

export interface N8nData {
  loading: boolean;
  lastRefreshed: Date;
  /** Whether ai_n8n_workflow_registry was readable. */
  registryAvailability: boolean;
  /** Whether ai_runtime_callbacks was readable. */
  callbacksAvailability: boolean;
  /** Whether the n8n-runtime-connector status check responded. */
  connectorAvailability: boolean;
  /** Live instance connection state (null = connector did not respond). */
  connection: N8nConnectionState | null;
  workflows: N8nWorkflowRegistryRow[];
  callbacks: N8nCallbackRow[];
}

function emptySnapshot(): N8nData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    registryAvailability: false,
    callbacksAvailability: false,
    connectorAvailability: false,
    connection: null,
    workflows: [],
    callbacks: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: N8nData = emptySnapshot();
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

function getSnapshot(): N8nData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current n8n snapshot. */
export function getN8nData(): N8nData {
  return snapshot;
}

/** Subscribe to the n8n snapshot (re-renders on refresh). */
export function useN8nData(): N8nData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Fetch the registry + callbacks + live connector status independently — a
// single failed source must not break the others, and never breaks the whole
// wallboard view.
export async function refreshN8nData(): Promise<void> {
  const [registryRes, callbacksRes, connectorRes] = await Promise.all([
    supabase
      .from('ai_n8n_workflow_registry')
      .select(
        'id,workflow_key,n8n_workflow_id,name,workflow_type,environment,runtime_status,execution_mode,is_active,node_count,trigger_types,risk_level,site_id,agent_id,last_verified_at,last_seen_updated_at',
      )
      .order('workflow_key', { ascending: true }),
    supabase
      .from('ai_runtime_callbacks')
      .select('id,workflow_key,callback_type,outcome,environment,safe_summary,occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(100),
    getN8nConnectorStatus(),
  ]);

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    registryAvailability: !registryRes.error,
    callbacksAvailability: !callbacksRes.error,
    connectorAvailability: connectorRes.error === null && connectorRes.data !== null,
    connection: connectorRes.data?.connection ?? null,
    workflows: (registryRes.data ?? []) as N8nWorkflowRegistryRow[],
    callbacks: (callbacksRes.data ?? []) as N8nCallbackRow[],
  };

  emit();
}