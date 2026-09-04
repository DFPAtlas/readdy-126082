// ============================================================================
// AI Operations — Wallboard Infrastructure selectors.
//
// Pure read-only derivations over the infrastructure snapshot (see
// infrastructureStore.ts) + the shared runtime-health store (HAL bridge node /
// heartbeat). These produce a distance-readable infrastructure view for the
// wallboard and the critical incidents that feed Wallboard 22 Incident Mode.
//
// Honesty rules honoured here:
//   * Statuses are NORMALISED for wallboard presentation only (HEALTHY /
//     WARNING / DEGRADED / OFFLINE / UNKNOWN). Underlying monitoring states are
//     never rewritten.
//   * OFFLINE (a reachability failure) is kept distinct from UNKNOWN
//     (not-configured / no data). A single missing metric never implies
//     offline.
//   * CPU / RAM / disk / temperature are NOT exposed anywhere in the system, so
//     they remain "unavailable" — never fabricated.
//   * Only authoritative states trigger incidents: the HAL host going OFFLINE
//     (primary runtime host) and registered services in OFFLINE/DEGRADED. The
//     degraded/faulted thresholds are the ones already computed server-side by
//     dfp-health-probe — nothing is invented here.
// ============================================================================

import {
  getInfrastructureData,
  type InfraServiceRow,
} from '@/pages/ai-operations/wallboard/infrastructureStore';
import { getRuntimeHealthState } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { deriveBridgeNodeState } from '@/lib/ai-operations/runtimeBridge';
import { freshnessOf } from '@/lib/ai-operations/runtimeHealthSource';

// --- Normalised wallboard status ---------------------------------------------

export type InfraStatus = 'healthy' | 'warning' | 'degraded' | 'offline' | 'unknown';

export const INFRA_STATUS_META: Record<
  InfraStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  healthy: { label: 'HEALTHY', tone: 'emerald' },
  warning: { label: 'WARNING', tone: 'amber' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'OFFLINE', tone: 'red' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/** Normalise the dfp_service_health status onto the wallboard levels. */
function normalizeServiceStatus(status: string | null | undefined): InfraStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':
      return 'healthy';
    case 'degraded':
      return 'degraded';
    case 'offline':
    case 'unavailable':
    case 'failed':
    case 'error':
      return 'offline';
    case 'stale':
      return 'warning';
    case 'not_configured':
    case 'not_testable':
    case 'unknown':
    default:
      return 'unknown';
  }
}

/** Normalise the HAL bridge node state onto the wallboard levels. */
function normalizeBridgeStatus(): InfraStatus {
  const node = getRuntimeHealthState().bridgeNode;
  const state = deriveBridgeNodeState(node);
  switch (state) {
    case 'reachable':
      return 'healthy';
    case 'stale':
      return 'warning';
    case 'offline':
      return 'offline';
    case 'degraded':
      return 'degraded';
    case 'not_registered':
    default:
      return 'unknown';
  }
}

// --- Tile model --------------------------------------------------------------

export interface InfraTile {
  key: string;
  name: string;
  role: string;
  category: string;
  kind: 'host' | 'service';
  status: InfraStatus;
  latencyMs: number | null;
  lastSeen: string | null;
  message: string | null;
}

/** The physical local runtime host (HAL) — the single registered host. */
export function getInfrastructureHosts(): InfraTile[] {
  const health = getRuntimeHealthState();
  const node = health.bridgeNode;
  if (!node) return [];

  const status = normalizeBridgeStatus();
  const hb = health.latestHeartbeat;

  return [
    {
      key: node.node_key,
      name: node.name ?? node.node_key,
      role: 'Local Runtime Host',
      category: 'host',
      kind: 'host',
      status,
      latencyMs: hb?.latency_ms ?? null,
      lastSeen: node.last_seen_at,
      message:
        status === 'healthy'
          ? 'Outbound bridge reachable · n8n + Ollama health relayed'
          : 'Connectivity derived from last bridge heartbeat',
    },
  ];
}

/** The registered services from dfp_service_health. */
export function getInfrastructureServices(): InfraTile[] {
  const data = getInfrastructureData();
  return data.services.map((s: InfraServiceRow) => ({
    key: s.service,
    name: s.display_name ?? s.service,
    role: s.category ?? 'service',
    category: s.category ?? 'service',
    kind: 'service' as const,
    status: normalizeServiceStatus(s.status),
    latencyMs: s.response_time_ms,
    lastSeen: s.checked_at,
    message: s.message,
  }));
}

// --- Summary -----------------------------------------------------------------

export interface InfraSummary {
  total: number;
  healthy: number;
  warning: number;
  degraded: number;
  offline: number;
  unknown: number;
  sourceState: 'live' | 'partial' | 'unavailable';
}

export function getInfrastructureSummary(): InfraSummary {
  const hosts = getInfrastructureHosts();
  const services = getInfrastructureServices();
  const infraData = getInfrastructureData();
  const health = getRuntimeHealthState();

  const all = [...hosts, ...services];
  const counts = { healthy: 0, warning: 0, degraded: 0, offline: 0, unknown: 0 };
  for (const t of all) counts[t.status] += 1;

  const servicesAvailable = infraData.availability && !infraData.loading;
  const hostAvailable = health.bridgeNode != null;

  let sourceState: InfraSummary['sourceState'];
  if (infraData.loading && health.historyLoading) {
    sourceState = 'unavailable';
  } else if (servicesAvailable && hostAvailable) {
    sourceState = 'live';
  } else if (servicesAvailable || hostAvailable) {
    sourceState = 'partial';
  } else {
    sourceState = 'unavailable';
  }

  return { total: all.length, ...counts, sourceState };
}

// --- Network / connectivity ---------------------------------------------------

export interface InfraNetwork {
  /** HAL outbound bridge connectivity (the only live network signal). */
  bridgeStatus: InfraStatus;
  bridgeLabel: string;
  latencyMs: number | null;
  /** Friendly note that physical network devices are not monitored. */
  note: string;
}

export function getInfrastructureNetwork(): InfraNetwork {
  const health = getRuntimeHealthState();
  const hb = health.latestHeartbeat;
  const status = normalizeBridgeStatus();
  const freshness = freshnessOf(hb?.received_at ?? hb?.bridge_timestamp ?? null);

  let bridgeLabel: string;
  switch (freshness) {
    case 'reachable':
      bridgeLabel = 'Reachable';
      break;
    case 'stale':
      bridgeLabel = 'Stale';
      break;
    case 'offline':
    default:
      bridgeLabel = 'No recent heartbeat';
      break;
  }

  return {
    bridgeStatus: status,
    bridgeLabel,
    latencyMs: hb?.latency_ms ?? null,
    note: 'Physical network devices (WAN / core switch / OPNsense firewall) are not monitored.',
  };
}

// --- Storage ------------------------------------------------------------------

export interface InfraStorage {
  items: InfraTile[];
  note: string;
}

/** Storage-relevant registered services (Supabase Storage + Backups). */
export function getInfrastructureStorage(): InfraStorage {
  const services = getInfrastructureServices();
  const storageServices = services.filter((s) =>
    ['supabase_storage', 'backups'].includes(s.key),
  );
  return {
    items: storageServices,
    note: 'Physical storage (TrueNAS / Atlas Vault) is not monitored.',
  };
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ---------------------

export interface InfraIncident {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  affectedService: string;
  sourceLabel: string;
  firstDetected: string | null;
  lastUpdated: string | null;
  status: string;
  description: string;
}

/**
 * Authoritative infrastructure incidents only:
 *   * HAL (primary runtime host) OFFLINE → CRITICAL.
 *   * Registered service OFFLINE → HIGH.
 *   * Registered service DEGRADED (e.g. stale backups) → HIGH.
 *
 * not_configured / unknown are NOT incidents (no failure), so unconfigured
 * services never raise the alarm.
 */
export function getInfrastructureIncidents(): InfraIncident[] {
  const incidents: InfraIncident[] = [];

  for (const h of getInfrastructureHosts()) {
    if (h.status !== 'offline') continue;
    incidents.push({
      id: `infra-host-${h.key}`,
      severity: 'critical',
      title: `${h.name} is offline`,
      affectedService: h.name,
      sourceLabel: 'Infrastructure',
      firstDetected: h.lastSeen,
      lastUpdated: h.lastSeen,
      status: 'offline',
      description: 'Primary local runtime host is not reachable (last heartbeat exceeded the offline threshold).',
    });
  }

  for (const s of getInfrastructureServices()) {
    if (s.status === 'offline') {
      incidents.push({
        id: `infra-service-${s.key}`,
        severity: 'high',
        title: `${s.name} is unavailable`,
        affectedService: s.name,
        sourceLabel: 'Infrastructure',
        firstDetected: s.lastSeen,
        lastUpdated: s.lastSeen,
        status: 'offline',
        description: s.message ?? 'Service is unreachable.',
      });
    } else if (s.status === 'degraded') {
      incidents.push({
        id: `infra-service-${s.key}`,
        severity: 'high',
        title: `${s.name} is degraded`,
        affectedService: s.name,
        sourceLabel: 'Infrastructure',
        firstDetected: s.lastSeen,
        lastUpdated: s.lastSeen,
        status: 'degraded',
        description: s.message ?? 'Service is degraded.',
      });
    }
  }

  return incidents;
}