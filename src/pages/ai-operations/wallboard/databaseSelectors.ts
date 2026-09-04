// ============================================================================
// AI Operations — Wallboard Database & Supabase selectors.
//
// Pure read-only derivations over the database snapshot (databaseStore.ts) +
// the live supabase service probe (dfp_service_health, reused via
// infrastructureStore.ts) + backup risk (reused via backupStore.ts). These
// produce a distance-readable database/Supabase view and the critical
// database incidents that feed Wallboard 22 Incident Mode.
//
// Honesty rules honoured here:
//   * Presentation states (HEALTHY / DEGRADED / OFFLINE / UNKNOWN /
//     NOT CONFIGURED) are NORMALISED for the wallboard only — the underlying
//     monitor states (healthy/warning/failed/unknown) are never rewritten.
//   * A single non-database service failing is DEGRADED, never OFFLINE. Only an
//     explicit database_status=failed reading marks a backend OFFLINE.
//   * Capacity (db size / storage / connections / pool) has NO authoritative
//     metric source, so it is surfaced honestly as "not monitored" — never
//     invented, and no percentages are manufactured.
//   * Migration state has NO tracking source, so it is reported "not tracked".
//   * Monitoring-unavailable is never reported as healthy.
// ============================================================================

import {
  getDatabaseData,
  type SupabaseMonitorRow,
} from '@/pages/ai-operations/wallboard/databaseStore';
import { getInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import { getBackupSummary } from '@/pages/ai-operations/wallboard/backupSelectors';

// --- Normalised wallboard status ---------------------------------------------

export type DatabaseState = 'healthy' | 'degraded' | 'offline' | 'unknown' | 'not_configured';

export const DATABASE_STATE_META: Record<
  DatabaseState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  healthy: { label: 'HEALTHY', tone: 'emerald' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'OFFLINE', tone: 'red' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
  not_configured: { label: 'NOT CONFIGURED', tone: 'secondary' },
};

/** Normalise a single monitor service status onto the wallboard levels. */
function normalizeServiceStatus(status: string | null | undefined): DatabaseState {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':
      return 'healthy';
    case 'warning':
      return 'degraded';
    case 'failed':
    case 'error':
      return 'offline';
    case 'unknown':
    default:
      return 'unknown';
  }
}

// --- Core service labels ------------------------------------------------------

export interface CoreService {
  key: 'database' | 'auth' | 'realtime' | 'storage' | 'functions';
  label: string;
  status: DatabaseState;
}

/** Extract the five core service states for a single monitor. */
function coreServices(m: SupabaseMonitorRow): CoreService[] {
  return [
    { key: 'database', label: 'Database', status: normalizeServiceStatus(m.database_status) },
    { key: 'auth', label: 'Auth', status: normalizeServiceStatus(m.auth_status) },
    { key: 'realtime', label: 'Realtime', status: normalizeServiceStatus(m.realtime_status) },
    { key: 'storage', label: 'Storage', status: normalizeServiceStatus(m.storage_status) },
    { key: 'functions', label: 'Edge Functions', status: normalizeServiceStatus(m.edge_functions_status) },
  ];
}

// --- Per-database card model --------------------------------------------------

export interface DatabaseCard {
  key: string;
  name: string;
  site: string;
  state: DatabaseState;
  services: CoreService[];
  anonKeyConfigured: boolean;
  serviceRoleConfigured: boolean;
  lastChecked: string | null;
  liveLatency: { database: number | null; auth: number | null; storage: number | null };
}

/** Friendly site name from the project registry. */
function projectName(projectId: number): string {
  const data = getDatabaseData();
  return data.projects.find((p) => p.id === projectId)?.project_name ?? '';
}

/**
 * The LIVE latency probe (dfp_service_health, already fetched by
 * infrastructureStore). Returns response-time for supabase database / auth /
 * storage. This is a group-wide live probe, not a per-monitor metric.
 */
function liveLatency(): DatabaseCard['liveLatency'] {
  const infra = getInfrastructureData();
  const find = (service: string) =>
    infra.services.find((s) => s.service === service)?.response_time_ms ?? null;
  return {
    database: find('supabase_database'),
    auth: find('supabase_auth'),
    storage: find('supabase_storage'),
  };
}

/** Overall state for a monitor — a single service failure never means OFFLINE. */
function overallState(services: CoreService[]): DatabaseState {
  const database = services.find((s) => s.key === 'database')?.status;
  const hasOffline = services.some((s) => s.status === 'offline');
  const hasDegraded = services.some((s) => s.status === 'degraded');
  const allHealthy = services.every((s) => s.status === 'healthy');
  const allUnknown = services.every((s) => s.status === 'unknown');

  if (database === 'offline') return 'offline';
  if (hasOffline || hasDegraded) return 'degraded';
  if (allHealthy) return 'healthy';
  if (allUnknown) return 'unknown';
  return 'unknown';
}

/** Registered database/backends (one card per Supabase monitor). */
export function getDatabaseCards(): DatabaseCard[] {
  const data = getDatabaseData();
  const lat = liveLatency();

  return data.monitors.map((m: SupabaseMonitorRow) => {
    const services = coreServices(m);
    return {
      key: `db-${m.id}`,
      name: m.supabase_project_name,
      site: projectName(m.project_id),
      state: overallState(services),
      services,
      anonKeyConfigured: m.anon_key_configured,
      serviceRoleConfigured: m.service_role_configured,
      lastChecked: m.last_checked_at,
      liveLatency: lat,
    };
  });
}

/** Projects in the registry with no Supabase monitor (NOT CONFIGURED). */
export function getUnconfiguredDatabases(): { id: number; name: string }[] {
  const data = getDatabaseData();
  const monitoredProjectIds = new Set(data.monitors.map((m) => m.project_id));
  return data.projects
    .filter((p) => !monitoredProjectIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.project_name }));
}

// --- Core services (group-level) ---------------------------------------------

export interface CoreServicesSummary {
  database: DatabaseState;
  auth: DatabaseState;
  realtime: DatabaseState;
  storage: DatabaseState;
  functions: DatabaseState;
  /** Live probe latency for database/auth/storage (dfp-health-probe). */
  liveLatency: { database: number | null; auth: number | null; storage: number | null };
  liveProbeAvailable: boolean;
}

/** Group-wide core service roll-up (worst state across all monitors). */
export function getCoreServicesSummary(): CoreServicesSummary {
  const cards = getDatabaseCards();
  const lat = liveLatency();
  const infra = getInfrastructureData();
  const liveProbeAvailable =
    infra.availability && infra.services.some((s) => s.service.startsWith('supabase_'));

  const worst = (key: CoreService['key']): DatabaseState => {
    const states = cards.flatMap((c) => c.services.filter((s) => s.key === key).map((s) => s.status));
    if (states.length === 0) return 'unknown';
    if (states.includes('offline')) return 'offline';
    if (states.includes('degraded')) return 'degraded';
    if (states.includes('unknown')) return 'unknown';
    return 'healthy';
  };

  return {
    database: worst('database'),
    auth: worst('auth'),
    realtime: worst('realtime'),
    storage: worst('storage'),
    functions: worst('functions'),
    liveLatency: lat,
    liveProbeAvailable,
  };
}

// --- Edge function summary ----------------------------------------------------

export interface EdgeFunctionSummary {
  total: number;
  healthy: number;
  errored: number;
  other: number;
  sourceState: 'live' | 'unavailable';
}

export function getEdgeFunctionSummary(): EdgeFunctionSummary {
  const data = getDatabaseData();
  const fns = data.edgeFunctions;

  const healthy = fns.filter((f) => (f.status ?? '').toLowerCase() === 'healthy').length;
  const errored = fns.filter((f) =>
    ['failed', 'error'].includes((f.status ?? '').toLowerCase()),
  ).length;

  return {
    total: fns.length,
    healthy,
    errored,
    other: fns.length - healthy - errored,
    sourceState: data.edgeFunctionsAvailability && !data.loading ? 'live' : 'unavailable',
  };
}

// --- Summary -----------------------------------------------------------------

export interface DatabaseSummary {
  total: number;
  healthy: number;
  degraded: number;
  offline: number;
  unknown: number;
  notConfigured: number;
  sourceState: 'live' | 'partial' | 'unavailable';
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getDatabaseSummary(): DatabaseSummary {
  const data = getDatabaseData();
  const cards = getDatabaseCards();
  const unconfigured = getUnconfiguredDatabases().length;

  const counts = { healthy: 0, degraded: 0, offline: 0, unknown: 0 };
  for (const c of cards) counts[c.state] += 1;

  const available = data.monitorsAvailability && !data.loading;
  let sourceState: DatabaseSummary['sourceState'];
  if (data.loading) {
    sourceState = 'unavailable';
  } else if (available) {
    sourceState = 'live';
  } else {
    sourceState = 'unavailable';
  }

  let label: string;
  let detail: string;
  let tone: DatabaseSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'DATABASE STATUS UNKNOWN';
    detail = 'Database monitoring source could not be reached.';
    tone = 'secondary';
  } else if (counts.offline > 0) {
    label = 'DATABASE OFFLINE';
    detail = `${counts.offline} backend${counts.offline > 1 ? 's' : ''} unreachable.`;
    tone = 'red';
  } else if (counts.degraded > 0) {
    label = 'DATABASE DEGRADED';
    detail = `${counts.degraded} backend${counts.degraded > 1 ? 's' : ''} with a degraded service.`;
    tone = 'amber';
  } else {
    label = 'DATABASES HEALTHY';
    detail = 'All monitored backends report healthy core services.';
    tone = 'emerald';
  }

  return {
    total: cards.length,
    healthy: counts.healthy,
    degraded: counts.degraded,
    offline: counts.offline,
    unknown: counts.unknown,
    notConfigured: unconfigured,
    sourceState,
    label,
    detail,
    tone,
  };
}

// --- Backup risk (reused, not duplicated) ------------------------------------

export interface BackupRiskView {
  hasRisk: boolean;
  label: string;
}

/** Preserve the database/backup distinction — a database can be healthy but at
 *  backup risk. Reuses the existing Wallboard 28 backup summary. */
export function getBackupRisk(): BackupRiskView {
  const summary = getBackupSummary();
  if (summary.sourceState === 'unavailable') {
    return { hasRisk: false, label: 'Backup status unknown' };
  }
  const risk =
    summary.failed > 0 || summary.stale > 0 || summary.neverBackedUp > 0;
  return {
    hasRisk: risk,
    label: risk
      ? `Backup risk — ${summary.failed + summary.stale + summary.neverBackedUp} target(s)`
      : 'Backups current',
  };
}

// --- Monitoring gaps (honest, never fabricated) ------------------------------

export interface DatabaseGap {
  area: string;
  note: string;
}

export function getDatabaseGaps(): DatabaseGap[] {
  return [
    { area: 'Database size / capacity', note: 'No authoritative size or capacity metric source.' },
    { area: 'Connection / pool utilisation', note: 'No connection-pool telemetry source.' },
    { area: 'Storage utilisation', note: 'No storage-capacity metric source.' },
    { area: 'Slow-query / error rate', note: 'No aggregate query-performance source.' },
    { area: 'Migration state', note: 'No migration tracking source is registered.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) --------------------

export interface DatabaseIncident {
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
 * Authoritative database incidents only (existing approved conditions):
 *   * database_status failed (production database unreachable) → CRITICAL.
 *   * auth_status failed (production authentication unavailable) → CRITICAL.
 *   * storage / edge-functions / realtime failed (critical backend service
 *     failure) → HIGH.
 *
 * warning / unknown / not_configured never raise the alarm. No thresholds are
 * invented — only explicit `failed` monitor readings are used.
 */
export function getDatabaseIncidents(): DatabaseIncident[] {
  const data = getDatabaseData();
  const incidents: DatabaseIncident[] = [];

  for (const m of data.monitors) {
    const name = m.supabase_project_name;
    const site = projectName(m.project_id);
    const affected = site ? `${name} (${site})` : name;

    const push = (
      key: string,
      status: string | null,
      serviceLabel: string,
      severity: 'critical' | 'high',
      description: string,
    ) => {
      if (normalizeServiceStatus(status) !== 'offline') return;
      incidents.push({
        id: `db-${m.id}-${key}`,
        severity,
        title: `${name} ${serviceLabel} unavailable`,
        affectedService: affected,
        sourceLabel: 'Database',
        firstDetected: m.last_checked_at,
        lastUpdated: m.last_checked_at,
        status: 'failed',
        description,
      });
    };

    push('database', m.database_status, 'database', 'critical', 'Production database is reporting an unreachable state.');
    push('auth', m.auth_status, 'authentication', 'critical', 'Production authentication service is reporting an unavailable state.');
    push('storage', m.storage_status, 'storage', 'high', 'Storage service is reporting a failed state.');
    push('functions', m.edge_functions_status, 'edge functions', 'high', 'Edge function service is reporting a failed state.');
    push('realtime', m.realtime_status, 'realtime', 'high', 'Realtime service is reporting a failed state.');
  }

  return incidents;
}