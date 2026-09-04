// ============================================================================
// AI Operations — Wallboard Security & Connectivity selectors.
//
// Pure read-only derivations over the shared group live-data snapshot
// (connections / policies / alerts / incidents) + the support-session aggregate
// (securityStore.ts). These produce a distance-readable, privacy-safe security
// view for the wallboard and the critical security incidents that feed
// Wallboard 22 Incident Mode.
//
// Honesty & privacy rules honoured here:
//   * Only aggregate, non-sensitive data is exposed — no customer identity,
//     email, username, IP, session id, token, key or password is ever surfaced.
//   * SECURE is never shown when monitoring is unavailable (UNKNOWN instead).
//   * OFFline vs UNKNOWN vs NOT-CONFIGURED are kept distinct; a missing metric
//     never implies a security failure.
//   * No threat determination is invented from weak signals — only an
//     authoritative offline connection (or an existing critical alert) raises
//     an incident.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { getRuntimeHealthState } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { deriveBridgeNodeState } from '@/lib/ai-operations/runtimeBridge';
import type { AiToolConnectionRow } from '@/lib/ai-operations';

// --- Normalised connection state ----------------------------------------------

export type SecurityState = 'healthy' | 'warning' | 'degraded' | 'offline' | 'unknown';

export const SECURITY_STATE_META: Record<
  SecurityState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  healthy: { label: 'HEALTHY', tone: 'emerald' },
  warning: { label: 'WARNING', tone: 'amber' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'OFFLINE', tone: 'red' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/**
 * Normalise a connection's registry status/health onto wallboard levels.
 * `connected + healthy` → healthy; `connected + warning` → warning;
 * `disconnected`/`failed` → offline; `not_configured`/`disabled`/missing health
 * → unknown (never implied offline).
 */
function normalizeConnectionState(
  status: string | null | undefined,
  health: string | null | undefined,
): SecurityState {
  const s = (status ?? '').toLowerCase();
  const h = (health ?? '').toLowerCase();

  if (['disconnected', 'offline', 'failed', 'error'].includes(s)) return 'offline';
  if (s === 'degraded') return 'degraded';
  if (['not_configured', 'disabled'].includes(s)) return 'unknown';
  if (s === 'connected') {
    if (h === 'healthy') return 'healthy';
    if (h === 'warning') return 'warning';
    if (h === 'degraded') return 'degraded';
    return 'unknown';
  }
  return 'unknown';
}

// --- Category → wallboard group (only for registered categories) --------------

const GROUP_BY_CATEGORY: Record<string, string> = {
  authentication: 'AUTH',
  database: 'DATABASE',
  storage: 'DATABASE',
  billing: 'PAYMENTS',
  email: 'EMAIL',
  ai_model: 'AI',
  automation: 'AUTOMATION',
  repository: 'SOURCE CONTROL',
  website_builder: 'PUBLIC SERVICES',
  infrastructure: 'PUBLIC SERVICES',
  site_api: 'PUBLIC SERVICES',
  analytics: 'ANALYTICS',
  monitoring: 'MONITORING',
  notifications: 'OTHER',
  search: 'OTHER',
  knowledge_base: 'OTHER',
  other: 'OTHER',
  diagnostic: 'OTHER',
  diagnostics: 'OTHER',
};

const GROUP_ORDER: Record<string, number> = {
  AUTH: 0,
  DATABASE: 1,
  PAYMENTS: 2,
  EMAIL: 3,
  AI: 4,
  AUTOMATION: 5,
  'SOURCE CONTROL': 6,
  'PUBLIC SERVICES': 7,
  ANALYTICS: 8,
  MONITORING: 9,
  OTHER: 10,
};

function categoryGroup(category: string | null | undefined): string {
  return GROUP_BY_CATEGORY[category ?? ''] ?? 'OTHER';
}

// --- Connection model ---------------------------------------------------------

export interface SecurityConnection {
  key: string;
  name: string;
  group: string;
  provider: string | null;
  state: SecurityState;
  risk: string | null;
}

export function getSecurityConnections(): SecurityConnection[] {
  const data = getGroupLiveData();
  return data.tools
    .map((c: AiToolConnectionRow) => ({
      key: c.connection_key,
      name: c.name,
      group: categoryGroup(c.category),
      provider: c.provider,
      state: normalizeConnectionState(c.status, c.health),
      risk: c.risk_level,
    }))
    .sort((a, b) => {
      const r = (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99);
      if (r !== 0) return r;
      return a.name.localeCompare(b.name);
    });
}

// --- Security alerts (aggregate, privacy-safe) --------------------------------

export interface SecurityAlertSummary {
  critical: number;
  high: number;
  unresolved: number;
  /** Latest critical alert title only — never exploit/payload detail. */
  latestCriticalTitle: string | null;
}

function isActiveAlert(status: string | null | undefined): boolean {
  return !['resolved', 'closed', 'suppressed'].includes(status ?? '');
}

export function getSecurityAlertSummary(): SecurityAlertSummary {
  const data = getGroupLiveData();
  const active = data.alerts.filter((a) => isActiveAlert(a.status));
  const critical = active.filter((a) => a.severity === 'critical');
  const high = active.filter((a) => a.severity === 'high');
  const latestCritical = critical
    .slice()
    .sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''))[0];

  return {
    critical: critical.length,
    high: high.length,
    unresolved: active.length,
    latestCriticalTitle: latestCritical?.title ?? null,
  };
}

// --- Security policies (aggregate posture) ------------------------------------

export interface SecurityPolicySummary {
  active: number;
  reviewRequired: number;
  securityCategory: number;
}

export function getSecurityPolicySummary(): SecurityPolicySummary {
  const data = getGroupLiveData();
  return {
    active: data.policies.filter((p) => p.status === 'active').length,
    reviewRequired: data.policies.filter((p) => p.status === 'review_required').length,
    securityCategory: data.policies.filter((p) => p.category === 'security').length,
  };
}

// --- Remote access ------------------------------------------------------------

export interface RemoteAccessStatus {
  /** The only live remote-connectivity signal: the HAL runtime bridge. */
  bridge: 'reachable' | 'stale' | 'offline' | 'unknown';
  bridgeLabel: string;
  /** Honest note that Tailscale/VPN/firewall are not monitored. */
  note: string;
}

export function getRemoteAccessStatus(): RemoteAccessStatus {
  const node = getRuntimeHealthState().bridgeNode;
  const state = deriveBridgeNodeState(node);

  let bridge: RemoteAccessStatus['bridge'];
  let bridgeLabel: string;
  switch (state) {
    case 'reachable':
      bridge = 'reachable';
      bridgeLabel = 'Reachable';
      break;
    case 'stale':
      bridge = 'stale';
      bridgeLabel = 'Stale';
      break;
    case 'offline':
      bridge = 'offline';
      bridgeLabel = 'Offline';
      break;
    case 'degraded':
      bridge = 'stale';
      bridgeLabel = 'Degraded';
      break;
    default:
      bridge = 'unknown';
      bridgeLabel = 'Not registered';
      break;
  }

  return {
    bridge,
    bridgeLabel,
    note: 'Tailscale, VPN, OPNsense firewall and remote-support access are not monitored — no telemetry source exists.',
  };
}

// --- Overall security summary -------------------------------------------------

export interface SecuritySummary {
  sourceState: 'live' | 'partial' | 'unavailable';
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
  criticalAlerts: number;
  highAlerts: number;
  connectionsOffline: number;
  connectionsDegraded: number;
  activeSessions: number;
  activePolicies: number;
}

const CRITICAL_CATEGORIES = new Set(['authentication', 'database']);

export function getSecuritySummary(): SecuritySummary {
  const data = getGroupLiveData();
  const sessions = getSecurityData();
  const alerts = getSecurityAlertSummary();
  const connections = getSecurityConnections();
  const policies = getSecurityPolicySummary();

  const offline = connections.filter((c) => c.state === 'offline');
  const degraded = connections.filter(
    (c) => c.state === 'warning' || c.state === 'degraded',
  );
  const criticalOffline = offline.filter((c) =>
    CRITICAL_CATEGORIES.has(
      data.tools.find((t) => t.connection_key === c.key)?.category ?? '',
    ),
  );

  // Monitoring unavailable → never claim SECURE.
  let sourceState: SecuritySummary['sourceState'];
  if (data.mode === 'unavailable' || !data.availability.alerts) {
    sourceState = 'unavailable';
  } else if (data.availability.tools && data.availability.policies) {
    sourceState = 'live';
  } else {
    sourceState = 'partial';
  }

  let label: string;
  let detail: string;
  let tone: SecuritySummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'SECURITY STATUS UNKNOWN';
    detail = 'Security monitoring source could not be reached.';
    tone = 'secondary';
  } else if (alerts.critical > 0) {
    label = 'SECURITY ALERT';
    detail = `${alerts.critical} critical security alert${alerts.critical > 1 ? 's' : ''} active.`;
    tone = 'red';
  } else if (criticalOffline.length > 0) {
    label = 'CRITICAL SERVICE OFFLINE';
    detail = `${criticalOffline.map((c) => c.name).join(', ')} unavailable.`;
    tone = 'red';
  } else if (offline.length > 0) {
    label = 'CONNECTION FAILURE';
    detail = `${offline.length} service connection${offline.length > 1 ? 's' : ''} offline.`;
    tone = 'amber';
  } else if (degraded.length > 0) {
    label = 'DEGRADED';
    detail = `${degraded.length} connection${degraded.length > 1 ? 's' : ''} reporting a warning.`;
    tone = 'amber';
  } else {
    label = 'SECURE';
    detail = 'No critical alerts and no offline service connections.';
    tone = 'emerald';
  }

  return {
    sourceState,
    label,
    detail,
    tone,
    criticalAlerts: alerts.critical,
    highAlerts: alerts.high,
    connectionsOffline: offline.length,
    connectionsDegraded: degraded.length,
    activeSessions: sessions.sessions.active,
    activePolicies: policies.active,
  };
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ---------------------

export interface SecurityIncident {
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
 * Authoritative security incidents only — a registered connection in an OFFLINE
 * state:
 *   * Authentication platform offline → CRITICAL.
 *   * Database offline → CRITICAL.
 *   * Any other registered connection offline → HIGH (critical API connection
 *     failure).
 *
 * Existing critical security ALERTS already feed Incident Mode via
 * getWallboardIncidents (data.alerts) — they are not duplicated here. Warning /
 * degraded connections are shown in the view but do NOT raise an incident
 * (no threat determination invented from weak signals). not_configured /
 * disabled / unknown connections never raise the alarm.
 */
export function getSecurityIncidents(): SecurityIncident[] {
  const data = getGroupLiveData();
  const incidents: SecurityIncident[] = [];

  for (const c of data.tools) {
    const state = normalizeConnectionState(c.status, c.health);
    if (state !== 'offline') continue;

    const category = c.category ?? '';
    const isCritical = CRITICAL_CATEGORIES.has(category);
    incidents.push({
      id: `security-conn-${c.connection_key}`,
      severity: isCritical ? 'critical' : 'high',
      title: isCritical
        ? category === 'authentication'
          ? 'Authentication platform unavailable'
          : 'Database unavailable'
        : `${c.name} connection unavailable`,
      affectedService: c.name,
      sourceLabel: 'Security',
      firstDetected: c.last_checked_at,
      lastUpdated: c.last_checked_at,
      status: 'offline',
      description: `${c.name} (${category || 'service'}) is reporting a disconnected/failed connection.`,
    });
  }

  return incidents;
}