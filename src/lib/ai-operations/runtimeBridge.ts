// ============================================================================
// AI Operations — Private runtime bridge (Phase 3 Prompt 08).
//
// The outbound-first private-runtime bridge between DFP Command / Supabase and
// trusted local infrastructure (n8n, Ollama, future local runtime services).
// Local services are NEVER exposed to the public internet — the `dfp-runtime-
// bridge` local service dials OUT over HTTPS to the `runtime-bridge` Edge
// Function, which authenticates it (signed HMAC + service identity), records a
// heartbeat, and relays sanitised local health.
//
// This phase is CONNECTIVITY + HEARTBEAT + SAFE HEALTH RELAY ONLY. Nothing
// executes: no agent, no workflow, no inference, no Run, no notification, no
// schedule, no remediation. The bridge is transport-only and never owns
// execution authority. The browser can only SELECT the node/heartbeat/message
// ledgers (internal staff) — bridge rows are inserted server-side by the Edge
// Function using its service-role client (which bypasses RLS).
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Row types -----------------------------------------------------------------

export interface AiRuntimeBridgeNode {
  id: string;
  node_key: string;
  name: string | null;
  node_type: string;
  environment: string;
  site_id: string | null;
  service_identity_id: string | null;
  status: string;
  connection_mode: string;
  software_version: string | null;
  platform: string | null;
  capabilities: string[];
  last_handshake_at: string | null;
  last_heartbeat_at: string | null;
  last_seen_at: string | null;
  last_ip_class: string | null;
  configuration_state: string;
  execution_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiRuntimeBridgeHeartbeat {
  id: string;
  heartbeat_key: string;
  node_id: string;
  message_id: string | null;
  received_at: string;
  bridge_timestamp: string | null;
  status: string | null;
  latency_ms: number | null;
  n8n_status: string | null;
  ollama_status: string | null;
  local_services: Record<string, unknown> | null;
  capabilities: string[] | null;
  safe_summary: string | null;
  payload_hash: string | null;
  created_at: string;
}

export interface AiRuntimeBridgeMessage {
  id: string;
  message_key: string;
  message_id: string | null;
  nonce_hash: string | null;
  node_id: string | null;
  direction: string;
  message_type: string;
  correlation_id: string | null;
  status: string;
  payload_type: string | null;
  safe_payload: Record<string, unknown> | null;
  payload_hash: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

// --- Node state derivation (stale/offline thresholds, section 18) -------------

export type BridgeNodeState = 'reachable' | 'degraded' | 'stale' | 'offline' | 'not_registered';

const REACHABLE_WINDOW_MS = 2 * 60_000; // last heartbeat < 2 min → reachable
const STALE_WINDOW_MS = 5 * 60_000; // 2–5 min → stale; > 5 min → offline

/** Derive the honest bridge node state from its last-seen/last-heartbeat time.
 *  Reachable does NOT imply execution — execution_enabled is always false. */
export function deriveBridgeNodeState(node: AiRuntimeBridgeNode | null | undefined): BridgeNodeState {
  if (!node) return 'not_registered';
  if (node.status === 'not_registered' || !node.last_seen_at) return 'not_registered';

  const age = Date.now() - new Date(node.last_seen_at).getTime();
  if (age < REACHABLE_WINDOW_MS) return 'reachable';
  if (age <= STALE_WINDOW_MS) return 'stale';
  return 'offline';
}

export const BRIDGE_NODE_STATE_META: Record<
  BridgeNodeState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  reachable: { label: 'Reachable', tone: 'emerald' },
  degraded: { label: 'Degraded', tone: 'amber' },
  stale: { label: 'Stale', tone: 'amber' },
  offline: { label: 'Offline', tone: 'red' },
  not_registered: { label: 'Not Registered', tone: 'secondary' },
};

// --- Data access --------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to read the runtime bridge data.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the runtime bridge data.';
    }
  }
  return 'Unable to load runtime bridge data.';
}

async function runQuery<T>(builder: Promise<{ data: T | null; error: unknown }>): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) return { data: null, error: sanitiseError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getAiRuntimeBridgeNodes(): Promise<AiOpsResult<AiRuntimeBridgeNode[]>> {
  return runQuery<AiRuntimeBridgeNode[]>(
    supabase.from('ai_runtime_bridge_nodes').select('*').order('node_key', { ascending: true }),
  );
}

export function getAiRuntimeBridgeHeartbeats(limit = 100): Promise<AiOpsResult<AiRuntimeBridgeHeartbeat[]>> {
  return runQuery<AiRuntimeBridgeHeartbeat[]>(
    supabase.from('ai_runtime_bridge_heartbeats').select('*').order('received_at', { ascending: false }).limit(limit),
  );
}

export function getAiRuntimeBridgeMessages(limit = 100): Promise<AiOpsResult<AiRuntimeBridgeMessage[]>> {
  return runQuery<AiRuntimeBridgeMessage[]>(
    supabase.from('ai_runtime_bridge_messages').select('*').order('created_at', { ascending: false }).limit(limit),
  );
}

// --- Selectors -----------------------------------------------------------------

export interface BridgeSummary {
  /** Whether the bridge registry + ledgers are provisioned/readable. */
  ready: boolean;
  nodeCount: number;
  reachableNodes: number;
  staleNodes: number;
  offlineNodes: number;
  handshakes: number;
  heartbeatCount: number;
  /** n8n + Ollama local status surfaced from the latest heartbeat. */
  latest: AiRuntimeBridgeHeartbeat | null;
  /** Whether any node has ever been registered via a verified handshake. */
  handshakeVerified: boolean;
}

export function deriveBridgeSummary(
  nodes: AiRuntimeBridgeNode[],
  heartbeats: AiRuntimeBridgeHeartbeat[],
): BridgeSummary {
  const reachable = nodes.filter((n) => deriveBridgeNodeState(n) === 'reachable').length;
  const stale = nodes.filter((n) => deriveBridgeNodeState(n) === 'stale').length;
  const offline = nodes.filter((n) => deriveBridgeNodeState(n) === 'offline').length;
  const handshakes = nodes.filter((n) => n.last_handshake_at).length;

  return {
    ready: true,
    nodeCount: nodes.length,
    reachableNodes: reachable,
    staleNodes: stale,
    offlineNodes: offline,
    handshakes,
    heartbeatCount: heartbeats.length,
    latest: heartbeats.length > 0 ? heartbeats[0] : null,
    handshakeVerified: handshakes > 0,
  };
}