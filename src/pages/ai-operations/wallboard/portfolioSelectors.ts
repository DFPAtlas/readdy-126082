// ============================================================================
// AI Operations — Wallboard Project Portfolio Selectors.
//
// Deterministic, read-only derivation over the portfolio snapshot + the shared
// Group Site Registry (live site health). NO writes, no stage mutation, no
// launch changes. This layer only classifies, joins and counts what the store
// already loaded.
//
// STAGE MAPPING — reuses the authoritative `internal_projects.status` values
// (idea / building / live) rather than inventing a new workflow enum. Launch
// readiness reuses the existing build-process rule (completed vs total items),
// and blockers come from `launch_blockers_remaining`.
// ============================================================================

import { getPortfolioData, type PortfolioProjectRow, type PortfolioBuildRunRow, type PortfolioUatRow } from '@/pages/ai-operations/wallboard/portfolioStore';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

// --- Types --------------------------------------------------------------------

export type PortfolioStage = 'idea' | 'design' | 'build' | 'test' | 'uat' | 'blocked' | 'ready' | 'live' | 'maintenance' | 'unknown';

export type LaunchReadiness = 'ready' | 'conditional' | 'not_ready' | 'unknown';

export type UatState = 'testing' | 'approved' | 'completed' | 'unknown';

export type SourceState = 'live' | 'partial' | 'unavailable';

export interface PortfolioProject {
  key: string;
  id: number;
  name: string;
  slug: string;
  stage: PortfolioStage;
  priority: string | null;
  owner: string | null;
  targetLaunchDate: string | null;
  launchedAt: string | null;
  isClientBuild: boolean;
  isInternalTool: boolean;
  /** Build-checklist state (null when no build run exists). */
  buildRunName: string | null;
  buildRunId: number | null;
  launchBlockers: number | null;
  completedItems: number | null;
  totalItems: number | null;
  lastBuildUpdate: string | null;
  launchReadiness: LaunchReadiness;
  /** UAT state (null when no matching UAT project exists). */
  uatState: UatState | null;
  uatName: string | null;
  /** Live site health from the Group Site Registry (null when no site). */
  liveSiteStatus: 'online' | 'degraded' | 'offline' | 'maintenance' | 'unknown' | null;
  /** True when this project has launch blockers remaining (visually blocked). */
  isBlocked: boolean;
}

export interface PortfolioSummary {
  sourceState: SourceState;
  hasAnyData: boolean;
  activeProjects: number;
  inBuild: number;
  inUat: number;
  blocked: number;
  ready: number;
  live: number;
}

// --- Stage mapping (authoritative `internal_projects.status`) -----------------

function mapStage(status: string | null | undefined): PortfolioStage {
  switch ((status ?? '').toLowerCase().trim()) {
    case 'idea':
    case 'conception':
      return 'idea';
    case 'design':
      return 'design';
    case 'building':
    case 'build':
    case 'in_progress':
    case 'development':
      return 'build';
    case 'testing':
    case 'test':
      return 'test';
    case 'maintenance':
      return 'maintenance';
    case 'live':
    case 'launched':
      return 'live';
    default:
      return 'unknown';
  }
}

// --- Launch readiness (reuses the existing build-process completion rule) -----
//
// Mirrors the build-process `READINESS_VERDICT` thresholds (>=90 ready,
// 70–89 conditional, <70 not ready). No readiness is invented when a project
// has no build checklist — it is honestly reported as UNKNOWN.

function mapLaunchReadiness(run: PortfolioBuildRunRow | null): LaunchReadiness {
  if (!run) return 'unknown';
  const total = run.total_items ?? 0;
  const completed = run.completed_items ?? 0;
  if (total <= 0) return 'unknown';
  const pct = Math.round((completed / total) * 100);
  if (pct >= 90) return 'ready';
  if (pct >= 70) return 'conditional';
  return 'not_ready';
}

// --- UAT matching (fuzzy, slug-based; never invents a UAT link) ---------------

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchUat(project: PortfolioProjectRow, uat: PortfolioUatRow[]): PortfolioUatRow | null {
  const projName = normalizeToken(project.project_name);
  const projSlug = normalizeToken(project.project_slug);
  if (!projName && !projSlug) return null;

  for (const u of uat) {
    const uName = normalizeToken(u.name);
    if (!uName) continue;
    // A UAT project matches when its normalised name contains the project name
    // or slug (and the UAT name is not a tiny generic fragment).
    if (projName && uName.includes(projName)) return u;
    if (projSlug && uName.includes(projSlug)) return u;
  }
  return null;
}

function mapUatState(uat: PortfolioUatRow | null): UatState | null {
  if (!uat) return null;
  const s = (uat.status ?? '').toLowerCase().trim();
  if (uat.approval_date) return 'approved';
  if (s === 'completed' || s === 'approved' || s === 'done') return 'approved';
  if (uat.completion_date) return 'completed';
  if (s === 'active' || s === 'in_progress' || s === 'testing') return 'testing';
  return 'unknown';
}

// --- Live site health (reused from the Group Site Registry) -------------------

function normalizeSiteStatus(status: string | null | undefined): PortfolioProject['liveSiteStatus'] {
  switch ((status ?? '').toLowerCase().trim()) {
    case 'healthy':
    case 'active':
      return 'online';
    case 'warning':
    case 'partial':
      return 'degraded';
    case 'critical':
    case 'offline':
    case 'down':
      return 'offline';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'unknown';
  }
}

// --- Public selectors ---------------------------------------------------------

export function getPortfolioSummary(): PortfolioSummary {
  const data = getPortfolioData();
  const projects = getPortfolioProjects();

  const anyReadable = data.projectsAvailability || data.buildRunsAvailability || data.uatAvailability;
  const allReadable = data.projectsAvailability && data.buildRunsAvailability && data.uatAvailability;

  let sourceState: SourceState = 'unavailable';
  if (allReadable) sourceState = 'live';
  else if (anyReadable) sourceState = 'partial';

  return {
    sourceState,
    hasAnyData: projects.length > 0,
    activeProjects: projects.length,
    inBuild: projects.filter((p) => p.stage === 'build').length,
    inUat: projects.filter((p) => p.uatState != null).length,
    blocked: projects.filter((p) => p.isBlocked).length,
    ready: projects.filter((p) => p.launchReadiness === 'ready').length,
    live: projects.filter((p) => p.stage === 'live').length,
  };
}

/**
 * The authoritative active project list (internal_projects), enriched with the
 * build checklist (launch blockers / readiness), the existing UAT system, and
 * the Group Site Registry (live site health). Priority-ordered for the wall:
 * BLOCKED → READY TO LAUNCH → UAT → BUILD → other active states.
 */
export function getPortfolioProjects(): PortfolioProject[] {
  const data = getPortfolioData();
  const live = getGroupLiveData();

  // Live site health keyed by normalised slug from the Group Site Registry.
  const siteBySlug = new Map<string, { status: string | null }>();
  for (const s of live.sites) {
    const key = normalizeToken(s.site_key) || normalizeToken(s.name);
    if (key) siteBySlug.set(key, { status: s.operational_status });
  }

  const items: PortfolioProject[] = data.projects.map((p) => {
    const run = data.buildRuns.find((r) => r.project_id === p.id) ?? null;
    const uat = matchUat(p, data.uatProjects);
    const launchBlockers = run?.launch_blockers_remaining ?? null;
    const isBlocked = launchBlockers != null && launchBlockers > 0;
    const readiness = mapLaunchReadiness(run);
    const uatState = mapUatState(uat);

    const siteKey = normalizeToken(p.project_slug) || normalizeToken(p.project_name);
    const site = siteKey ? siteBySlug.get(siteKey) : undefined;
    const liveSiteStatus = site ? normalizeSiteStatus(site.status) : null;

    return {
      key: `project-${p.id}`,
      id: p.id,
      name: p.project_name ?? 'Unnamed project',
      slug: p.project_slug ?? '',
      stage: mapStage(p.status),
      priority: p.priority,
      owner: p.owner,
      targetLaunchDate: p.target_launch_date,
      launchedAt: p.launched_at,
      isClientBuild: p.is_client_build,
      isInternalTool: p.is_internal_tool,
      buildRunName: run?.run_name ?? null,
      buildRunId: run?.id ?? null,
      launchBlockers,
      completedItems: run?.completed_items ?? null,
      totalItems: run?.total_items ?? null,
      lastBuildUpdate: run?.updated_at ?? null,
      launchReadiness: readiness,
      uatState,
      uatName: uat?.name ?? null,
      liveSiteStatus,
      isBlocked,
    };
  });

  // Priority order: BLOCKED → READY TO LAUNCH → UAT → BUILD → other active.
  const rank = (p: PortfolioProject): number => {
    if (p.isBlocked) return 0;
    if (p.launchReadiness === 'ready') return 1;
    if (p.uatState != null) return 2;
    if (p.stage === 'build') return 3;
    if (p.stage === 'live') return 4;
    if (p.stage === 'idea') return 5;
    return 6;
  };

  return items.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    // Within equal rank, higher priority first, then name.
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const pa = priorityOrder[(a.priority ?? '').toLowerCase()] ?? 3;
    const pb = priorityOrder[(b.priority ?? '').toLowerCase()] ?? 3;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

/** Blocked projects only, most-blocked first. */
export function getBlockedProjects(): PortfolioProject[] {
  return getPortfolioProjects()
    .filter((p) => p.isBlocked)
    .sort((a, b) => (b.launchBlockers ?? 0) - (a.launchBlockers ?? 0));
}

export { normalizeSiteStatus };