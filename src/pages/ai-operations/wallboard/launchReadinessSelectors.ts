// ============================================================================
// AI Operations — Wallboard Group Launch Readiness Selectors.
//
// Deterministic, read-only derivation over the EXISTING project / build / UAT
// data (reused from portfolioSelectors) plus the build-checklist items
// (launchReadinessStore) and deployment ledger (deploymentStore). NO writes,
// no launch changes, no new checklist. This layer only classifies, joins and
// counts what the stores already loaded.
//
// READINESS STATE — maps the existing `internal_projects.status` (idea /
// building / live), the build-process completion rule, launch blockers and the
// existing UAT system into ONE wallboard-facing state:
//   BUILDING / TESTING / BLOCKED / NOT READY / CONDITIONAL / READY / LIVE.
// A project already `live` in the registry is never shown as awaiting launch.
//
// No readiness percentage is invented — only the documented build-process
// completion rule (completed vs total items) is reused, and mandatory-check
// completion is shown as an honest "X / Y" count, never as a fabricated score.
// ============================================================================

import {
  getPortfolioProjects,
  type PortfolioProject,
} from '@/pages/ai-operations/wallboard/portfolioSelectors';
import { getPortfolioData } from '@/pages/ai-operations/wallboard/portfolioStore';
import { getLaunchReadinessData, type LaunchReadinessItemRow } from '@/pages/ai-operations/wallboard/launchReadinessStore';
import { getDeploymentData } from '@/pages/ai-operations/wallboard/deploymentStore';

// --- Types -------------------------------------------------------------------

export type LaunchState =
  | 'building'
  | 'testing'
  | 'blocked'
  | 'not_ready'
  | 'conditional'
  | 'ready'
  | 'live'
  | 'unknown';

export type BlockerCategory = 'uat' | 'payment' | 'legal' | 'security' | 'deployment' | 'configuration';

export type SourceState = 'live' | 'partial' | 'unavailable';

export interface BlockerBreakdown {
  category: BlockerCategory;
  count: number;
}

export interface LaunchReadinessProject {
  key: string;
  id: number;
  name: string;
  slug: string;
  owner: string | null;
  isClientBuild: boolean;
  isInternalTool: boolean;
  state: LaunchState;
  stage: PortfolioProject['stage'];
  launchReadiness: PortfolioProject['launchReadiness'];
  /** Mandatory checks done / total (null when no checklist exists). */
  mandatoryDone: number | null;
  mandatoryTotal: number | null;
  /** Open launch-blocker count (authoritative run value). */
  blockerCount: number | null;
  blockerBreakdown: BlockerBreakdown[];
  uatState: PortfolioProject['uatState'];
  liveSiteStatus: PortfolioProject['liveSiteStatus'];
  targetLaunchDate: string | null;
  launchedAt: string | null;
  lastBuildUpdate: string | null;
}

export interface LaunchReadinessSummary {
  sourceState: SourceState;
  hasAnyData: boolean;
  activeProducts: number;
  ready: number;
  conditional: number;
  blocked: number;
  live: number;
  building: number;
  testing: number;
  notReady: number;
  hasDeploymentData: boolean;
}

// --- Blocker category mapping (from authoritative checklist stage/title) -----

function mapBlockerCategory(stageTitle: string | null, itemTitle: string | null): BlockerCategory {
  const s = (stageTitle ?? '').toLowerCase();
  const t = (itemTitle ?? '').toLowerCase();
  // Item-level strong signals first (most specific).
  if (/legal|terms of use|privacy|cookie|refund|policy/.test(t)) return 'legal';
  if (/stripe|checkout|payment|pricing|price|webhook/.test(t)) return 'payment';
  if (/uat|test|testing|alpha|beta|approval/.test(t)) return 'uat';
  if (/dns|domain|deploy|environment variable|production database/.test(t)) return 'deployment';
  if (/security|auth|login|password|signup/.test(t)) return 'security';
  if (/monitor|email|logging|error/.test(t)) return 'configuration';
  // Stage-level fallback.
  if (s.includes('legal')) return 'legal';
  if (s.includes('payment')) return 'payment';
  if (s.includes('uat') || s.includes('testing') || s.includes('test') || s.includes('launch plan')) return 'uat';
  if (s.includes('deployment')) return 'deployment';
  return 'configuration';
}

// --- Readiness state resolution ----------------------------------------------

function resolveLaunchState(p: PortfolioProject): LaunchState {
  if (p.stage === 'live') return 'live';
  if (p.isBlocked) return 'blocked';
  if (p.launchReadiness === 'ready') return 'ready';
  if (p.launchReadiness === 'conditional') return 'conditional';
  if (p.uatState != null || p.stage === 'test') return 'testing';
  if (p.launchReadiness === 'not_ready') return 'not_ready';
  if (p.stage === 'build' || p.stage === 'idea' || p.stage === 'design') return 'building';
  return 'unknown';
}

// --- Helpers ------------------------------------------------------------------

function aggregateBlockers(items: LaunchReadinessItemRow[]): BlockerBreakdown[] {
  const counts = new Map<BlockerCategory, number>();
  for (const item of items) {
    if (!item.is_launch_blocker || item.checked) continue;
    const category = mapBlockerCategory(item.stage_title, item.item_title);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const order: BlockerCategory[] = ['uat', 'payment', 'legal', 'security', 'deployment', 'configuration'];
  return order
    .map((category) => ({ category, count: counts.get(category) ?? 0 }))
    .filter((b) => b.count > 0);
}

const STATE_RANK: Record<LaunchState, number> = {
  blocked: 0,
  ready: 1,
  conditional: 2,
  testing: 3,
  not_ready: 4,
  building: 5,
  live: 6,
  unknown: 7,
};

// --- Public selectors ---------------------------------------------------------

export function getLaunchReadinessSummary(): LaunchReadinessSummary {
  const projects = getLaunchReadinessProjects();
  const portfolio = getPortfolioData();
  const items = getLaunchReadinessData();
  const deployment = getDeploymentData();

  const anyReadable =
    portfolio.projectsAvailability ||
    portfolio.buildRunsAvailability ||
    portfolio.uatAvailability ||
    items.itemsAvailability;
  const allReadable =
    portfolio.projectsAvailability &&
    portfolio.buildRunsAvailability &&
    portfolio.uatAvailability &&
    items.itemsAvailability;

  let sourceState: SourceState = 'unavailable';
  if (allReadable) sourceState = 'live';
  else if (anyReadable) sourceState = 'partial';

  return {
    sourceState,
    hasAnyData: projects.length > 0,
    activeProducts: projects.length,
    ready: projects.filter((p) => p.state === 'ready').length,
    conditional: projects.filter((p) => p.state === 'conditional').length,
    blocked: projects.filter((p) => p.state === 'blocked').length,
    live: projects.filter((p) => p.state === 'live').length,
    building: projects.filter((p) => p.state === 'building').length,
    testing: projects.filter((p) => p.state === 'testing').length,
    notReady: projects.filter((p) => p.state === 'not_ready').length,
    hasDeploymentData:
      (deployment.deployments?.length ?? 0) > 0 || (deployment.releases?.length ?? 0) > 0,
  };
}

/**
 * The authoritative active project list, enriched with launch-readiness state
 * (state, mandatory checks, blocker categories), reusing the portfolio's
 * project / UAT / site-health joins. Priority-ordered for the wall:
 * BLOCKED → READY → CONDITIONAL → TESTING → NOT READY → BUILDING → LIVE.
 */
export function getLaunchReadinessProjects(): LaunchReadinessProject[] {
  const portfolioProjects = getPortfolioProjects();
  const items = getLaunchReadinessData();

  const itemsByRun = new Map<number, LaunchReadinessItemRow[]>();
  for (const item of items.items) {
    const list = itemsByRun.get(item.run_id) ?? [];
    list.push(item);
    itemsByRun.set(item.run_id, list);
  }

  const result: LaunchReadinessProject[] = portfolioProjects.map((p) => {
    const runItems = p.buildRunId != null ? itemsByRun.get(p.buildRunId) ?? [] : [];
    const mandatory = runItems.filter((i) => i.is_required);
    const mandatoryDone = mandatory.filter((i) => i.checked).length;
    const mandatoryTotal = mandatory.length;

    return {
      key: p.key,
      id: p.id,
      name: p.name,
      slug: p.slug,
      owner: p.owner,
      isClientBuild: p.isClientBuild,
      isInternalTool: p.isInternalTool,
      state: resolveLaunchState(p),
      stage: p.stage,
      launchReadiness: p.launchReadiness,
      mandatoryDone: mandatoryTotal > 0 ? mandatoryDone : null,
      mandatoryTotal: mandatoryTotal > 0 ? mandatoryTotal : null,
      blockerCount: p.launchBlockers,
      blockerBreakdown: aggregateBlockers(runItems),
      uatState: p.uatState,
      liveSiteStatus: p.liveSiteStatus,
      targetLaunchDate: p.targetLaunchDate,
      launchedAt: p.launchedAt,
      lastBuildUpdate: p.lastBuildUpdate,
    };
  });

  return result.sort((a, b) => {
    const r = STATE_RANK[a.state] - STATE_RANK[b.state];
    if (r !== 0) return r;
    const ba = a.blockerCount ?? 0;
    const bb = b.blockerCount ?? 0;
    if (ba !== bb) return bb - ba;
    return a.name.localeCompare(b.name);
  });
}

export { resolveLaunchState };