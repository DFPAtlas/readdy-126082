// ============================================================================
// AI Operations — Wallboard Cross-Site Orchestration & Workflow Map selectors.
//
// Pure read-only derivations over the EXISTING shared sources — no new store,
// no new fetch, no new table, no orchestration backend:
//   * getGroupLiveData()        → Group Site Registry + Central Agent Registry
//                                 + runs + approvals + orchestrations + tools
//                                 + models (routing queue / active routes /
//                                 cross-site work / approval gates).
//   * masterAgentsSelectors     → per-site master cards + group orchestrator
//                                 (Wallboard 47, reused).
//   * aiInfraSelectors          → HAL host + Tron/Overwatch (Wallboard 46).
//   * n8nStore / n8nSelectors   → n8n instances + workflow registry (Wallboard 45).
//
// ARCHITECTURE (derived from real configuration, never fabricated):
//   DFP COMMAND → OVERWATCH/TRON → HAL → SITE MASTER AGENT → SITE WORKFLOW
//   → WORKER AGENTS / TOOLS.
//
// Honesty rules honoured here:
//   * Unimplemented relationships (Tron/Overwatch) are NOT CONNECTED.
//   * A site without an orchestration agent is a CONFIGURATION gap, surfaced
//     separately from RUNTIME failures (failed runs / failed routing).
//   * The n8n workflow registry is authoritative for one-primary-workflow-per-
//     site; an empty registry is reported "missing", never inferred from names.
//   * Active routes derive from real orchestrations + runs only.
//   * No reroute/start/stop/pause/approve controls exist — read-only.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import {
  getSiteMasterCards,
  getGroupOrchestrator,
  getMasterAgentSummary,
  type SiteMasterCard,
  type MasterAgentState,
} from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import { getHalHost, getOversight } from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import { getN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { getN8nInstances, getN8nWorkflows } from '@/pages/ai-operations/wallboard/n8nSelectors';
import type { AiOrchestrationRow, AiApprovalRow, AiAgentRow } from '@/lib/ai-operations';

// --- Connection / link states --------------------------------------------------

export type LinkState = 'healthy' | 'active' | 'degraded' | 'broken' | 'not_configured' | 'unknown';

export const LINK_STATE_META: Record<
  LinkState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary' }
> = {
  healthy: { label: 'HEALTHY', tone: 'emerald' },
  active: { label: 'ACTIVE', tone: 'accent' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  broken: { label: 'BROKEN', tone: 'red' },
  not_configured: { label: 'NOT CONFIGURED', tone: 'secondary' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

// --- Topology ------------------------------------------------------------------

export interface TopologyLayer {
  key: string;
  name: string;
  role: string;
  /** State of this layer. */
  state: LinkState;
  /** State of the connection INTO this layer from the layer above. */
  linkState: LinkState;
  detail: string;
}

function masterStateToLink(state: MasterAgentState | 'not_assigned' | null): LinkState {
  switch (state) {
    case 'active':
      return 'active';
    case 'idle':
    case 'waiting':
      return 'healthy';
    case 'degraded':
      return 'degraded';
    case 'offline':
      return 'broken';
    case 'paused':
      return 'degraded';
    default:
      return 'not_configured';
  }
}

/**
 * The actual configured route of work, derived from real registries. Each
 * layer carries its own state plus the state of the link from the layer above.
 * Tron/Overwatch is NOT CONFIGURED (no registry); no fake links are drawn.
 */
export function getOrchestrationTopology(): TopologyLayer[] {
  const group = getGroupOrchestrator();
  const oversight = getOversight();
  const hal = getHalHost();
  const cards = getSiteMasterCards();
  const n8n = getN8nInstances();
  const data = getGroupLiveData();

  // COMMAND — the group master orchestrator (orchestration-category, core).
  const commandState: LinkState = !group
    ? 'not_configured'
    : group.state === 'active'
      ? 'active'
      : group.state === 'degraded'
        ? 'degraded'
        : group.state === 'offline'
          ? 'broken'
          : 'healthy';

  // EXECUTION — HAL runtime host.
  let halState: LinkState = 'not_configured';
  if (hal) {
    switch (hal.state) {
      case 'healthy':
        halState = 'healthy';
        break;
      case 'busy':
        halState = 'active';
        break;
      case 'degraded':
      case 'stale':
        halState = 'degraded';
        break;
      case 'offline':
        halState = 'broken';
        break;
      default:
        halState = 'not_configured';
    }
  }

  // SITE — master agents across the site registry.
  const assigned = cards.filter((c) => c.masterAgentKey != null);
  let siteState: LinkState = 'not_configured';
  if (cards.length > 0) {
    const degradedCount = assigned.filter((c) => c.masterAgentState === 'degraded' || c.masterAgentState === 'offline').length;
    const activeCount = assigned.filter((c) => c.masterAgentState === 'active').length;
    if (assigned.length === 0) siteState = 'not_configured';
    else if (degradedCount > 0) siteState = 'degraded';
    else if (activeCount > 0) siteState = 'active';
    else siteState = 'healthy';
  }

  // WORKFLOW — n8n instances + registry.
  let workflowState: LinkState = 'not_configured';
  if (n8n.length > 0) {
    const anyOffline = n8n.some((i) => i.state === 'offline');
    const anyUnknown = n8n.some((i) => i.state === 'unknown');
    const anyDegraded = n8n.some((i) => i.state === 'degraded');
    const allNotConfigured = n8n.every((i) => i.state === 'not_configured');
    if (allNotConfigured) workflowState = 'not_configured';
    else if (anyOffline) workflowState = 'broken';
    else if (anyUnknown) workflowState = 'unknown';
    else if (anyDegraded) workflowState = 'degraded';
    else workflowState = 'healthy';
  }

  // TOOLS — worker agents + tool connections + models.
  const toolsAvailable = data.availability.tools && data.availability.models;
  const toolCount = data.tools.length;
  const toolsState: LinkState = !toolsAvailable
    ? 'unknown'
    : toolCount > 0
      ? 'healthy'
      : 'not_configured';

  const masters = getMasterAgentSummary();

  return [
    {
      key: 'dfp-command',
      name: 'DFP COMMAND',
      role: 'Master Orchestrator',
      state: commandState,
      linkState: 'active',
      detail: group ? `${group.name} · ${group.state.toUpperCase()}` : 'No group orchestrator registered',
    },
    {
      key: 'tron-overwatch',
      name: 'TRON / OVERWATCH',
      role: oversight.role,
      state: 'not_configured',
      linkState: 'not_configured',
      detail: 'Not implemented — oversight is planned, not live',
    },
    {
      key: 'hal-runtime',
      name: 'HAL / AUTOMATION',
      role: 'Operational runtime host',
      state: halState,
      linkState: halState === 'not_configured' ? 'not_configured' : 'active',
      detail: hal
        ? `n8n ${hal.n8nStatus ?? 'unknown'} · Ollama ${hal.ollamaStatus ?? 'unknown'}`
        : 'Not registered',
    },
    {
      key: 'master-agents',
      name: 'SITE MASTER AGENTS',
      role: 'One per operational site',
      state: siteState,
      linkState: siteState === 'not_configured' ? 'not_configured' : siteState === 'degraded' ? 'degraded' : 'active',
      detail: `${assigned.length}/${cards.length} site${cards.length === 1 ? '' : 's'} assigned`,
    },
    {
      key: 'site-workflows',
      name: 'SITE WORKFLOWS',
      role: 'Primary n8n workflow per site',
      state: workflowState,
      linkState: workflowState === 'healthy' || workflowState === 'active' ? 'active' : workflowState,
      detail: `${masters.sitesTotal} site${masters.sitesTotal === 1 ? '' : 's'} · registry ${getN8nWorkflows().length} workflow${getN8nWorkflows().length === 1 ? '' : 's'}`,
    },
    {
      key: 'worker-tools',
      name: 'WORKER AGENTS / TOOLS',
      role: 'Specialist agents, models & integrations',
      state: toolsState,
      linkState: toolsState === 'healthy' ? 'active' : toolsState,
      detail: `${toolCount} tool connection${toolCount === 1 ? '' : 's'} · ${data.models.length} model${data.models.length === 1 ? '' : 's'}`,
    },
  ];
}

// --- One primary workflow per site ---------------------------------------------

export type WorkflowBindingState = 'connected' | 'missing' | 'multiple' | 'unavailable';

export const WORKFLOW_BINDING_META: Record<
  WorkflowBindingState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  connected: { label: 'CONNECTED', tone: 'emerald' },
  missing: { label: 'MISSING', tone: 'amber' },
  multiple: { label: 'MULTIPLE', tone: 'red' },
  unavailable: { label: 'UNAVAILABLE', tone: 'secondary' },
};

export interface WorkflowBinding {
  siteId: string;
  siteName: string;
  state: WorkflowBindingState;
  workflowCount: number;
  primaryWorkflow: string | null;
  n8nReference: string | null;
}

/** Validate one-primary-workflow-per-site against the authoritative n8n
 *  workflow registry (matched by stable site_id). An empty registry is
 *  reported "missing" — never inferred from the planned n8n_reference text. */
export function getWorkflowBindings(): WorkflowBinding[] {
  const data = getGroupLiveData();
  const n8nData = getN8nData();
  const workflows = getN8nWorkflows();

  const bySite = new Map<string, string[]>();
  for (const w of workflows) {
    const site = w.site; // already resolved to a display name by n8nSelectors
    const raw = n8nData.workflows.find((r) => r.workflow_key === w.key);
    const siteId = raw?.site_id ?? null;
    if (!siteId) continue;
    const list = bySite.get(siteId) ?? [];
    list.push(w.name);
    bySite.set(siteId, list);
  }

  return data.sites.map((s) => {
    const names = bySite.get(s.id) ?? [];
    let state: WorkflowBindingState;
    if (n8nData.loading) state = 'unavailable';
    else if (names.length === 0) state = 'missing';
    else if (names.length > 1) state = 'multiple';
    else state = 'connected';

    return {
      siteId: s.id,
      siteName: s.name,
      state,
      workflowCount: names.length,
      primaryWorkflow: names[0] ?? null,
      n8nReference: s.n8n_reference,
    };
  });
}

// --- Site lanes ----------------------------------------------------------------

export interface SiteLane {
  siteId: string;
  siteName: string;
  siteStatus: string;
  criticality: string | null;
  masterAgentName: string | null;
  masterState: MasterAgentState;
  currentWork: string | null;
  activeTasks: number;
  workflowBinding: WorkflowBindingState;
  workflowLabel: string | null;
}

const ACTIVE_RUN_STATUSES = new Set(['working', 'queued', 'waiting', 'awaiting_approval', 'retry_scheduled', 'blocked']);

/** Per-site lanes (site → master agent → workflow → current work), derived
 *  dynamically from the registered sites — no hard-coded names. */
export function getSiteLanes(): SiteLane[] {
  const data = getGroupLiveData();
  const cards = getSiteMasterCards();
  const bindings = getWorkflowBindings();

  const activeRunsBySite = new Map<string, number>();
  for (const r of data.runs) {
    if (!r.site_id || !ACTIVE_RUN_STATUSES.has((r.status ?? '').toLowerCase())) continue;
    activeRunsBySite.set(r.site_id, (activeRunsBySite.get(r.site_id) ?? 0) + 1);
  }

  const cardBySite = new Map<string, SiteMasterCard>(cards.map((c) => [c.siteId, c]));
  const bindingBySite = new Map<string, WorkflowBinding>(bindings.map((b) => [b.siteId, b]));

  return data.sites.map((s) => {
    const card = cardBySite.get(s.id);
    const binding = bindingBySite.get(s.id);
    return {
      siteId: s.id,
      siteName: s.name,
      siteStatus: s.operational_status,
      criticality: s.criticality,
      masterAgentName: card?.masterAgentName ?? null,
      masterState: card?.masterAgentState ?? 'not_assigned',
      currentWork: card?.currentTask ?? null,
      activeTasks: activeRunsBySite.get(s.id) ?? 0,
      workflowBinding: binding?.state ?? 'missing',
      workflowLabel: binding?.primaryWorkflow ?? binding?.n8nReference ?? null,
    };
  });
}

// --- Routing queue (reused Master Orchestrator data) --------------------------

export type RoutingBucket = 'queued' | 'executing' | 'waiting_approval' | 'failed' | 'completed';

const ROUTING_BUCKETS: Record<RoutingBucket, Set<string>> = {
  queued: new Set(['received', 'analysing', 'planning', 'selecting_agent', 'awaiting_capacity']),
  executing: new Set(['routed', 'executing', 'verifying', 'uat']),
  waiting_approval: new Set(['awaiting_approval']),
  failed: new Set(['failed', 'blocked', 'escalated']),
  completed: new Set(['completed']),
};

export interface RoutingItem {
  key: string;
  title: string;
  site: string;
  classification: string;
  status: string;
  priority: string | null;
  risk: string | null;
  agent: string;
  requestedAt: string | null;
}

function bucketFor(status: string | null): RoutingBucket | null {
  const s = (status ?? '').toLowerCase();
  for (const [bucket, set] of Object.entries(ROUTING_BUCKETS)) {
    if (set.has(s)) return bucket as RoutingBucket;
  }
  return null;
}

/** Orchestrations mapped into display rows with a routing bucket. */
function routingItems(): RoutingItem[] {
  const data = getGroupLiveData();
  return data.orchestrations.map((o: AiOrchestrationRow) => ({
    key: o.orchestration_key,
    title: o.title,
    site: o.site_id ? (data.siteNameByUuid.get(o.site_id) ?? 'Unknown site') : 'Group-wide',
    classification: o.classification ?? o.request_type ?? 'unclassified',
    status: o.status ?? 'unknown',
    priority: o.priority,
    risk: o.risk_level,
    agent: o.selected_agent_id ? (data.agentNameByUuid.get(o.selected_agent_id) ?? 'Unassigned') : 'Unassigned',
    requestedAt: o.requested_at ?? o.created_at,
  }));
}

export function getRoutingItems(): RoutingItem[] {
  return routingItems();
}

export function getRoutingQueue(): RoutingItem[] {
  return routingItems().filter((i) => bucketFor(i.status) === 'queued');
}

export function getRoutesExecuting(): RoutingItem[] {
  return routingItems().filter((i) => bucketFor(i.status) === 'executing');
}

export function getRoutesWaitingApproval(): RoutingItem[] {
  return routingItems().filter((i) => bucketFor(i.status) === 'waiting_approval');
}

export function getFailedRouting(): RoutingItem[] {
  return routingItems().filter((i) => bucketFor(i.status) === 'failed');
}

export function getRecentlyCompletedRouting(limit = 5): RoutingItem[] {
  return routingItems()
    .filter((i) => bucketFor(i.status) === 'completed')
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
    .slice(0, limit);
}

// --- Active routes (current execution state) -----------------------------------

export interface ActiveRoute {
  site: string;
  agent: string;
  task: string;
  status: string;
  risk: string | null;
}

/** Work currently moving through the architecture, from live runs (working /
 *  queued / waiting). Site/agent names resolve from stable ids. */
export function getActiveRoutes(): ActiveRoute[] {
  const data = getGroupLiveData();
  const routes: ActiveRoute[] = [];

  for (const r of data.runs) {
    const s = (r.status ?? '').toLowerCase();
    if (!ACTIVE_RUN_STATUSES.has(s)) continue;
    routes.push({
      site: r.site_id ? (data.siteNameByUuid.get(r.site_id) ?? 'Group-wide') : 'Group-wide',
      agent: r.agent_id ? (data.agentNameByUuid.get(r.agent_id) ?? 'Unassigned') : 'Unassigned',
      task: r.result_summary ?? r.error_summary ?? r.run_key,
      status: s,
      risk: r.risk_level,
    });
  }

  // Priority: working first, then awaiting_approval, queued, waiting, blocked.
  const order: Record<string, number> = { working: 0, awaiting_approval: 1, queued: 2, waiting: 3, retry_scheduled: 4, blocked: 5 };
  return routes.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
}

// --- Cross-site (group-wide) work ----------------------------------------------

export interface CrossSiteWork {
  title: string;
  classification: string;
  status: string;
  agent: string;
}

/** Operations scoped group-wide (site_id = null) — not falsely assigned to any
 *  one site's Master Agent. */
export function getCrossSiteWork(): CrossSiteWork[] {
  const data = getGroupLiveData();
  return data.orchestrations
    .filter((o: AiOrchestrationRow) => o.site_id == null)
    .map((o) => ({
      title: o.title,
      classification: o.classification ?? o.request_type ?? 'unclassified',
      status: o.status ?? 'unknown',
      agent: o.selected_agent_id ? (data.agentNameByUuid.get(o.selected_agent_id) ?? 'Unassigned') : 'Unassigned',
    }));
}

// --- Approval gates -------------------------------------------------------------

export interface ApprovalGateItem {
  key: string;
  title: string;
  site: string;
  action: string;
  severity: string | null;
}

const WAITING_APPROVAL_STATUSES = new Set(['pending', 'under_review', 'more_info_required']);

/** Human approval gates currently blocking orchestration. No approve/reject
 *  actions are exposed — read-only. */
export function getApprovalGates(): ApprovalGateItem[] {
  const data = getGroupLiveData();
  return data.approvals
    .filter((a: AiApprovalRow) => WAITING_APPROVAL_STATUSES.has((a.status ?? '').toLowerCase()))
    .map((a) => ({
      key: a.approval_key,
      title: a.title ?? a.requested_action ?? a.approval_key,
      site: a.site_id ? (data.siteNameByUuid.get(a.site_id) ?? 'Group-wide') : 'Group-wide',
      action: a.requested_action ?? 'Approval required',
      severity: a.severity,
    }));
}

// --- Configuration vs runtime failures -----------------------------------------

export interface OrchestrationIssue {
  kind: 'configuration' | 'runtime';
  title: string;
  site: string;
  detail: string;
}

/** Structural problems (no master agent, missing workflow) — surfaced
 *  separately from runtime failures, never fabricated as runtime errors. */
export function getConfigurationIssues(): OrchestrationIssue[] {
  const lanes = getSiteLanes();
  const issues: OrchestrationIssue[] = [];

  for (const lane of lanes) {
    if (lane.masterAgentName == null) {
      issues.push({
        kind: 'configuration',
        title: 'Site has no Master Agent',
        site: lane.siteName,
        detail: 'No orchestration-category agent is assigned to this site.',
      });
    }
    if (lane.workflowBinding === 'missing') {
      issues.push({
        kind: 'configuration',
        title: 'Primary workflow missing',
        site: lane.siteName,
        detail: lane.workflowLabel ? `Planned reference ${lane.workflowLabel} — not yet registered.` : 'No primary n8n workflow is registered.',
      });
    } else if (lane.workflowBinding === 'multiple') {
      issues.push({
        kind: 'configuration',
        title: 'Multiple primary workflows',
        site: lane.siteName,
        detail: 'More than one registered workflow is mapped to this site.',
      });
    }
  }

  return issues;
}

/** Runtime failures supported by actual state: failed/blocked runs and failed
 *  routing — never invented. */
export function getRuntimeFailures(): OrchestrationIssue[] {
  const data = getGroupLiveData();
  const issues: OrchestrationIssue[] = [];

  for (const r of data.runs) {
    if (!['failed', 'blocked'].includes((r.status ?? '').toLowerCase())) continue;
    issues.push({
      kind: 'runtime',
      title: r.error_summary ?? 'Run failed',
      site: r.site_id ? (data.siteNameByUuid.get(r.site_id) ?? 'Group-wide') : 'Group-wide',
      detail: `Status ${r.status}${r.run_key ? ` · ${r.run_key}` : ''}`,
    });
  }

  return issues;
}

// --- Summary --------------------------------------------------------------------

export interface OrchestrationSummary {
  sourceState: 'live' | 'unavailable';
  sitesConnected: number;
  masterAgentsHealthy: number;
  masterAgentsTotal: number;
  workflowsHealthy: number;
  workflowsTotal: number;
  routesActive: number;
  routesWaiting: number;
  failures: number;
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getOrchestrationSummary(): OrchestrationSummary {
  const data = getGroupLiveData();
  const cards = getSiteMasterCards();
  const bindings = getWorkflowBindings();
  const routes = routingItems();
  const failures = getRuntimeFailures().length + getFailedRouting().length;

  const masterAgentsTotal = cards.filter((c) => c.masterAgentKey != null).length;
  const masterAgentsHealthy = cards.filter(
    (c) => c.masterAgentKey != null && ['active', 'idle'].includes(c.masterAgentState),
  ).length;
  const workflowsHealthy = bindings.filter((b) => b.state === 'connected').length;

  const routesActive = getRoutesExecuting().length;
  const routesWaiting = getRoutingQueue().length + getRoutesWaitingApproval().length;

  const sourceState: OrchestrationSummary['sourceState'] = data.loading ? 'unavailable' : 'live';

  let label: string;
  let detail: string;
  let tone: OrchestrationSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'ORCHESTRATION UNKNOWN';
    detail = 'The core registries could not be loaded.';
    tone = 'secondary';
  } else if (failures > 0) {
    label = 'ROUTING FAILURES PRESENT';
    detail = `${failures} runtime failure${failures === 1 ? '' : 's'} require attention.`;
    tone = 'red';
  } else if (routesWaiting > 0) {
    label = 'WORK IN FLOW';
    detail = `${routesWaiting} route${routesWaiting === 1 ? '' : 's'} queued or awaiting approval.`;
    tone = 'amber';
  } else {
    label = 'ORCHESTRATION HEALTHY';
    detail = 'Routes are flowing with no active failures.';
    tone = 'emerald';
  }

  return {
    sourceState,
    sitesConnected: cards.length,
    masterAgentsHealthy,
    masterAgentsTotal,
    workflowsHealthy,
    workflowsTotal: bindings.length,
    routesActive,
    routesWaiting,
    failures,
    label,
    detail,
    tone,
  };
}

// --- Monitoring gaps (honest, never fabricated) --------------------------------

export interface OrchestrationGap {
  area: string;
  note: string;
}

export function getOrchestrationGaps(): OrchestrationGap[] {
  return [
    { area: 'Autonomous Manager route', note: 'The control interface for reroute/start/stop is not yet routed — wallboard remains observation only.' },
    { area: 'Primary workflow registry', note: 'ai_n8n_workflow_registry is empty — sites carry only a planned n8n_reference text.' },
    { area: 'Oversight layer', note: 'Tron/Overwatch is not registered; the oversight relationship is planned, not live.' },
    { area: 'Routing escalation rules', note: 'No approved rule maps multiple broken site routes to a criticality level.' },
    { area: 'Orchestration heartbeat', note: 'No per-orchestration liveness source exists — status derives from the registry row only.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ----------------------

export interface OrchestrationIncident {
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
 * Authoritative orchestration incidents only. There is currently NO new
 * authoritative signal to raise here:
 *   * HAL offline → CRITICAL (already wired by infrastructure incidents).
 *   * n8n instance unreachable → CRITICAL (already wired by n8n incidents).
 *   * Master orchestrator agent error → already flows via the generic agent
 *     error loop.
 *   * "No master agent" / "workflow missing" are CONFIGURATION gaps, not
 *     runtime failures — deliberately not escalated.
 *   * There is no approved rule mapping multiple broken site routes to a
 *     criticality level — so no repeated-failure incident is invented.
 * Returns an empty list until an authoritative escalation rule exists.
 */
export function getOrchestrationIncidents(): OrchestrationIncident[] {
  return [];
}

// --- Worker / sub-agent aggregate (per site) -----------------------------------

export interface WorkerAggregate {
  siteName: string;
  total: number;
  active: number;
  failed: number;
  waiting: number;
}

/** Specialist (non-orchestration) agents per site, aggregated — detailed
 *  per-agent info stays in the Central Agent Registry. */
export function getWorkerAggregates(): WorkerAggregate[] {
  const data = getGroupLiveData();
  return data.sites.map((s) => {
    const workers = data.agents.filter(
      (a: AiAgentRow) => a.site_id === s.id && (a.category ?? '').toLowerCase() !== 'orchestration',
    );
    return {
      siteName: s.name,
      total: workers.length,
      active: workers.filter((w) => ['active', 'working'].includes((w.status ?? '').toLowerCase())).length,
      failed: workers.filter((w) => (w.status ?? '').toLowerCase() === 'error').length,
      waiting: workers.filter((w) => ['idle', 'waiting', 'queued'].includes((w.status ?? '').toLowerCase())).length,
    };
  });
}