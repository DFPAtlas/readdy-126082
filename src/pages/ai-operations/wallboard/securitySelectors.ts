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

// --- Operational-exclusion & freshness (safety classification) ---------------

// A connection health check older than this is stale and never treated as a
// current (fresh) failure or a fresh healthy result.
const CONNECTION_FRESH_MS = 10 * 60 * 1000; // 10 minutes

type ConnectionFreshness = 'fresh' | 'stale' | 'none';

function connectionFreshness(iso: string | null | undefined): ConnectionFreshness {
  if (!iso) return 'none';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'none';
  const age = Date.now() - t;
  if (age < 0 || age <= CONNECTION_FRESH_MS) return 'fresh';
  return 'stale';
}

/**
 * Explicitly retired, disabled or audit-only services are excluded from
 * operational-health classification — they are registry/audit records, not live
 * services to monitor. Detection is explicit (retired via registry notes,
 * disabled via status, audit-only via configuration_state), never by matching a
 * name like "legacy" or by excluding arbitrary disconnected services.
 */
function isOperationallyExcluded(c: AiToolConnectionRow): boolean {
  const notes = (c.notes ?? '').toLowerCase();
  if (notes.includes('retired')) return true;
  if ((c.status ?? '').toLowerCase() === 'disabled') return true;
  if ((c.configuration_state ?? '').toLowerCase() === 'not_required') return true;
  return false;
}

/**
 * Fresh operational evidence for a single connection. Only a FRESH check can
 * prove health or failure; a missing/stale timestamp yields `unknown` (no
 * evidence), and excluded services yield `excluded`.
 */
type ConnectionEvidence = 'excluded' | 'healthy' | 'warning' | 'failure' | 'unknown';

function connectionEvidence(c: AiToolConnectionRow): ConnectionEvidence {
  if (isOperationallyExcluded(c)) return 'excluded';
  if (connectionFreshness(c.last_checked_at) !== 'fresh') return 'unknown';

  const status = (c.status ?? '').toLowerCase();
  const health = (c.health ?? '').toLowerCase();
  if (['disconnected', 'offline', 'failed', 'error'].includes(status)) return 'failure';
  if (status === 'degraded' || health === 'warning' || health === 'degraded') return 'warning';
  if (status === 'connected' && health === 'healthy') return 'healthy';
  return 'unknown';
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

// --- Four-state safety assessment --------------------------------------------

export type SafetyStatus = 'unknown' | 'nominal' | 'warning' | 'alert';

export interface SafetyAssessment {
  status: SafetyStatus;
  label: string;
  detail: string;
  tone: 'secondary' | 'emerald' | 'amber' | 'red';
}

// Security-relevant alert/incident types. Everything else (run_failure,
// approval, billing, integration, uat, data_health, model_provider, etc.) is an
// operational signal — never promoted to a security incident.
const SECURITY_ALERT_TYPES = new Set(['security', 'policy_violation']);
const SECURITY_INCIDENT_TYPES = new Set(['security']);

function isActiveIncident(status: string | null | undefined): boolean {
  return !['resolved', 'closed', 'suppressed'].includes(status ?? '');
}

/**
 * The SAFETY status behind the AI Systems panel — four honest states derived
 * from fresh evidence only (never from registry status alone):
 *   * ALERT   — a genuine unresolved critical security incident/alert, or a
 *               fresh check confirming a critical auth/database failure.
 *   * WARNING — a fresh non-critical failure or degraded/warning service.
 *   * NOMINAL — every enabled monitoring source is fresh and healthy with no
 *               qualifying critical alert.
 *   * UNKNOWN — insufficient/stale evidence (no valid check timestamps).
 */
export function getSafetyAssessment(): SafetyAssessment {
  const data = getGroupLiveData();

  const monitoringUnavailable =
    data.mode === 'unavailable' || !data.availability.alerts || !data.availability.tools;

  const criticalSecurityAlerts = data.alerts.filter(
    (a) =>
      isActiveAlert(a.status) &&
      a.severity === 'critical' &&
      SECURITY_ALERT_TYPES.has((a.alert_type ?? '').toLowerCase()),
  );
  const criticalSecurityIncidents = data.incidents.filter(
    (i) =>
      isActiveIncident(i.status) &&
      i.severity === 'critical' &&
      SECURITY_INCIDENT_TYPES.has((i.incident_type ?? '').toLowerCase()),
  );

  const criticalFailures: AiToolConnectionRow[] = [];
  const nonCriticalFailures: AiToolConnectionRow[] = [];
  const warnings: AiToolConnectionRow[] = [];
  let hasUnknownEvidence = false;
  let enabledCount = 0;

  for (const c of data.tools) {
    const e = connectionEvidence(c);
    if (e === 'excluded') continue;
    enabledCount += 1;
    const critical = CRITICAL_CATEGORIES.has((c.category ?? '').toLowerCase());
    if (e === 'failure') {
      if (critical) criticalFailures.push(c);
      else nonCriticalFailures.push(c);
    } else if (e === 'warning') {
      warnings.push(c);
    } else if (e === 'unknown') {
      hasUnknownEvidence = true;
    }
  }

  // 1. ALERT — verified critical security issue or fresh critical service failure.
  if (criticalSecurityAlerts.length > 0 || criticalSecurityIncidents.length > 0 || criticalFailures.length > 0) {
    if (criticalFailures.length > 0) {
      const category = (criticalFailures[0].category ?? '').toLowerCase();
      const detail =
        category === 'database'
          ? 'Critical database connection failure'
          : 'Critical authentication service failure';
      return { status: 'alert', label: 'ALERT', detail, tone: 'red' };
    }
    const title =
      criticalSecurityAlerts[0]?.title ?? criticalSecurityIncidents[0]?.title ?? 'Critical security incident';
    return { status: 'alert', label: 'ALERT', detail: title, tone: 'red' };
  }

  // 2. WARNING — fresh non-critical failure or degraded/warning service.
  if (nonCriticalFailures.length > 0 || warnings.length > 0) {
    const first = nonCriticalFailures[0] ?? warnings[0];
    const verb = nonCriticalFailures.length > 0 ? 'failure' : 'degraded';
    return {
      status: 'warning',
      label: 'WARNING',
      detail: `${first.name} connection ${verb}`,
      tone: 'amber',
    };
  }

  // 3. NOMINAL — every enabled source fresh and healthy, monitoring reachable.
  if (!monitoringUnavailable && !hasUnknownEvidence && enabledCount > 0) {
    return {
      status: 'nominal',
      label: 'NOMINAL',
      detail: 'All monitored services fresh and healthy.',
      tone: 'emerald',
    };
  }

  // 4. UNKNOWN — insufficient/stale evidence to claim health or failure.
  if (monitoringUnavailable) {
    return { status: 'unknown', label: 'UNKNOWN', detail: 'Monitoring incomplete.', tone: 'secondary' };
  }
  return { status: 'unknown', label: 'UNKNOWN', detail: 'Connection checks have no timestamps.', tone: 'secondary' };
}

export function getSecuritySummary(): SecuritySummary {
  const data = getGroupLiveData();
  const sessions = getSecurityData();
  const alerts = getSecurityAlertSummary();
  const policies = getSecurityPolicySummary();
  const safety = getSafetyAssessment();

  // Freshness/exclusion-aware counts (retired/disabled/audit-only excluded;
  // only FRESH checks count as a failure or warning).
  let offline = 0;
  let degraded = 0;
  for (const c of data.tools) {
    const e = connectionEvidence(c);
    if (e === 'failure') offline += 1;
    else if (e === 'warning') degraded += 1;
  }

  let sourceState: SecuritySummary['sourceState'];
  if (data.mode === 'unavailable' || !data.availability.alerts) {
    sourceState = 'unavailable';
  } else if (data.availability.tools && data.availability.policies) {
    sourceState = 'live';
  } else {
    sourceState = 'partial';
  }

  const label: Record<SafetyStatus, string> = {
    alert: 'SECURITY ALERT',
    warning: 'DEGRADED',
    nominal: 'SECURE',
    unknown: sourceState === 'unavailable' ? 'SECURITY STATUS UNKNOWN' : 'MONITORING INCOMPLETE',
  };
  const detail: Record<SafetyStatus, string> = {
    alert: safety.detail,
    warning: safety.detail,
    nominal: 'No critical alerts and no fresh service failures.',
    unknown: safety.detail,
  };

  return {
    sourceState,
    label: label[safety.status],
    detail: detail[safety.status],
    tone: safety.tone,
    criticalAlerts: alerts.critical,
    highAlerts: alerts.high,
    connectionsOffline: offline,
    connectionsDegraded: degraded,
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
 * Authoritative security incidents only — a FRESH confirmed failure on a
 * registered connection (never a stale/null-timestamp status, and never a
 * retired/disabled/audit-only service):
 *   * Authentication platform offline → CRITICAL.
 *   * Database offline → CRITICAL.
 *   * Any other registered connection offline → HIGH (critical API connection
 *     failure).
 *
 * Existing critical security ALERTS already feed Incident Mode via
 * getWallboardIncidents (data.alerts) — they are not duplicated here. Warning /
 * degraded connections are shown in the view but do NOT raise an incident
 * (no threat determination invented from weak signals). not_configured /
 * disabled / unknown / retired connections never raise the alarm.
 */
export function getSecurityIncidents(): SecurityIncident[] {
  const data = getGroupLiveData();
  const incidents: SecurityIncident[] = [];

  for (const c of data.tools) {
    // Only a FRESH confirmed failure raises an incident — a retired/disabled/
    // audit-only service, or a stale/null-timestamp status, is never an outage.
    if (connectionEvidence(c) !== 'failure') continue;

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