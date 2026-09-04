// ============================================================================
// AI Operations — Wallboard AI Infrastructure selectors.
//
// Pure read-only derivations over the EXISTING shared sources — no new store
// beyond the Ollama probe status read (aiInfraStore.ts), no new fetches, no
// new tables, no new monitoring platform:
//   * getRuntimeHealthState()   → HAL + TRON bridge nodes + per-node heartbeats
//                                 (n8n/Ollama local health, local_services).
//   * getAiInfraData()          → read-only Ollama inference probe status.
//   * getOllamaCatalogueState() → relayed local Ollama model catalogue.
//   * getN8nData()/selectors    → n8n automation state (reused from Wallboard 45).
//   * getGroupLiveData()        → master-agent summary (orchestration category).
//
// Honesty rules honoured here:
//   * HAL and TRON state are each derived ONLY from their own authoritative
//     bridge node + heartbeat — never shared across nodes.
//   * Both nodes connect independently to DFP Command via outbound bridges.
//     No direct HAL → TRON control/oversight channel is established.
//   * CPU / RAM / GPU / storage / temperature are "not monitored" — never
//     fabricated. No percentages are invented.
//   * A probe that has never run is UNKNOWN, never VERIFIED.
//   * Unknown is never reported as healthy.
// ============================================================================

import {
  getRuntimeHealthState,
  HAL_RUNTIME_NODE_KEY,
  TRON_RUNTIME_NODE_KEY,
} from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { getAiInfraData } from '@/pages/ai-operations/wallboard/aiInfraStore';
import { getOllamaCatalogueState } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { getN8nInstances, getN8nWorkflows, getFailedWorkflows, getRunningWorkflows } from '@/pages/ai-operations/wallboard/n8nSelectors';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { deriveBridgeNodeState, type AiRuntimeBridgeNode } from '@/lib/ai-operations/runtimeBridge';
import type { AiAgentRow } from '@/lib/ai-operations';

// --- Status model --------------------------------------------------------------

export type AiInfraState =
  | 'healthy'
  | 'busy'
  | 'degraded'
  | 'offline'
  | 'stale'
  | 'unknown'
  | 'not_connected';

export const AI_INFRA_STATE_META: Record<
  AiInfraState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary' }
> = {
  healthy: { label: 'HEALTHY', tone: 'emerald' },
  busy: { label: 'BUSY', tone: 'accent' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'OFFLINE', tone: 'red' },
  stale: { label: 'STALE', tone: 'amber' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
  not_connected: { label: 'NOT CONNECTED', tone: 'secondary' },
};

/** Normalise a bridge node state onto the wallboard levels (shared by HAL + TRON). */
function bridgeNodeStateToInfra(node: AiRuntimeBridgeNode | null | undefined): AiInfraState {
  if (!node) return 'not_connected';
  switch (deriveBridgeNodeState(node)) {
    case 'reachable':
      return 'healthy';
    case 'stale':
      return 'stale';
    case 'offline':
      return 'offline';
    case 'degraded':
      return 'degraded';
    case 'not_registered':
    default:
      return 'not_connected';
  }
}

// --- Host status (HAL) --------------------------------------------------------

export interface HostStatus {
  key: string;
  name: string;
  hostname: string;
  role: string;
  state: AiInfraState;
  environment: string;
  softwareVersion: string | null;
  platform: string | null;
  connectionMode: string | null;
  capabilities: string[];
  n8nStatus: string | null;
  ollamaStatus: string | null;
  ollamaModelCount: number | null;
  latencyMs: number | null;
  lastHeartbeat: string | null;
  executionEnabled: boolean;
}

/** Build a HostStatus for one runtime node from ITS OWN bridge node + heartbeat.
 *  Never shares node/heartbeat data across runtime keys. */
function buildHostStatus(nodeKey: string, role: string): HostStatus | null {
  const health = getRuntimeHealthState();
  const node = health.bridgeNodesByKey[nodeKey];
  if (!node) return null;

  const hb = health.latestHeartbeatByNodeKey[nodeKey];
  const local = hb?.local_services as
    | { ollama?: { model_count?: unknown }; n8n?: { status?: unknown } }
    | null;

  return {
    key: node.node_key,
    name: node.name ?? node.node_key,
    hostname: node.node_key,
    role,
    state: bridgeNodeStateToInfra(node),
    environment: node.environment,
    softwareVersion: node.software_version,
    platform: node.platform,
    connectionMode: node.connection_mode,
    capabilities: Array.isArray(node.capabilities) ? node.capabilities : [],
    n8nStatus: hb?.n8n_status ?? null,
    ollamaStatus: hb?.ollama_status ?? null,
    ollamaModelCount:
      typeof local?.ollama?.model_count === 'number' ? (local.ollama.model_count as number) : null,
    latencyMs: hb?.latency_ms ?? null,
    lastHeartbeat: node.last_heartbeat_at ?? node.last_seen_at,
    executionEnabled: node.execution_enabled === true,
  };
}

/** The authoritative HAL runtime host (resolves ONLY HAL's node + heartbeat). */
export function getHalHost(): HostStatus | null {
  return buildHostStatus(HAL_RUNTIME_NODE_KEY, 'Operational Automation Host');
}

/** The authoritative TRON runtime host (resolves ONLY TRON's node + heartbeat). */
export function getTronHost(): HostStatus | null {
  return buildHostStatus(TRON_RUNTIME_NODE_KEY, 'AI Oversight · Analysis · Verification');
}

// --- Tron / Overwatch (honest NOT CONNECTED) ----------------------------------

export interface OversightStatus {
  name: string;
  role: string;
  state: AiInfraState;
  detail: string;
}

/**
 * TRON / Atlas Tron / Overwatch — derived from TRON's own authoritative bridge
 * node + heartbeat. n8n is intentionally left on HAL, so TRON's n8n
 * `not_configured` is never treated as a TRON failure. Missing TRON data is
 * honestly surfaced as NOT CONNECTED (never simulated).
 */
export function getOversight(): OversightStatus {
  const tron = getTronHost();

  if (!tron) {
    return {
      name: 'TRON / OVERWATCH',
      role: 'AI Oversight · Analysis · Verification',
      state: 'not_connected',
      detail: 'No TRON oversight runtime node is registered.',
    };
  }

  // Reachable bridge + unhealthy configured Ollama → degraded. n8n not_configured
  // is by design and does NOT degrade TRON.
  let state: AiInfraState = tron.state;
  if (tron.state === 'healthy' && tron.ollamaStatus !== 'healthy') {
    state = 'degraded';
  }

  const bridgeText =
    tron.state === 'healthy' ? 'reachable'
      : tron.state === 'stale' ? 'stale'
        : tron.state === 'offline' ? 'offline'
          : tron.state === 'degraded' ? 'degraded'
            : 'not connected';
  const ollamaText = tron.ollamaStatus === 'healthy' ? 'Ollama healthy' : `Ollama ${tron.ollamaStatus ?? 'unhealthy'}`;
  const modelText = tron.ollamaModelCount != null ? `${tron.ollamaModelCount} models` : 'model count unavailable';
  const n8nText = tron.n8nStatus === 'not_configured' ? 'n8n not configured by design' : `n8n ${tron.n8nStatus ?? 'unknown'}`;

  return {
    name: 'TRON / OVERWATCH',
    role: 'AI Oversight · Analysis · Verification',
    state,
    detail: `Runtime bridge ${bridgeText} · ${ollamaText} · ${modelText} · ${n8nText}.`,
  };
}

// --- HAL → Tron relationship ---------------------------------------------------

export interface SystemLink {
  from: string;
  to: string;
  state: 'active' | 'planned' | 'not_connected';
  label: string;
  detail: string;
}

/**
 * No direct HAL → TRON control/oversight channel is established. Both nodes are
 * monitored independently through DFP Command via their own outbound bridges.
 */
export function getHalTronLink(): SystemLink {
  return {
    from: 'HAL',
    to: 'TRON',
    state: 'not_connected',
    label: 'DIRECT CHANNEL NOT CONFIGURED',
    detail: 'Both nodes are monitored through DFP Command, but direct runtime-to-runtime control is not enabled.',
  };
}

// --- Ollama --------------------------------------------------------------------

export interface OllamaStatus {
  state: AiInfraState;
  localModels: number;
  remoteModels: number;
  catalogueFreshness: 'verified' | 'stale' | 'not_reported';
  activeInference: boolean;
  detail: string;
  lastSeen: string | null;
}

export function getOllamaStatus(): OllamaStatus {
  const health = getRuntimeHealthState();
  const catalogue = getOllamaCatalogueState().comparison;

  let state: AiInfraState = 'unknown';
  switch (health.effectivePaths['ollama']) {
    case 'local_bridge':
    case 'cloud_edge':
      state = 'healthy';
      break;
    case 'stale':
      state = 'stale';
      break;
    case 'unavailable':
      state = 'offline';
      break;
    case 'not_configured':
      state = 'not_connected';
      break;
    default:
      state = 'unknown';
      break;
  }

  const freshness = catalogue?.freshness;
  const localModels = catalogue?.localModels ?? getHalHost()?.ollamaModelCount ?? 0;
  const remoteModels = catalogue?.remoteCloudModels ?? 0;

  return {
    state,
    localModels,
    remoteModels,
    catalogueFreshness:
      freshness === 'reachable' ? 'verified' : freshness === 'stale' || freshness === 'offline' ? 'stale' : 'not_reported',
    activeInference: false, // inference is disabled by architecture (execution_enabled=false)
    detail: catalogue
      ? `${localModels} local model${localModels === 1 ? '' : 's'} relayed`
      : 'Local catalogue not yet relayed',
    lastSeen: catalogue?.catalogueAt ?? health.latestHeartbeat?.received_at ?? null,
  };
}

// --- Local AI probe ------------------------------------------------------------

export type ProbeState = 'VERIFIED' | 'FAILED' | 'STALE' | 'UNKNOWN';

export const PROBE_STATE_META: Record<
  ProbeState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  VERIFIED: { label: 'VERIFIED', tone: 'emerald' },
  FAILED: { label: 'FAILED', tone: 'red' },
  STALE: { label: 'STALE', tone: 'amber' },
  UNKNOWN: { label: 'UNKNOWN', tone: 'secondary' },
};

export interface LocalProbe {
  state: ProbeState;
  model: string;
  latencyMs: number | null;
  resultAt: string | null;
  detail: string;
}

/**
 * Derive the local inference probe state from the read-only `dfp_ollama_ping_v1`
 * probe status. `verified === true` is the ONLY success signal. A probe that
 * has never been run is UNKNOWN — never VERIFIED.
 */
export function getLocalProbe(): LocalProbe {
  const data = getAiInfraData();
  const probe = data.probe;
  const entry = probe?.probes?.[0] ?? null;

  if (!probe || !entry) {
    return {
      state: 'UNKNOWN',
      model: 'qwen2.5-coder:7b',
      latencyMs: null,
      resultAt: null,
      detail: 'No inference probe has been run yet.',
    };
  }

  let state: ProbeState = 'UNKNOWN';
  if (entry.verified === true) state = 'VERIFIED';
  else if (entry.status === 'expired') state = 'STALE';
  else if (entry.hasResult || entry.status === 'rejected') state = 'FAILED';

  return {
    state,
    model: entry.model,
    latencyMs: entry.latencyMs ?? entry.roundTripMs ?? null,
    resultAt: entry.resultAt,
    detail: entry.verified === true
      ? 'Sandbox inference verified (no business data, no arbitrary prompt).'
      : 'Read-only sandbox probe — no uncontrolled inference from the wallboard.',
  };
}

// --- n8n relationship (reused from Wallboard 45) ------------------------------

export interface N8nRelationship {
  instancesOnline: number;
  instancesTotal: number;
  activeWorkflows: number;
  running: number;
  failed: number;
}

export function getN8nRelationship(): N8nRelationship {
  const instances = getN8nInstances();
  const workflows = getN8nWorkflows();
  const running = getRunningWorkflows();
  const failed = getFailedWorkflows();
  return {
    instancesOnline: instances.filter((i) => i.state === 'healthy').length,
    instancesTotal: instances.length,
    activeWorkflows: workflows.filter((w) => w.enabled).length,
    running: running.length,
    failed: failed.length,
  };
}

// --- Master agent summary ------------------------------------------------------

export type MasterAgentState = 'active' | 'idle' | 'degraded' | 'unavailable';

export interface MasterAgentSummary {
  total: number;
  active: number;
  idle: number;
  degraded: number;
  unavailable: number;
  /** Whether the orchestration category exists in the live registry. */
  sourcePresent: boolean;
}

function masterState(a: AiAgentRow): MasterAgentState {
  const s = (a.status ?? '').toLowerCase();
  if (s === 'working' || s === 'active') return 'active';
  if (s === 'idle') return 'idle';
  if (s === 'error' || s === 'paused' || (a.health ?? '').toLowerCase() === 'warning') return 'degraded';
  return 'unavailable'; // disabled / not_configured / unknown
}

/**
 * "Master agents" = orchestration-category agents (the per-site / group
 * orchestrating role). Detailed master-agent information is deferred to
 * Wallboard 47 — this is a compact summary only.
 */
export function getMasterAgentSummary(): MasterAgentSummary {
  const data = getGroupLiveData();
  const masters = data.agents.filter((a) => (a.category ?? '').toLowerCase() === 'orchestration');

  const count = (s: MasterAgentState) => masters.filter((m) => masterState(m) === s).length;

  return {
    total: masters.length,
    active: count('active'),
    idle: count('idle'),
    degraded: count('degraded'),
    unavailable: count('unavailable'),
    sourcePresent: data.availability.agents,
  };
}

// --- System connection map -----------------------------------------------------

export interface TopologyNode {
  key: string;
  name: string;
  role: string;
  state: AiInfraState;
  detail: string;
}

/** Actual topology derived from registered/configured relationships only. */
export function getAiTopology(): TopologyNode[] {
  const hal = getHalHost();
  const oversight = getOversight();
  const ollama = getOllamaStatus();
  const n8n = getN8nRelationship();
  const masters = getMasterAgentSummary();

  const halState = hal?.state ?? 'not_connected';
  const ollamaOffline = ollama.state === 'offline' || ollama.state === 'stale';
  const n8nState: AiInfraState =
    n8n.instancesTotal === 0 ? 'not_connected'
      : n8n.instancesOnline === n8n.instancesTotal && n8n.failed === 0 ? 'healthy'
        : n8n.failed > 0 || n8n.instancesOnline < n8n.instancesTotal ? 'degraded'
          : 'unknown';

  const masterState: AiInfraState =
    !masters.sourcePresent || masters.total === 0 ? 'not_connected'
      : masters.degraded > 0 || masters.unavailable > 0 ? 'degraded'
        : 'healthy';

  return [
    {
      key: 'dfp-command',
      name: 'DFP COMMAND',
      role: 'Cloud control plane',
      state: 'healthy',
      detail: 'Registry + control + monitoring',
    },
    {
      key: 'tron',
      name: 'TRON / OVERWATCH',
      role: oversight.role,
      state: oversight.state,
      detail: oversight.detail,
    },
    {
      key: 'hal',
      name: 'HAL / AUTOMATION',
      role: 'Operational runtime host',
      state: halState,
      detail: hal ? `n8n ${hal.n8nStatus ?? 'unknown'} · Ollama ${hal.ollamaStatus ?? 'unknown'}` : 'Not registered',
    },
    {
      key: 'master-agents',
      name: 'MASTER AGENTS',
      role: 'Site orchestration',
      state: masterState,
      detail: masters.total > 0 ? `${masters.total} orchestration agent${masters.total === 1 ? '' : 's'}` : 'None registered',
    },
    {
      key: 'site-workflows',
      name: 'SITE WORKFLOWS',
      role: 'n8n automation',
      state: n8nState,
      detail: `${n8n.activeWorkflows} active workflow${n8n.activeWorkflows === 1 ? '' : 's'}`,
    },
  ];
}

// --- Resource pressure (honest gaps) ------------------------------------------

export interface ResourceMetric {
  key: string;
  label: string;
  available: boolean;
  note: string;
}

/** CPU / RAM / GPU / storage / temperature — no authoritative source exists. */
export function getResourceMetrics(): ResourceMetric[] {
  return [
    { key: 'cpu', label: 'CPU', available: false, note: 'No host CPU metric source.' },
    { key: 'ram', label: 'RAM', available: false, note: 'No host memory metric source.' },
    { key: 'gpu', label: 'GPU', available: false, note: 'No GPU utilisation source.' },
    { key: 'storage', label: 'Storage', available: false, note: 'No host storage metric source.' },
    { key: 'temperature', label: 'Temperature', available: false, note: 'No thermal metric source.' },
  ];
}

// --- Summary -------------------------------------------------------------------

export interface AiInfraSummary {
  sourceState: 'live' | 'partial' | 'unavailable';
  halState: AiInfraState;
  oversightState: AiInfraState;
  ollamaState: AiInfraState;
  localModels: number;
  masterAgentsTotal: number;
  masterAgentsActive: number;
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getAiInfraSummary(): AiInfraSummary {
  const hal = getHalHost();
  const tron = getTronHost();
  const oversight = getOversight();
  const ollama = getOllamaStatus();
  const masters = getMasterAgentSummary();
  const health = getRuntimeHealthState();

  const halState = hal?.state ?? 'not_connected';
  const tronState = tron?.state ?? 'not_connected';

  const hasAnySource = hal != null || tron != null;
  const loading = health.historyLoading && hal == null && tron == null;

  let sourceState: AiInfraSummary['sourceState'];
  if (loading) sourceState = 'unavailable';
  else if (hasAnySource) sourceState = 'live';
  else sourceState = 'unavailable';

  let label: string;
  let detail: string;
  let tone: AiInfraSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'AI INFRASTRUCTURE UNKNOWN';
    detail = 'The local AI monitoring source could not be reached.';
    tone = 'secondary';
  } else if (halState === 'offline') {
    label = 'HAL OFFLINE';
    detail = 'The operational automation host is not reachable.';
    tone = 'red';
  } else if (tronState === 'offline') {
    label = 'TRON OFFLINE';
    detail = 'The oversight runtime node is not reachable.';
    tone = 'red';
  } else if (halState === 'stale' || tronState === 'stale') {
    label = 'RUNTIME STALE';
    detail = 'A runtime bridge heartbeat is stale.';
    tone = 'amber';
  } else if (halState === 'degraded' || oversight.state === 'degraded') {
    label = 'AI INFRASTRUCTURE DEGRADED';
    detail = 'A runtime node is reporting degraded local services.';
    tone = 'amber';
  } else if (ollama.state === 'offline') {
    label = 'OLLAMA OFFLINE';
    detail = 'Local model serving is unavailable.';
    tone = 'red';
  } else if (ollama.state === 'stale') {
    label = 'LOCAL AI STALE';
    detail = 'Local model serving is reporting stale.';
    tone = 'amber';
  } else {
    label = 'AI INFRASTRUCTURE HEALTHY';
    detail = 'HAL and TRON reachable · local model services available.';
    tone = 'emerald';
  }

  return {
    sourceState,
    halState,
    oversightState: oversight.state,
    ollamaState: ollama.state,
    localModels: ollama.localModels,
    masterAgentsTotal: masters.total,
    masterAgentsActive: masters.active,
    label,
    detail,
    tone,
  };
}

// --- Monitoring gaps (honest, never fabricated) --------------------------------

export interface AiInfraGap {
  area: string;
  note: string;
}

export function getAiInfraGaps(): AiInfraGap[] {
  return [
    { area: 'HAL → TRON direct channel', note: 'No direct runtime-to-runtime control channel is established — both nodes are monitored independently through DFP Command.' },
    { area: 'CPU / RAM metrics', note: 'No host resource telemetry is relayed by the bridge.' },
    { area: 'GPU utilisation', note: 'No GPU metric source exists.' },
    { area: 'Storage / temperature', note: 'No host storage or thermal metric source.' },
    { area: 'TRON n8n', note: 'n8n remains on HAL by design — TRON reports n8n not_configured without degradation.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ----------------------

export interface AiInfraIncident {
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
 * Authoritative AI infrastructure incidents only.
 *
 * NOT duplicated here (already wired by existing views):
 *   * HAL offline → CRITICAL (infrastructure incidents).
 *   * n8n instance unreachable → CRITICAL (n8n incidents).
 *   * agent error / total AI capacity unavailable (ai-capacity / core selectors).
 *
 * New signal added here: local Ollama model serving offline (authoritative
 * bridge heartbeat path = unavailable) → HIGH. The absence of a direct
 * HAL → TRON channel is an architecture gap, NOT an incident.
 */
export function getAiInfrastructureIncidents(): AiInfraIncident[] {
  const incidents: AiInfraIncident[] = [];
  const health = getRuntimeHealthState();
  const ollamaPath = health.effectivePaths['ollama'];

  if (ollamaPath === 'unavailable') {
    incidents.push({
      id: 'ai-infra-ollama-offline',
      severity: 'high',
      title: 'Local Ollama model serving is offline',
      affectedService: 'Local Ollama',
      sourceLabel: 'AI Infrastructure',
      firstDetected: health.latestHeartbeat?.received_at ?? null,
      lastUpdated: health.latestHeartbeat?.received_at ?? null,
      status: 'offline',
      description: 'The HAL relayed Ollama health is unavailable (local model serving offline).',
    });
  }

  return incidents;
}