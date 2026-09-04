// ============================================================================
// AI Operations — Wallboard GitHub & Repository Health Selectors.
//
// Deterministic, read-only derivation over the GitHub snapshot and the
// deployment ledger (reused via getDeploymentData). NO writes, no GitHub
// mutations, no fabrication.
//
// "Active" = not archived AND not a fork (archived repos and forks are excluded
// from the primary list but still counted, so they are never silently dropped).
//
// The project ↔ repo relationship is derived ONLY from the authoritative
// deployment ledger (digital_footprint_deployments.github_repo). Where no
// deployment record exists, the relationship is reported as "not linked" —
// never guessed.
// ============================================================================

import { getGithubData, type GithubRepoRow } from '@/pages/ai-operations/wallboard/githubStore';
import { getDeploymentData, type DeploymentRow } from '@/pages/ai-operations/wallboard/deploymentStore';

// --- Types --------------------------------------------------------------------

export type GithubSourceState = 'live' | 'unavailable';

export interface RepoHealth {
  key: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  isPrivate: boolean;
  defaultBranch: string | null;
  lastActivity: string | null;
  updatedAt: string | null;
  // Deployment cross-reference (authoritative relationship only).
  hasDeployment: boolean;
  buildStatus: string | null;
  deploymentBranch: string | null;
  latestCommit: string | null;
  deployedAt: string | null;
}

export interface GithubSummary {
  sourceState: GithubSourceState;
  hasAnyRepos: boolean;
  totalRepos: number;
  activeRepos: number;
  archivedRepos: number;
  forkRepos: number;
  updatedToday: number;
  updatedThisWeek: number;
  buildFailures: number;
  deploymentLinked: number;
  privateCount: number;
  publicCount: number;
}

// --- Helpers ------------------------------------------------------------------

function isActive(repo: GithubRepoRow): boolean {
  return !repo.archived && !repo.fork;
}

function isWithinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 86_400_000;
}

/** Normalise a github_repo ledger value (name or URL) to a comparable repo name. */
function repoKeyFromGithubRepo(githubRepo: string | null): string | null {
  if (!githubRepo) return null;
  let s = githubRepo.trim();
  const m = s.match(/github\.com\/[^/]+\/([^/?#]+)/i);
  if (m) s = m[1];
  else {
    const parts = s.split('/');
    s = parts[parts.length - 1];
  }
  return s.replace(/\.git$/i, '').toLowerCase();
}

function shortHash(hash: string | null): string | null {
  if (!hash) return null;
  return hash.slice(0, 7);
}

function isFailedStatus(raw: string | null): boolean {
  if (!raw) return false;
  return /(fail|error|broken|rollback|revert|aborted)/i.test(raw);
}

function buildDeploymentLookup(): Map<string, DeploymentRow> {
  const data = getDeploymentData();
  const lookup = new Map<string, DeploymentRow>();
  for (const d of data.deployments ?? []) {
    const key = repoKeyFromGithubRepo(d.github_repo);
    if (key && !lookup.has(key)) lookup.set(key, d);
  }
  return lookup;
}

// --- Public selectors ---------------------------------------------------------

export function getGithubSummary(): GithubSummary {
  const data = getGithubData();
  const repos = data.repos ?? [];
  const active = repos.filter(isActive);

  const deploymentLookup = buildDeploymentLookup();

  let deploymentLinked = 0;
  let buildFailures = 0;
  for (const repo of active) {
    const nameKey = repo.name.toLowerCase();
    const dep = deploymentLookup.get(nameKey);
    if (dep) {
      deploymentLinked += 1;
      if (isFailedStatus(dep.build_status) || isFailedStatus(dep.deployment_status)) {
        buildFailures += 1;
      }
    }
  }

  return {
    sourceState: data.available ? 'live' : 'unavailable',
    hasAnyRepos: repos.length > 0,
    totalRepos: repos.length,
    activeRepos: active.length,
    archivedRepos: repos.filter((r) => r.archived).length,
    forkRepos: repos.filter((r) => r.fork).length,
    updatedToday: active.filter((r) => isWithinDays(r.pushed_at, 1)).length,
    updatedThisWeek: active.filter((r) => isWithinDays(r.pushed_at, 7)).length,
    buildFailures,
    deploymentLinked,
    privateCount: active.filter((r) => r.private).length,
    publicCount: active.filter((r) => !r.private).length,
  };
}

/** Active (non-archived, non-fork) repos, most-recently-pushed first. */
export function getActiveRepos(): RepoHealth[] {
  const data = getGithubData();
  const deploymentLookup = buildDeploymentLookup();

  return (data.repos ?? [])
    .filter(isActive)
    .map((r) => {
      const nameKey = r.name.toLowerCase();
      const dep = deploymentLookup.get(nameKey);
      return {
        key: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        htmlUrl: r.html_url,
        language: r.language,
        isPrivate: r.private,
        defaultBranch: r.default_branch,
        lastActivity: r.pushed_at,
        updatedAt: r.updated_at,
        hasDeployment: dep != null,
        buildStatus: dep?.build_status ?? null,
        deploymentBranch: dep?.branch ?? null,
        latestCommit: shortHash(dep?.latest_commit ?? null),
        deployedAt: dep?.deployed_at ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
}

/** Active repos with a recorded failed build/deploy in the deployment ledger. */
export function getBuildFailures(): RepoHealth[] {
  return getActiveRepos().filter(
    (r) => isFailedStatus(r.buildStatus) || (r.hasDeployment && isFailedStatus(r.buildStatus)),
  );
}

export function getArchivedRepoCount(): number {
  return (getGithubData().repos ?? []).filter((r) => r.archived).length;
}