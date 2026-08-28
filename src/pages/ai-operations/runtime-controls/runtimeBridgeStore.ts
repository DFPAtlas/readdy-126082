// ============================================================================
// AI Operations — Private runtime bridge store (Phase 3 Prompt 08).
//
// Session state for the outbound-first private-runtime bridge. Loads the node
// registry + heartbeat + message ledgers (internal staff read-only) and derives
// a fail-closed safety summary. The browser can never insert a bridge row —
// records are created only by the `runtime-bridge` Edge Function using its
// service-role client.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getAiRuntimeBridgeNodes,
  getAiRuntimeBridgeHeartbeats,
  getAiRuntimeBridgeMessages,
  deriveBridgeSummary,
  type AiRuntimeBridgeNode,
  type AiRuntimeBridgeHeartbeat,
  type AiRuntimeBridgeMessage,
  type BridgeSummary,
} from '@/lib/ai-operations/runtimeBridge';

interface RuntimeBridgeState {
  nodes: AiRuntimeBridgeNode[];
  heartbeats: AiRuntimeBridgeHeartbeat[];
  messages: AiRuntimeBridgeMessage[];
  summary: BridgeSummary | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: RuntimeBridgeState = {
  nodes: [],
  heartbeats: [],
  messages: [],
  summary: null,
  loading: false,
  error: null,
};

let snapshot: RuntimeBridgeState = { ...EMPTY };
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

function getSnapshot(): RuntimeBridgeState {
  return snapshot;
}

function setSnapshot(next: RuntimeBridgeState) {
  snapshot = next;
  emit();
}

export function useRuntimeBridge(): RuntimeBridgeState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRuntimeBridgeState(): RuntimeBridgeState {
  return snapshot;
}

export async function refreshBridge(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true, error: null });

  const [nodesRes, heartbeatsRes, messagesRes] = await Promise.all([
    getAiRuntimeBridgeNodes(),
    getAiRuntimeBridgeHeartbeats(100),
    getAiRuntimeBridgeMessages(100),
  ]);

  const state = getSnapshot();
  if (nodesRes.error) {
    setSnapshot({ ...state, loading: false, error: nodesRes.error });
    return;
  }

  const nodes = nodesRes.data ?? [];
  const heartbeats = heartbeatsRes.data ?? [];
  const messages = messagesRes.data ?? [];

  setSnapshot({
    ...state,
    nodes,
    heartbeats,
    messages,
    summary: deriveBridgeSummary(nodes, heartbeats),
    loading: false,
    error: null,
  });
}