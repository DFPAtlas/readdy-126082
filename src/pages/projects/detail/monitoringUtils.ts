// ============================================================================
// DFP COMMAND 10 — PROJECT MONITORING PURE HELPERS
// ============================================================================
// Derived operational-health logic only. No persistence, no side effects.
// The core principle: NEVER manufacture a healthy state — configured ≠ healthy,
// no-data ≠ green, stale ≠ online, failed query ≠ zero alerts.
import { configured } from './infrastructureUtils';
import type {
  MonitoredWebsite,
  SupabaseMonitor,
  EdgeFunctionMonitor,
  AgentMonitor,
  WebhookMonitor,
  MonitoringIncident,
  MonitoringAlert,
  ProjectHealth,
  ComponentState,
  NormalizedSeverity,
} from './monitoringTypes';

// ─── Status helpers ─────────────────────────────────────────────────────────

const CLOSED_STATUSES = ['resolved', 'closed'];

export function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return !CLOSED_STATUSES.includes(status.toLowerCase());
}

export function normalizeSeverity(severity: string | null | undefined): NormalizedSeverity {
  switch ((severity ?? '').toLowerCase()) {
    case 'critical':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    case 'info':
      return 'INFO';
    default:
      return 'UNKNOWN';
  }
}

export const SEVERITY_ORDER: Record<NormalizedSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
  UNKNOWN: 5,
};

// ─── Freshness (display heuristic — last-check age) ─────────────────────────

export type Freshness = 'fresh' | 'stale' | 'none';

/** A conservative, clearly-labelled staleness indicator (> 24h). This is a
 *  display freshness helper only — it does not replace any existing stale
 *  threshold used by AI Runtime Health. */
export const STALE_THRESHOLD_HOURS = 24;

export function freshness(
  lastCheckedAt: string | null | undefined,
  thresholdHours = STALE_THRESHOLD_HOURS,
): Freshness {
  if (!lastCheckedAt) return 'none';
  const t = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(t)) return 'none';
  const ageMs = Date.now() - t;
  if (ageMs > thresholdHours * 3600 * 1000) return 'stale';
  return 'fresh';
}

// ─── Website / component state ─────────────────────────────────────────────

export function websiteState(w: MonitoredWebsite): ComponentState {
  switch (w.status) {
    case 'online':
      return 'UP';
    case 'slow':
      return 'DEGRADED';
    case 'offline':
    case 'error':
      return 'DOWN';
    default:
      return 'UNKNOWN';
  }
}

export function websiteForEnvironment(
  websites: MonitoredWebsite[],
  environment: 'live' | 'staging',
): MonitoredWebsite | undefined {
  return websites.find((w) => w.environment === environment);
}

export function productionState(
  websites: MonitoredWebsite[],
  productionUrlConfigured: boolean,
): ComponentState {
  const live = websiteForEnvironment(websites, 'live');
  if (!live) return productionUrlConfigured ? 'UNKNOWN' : 'NOT MONITORED';
  const state = websiteState(live);
  if (state === 'UP' && freshness(live.last_checked_at) === 'stale') return 'STALE';
  return state;
}

export function stagingState(
  websites: MonitoredWebsite[],
  stagingUrlConfigured: boolean,
): ComponentState {
  const staging = websiteForEnvironment(websites, 'staging');
  if (!staging) return stagingUrlConfigured ? 'UNKNOWN' : 'NOT MONITORED';
  const state = websiteState(staging);
  if (state === 'UP' && freshness(staging.last_checked_at) === 'stale') return 'STALE';
  return state;
}

export function backendState(
  monitor: SupabaseMonitor | undefined,
  supabaseRefConfigured: boolean,
): ComponentState {
  if (!monitor) return supabaseRefConfigured ? 'UNKNOWN' : 'NOT MONITORED';
  const statuses = [
    monitor.database_status,
    monitor.auth_status,
    monitor.storage_status,
    monitor.edge_functions_status,
    monitor.realtime_status,
  ];
  if (statuses.some((s) => s === 'failed')) return 'DOWN';
  if (statuses.some((s) => s === 'warning')) return 'DEGRADED';
  if (statuses.every((s) => s === 'healthy')) {
    return freshness(monitor.last_checked_at) === 'stale' ? 'STALE' : 'UP';
  }
  return 'UNKNOWN';
}

export function edgeFunctionsState(functions: EdgeFunctionMonitor[]): ComponentState {
  if (functions.length === 0) return 'NOT MONITORED';
  if (functions.some((f) => f.status === 'failed')) return 'DOWN';
  if (functions.some((f) => f.status === 'warning')) return 'DEGRADED';
  if (functions.every((f) => f.status === 'healthy')) return 'UP';
  return 'UNKNOWN';
}

export function agentsState(agents: AgentMonitor[]): ComponentState {
  if (agents.length === 0) return 'NOT MONITORED';
  if (agents.some((a) => a.status === 'failed')) return 'DOWN';
  if (agents.some((a) => a.status === 'warning')) return 'DEGRADED';
  if (agents.every((a) => a.status === 'healthy' || a.status === 'running')) return 'UP';
  return 'UNKNOWN';
}

export function webhooksState(webhooks: WebhookMonitor[]): ComponentState {
  if (webhooks.length === 0) return 'NOT MONITORED';
  if (webhooks.some((w) => w.status === 'failed')) return 'DOWN';
  if (webhooks.some((w) => w.status === 'warning')) return 'DEGRADED';
  if (webhooks.every((w) => w.status === 'healthy')) return 'UP';
  return 'UNKNOWN';
}

/** Runtime bridge telemetry is keyed to runtime nodes (HAL/TRON), not
 *  internal_projects. We never infer physical server status from the mapping —
 *  a mapped node shows UNKNOWN here until project-scoped telemetry exists. */
export function runtimeState(runtimeNodeConfigured: boolean): ComponentState {
  return runtimeNodeConfigured ? 'UNKNOWN' : 'NOT MONITORED';
}

// ─── Monitoring configuration detection ────────────────────────────────────

export interface MonitoringConfig {
  monitoringProvider: string | null | undefined;
  productionUrl: string | null | undefined;
  stagingUrl: string | null | undefined;
  supabaseRef: string | null | undefined;
  runtimeNode: string | null | undefined;
}

export function anyMonitoringConfigured(config: MonitoringConfig): boolean {
  return (
    configured(config.monitoringProvider) ||
    configured(config.productionUrl) ||
    configured(config.stagingUrl) ||
    configured(config.supabaseRef) ||
    configured(config.runtimeNode)
  );
}

// ─── Overall health derivation (honest) ────────────────────────────────────

export interface MonitoringInputs {
  websites: MonitoredWebsite[];
  supabaseMonitors: SupabaseMonitor[];
  edgeFunctions: EdgeFunctionMonitor[];
  agents: AgentMonitor[];
  webhooks: WebhookMonitor[];
  incidents: MonitoringIncident[];
  alerts: MonitoringAlert[];
  config: MonitoringConfig;
  anyLoadFailed: boolean;
}

export function deriveProjectHealth(input: MonitoringInputs): ProjectHealth {
  const hasMonitors =
    input.websites.length > 0 ||
    input.supabaseMonitors.length > 0 ||
    input.edgeFunctions.length > 0 ||
    input.agents.length > 0 ||
    input.webhooks.length > 0;

  const anyConfig = anyMonitoringConfigured(input.config);

  if (!anyConfig && !hasMonitors) return 'NOT CONFIGURED';

  // A source failed and there is no telemetry to evaluate → honest unknown.
  if (input.anyLoadFailed && !hasMonitors) return 'UNKNOWN';

  const activeIncidents = input.incidents.filter((i) => isActiveStatus(i.status));
  const activeAlerts = input.alerts.filter((a) => isActiveStatus(a.status));

  // Confirmed production outage → OFFLINE.
  const live = websiteForEnvironment(input.websites, 'live');
  if (live && (live.status === 'offline' || live.status === 'error')) return 'OFFLINE';

  // Critical operational condition.
  const criticalSeverity =
    activeIncidents.some((i) => normalizeSeverity(i.severity) === 'CRITICAL') ||
    activeAlerts.some((a) => normalizeSeverity(a.severity) === 'CRITICAL');
  const criticalBackend = input.supabaseMonitors.some((m) => m.database_status === 'failed');
  if (criticalSeverity || criticalBackend) return 'CRITICAL';

  // Degraded: warning/slow/failed components or high severity.
  const degradedComponent =
    input.websites.some((w) => w.status === 'slow') ||
    input.edgeFunctions.some((f) => f.status === 'failed' || f.status === 'warning') ||
    input.agents.some((a) => a.status === 'failed' || a.status === 'warning') ||
    input.webhooks.some((w) => w.status === 'failed' || w.status === 'warning') ||
    input.supabaseMonitors.some(
      (m) =>
        m.database_status === 'warning' ||
        m.auth_status === 'warning' ||
        m.storage_status === 'warning' ||
        m.edge_functions_status === 'warning' ||
        m.realtime_status === 'warning',
    );
  const highSeverity =
    activeIncidents.some((i) => normalizeSeverity(i.severity) === 'HIGH') ||
    activeAlerts.some((a) => normalizeSeverity(a.severity) === 'HIGH');
  if (degradedComponent || highSeverity) return 'DEGRADED';

  // Healthy requires actual current healthy telemetry — never assumed.
  const hasHealthyTelemetry =
    input.websites.some((w) => w.status === 'online') ||
    input.supabaseMonitors.some((m) => m.database_status === 'healthy') ||
    input.edgeFunctions.some((f) => f.status === 'healthy') ||
    input.agents.some((a) => a.status === 'healthy' || a.status === 'running') ||
    input.webhooks.some((w) => w.status === 'healthy');
  if (hasHealthyTelemetry) return 'HEALTHY';

  return 'UNKNOWN';
}

// ─── Summary (for the Overview card) ───────────────────────────────────────

export interface MonitoringSummary {
  health: ProjectHealth;
  activeAlerts: number;
  criticalAlerts: number;
  openIncidents: number;
  productionLabel: string;
}

export function computeMonitoringSummary(input: MonitoringInputs): MonitoringSummary {
  const health = deriveProjectHealth(input);
  const activeAlerts = input.alerts.filter((a) => isActiveStatus(a.status));
  const openIncidents = input.incidents.filter((i) => isActiveStatus(i.status));
  const live = websiteForEnvironment(input.websites, 'live');

  let productionLabel = 'Not monitored';
  if (live) {
    if (live.status === 'online') productionLabel = 'Production up';
    else if (live.status === 'offline' || live.status === 'error') productionLabel = 'Production down';
    else if (live.status === 'slow') productionLabel = 'Production degraded';
    else productionLabel = 'Production unknown';
  } else if (configured(input.config.productionUrl)) {
    productionLabel = 'Configured — no check';
  }

  return {
    health,
    activeAlerts: activeAlerts.length,
    criticalAlerts: activeAlerts.filter((a) => normalizeSeverity(a.severity) === 'CRITICAL').length,
    openIncidents: openIncidents.length,
    productionLabel,
  };
}

// ─── Recent checks (derived from last-known telemetry — no history invented) ─

export interface RecentCheck {
  key: string;
  time: string;
  component: string;
  result: string;
  durationMs: number | null;
}

export function buildRecentChecks(
  websites: MonitoredWebsite[],
  edgeFunctions: EdgeFunctionMonitor[],
  agents: AgentMonitor[],
  limit = 8,
): RecentCheck[] {
  const checks: RecentCheck[] = [];

  for (const w of websites) {
    if (!w.last_checked_at) continue;
    checks.push({
      key: `web-${w.id}`,
      time: w.last_checked_at,
      component: `${w.website_name} (${w.environment})`,
      result: w.status,
      durationMs: w.last_response_time_ms,
    });
  }
  for (const f of edgeFunctions) {
    const t = f.last_success_at ?? f.last_failure_at;
    if (!t) continue;
    checks.push({
      key: `ef-${f.id}`,
      time: t,
      component: `${f.function_name} (edge fn)`,
      result: f.status,
      durationMs: f.last_response_time_ms,
    });
  }
  for (const a of agents) {
    if (!a.last_run_at) continue;
    checks.push({
      key: `agent-${a.id}`,
      time: a.last_run_at,
      component: `${a.agent_name} (agent)`,
      result: a.status,
      durationMs: a.average_runtime_ms,
    });
  }

  return checks
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);
}