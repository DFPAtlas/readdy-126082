// ============================================================================
// AI Operations — Wallboard Diagnostics (Prompt 36).
//
// A READ-ONLY diagnostics layer over the existing wallboard data sources.
// Every source already loads into a module-level snapshot store; this module
// re-derives a source health matrix, metric traceability, snapshot status and
// a demo-data audit from those snapshots — no new queries, no new tables, no
// new polling, no writes.
//
// It is INTENTIONALLY not a control console: no restart, no credential
// rotation, no firewall/payment/account actions, no service restarts. The only
// "action" exposed is a safe re-derivation + the existing read-only refresh.
//
// Secrets are never surfaced: raw error strings (if ever present) are
// sanitised, and only friendly labels / aggregate states are derived.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { getInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import { getPowerData } from '@/pages/ai-operations/wallboard/powerStore';
import { getSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { getBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import { getSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import { getWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import { getRuntimeHealthState } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { getWallboardWeatherSnapshot } from '@/pages/ai-operations/wallboard/weather';
import type { Role } from '@/lib/permissions';

// --- Status model ------------------------------------------------------------

export type DiagnosticSourceStatus =
  | 'healthy'
  | 'degraded'
  | 'error'
  | 'stale'
  | 'not_configured'
  | 'unknown';

export const DIAGNOSTIC_STATUS_META: Record<
  DiagnosticSourceStatus,
  { label: string; badge: string; dot: string }
> = {
  healthy: {
    label: 'HEALTHY',
    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  degraded: {
    label: 'DEGRADED',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  error: {
    label: 'ERROR',
    badge: 'text-red-400 bg-red-500/10 border-red-500/30',
    dot: 'bg-red-400',
  },
  stale: {
    label: 'STALE',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  not_configured: {
    label: 'NOT CONFIGURED',
    badge: 'text-foreground-500 bg-background-200/60 border-background-300/60',
    dot: 'bg-foreground-400',
  },
  unknown: {
    label: 'UNKNOWN',
    badge: 'text-foreground-500 bg-background-200/60 border-background-300/60',
    dot: 'bg-foreground-400',
  },
};

// --- Access ------------------------------------------------------------------

/** Diagnostics is administrator-only (owner / admin). UI visibility only —
 *  the route itself is already protected by the global AuthGuard. */
export function canAccessWallboardDiagnostics(role: Role | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

// --- Sanitisation ------------------------------------------------------------

// Strip any accidental secrets from a raw error before it is shown. The
// wallboard stores already return user-safe messages, but this is a final
// defence-in-depth pass so tokens/keys/connection strings never reach the UI.
export function sanitizeDiagnosticError(raw: unknown): string {
  if (raw == null) return 'No error recorded';
  let s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  s = s
    .replace(/(Bearer\s+)[A-Za-z0-9._~\-]+/gi, '$1[redacted]')
    .replace(/\b(api[_-]?key|apikey|secret|password|token|authorization)\s*[:=]\s*[^\s,;&]+/gi, '$1=[redacted]')
    .replace(/postgres(ql)?:\/\/[^\s"'`]+/gi, 'postgres://[redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email redacted]');
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

// --- Source matrix -----------------------------------------------------------

export interface DataSourceDiagnostic {
  key: string;
  label: string;
  usedBy: string;
  status: DiagnosticSourceStatus;
  /** Last successful update, where determinable from the current snapshot. */
  lastSuccessAt: Date | null;
  /** Last attempt (success or failure) reflected by the store snapshot. */
  lastAttemptAt: Date | null;
  /** Sanitised, administrator-safe error/detail (never secrets). */
  lastError: string | null;
  demo: boolean;
}

// Combine a set of boolean availability flags into a single status. This maps
// a family of queries (e.g. the many business/workload registries) onto the
// six diagnostic states: all-ok → healthy, some-ok → degraded, none-ok → error.
function familyStatus(
  flags: boolean[],
  loading: boolean,
  lastRefreshed: Date,
  now: number,
  staleMs: number,
): DiagnosticSourceStatus {
  if (loading) return 'unknown';
  const ok = flags.filter(Boolean).length;
  if (ok === flags.length) {
    return now - lastRefreshed.getTime() > staleMs ? 'stale' : 'healthy';
  }
  if (ok === 0) return 'error';
  return 'degraded';
}

function singleStatus(ok: boolean, loading: boolean, lastRefreshed: Date, now: number, staleMs: number): DiagnosticSourceStatus {
  if (loading) return 'unknown';
  if (!ok) return 'error';
  return now - lastRefreshed.getTime() > staleMs ? 'stale' : 'healthy';
}

const toDate = (d: Date | null | undefined): Date | null => (d ? d : null);

/**
 * Build the full data-source matrix from the current live snapshots. Pure read
 * — no network, no writes.
 */
export function getDataSourceDiagnostics(now: number, staleMs: number): DataSourceDiagnostic[] {
  const group = getGroupLiveData();
  const a = group.availability;
  const business = getBusinessData();
  const infra = getInfrastructureData();
  const power = getPowerData();
  const security = getSecurityData();
  const backup = getBackupData();
  const sites = getSiteMonitorData();
  const workload = getWorkloadData();
  const health = getRuntimeHealthState();
  const weather = getWallboardWeatherSnapshot();

  const groupLast = toDate(group.lastRefreshed);
  const groupLoading = group.loading;

  const rows: DataSourceDiagnostic[] = [];

  // --- Group live registries (ai_* ) ---------------------------------------
  const groupEntries: Array<{
    key: string;
    label: string;
    usedBy: string;
    flags: boolean[];
    notConfiguredDetail?: string;
  }> = [
    { key: 'sites', label: 'Group Site Registry', usedBy: 'Sites, Command Overview', flags: [a.sites] },
    { key: 'agents', label: 'AI Agents', usedBy: 'Agents Working, KPI strip', flags: [a.agents] },
    { key: 'runs', label: 'AI Runs', usedBy: 'Active Operations', flags: [a.runs] },
    { key: 'approvals', label: 'Approvals', usedBy: 'Approvals Watch', flags: [a.approvals] },
    { key: 'alerts-incidents', label: 'Alerts & Incidents', usedBy: 'Critical Alerts, Incident Mode', flags: [a.alerts, a.incidents] },
    { key: 'orchestrations-tools', label: 'Orchestrations & Tools', usedBy: 'Active Operations, System Health', flags: [a.orchestrations, a.tools, a.toolAccess] },
    { key: 'models-providers', label: 'Models & Providers', usedBy: 'System Health, AI Spend', flags: [a.models, a.modelAssignments, a.providers] },
    { key: 'knowledge-policies', label: 'Knowledge & Policies', usedBy: 'System Health', flags: [a.knowledge, a.knowledgePermissions, a.policies] },
    { key: 'schedules-rules', label: 'Schedules & Notifications', usedBy: 'System Health', flags: [a.schedules, a.rules] },
    { key: 'costs-budgets', label: 'Costs & Budgets', usedBy: 'AI Spend, Costs & Health', flags: [a.budgets, a.usageCosts, a.budgetEvents] },
    { key: 'presence', label: 'Users Online (presence)', usedBy: 'Users Online', flags: [a.usersOnline] },
  ];

  for (const e of groupEntries) {
    const status = familyStatus(e.flags, groupLoading, group.lastRefreshed, now, staleMs);
    const okAny = e.flags.some(Boolean);
    rows.push({
      key: e.key,
      label: e.label,
      usedBy: e.usedBy,
      status,
      lastSuccessAt: okAny ? groupLast : null,
      lastAttemptAt: groupLast,
      lastError: status === 'error' || status === 'degraded'
        ? (okAny ? 'Partial — one or more registries unavailable' : 'Query failed — registry unavailable')
        : null,
      demo: group.mode === 'demo',
    });
  }

  // --- Business --------------------------------------------------------------
  const bizFlags = Object.values(business.availability);
  const bizStatus = familyStatus(bizFlags, business.loading, business.lastRefreshed, now, staleMs);
  rows.push({
    key: 'business',
    label: 'Business Data',
    usedBy: 'Business view (leads, revenue, projects)',
    status: bizStatus,
    lastSuccessAt: bizFlags.some(Boolean) ? toDate(business.lastRefreshed) : null,
    lastAttemptAt: toDate(business.lastRefreshed),
    lastError: bizStatus === 'error' || bizStatus === 'degraded'
      ? `${bizFlags.filter((f) => f).length}/${bizFlags.length} business registries loaded`
      : null,
    demo: false,
  });

  // --- Infrastructure ---------------------------------------------------------
  rows.push({
    key: 'infrastructure',
    label: 'Infrastructure (services)',
    usedBy: 'Infrastructure view',
    status: singleStatus(infra.availability, infra.loading, infra.lastRefreshed, now, staleMs),
    lastSuccessAt: infra.availability ? toDate(infra.lastRefreshed) : null,
    lastAttemptAt: toDate(infra.lastRefreshed),
    lastError: infra.availability ? null : 'dfp_service_health query failed',
    demo: false,
  });

  // --- Runtime bridge (HAL host) ---------------------------------------------
  const bridgeStatus: DiagnosticSourceStatus = health.historyError
    ? 'error'
    : health.bridgeNode == null
      ? 'not_configured'
      : 'healthy';
  rows.push({
    key: 'runtime-bridge',
    label: 'Runtime Bridge (HAL host)',
    usedBy: 'Runtime connectivity, Infrastructure',
    status: bridgeStatus,
    lastSuccessAt: health.bridgeNode?.last_heartbeat_at ? new Date(health.bridgeNode.last_heartbeat_at) : null,
    lastAttemptAt: null,
    lastError: health.historyError
      ? sanitizeDiagnosticError(health.historyError)
      : health.bridgeNode == null
        ? 'No runtime bridge host registered'
        : null,
    demo: false,
  });

  // --- Power / UPS ------------------------------------------------------------
  const powerStatus: DiagnosticSourceStatus =
    power.sourceStatus === 'live'
      ? 'healthy'
      : power.sourceStatus === 'unavailable'
        ? 'error'
        : 'not_configured';
  rows.push({
    key: 'power',
    label: 'Power / UPS',
    usedBy: 'Power & Comm Room view',
    status: powerStatus,
    lastSuccessAt: power.sourceStatus === 'live' ? toDate(power.lastRefreshed) : null,
    lastAttemptAt: toDate(power.lastRefreshed),
    lastError: power.sourceStatus === 'unavailable'
      ? 'Telemetry source unreachable'
      : power.sourceStatus === 'not_configured'
        ? 'No telemetry source registered (NUT / Home Assistant / TrueNAS / IPMI)'
        : null,
    demo: false,
  });

  // --- Security ---------------------------------------------------------------
  rows.push({
    key: 'security',
    label: 'Security & Sessions',
    usedBy: 'Security & Connectivity view',
    status: singleStatus(security.availability, security.loading, security.lastRefreshed, now, staleMs),
    lastSuccessAt: security.availability ? toDate(security.lastRefreshed) : null,
    lastAttemptAt: toDate(security.lastRefreshed),
    lastError: security.availability ? null : 'support_sessions query failed',
    demo: false,
  });

  // --- Backups ----------------------------------------------------------------
  const backupFlags = [backup.recordsAvailability, backup.drillsAvailability];
  const backupStatus = familyStatus(backupFlags, backup.loading, backup.lastRefreshed, now, staleMs);
  rows.push({
    key: 'backups',
    label: 'Backups & Recovery',
    usedBy: 'Backups & Recovery view',
    status: backupStatus,
    lastSuccessAt: backupFlags.some(Boolean) ? toDate(backup.lastRefreshed) : null,
    lastAttemptAt: toDate(backup.lastRefreshed),
    lastError: backupStatus === 'error' || backupStatus === 'degraded'
      ? (backupFlags.some(Boolean) ? 'Partial — backup_records or restore_drills unavailable' : 'Backup registries query failed')
      : null,
    demo: false,
  });

  // --- Website health ---------------------------------------------------------
  rows.push({
    key: 'website-health',
    label: 'Website Health',
    usedBy: 'Sites & Services view',
    status: singleStatus(sites.availability, sites.loading, sites.lastRefreshed, now, staleMs),
    lastSuccessAt: sites.availability ? toDate(sites.lastRefreshed) : null,
    lastAttemptAt: toDate(sites.lastRefreshed),
    lastError: sites.availability ? null : 'internal_monitored_websites query failed',
    demo: false,
  });

  // --- Workload ---------------------------------------------------------------
  const wlFlags = Object.values(workload.availability);
  const wlStatus = familyStatus(wlFlags, workload.loading, workload.lastRefreshed, now, staleMs);
  rows.push({
    key: 'workload',
    label: 'Operations Workload',
    usedBy: 'Operations Workload view',
    status: wlStatus,
    lastSuccessAt: wlFlags.some(Boolean) ? toDate(workload.lastRefreshed) : null,
    lastAttemptAt: toDate(workload.lastRefreshed),
    lastError: wlStatus === 'error' || wlStatus === 'degraded'
      ? `${wlFlags.filter((f) => f).length}/${wlFlags.length} workload registries loaded`
      : null,
    demo: false,
  });

  // --- Weather ----------------------------------------------------------------
  const weatherStatus: DiagnosticSourceStatus =
    weather.sourceStatus === 'live'
      ? 'healthy'
      : 'unavailable';
  rows.push({
    key: 'weather',
    label: 'Weather (Open-Meteo)',
    usedBy: 'Office Information Strip',
    status: weatherStatus,
    lastSuccessAt: weather.sourceStatus === 'live' ? weather.updatedAt : null,
    lastAttemptAt: weather.updatedAt,
    lastError: weather.sourceStatus !== 'live' ? 'Open-Meteo request failed or returned a non-200 response' : null,
    demo: false,
  });

  return rows;
}

// --- Metric traceability -------------------------------------------------------

export interface MetricTrace {
  metric: string;
  source: string;
  status: DiagnosticSourceStatus;
  lastRefresh: Date | null;
}

export function getMetricTraces(now: number, staleMs: number): MetricTrace[] {
  const sources = getDataSourceDiagnostics(now, staleMs);
  const byKey = new Map(sources.map((s) => [s.key, s]));

  const pick = (key: string) => {
    const s = byKey.get(key);
    return { status: s?.status ?? 'unknown' as DiagnosticSourceStatus, lastRefresh: s?.lastAttemptAt ?? null };
  };

  const users = pick('presence');
  const sites = pick('sites');
  const agents = pick('agents');
  const approvals = pick('approvals');
  const business = pick('business');
  const infra = pick('infrastructure');
  const power = pick('power');
  const security = pick('security');
  const backups = pick('backups');
  const weather = pick('weather');
  const costs = pick('costs-budgets');

  return [
    { metric: 'Users Online', source: 'Presence selector (wallboard_online_presence)', ...users },
    { metric: 'Site Health', source: 'Group Site Registry (ai_sites)', ...sites },
    { metric: 'Agents Active', source: 'AI Agents registry', ...agents },
    { metric: 'Pending Approvals', source: 'Approvals registry (ai_approvals)', ...approvals },
    { metric: 'Revenue This Month', source: 'Invoices + checkout orders (GBP paid)', ...business },
    { metric: 'New Leads', source: 'Leads registry', ...business },
    { metric: 'AI Cost', source: 'Usage costs + budgets', ...costs },
    { metric: 'Infrastructure Health', source: 'dfp_service_health', ...infra },
    { metric: 'UPS / Power State', source: 'Power telemetry (registerPowerSource)', ...power },
    { metric: 'Security State', source: 'Connections + policies + support sessions', ...security },
    { metric: 'Backup State', source: 'backup_records + restore_drills', ...backups },
    { metric: 'Office Weather', source: 'Open-Meteo (city-level coords)', ...weather },
  ];
}

// --- Snapshot status -----------------------------------------------------------

export interface SnapshotDiagnostic {
  generatedAt: Date;
  durationMs: number | null;
  healthy: number;
  degraded: number;
  error: number;
  stale: number;
  notConfigured: number;
  unknown: number;
}

export function getSnapshotDiagnostic(staleMs: number, durationMs: number | null): SnapshotDiagnostic {
  const sources = getDataSourceDiagnostics(Date.now(), staleMs);
  let healthy = 0;
  let degraded = 0;
  let error = 0;
  let stale = 0;
  let notConfigured = 0;
  let unknown = 0;
  for (const s of sources) {
    switch (s.status) {
      case 'healthy':
        healthy += 1;
        break;
      case 'degraded':
        degraded += 1;
        break;
      case 'error':
        error += 1;
        break;
      case 'stale':
        stale += 1;
        break;
      case 'not_configured':
        notConfigured += 1;
        break;
      case 'unknown':
        unknown += 1;
        break;
    }
  }
  return { generatedAt: new Date(), durationMs, healthy, degraded, error, stale, notConfigured, unknown };
}

// --- Demo / mock detector ------------------------------------------------------

export interface DemoAuditResult {
  count: number;
  sources: string[];
}

/**
 * Surface any wallboard source explicitly marked demo/mock/placeholder. The
 * wallboard is built on live Supabase registries only, so this is expected to
 * report zero — but it remains an honest audit over the data path.
 */
export function getDemoAudit(): DemoAuditResult {
  const found: string[] = [];
  const group = getGroupLiveData();
  if (group.mode === 'demo') found.push('AI Operations (group live data)');
  return { count: found.length, sources: found };
}