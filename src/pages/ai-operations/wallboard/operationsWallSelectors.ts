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
//   * CPU / RAM / GPU / disk metrics have no authoritative source and are
//     shown as "not monitored" — never invented percentages.
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
import {
  getInfrastructureHosts,
  getInfrastructureNetwork,
  getInfrastructureStorage,
} from '@/pages/ai-operations/wallboard/infrastructureSelectors';
import { getN8nInstances } from '@/pages/ai-operations/wallboard/n8nSelectors';
import { getDatabaseSummary } from '@/pages/ai-operations/wallboard/databaseSelectors';
import { getHalHost, getOllamaStatus, getOversight } from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import { getVectorHealth } from '@/pages/ai-operations/wallboard/knowledgeSelectors';
import { getSecuritySummary } from '@/pages/ai-operations/wallboard/securitySelectors';

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

export type Tone = 'green' | 'amber' | 'red' | 'muted';

const TONE_HEX: Record<Tone, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
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

export type SiteModuleState = 'online' | 'degraded' | 'offline' | 'not_configured';

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
}

function siteState(status: string | null | undefined): SiteModuleState {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':
    case 'active':
    case 'online':
      return 'online';
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
  online: 'ONLINE',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  not_configured: 'NOT CONFIGURED',
};

const STATE_TONE: Record<SiteModuleState, Tone> = {
  online: 'green',
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

  const healthByKey = new Map(health.map((h) => [h.id, h]));
  const presenceByKey = new Map(presence.sites.map((s) => [s.siteKey, s.count]));

  return SITE_BRANDS.map((brand) => {
    const site = data.sites.find((s) => s.site_key === brand.siteKey);
    const card = brand.siteKey ? healthByKey.get(brand.siteKey) : undefined;

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
  sitesOnline: number;
  sitesTotal: number;
  usersActive: number | null;
  agentsRunning: number;
  alerts: number;
  estatePercent: number | null;
}

export function getGroupMetrics(): GroupMetrics {
  const m = getStatusBarMetrics();
  const presence = getUsersOnline();
  const modules = getSiteModules();

  const onlineModules = modules.filter((x) => x.state === 'online').length;
  const configured = modules.filter((x) => x.state !== 'not_configured').length;

  const estatePercent =
    configured > 0 ? Math.round((onlineModules / configured) * 100) : null;

  return {
    sitesOnline: onlineModules,
    sitesTotal: modules.length,
    usersActive: presence.total,
    agentsRunning: m.agentsWorking,
    alerts: m.criticalAlerts,
    estatePercent,
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

export type CoreSystemStatus = 'online' | 'active' | 'healthy' | 'degraded' | 'offline' | 'unknown';

export interface CoreSystemRow {
  key: string;
  name: string;
  subtitle: string;
  status: CoreSystemStatus;
  statusLabel: string;
  tone: Tone;
}

function halStatus(): { status: CoreSystemStatus; tone: Tone } {
  const hosts = getInfrastructureHosts();
  const hal = hosts[0];
  if (!hal) return { status: 'unknown', tone: 'muted' };
  switch (hal.status) {
    case 'healthy': return { status: 'healthy', tone: 'green' };
    case 'warning':
    case 'degraded': return { status: 'degraded', tone: 'amber' };
    case 'offline': return { status: 'offline', tone: 'red' };
    default: return { status: 'unknown', tone: 'muted' };
  }
}

function n8nStatus(instanceIndex = 0): { status: CoreSystemStatus; tone: Tone } {
  const instances = getN8nInstances();
  const inst = instances[instanceIndex];
  if (!inst) return { status: 'unknown', tone: 'muted' };
  switch (inst.state) {
    case 'healthy': return { status: 'online', tone: 'green' };
    case 'degraded': return { status: 'degraded', tone: 'amber' };
    case 'offline': return { status: 'offline', tone: 'red' };
    case 'not_configured':
    case 'unknown':
    default: return { status: 'unknown', tone: 'muted' };
  }
}

function supabaseStatus(): { status: CoreSystemStatus; tone: Tone } {
  const summary = getDatabaseSummary();
  switch (summary.tone) {
    case 'emerald': return { status: 'healthy', tone: 'green' };
    case 'amber': return { status: 'degraded', tone: 'amber' };
    case 'red': return { status: 'offline', tone: 'red' };
    default: return { status: 'unknown', tone: 'muted' };
  }
}

function networkStatus(): { status: CoreSystemStatus; tone: Tone } {
  const net = getInfrastructureNetwork();
  switch (net.bridgeStatus) {
    case 'healthy': return { status: 'healthy', tone: 'green' };
    case 'warning':
    case 'degraded': return { status: 'degraded', tone: 'amber' };
    case 'offline': return { status: 'offline', tone: 'red' };
    default: return { status: 'unknown', tone: 'muted' };
  }
}

function storageStatus(): { status: CoreSystemStatus; tone: Tone } {
  const storage = getInfrastructureStorage();
  const items = storage.items;
  if (items.length === 0) return { status: 'unknown', tone: 'muted' };
  if (items.some((i) => i.status === 'offline')) return { status: 'offline', tone: 'red' };
  if (items.some((i) => i.status === 'degraded' || i.status === 'warning')) return { status: 'degraded', tone: 'amber' };
  return { status: 'healthy', tone: 'green' };
}

const CORE_STATUS_LABEL: Record<CoreSystemStatus, string> = {
  online: 'ONLINE',
  active: 'ACTIVE',
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  unknown: 'UNKNOWN',
};

export function getCoreSystems(): CoreSystemRow[] {
  const hal = halStatus();
  const oversight = getOversight();
  const n8n1 = n8nStatus(0);
  const n8n2 = n8nStatus(1);
  const supabase = supabaseStatus();
  const network = networkStatus();
  const storage = storageStatus();

  const make = (
    key: string,
    name: string,
    subtitle: string,
    status: CoreSystemStatus,
    tone: Tone,
  ): CoreSystemRow => ({ key, name, subtitle, status, statusLabel: CORE_STATUS_LABEL[status], tone });

  return [
    make('hal', 'HAL', 'ORCHESTRATION NODE', hal.status, hal.tone),
    make(
      'tron',
      'TRON',
      'AI OVERWATCH',
      oversight.state === 'not_connected' ? 'unknown' : 'unknown',
      'muted',
    ),
    make('n8n-01', 'N8N-01', 'AUTOMATION ENGINE', n8n1.status, n8n1.tone),
    make('n8n-02', 'N8N-02', 'AUTOMATION ENGINE', n8n2.status, n8n2.tone),
    make('supabase', 'SUPABASE', 'DATA PLATFORM', supabase.status, supabase.tone),
    make('network', 'NETWORK', 'CORE INFRASTRUCTURE', network.status, network.tone),
    make('storage', 'STORAGE', 'DATA LAYER', storage.status, storage.tone),
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
  taskId: string;
  progress: number; // 0–8 segments
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

/** Monospaced task id from a stable key + a deterministic hash. */
function taskIdFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `T-${(h % 9000 + 1000).toString()}`;
}

function progressFor(state: MasterRowState, task: string | null): number {
  if (state === 'running') return 6;
  if (state === 'review') return 4;
  if (state === 'standby') return task ? 3 : 0;
  if (state === 'failed' || state === 'blocked') return 2;
  return 0;
}

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
        taskId: group ? taskIdFor(group.agentKey) : 'T-0000',
        progress: progressFor(state, group?.currentTask ?? null),
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
        taskId: 'T-0000',
        progress: 0,
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
      taskId: taskIdFor(card.masterAgentKey ?? card.siteKey),
      progress: progressFor(state, card.currentTask),
    };
  });
}

// ---------------------------------------------------------------------------
// Compute Core (HAL / TRON)
// ---------------------------------------------------------------------------

export interface ComputeNode {
  name: string;
  subtitle: string;
  state: 'nominal' | 'degraded' | 'offline';
  stateLabel: string;
  tone: Tone;
  metrics: { label: string; value: string }[];
}

export function getComputeCore(): { hal: ComputeNode; tron: ComputeNode; link: { label: string; tone: Tone } } {
  const halHost = getHalHost();
  const oversight = getOversight();
  const ollama = getOllamaStatus();
  const m = getStatusBarMetrics();

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
    metrics: [
      { label: 'CPU', value: 'NOT MONITORED' },
      { label: 'MEMORY', value: 'NOT MONITORED' },
      { label: 'AGENT RUNS', value: String(m.activeRuns) },
      { label: 'UPTIME', value: halHost?.lastHeartbeat ? 'LINKED' : '—' },
      { label: 'STATE', value: halState === 'nominal' ? 'NOMINAL' : halState === 'offline' ? 'OFFLINE' : 'DEGRADED' },
    ],
  };

  const tron: ComputeNode = {
    name: 'TRON',
    subtitle: 'AI OVERWATCH',
    state: 'offline',
    stateLabel: 'NOT CONNECTED',
    tone: 'muted',
    metrics: [
      { label: 'MODEL', value: ollama.localModels > 0 ? `${ollama.localModels} LOCAL` : 'UNKNOWN' },
      { label: 'INFERENCE TIME', value: '—' },
      { label: 'REQUESTS / MIN', value: '—' },
      { label: 'UPTIME', value: '—' },
      { label: 'STATE', value: 'NOT CONNECTED' },
    ],
  };

  const linkLabel = halState === 'nominal' ? 'LINK ESTABLISHED' : halState === 'degraded' ? 'LINK DEGRADED' : 'NO LINK';
  const linkTone: Tone = halState === 'nominal' ? 'green' : halState === 'degraded' ? 'amber' : 'muted';

  return { hal, tron, link: { label: linkLabel, tone: linkTone } };
}

// ---------------------------------------------------------------------------
// AI Systems status (compact diagnostic block beside TRON)
// ---------------------------------------------------------------------------

export interface AiSystemRow {
  label: string;
  value: string;
  tone: Tone;
}

export function getAiSystemsStatus(): AiSystemRow[] {
  const ollama = getOllamaStatus();
  const vector = getVectorHealth();
  const security = getSecuritySummary();
  const data = getGroupLiveData();

  const modelTone: Tone = ollama.state === 'healthy' ? 'green' : ollama.state === 'offline' ? 'red' : ollama.state === 'stale' ? 'amber' : 'muted';
  const modelValue = ollama.state === 'healthy' ? 'OPERATIONAL' : ollama.state === 'offline' ? 'OFFLINE' : ollama.state === 'stale' ? 'DEGRADED' : 'UNKNOWN';

  const vectorConnected = vector.embedded > 0;
  const vectorValue = vectorConnected ? `CONNECTED · ${vector.embedded} EMB` : 'NO DATA';

  const toolsCount = data.tools.filter((t) => !['disabled', 'not_configured'].includes(t.status ?? '')).length;
  const toolsValue = toolsCount > 0 ? `ONLINE · ${toolsCount}` : 'NO DATA';
  const toolsTone: Tone = toolsCount > 0 ? 'green' : 'muted';

  const safetyValue = security.sourceState === 'unavailable' ? 'UNKNOWN' : security.tone === 'emerald' ? 'ENABLED' : security.tone === 'amber' ? 'DEGRADED' : 'ALERT';
  const safetyTone: Tone = security.sourceState === 'unavailable' ? 'muted' : security.tone === 'emerald' ? 'green' : security.tone === 'amber' ? 'amber' : 'red';

  return [
    { label: 'MODEL STATUS', value: modelValue, tone: modelTone },
    { label: 'VECTOR DB', value: vectorValue, tone: vectorConnected ? 'green' : 'muted' },
    { label: 'TOOLS', value: toolsValue, tone: toolsTone },
    { label: 'SAFETY', value: safetyValue, tone: safetyTone },
  ];
}

// ---------------------------------------------------------------------------
// Live events (bottom strip)
// ---------------------------------------------------------------------------

export interface LiveEventItem {
  id: string;
  time: string;
  text: string;
  tone: Tone;
}

function eventTone(status: string | null | undefined): Tone {
  const s = (status ?? '').toLowerCase();
  if (['failed', 'blocked', 'error', 'critical'].includes(s)) return 'red';
  if (['warning', 'degraded'].includes(s)) return 'amber';
  return 'green';
}

export function getLiveEvents(limit = 6): LiveEventItem[] {
  const events = getWallboardActivity(limit + 2);
  return events.slice(0, limit).map((e) => {
    const time = e.timestamp ? e.timestamp.split(' · ').pop() ?? e.timestamp : '—';
    return {
      id: e.id,
      time,
      text: `${e.site} ${e.event}`,
      tone: eventTone(e.status),
    };
  });
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