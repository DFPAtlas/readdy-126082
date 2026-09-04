// ============================================================================
// AI Operations — Runtime health store (Phase 3 Prompt 01 + 02).
//
// Session results from manual checks live alongside persisted monitoring
// history (ai_runtime_health_checks / _sweeps / _monitoring_rules). A single
// module-level store is shared by the Runtime Health page, Tool Detail, Models,
// Live Operations and the Wallboard.
//
// Manual checks only are user-initiated; scheduled checks run server-side. This
// store never performs its own external checks beyond what the user triggers.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  runRuntimeHealthCheck,
  type HealthTarget,
  type RuntimeHealthResult,
  type RuntimeHealthSweep,
} from '@/lib/ai-operations/runtimeHealth';
import {
  runRuntimeConfigCheck,
  type ConfigResult,
} from '@/lib/ai-operations/runtimeConfig';
import {
  getRuntimeHealthChecks,
  getRuntimeHealthSweeps,
  getRuntimeMonitoringRules,
  updateRuntimeMonitoringRule,
  deriveLatestBySystem,
  type AiRuntimeHealthCheckRow,
  type AiRuntimeHealthSweepRow,
  type AiRuntimeMonitoringRuleRow,
  type AiRuntimeMonitoringRuleUpdate,
} from '@/lib/ai-operations/runtimeMonitoring';
import {
  getAiRuntimeBridgeNodes,
  getAiRuntimeBridgeHeartbeats,
  type AiRuntimeBridgeNode,
  type AiRuntimeBridgeHeartbeat,
} from '@/lib/ai-operations/runtimeBridge';
import {
  buildLatestBySystem,
  computeEffectivePaths,
  deriveLocalBridgeHealth,
  type EffectivePath,
  type LatestBySystem,
} from '@/lib/ai-operations/runtimeHealthSource';
import { createAiAuditEvent } from '@/lib/ai-operations';

/** Stable runtime-node keys (multi-runtime bridge registry). */
export const HAL_RUNTIME_NODE_KEY = 'atlas-hal-runtime-01';
export const TRON_RUNTIME_NODE_KEY = 'atlas-tron-runtime-01';

interface RuntimeHealthState {
  /** Latest session result per stable key (connection_key / provider_key). */
  results: Record<string, RuntimeHealthResult>;
  lastSweep: RuntimeHealthSweep | null;
  sweeping: boolean;
  checkingKeys: string[];
  error: string | null;

  // Persisted monitoring history + configuration.
  checks: AiRuntimeHealthCheckRow[];
  sweeps: AiRuntimeHealthSweepRow[];
  rules: AiRuntimeMonitoringRuleRow[];
  latestBySystem: LatestBySystem;
  effectivePaths: Record<string, EffectivePath>;
  /** All registered runtime bridge nodes (multi-runtime). */
  bridgeNodes: AiRuntimeBridgeNode[];
  /** node_key → node lookup (multi-runtime). */
  bridgeNodesByKey: Record<string, AiRuntimeBridgeNode>;
  /** node_key → newest heartbeat for that node (multi-runtime). */
  latestHeartbeatByNodeKey: Record<string, AiRuntimeBridgeHeartbeat>;
  /** HAL compatibility alias — HAL node only (operational automation path). */
  bridgeNode: AiRuntimeBridgeNode | null;
  /** HAL compatibility alias — HAL heartbeat only. */
  latestHeartbeat: AiRuntimeBridgeHeartbeat | null;
  historyLoading: boolean;
  historyError: string | null;
  rulesSaving: boolean;

  // Server-side configuration-presence readiness (Phase 3 Prompt 03).
  config: ConfigResult[];
  configLoading: boolean;
  configError: string | null;
}

const EMPTY: RuntimeHealthState = {
  results: {},
  lastSweep: null,
  sweeping: false,
  checkingKeys: [],
  error: null,
  checks: [],
  sweeps: [],
  rules: [],
  latestBySystem: new Map(),
  effectivePaths: {},
  bridgeNodes: [],
  bridgeNodesByKey: {},
  latestHeartbeatByNodeKey: {},
  bridgeNode: null,
  latestHeartbeat: null,
  historyLoading: false,
  historyError: null,
  rulesSaving: false,
  config: [],
  configLoading: false,
  configError: null,
};

let snapshot: RuntimeHealthState = { ...EMPTY };
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

function getSnapshot(): RuntimeHealthState {
  return snapshot;
}

function setSnapshot(next: RuntimeHealthState) {
  snapshot = next;
  emit();
}

export function useRuntimeHealth(): RuntimeHealthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRuntimeHealthState(): RuntimeHealthState {
  return snapshot;
}

function mergeResults(
  current: Record<string, RuntimeHealthResult>,
  results: RuntimeHealthResult[],
): Record<string, RuntimeHealthResult> {
  const next = { ...current };
  for (const r of results) next[r.connectionKey] = r;
  return next;
}

// --- Persisted history -------------------------------------------------------

/** Load persisted checks/sweeps/rules + bridge nodes/heartbeats and derive a
 *  source-aware latest-per-system state + deterministic effective path. */
export async function refreshHistory(): Promise<void> {
  setSnapshot({ ...getSnapshot(), historyLoading: true, historyError: null });

  const [checksRes, sweepsRes, rulesRes, nodesRes, heartbeatsRes] = await Promise.all([
    getRuntimeHealthChecks(200),
    getRuntimeHealthSweeps(50),
    getRuntimeMonitoringRules(),
    getAiRuntimeBridgeNodes(),
    getAiRuntimeBridgeHeartbeats(50),
  ]);

  const state = getSnapshot();
  if (checksRes.error) {
    setSnapshot({
      ...state,
      historyLoading: false,
      historyError: checksRes.error,
    });
    return;
  }

  const checks = checksRes.data ?? [];
  const sweeps = sweepsRes.data ?? [];
  const rules = rulesRes.data ?? [];
  const nodes = nodesRes.data ?? [];
  const heartbeats = heartbeatsRes.data ?? [];

  // Multi-runtime: keep every node, index by node_key, and pair each heartbeat
  // to its own node by node_id (heartbeats arrive newest-first, so the first
  // heartbeat seen per node is that node's newest).
  const bridgeNodes = nodes;
  const bridgeNodesByKey: Record<string, AiRuntimeBridgeNode> = {};
  const nodeIdToKey: Record<string, string> = {};
  for (const node of nodes) {
    bridgeNodesByKey[node.node_key] = node;
    nodeIdToKey[node.id] = node.node_key;
  }
  const latestHeartbeatByNodeKey: Record<string, AiRuntimeBridgeHeartbeat> = {};
  for (const heartbeat of heartbeats) {
    const nodeKey = nodeIdToKey[heartbeat.node_id];
    if (!nodeKey || latestHeartbeatByNodeKey[nodeKey]) continue;
    latestHeartbeatByNodeKey[nodeKey] = heartbeat;
  }

  // HAL compatibility aliases — resolve strictly by HAL key, never fall back to
  // nodes[0] / heartbeats[0] when HAL is absent.
  const bridgeNode = bridgeNodesByKey[HAL_RUNTIME_NODE_KEY] ?? null;
  const latestHeartbeat = latestHeartbeatByNodeKey[HAL_RUNTIME_NODE_KEY] ?? null;

  const cloudEdge = deriveLatestBySystem(checks);
  const localBridge = deriveLocalBridgeHealth(latestHeartbeat);
  const latestBySystem = buildLatestBySystem(cloudEdge, localBridge);
  const effectivePaths = computeEffectivePaths(latestBySystem, bridgeNode, latestHeartbeat);

  setSnapshot({
    ...state,
    checks,
    sweeps,
    rules,
    latestBySystem,
    effectivePaths,
    bridgeNodes,
    bridgeNodesByKey,
    latestHeartbeatByNodeKey,
    bridgeNode,
    latestHeartbeat,
    historyLoading: false,
    historyError: null,
  });
}

// --- Actions -----------------------------------------------------------------

export async function checkRuntimeHealth(system: string, connectionKey: string): Promise<void> {
  const key = connectionKey;
  setSnapshot({
    ...getSnapshot(),
    checkingKeys: [...new Set([...getSnapshot().checkingKeys, key])],
    error: null,
  });

  const { data, error } = await runRuntimeHealthCheck([{ system, connectionKey }]);

  const state = getSnapshot();
  if (data) {
    setSnapshot({
      ...state,
      results: mergeResults(state.results, data.results),
      checkingKeys: state.checkingKeys.filter((k) => k !== key),
      error: null,
    });
    // Persisted history now has a new check — refresh it (best-effort).
    void refreshHistory();
  } else {
    setSnapshot({
      ...state,
      checkingKeys: state.checkingKeys.filter((k) => k !== key),
      error: error ?? 'Unable to complete the health check.',
    });
  }
}

export async function sweepRuntimeHealth(targets: HealthTarget[]): Promise<void> {
  if (targets.length === 0) return;

  setSnapshot({ ...getSnapshot(), sweeping: true, error: null });

  const { data, error } = await runRuntimeHealthCheck(targets);

  const state = getSnapshot();
  if (data) {
    setSnapshot({
      ...state,
      results: mergeResults(state.results, data.results),
      lastSweep: data.sweep,
      sweeping: false,
      error: null,
    });
    void refreshHistory();
  } else {
    setSnapshot({
      ...state,
      sweeping: false,
      error: error ?? 'Unable to complete the health sweep.',
    });
  }
}

/** Save interval/threshold config for a monitoring rule (no credential/URL). */
export async function saveMonitoringRule(
  ruleKey: string,
  input: AiRuntimeMonitoringRuleUpdate,
): Promise<{ error: string | null }> {
  setSnapshot({ ...getSnapshot(), rulesSaving: true });
  const { error } = await updateRuntimeMonitoringRule(ruleKey, input);
  const state = getSnapshot();
  setSnapshot({ ...state, rulesSaving: false });
  if (error) return { error };
  void refreshHistory();
  return { error: null };
}

/** Toggle a rule on/off and audit the change (no remediation/notifications). */
export async function toggleMonitoringRule(
  ruleKey: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  const res = await saveMonitoringRule(ruleKey, { enabled });
  if (res.error) return res;

  await createAiAuditEvent({
    audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    occurred_at: new Date().toISOString(),
    event_type: enabled ? 'runtime_monitoring_enabled' : 'runtime_monitoring_disabled',
    action: 'runtime_monitoring',
    outcome: 'success',
    severity: 'low',
    actor_type: 'human',
    actor_reference: 'Operator',
    trigger_source: 'runtime_monitoring',
    environment: 'production',
    notes: `Monitoring rule ${ruleKey} ${enabled ? 'enabled' : 'disabled'}.`,
  });

  return { error: null };
}

// --- Configuration readiness (Phase 3 Prompt 03) -----------------------------

/** Load server-side secret-presence inventory (never values). */
export async function refreshConfig(): Promise<void> {
  setSnapshot({ ...getSnapshot(), configLoading: true, configError: null });

  const { data, error } = await runRuntimeConfigCheck();

  const state = getSnapshot();
  if (data) {
    setSnapshot({
      ...state,
      config: data,
      configLoading: false,
      configError: null,
    });
  } else {
    setSnapshot({
      ...state,
      configLoading: false,
      configError: error ?? 'Unable to load configuration readiness.',
    });
  }
}

/** Manual "Recheck Configuration & Health" — safe config-presence check then a
 *  safe health sweep. No business execution. */
export async function recheckConfigAndHealth(targets: HealthTarget[]): Promise<void> {
  await refreshConfig();
  if (targets.length > 0) {
    await sweepRuntimeHealth(targets);
  }

  await createAiAuditEvent({
    audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    occurred_at: new Date().toISOString(),
    event_type: 'runtime_configuration_recheck',
    action: 'runtime_configuration',
    outcome: 'informational',
    severity: 'low',
    actor_type: 'human',
    actor_reference: 'Operator',
    trigger_source: 'manual',
    environment: 'production',
    notes: 'Configuration presence and runtime health rechecked (no business execution).',
  });
}