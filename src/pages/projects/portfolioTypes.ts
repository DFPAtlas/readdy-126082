// ============================================================================
// DFP COMMAND 15A — PROJECT PORTFOLIO CONTROL — TYPES + DISPLAY CONSTANTS
// ============================================================================
// Pure types + label/style maps for the portfolio-wide operating view. Nothing
// here persists data or reads Supabase — every value is derived at read time by
// portfolioDerive.ts / usePortfolio.ts over the existing project systems.
// The canonical registry remains internal_projects.
import type { Project } from './detail/types';
import type { ProjectIntegration } from './detail/infrastructureTypes';

// ─── Indicator state enums (display only — never persisted) ────────────────

export type BuildState = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'READY' | 'COMPLETE' | 'UNKNOWN';

export type UatState =
  | 'NOT_CONFIGURED'
  | 'NOT_STARTED'
  | 'IN_TESTING'
  | 'BLOCKED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'UNKNOWN';

export type LaunchState =
  | 'NOT_EVALUATED'
  | 'NO_GO'
  | 'PENDING'
  | 'AWAITING_DEPLOYMENT'
  | 'LIVE';

export type DeploymentState =
  | 'NONE'
  | 'DEPLOYING'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'RELEASE_ACCEPTED'
  | 'FAILED'
  | 'ROLLBACK_REQUIRED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK';

export type BudgetState = 'NO_BUDGET' | 'ON_TRACK' | 'WATCH' | 'AT_RISK' | 'OVER_BUDGET' | 'UNKNOWN';

export type HealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'OFFLINE'
  | 'UNKNOWN'
  | 'NOT_CONFIGURED'
  | 'PRE_LAUNCH';

export type TargetLaunchState = 'NONE' | 'OVERDUE' | 'DUE_SOON' | 'FUTURE';

// ─── Label maps ─────────────────────────────────────────────────────────────

export const BUILD_STATE_LABELS: Record<BuildState, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  READY: 'Ready',
  COMPLETE: 'Complete',
  UNKNOWN: 'Unknown',
};

export const BUILD_STATE_STYLES: Record<BuildState, string> = {
  NOT_STARTED: 'bg-foreground-500/10 text-foreground-400',
  IN_PROGRESS: 'bg-accent-500/10 text-accent-400',
  BLOCKED: 'bg-orange-500/10 text-orange-400',
  READY: 'bg-emerald-500/10 text-emerald-400',
  COMPLETE: 'bg-emerald-500/10 text-emerald-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export const UAT_STATE_LABELS: Record<UatState, string> = {
  NOT_CONFIGURED: 'Not Configured',
  NOT_STARTED: 'Not Started',
  IN_TESTING: 'In Testing',
  BLOCKED: 'Blocked',
  AWAITING_APPROVAL: 'Awaiting Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  UNKNOWN: 'Unknown',
};

export const UAT_STATE_STYLES: Record<UatState, string> = {
  NOT_CONFIGURED: 'bg-foreground-500/10 text-foreground-500',
  NOT_STARTED: 'bg-foreground-500/10 text-foreground-400',
  IN_TESTING: 'bg-yellow-500/10 text-yellow-400',
  BLOCKED: 'bg-orange-500/10 text-orange-400',
  AWAITING_APPROVAL: 'bg-violet-500/10 text-violet-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400',
  REJECTED: 'bg-red-500/10 text-red-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export const LAUNCH_STATE_LABELS: Record<LaunchState, string> = {
  NOT_EVALUATED: 'Not Evaluated',
  NO_GO: 'NO-GO',
  PENDING: 'Pending',
  AWAITING_DEPLOYMENT: 'Approved · Awaiting Deployment',
  LIVE: 'Live',
};

export const LAUNCH_STATE_STYLES: Record<LaunchState, string> = {
  NOT_EVALUATED: 'bg-foreground-500/10 text-foreground-500',
  NO_GO: 'bg-red-500/10 text-red-400',
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  AWAITING_DEPLOYMENT: 'bg-emerald-500/10 text-emerald-400',
  LIVE: 'bg-emerald-500/10 text-emerald-400',
};

export const DEPLOYMENT_STATE_LABELS: Record<DeploymentState, string> = {
  NONE: 'Ready to Deploy',
  DEPLOYING: 'Deploying',
  VERIFICATION_REQUIRED: 'Verification Required',
  VERIFYING: 'Verifying',
  VERIFIED: 'Verified',
  RELEASE_ACCEPTED: 'Release Accepted',
  FAILED: 'Failed',
  ROLLBACK_REQUIRED: 'Rollback Required',
  ROLLING_BACK: 'Rolling Back',
  ROLLED_BACK: 'Rolled Back',
};

export const DEPLOYMENT_STATE_STYLES: Record<DeploymentState, string> = {
  NONE: 'bg-foreground-500/10 text-foreground-400',
  DEPLOYING: 'bg-accent-500/10 text-accent-400',
  VERIFICATION_REQUIRED: 'bg-amber-500/10 text-amber-400',
  VERIFYING: 'bg-yellow-500/10 text-yellow-400',
  VERIFIED: 'bg-emerald-500/10 text-emerald-400',
  RELEASE_ACCEPTED: 'bg-emerald-500/10 text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-400',
  ROLLBACK_REQUIRED: 'bg-orange-500/10 text-orange-400',
  ROLLING_BACK: 'bg-amber-500/10 text-amber-400',
  ROLLED_BACK: 'bg-sky-500/10 text-sky-400',
};

export const BUDGET_STATE_LABELS: Record<BudgetState, string> = {
  NO_BUDGET: 'No Budget',
  ON_TRACK: 'On Track',
  WATCH: 'Watch',
  AT_RISK: 'At Risk',
  OVER_BUDGET: 'Over Budget',
  UNKNOWN: 'Unknown',
};

export const BUDGET_STATE_STYLES: Record<BudgetState, string> = {
  NO_BUDGET: 'bg-foreground-500/10 text-foreground-400',
  ON_TRACK: 'bg-emerald-500/10 text-emerald-400',
  WATCH: 'bg-amber-500/10 text-amber-400',
  AT_RISK: 'bg-red-500/10 text-red-400',
  OVER_BUDGET: 'bg-red-500/10 text-red-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export const HEALTH_STATE_LABELS: Record<HealthState, string> = {
  HEALTHY: 'Healthy',
  DEGRADED: 'Degraded',
  CRITICAL: 'Critical',
  OFFLINE: 'Offline',
  UNKNOWN: 'Unknown',
  NOT_CONFIGURED: 'Not Configured',
  PRE_LAUNCH: 'Pre-Launch',
};

export const HEALTH_STATE_STYLES: Record<HealthState, string> = {
  HEALTHY: 'bg-emerald-500/10 text-emerald-400',
  DEGRADED: 'bg-amber-500/10 text-amber-400',
  CRITICAL: 'bg-red-500/10 text-red-400',
  OFFLINE: 'bg-red-500/10 text-red-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400',
  NOT_CONFIGURED: 'bg-foreground-500/10 text-foreground-500',
  PRE_LAUNCH: 'bg-foreground-500/10 text-foreground-400',
};

export const TARGET_LAUNCH_LABELS: Record<TargetLaunchState, string> = {
  NONE: '',
  OVERDUE: 'Overdue',
  DUE_SOON: 'Due Soon',
  FUTURE: 'Future',
};

export const TARGET_LAUNCH_STYLES: Record<TargetLaunchState, string> = {
  NONE: 'text-foreground-500',
  OVERDUE: 'text-red-400',
  DUE_SOON: 'text-amber-400',
  FUTURE: 'text-foreground-400',
};

// ─── Generic indicator ──────────────────────────────────────────────────────

export interface Indicator<T extends string> {
  state: T;
  detail: string;
}

export interface AttentionReason {
  /** Lower = higher severity (see §14 ordering). */
  rank: number;
  reason: string;
  section: string;
}

export interface PortfolioProject {
  project: Project;
  integration: ProjectIntegration | null;
  build: Indicator<BuildState>;
  uat: Indicator<UatState>;
  launch: Indicator<LaunchState>;
  deployment: Indicator<DeploymentState>;
  budget: Indicator<BudgetState>;
  health: Indicator<HealthState>;
  integrations: { configured: number; total: number };
  criticalIssues: number;
  attention: AttentionReason[];
  targetLaunch: TargetLaunchState;
  lastActivity: { timestamp: string; label: string } | null;
  stale: boolean;
}

// ─── Portfolio roll-up summaries ────────────────────────────────────────────

export interface PortfolioSummary {
  total: number;
  active: number;
  building: number;
  testing: number;
  live: number;
  blockedAtRisk: number;
  criticalOps: number;
  launchReady: number;
}

export interface LiveSummary {
  live: number;
  healthy: number;
  degraded: number;
  critical: number;
  offline: number;
  unknown: number;
}

export interface CommercialSummary {
  configuredMonthlyRevenue: number;
  monthlyOperatingCost: number;
  monthlyMargin: number;
  projectsOverBudget: number;
  commercialLaunchBlockers: number;
  /** True when some non-internal projects have no financial figures → label as "Configured". */
  coverageIncomplete: boolean;
}

export interface LaunchPipeline {
  building: number;
  uat: number;
  noGo: number;
  pendingApproval: number;
  awaitingDeployment: number;
  deploying: number;
  verificationRequired: number;
}