// ============================================================================
// AI Operations — Wallboard Master Agents selectors.
//
// Pure read-only derivations over the EXISTING shared sources — no new store,
// no new fetch, no new table, no second agent registry:
//   * getGroupLiveData() → Group Site Registry (ai_sites) + Central Agent
//                          Registry (ai_operations_agents) + runs.
//   * getN8nData()       → n8n workflow registry (reused from Wallboard 45).
//
// ARCHITECTURE — ONE MASTER AGENT PER SITE:
//   A "Master Agent" is the site-scoped orchestration-category agent
//   (category = 'orchestration', site_id = the site). The group-level master
//   (category = 'orchestration', site_id = null) is the DFP Group Master
//   Orchestrator and is surfaced separately — it is NOT a per-site master.
//
// Honesty rules honoured here:
//   * A site without an orchestration agent is surfaced as NO MASTER AGENT (a
//     configuration gap — never a fabricated runtime failure).
//   * Duplicate assignments (2+ orchestration agents on one site) are surfaced.
//   * Idle is never reported as offline (separate states).
//   * There is NO per-agent heartbeat source — `updated_at` is shown as "last
//     activity", never mislabelled as heartbeat/staleness.
//   * The n8n workflow registry is authoritative for site-workflow mapping; an
//     empty registry is reported NOT CONNECTED, never inferred from names.
//   * Website (site) state and agent state are independent — neither is
//     derived from the other.
//   * No prompts, raw memory, credentials, keys, or tool payloads are exposed.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import type { AiSiteRow, AiAgentRow } from '@/lib/ai-operations';

// --- Master agent state -------------------------------------------------------

export type MasterAgentState =
  | 'active'
  | 'idle'
  | 'waiting'
  | 'degraded'
  | 'offline'
  | 'paused'
  | 'unknown'
  | 'not_assigned';

export const MASTER_AGENT_STATE_META: Record<
  MasterAgentState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary' }
> = {
  active: { label: 'ACTIVE', tone: 'emerald' },
  idle: { label: 'IDLE', tone: 'secondary' },
  waiting: { label: 'WAITING', tone: 'secondary' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'OFFLINE', tone: 'red' },
  paused: { label: 'PAUSED', tone: 'amber' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
  not_assigned: { label: 'NOT ASSIGNED', tone: 'secondary' },
};

/** A "Master Agent" is an orchestration-category agent (the overseeing role). */
function isMasterAgent(a: AiAgentRow): boolean {
  return (a.category ?? '').toLowerCase() === 'orchestration';
}

/** Normalise the underlying agent status/health onto wallboard levels. Idle is
 *  kept distinct from offline; a `working` status collapses to active. */
function agentState(a: AiAgentRow): MasterAgentState {
  const s = (a.status ?? '').toLowerCase();
  const h = (a.health ?? '').toLowerCase();
  if (s === 'active' || s === 'working') {
    return h === 'warning' ? 'degraded' : 'active';
  }
  if (s === 'idle') return 'idle';
  if (s === 'waiting' || s === 'queued') return 'waiting';
  if (s === 'error') return 'degraded';
  if (s === 'paused') return 'paused';
  if (s === 'offline') return 'offline';
  return 'unknown';
}

// --- Workflow mapping ---------------------------------------------------------

export type WorkflowMapping = 'connected' | 'not_connected' | 'unknown';

export const WORKFLOW_MAPPING_META: Record<
  WorkflowMapping,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  connected: { label: 'CONNECTED', tone: 'emerald' },
  not_connected: { label: 'NOT CONNECTED', tone: 'secondary' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

// --- Assignment issues --------------------------------------------------------

export type AssignmentIssue = 'none' | 'no_master_agent' | 'multiple_master_agents';

export const ASSIGNMENT_ISSUE_META: Record<
  AssignmentIssue,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  none: { label: 'ASSIGNED', tone: 'emerald' },
  no_master_agent: { label: 'NO MASTER AGENT', tone: 'amber' },
  multiple_master_agents: { label: 'MULTIPLE MASTER AGENTS', tone: 'red' },
};

// --- Per-site master card -----------------------------------------------------

export interface SiteMasterCard {
  siteId: string;
  siteKey: string;
  siteName: string;
  siteStatus: string;
  aiStatus: string;
  criticality: string | null;
  masterAgentKey: string | null;
  masterAgentName: string | null;
  masterAgentState: MasterAgentState;
  currentTask: string | null;
  modelReference: string | null;
  lastActivity: string | null;
  workersTotal: number;
  workersActive: number;
  workersFailed: number;
  workersWaiting: number;
  workflowMapping: WorkflowMapping;
  n8nReference: string | null;
  assignmentIssue: AssignmentIssue;
}

/** Per-site master-agent cards, driven by the Group Site Registry (authoritative
 *  list) with the Central Agent Registry providing assignment. A site with no
 *  orchestration agent is surfaced, not hidden. */
export function getSiteMasterCards(): SiteMasterCard[] {
  const data = getGroupLiveData();
  const n8nData = getN8nData();

  const workflowSiteIds = new Set<string>(
    n8nData.workflows.map((w) => w.site_id).filter((id): id is string => id != null),
  );

  return data.sites.map((site: AiSiteRow) => {
    const siteAgents = data.agents.filter((a) => a.site_id === site.id);
    const masters = siteAgents.filter(isMasterAgent);
    const workers = siteAgents.filter((a) => !isMasterAgent(a));

    const master = masters[0] ?? null;
    const assignmentIssue: AssignmentIssue =
      masters.length === 0 ? 'no_master_agent' : masters.length > 1 ? 'multiple_master_agents' : 'none';

    let workflowMapping: WorkflowMapping = 'not_connected';
    if (workflowSiteIds.has(site.id)) workflowMapping = 'connected';
    else if (n8nData.loading) workflowMapping = 'unknown';

    return {
      siteId: site.id,
      siteKey: site.site_key,
      siteName: site.name,
      siteStatus: site.operational_status,
      aiStatus: site.ai_status,
      criticality: site.criticality,
      masterAgentKey: master?.agent_key ?? null,
      masterAgentName: master?.name ?? null,
      masterAgentState: master ? agentState(master) : 'not_assigned',
      currentTask: master?.current_task ?? null,
      modelReference: master?.primary_model_reference ?? null,
      lastActivity: master?.updated_at ?? null,
      workersTotal: workers.length,
      workersActive: workers.filter((w) => ['active', 'working'].includes((w.status ?? '').toLowerCase())).length,
      workersFailed: workers.filter((w) => (w.status ?? '').toLowerCase() === 'error').length,
      workersWaiting: workers.filter((w) => ['idle', 'waiting', 'queued'].includes((w.status ?? '').toLowerCase())).length,
      workflowMapping,
      n8nReference: site.n8n_reference,
      assignmentIssue,
    };
  });
}

// --- Group master orchestrator -------------------------------------------------

export interface GroupOrchestrator {
  agentKey: string;
  name: string;
  state: MasterAgentState;
  currentTask: string | null;
  lastActivity: string | null;
}

/** The DFP Group Master Orchestrator (group-level orchestration agent) — a
 *  separate role from the per-site masters. */
export function getGroupOrchestrator(): GroupOrchestrator | null {
  const data = getGroupLiveData();
  const group = data.agents.find(
    (a) => isMasterAgent(a) && a.site_id == null && (a.agent_type ?? '').toLowerCase() === 'core',
  );
  if (!group) return null;
  return {
    agentKey: group.agent_key,
    name: group.name,
    state: agentState(group),
    currentTask: group.current_task,
    lastActivity: group.updated_at,
  };
}

// --- Summary -------------------------------------------------------------------

export interface MasterAgentSummary {
  sourceState: 'live' | 'unavailable';
  sitesTotal: number;
  masterAgentsTotal: number;
  unassignedSites: number;
  duplicateSites: number;
  active: number;
  idle: number;
  degraded: number;
  paused: number;
  unknown: number;
  notAssigned: number;
}

export function getMasterAgentSummary(): MasterAgentSummary {
  const data = getGroupLiveData();
  const cards = getSiteMasterCards();

  const count = (s: MasterAgentState) => cards.filter((c) => c.masterAgentState === s).length;

  return {
    sourceState: data.loading ? 'unavailable' : 'live',
    sitesTotal: cards.length,
    masterAgentsTotal: cards.filter((c) => c.masterAgentKey != null).length,
    unassignedSites: cards.filter((c) => c.assignmentIssue === 'no_master_agent').length,
    duplicateSites: cards.filter((c) => c.assignmentIssue === 'multiple_master_agents').length,
    active: count('active'),
    idle: count('idle'),
    degraded: count('degraded'),
    paused: count('paused'),
    unknown: count('unknown'),
    notAssigned: count('not_assigned'),
  };
}

// --- Monitoring gaps (honest, never fabricated) --------------------------------

export interface MasterAgentGap {
  area: string;
  note: string;
}

export function getMasterAgentGaps(): MasterAgentGap[] {
  return [
    { area: 'Per-agent heartbeat', note: 'No per-agent heartbeat/staleness source exists — only registry last-activity (updated_at).' },
    { area: 'Autonomous Manager route', note: 'The separate Autonomous Manager control interface is not yet routed.' },
    { area: 'Site workflow registry', note: 'ai_n8n_workflow_registry is empty — sites carry only a planned n8n_reference text.' },
    { area: 'Disabled master agents', note: 'The live registry excludes inactive agents, so a disabled master surfaces as no master agent.' },
    { area: 'Sub-agent detail', note: 'Worker breakdown is aggregate only — per-agent detail lives in the Central Agent Registry.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ----------------------

export interface MasterAgentIncident {
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
 * Authoritative master-agent incidents only. There is currently NO new
 * authoritative signal to raise here:
 *   * A master agent with status = 'error' already feeds Incident Mode via the
 *     generic agent-error loop in selectors.ts (getWallboardIncidents) — not
 *     duplicated here.
 *   * "No master agent" and "workflow not connected" are configuration gaps,
 *     NOT runtime failures — deliberately not escalated.
 *   * There is no authoritative agent offline/unavailable signal (no heartbeat),
 *     so no offline threshold is invented.
 * Returns an empty list until an authoritative escalation rule exists.
 */
export function getMasterAgentIncidents(): MasterAgentIncident[] {
  return [];
}