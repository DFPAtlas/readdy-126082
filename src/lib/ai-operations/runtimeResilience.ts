// ============================================================================
// AI Operations — Runtime Resilience data model, data-access layer and central
// state evaluation (HAL + TRON).
//
// Reconciles with the EXISTING authoritative runtime sources so no field has a
// competing source of truth:
//
//   * Node identity, bridge state and the cloud heartbeat are read from
//     ai_runtime_bridge_nodes via runtimeBridge.ts (authoritative).
//   * n8n / Ollama / CPU / memory telemetry are read from the newest per-node
//     ai_runtime_bridge_heartbeats.local_services (authoritative).
//   * Watchdog, LOCAL liveness, fault/recovery, restart + container-uptime and
//     temperature are read from the dedicated runtime_resilience_nodes snapshot.
//   * Recovery history is read from runtime_recovery_events (append-only).
//
// This module is monitoring/data-only. It exposes NO control path to HAL or
// TRON: no restart, no Docker/shell, no n8n dispatch, no arbitrary prompts.
//
// LOCAL LIVENESS and CLOUD HEARTBEAT are deliberately separate concepts:
//   - Cloud heartbeat  = bridge node last_seen/last_heartbeat (2/5 min windows,
//     reused from deriveBridgeNodeState — the authoritative offline timeout).
//   - Local liveness   = watchdog-marked local liveness (runtime_resilience_nodes
//     last_liveness_at / liveness_age_ms), its own freshness window.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';
import {
  getAiRuntimeBridgeNodes,
  getAiRuntimeBridgeHeartbeats,
  deriveBridgeNodeState,
  type AiRuntimeBridgeNode,
  type AiRuntimeBridgeHeartbeat,
} from '@/lib/ai-operations/runtimeBridge';
import {
  HAL_RUNTIME_NODE_KEY,
  TRON_RUNTIME_NODE_KEY,
} from '@/pages/ai-operations/runtime-health/runtimeHealthStore';

// --- Recovery target ----------------------------------------------------------

/** Recovery SLA target in milliseconds (5 seconds). */
export const RECOVERY_TARGET_MS = 5000;

/** Local-liveness freshness window. Local liveness is a watchdog-marked marker
 *  (separate from the cloud heartbeat) and uses its own short window. */
export const LOCAL_LIVENESS_STALE_MS = 60_000;

// --- Runtime states -----------------------------------------------------------

export type RuntimeNodeState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RECOVERING'
  | 'OFFLINE'
  | 'WATCHDOG FAULT'
  | 'AWAITING TELEMETRY';

export type RuntimeResilienceLoadState =
  | 'LOADING'
  | 'NO DATA'
  | 'PARTIAL DATA'
  | 'LIVE DATA'
  | 'ERROR';

/** Supported recovery methods (free-form text; TS union documents the set). */
export type RecoveryMethod =
  | 'docker_restart'
  | 'force_recreate'
  | 'service_restart'
  | 'automatic_recovery'
  | 'manual_recovery';

/** Supported fault reasons (free-form text; at least these are expected). */
export type FaultReason =
  | 'container_stopped'
  | 'liveness_stale'
  | 'liveness_marker_missing'
  | 'bridge_process_failed'
  | 'watchdog_failed'
  | 'unknown';

// --- Row types (mirror the DB columns; snake_case) ----------------------------

export interface RuntimeResilienceNodeRow {
  id: string;
  node_id: string;
  watchdog_status: string | null;
  last_liveness_at: string | null;
  liveness_age_ms: number | null;
  last_fault_at: string | null;
  last_fault_reason: string | null;
  last_recovered_at: string | null;
  last_recovery_ms: number | null;
  restart_count_24h: number | null;
  container_uptime_seconds: number | null;
  temperature_c: number | null;
  recovery_target_ms: number;
  created_at: string;
  updated_at: string;
}

export interface RuntimeRecoveryEventRow {
  id: string;
  node_id: string;
  fault_detected_at: string | null;
  fault_reason: string | null;
  recovery_started_at: string | null;
  recovered_at: string | null;
  recovery_ms: number | null;
  recovery_method: string | null;
  target_ms: number | null;
  target_met: boolean | null;
  created_at: string;
}

// --- Evaluated / composed model (camelCase, ready for the UI) ------------------

export interface RuntimeResilienceNode {
  nodeId: string | null;
  nodeKey: string;
  nodeName: string;
  nodeStatus: RuntimeNodeState;
  /** bridge node state: reachable | stale | offline | not_registered. */
  bridgeStatus: string;
  watchdogStatus: string | null;
  lastHeartbeatAt: string | null;
  lastLivenessAt: string | null;
  livenessAgeMs: number | null;
  lastFaultAt: string | null;
  lastFaultReason: string | null;
  lastRecoveredAt: string | null;
  lastRecoveryMs: number | null;
  restartCount24h: number | null;
  containerUptimeSeconds: number | null;
  ollamaStatus: string | null;
  ollamaModelCount: number | null;
  n8nStatus: string | null;
  cpuPercent: number | null;
  memoryPercent: number | null;
  temperatureC: number | null;
  recoveryTargetMs: number;
  /** null = no recovery data (must not render as PASS). */
  recoveryTargetMet: boolean | null;
  updatedAt: string | null;
  /** true when a resilience snapshot row exists for this node. */
  hasResilienceSnapshot: boolean;
}

export interface RuntimeRecoveryEvent {
  id: string;
  nodeKey: string;
  nodeName: string;
  faultDetectedAt: string | null;
  faultReason: string | null;
  recoveryStartedAt: string | null;
  recoveredAt: string | null;
  recoveryMs: number | null;
  recoveryMethod: string | null;
  targetMs: number | null;
  /** derived: recoveryMs <= targetMs (or null when recoveryMs is missing). */
  targetMet: boolean | null;
  createdAt: string;
}

export interface RuntimeResilienceView {
  loadState: RuntimeResilienceLoadState;
  error: string | null;
  recoveryTargetMs: number;
  nodes: RuntimeResilienceNode[];
  events: RuntimeRecoveryEvent[];
}

// --- Data access --------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to read runtime resilience data.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the runtime resilience data.';
    }
  }
  return 'Unable to load runtime resilience data.';
}

async function runQuery<T>(
  builder: Promise<{ data: T | null; error: unknown }>,
): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) return { data: null, error: sanitiseError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getRuntimeResilienceNodes(): Promise<AiOpsResult<RuntimeResilienceNodeRow[]>> {
  return runQuery<RuntimeResilienceNodeRow[]>(
    supabase.from('runtime_resilience_nodes').select('*').order('updated_at', { ascending: false }),
  );
}

export function getRuntimeRecoveryEvents(
  limit = 20,
): Promise<AiOpsResult<RuntimeRecoveryEventRow[]>> {
  return runQuery<RuntimeRecoveryEventRow[]>(
    supabase
      .from('runtime_recovery_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

// --- Pure state-evaluation helpers (single source of truth) --------------------

/** True when a watchdog status string indicates a fault (not merely missing). */
export function isWatchdogFault(status: string | null): boolean {
  if (!status) return false;
  const v = status.trim().toLowerCase();
  return ['stopped', 'failed', 'fault', 'not_reporting', 'down', 'unhealthy'].includes(v);
}

/** True when a watchdog status string indicates it is running/healthy. */
export function isWatchdogRunning(status: string | null): boolean {
  if (!status) return false;
  const v = status.trim().toLowerCase();
  return ['running', 'healthy', 'active', 'ok', 'up'].includes(v);
}

/** True when a dependent-service status is an explicit unhealthy signal.
 *  Missing/unknown ("not_configured", null) is NOT unhealthy — so incomplete
 *  telemetry never marks a node DEGRADED or OFFLINE. */
export function isUnhealthyService(status: string | null): boolean {
  if (!status) return false;
  const v = status.trim().toLowerCase();
  return [
    'unhealthy',
    'degraded',
    'offline',
    'down',
    'unavailable',
    'delayed',
    'error',
    'failed',
    'stopped',
    'stale',
  ].includes(v);
}

/** True when local liveness is current (present AND within its own window).
 *  Never derived from the cloud heartbeat. */
export function isLivenessCurrent(node: RuntimeResilienceNode): boolean {
  if (node.lastLivenessAt) {
    return Date.now() - new Date(node.lastLivenessAt).getTime() <= LOCAL_LIVENESS_STALE_MS;
  }
  if (node.livenessAgeMs != null) {
    return node.livenessAgeMs <= LOCAL_LIVENESS_STALE_MS;
  }
  return false;
}

/** True when a fault has been detected but not yet recovered (recovery in progress). */
export function isRecovering(node: RuntimeResilienceNode): boolean {
  if (!node.lastFaultAt) return false;
  if (!node.lastRecoveredAt) return true;
  return new Date(node.lastRecoveredAt).getTime() < new Date(node.lastFaultAt).getTime();
}

/**
 * Central node-state evaluation. Order encodes precedence:
 *   OFFLINE > WATCHDOG FAULT > RECOVERING > DEGRADED > HEALTHY > AWAITING.
 * Kept OUT of JSX so the five runtime states are never re-implemented inline.
 */
export function evaluateNodeState(node: RuntimeResilienceNode): RuntimeNodeState {
  if (!node.hasResilienceSnapshot) return 'AWAITING TELEMETRY';

  // OFFLINE — bridge/node stopped reporting beyond the authoritative timeout.
  if (node.bridgeStatus === 'offline' || node.bridgeStatus === 'not_registered') {
    return 'OFFLINE';
  }

  // WATCHDOG FAULT — watchdog stopped/failed while the bridge may still run.
  if (isWatchdogFault(node.watchdogStatus)) return 'WATCHDOG FAULT';

  // RECOVERING — a fault is detected and watchdog recovery is in progress, or
  // the watchdog explicitly reports a recovering state.
  if (isRecovering(node) || node.watchdogStatus?.trim().toLowerCase() === 'recovering') {
    return 'RECOVERING';
  }

  // DEGRADED — reachable + bridge/watchdog ok, but a dependent service (or
  // local liveness) is unhealthy/delayed. Missing telemetry alone is NOT it.
  const serviceDegraded =
    isUnhealthyService(node.n8nStatus) || isUnhealthyService(node.ollamaStatus);
  const livenessStale = node.lastLivenessAt != null && !isLivenessCurrent(node);
  if (serviceDegraded || livenessStale) return 'DEGRADED';

  // HEALTHY — bridge reachable + watchdog running + liveness current.
  if (
    node.bridgeStatus === 'reachable' &&
    isWatchdogRunning(node.watchdogStatus) &&
    isLivenessCurrent(node)
  ) {
    return 'HEALTHY';
  }

  // Snapshot exists but essential telemetry is incomplete — await it, never
  // guess HEALTHY.
  return 'AWAITING TELEMETRY';
}

/** derive recovery_target_met = last_recovery_ms <= target (null when no data). */
export function evaluateRecoveryTargetMet(node: RuntimeResilienceNode): boolean | null {
  if (node.lastRecoveryMs == null) return null;
  return node.lastRecoveryMs <= node.recoveryTargetMs;
}

/** derive event target_met = recovery_ms <= target_ms (null when no recovery_ms). */
export function evaluateEventTargetMet(event: RuntimeRecoveryEvent): boolean | null {
  if (event.recoveryMs == null) return null;
  const target = event.targetMs ?? RECOVERY_TARGET_MS;
  return event.recoveryMs <= target;
}

// --- Composition ----------------------------------------------------------------

const NODE_ORDER: { key: string; label: string }[] = [
  { key: HAL_RUNTIME_NODE_KEY, label: 'HAL' },
  { key: TRON_RUNTIME_NODE_KEY, label: 'TRON' },
];

interface HostTelemetry {
  cpuPercent: number | null;
  memoryPercent: number | null;
  ollamaModelCount: number | null;
}

function readHostTelemetry(hb: AiRuntimeBridgeHeartbeat | null | undefined): HostTelemetry {
  const local = (hb?.local_services ?? null) as
    | { host?: { cpu_percent?: unknown; memory_percent?: unknown }; ollama?: { model_count?: unknown } }
    | null;

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  return {
    cpuPercent: num(local?.host?.cpu_percent),
    memoryPercent: num(local?.host?.memory_percent),
    ollamaModelCount: num(local?.ollama?.model_count),
  };
}

function composeNode(
  bridge: AiRuntimeBridgeNode | null,
  heartbeat: AiRuntimeBridgeHeartbeat | null,
  snapshot: RuntimeResilienceNodeRow | null,
  fallbackLabel: string,
): RuntimeResilienceNode {
  const telemetry = readHostTelemetry(heartbeat);
  const bridgeState = bridge ? deriveBridgeNodeState(bridge) : 'not_registered';

  const node: RuntimeResilienceNode = {
    nodeId: bridge?.id ?? null,
    nodeKey: bridge?.node_key ?? fallbackLabel.toLowerCase(),
    nodeName: bridge?.name ?? fallbackLabel,
    nodeStatus: 'AWAITING TELEMETRY',
    bridgeStatus: bridgeState,
    watchdogStatus: snapshot?.watchdog_status ?? null,
    lastHeartbeatAt: bridge?.last_heartbeat_at ?? bridge?.last_seen_at ?? null,
    lastLivenessAt: snapshot?.last_liveness_at ?? null,
    livenessAgeMs: snapshot?.liveness_age_ms ?? null,
    lastFaultAt: snapshot?.last_fault_at ?? null,
    lastFaultReason: snapshot?.last_fault_reason ?? null,
    lastRecoveredAt: snapshot?.last_recovered_at ?? null,
    lastRecoveryMs: snapshot?.last_recovery_ms ?? null,
    restartCount24h: snapshot?.restart_count_24h ?? null,
    containerUptimeSeconds: snapshot?.container_uptime_seconds ?? null,
    ollamaStatus: heartbeat?.ollama_status ?? null,
    ollamaModelCount: telemetry.ollamaModelCount,
    n8nStatus: heartbeat?.n8n_status ?? null,
    cpuPercent: telemetry.cpuPercent,
    memoryPercent: telemetry.memoryPercent,
    temperatureC: snapshot?.temperature_c ?? null,
    recoveryTargetMs: snapshot?.recovery_target_ms ?? RECOVERY_TARGET_MS,
    recoveryTargetMet: null,
    updatedAt: snapshot?.updated_at ?? null,
    hasResilienceSnapshot: snapshot != null,
  };

  node.recoveryTargetMet = evaluateRecoveryTargetMet(node);
  node.nodeStatus = evaluateNodeState(node);
  return node;
}

/**
 * Load and compose the Runtime Resilience view for the two runtime nodes.
 * Never fabricates telemetry — absent resilience data renders as
 * AWAITING TELEMETRY, never as HEALTHY. Handles zero rows and partial rows.
 */
export async function loadRuntimeResilience(): Promise<RuntimeResilienceView> {
  const [nodesRes, heartbeatsRes, resilienceRes, eventsRes] = await Promise.all([
    getAiRuntimeBridgeNodes(),
    getAiRuntimeBridgeHeartbeats(50),
    getRuntimeResilienceNodes(),
    getRuntimeRecoveryEvents(20),
  ]);

  const firstError =
    nodesRes.error ?? heartbeatsRes.error ?? resilienceRes.error ?? eventsRes.error;
  if (firstError) {
    return {
      loadState: 'ERROR',
      error: firstError,
      recoveryTargetMs: RECOVERY_TARGET_MS,
      nodes: [],
      events: [],
    };
  }

  const bridgeNodes = nodesRes.data ?? [];
  const heartbeats = heartbeatsRes.data ?? [];
  const resilienceRows = resilienceRes.data ?? [];
  const eventRows = eventsRes.data ?? [];

  // Index bridge nodes + heartbeats by identity.
  const bridgeByKey = new Map<string, AiRuntimeBridgeNode>();
  const bridgeById = new Map<string, AiRuntimeBridgeNode>();
  for (const n of bridgeNodes) {
    bridgeByKey.set(n.node_key, n);
    bridgeById.set(n.id, n);
  }
  const nodeIdToKey = new Map<string, string>();
  for (const n of bridgeNodes) nodeIdToKey.set(n.id, n.node_key);
  const heartbeatByKey = new Map<string, AiRuntimeBridgeHeartbeat>();
  for (const hb of heartbeats) {
    const key = nodeIdToKey.get(hb.node_id);
    if (!key || heartbeatByKey.has(key)) continue;
    heartbeatByKey.set(key, hb);
  }

  // Index resilience snapshots by node_id → bridge node key.
  const snapshotByKey = new Map<string, RuntimeResilienceNodeRow>();
  for (const row of resilienceRows) {
    const key = nodeIdToKey.get(row.node_id) ?? bridgeById.get(row.node_id)?.node_key;
    if (!key || snapshotByKey.has(key)) continue;
    snapshotByKey.set(key, row);
  }

  const nodes = NODE_ORDER.map(({ key, label }) =>
    composeNode(bridgeByKey.get(key) ?? null, heartbeatByKey.get(key) ?? null, snapshotByKey.get(key) ?? null, label),
  );

  const events: RuntimeRecoveryEvent[] = eventRows
    .map((row) => {
      const bridge = bridgeById.get(row.node_id);
      const key = bridge?.node_key ?? row.node_id;
      const name = bridge?.name ?? (key === HAL_RUNTIME_NODE_KEY ? 'HAL' : key === TRON_RUNTIME_NODE_KEY ? 'TRON' : key);
      return {
        id: row.id,
        nodeKey: key,
        nodeName: name,
        faultDetectedAt: row.fault_detected_at,
        faultReason: row.fault_reason,
        recoveryStartedAt: row.recovery_started_at,
        recoveredAt: row.recovered_at,
        recoveryMs: row.recovery_ms,
        recoveryMethod: row.recovery_method,
        targetMs: row.target_ms,
        targetMet: null,
        createdAt: row.created_at,
      };
    })
    .map((e) => ({ ...e, targetMet: evaluateEventTargetMet(e) }))
    .sort((a, b) => {
      const at = (x: RuntimeRecoveryEvent) =>
        x.recoveredAt ?? x.faultDetectedAt ?? x.createdAt ?? '';
      return new Date(at(b)).getTime() - new Date(at(a)).getTime();
    });

  const withSnapshot = nodes.filter((n) => n.hasResilienceSnapshot).length;

  let loadState: RuntimeResilienceLoadState;
  if (nodes.length === 0) loadState = 'NO DATA';
  else if (withSnapshot === 0) loadState = 'NO DATA';
  else if (withSnapshot === nodes.length) loadState = 'LIVE DATA';
  else loadState = 'PARTIAL DATA';

  return {
    loadState,
    error: null,
    recoveryTargetMs: RECOVERY_TARGET_MS,
    nodes,
    events,
  };
}