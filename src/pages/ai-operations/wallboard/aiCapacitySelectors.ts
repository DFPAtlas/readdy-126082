// ============================================================================
// AI Operations — Wallboard AI Capacity / Model & Provider Health selectors.
//
// Pure read-only derivations over the EXISTING shared sources — no new store,
// no new fetches, no new tables, no routing-policy change:
//   * getGroupLiveData()      → providers, models, agent→model assignments,
//                               runs (queue/running/failed), usage costs.
//   * getOllamaCatalogueState() → relayed local Ollama model catalogue.
//   * getRuntimeHealthState()  → HAL bridge node + heartbeat (ollama health).
//   * getInfrastructureHosts() → HAL host tile (reused, not re-derived).
//
// Honesty rules honoured here:
//   * Provider/model health is REGISTRY-reported health (the `health` /
//     `status` columns) — live provider connectivity probes are not separately
//     connected, so this is never mislabelled "live connectivity".
//   * UNKNOWN (no successful check) is kept distinct from HEALTHY.
//   * Capacity figures are only derived from authoritative data (runs queue,
//     local Ollama catalogue model count) — no percentages are invented, no
//     GPU/RAM utilisation is fabricated.
//   * Cost is the existing estimated / migrated baseline (usage_costs) — never
//     treated as paid invoice data.
//   * Atlas / Atlas Tron are NOT hard-coded: there is no authoritative registry
//     for them, so they are honestly omitted rather than invented.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getOllamaCatalogueState } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { getRuntimeHealthState } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { getInfrastructureHosts } from '@/pages/ai-operations/wallboard/infrastructureSelectors';
import { describeCatalogueFreshness } from '@/lib/ai-operations/runtimeOllama';

// --- Status model --------------------------------------------------------------

export type AiHealthState =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'not_configured'
  | 'disabled'
  | 'unknown';

export const AI_STATE_META: Record<
  AiHealthState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  healthy: { label: 'HEALTHY', tone: 'emerald' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  unavailable: { label: 'UNAVAILABLE', tone: 'red' },
  not_configured: { label: 'NOT CONFIGURED', tone: 'secondary' },
  disabled: { label: 'DISABLED', tone: 'secondary' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/**
 * Classify a registry row onto the wallboard health levels. Order is
 * deliberate: an explicit unavailable/degraded beats a healthy default, and
 * "unknown" is only returned when no authoritative signal exists (never
 * silently promoted to healthy).
 */
function classifyHealth(
  status: string | null | undefined,
  health: string | null | undefined,
  isActive: boolean,
): AiHealthState {
  if (isActive === false) return 'disabled';
  const s = (status ?? '').toLowerCase().trim();
  const h = (health ?? '').toLowerCase().trim();
  if (['unavailable', 'offline', 'failed', 'error', 'down'].includes(h) || ['unavailable', 'offline', 'failed', 'error', 'down'].includes(s)) {
    return 'unavailable';
  }
  if (h === 'degraded' || h === 'warning' || s === 'degraded' || s === 'warning') return 'degraded';
  if (s === 'not_configured' || h === 'not_configured') return 'not_configured';
  if (s === 'disabled') return 'disabled';
  if (h === 'healthy' || s === 'available' || s === 'active') return 'healthy';
  return 'unknown';
}

function pounds(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

// --- Provider status -----------------------------------------------------------

export interface ProviderStatusItem {
  key: string;
  name: string;
  type: string;
  hosting: string;
  state: AiHealthState;
  monitoringEnabled: boolean;
  costTrackingEnabled: boolean;
  activeModels: number;
  lastChecked: string | null;
  isActive: boolean;
}

export function getAiProviderStatuses(): ProviderStatusItem[] {
  const data = getGroupLiveData();
  return data.providers.map((p) => ({
    key: p.provider_key,
    name: p.name,
    type: p.provider_type ?? 'unknown',
    hosting: p.hosting_type ?? 'cloud',
    state: classifyHealth(p.status, p.health, p.is_active),
    monitoringEnabled: p.health_monitoring_enabled === true,
    costTrackingEnabled: p.cost_tracking_enabled === true,
    activeModels: data.models.filter((m) => m.provider_id === p.id && m.is_active).length,
    lastChecked: p.updated_at ?? null,
    isActive: p.is_active,
  }));
}

// --- Model status --------------------------------------------------------------

export interface ModelStatusItem {
  modelKey: string;
  name: string;
  providerName: string;
  hosting: 'cloud' | 'local';
  state: AiHealthState;
  isDefault: boolean;
  fallbackPriority: number | null;
  usedAsPrimary: number;
  usedAsFallback: number;
}

function providerNameById(data: ReturnType<typeof getGroupLiveData>): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of data.providers) map.set(p.id, p.name);
  return map;
}

export function getAiModelStatuses(): ModelStatusItem[] {
  const data = getGroupLiveData();
  const names = providerNameById(data);

  const primaryByModel = new Map<string, number>();
  const fallbackByModel = new Map<string, number>();
  for (const a of data.modelAssignments) {
    if (!a.is_active) continue;
    if (a.assignment_type === 'primary') primaryByModel.set(a.model_id, (primaryByModel.get(a.model_id) ?? 0) + 1);
    else if (a.assignment_type === 'fallback') fallbackByModel.set(a.model_id, (fallbackByModel.get(a.model_id) ?? 0) + 1);
  }

  // Priority order: active models first, then by primary-usage count desc.
  return data.models
    .map((m) => ({
      modelKey: m.model_key,
      name: m.name,
      providerName: names.get(m.provider_id) ?? 'Unknown Provider',
      hosting: (m.hosting_type === 'local' ? 'local' : 'cloud') as 'cloud' | 'local',
      state: classifyHealth(m.status, m.health, m.is_active),
      isDefault: m.is_default === true,
      fallbackPriority: m.fallback_priority,
      usedAsPrimary: primaryByModel.get(m.id) ?? 0,
      usedAsFallback: fallbackByModel.get(m.id) ?? 0,
    }))
    .sort((a, b) => {
      const activeA = a.state === 'healthy' ? 0 : a.state === 'degraded' ? 1 : 2;
      const activeB = b.state === 'healthy' ? 0 : b.state === 'degraded' ? 1 : 2;
      if (activeA !== activeB) return activeA - activeB;
      return b.usedAsPrimary - a.usedAsPrimary;
    });
}

// --- Local AI sources ----------------------------------------------------------

export interface LocalAiSource {
  key: string;
  name: string;
  role: string;
  state: AiHealthState;
  detail: string;
  lastSeen: string | null;
}

function mapInfraToAi(status: string): AiHealthState {
  switch (status) {
    case 'healthy':
      return 'healthy';
    case 'warning':
    case 'degraded':
      return 'degraded';
    case 'offline':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

/** Number of local Ollama models reported by the relayed catalogue (0 if not reported). */
export function getLocalModelCount(): number {
  return getOllamaCatalogueState().comparison?.localModels ?? 0;
}

export function getLocalAiSources(): LocalAiSource[] {
  const sources: LocalAiSource[] = [];

  // HAL — the local runtime host (authoritative bridge node state).
  const hal = getInfrastructureHosts()[0];
  if (hal) {
    sources.push({
      key: 'hal',
      name: hal.name,
      role: 'Local Runtime Host (HAL)',
      state: mapInfraToAi(hal.status),
      detail: hal.message ?? 'Local runtime host',
      lastSeen: hal.lastSeen,
    });
  }

  // Ollama — local model serving, from the HAL heartbeat + relayed catalogue.
  const health = getRuntimeHealthState();
  const ollamaPath = health.effectivePaths['ollama'];
  const catalogue = getOllamaCatalogueState().comparison;

  let ollamaState: AiHealthState = 'unknown';
  switch (ollamaPath) {
    case 'local_bridge':
      ollamaState = 'healthy';
      break;
    case 'cloud_edge':
      ollamaState = 'healthy';
      break;
    case 'stale':
      ollamaState = 'degraded';
      break;
    case 'unavailable':
      ollamaState = 'unavailable';
      break;
    case 'not_configured':
      ollamaState = 'not_configured';
      break;
    default:
      ollamaState = 'unknown';
      break;
  }

  const catalogueLabel = describeCatalogueFreshness(catalogue);
  const localModels = catalogue?.localModels ?? 0;
  const detail = catalogue
    ? `${localModels} local model${localModels === 1 ? '' : 's'} · catalogue ${catalogueLabel.label}`
    : 'Local model catalogue not reported';

  sources.push({
    key: 'ollama',
    name: 'Local Ollama',
    role: 'Local Model Serving',
    state: ollamaState,
    detail,
    lastSeen: catalogue?.catalogueAt ?? health.latestHeartbeat?.received_at ?? null,
  });

  return sources;
}

// --- Queue / workload ----------------------------------------------------------

export interface AiQueueSummary {
  running: number;
  queued: number;
  failedRecent: number;
  retryScheduled: number;
  awaitingApproval: number;
}

export function getAiQueueSummary(): AiQueueSummary {
  const data = getGroupLiveData();
  const runs = data.runs;
  return {
    running: runs.filter((r) => r.status === 'working').length,
    queued: runs.filter((r) => ['queued', 'waiting'].includes(r.status)).length,
    failedRecent: runs.filter((r) => r.status === 'failed').length,
    retryScheduled: runs.filter((r) => r.status === 'retry_scheduled').length,
    awaitingApproval: runs.filter((r) => r.status === 'awaiting_approval').length,
  };
}

// --- Routing resilience --------------------------------------------------------

export interface AiRoutingResilience {
  primaryHealthy: boolean;
  fallbackAvailable: boolean;
  healthyModels: number;
  fallbackAssignments: number;
  healthyFallbackModels: number;
  label: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getAiRoutingResilience(): AiRoutingResilience {
  const data = getGroupLiveData();

  const healthyActive = new Set(
    data.models
      .filter((m) => classifyHealth(m.status, m.health, m.is_active) === 'healthy')
      .map((m) => m.id),
  );

  const fallbackAssignments = data.modelAssignments.filter(
    (a) => a.is_active && a.assignment_type === 'fallback',
  );
  const healthyFallbackModels = new Set(
    fallbackAssignments.filter((a) => healthyActive.has(a.model_id)).map((a) => a.model_id),
  );

  const primaryHealthy = healthyActive.size > 0;
  const fallbackAvailable = healthyFallbackModels.size > 0;

  let label: string;
  let tone: AiRoutingResilience['tone'];
  if (primaryHealthy && fallbackAvailable) {
    label = 'PRIMARY HEALTHY · FALLBACK AVAILABLE';
    tone = 'emerald';
  } else if (primaryHealthy && !fallbackAvailable) {
    label = 'PRIMARY HEALTHY · NO FALLBACK AVAILABLE';
    tone = 'amber';
  } else if (!primaryHealthy && fallbackAvailable) {
    label = 'DEGRADED — FALLBACK ACTIVE';
    tone = 'amber';
  } else {
    label = 'NO CAPACITY AVAILABLE';
    tone = 'red';
  }

  return {
    primaryHealthy,
    fallbackAvailable,
    healthyModels: healthyActive.size,
    fallbackAssignments: fallbackAssignments.length,
    healthyFallbackModels: healthyFallbackModels.size,
    label,
    tone,
  };
}

// --- Cost (existing estimated / migrated baseline) -----------------------------

export interface AiCostSplit {
  provider: string;
  amount: number;
}

export interface AiCostSummary {
  total: number;
  isEstimated: boolean;
  split: AiCostSplit[];
}

export function getAiCostSummary(): AiCostSummary {
  const data = getGroupLiveData();
  const names = providerNameById(data);

  let total = 0;
  const byProvider = new Map<string, number>();
  for (const u of data.usageCosts) {
    const amount = pounds(u.estimated_cost) || pounds(u.actual_cost);
    total += amount;
    if (u.provider_id) {
      const name = names.get(u.provider_id) ?? 'Unknown';
      byProvider.set(name, (byProvider.get(name) ?? 0) + amount);
    }
  }

  const split = [...byProvider.entries()]
    .map(([provider, amount]) => ({ provider, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    total,
    isEstimated: data.usageCosts.some((u) => u.is_estimate === true && u.actual_cost == null),
    split,
  };
}

// --- Summary -------------------------------------------------------------------

export interface AiCapacitySummary {
  sourceState: 'live' | 'partial' | 'unavailable';
  providersTotal: number;
  providersHealthy: number;
  providersDegraded: number;
  providersUnavailable: number;
  modelsTotal: number;
  modelsActive: number;
  modelsHealthy: number;
  modelsDegraded: number;
}

export function getAiCapacitySummary(): AiCapacitySummary {
  const data = getGroupLiveData();

  const providerStates = getAiProviderStatuses();
  const modelStates = getAiModelStatuses();

  const providersHealthy = providerStates.filter((p) => p.state === 'healthy').length;
  const providersDegraded = providerStates.filter((p) => p.state === 'degraded').length;
  const providersUnavailable = providerStates.filter((p) => p.state === 'unavailable').length;

  const modelsActive = modelStates.filter((m) => m.state !== 'disabled').length;
  const modelsHealthy = modelStates.filter((m) => m.state === 'healthy').length;
  const modelsDegraded = modelStates.filter((m) => m.state === 'degraded').length;

  let sourceState: AiCapacitySummary['sourceState'];
  if (data.availability.providers && data.availability.models) {
    sourceState = 'live';
  } else if (data.availability.providers || data.availability.models) {
    sourceState = 'partial';
  } else {
    sourceState = 'unavailable';
  }

  return {
    sourceState,
    providersTotal: providerStates.length,
    providersHealthy,
    providersDegraded,
    providersUnavailable,
    modelsTotal: modelStates.length,
    modelsActive,
    modelsHealthy,
    modelsDegraded,
  };
}

// --- Incidents (feed Wallboard 22 Incident Mode) -------------------------------

export interface AiCapacityIncident {
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
 * Authoritative AI capacity incidents only:
 *   * CRITICAL — total capacity unavailable: no healthy primary model AND no
 *     healthy fallback model (with registered active models present).
 *   * HIGH — a configured provider is UNAVAILABLE (explicit failure state).
 *
 * DEGRADED / not_configured / unknown providers are NOT incidents (degraded is
 * surfaced visually, not_configured is a configuration gap, unknown is not a
 * failure). Nothing is triggered without an authoritative failure state.
 */
export function getAiCapacityIncidents(): AiCapacityIncident[] {
  const incidents: AiCapacityIncident[] = [];
  const data = getGroupLiveData();

  // Per-provider failure (explicit unavailable only).
  for (const p of getAiProviderStatuses()) {
    if (p.state !== 'unavailable') continue;
    incidents.push({
      id: `ai-provider-${p.key}`,
      severity: 'high',
      title: `${p.name} is unavailable`,
      affectedService: p.name,
      sourceLabel: 'AI Provider',
      firstDetected: p.lastChecked,
      lastUpdated: p.lastChecked,
      status: 'unavailable',
      description: `Provider ${p.name} is reporting an unavailable state.`,
    });
  }

  // Total-capacity failure (critical): no healthy primary + no healthy fallback.
  const resilience = getAiRoutingResilience();
  const hasRegisteredActive = getAiModelStatuses().some((m) => m.state !== 'disabled');
  if (!resilience.primaryHealthy && !resilience.fallbackAvailable && hasRegisteredActive) {
    incidents.push({
      id: 'ai-capacity-total',
      severity: 'critical',
      title: 'Total AI capacity unavailable',
      affectedService: 'AI Model Capacity',
      sourceLabel: 'AI Capacity',
      firstDetected: null,
      lastUpdated: data.lastRefreshed.toISOString(),
      status: 'unavailable',
      description: 'No healthy primary model and no healthy fallback model are available.',
    });
  }

  return incidents;
}