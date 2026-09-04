// ============================================================================
// AI Operations — Wallboard Deployments & Releases Selectors.
//
// Deterministic, read-only derivation over the deployment/release snapshots.
// NO writes, no deploy triggers, no rollback controls. This layer only
// classifies and counts what the store already loaded.
//
// Environment is differentiated conservatively — an unrecognised branch is
// NEVER assumed to be production, so a failed test deployment can never be
// misread as a production outage.
// ============================================================================

import { getDeploymentData, type DeploymentRow, type ReleaseRow } from '@/pages/ai-operations/wallboard/deploymentStore';
import { getInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';

// --- Types --------------------------------------------------------------------

export type DeployEnvironment = 'production' | 'staging' | 'development' | 'test' | 'unknown';

export type DeployState = 'success' | 'failed' | 'running' | 'pending' | 'unknown';

export type SourceState = 'live' | 'partial' | 'unavailable';

export interface DeploymentViewItem {
  key: string;
  projectLabel: string;
  environment: DeployEnvironment;
  branch: string | null;
  commit: string | null;
  state: DeployState;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  provider: string;
}

export interface ReleaseViewItem {
  key: string;
  version: string | null;
  environment: DeployEnvironment;
  state: DeployState;
  releasedAt: string | null;
  gitRef: string | null;
  owner: string | null;
  summary: string | null;
  previousStable: string | null;
  rollbackNote: string | null;
}

export interface DeploymentSummary {
  sourceState: SourceState;
  hasAnyData: boolean;
  deploymentsTotal: number;
  deploymentsToday: number;
  successful: number;
  failed: number;
  running: number;
  productionFailed: number;
  productionRunning: number;
  releasesTotal: number;
  /** dfp_service_health "deployment" service status (live signal). */
  liveServiceStatus: string | null;
  liveServiceCheckedAt: string | null;
}

// --- Status classification ----------------------------------------------------

function classifyStatus(raw: string | null, hasCompletionTimestamp: boolean): DeployState {
  const s = (raw ?? '').toLowerCase().trim();
  if (/(fail|error|broken|rollback|revert|aborted)/.test(s)) return 'failed';
  if (/(running|deploying|in_progress|progress|building)/.test(s)) return 'running';
  if (/(pending|queued|waiting|scheduled|created)/.test(s)) return 'pending';
  if (/(success|deployed|complete|live|healthy|ok|active|passed)/.test(s)) return 'success';
  // No recognisable status: a completed deploy timestamp implies it finished.
  if (hasCompletionTimestamp) return 'success';
  return 'unknown';
}

// --- Environment inference (conservative — never fabricate production) --------

export function inferEnvironment(branch: string | null): DeployEnvironment {
  const b = (branch ?? '').toLowerCase().trim();
  if (!b) return 'unknown';
  if (/(^|[/_-])(main|master|prod|production)([/_-]|$)/.test(b)) return 'production';
  if (/staging|stage/.test(b)) return 'staging';
  if (/develop|dev([/_]|$)/.test(b)) return 'development';
  if (/test|uat|qa/.test(b)) return 'test';
  return 'unknown';
}

// --- Helpers ------------------------------------------------------------------

const ENV_ORDER: DeployEnvironment[] = ['production', 'staging', 'development', 'test', 'unknown'];

function sortByTimeDesc(a: { time: string | null }, b: { time: string | null }): number {
  const ta = a.time ? new Date(a.time).getTime() : 0;
  const tb = b.time ? new Date(b.time).getTime() : 0;
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return tb - ta;
}

function shortHash(hash: string | null): string | null {
  if (!hash) return null;
  return hash.slice(0, 7);
}

function commitLabel(commit: string | null): string | null {
  return shortHash(commit);
}

function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 60000);
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// --- Live signal (reused from infrastructure store, not re-fetched) -----------

function getLiveDeploymentService(): { status: string | null; checkedAt: string | null } {
  const infra = getInfrastructureData();
  const svc = infra.services.find((s) => s.service === 'deployment');
  return { status: svc?.status ?? null, checkedAt: svc?.checked_at ?? null };
}

// --- Public selectors ---------------------------------------------------------

export function getDeploymentSummary(): DeploymentSummary {
  const data = getDeploymentData();
  const { status: liveStatus, checkedAt: liveCheckedAt } = getLiveDeploymentService();

  const deployments = data.deployments ?? [];
  const releases = data.releases ?? [];

  const classified = deployments.map((d) => classifyStatus(d.deployment_status, d.deployed_at != null));

  const successful = classified.filter((s) => s === 'success').length;
  const failed = classified.filter((s) => s === 'failed').length;
  const running = classified.filter((s) => s === 'running').length;
  const deploymentsToday = deployments.filter((d) => isToday(d.deployed_at) || isToday(d.created_at)).length;

  // Production = branch resolves to production OR (no branch + a deploy exists,
  // i.e. the live site default). Failed/running production counts feed failure
  // state and running display — never inferred from unrelated environments.
  const productionFailed = deployments.filter((d, i) => {
    if (classified[i] !== 'failed') return false;
    const env = inferEnvironment(d.branch);
    return env === 'production';
  }).length;
  const productionRunning = deployments.filter((d, i) => {
    if (classified[i] !== 'running') return false;
    const env = inferEnvironment(d.branch);
    return env === 'production';
  }).length;

  const bothReadable = data.deploymentsAvailability && data.releasesAvailability;
  const anyReadable = data.deploymentsAvailability || data.releasesAvailability;

  let sourceState: SourceState = 'unavailable';
  if (bothReadable) sourceState = 'live';
  else if (anyReadable) sourceState = 'partial';

  return {
    sourceState,
    hasAnyData: deployments.length > 0 || releases.length > 0,
    deploymentsTotal: deployments.length,
    deploymentsToday,
    successful,
    failed,
    running,
    productionFailed,
    productionRunning,
    releasesTotal: releases.length,
    liveServiceStatus: liveStatus,
    liveServiceCheckedAt: liveCheckedAt,
  };
}

export function getDeploymentFeed(): DeploymentViewItem[] {
  const data = getDeploymentData();
  return (data.deployments ?? []).map((d) => ({
    key: d.id,
    projectLabel: d.github_repo ?? 'Unnamed project',
    environment: inferEnvironment(d.branch),
    branch: d.branch,
    commit: commitLabel(d.latest_commit),
    state: classifyStatus(d.deployment_status, d.deployed_at != null),
    startedAt: d.created_at,
    completedAt: d.deployed_at,
    durationMinutes: minutesBetween(d.created_at, d.deployed_at),
    provider: 'GitHub / Readdy deploy',
  }));
}

export function getRecentReleases(): ReleaseViewItem[] {
  const data = getDeploymentData();
  return (data.releases ?? [])
    .map((r: ReleaseRow) => ({
      key: r.id,
      version: r.version,
      environment: 'production' as DeployEnvironment,
      state: classifyStatus(r.status, r.release_date != null),
      releasedAt: r.release_date ?? r.created_at,
      gitRef: shortHash(r.git_ref),
      owner: r.release_owner,
      summary: r.summary,
      previousStable: r.version ? (r.previous_stable_version ?? null) : null,
      rollbackNote: r.rollback_notes,
    }))
    .sort((a, b) => sortByTimeDesc({ time: a.releasedAt }, { time: b.releasedAt }));
}

export interface EnvironmentCount {
  environment: DeployEnvironment;
  total: number;
  success: number;
  failed: number;
  running: number;
}

export function getEnvironmentBreakdown(): EnvironmentCount[] {
  const data = getDeploymentData();
  const counts = new Map<DeployEnvironment, EnvironmentCount>();
  for (const env of ENV_ORDER) {
    counts.set(env, { environment: env, total: 0, success: 0, failed: 0, running: 0 });
  }
  for (const d of data.deployments ?? []) {
    const env = inferEnvironment(d.branch);
    const bucket = counts.get(env) ?? { environment: env, total: 0, success: 0, failed: 0, running: 0 };
    bucket.total += 1;
    const state = classifyStatus(d.deployment_status, d.deployed_at != null);
    if (state === 'success') bucket.success += 1;
    else if (state === 'failed') bucket.failed += 1;
    else if (state === 'running') bucket.running += 1;
  }
  return ENV_ORDER.map((env) => counts.get(env)!).filter((c) => c.total > 0);
}

export function getProductionFailures(): DeploymentViewItem[] {
  return getDeploymentFeed().filter((d) => d.environment === 'production' && d.state === 'failed');
}

export function getRunningDeployments(): DeploymentViewItem[] {
  return getDeploymentFeed().filter((d) => d.state === 'running');
}

export { commitLabel };