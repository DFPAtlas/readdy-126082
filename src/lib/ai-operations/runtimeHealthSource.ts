// ============================================================================
// AI Operations — Source-aware runtime health + effective runtime path
// (Phase 3 Prompt 09A).
//
// Runtime health records originate from two distinct sources:
//   * cloud_edge  — checks performed by the cloud `runtime-health` /
//     `runtime-health-scheduled` Edge Functions (persisted to
//     ai_runtime_health_checks). These reach cloud services directly and are
//     the ONLY source that may contact n8n/Ollama via configured cloud URLs.
//   * local_bridge — local n8n / Ollama health relayed through the private
//     runtime bridge heartbeat (ai_runtime_bridge_heartbeats). The bridge is
//     outbound-only; the browser never contacts HAL / n8n / Ollama directly.
//
// `latestBySystem` is source-aware (system → source → latest result) so a
// healthy local bridge never masks a not-configured cloud edge, and vice-versa.
// `effectiveRuntimePath` is a deterministic selector for which source actually
// carries a system's runtime health.
// ============================================================================

import {
  HEALTH_STATUS_META,
  type RuntimeHealthStatus,
} from './runtimeHealth';
import type { DerivedSystemHealth } from './runtimeMonitoring';
import {
  deriveBridgeNodeState,
  REACHABLE_WINDOW_MS,
  STALE_WINDOW_MS,
  type AiRuntimeBridgeNode,
  type AiRuntimeBridgeHeartbeat,
} from './runtimeBridge';

export type HealthSource = 'cloud_edge' | 'local_bridge';

/** system → source → latest derived health (never loses source). */
export type LatestBySystem = Map<
  string,
  Partial<Record<HealthSource, DerivedSystemHealth>>
>;

export type FreshnessState = 'reachable' | 'stale' | 'offline';

/** under 2 min reachable · 2–5 min stale · over 5 min offline. */
export function freshnessOf(iso: string | null | undefined): FreshnessState {
  if (!iso) return 'offline';
  const age = Date.now() - new Date(iso).getTime();
  if (age < REACHABLE_WINDOW_MS) return 'reachable';
  if (age <= STALE_WINDOW_MS) return 'stale';
  return 'offline';
}

function mapLocalServiceStatus(status: string | null | undefined): RuntimeHealthStatus {
  if (status === 'healthy') return 'healthy';
  if (status === 'degraded') return 'degraded';
  if (status === 'unavailable') return 'unavailable';
  return 'unknown';
}

/** Build local-bridge derived health for n8n + Ollama from the latest bridge
 *  heartbeat. Freshness is tracked separately (lastCheckedAt = heartbeat
 *  receive time); a stale heartbeat must not remain permanently healthy. */
export function deriveLocalBridgeHealth(
  heartbeat: AiRuntimeBridgeHeartbeat | null | undefined,
): Map<string, DerivedSystemHealth> {
  const result = new Map<string, DerivedSystemHealth>();
  if (!heartbeat) return result;

  const checkedAt = heartbeat.received_at ?? heartbeat.bridge_timestamp ?? null;

  const make = (system: string, raw: string | null | undefined): DerivedSystemHealth => {
    const status = mapLocalServiceStatus(raw);
    return {
      system,
      source: 'local_bridge',
      currentStatus: status,
      lastCheckedAt: checkedAt,
      lastHealthyAt: status === 'healthy' ? checkedAt : null,
      consecutiveFailures: status === 'degraded' || status === 'unavailable' ? 1 : 0,
      consecutiveSuccesses: status === 'healthy' ? 1 : 0,
      averageLatencyMs: heartbeat.latency_ms ?? null,
      totalChecks: 1,
    };
  };

  result.set('n8n', make('n8n', heartbeat.n8n_status));
  result.set('ollama', make('ollama', heartbeat.ollama_status));
  return result;
}

export function buildLatestBySystem(
  cloudEdge: Map<string, DerivedSystemHealth>,
  localBridge: Map<string, DerivedSystemHealth>,
): LatestBySystem {
  const result: LatestBySystem = new Map();
  const systems = new Set<string>([...cloudEdge.keys(), ...localBridge.keys()]);
  for (const system of systems) {
    const entry: Partial<Record<HealthSource, DerivedSystemHealth>> = {};
    const ce = cloudEdge.get(system);
    const lb = localBridge.get(system);
    if (ce) entry.cloud_edge = ce;
    if (lb) entry.local_bridge = lb;
    result.set(system, entry);
  }
  return result;
}

export type EffectivePath =
  | 'local_bridge'
  | 'cloud_edge'
  | 'stale'
  | 'unavailable'
  | 'not_configured'
  | 'unknown';

export const EFFECTIVE_PATH_META: Record<
  EffectivePath,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  local_bridge: { label: 'HAL Runtime Bridge', tone: 'emerald' },
  cloud_edge: { label: 'Cloud Edge', tone: 'emerald' },
  stale: { label: 'Local Runtime Health Stale', tone: 'amber' },
  unavailable: { label: 'Unavailable', tone: 'red' },
  not_configured: { label: 'Not Configured', tone: 'secondary' },
  unknown: { label: 'Unknown', tone: 'secondary' },
};

/**
 * Deterministic effective runtime path for a system.
 *
 * For n8n / Ollama the local path wins only when ALL of: bridge node reachable,
 * heartbeat fresh, local health fresh AND healthy. Otherwise the path degrades
 * honestly to stale / unavailable / not_configured — cloud_edge is never
 * inferred just because the local bridge is healthy.
 */
export function deriveEffectiveRuntimePath(
  system: string,
  node: AiRuntimeBridgeNode | null | undefined,
  heartbeat: AiRuntimeBridgeHeartbeat | null | undefined,
  localHealth: DerivedSystemHealth | undefined,
): EffectivePath {
  if (system !== 'n8n' && system !== 'ollama') return 'cloud_edge';

  const nodeState = deriveBridgeNodeState(node);
  if (!node || nodeState === 'not_registered') return 'not_configured';
  if (nodeState === 'offline') return 'unavailable';

  const heartbeatFreshness = freshnessOf(heartbeat?.received_at ?? heartbeat?.bridge_timestamp);
  const localFreshness = freshnessOf(localHealth?.lastCheckedAt);

  if (nodeState === 'stale' || heartbeatFreshness === 'stale' || localFreshness === 'stale') {
    return 'stale';
  }
  if (heartbeatFreshness === 'offline' || localFreshness === 'offline') return 'unavailable';

  if (localHealth?.currentStatus === 'healthy') return 'local_bridge';
  if (
    localHealth?.currentStatus === 'degraded' ||
    localHealth?.currentStatus === 'unavailable'
  ) {
    return 'unavailable';
  }
  return 'unknown';
}

/** Compute effective paths for every known system. */
export function computeEffectivePaths(
  latestBySystem: LatestBySystem,
  node: AiRuntimeBridgeNode | null | undefined,
  heartbeat: AiRuntimeBridgeHeartbeat | null | undefined,
): Record<string, EffectivePath> {
  const result: Record<string, EffectivePath> = {};
  for (const [system, sources] of latestBySystem.entries()) {
    result[system] = deriveEffectiveRuntimePath(system, node, heartbeat, sources.local_bridge);
  }
  return result;
}

/**
 * Explicit "overall" selector — consumers that need a single status per system
 * resolve through the effective path instead of whichever record was newest.
 */
export function resolveEffectiveHealth(
  latestBySystem: LatestBySystem,
  system: string,
  effectivePaths?: Record<string, EffectivePath>,
): DerivedSystemHealth | undefined {
  const sources = latestBySystem.get(system);
  if (!sources) return undefined;
  if (effectivePaths?.[system] === 'local_bridge' && sources.local_bridge) {
    return sources.local_bridge;
  }
  return sources.cloud_edge ?? sources.local_bridge;
}

/** Local-runtime connectivity label that bakes in freshness (stale/offline). */
export function describeLocalRuntime(
  local: DerivedSystemHealth | undefined,
): { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' } {
  if (!local) return { label: 'Not Reported', tone: 'secondary' };
  const freshness = freshnessOf(local.lastCheckedAt);
  if (freshness === 'offline') return { label: 'Offline', tone: 'red' };
  if (freshness === 'stale') return { label: 'Stale', tone: 'amber' };
  const meta = HEALTH_STATUS_META[local.currentStatus];
  return { label: meta.label, tone: meta.tone };
}

/** Compact effective-path line, e.g. "n8n · Local Bridge · Healthy". */
export function effectivePathSummary(
  system: string,
  path: EffectivePath,
  local: DerivedSystemHealth | undefined,
  cloud: DerivedSystemHealth | undefined,
): string {
  if (path === 'local_bridge') {
    const status = local ? HEALTH_STATUS_META[local.currentStatus].label : 'Healthy';
    return `${system} · Local Bridge · ${status}`;
  }
  if (path === 'cloud_edge') {
    const status = cloud ? HEALTH_STATUS_META[cloud.currentStatus].label : 'Unknown';
    return `${system} · Cloud Edge · ${status}`;
  }
  return `${system} · ${EFFECTIVE_PATH_META[path].label}`;
}