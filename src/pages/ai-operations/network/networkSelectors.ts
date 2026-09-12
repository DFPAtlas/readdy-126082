// ============================================================================
// DFP AI Operations — Group Agent Network selectors (Prompt 01).
//
// Pure read-only derivations over the EXISTING shared sources — no new store,
// no new fetch, no new table, no second agent registry, no per-card polling:
//   * getGroupLiveData()   → Group Site Registry (ai_sites) + Central Agent
//                            Registry (ai_operations_agents) + runs.
//   * getWidgetConfigData()→ saved wall-widget config (display name, initials,
//                            brand colour) for the "registered icon + colour".
//   * getGroupOrchestrator()/getOversight()/getHalHost() → centre identities
//                            (group orchestrator, TRON oversight, HAL host).
//
// Honesty rules honoured here:
//   * Sites are resolved ONLY from ai_sites.id → site_key (never a display
//     name or abbreviation). No hard-coded site list.
//   * A site's manager = its site-scoped orchestration-category agent. Zero
//     managers → "Manager not assigned"; 2+ → surfaced as a duplicate
//     assignment issue (never silently collapsed to one).
//   * Workers are grouped by site membership only (parent relationships are
//     NOT stored) — the relationship is labelled "site membership", never a
//     verified execution dependency.
//   * Shared/group agents (site_id = null, not the group orchestrator) stay
//     visible in a separate group.
//   * Only fresh, authoritative run evidence (a `working` ai_runs row) enables
//     edge animation. Registry status / metadata / heartbeats alone never do.
//   * Missing data never becomes a green state or a fabricated zero.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getWidgetConfigData } from '@/pages/ai-operations/wallboard/widgetConfigStore';
import {
  getGroupOrchestrator,
  MASTER_AGENT_STATE_META,
  type GroupOrchestrator,
  type MasterAgentState,
} from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import {
  getHalHost,
  getOversight,
  type HostStatus,
  type OversightStatus,
} from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import type { AiAgentRow } from '@/lib/ai-operations';

// ---------------------------------------------------------------------------
// Brand palette (registered site colour) + stable fallback
// ---------------------------------------------------------------------------

export type BrandColor = 'cyan' | 'blue' | 'teal' | 'orange' | 'purple' | 'yellow' | 'pink' | 'violet';

export const BRAND_HEX: Record<BrandColor, string> = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  teal: '#2dd4bf',
  orange: '#fb923c',
  purple: '#a78bfa',
  yellow: '#eab308',
  pink: '#f472b6',
  violet: '#8b5cf6',
};

const BRAND_ORDER: BrandColor[] = ['cyan', 'teal', 'orange', 'pink', 'yellow', 'violet', 'blue', 'purple'];

/** Stable brand colour for a site that has no saved widget colour yet. */
function fallbackBrandColor(siteKey: string): BrandColor {
  let h = 0;
  for (let i = 0; i < siteKey.length; i += 1) {
    h = (h * 31 + siteKey.charCodeAt(i)) >>> 0;
  }
  return BRAND_ORDER[h % BRAND_ORDER.length];
}

/** ≤4-character initials derived from a name (used when no saved initials). */
export function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Tone / status presentation
// ---------------------------------------------------------------------------

export type Tone = 'emerald' | 'amber' | 'red' | 'accent' | 'secondary';

export const TONE_HEX: Record<Tone, string> = {
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  accent: '#22d3ee',
  secondary: '#94a3b8',
};

export type NetworkAgentState =
  | 'running'
  | 'registered'
  | 'idle'
  | 'failed'
  | 'paused'
  | 'not_configured'
  | 'unknown';

export const NETWORK_AGENT_STATE_META: Record<NetworkAgentState, { label: string; tone: Tone }> = {
  running: { label: 'Running', tone: 'emerald' },
  registered: { label: 'Registered', tone: 'accent' },
  idle: { label: 'Idle', tone: 'secondary' },
  failed: { label: 'Failed', tone: 'red' },
  paused: { label: 'Paused', tone: 'amber' },
  not_configured: { label: 'Not configured', tone: 'secondary' },
  unknown: { label: 'Unknown', tone: 'secondary' },
};

/** Normalise the registry agent status onto the seven distinct network states.
 *  `working` → running; `active` → registered; `degraded` stays registered but
 *  is flagged so it can be tinted amber. Idle is never reported as offline. */
function agentState(a: AiAgentRow): NetworkAgentState {
  const s = (a.status ?? '').toLowerCase();
  if (s === 'working') return 'running';
  if (s === 'active') return 'registered';
  if (s === 'idle') return 'idle';
  if (s === 'error') return 'failed';
  if (s === 'degraded') return 'registered';
  if (s === 'paused') return 'paused';
  if (s === 'disabled' || s === 'not_configured' || s === '') return 'not_configured';
  return 'unknown';
}

// A "fresh" run is one whose latest activity is within this window. Runs are
// the ONLY source that may drive edge animation — never registry status.
const FRESH_RUN_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Model types
// ---------------------------------------------------------------------------

export interface NetworkAgent {
  /** Stable database id (ai_operations_agents.id) — used for relationships. */
  id: string;
  /** Stable application key (agent_key) — used for routing/detail links. */
  agentKey: string;
  name: string;
  category: string | null;
  categoryLabel: string;
  status: NetworkAgentState;
  statusLabel: string;
  tone: Tone;
  /** Health warning / degraded flag (tints running/registered amber). */
  degraded: boolean;
  /** Confirmed running-task summary (agent.current_task), never invented. */
  currentTask: string | null;
  /** Fresh working run exists → drives edge animation only. */
  hasLiveEvidence: boolean;
  isManager: boolean;
  /** Registry last-activity (updated_at) — never mislabelled heartbeat. */
  lastActivity: string | null;
}

export type AssignmentIssue = 'none' | 'no_manager' | 'multiple_managers';

export const ASSIGNMENT_ISSUE_LABEL: Record<AssignmentIssue, string> = {
  none: 'Assigned',
  no_manager: 'Manager not assigned',
  multiple_managers: 'Duplicate managers',
};

export interface NetworkSite {
  /** ai_sites.id (UUID). */
  id: string;
  /** ai_sites.site_key — the authoritative stable identity. */
  siteKey: string;
  /** ai_sites.hosting_provider — drives the host filter (never fabricated). */
  hostingProvider: string | null;
  /** Registered display name (saved widget name, falling back to site.name). */
  name: string;
  /** Registered initials (saved widget initials, falling back to derived). */
  initials: string;
  color: BrandColor;
  colorHex: string;
  /** Site-scoped orchestration-category agents (0, 1, or many). */
  managers: NetworkAgent[];
  /** Non-orchestration site agents (site membership only). */
  workers: NetworkAgent[];
  assignmentIssue: AssignmentIssue;
}

export interface NetworkCenter {
  orchestrator: GroupOrchestrator | null;
  oversight: OversightStatus;
  hal: HostStatus | null;
  sharedAgents: NetworkAgent[];
}

export interface GroupNetworkModel {
  center: NetworkCenter;
  sites: NetworkSite[];
  sourceState: 'live' | 'partial-live' | 'unavailable';
  /** Saved widget config is stale (retained last-good) — surfaced to the user. */
  configStale: boolean;
  registeredAgentCount: number;
  siteCount: number;
  unassignedCount: number;
  duplicateCount: number;
  /** Agents with fresh working-run evidence (drives animation only). */
  activelyRunningCount: number;
}

// ---------------------------------------------------------------------------
// Category label
// ---------------------------------------------------------------------------

function categoryLabel(category: string | null | undefined): string {
  const c = (category ?? '').trim();
  if (!c) return 'Other';
  const known: Record<string, string> = {
    orchestration: 'Orchestration',
    support: 'Support',
    diagnostics: 'Diagnostics',
    security: 'Security',
    monitoring: 'Monitoring',
    data: 'Data',
    uat: 'UAT',
    repair: 'Repair',
    communications: 'Communications',
    billing: 'Billing',
    crm: 'CRM / Leads',
    compliance: 'Compliance',
    operations: 'Operations',
    matching: 'Matching',
    planning: 'Planning',
    testing: 'Testing',
    development: 'Development',
    reporting: 'Reporting',
    infrastructure: 'Infrastructure',
    other: 'Other',
  };
  return known[c] ?? c.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Live run evidence
// ---------------------------------------------------------------------------

/** Agent ids with a fresh `working` run — the ONLY animation trigger. */
function buildActiveRunAgentIds(): Set<string> {
  const data = getGroupLiveData();
  const now = Date.now();
  const ids = new Set<string>();
  for (const run of data.runs) {
    if ((run.status ?? '').toLowerCase() !== 'working') continue;
    if (!run.agent_id) continue;
    const ts = run.updated_at ?? run.started_at ?? run.created_at;
    if (!ts) continue;
    const age = now - new Date(ts).getTime();
    if (Number.isNaN(age) || age < 0 || age > FRESH_RUN_MS) continue;
    ids.add(run.agent_id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function isOrchestration(a: AiAgentRow): boolean {
  return (a.category ?? '').toLowerCase() === 'orchestration';
}

function toNetworkAgent(a: AiAgentRow, activeRunIds: Set<string>, isManager: boolean): NetworkAgent {
  const status = agentState(a);
  const meta = NETWORK_AGENT_STATE_META[status];
  const degraded = (a.health ?? '').toLowerCase() === 'warning' || (a.status ?? '').toLowerCase() === 'degraded';
  return {
    id: a.id,
    agentKey: a.agent_key,
    name: a.name,
    category: a.category,
    categoryLabel: categoryLabel(a.category),
    status,
    statusLabel: meta.label,
    tone: degraded ? 'amber' : meta.tone,
    degraded,
    currentTask: a.current_task ?? null,
    hasLiveEvidence: activeRunIds.has(a.id),
    isManager,
    lastActivity: a.updated_at ?? null,
  };
}

/**
 * The complete Group Agent Network model. Sites come from the authoritative
 * Group Site Registry; identity (name/initials/colour) is enhanced from the
 * saved widget config when present. The centre is the group orchestrator
 * (never a site); every site gets exactly one manager position, showing
 * missing and duplicate managers honestly.
 */
export function getGroupNetworkModel(): GroupNetworkModel {
  const data = getGroupLiveData();
  const config = getWidgetConfigData();
  const activeRunIds = buildActiveRunAgentIds();

  const widgetBySiteId = new Map(config.widgets.map((w) => [w.site_id, w]));

  // The group orchestrator (centre) is the group-level orchestration agent.
  const group = getGroupOrchestrator();
  const groupAgentId = group
    ? data.agents.find((a) => a.agent_key === group.agentKey)?.id ?? null
    : null;

  // Shared/group agents = site_id null, and NOT the group orchestrator.
  const sharedAgents = data.agents
    .filter((a) => a.site_id == null && a.id !== groupAgentId)
    .map((a) => toNetworkAgent(a, activeRunIds, false));

  // One manager position per site in the Group Site Registry.
  const sites: NetworkSite[] = data.sites.map((site) => {
    const widget = widgetBySiteId.get(site.id);
    const siteAgents = data.agents.filter((a) => a.site_id === site.id);
    const managers = siteAgents.filter(isOrchestration).map((a) => toNetworkAgent(a, activeRunIds, true));
    const workers = siteAgents.filter((a) => !isOrchestration(a)).map((a) => toNetworkAgent(a, activeRunIds, false));

    const assignmentIssue: AssignmentIssue =
      managers.length === 0 ? 'no_manager' : managers.length > 1 ? 'multiple_managers' : 'none';

    const color = widget?.brand_color && BRAND_HEX[widget.brand_color as BrandColor]
      ? (widget.brand_color as BrandColor)
      : fallbackBrandColor(site.site_key);

    return {
      id: site.id,
      siteKey: site.site_key,
      hostingProvider: site.hosting_provider ?? null,
      name: widget?.display_name ?? site.name,
      initials: widget?.initials ?? deriveInitials(site.name),
      color,
      colorHex: BRAND_HEX[color],
      managers,
      workers,
      assignmentIssue,
    };
  });

  const allAgents = [
    ...sharedAgents,
    ...sites.flatMap((s) => [...s.managers, ...s.workers]),
  ];

  const sourceState: GroupNetworkModel['sourceState'] =
    data.mode === 'unavailable' ? 'unavailable' : data.mode === 'demo' ? 'partial-live' : 'partial-live';

  return {
    center: {
      orchestrator: group,
      oversight: getOversight(),
      hal: getHalHost(),
      sharedAgents,
    },
    sites,
    sourceState: data.loading ? 'unavailable' : sourceState,
    configStale: config.stale,
    registeredAgentCount: data.agents.length,
    siteCount: data.sites.length,
    unassignedCount: sites.filter((s) => s.assignmentIssue === 'no_manager').length,
    duplicateCount: sites.filter((s) => s.assignmentIssue === 'multiple_managers').length,
    activelyRunningCount: allAgents.filter((a) => a.hasLiveEvidence).length,
  };
}

// Re-export the orchestrator state label helper for the centre node.
export { MASTER_AGENT_STATE_META };
export type { GroupOrchestrator, MasterAgentState };