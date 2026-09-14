// ============================================================================
// DFP COMMAND 15A — PROJECT PORTFOLIO CONTROL — PURE DERIVATION
// ============================================================================
// Read-time aggregation over existing project systems. Reuses the Project
// Command Centre helpers wherever possible (monitoring health, budget summary,
// bug/defect summarisation) so the portfolio never invents a second source of
// truth. Every value is honest: unavailable → Unknown, never a fabricated zero
// or a green state.
import type { Project } from './detail/types';
import type { ProjectIntegration } from './detail/infrastructureTypes';
import type { ProjectBuildRun } from './detail/buildUtils';
import type { ProjectDeployment } from './detail/deploymentTypes';
import { isActiveDeploymentStatus } from './detail/deploymentTypes';
import type { LaunchApproval } from './detail/launchTypes';
import type { MonitoringInputs } from './detail/monitoringUtils';
import { deriveProjectHealth } from './detail/monitoringUtils';
import { isActiveStatus, normalizeSeverity } from './detail/monitoringUtils';
import type { BudgetSummary } from './detail/budgetTypes';
import { configured } from './detail/infrastructureUtils';
import type { Bug } from './detail/types';
import { isUnresolvedDefect } from './detail/uatTypes';
import type { UatFeedback } from '@/pages/admin/website-uat/types';
import type { MonitoringIncident, MonitoringAlert } from './detail/monitoringTypes';
import type { SupportTicket } from '@/types/support-tickets';
import { formatRelative, formatDate } from './detail/utils';
import type {
  Indicator,
  BuildState,
  UatState,
  LaunchState,
  DeploymentState,
  BudgetState,
  HealthState,
  TargetLaunchState,
  AttentionReason,
  PortfolioProject,
  PortfolioSummary,
  LiveSummary,
  CommercialSummary,
  LaunchPipeline,
} from './portfolioTypes';

function titleCase(s: string): string {
  return s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const RESOLVED_BUG = new Set(['fixed', 'resolved', 'closed', 'wont_fix', 'duplicate']);
const OPEN_TICKET = new Set(['new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_staff']);

// ─── Build (§7) ─────────────────────────────────────────────────────────────

export function deriveBuildIndicator(
  run: ProjectBuildRun | null,
  sourceError: boolean,
): Indicator<BuildState> {
  if (sourceError) return { state: 'UNKNOWN', detail: 'Build data unavailable' };
  if (!run) return { state: 'NOT_STARTED', detail: 'No build checklist' };
  const blockers = run.launch_blockers_remaining;
  const pct = run.progress_percent;
  if (run.run_status === 'active') {
    if (blockers != null && blockers > 0) {
      return { state: 'BLOCKED', detail: `${blockers} blocker${blockers > 1 ? 's' : ''}` };
    }
    if (pct != null && pct >= 100) return { state: 'READY', detail: '100%' };
    return { state: 'IN_PROGRESS', detail: pct != null ? `${Math.round(pct)}%` : 'In progress' };
  }
  if (run.run_status === 'completed') {
    return { state: 'COMPLETE', detail: pct != null ? `${Math.round(pct)}%` : 'Complete' };
  }
  return { state: 'UNKNOWN', detail: titleCase(run.run_status) };
}

// ─── UAT (§8) ───────────────────────────────────────────────────────────────

export interface PortfolioUatInput {
  linked: boolean;
  approvalStatus: string | null;
  hasCritical: boolean;
  hasRun: boolean;
}

export function deriveUatIndicator(input: PortfolioUatInput, sourceError: boolean): Indicator<UatState> {
  if (sourceError) return { state: 'UNKNOWN', detail: 'UAT data unavailable' };
  const { linked, approvalStatus, hasCritical, hasRun } = input;
  if (!linked) return { state: 'NOT_CONFIGURED', detail: 'No linked UAT project' };
  if (approvalStatus === 'rejected') return { state: 'REJECTED', detail: 'Approval rejected' };
  if (hasCritical) return { state: 'BLOCKED', detail: 'Critical defect open' };
  if (approvalStatus === 'approved') return { state: 'APPROVED', detail: 'Approved' };
  if (approvalStatus === 'pending') return { state: 'AWAITING_APPROVAL', detail: 'Approval pending' };
  if (!hasRun) return { state: 'NOT_STARTED', detail: 'No test run' };
  return { state: 'IN_TESTING', detail: 'Tests in progress' };
}

// ─── Launch (§9) — derived from Launch Control approval + deployment only ───
// GO is NOT inferred here: a true GO requires the full command-centre gate
// evaluation, so this portfolio roll-up deliberately maps approved → awaiting
// deployment rather than claiming GO.

export function deriveLaunchIndicator(
  project: Project,
  approval: LaunchApproval | null,
  sourceError: boolean,
): Indicator<LaunchState> {
  if (project.status === 'live' || project.launched_at != null) {
    return { state: 'LIVE', detail: 'Launched' };
  }
  if (sourceError) return { state: 'NOT_EVALUATED', detail: 'Launch data unavailable' };
  if (!approval) return { state: 'NOT_EVALUATED', detail: 'No launch approval' };
  switch (approval.decision) {
    case 'APPROVED':
      return { state: 'AWAITING_DEPLOYMENT', detail: 'Approval granted' };
    case 'REJECTED':
      return { state: 'NO_GO', detail: 'Approval rejected' };
    case 'PENDING':
      return { state: 'PENDING', detail: 'Approval pending' };
    default:
      return { state: 'NOT_EVALUATED', detail: 'Not evaluated' };
  }
}

// ─── Deployment (§10) ───────────────────────────────────────────────────────

export function deriveDeploymentIndicator(
  deployments: ProjectDeployment[],
  sourceError: boolean,
): Indicator<DeploymentState> {
  if (sourceError) {
    return { state: 'NONE', detail: 'Deployment data unavailable' };
  }
  const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 8) : '');

  const accepted = deployments.find((d) => d.production_accepted);
  if (accepted) {
    return { state: 'RELEASE_ACCEPTED', detail: `SHA ${short(accepted.deployed_sha ?? accepted.github_sha)}` };
  }
  const active = deployments.find((d) => isActiveDeploymentStatus(d.status));
  if (active) {
    if (active.status === 'DEPLOYING') return { state: 'DEPLOYING', detail: `SHA ${short(active.github_sha)}` };
    if (active.status === 'DEPLOYED') {
      return { state: 'VERIFICATION_REQUIRED', detail: `SHA ${short(active.github_sha)}` };
    }
    return { state: 'VERIFYING', detail: `SHA ${short(active.github_sha)}` };
  }
  const verified = deployments.find((d) => d.status === 'VERIFIED');
  if (verified) {
    return { state: 'VERIFIED', detail: `SHA ${short(verified.deployed_sha ?? verified.github_sha)}` };
  }
  const rolling = deployments.find((d) => d.status === 'ROLLING_BACK');
  if (rolling) return { state: 'ROLLING_BACK', detail: `To SHA ${short(rolling.rollback_sha)}` };
  const rolledBack = deployments.find((d) => d.status === 'ROLLED_BACK');
  if (rolledBack) {
    return { state: 'ROLLED_BACK', detail: `SHA ${short(rolledBack.deployed_sha ?? rolledBack.github_sha)}` };
  }
  const rollbackReq = deployments.find((d) => d.status === 'ROLLBACK_REQUIRED');
  if (rollbackReq) return { state: 'ROLLBACK_REQUIRED', detail: 'Known-good restore needed' };
  const failed = deployments.find((d) => d.status === 'FAILED');
  if (failed) return { state: 'FAILED', detail: failed.failure_reason ?? 'Deployment failed' };
  return { state: 'NONE', detail: 'No deployment records' };
}

// ─── Budget (§11) ───────────────────────────────────────────────────────────

export function deriveBudgetIndicator(
  summary: BudgetSummary | null,
  sourceError: boolean,
): Indicator<BudgetState> {
  if (sourceError) return { state: 'UNKNOWN', detail: 'Budget data unavailable' };
  if (!summary || !summary.hasAnyBudget) return { state: 'NO_BUDGET', detail: 'No budget records' };
  const state = summary.status as BudgetState;
  const detail =
    summary.budgetUsedPct != null
      ? `${Math.round(summary.budgetUsedPct)}% used`
      : summary.launchCosts.blocked
        ? 'Launch cost unpaid'
        : 'Budget configured';
  return { state, detail };
}

// ─── Operational health (§6) — non-live projects are never "Healthy" ────────

export function deriveHealthIndicator(
  project: Project,
  monitoringInputs: MonitoringInputs,
  anyLoadFailed: boolean,
): Indicator<HealthState> {
  const isLive = project.status === 'live' || project.launched_at != null;
  if (!isLive) return { state: 'PRE_LAUNCH', detail: 'Not yet live' };

  const health = deriveProjectHealth({ ...monitoringInputs, anyLoadFailed });
  if (health === 'NOT CONFIGURED') {
    return { state: 'NOT_CONFIGURED', detail: 'Monitoring not configured' };
  }
  const activeAlerts = monitoringInputs.alerts.filter((a) => isActiveStatus(a.status)).length;
  const openIncidents = monitoringInputs.incidents.filter((i) => isActiveStatus(i.status)).length;
  const detail =
    activeAlerts > 0 || openIncidents > 0
      ? `${openIncidents} incident${openIncidents > 1 ? 's' : ''} · ${activeAlerts} alert${activeAlerts > 1 ? 's' : ''}`
      : health === 'HEALTHY'
        ? 'No open alerts'
        : 'State unknown';
  return { state: health as HealthState, detail };
}

// ─── Integration completeness (§23) — configuration only, NOT health ────────

export function portfolioIntegrationCompleteness(
  project: Project,
  integration: ProjectIntegration | null,
): { configured: number; total: number } {
  const checks: boolean[] = [
    configured(integration?.github_repository),
    configured(integration?.readdy_project_id),
    configured(integration?.supabase_project_ref),
    configured(integration?.production_provider) || configured(integration?.production_url) || configured(project.domain_live),
    configured(integration?.dns_provider) || configured(integration?.dns_zone),
    configured(integration?.monitoring_provider),
  ];
  if (project.is_ai_powered) checks.push(false); // AI site not project-scoped — honest "not configured"
  return { configured: checks.filter(Boolean).length, total: checks.length };
}

// ─── Critical issue count (§12) — distinct source buckets, minimal de-dupe ──

export function computeCriticalIssues(
  bugs: Bug[],
  uatDefects: UatFeedback[],
  incidents: MonitoringIncident[],
  alerts: MonitoringAlert[],
  supportTickets: SupportTicket[],
): number {
  const criticalBugs = bugs.filter(
    (b) => b.severity === 'critical' && !RESOLVED_BUG.has(b.status),
  ).length;
  // A defect already converted to a bug (internal_bug_id set) is not double counted.
  const criticalDefects = uatDefects.filter(
    (f) => isUnresolvedDefect(f) && (f.severity ?? '').toLowerCase() === 'critical' && f.internal_bug_id == null,
  ).length;
  const criticalIncidents = incidents.filter(
    (i) => isActiveStatus(i.status) && normalizeSeverity(i.severity) === 'CRITICAL',
  ).length;
  const criticalAlerts = alerts.filter(
    (a) => isActiveStatus(a.status) && normalizeSeverity(a.severity) === 'CRITICAL',
  ).length;
  const criticalTickets = supportTickets.filter(
    (t) => OPEN_TICKET.has(t.status) && (t.priority === 'critical' || t.priority === 'urgent'),
  ).length;
  return criticalBugs + criticalDefects + criticalIncidents + criticalAlerts + criticalTickets;
}

// ─── Needs attention (§13 / §14) ────────────────────────────────────────────

export function deriveAttentionReasons(pp: PortfolioProject): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const { health, deployment, launch, build, budget, criticalIssues, integrations, project } = pp;

  // 1. Production / critical operations
  if (health.state === 'OFFLINE') {
    reasons.push({ rank: 1, reason: 'Production offline', section: 'monitoring' });
  } else if (health.state === 'CRITICAL') {
    reasons.push({ rank: 1, reason: 'Critical operational state', section: 'monitoring' });
  }

  // 2. Failed deployment / rollback
  if (deployment.state === 'ROLLBACK_REQUIRED') {
    reasons.push({ rank: 2, reason: 'Rollback required', section: 'deployment' });
  } else if (deployment.state === 'ROLLING_BACK') {
    reasons.push({ rank: 2, reason: 'Rollback in progress', section: 'deployment' });
  } else if (deployment.state === 'FAILED') {
    reasons.push({ rank: 2, reason: 'Failed deployment', section: 'deployment' });
  }

  // 3. Launch hard blocker
  if (launch.state === 'NO_GO') {
    reasons.push({ rank: 3, reason: 'Launch hard blocker (NO-GO)', section: 'launch' });
  } else if (build.state === 'BLOCKED') {
    reasons.push({ rank: 3, reason: 'Build blocked', section: 'build' });
  }

  // 4. Critical defect / bug
  if (criticalIssues > 0) {
    reasons.push({ rank: 4, reason: `${criticalIssues} critical issue${criticalIssues > 1 ? 's' : ''}`, section: 'bugs' });
  }

  // 6. Commercial blocker
  if (budget.state === 'OVER_BUDGET') {
    reasons.push({ rank: 6, reason: 'Over budget', section: 'budget' });
  } else if (budget.state === 'AT_RISK') {
    reasons.push({ rank: 6, reason: 'Budget at risk', section: 'budget' });
  }

  // 7. Configuration / monitoring risk — only meaningful for projects that need infra
  if (!project.is_internal_tool && project.status !== 'idea') {
    const completeness = integrations;
    if (completeness.total > 0 && completeness.configured < Math.max(1, completeness.total - 2)) {
      reasons.push({ rank: 7, reason: 'Missing critical integration', section: 'infrastructure' });
    }
  }

  return reasons.sort((a, b) => a.rank - b.rank);
}

// ─── Target launch (§24) ────────────────────────────────────────────────────

export function deriveTargetLaunch(project: Project): TargetLaunchState {
  if (project.status === 'live' || project.launched_at != null) return 'FUTURE';
  if (!project.target_launch_date) return 'NONE';
  const t = new Date(project.target_launch_date).getTime();
  if (Number.isNaN(t)) return 'NONE';
  const days = (t - Date.now()) / 86400000;
  if (days < 0) return 'OVERDUE';
  if (days <= 7) return 'DUE_SOON';
  return 'FUTURE';
}

// ─── Stale detection (§26) — display-only, 30-day threshold ────────────────

export function isStaleProject(
  project: Project,
  lastActivityTs: string | null,
  thresholdDays = 30,
): boolean {
  if (project.status === 'live' || project.status === 'archived') return false;
  const ref = lastActivityTs ?? project.updated_at;
  if (!ref) return false;
  const t = new Date(ref).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > thresholdDays * 24 * 60 * 60 * 1000;
}

// ─── Last activity label (§25) ─────────────────────────────────────────────

export function describeLastActivity(
  ts: string | null,
  label: string | null,
): { timestamp: string; label: string } | null {
  if (!ts) return null;
  const rel = formatRelative(ts);
  return {
    timestamp: ts,
    label: label && label.trim() !== '' ? label : 'Updated',
  };
}

// ─── Portfolio roll-ups ─────────────────────────────────────────────────────

const LIFECYCLE_BUILDING = new Set(['building']);
const LIFECYCLE_TESTING = new Set(['testing']);

export function computePortfolioSummary(pps: PortfolioProject[]): PortfolioSummary {
  const total = pps.length;
  const active = pps.filter((p) => p.project.status !== 'archived');
  const building = active.filter((p) => LIFECYCLE_BUILDING.has(p.project.status)).length;
  const testing = active.filter((p) => LIFECYCLE_TESTING.has(p.project.status)).length;
  const live = active.filter((p) => p.project.status === 'live' || p.project.launched_at != null).length;
  const blockedAtRisk = active.filter((p) => p.attention.length > 0).length;
  const criticalOps = active.filter(
    (p) => p.health.state === 'CRITICAL' || p.health.state === 'OFFLINE',
  ).length;
  const launchReady = active.filter(
    (p) => p.launch.state === 'AWAITING_DEPLOYMENT' || p.deployment.state === 'VERIFIED',
  ).length;
  return { total, active: active.length, building, testing, live, blockedAtRisk, criticalOps, launchReady };
}

export function computeLiveSummary(pps: PortfolioProject[]): LiveSummary {
  const live = pps.filter((p) => p.project.status === 'live' || p.project.launched_at != null);
  return {
    live: live.length,
    healthy: live.filter((p) => p.health.state === 'HEALTHY').length,
    degraded: live.filter((p) => p.health.state === 'DEGRADED').length,
    critical: live.filter((p) => p.health.state === 'CRITICAL').length,
    offline: live.filter((p) => p.health.state === 'OFFLINE').length,
    unknown: live.filter(
      (p) => p.health.state === 'UNKNOWN' || p.health.state === 'NOT_CONFIGURED',
    ).length,
  };
}

export function computeCommercialSummary(pps: PortfolioProject[]): CommercialSummary {
  const active = pps.filter((p) => p.project.status !== 'archived');
  let revenue = 0;
  let cost = 0;
  let projectsOverBudget = 0;
  let commercialLaunchBlockers = 0;
  let coverageIncomplete = false;

  for (const p of active) {
    const pr = p.project;
    if (pr.is_internal_tool) continue; // internal tools have no commercial revenue by design
    if (pr.monthly_revenue <= 0 && pr.monthly_costs <= 0) {
      coverageIncomplete = true; // financial data not configured
      continue;
    }
    revenue += pr.monthly_revenue || 0;
    cost += pr.monthly_costs || 0;
    if (p.budget.state === 'OVER_BUDGET') projectsOverBudget += 1;
    if (p.budget.state === 'OVER_BUDGET' || p.budget.state === 'AT_RISK') commercialLaunchBlockers += 1;
  }

  return {
    configuredMonthlyRevenue: revenue,
    monthlyOperatingCost: cost,
    monthlyMargin: revenue - cost,
    projectsOverBudget,
    commercialLaunchBlockers,
    coverageIncomplete,
  };
}

export function computeLaunchPipeline(pps: PortfolioProject[]): LaunchPipeline {
  const active = pps.filter((p) => p.project.status !== 'archived');
  const building = active.filter((p) => p.project.status === 'building').length;
  const uat = active.filter((p) => p.uat.state === 'IN_TESTING' || p.uat.state === 'AWAITING_APPROVAL').length;
  const noGo = active.filter((p) => p.launch.state === 'NO_GO').length;
  const pendingApproval = active.filter((p) => p.launch.state === 'PENDING').length;
  const awaitingDeployment = active.filter((p) => p.launch.state === 'AWAITING_DEPLOYMENT').length;
  const deploying = active.filter((p) => p.deployment.state === 'DEPLOYING' || p.deployment.state === 'ROLLING_BACK').length;
  const verificationRequired = active.filter((p) => p.deployment.state === 'VERIFICATION_REQUIRED' || p.deployment.state === 'VERIFYING').length;
  return { building, uat, noGo, pendingApproval, awaitingDeployment, deploying, verificationRequired };
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function formatDateLabel(dateStr: string): string {
  return formatDate(dateStr);
}

export function formatMoney(value: number): string {
  return `£${value.toLocaleString()}`;
}