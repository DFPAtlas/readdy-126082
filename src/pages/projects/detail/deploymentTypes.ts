// ============================================================================
// DFP COMMAND 13A — PROJECT DEPLOYMENT CONTROL — TYPES + ELIGIBILITY
// ============================================================================
// Deployment Control is an AGGREGATOR + RECORD KEEPER. It evaluates whether a
// project is eligible to deploy by reading existing state (Launch Approval,
// Infrastructure, UAT, Bugs, Budget, Monitoring, AI) and tracks the deployment
// workflow in internal_project_deployments.
//
// Core safety principle: a deployment is LOCKED to a valid APPROVED launch
// approval AND an approved GitHub SHA. Never deploy a newer HEAD, never mark
// VERIFIED from here (that's Command 13B), never touch internal_projects.status,
// never run an actual deployment action.
//
// "No fake green": configured ≠ healthy, no SHA ≠ deployable, unverifiable
// drift ≠ safe. A mandatory source that cannot be evaluated blocks deployment.
import type { Project } from './types';
import type { ProjectIntegration } from './infrastructureTypes';
import type { LaunchApproval } from './launchTypes';
import type { LaunchEvaluation } from './launchTypes';

// ─── Deployment record ──────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'PLANNED'
  | 'READY'
  | 'BLOCKED'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLBACK_REQUIRED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK';

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  PLANNED: 'Planned',
  READY: 'Ready',
  BLOCKED: 'Blocked',
  DEPLOYING: 'Deploying',
  DEPLOYED: 'Deployed',
  VERIFYING: 'Verifying',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  ROLLBACK_REQUIRED: 'Rollback Required',
  ROLLING_BACK: 'Rolling Back',
  ROLLED_BACK: 'Rolled Back',
};

export const DEPLOYMENT_STATUS_STYLES: Record<DeploymentStatus, string> = {
  PLANNED: 'bg-foreground-500/10 text-foreground-400',
  READY: 'bg-sky-500/10 text-sky-400',
  BLOCKED: 'bg-red-500/10 text-red-400',
  DEPLOYING: 'bg-accent-500/10 text-accent-400',
  DEPLOYED: 'bg-amber-500/10 text-amber-400',
  VERIFYING: 'bg-yellow-500/10 text-yellow-400',
  VERIFIED: 'bg-emerald-500/10 text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-foreground-500/10 text-foreground-600',
  ROLLBACK_REQUIRED: 'bg-orange-500/10 text-orange-400',
  ROLLING_BACK: 'bg-amber-500/10 text-amber-400',
  ROLLED_BACK: 'bg-sky-500/10 text-sky-400',
};

export interface ProjectDeployment {
  id: string;
  project_id: number;
  launch_approval_id: string;
  environment: string;
  status: DeploymentStatus;
  github_sha: string;
  deployed_sha: string | null;
  previous_production_sha: string | null;
  last_known_good_sha: string | null;
  deployment_method: string | null;
  provider: string | null;
  production_url: string | null;
  started_at: string | null;
  started_by: string | null;
  completed_at: string | null;
  verifying_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verification_snapshot: Record<string, unknown> | null;
  accepted_at: string | null;
  accepted_by: string | null;
  acceptance_notes: string | null;
  production_accepted: boolean;
  rollback_of_deployment_id: string | null;
  rollback_sha: string | null;
  rollback_reason: string | null;
  rolled_back_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// A deployment is "active" (blocks a second production run) while it is in one
// of these in-flight states. "DEPLOYED" here means "awaiting verification".
export const ACTIVE_DEPLOYMENT_STATUSES: DeploymentStatus[] = [
  'DEPLOYING',
  'DEPLOYED',
  'VERIFYING',
];

export function isActiveDeploymentStatus(s: DeploymentStatus): boolean {
  return ACTIVE_DEPLOYMENT_STATUSES.includes(s);
}

// A rollback in progress also blocks a new production deployment/rollback.
export function blocksNewDeployment(s: DeploymentStatus): boolean {
  return isActiveDeploymentStatus(s) || s === 'ROLLING_BACK';
}

// ─── Pre-deployment check ───────────────────────────────────────────────────

export type PreDeployState = 'PASS' | 'WARNING' | 'FAIL' | 'UNKNOWN' | 'NOT_REQUIRED';

export const PRE_DEPLOY_LABELS: Record<PreDeployState, string> = {
  PASS: 'Pass',
  WARNING: 'Warning',
  FAIL: 'Fail',
  UNKNOWN: 'Unknown',
  NOT_REQUIRED: 'Not Required',
};

export const PRE_DEPLOY_STYLES: Record<PreDeployState, string> = {
  PASS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  FAIL: 'bg-red-500/10 text-red-400 border-red-500/20',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400 border-foreground-500/20',
  NOT_REQUIRED: 'bg-foreground-500/10 text-foreground-500 border-foreground-500/20',
};

export interface PreDeploymentCheck {
  key: string;
  label: string;
  state: PreDeployState;
  detail: string;
}

export interface ApprovedRelease {
  repository: string | null;
  branch: string | null;
  sha: string;
  shortSha: string;
  commitMessage: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  lastKnownGoodSha: string | null;
}

export interface DeploymentEvaluation {
  eligible: boolean;
  blockers: string[];
  preChecks: PreDeploymentCheck[];
  approvedSha: string | null;
  latestSha: string | null;
  lastKnownGoodSha: string | null;
  approvalId: string | null;
  productionUrl: string | null;
  productionConfigured: boolean;
  deploymentMethod: string;
  provider: string | null;
  approvedRelease: ApprovedRelease | null;
  codeChangedAfterApproval: boolean;
  approvalValid: boolean;
}

export interface DeploymentEvalInput {
  project: Project;
  approval: LaunchApproval | null;
  approvalConfigured: boolean;
  evaluation: LaunchEvaluation;
  integration: ProjectIntegration | null;
}

// ─── Helper: map a launch gate to a pre-deploy check state ─────────────────

function gateStateToPreDeploy(
  state: LaunchEvaluation['gates'][number]['state'],
): PreDeployState {
  switch (state) {
    case 'PASS': return 'PASS';
    case 'WARNING': return 'WARNING';
    case 'FAIL': return 'FAIL';
    case 'PENDING': return 'WARNING';
    case 'NOT_REQUIRED': return 'NOT_REQUIRED';
    case 'UNKNOWN':
    case 'NOT_CONFIGURED':
    default:
      return 'UNKNOWN';
  }
}

function findGate(
  evaluation: LaunchEvaluation,
  key: string,
): LaunchEvaluation['gates'][number] | undefined {
  return evaluation.gates.find((g) => g.key === key);
}

// ─── Evaluation ─────────────────────────────────────────────────────────────

export function evaluateDeployment(input: DeploymentEvalInput): DeploymentEvaluation {
  const { project, approval, evaluation, integration } = input;

  const approved = approval?.decision === 'APPROVED';
  const approvedSha = approval?.github_sha ?? null;
  const lastKnownGoodSha = approval?.last_known_good_sha ?? evaluation.lastKnownGoodSha ?? null;
  const latestSha = evaluation.latestSha;
  const productionUrl = integration?.production_url ?? project.domain_live ?? null;
  const productionConfigured = Boolean(
    integration?.production_provider || integration?.production_url || project.domain_live,
  );

  // Deployment method: no protected connector exists yet — always manual.
  const deploymentMethod = 'Manual';
  const provider = integration?.production_provider ?? null;

  const preChecks: PreDeploymentCheck[] = [];
  const blockers: string[] = [];

  // ── 1. Launch approval ────────────────────────────────────────────────────
  if (approved) {
    preChecks.push({ key: 'approval', label: 'Launch Approval', state: 'PASS', detail: 'Approved' });
  } else if (approval?.decision === 'PENDING') {
    preChecks.push({ key: 'approval', label: 'Launch Approval', state: 'WARNING', detail: 'Approval pending' });
    blockers.push('Launch approval is still pending');
  } else if (approval?.decision === 'REJECTED') {
    preChecks.push({ key: 'approval', label: 'Launch Approval', state: 'FAIL', detail: 'Rejected' });
    blockers.push('Launch approval was rejected');
  } else {
    preChecks.push({ key: 'approval', label: 'Launch Approval', state: 'FAIL', detail: 'No approval' });
    blockers.push('Launch approval required before deployment');
  }

  // ── 2. Approved SHA locked + drift ────────────────────────────────────────
  let codeChangedAfterApproval = false;
  if (!approvedSha) {
    preChecks.push({ key: 'sha', label: 'Approved SHA', state: 'FAIL', detail: 'No approved SHA recorded on the approval' });
    blockers.push('No approved GitHub SHA is recorded on the launch approval');
  } else if (latestSha && latestSha !== approvedSha) {
    codeChangedAfterApproval = true;
    preChecks.push({ key: 'sha', label: 'Approved SHA Matches', state: 'FAIL', detail: 'CODE CHANGED AFTER APPROVAL' });
    blockers.push('Code changed after approval — requires a new launch evaluation');
  } else if (!latestSha) {
    preChecks.push({ key: 'sha', label: 'Approved SHA Matches', state: 'UNKNOWN', detail: 'Current SHA telemetry not tracked — cannot verify drift' });
    blockers.push('Current GitHub SHA is not tracked — cannot verify it matches the approved SHA');
  } else {
    preChecks.push({ key: 'sha', label: 'Approved SHA Matches', state: 'PASS', detail: 'Approved SHA unchanged' });
  }

  // ── 3. Production environment ─────────────────────────────────────────────
  const infraGate = findGate(evaluation, 'infrastructure');
  if (infraGate) {
    const state = gateStateToPreDeploy(infraGate.state);
    if (infraGate.state === 'NOT_CONFIGURED') {
      preChecks.push({ key: 'production', label: 'Production Environment', state: 'UNKNOWN', detail: 'No infrastructure mapping' });
      blockers.push('Production environment is not configured');
    } else {
      preChecks.push({ key: 'production', label: 'Production Environment', state, detail: infraGate.detail });
      if (state === 'FAIL') blockers.push(`Production environment: ${infraGate.detail}`);
    }
  } else {
    preChecks.push({ key: 'production', label: 'Production Environment', state: 'UNKNOWN', detail: 'Infrastructure not evaluated' });
  }

  // ── 4. Production URL ─────────────────────────────────────────────────────
  if (productionUrl) {
    preChecks.push({ key: 'url', label: 'Production URL', state: 'PASS', detail: productionUrl });
  } else {
    preChecks.push({ key: 'url', label: 'Production URL', state: project.is_internal_tool ? 'NOT_REQUIRED' : 'FAIL', detail: project.is_internal_tool ? 'Internal tool — no public URL required' : 'No production URL configured' });
    if (!project.is_internal_tool) blockers.push('Production URL is not configured');
  }

  // ── 5. Monitoring configured ──────────────────────────────────────────────
  const monGate = findGate(evaluation, 'monitoring');
  if (monGate) {
    const state = gateStateToPreDeploy(monGate.state);
    preChecks.push({ key: 'monitoring', label: 'Monitoring Configured', state, detail: monGate.detail });
    if (monGate.state === 'FAIL') blockers.push(`Monitoring: ${monGate.detail}`);
  } else {
    preChecks.push({ key: 'monitoring', label: 'Monitoring Configured', state: 'UNKNOWN', detail: 'Monitoring not evaluated' });
  }

  // ── 6. Critical bugs ──────────────────────────────────────────────────────
  const bugsGate = findGate(evaluation, 'bugs');
  if (bugsGate) {
    preChecks.push({ key: 'bugs', label: 'Critical Bugs', state: gateStateToPreDeploy(bugsGate.state), detail: bugsGate.detail });
    if (bugsGate.state === 'FAIL') blockers.push(`Critical bugs: ${bugsGate.detail}`);
  } else {
    preChecks.push({ key: 'bugs', label: 'Critical Bugs', state: 'UNKNOWN', detail: 'Bugs not evaluated' });
  }

  // ── 7. UAT approval ───────────────────────────────────────────────────────
  const uatGate = findGate(evaluation, 'uat');
  if (uatGate) {
    preChecks.push({ key: 'uat', label: 'UAT Approval', state: gateStateToPreDeploy(uatGate.state), detail: uatGate.detail });
    if (uatGate.state === 'FAIL') blockers.push(`UAT: ${uatGate.detail}`);
  } else {
    preChecks.push({ key: 'uat', label: 'UAT Approval', state: 'UNKNOWN', detail: 'UAT not evaluated' });
  }

  // ── 8. Commercial blockers ────────────────────────────────────────────────
  const budgetGate = findGate(evaluation, 'budget');
  if (budgetGate) {
    preChecks.push({ key: 'budget', label: 'Commercial Blockers', state: gateStateToPreDeploy(budgetGate.state), detail: budgetGate.detail });
    if (budgetGate.state === 'FAIL') blockers.push(`Commercial: ${budgetGate.detail}`);
  } else {
    preChecks.push({ key: 'budget', label: 'Commercial Blockers', state: 'UNKNOWN', detail: 'Budget not evaluated' });
  }

  // ── 9. Required AI runtime ────────────────────────────────────────────────
  const aiGate = findGate(evaluation, 'ai');
  if (project.is_ai_powered) {
    if (aiGate) {
      preChecks.push({ key: 'ai', label: 'Required AI Runtime', state: gateStateToPreDeploy(aiGate.state), detail: aiGate.detail });
    } else {
      preChecks.push({ key: 'ai', label: 'Required AI Runtime', state: 'UNKNOWN', detail: 'AI runtime state not project-scoped' });
    }
  } else {
    preChecks.push({ key: 'ai', label: 'Required AI Runtime', state: 'NOT_REQUIRED', detail: 'Project not AI-powered' });
  }

  // ── 10. No current hard launch blocker ────────────────────────────────────
  for (const b of evaluation.blockers) {
    blockers.push(`${b.label}: ${b.reason}`);
  }

  // Deduplicate blockers while preserving order.
  const uniqueBlockers = Array.from(new Set(blockers));
  const eligible = approved && Boolean(approvedSha) && !codeChangedAfterApproval && uniqueBlockers.length === 0;

  const approvedRelease: ApprovedRelease | null =
    approved && approvedSha
      ? {
          repository: integration?.github_repository ?? null,
          branch: null, // no per-project branch telemetry stored
          sha: approvedSha,
          shortSha: approvedSha.slice(0, 8),
          commitMessage: null, // no commit-message telemetry stored
          approvedAt: approval?.decided_at ?? approval?.created_at ?? null,
          approvedBy: approval?.decided_by ?? approval?.requested_by ?? null,
          lastKnownGoodSha,
        }
      : null;

  return {
    eligible,
    blockers: uniqueBlockers,
    preChecks,
    approvedSha,
    latestSha,
    lastKnownGoodSha,
    approvalId: approved ? approval?.id ?? null : null,
    productionUrl,
    productionConfigured,
    deploymentMethod,
    provider,
    approvedRelease,
    codeChangedAfterApproval,
    approvalValid: approved,
  };
}

// ─── Overview card summary ──────────────────────────────────────────────────

export function computeDeploymentOverview(
  evaluation: DeploymentEvaluation,
  active: ProjectDeployment | null,
  deployments: ProjectDeployment[],
  project: Project,
): { label: string; detail: string } {
  const short = (sha: string | null) => (sha ? sha.slice(0, 8) : '');

  // 1. Accepted / current production release.
  const accepted = latestAcceptedDeployment(deployments);
  if (accepted) {
    const acceptedCount = deployments.filter((d) => d.production_accepted).length;
    const sha = short(accepted.deployed_sha ?? accepted.github_sha);
    if (project.status === 'live' && acceptedCount <= 1) {
      return { label: 'Live', detail: `Production verified · SHA ${sha}` };
    }
    return { label: 'Release Accepted', detail: `SHA ${sha} · Verified` };
  }

  // 2. In-flight deployment.
  if (active) {
    switch (active.status) {
      case 'DEPLOYING':
        return { label: 'Deploying', detail: `SHA ${short(active.github_sha)}` };
      case 'DEPLOYED':
        return { label: 'Deployed — Verification Required', detail: `SHA ${short(active.github_sha)}` };
      case 'VERIFYING':
        return { label: 'Verifying', detail: `SHA ${short(active.github_sha)}` };
      case 'FAILED':
        return { label: 'Verification Failed', detail: active.failure_reason ?? 'Deployment failed' };
      default:
        return { label: DEPLOYMENT_STATUS_LABELS[active.status], detail: '' };
    }
  }

  // 3. A verified release awaiting acceptance.
  const verified = deployments.find((d) => d.status === 'VERIFIED');
  if (verified) return { label: 'Verified — Awaiting Acceptance', detail: `SHA ${short(verified.deployed_sha ?? verified.github_sha)}` };

  // 4. A completed rollback.
  const rolledBack = deployments.find((d) => d.status === 'ROLLED_BACK');
  if (rolledBack) return { label: 'Rolled Back', detail: `SHA ${short(rolledBack.deployed_sha ?? rolledBack.github_sha)}` };

  // 5. Latest failed deployment.
  const latest = deployments[0];
  if (latest?.status === 'FAILED') return { label: 'Failed', detail: latest.failure_reason ?? 'Deployment failed' };

  if (evaluation.eligible) return { label: 'Ready to Deploy', detail: 'All gates passed' };
  if (evaluation.approvalValid) return { label: 'Launch Approval Required', detail: 'Approval or SHA missing' };
  if (evaluation.codeChangedAfterApproval) return { label: 'Re-Evaluation Required', detail: 'Code changed after approval' };
  return { label: 'Launch Approval Required', detail: 'Awaiting valid launch approval' };
}

// ─── Release derivation helpers (Command 13C) ─────────────────────────────

export function latestAcceptedDeployment(
  deployments: ProjectDeployment[],
): ProjectDeployment | null {
  return deployments.find((d) => d.production_accepted) ?? null;
}

export function rollbackTargetFor(
  failed: ProjectDeployment,
  deployments: ProjectDeployment[],
): { sha: string | null; source: string } {
  if (failed.previous_production_sha) {
    return { sha: failed.previous_production_sha, source: 'Previous production SHA' };
  }
  if (failed.last_known_good_sha) {
    return { sha: failed.last_known_good_sha, source: 'Last known good SHA' };
  }
  const prevAccepted = deployments.find((d) => d.production_accepted && d.id !== failed.id);
  const sha = prevAccepted ? prevAccepted.deployed_sha ?? prevAccepted.github_sha : null;
  if (sha) return { sha, source: 'Previous accepted release' };
  return { sha: null, source: 'None' };
}