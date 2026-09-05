// ============================================================================
// DFP COMMAND — Operations Wall selectors.
//
// Pure read-only composition over the EXISTING shared DFP Command sources —
// no new store, no new fetch, no new table, no second data model. Every zone
// on the wall is derived from data already fetched by the wallboard refresh
// cycle (group live data + infrastructure + n8n + database + runtime health +
// knowledge + security + presence + activity).
//
// Honesty rules honoured here:
//   * A site without a registry row is surfaced as NOT CONFIGURED, never
//     fabricated into a healthy state.
//   * CPU / RAM come from live host telemetry relayed by HAL's bridge heartbeat
//     (never invented; absent telemetry is honestly labelled NOT MONITORED).
//   * GPU / disk metrics have no authoritative source and are shown as
//     "not monitored".
//   * TRON / Overwatch has no registry → NOT CONNECTED.
//   * UNKNOWN / NO DATA is never reported as healthy.
//   * No credentials, keys, PII, or message bodies are ever selected.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getSiteHealth, getStatusBarMetrics } from '@/pages/ai-operations/live/liveDataSelectors';
import {
  getUsersOnline,
  getWallboardActivity,
} from '@/pages/ai-operations/wallboard/selectors';
import {
  getSiteMasterCards,
  getGroupOrchestrator,
} from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import { getOperationsHealthData } from '@/pages/ai-operations/wallboard/operationsHealthStore';
import { getHalHost, getTronHost } from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import { getRuntimeHealthState, HAL_RUNTIME_NODE_KEY, TRON_RUNTIME_NODE_KEY } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { getVectorHealth } from '@/pages/ai-operations/wallboard/knowledgeSelectors';
import { getSecuritySummary, getSecurityConnections } from '@/pages/ai-operations/wallboard/securitySelectors';
import { getSitesServicesList } from '@/pages/ai-operations/wallboard/siteSelectors';

// ---------------------------------------------------------------------------
// Brand colour palette
// ---------------------------------------------------------------------------

export type BrandColor = 'cyan' | 'blue' | 'teal' | 'orange' | 'purple' | 'yellow' | 'pink' | 'violet';

const BRAND_HEX: Record<BrandColor, string> = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  teal: '#2dd4bf',
  orange: '#fb923c',
  purple: '#a78bfa',
  yellow: '#facc15',
  pink: '#f472b6',
  violet: '#8b5cf6',
};

/** Inline style accent for a brand (text/border colour + subtle glow). */
export function brandAccent(color: BrandColor): { color: string; borderColor: string; boxShadow: string } {
  const hex = BRAND_HEX[color];
  return {
    color: hex,
    borderColor: `${hex}55`,
    boxShadow: `0 0 16px 0 ${hex}30`,
  };
}

export function brandHex(color: BrandColor): string {
  return BRAND_HEX[color];
}

// ---------------------------------------------------------------------------
// Health / state tone helpers
// ---------------------------------------------------------------------------

export type Tone = 'green' | 'amber' | 'red' | 'cyan' | 'muted';

const TONE_HEX: Record<Tone, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#22d3ee',
  muted: '#64748b',
};

export function toneHex(tone: Tone): string {
  return TONE_HEX[tone];
}

// ---------------------------------------------------------------------------
// Site brands → registry mapping
// ---------------------------------------------------------------------------

export interface SiteBrand {
  key: string;
  /** Registry site_key, or null when the site is not yet in the registry. */
  siteKey: string | null;
  name: string;
  shortCode: string;
  subtitle: string;
  color: BrandColor;
  hub: boolean;
}

// The approved estate layout (8 brands). Display names use the REAL registry
// names (The Forge, Wedora) per the owner decision; GarageGlow + Synqoro are
// planned modules that render NOT CONFIGURED until registered.
export const SITE_BRANDS: SiteBrand[] = [
  { key: 'dfp', siteKey: 'digital-footprint', name: 'DFP', shortCode: 'DFP', subtitle: 'AGENCY & OPERATIONS', color: 'cyan', hub: true },
  { key: 'quickguard', siteKey: 'quickguard', name: 'QuickGuard', shortCode: 'QG', subtitle: 'SECURITY MARKETPLACE', color: 'blue', hub: false },
  { key: 'guardianhub', siteKey: 'guardianhub', name: 'GuardianHub', shortCode: 'GH', subtitle: 'SECURITY COMPANIES', color: 'teal', hub: false },
  { key: 'buildnerve', siteKey: 'the-forge', name: 'The Forge', shortCode: 'TF', subtitle: 'AI BUILD PLATFORM', color: 'orange', hub: false },
  { key: 'lethub', siteKey: 'lethub', name: 'LetHub', shortCode: 'LH', subtitle: 'LETTINGS PLATFORM', color: 'purple', hub: false },
  { key: 'garageglow', siteKey: null, name: 'GarageGlow', shortCode: 'GG', subtitle: 'VEHICLE CARE', color: 'yellow', hub: false },
  { key: 'vowora', siteKey: 'wedora', name: 'Wedora', shortCode: 'WD', subtitle: 'WEDDING PLANNING', color: 'pink', hub: false },
  { key: 'synqoro', siteKey: null, name: 'Synqoro', shortCode: 'SQ', subtitle: 'AI & DATA SOLUTIONS', color: 'violet', hub: false },
];

export type SiteModuleState = 'active' | 'degraded' | 'offline' | 'not_configured';

export interface SiteModule {
  key: string;
  name: string;
  shortCode: string;
  subtitle: string;
  color: BrandColor;
  hub: boolean;
  state: SiteModuleState;
  stateLabel: string;
  stateTone: Tone;
  users: number | null;
  agents: number | null;
  alerts: number | null;
  heartbeat: SiteHeartbeat;
}

// ---------------------------------------------------------------------------
// Site heartbeat (authoritative website monitor)
// ---------------------------------------------------------------------------

export type HeartbeatState = 'live' | 'stale' | 'no_heartbeat' | 'not_monitored';

export interface SiteHeartbeat {
  state: HeartbeatState;
  label: string;
  tone: Tone;
  age: string | null;
}

const HEARTBEAT_LABEL: Record<HeartbeatState, string> = {
  live: 'LIVE',
  stale: 'STALE',
  no_heartbeat: 'OFFLINE',
  not_monitored: 'NOT MONITORED',
};

const HEARTBEAT_TONE: Record<HeartbeatState, Tone> = {
  live: 'green',
  stale: 'amber',
  no_heartbeat: 'red',
  not_monitored: 'muted',
};

// Authoritative monitor failure states (internal_monitored_websites.status).
const FAILING_MONITOR_STATUS = new Set(['offline', 'error', 'failed']);

function heartbeatAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let diff = Date.now() - d.getTime();
  if (diff < 0) diff = 0;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

/**
 * Resolve a monitoring heartbeat from the existing authoritative monitor join.
 * LIVE requires a fresh, non-failing monitor reading — never inferred from the
 * site's operational state alone.
 */
function resolveHeartbeat(
  monitoring: 'monitored' | 'not_monitored' | 'stale',
  monitorStatus: string | null,
  lastCheck: string | null,
): SiteHeartbeat {
  if (monitoring === 'not_monitored') {
    return { state: 'not_monitored', label: HEARTBEAT_LABEL.not_monitored, tone: HEARTBEAT_TONE.not_monitored, age: null };
  }
  if (monitoring === 'stale') {
    return { state: 'stale', label: HEARTBEAT_LABEL.stale, tone: HEARTBEAT_TONE.stale, age: null };
  }
  if (monitorStatus && FAILING_MONITOR_STATUS.has(monitorStatus)) {
    return { state: 'no_heartbeat', label: HEARTBEAT_LABEL.no_heartbeat, tone: HEARTBEAT_TONE.no_heartbeat, age: null };
  }
  return { state: 'live', label: HEARTBEAT_LABEL.live, tone: HEARTBEAT_TONE.live, age: heartbeatAge(lastCheck) };
}

// Registry operational state only — configuration, never a live monitor reading.
// A registry `active` site is labelled ACTIVE, NOT ONLINE (ONLINE requires a
// fresh website-monitor result, surfaced separately via the heartbeat).
function siteState(status: string | null | undefined): SiteModuleState {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':
    case 'active':
    case 'online':
      return 'active';
    case 'warning':
    case 'partial':
    case 'degraded':
      return 'degraded';
    case 'critical':
    case 'offline':
    case 'down':
      return 'offline';
    default:
      return 'not_configured';
  }
}

const STATE_LABEL: Record<SiteModuleState, string> = {
  active: 'ACTIVE',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  not_configured: 'NOT CONFIGURED',
};

const STATE_TONE: Record<SiteModuleState, Tone> = {
  active: 'cyan',
  degraded: 'amber',
  offline: 'red',
  not_configured: 'muted',
};

/**
 * The connected site ecosystem — one module per approved brand, joined to the
 * authoritative Group Site Registry by stable site_key. A brand with no
 * registry row is NOT CONFIGURED (never fabricated healthy).
 */
export function getSiteModules(): SiteModule[] {
  const data = getGroupLiveData();
  const health = getSiteHealth();
  const presence = getUsersOnline();
  const services = getSitesServicesList();

  const healthByKey = new Map(health.map((h) => [h.id, h]));
  const presenceByKey = new Map(presence.sites.map((s) => [s.siteKey, s.count]));
  const servicesByKey = new Map(services.map((s) => [s.key, s]));

  return SITE_BRANDS.map((brand) => {
    const site = data.sites.find((s) => s.site_key === brand.siteKey);
    const card = brand.siteKey ? healthByKey.get(brand.siteKey) : undefined;
    const service = brand.siteKey ? servicesByKey.get(brand.siteKey) : undefined;

    const heartbeat = resolveHeartbeat(
      service?.monitoring ?? 'not_monitored',
      service?.monitorStatus ?? null,
      service?.lastCheck ?? null,
    );

    if (!site || !card) {
      return {
        key: brand.key,
        name: brand.name,
        shortCode: brand.shortCode,
        subtitle: brand.subtitle,
        color: brand.color,
        hub: brand.hub,
        state: 'not_configured' as const,
        stateLabel: STATE_LABEL.not_configured,
        stateTone: STATE_TONE.not_configured,
        heartbeat,
        users: null,
        agents: null,
        alerts: null,
      };
    }

    const state = siteState(site.operational_status);
    return {
      key: brand.key,
      name: brand.name,
      shortCode: brand.shortCode,
      subtitle: brand.subtitle,
      color: brand.color,
      hub: brand.hub,
      state,
      stateLabel: STATE_LABEL[state],
      stateTone: STATE_TONE[state],
      heartbeat,
      users: presenceByKey.get(brand.siteKey!) ?? null,
      agents: card.activeAgents,
      alerts: card.alerts,
    };
  });
}

// ---------------------------------------------------------------------------
// Group Operations — top metrics + estate health
// ---------------------------------------------------------------------------

export interface GroupMetrics {
  /** Sites with a fresh successful website-monitor result (ONLINE), never registry-active. */
  sitesOnline: number;
  /** Registry-configured sites (have a registry row). */
  sitesConfigured: number;
  /** Full planned estate (all wall modules). */
  sitesPlanned: number;
  /** Planned modules without a live configuration. */
  sitesNotConfigured: number;
  usersActive: number | null;
  agentsRunning: number;
  alerts: number;
  /** Monitored-estate percentage (online / monitored-configured), or null when no
   *  authoritative monitored denominator exists. Never derived from configuration alone. */
  estatePercent: number | null;
  /** Whether any configured site has a website monitor (drives NOT MONITORED state). */
  monitoringCoverage: boolean;
  /** Estate label when a percentage cannot be computed. */
  estateLabel: 'ONLINE' | 'NOT MONITORED' | 'NOT CONFIGURED';
}

export function getGroupMetrics(): GroupMetrics {
  const m = getStatusBarMetrics();
  const presence = getUsersOnline();
  const modules = getSiteModules();

  // ONLINE is authoritative only when backed by a fresh successful monitor
  // (heartbeat LIVE). Registry-active sites are NEVER counted online.
  const configuredModules = modules.filter((x) => x.state !== 'not_configured');
  const configured = configuredModules.length;
  const planned = modules.length;
  const notConfigured = planned - configured;

  const onlineMonitored = modules.filter((x) => x.heartbeat.state === 'live').length;
  // Monitored configured sites = configured sites with any monitor reading
  // (fresh success, fresh failure, or stale). This is the estate denominator.
  const monitoredConfigured = modules.filter((x) => x.heartbeat.state !== 'not_monitored').length;

  const estatePercent =
    monitoredConfigured > 0 ? Math.round((onlineMonitored / monitoredConfigured) * 100) : null;

  const estateLabel: GroupMetrics['estateLabel'] =
    monitoredConfigured > 0 ? 'ONLINE' : configured > 0 ? 'NOT MONITORED' : 'NOT CONFIGURED';

  return {
    sitesOnline: onlineMonitored,
    sitesConfigured: configured,
    sitesPlanned: planned,
    sitesNotConfigured: notConfigured,
    usersActive: presence.total,
    agentsRunning: m.agentsWorking,
    alerts: m.criticalAlerts,
    estatePercent,
    monitoringCoverage: monitoredConfigured > 0,
    estateLabel,
  };
}

// ---------------------------------------------------------------------------
// Global system state
// ---------------------------------------------------------------------------

export type GlobalState = 'nominal' | 'degraded' | 'critical' | 'offline';

export interface GlobalSystemState {
  state: GlobalState;
  label: string;
  tone: Tone;
}

export function getGlobalSystemState(): GlobalSystemState {
  const data = getGroupLiveData();

  if (data.mode === 'unavailable') {
    return { state: 'offline', label: 'OFFLINE', tone: 'muted' };
  }

  const activeIncident = (i: { status?: string | null; severity?: string | null }) =>
    !['resolved', 'closed'].includes(i.status ?? '') &&
    (i.severity === 'critical' || i.severity === 'high');

  const criticalIncidents = data.incidents.filter((i) => activeIncident(i) && i.severity === 'critical').length;
  const highIncidents = data.incidents.filter((i) => activeIncident(i) && i.severity === 'high').length;
  const criticalAlerts = data.alerts.filter((a) => isActiveAlert(a) && a.severity === 'critical').length;
  const highAlerts = data.alerts.filter((a) => isActiveAlert(a) && a.severity === 'high').length;

  if (criticalIncidents > 0 || criticalAlerts > 0) {
    return { state: 'critical', label: 'CRITICAL', tone: 'red' };
  }
  if (highIncidents > 0 || highAlerts > 0) {
    return { state: 'degraded', label: 'DEGRADED', tone: 'amber' };
  }

  const modules = getSiteModules();
  const degraded = modules.filter((x) => x.state === 'degraded' || x.state === 'offline').length;
  if (degraded > 0) {
    return { state: 'degraded', label: 'DEGRADED', tone: 'amber' };
  }
  return { state: 'nominal', label: 'NOMINAL', tone: 'green' };
}

function isActiveAlert(a: { status?: string | null }): boolean {
  return !['resolved', 'closed', 'suppressed'].includes(a.status ?? '');
}

// ---------------------------------------------------------------------------
// Core Systems (left rail)
// ---------------------------------------------------------------------------

export type CoreSystemStatus =
  | 'online'
  | 'active'
  | 'healthy'
  | 'degraded'
  | 'offline'
  | 'unknown'
  | 'not_configured'
  | 'not_monitored';

export interface CoreSystemRow {
  key: string;
  name: string;
  subtitle: string;
  status: CoreSystemStatus;
  statusLabel: string;
  tone: Tone;
  /** True when this system's latest heartbeat was operator-injected (SIM-). */
  simulated: boolean;
}

// Centralised freshness thresholds (single source of truth for the wall):
//   LIVE:   sample age up to 150 seconds.
//   STALE:  over 150 seconds and up to 5 minutes.
//   OFFLINE: over 5 minutes.
const LIVE_AGE_MS = 150_000;
const STALE_AGE_MS = 5 * 60_000;

type Freshness = 'live' | 'stale' | 'offline';

function freshnessOf(iso: string | null | undefined): Freshness {
  if (!iso) return 'offline';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'offline';
  const age = Date.now() - t;
  if (age < 0) return 'live';
  if (age <= LIVE_AGE_MS) return 'live';
  if (age <= STALE_AGE_MS) return 'stale';
  return 'offline';
}

interface CoreStatusResult {
  status: CoreSystemStatus;
  tone: Tone;
  simulated: boolean;
}

/** Resolve a runtime node's status from ITS OWN newest paired heartbeat, using
 *  the stable node key (never array order, never another node's data). A SIM-
 *  heartbeat is surfaced as SIMULATED (amber) and never as LIVE/HEALTHY. */
function runtimeNodeStatus(nodeKey: string): CoreStatusResult {
  const health = getRuntimeHealthState();
  const node = health.bridgeNodesByKey[nodeKey];
  const hb = health.latestHeartbeatByNodeKey[nodeKey];
  const simulated = hb?.heartbeat_key?.startsWith('SIM') ?? false;
  if (!node) return { status: 'not_monitored', tone: 'muted', simulated: false };
  if (simulated) return { status: 'degraded', tone: 'amber', simulated: true };
  switch (freshnessOf(hb?.received_at ?? node.last_heartbeat_at ?? node.last_seen_at)) {
    case 'live':
      return { status: 'healthy', tone: 'green', simulated: false };
    case 'stale':
      return { status: 'degraded', tone: 'amber', simulated: false };
    default:
      return { status: 'offline', tone: 'red', simulated: false };
  }
}

/** Whether a runtime node's own heartbeat is fresh (≤ 150s). */
function isNodeFresh(nodeKey: string): boolean {
  const health = getRuntimeHealthState();
  const node = health.bridgeNodesByKey[nodeKey];
  const hb = health.latestHeartbeatByNodeKey[nodeKey];
  return freshnessOf(hb?.received_at ?? node?.last_heartbeat_at ?? node?.last_seen_at) === 'live';
}

/** Resolve an n8n container row from HAL's own heartbeat `local_services`. */
function n8nServiceStatus(serviceKey: 'n8n' | 'n8n_secondary'): CoreStatusResult {
  const health = getRuntimeHealthState();
  const hb = health.latestHeartbeatByNodeKey[HAL_RUNTIME_NODE_KEY];
  const local = hb?.local_services as Record<string, unknown> | null | undefined;
  const service = local?.[serviceKey];
  if (!service || typeof service !== 'object') {
    return { status: 'not_monitored', tone: 'muted', simulated: false };
  }
  const s = service as Record<string, unknown>;
  if (s.configured !== true) {
    return { status: 'not_configured', tone: 'muted', simulated: false };
  }
  const status = typeof s.status === 'string' ? s.status : null;
  const sampledAt = typeof s.sampled_at === 'string' ? s.sampled_at : null;
  const fresh = freshnessOf(sampledAt);
  if (status === 'healthy') {
    if (fresh === 'live') return { status: 'online', tone: 'green', simulated: false };
    if (fresh === 'stale') return { status: 'degraded', tone: 'amber', simulated: false };
    return { status: 'offline', tone: 'red', simulated: false };
  }
  if (status === 'degraded') return { status: 'degraded', tone: 'amber', simulated: false };
  if (status === 'unavailable') return { status: 'offline', tone: 'red', simulated: false };
  return { status: 'unknown', tone: 'muted', simulated: false };
}

/** SUPABASE — the DFP cloud database/API, from the operations-health snapshot. */
function supabaseStatus(): CoreStatusResult {
  const ops = getOperationsHealthData();
  const snap = ops.snapshot;
  if (!ops.availability || !snap) return { status: 'unknown', tone: 'muted', simulated: false };
  const fresh = freshnessOf(snap.sampled_at);
  if (snap.database.status === 'healthy') {
    if (fresh === 'live') return { status: 'healthy', tone: 'green', simulated: false };
    if (fresh === 'stale') return { status: 'degraded', tone: 'amber', simulated: false };
    return { status: 'offline', tone: 'red', simulated: false };
  }
  if (snap.database.status === 'degraded') return { status: 'degraded', tone: 'amber', simulated: false };
  return { status: 'offline', tone: 'red', simulated: false };
}

/** STORAGE — DFP Supabase Storage, from the operations-health Storage check. */
function storageStatus(): CoreStatusResult {
  const ops = getOperationsHealthData();
  const snap = ops.snapshot;
  if (!ops.availability || !snap) return { status: 'unknown', tone: 'muted', simulated: false };
  if (snap.storage.status === 'healthy') return { status: 'healthy', tone: 'green', simulated: false };
  if (snap.storage.status === 'degraded') return { status: 'degraded', tone: 'amber', simulated: false };
  return { status: 'offline', tone: 'red', simulated: false };
}

/** NETWORK — DFP CONNECTIVITY (not whole-LAN monitoring), derived from the
 *  operations-health cloud round trip + HAL/TRON bridge freshness. */
function networkStatus(): CoreStatusResult {
  const ops = getOperationsHealthData();
  const snap = ops.snapshot;
  const cloudFresh = freshnessOf(snap?.sampled_at ?? null);

  // Cloud health request unavailable beyond the offline threshold → OFFLINE.
  if (cloudFresh === 'offline') return { status: 'offline', tone: 'red', simulated: false };

  const halFresh = isNodeFresh(HAL_RUNTIME_NODE_KEY);
  const tronFresh = isNodeFresh(TRON_RUNTIME_NODE_KEY);

  // Cloud succeeds and both bridges fresh → HEALTHY.
  if (cloudFresh === 'live' && halFresh && tronFresh) {
    return { status: 'healthy', tone: 'green', simulated: false };
  }
  // Cloud succeeds but not both bridges fresh → DEGRADED.
  return { status: 'degraded', tone: 'amber', simulated: false };
}

const CORE_STATUS_LABEL: Record<CoreSystemStatus, string> = {
  online: 'ONLINE',
  active: 'ACTIVE',
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  unknown: 'UNKNOWN',
  not_configured: 'NOT CONFIGURED',
  not_monitored: 'NOT MONITORED',
};

export function getCoreSystems(): CoreSystemRow[] {
  const hal = runtimeNodeStatus(HAL_RUNTIME_NODE_KEY);
  const tron = runtimeNodeStatus(TRON_RUNTIME_NODE_KEY);
  const n8n1 = n8nServiceStatus('n8n');
  const n8n2 = n8nServiceStatus('n8n_secondary');
  const supabase = supabaseStatus();
  const network = networkStatus();
  const storage = storageStatus();

  const make = (
    key: string,
    name: string,
    subtitle: string,
    status: CoreSystemStatus,
    tone: Tone,
    simulated = false,
  ): CoreSystemRow => ({ key, name, subtitle, status, statusLabel: CORE_STATUS_LABEL[status], tone, simulated });

  return [
    make('hal', 'HAL', 'ORCHESTRATION NODE', hal.status, hal.tone, hal.simulated),
    make('tron', 'TRON', 'AI OVERWATCH', tron.status, tron.tone, tron.simulated),
    make('n8n-01', 'N8N-01', 'AUTOMATION ENGINE', n8n1.status, n8n1.tone, n8n1.simulated),
    make('n8n-02', 'N8N-02', 'AUTOMATION ENGINE', n8n2.status, n8n2.tone, n8n2.simulated),
    make('supabase', 'SUPABASE', 'DATA PLATFORM', supabase.status, supabase.tone, supabase.simulated),
    make('network', 'NETWORK', 'DFP CONNECTIVITY', network.status, network.tone, network.simulated),
    make('storage', 'STORAGE', 'SUPABASE STORAGE', storage.status, storage.tone, storage.simulated),
  ];
}

// ---------------------------------------------------------------------------
// Autonomous Operations (right rail) — master agents
// ---------------------------------------------------------------------------

export type MasterRowState = 'running' | 'review' | 'standby' | 'failed' | 'blocked' | 'unassigned';

export interface MasterAgentRow {
  key: string;
  label: string;
  state: MasterRowState;
  stateLabel: string;
  tone: Tone;
  task: string;
  /** Stable persisted reference key (real agent/run key) — never a synthetic id. */
  refKey: string;
  /** Authoritative numeric progress, or null when no real progress source exists. */
  progress: number | null;
}

const MASTER_ROW_STATE_LABEL: Record<MasterRowState, string> = {
  running: 'RUNNING',
  review: 'REVIEW',
  standby: 'STANDBY',
  failed: 'FAILED',
  blocked: 'BLOCKED',
  unassigned: 'NOT ASSIGNED',
};

const MASTER_ROW_STATE_TONE: Record<MasterRowState, Tone> = {
  running: 'green',
  review: 'amber',
  standby: 'muted',
  failed: 'red',
  blocked: 'red',
  unassigned: 'muted',
};

// Map a registry master-agent state onto the wall's presentation vocabulary.
function toRowState(state: string | null | undefined): MasterRowState {
  switch (state) {
    case 'active':
    case 'working':
      return 'running';
    case 'idle':
    case 'waiting':
    case 'unknown':
      return 'standby';
    case 'degraded':
    case 'paused':
      return 'review';
    case 'offline':
      return 'blocked';
    default:
      return 'unassigned';
  }
}

// No authoritative numeric progress source exists for master agents — the
// segmented progress bar is intentionally left inactive (null → —) and the real
// agent state is preserved separately via `state`.

const MASTER_ROWS: { key: string; label: string; siteKey: string | null }[] = [
  { key: 'dfp', label: 'DFP MASTER', siteKey: 'digital-footprint' },
  { key: 'qg', label: 'QG MASTER', siteKey: 'quickguard' },
  { key: 'bn', label: 'BN MASTER', siteKey: 'the-forge' },
  { key: 'gh', label: 'GH MASTER', siteKey: 'guardianhub' },
  { key: 'lethub', label: 'LETHUB MASTER', siteKey: 'lethub' },
  { key: 'gg', label: 'GG MASTER', siteKey: null },
  { key: 'vowora', label: 'VOWORA MASTER', siteKey: 'wedora' },
  { key: 'synq', label: 'SYNQ MASTER', siteKey: null },
];

/**
 * Eight master-agent rows, driven by the authoritative per-site master mapping
 * (getSiteMasterCards) + the group orchestrator. A site without a master is
 * surfaced NOT ASSIGNED, never fabricated.
 */
export function getMasterAgentRows(): MasterAgentRow[] {
  const cards = getSiteMasterCards();
  const group = getGroupOrchestrator();

  const cardBySiteKey = new Map(
    cards.map((c) => [c.siteKey, c]),
  );

  return MASTER_ROWS.map((row) => {
    if (row.key === 'dfp') {
      // DFP master = the group orchestrator.
      const state = group ? toRowState(group.state) : 'unassigned';
      return {
        key: row.key,
        label: row.label,
        state,
        stateLabel: MASTER_ROW_STATE_LABEL[state],
        tone: MASTER_ROW_STATE_TONE[state],
        task: group?.currentTask ?? 'No active task',
        refKey: group?.agentKey ?? '—',
        progress: null,
      };
    }

    const card = row.siteKey ? cardBySiteKey.get(row.siteKey) : undefined;
    if (!card || card.masterAgentKey == null) {
      return {
        key: row.key,
        label: row.label,
        state: 'unassigned' as const,
        stateLabel: MASTER_ROW_STATE_LABEL.unassigned,
        tone: MASTER_ROW_STATE_TONE.unassigned,
        task: 'No master agent',
        refKey: '—',
        progress: null,
      };
    }

    const state = toRowState(card.masterAgentState);
    return {
      key: row.key,
      label: row.label,
      state,
      stateLabel: MASTER_ROW_STATE_LABEL[state],
      tone: MASTER_ROW_STATE_TONE[state],
      task: card.currentTask ?? 'No active task',
      refKey: card.masterAgentKey ?? '—',
      progress: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Compute Core (HAL / TRON)
// ---------------------------------------------------------------------------

export interface ComputeGauge {
  label: string;
  value: string;
  percent: number | null;
  accent: 'orange' | 'cyan';
}

/** Ring tone for a TRON HUD instrument (count/status dials, never a percentage). */
export type TronDialTone = 'violet' | 'green' | 'amber' | 'red' | 'muted';

/** A TRON HUD instrument — a non-percentage circular dial (count or status). */
export interface TronDial {
  key: 'models' | 'ollama';
  /** Main label under the dial (MODELS / OLLAMA). */
  label: string;
  /** Centre value (a count, or LIVE / ALERT / N/C / —). Never a percentage. */
  value: string;
  /** Status line beneath the label (LOCAL / HEALTHY / DEGRADED / NOT CONFIGURED / UNKNOWN). */
  statusLabel: string;
  tone: TronDialTone;
  /** Whether valid live telemetry exists (drives orbit/pulse + LIVE dot). */
  live: boolean;
}

export interface ComputeNode {
  name: string;
  subtitle: string;
  state: 'nominal' | 'degraded' | 'offline';
  stateLabel: string;
  tone: Tone;
  metrics: { label: string; value: string }[];
  gauges?: ComputeGauge[];
  dials?: TronDial[];
  /** True when this node's latest heartbeat was operator-injected (SIM- key). */
  simulated: boolean;
}

/** Read HAL's own bridge heartbeat host telemetry (CPU / memory). Never falls
 *  back to TRON or any other node. Missing/invalid telemetry → null → NOT
 *  MONITORED (never fabricated zero). */
function getHalHostTelemetry(): { cpuPercent: number | null; memoryPercent: number | null } {
  const health = getRuntimeHealthState();
  const hb = health.latestHeartbeatByNodeKey[HAL_RUNTIME_NODE_KEY];
  const host = hb?.local_services && typeof hb.local_services === 'object'
    ? (hb.local_services as Record<string, unknown>).host
    : null;
  if (!host || typeof host !== 'object') return { cpuPercent: null, memoryPercent: null };
  const h = host as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? (v as number) : null;
  return {
    cpuPercent: num(h.cpu_percent),
    memoryPercent: num(h.memory_percent),
  };
}

/** Authoritative bridge state label for a runtime node (LIVE / STALE / OFFLINE /
 *  UNKNOWN). Never derived from array position or a fabricated uptime value. */
function bridgeLabel(state: string | null | undefined): string {
  switch (state) {
    case 'healthy':
      return 'LIVE';
    case 'stale':
    case 'degraded':
      return 'STALE';
    case 'offline':
      return 'OFFLINE';
    default:
      return 'UNKNOWN';
  }
}

export function getComputeCore(): { hal: ComputeNode; tron: ComputeNode; link: { label: string; sublabel: string; tone: Tone } } {
  const halHost = getHalHost();
  const tronHost = getTronHost();
  const m = getStatusBarMetrics();
  const hostTelemetry = getHalHostTelemetry();

  const halState: ComputeNode['state'] =
    halHost == null ? 'offline'
      : halHost.state === 'healthy' ? 'nominal'
        : halHost.state === 'offline' ? 'offline'
          : 'degraded';

  const halTone: Tone = halState === 'nominal' ? 'green' : halState === 'offline' ? 'red' : 'amber';

  const hal: ComputeNode = {
    name: 'HAL',
    subtitle: 'ORCHESTRATION NODE',
    state: halState,
    stateLabel: halState === 'nominal' ? 'NOMINAL' : halState === 'offline' ? 'OFFLINE' : 'DEGRADED',
    tone: halTone,
    simulated: halHost?.simulated ?? false,
    metrics: [
      { label: 'AGENT RUNS', value: String(m.activeRuns) },
      { label: 'BRIDGE', value: bridgeLabel(halHost?.state) },
      { label: 'STATE', value: halState === 'nominal' ? 'NOMINAL' : halState === 'offline' ? 'OFFLINE' : 'DEGRADED' },
    ],
    gauges: [
      {
        label: 'CPU',
        value: hostTelemetry.cpuPercent != null ? `${hostTelemetry.cpuPercent.toFixed(1)}%` : '—',
        percent: hostTelemetry.cpuPercent,
        accent: 'orange',
      },
      {
        label: 'MEMORY',
        value: hostTelemetry.memoryPercent != null ? `${hostTelemetry.memoryPercent.toFixed(1)}%` : '—',
        percent: hostTelemetry.memoryPercent,
        accent: 'cyan',
      },
    ],
  };

  // TRON resolved ONLY from its own bridge node + heartbeat (never HAL data).
  const tronState: ComputeNode['state'] =
    tronHost == null ? 'offline'
      : tronHost.state === 'healthy' ? 'nominal'
        : tronHost.state === 'offline' ? 'offline'
          : 'degraded';

  const tronTone: Tone =
    tronHost == null ? 'muted'
      : tronState === 'nominal' ? 'green'
        : tronState === 'offline' ? 'red'
          : 'amber';

  const tronStateLabel =
    tronHost == null ? 'NOT CONNECTED'
      : tronState === 'nominal' ? 'NOMINAL'
        : tronState === 'offline' ? 'OFFLINE'
          : 'DEGRADED';

  // TRON dial data — resolved ONLY from TRON's own host/status (never HAL).
  const modelCount = tronHost?.ollamaModelCount ?? null;
  const ollamaStatus = tronHost?.ollamaStatus ?? null;

  let ollamaValue: string;
  let ollamaStatusLabel: string;
  let ollamaTone: TronDialTone;
  let ollamaLive: boolean;
  switch (ollamaStatus) {
    case 'healthy':
      ollamaValue = 'LIVE';
      ollamaStatusLabel = 'HEALTHY';
      ollamaTone = 'green';
      ollamaLive = true;
      break;
    case 'degraded':
      ollamaValue = 'ALERT';
      ollamaStatusLabel = 'DEGRADED';
      ollamaTone = 'amber';
      ollamaLive = true;
      break;
    case 'unavailable':
      ollamaValue = 'ALERT';
      ollamaStatusLabel = 'UNKNOWN';
      ollamaTone = 'red';
      ollamaLive = true;
      break;
    case 'not_configured':
      ollamaValue = 'N/C';
      ollamaStatusLabel = 'NOT CONFIGURED';
      ollamaTone = 'muted';
      ollamaLive = false;
      break;
    case 'unknown':
      ollamaValue = 'ALERT';
      ollamaStatusLabel = 'UNKNOWN';
      ollamaTone = 'muted';
      ollamaLive = false;
      break;
    default:
      ollamaValue = '—';
      ollamaStatusLabel = 'UNKNOWN';
      ollamaTone = 'muted';
      ollamaLive = false;
  }

  const tron: ComputeNode = {
    name: 'TRON',
    subtitle: 'AI OVERWATCH',
    state: tronState,
    stateLabel: tronStateLabel,
    tone: tronTone,
    simulated: tronHost?.simulated ?? false,
    metrics: [
      { label: 'N8N', value: tronHost?.n8nStatus === 'not_configured' ? 'NOT CONFIGURED' : tronHost?.n8nStatus != null ? tronHost.n8nStatus.toUpperCase() : '—' },
      { label: 'HEARTBEAT', value: tronHost == null ? '—' : tronHost.state === 'healthy' ? 'LIVE' : tronHost.state === 'stale' ? 'STALE' : 'OFFLINE' },
      { label: 'STATE', value: tronStateLabel },
    ],
    dials: [
      {
        key: 'models',
        label: 'MODELS',
        value: modelCount != null ? String(modelCount) : '—',
        statusLabel: 'LOCAL',
        tone: modelCount != null ? 'violet' : 'muted',
        live: modelCount != null,
      },
      {
        key: 'ollama',
        label: 'OLLAMA',
        value: ollamaValue,
        statusLabel: ollamaStatusLabel,
        tone: ollamaTone,
        live: ollamaLive,
      },
    ],
  };

  // DFP relay honesty: both nodes connect independently to DFP Command via
  // outbound bridges. No direct HAL → TRON control channel exists.
  const bothNominal = halState === 'nominal' && tronState === 'nominal';
  const halDown = halState === 'offline';
  const tronDown = tronState === 'offline';

  let linkLabel: string;
  let linkSublabel: string;
  let linkTone: Tone;

  if (bothNominal) {
    linkLabel = 'BOTH CONNECTED';
    linkSublabel = 'VIA DFP COMMAND';
    linkTone = 'green';
  } else if (halDown && tronDown) {
    linkLabel = 'OFFLINE';
    linkSublabel = 'NO RELAY';
    linkTone = 'red';
  } else if (halDown || tronDown) {
    linkLabel = 'PARTIAL CONNECTION';
    linkSublabel = 'VIA DFP COMMAND';
    linkTone = 'amber';
  } else {
    linkLabel = 'RELAY DEGRADED';
    linkSublabel = 'VIA DFP COMMAND';
    linkTone = 'amber';
  }

  return { hal, tron, link: { label: linkLabel, sublabel: linkSublabel, tone: linkTone } };
}

// ---------------------------------------------------------------------------
// AI Systems status (compact diagnostic block beside TRON)
// ---------------------------------------------------------------------------

export type AiSystemKey = 'model_status' | 'vector_db' | 'tools' | 'safety';

export interface AiSystemRow {
  key: AiSystemKey;
  label: string;
  /** Primary status word (OPERATIONAL / CONNECTED / ONLINE / NOMINAL / …). */
  value: string;
  tone: Tone;
  /** Live numeric count for the circular instruments (null → em-dash). */
  count: number | null;
  /** Whether the instrument/row has valid live state (drives glow/pulse). */
  live: boolean;
}

export function getAiSystemsStatus(): AiSystemRow[] {
  const tron = getTronHost();
  const vector = getVectorHealth();
  const security = getSecuritySummary();
  const connections = getSecurityConnections();
  const data = getGroupLiveData();

  // MODEL STATUS — OPERATIONAL / DEGRADED / OFFLINE / UNKNOWN. One explicit
  // source: TRON's own paired Ollama heartbeat (this card is the live Compute
  // Core, so it uses TRON, never a blended HAL/TRON/registry state).
  const tronOllama = tron?.ollamaStatus ?? null;
  let modelValue: string;
  let modelTone: Tone;
  let modelLive: boolean;
  if (!tron) {
    modelValue = 'UNKNOWN';
    modelTone = 'muted';
    modelLive = false;
  } else {
    switch (tronOllama) {
      case 'healthy':
        modelValue = 'OPERATIONAL';
        modelTone = 'green';
        modelLive = true;
        break;
      case 'degraded':
        modelValue = 'DEGRADED';
        modelTone = 'amber';
        modelLive = true;
        break;
      case 'offline':
      case 'unavailable':
        modelValue = 'OFFLINE';
        modelTone = 'red';
        modelLive = true;
        break;
      default:
        modelValue = 'UNKNOWN';
        modelTone = 'muted';
        modelLive = false;
    }
  }

  // VECTOR DB — embedding count + INDEXED / EMPTY / UNKNOWN. An embedding count
  // proves indexed data exists, NOT a live database connection (there is no
  // vector-store health check), so CONNECTED is never shown from the count alone.
  const vectorAvailable = data.availability.knowledge;
  const vectorCount = vectorAvailable ? vector.embedded : null;
  let vectorValue: string;
  let vectorTone: Tone;
  if (!vectorAvailable) {
    vectorValue = 'UNKNOWN';
    vectorTone = 'muted';
  } else if (vector.embedded > 0) {
    vectorValue = 'INDEXED';
    vectorTone = 'cyan';
  } else {
    vectorValue = 'EMPTY';
    vectorTone = 'muted';
  }

  // TOOLS — online count + ONLINE / DEGRADED / UNAVAILABLE / UNKNOWN.
  const onlineTools = connections.filter((c) => c.state === 'healthy').length;
  const degradedTools = connections.filter((c) => c.state === 'warning' || c.state === 'degraded').length;
  const unavailableTools = connections.filter((c) => c.state === 'offline').length;
  const toolsAvailable = data.availability.tools;
  const toolsCount = toolsAvailable ? onlineTools : null;
  let toolsValue: string;
  let toolsTone: Tone;
  if (!toolsAvailable) {
    toolsValue = 'UNKNOWN';
    toolsTone = 'muted';
  } else if (onlineTools > 0) {
    toolsValue = 'ONLINE';
    toolsTone = 'green';
  } else if (degradedTools > 0) {
    toolsValue = 'DEGRADED';
    toolsTone = 'amber';
  } else if (unavailableTools > 0) {
    toolsValue = 'UNAVAILABLE';
    toolsTone = 'red';
  } else {
    toolsValue = 'UNKNOWN';
    toolsTone = 'muted';
  }

  // SAFETY — NOMINAL / ALERT / UNKNOWN (degraded collapses into ALERT).
  const safetyUnavailable = security.sourceState === 'unavailable';
  const safetyValue = safetyUnavailable ? 'UNKNOWN' : security.tone === 'emerald' ? 'NOMINAL' : 'ALERT';
  const safetyTone: Tone = safetyUnavailable ? 'muted' : security.tone === 'emerald' ? 'green' : 'red';

  return [
    { key: 'model_status', label: 'MODEL STATUS', value: modelValue, tone: modelTone, count: null, live: modelLive },
    { key: 'vector_db', label: 'VECTOR DB', value: vectorValue, tone: vectorTone, count: vectorCount, live: vectorAvailable && vector.embedded > 0 },
    { key: 'tools', label: 'TOOLS', value: toolsValue, tone: toolsTone, count: toolsCount, live: toolsAvailable && onlineTools > 0 },
    { key: 'safety', label: 'SAFETY', value: safetyValue, tone: safetyTone, count: null, live: !safetyUnavailable },
  ];
}

// ---------------------------------------------------------------------------
// Live events (bottom strip)
// ---------------------------------------------------------------------------

export type EventProvenance = 'live' | 'simulated';

export interface LiveEventItem {
  id: string;
  time: string;
  site: string;
  text: string;
  tone: Tone;
  sourceType: string;
  provenance: EventProvenance;
}

// Machine action names → readable ticker labels. Unknown actions fall through
// to a safe generic humanisation (never raw JSON or payloads).
const EVENT_LABELS: Record<string, string> = {
  runtime_bridge: 'Runtime bridge heartbeat received',
  simulate_runtime_heartbeat: 'Runtime heartbeat test recorded',
  approval_created: 'Approval created',
  run_completed: 'Agent run completed',
  run_failed: 'Agent run failed',
  site_status_changed: 'Site status changed',
};

function humaniseEvent(action: string | null | undefined): string {
  const raw = (action ?? '').trim();
  if (!raw) return 'Activity recorded';
  if (EVENT_LABELS[raw]) return EVENT_LABELS[raw];
  return raw.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

// Severity colour from BOTH outcome/status and severity. Critical/high must
// never surface as green even when the outcome reads informational.
function eventTone(status: string | null | undefined, severity: string | null | undefined): Tone {
  const sev = (severity ?? '').toLowerCase();
  const s = (status ?? '').toLowerCase();

  if (sev === 'critical' || sev === 'high') return 'red';
  if (['failed', 'blocked', 'error', 'critical', 'rejected'].includes(s)) return 'red';
  if (sev === 'warning' || sev === 'medium') return 'amber';
  if (['warning', 'degraded', 'partial'].includes(s)) return 'amber';
  if (['success', 'completed', 'healthy', 'approved', 'resolved'].includes(s)) return 'green';
  if (sev === 'info' || sev === 'low' || ['informational', 'info'].includes(s)) return 'cyan';
  return 'muted';
}

/**
 * Recent operational events for the Live Events ticker, deduplicated for
 * display. Reads up to the newest 40 audit events, collapses repeated
 * heartbeats (same site + sourceType + normalised event + status +
 * provenance) to their newest occurrence, and returns up to `limit` unique
 * events. Display-only — no audit record is modified.
 */
export function getLiveEvents(limit = 12): LiveEventItem[] {
  const events = getWallboardActivity(40);
  const seen = new Set<string>();
  const unique: LiveEventItem[] = [];

  for (const e of events) {
    const provenance: EventProvenance = e.event === 'simulate_runtime_heartbeat' ? 'simulated' : 'live';
    const text = humaniseEvent(e.event);
    const normEvent = (e.event ?? '').toLowerCase();
    const key = `${e.site}|${e.sourceType}|${normEvent}|${e.status ?? ''}|${provenance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: e.id,
      time: e.timestamp ? e.timestamp.split(' · ').pop() ?? e.timestamp : '—',
      site: e.site,
      text,
      tone: eventTone(e.status, e.severity),
      sourceType: e.sourceType,
      provenance,
    });
    if (unique.length >= limit) break;
  }

  return unique;
}

// ---------------------------------------------------------------------------
// Time / clock helpers
// ---------------------------------------------------------------------------

export function formatWallTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatWallDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export function timezoneLabel(d: Date): string {
  const parts = d.toTimeString().match(/\(([^)]+)\)|([A-Z]{2,4})$/);
  const tz = parts?.[1] ?? parts?.[2] ?? 'UTC';
  return tz.replace(/\s+/g, ' ');
}