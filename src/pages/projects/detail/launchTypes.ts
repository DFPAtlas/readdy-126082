// ============================================================================
// DFP COMMAND 12 — PROJECT LAUNCH CONTROL — TYPES + PURE EVALUATION
// ============================================================================
// Launch Control is a READ-TIME AGGREGATOR. It reads existing project systems
// (Build, GitHub/Readdy, Infrastructure, UAT, Bugs, Changes, Budget, Support,
// Monitoring, AI) and derives a formal launch decision. Nothing here persists a
// new status — the only write is the explicit launch approval record.
//
// Core principle: NEVER manufacture a ready state. Configured ≠ healthy,
// no-data ≠ green, "most items green" ≠ GO. GO requires every mandatory gate to
// pass AND an authorised launch approval to exist.
import type { Project, Bug, ChangeRequest } from './types';
import type { ProjectBuildRun, ProjectBuildItem } from './buildUtils';
import { computeReadiness } from './buildUtils';
import type { UatData } from './uatTypes';
import type { BudgetSummary } from './budgetTypes';
import type { SupportTicket } from '@/types/support-tickets';
import { deriveSupportStatus } from './supportTypes';
import type { MonitoringSummary } from './monitoringUtils';
import { configured } from './infrastructureUtils';
import type { ProjectIntegration } from './infrastructureTypes';
import { computeBugsSummary, computeChangesSummary } from './workstreamUtils';

// ─── Gates ──────────────────────────────────────────────────────────────────

export type GateKey =
  | 'build'
  | 'github'
  | 'readdy'
  | 'infrastructure'
  | 'uat'
  | 'bugs'
  | 'changes'
  | 'budget'
  | 'support'
  | 'monitoring'
  | 'ai';

export type GateState =
  | 'PASS'
  | 'WARNING'
  | 'FAIL'
  | 'PENDING'
  | 'UNKNOWN'
  | 'NOT_REQUIRED'
  | 'NOT_CONFIGURED';

export const GATE_LABELS: Record<GateKey, string> = {
  build: 'Build',
  github: 'GitHub',
  readdy: 'Readdy',
  infrastructure: 'Infrastructure',
  uat: 'UAT',
  bugs: 'Critical Bugs',
  changes: 'Critical Changes',
  budget: 'Budget',
  support: 'Support',
  monitoring: 'Monitoring',
  ai: 'AI Operations',
};

export const GATE_ICONS: Record<GateKey, string> = {
  build: 'ri-hammer-line',
  github: 'ri-github-line',
  readdy: 'ri-cloud-line',
  infrastructure: 'ri-server-line',
  uat: 'ri-clipboard-line',
  bugs: 'ri-bug-line',
  changes: 'ri-git-pull-request-line',
  budget: 'ri-money-pound-circle-line',
  support: 'ri-lifebuoy-line',
  monitoring: 'ri-pulse-line',
  ai: 'ri-robot-2-line',
};

export const GATE_STATE_LABELS: Record<GateState, string> = {
  PASS: 'Pass',
  WARNING: 'Warning',
  FAIL: 'Fail',
  PENDING: 'Pending',
  UNKNOWN: 'Unknown',
  NOT_REQUIRED: 'Not Required',
  NOT_CONFIGURED: 'Not Configured',
};

export const GATE_STATE_STYLES: Record<GateState, string> = {
  PASS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  FAIL: 'bg-red-500/10 text-red-400 border-red-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400 border-foreground-500/20',
  NOT_REQUIRED: 'bg-foreground-500/10 text-foreground-500 border-foreground-500/20',
  NOT_CONFIGURED: 'bg-foreground-500/10 text-foreground-500 border-foreground-500/20',
};

export interface LaunchGate {
  key: GateKey;
  label: string;
  state: GateState;
  detail: string;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

// ─── Decision ───────────────────────────────────────────────────────────────

export type LaunchDecision = 'GO' | 'NO-GO' | 'PENDING' | 'UNKNOWN' | 'NOT_CONFIGURED';

export const DECISION_LABELS: Record<LaunchDecision, string> = {
  GO: 'GO',
  'NO-GO': 'NO-GO',
  PENDING: 'PENDING',
  UNKNOWN: 'UNKNOWN',
  NOT_CONFIGURED: 'NOT CONFIGURED',
};

export const DECISION_STYLES: Record<LaunchDecision, string> = {
  GO: 'bg-emerald-500 text-background-950',
  'NO-GO': 'bg-red-500 text-background-950',
  PENDING: 'bg-yellow-500 text-background-950',
  UNKNOWN: 'bg-foreground-500 text-background-950',
  NOT_CONFIGURED: 'bg-foreground-600 text-background-950',
};

// ─── Blockers / warnings ────────────────────────────────────────────────────

export type IssueSeverity = 'HARD' | 'WARNING';

export interface LaunchIssue {
  key: string;
  source: string;
  label: string;
  severity: IssueSeverity;
  reason: string;
  deepLink: { label: string; to: string } | null;
}

// ─── Approval record ────────────────────────────────────────────────────────

export type ApprovalDecision = 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export const APPROVAL_LABELS: Record<ApprovalDecision, string> = {
  NOT_REQUESTED: 'Not Requested',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
};

export interface LaunchApproval {
  id: string;
  project_id: number;
  decision: ApprovalDecision;
  requested_at: string;
  requested_by: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_notes: string | null;
  evaluation_snapshot: LaunchSnapshot | null;
  github_sha: string | null;
  last_known_good_sha: string | null;
  created_at: string;
}

export interface LaunchSnapshot {
  gates: { key: GateKey; state: GateState; detail: string }[];
  productionDomain: string | null;
  githubRepository: string | null;
  supabaseRef: string | null;
  githubSha: string | null;
  lastKnownGoodSha: string | null;
  evaluatedAt: string;
}

// ─── Evaluation result ──────────────────────────────────────────────────────

export interface LaunchEvaluation {
  decision: LaunchDecision;
  gates: LaunchGate[];
  blockers: LaunchIssue[];
  warnings: LaunchIssue[];
  passedCount: number;
  totalCount: number;
  warningCount: number;
  blockerCount: number;
  approvalAtRisk: boolean;
  codeChangedAfterApproval: boolean;
  configChangedAfterApproval: boolean;
  latestSha: string | null;
  lastKnownGoodSha: string | null;
  productionDomain: string | null;
  anySourceAvailable: boolean;
}

// ─── Evaluation input (what page.tsx passes in) ────────────────────────────

export interface LaunchEvalInput {
  project: Project;
  buildRuns: ProjectBuildRun[];
  buildItemsByRun: Record<number, ProjectBuildItem[]>;
  buildError: boolean;
  integration: ProjectIntegration | null;
  infraError: boolean;
  uat: UatData;
  uatError: boolean;
  bugs: Bug[];
  changeRequests: ChangeRequest[];
  budget: BudgetSummary;
  budgetError: boolean;
  supportTickets: SupportTicket[];
  supportError: boolean;
  monitoring: MonitoringSummary;
  monitoringAnyLoadFailed: boolean;
  approval: LaunchApproval | null;
  approvalConfigured: boolean;
}

// ─── Gate evaluation ────────────────────────────────────────────────────────

function evaluateBuild(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'build', label: GATE_LABELS.build, state: 'UNKNOWN', detail: '' };
  if (input.buildError) {
    gate.state = 'UNKNOWN';
    gate.detail = 'Build data unavailable';
    return gate;
  }
  if (input.buildRuns.length === 0) {
    gate.state = 'NOT_CONFIGURED';
    gate.detail = 'No build checklist exists';
    return gate;
  }
  const active = input.buildRuns.find((r) => r.run_status === 'active');
  const items = active ? input.buildItemsByRun[active.id] ?? [] : [];
  const readiness = computeReadiness(items);
  if (readiness.state === 'READY') {
    gate.state = 'PASS';
    gate.detail = 'Required items complete · 0 launch blockers';
  } else if (readiness.launchBlockers > 0) {
    gate.state = 'FAIL';
    gate.detail = `${readiness.launchBlockers} active launch blocker${readiness.launchBlockers > 1 ? 's' : ''}`;
  } else {
    gate.state = 'PENDING';
    gate.detail = `${readiness.reqRemaining} required item${readiness.reqRemaining > 1 ? 's' : ''} remaining`;
  }
  return gate;
}

function evaluateGitHub(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'github', label: GATE_LABELS.github, state: 'UNKNOWN', detail: '' };
  if (input.infraError) {
    gate.detail = 'GitHub data unavailable';
    return gate;
  }
  const repo = input.integration?.github_repository;
  if (!configured(repo)) {
    gate.state = 'NOT_CONFIGURED';
    gate.detail = 'No repository configured';
    return gate;
  }
  // Honest: no per-project SHA/verification telemetry is stored yet.
  gate.state = 'WARNING';
  gate.detail = `${repo} configured — verification & SHA not tracked`;
  return gate;
}

function evaluateReaddy(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'readdy', label: GATE_LABELS.readdy, state: 'NOT_CONFIGURED', detail: '' };
  const id = input.integration?.readdy_project_id;
  if (configured(id)) {
    gate.state = 'WARNING';
    gate.detail = 'Configured — live sync state unknown';
  } else {
    gate.detail = 'Readdy project not configured';
  }
  return gate;
}

function evaluateInfrastructure(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'infrastructure', label: GATE_LABELS.infrastructure, state: 'UNKNOWN', detail: '' };
  if (input.infraError) {
    gate.detail = 'Infrastructure data unavailable';
    return gate;
  }
  if (!input.integration) {
    gate.state = 'NOT_CONFIGURED';
    gate.detail = 'No infrastructure mapping';
    return gate;
  }
  const prod = configured(input.integration.production_url) || configured(input.project.domain_live);
  const hosting = configured(input.integration.production_provider) || configured(input.integration.production_url);
  if (!prod && !hosting && input.project.is_internal_tool) {
    gate.state = 'NOT_REQUIRED';
    gate.detail = 'Internal tool — no public infrastructure required';
    return gate;
  }
  if (!prod) {
    gate.state = 'FAIL';
    gate.detail = 'Production domain not configured';
    return gate;
  }
  if (!hosting) {
    gate.state = 'FAIL';
    gate.detail = 'Production hosting not configured';
    return gate;
  }
  if (input.project.is_saas && !configured(input.integration.supabase_project_ref)) {
    gate.state = 'WARNING';
    gate.detail = 'Production configured — Supabase mapping missing';
    return gate;
  }
  gate.state = 'PASS';
  gate.detail = 'Production domain & hosting configured';
  return gate;
}

function evaluateUat(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'uat', label: GATE_LABELS.uat, state: 'UNKNOWN', detail: '' };
  if (input.uatError) {
    gate.detail = 'UAT data unavailable';
    return gate;
  }
  const s = input.uat;
  if (!input.uat.uatProject) {
    gate.state = 'NOT_CONFIGURED';
    gate.detail = 'No linked UAT project';
    return gate;
  }
  // computeUatSummary is already on the data via useProjectUat; re-derive cheaply.
  const approvalStatus = s.approvals.length
    ? [...s.approvals].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]?.status ?? null
    : null;
  const unresolvedCritical = s.feedback.filter(
    (f) => !['fixed', 'closed', 'wont_fix', 'duplicate', 'resolved'].includes((f.status || '').toLowerCase())
      && (f.severity || '').toLowerCase() === 'critical',
  ).length;
  if (approvalStatus === 'rejected') {
    gate.state = 'FAIL';
    gate.detail = 'UAT approval rejected';
  } else if (unresolvedCritical > 0) {
    gate.state = 'FAIL';
    gate.detail = `${unresolvedCritical} unresolved critical UAT defect${unresolvedCritical > 1 ? 's' : ''}`;
  } else if (approvalStatus === 'approved') {
    gate.state = 'PASS';
    gate.detail = 'UAT approved';
  } else if (approvalStatus === 'pending') {
    gate.state = 'PENDING';
    gate.detail = 'UAT approval pending';
  } else {
    gate.state = 'PENDING';
    gate.detail = 'Testing or approval incomplete';
  }
  gate.critical = unresolvedCritical;
  return gate;
}

function evaluateBugs(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'bugs', label: GATE_LABELS.bugs, state: 'PASS', detail: '' };
  const summary = computeBugsSummary(input.bugs, input.uat.feedback, []);
  gate.critical = summary.critical;
  gate.high = summary.highPriority;
  if (summary.critical > 0) {
    gate.state = 'FAIL';
    gate.detail = `${summary.critical} unresolved critical bug${summary.critical > 1 ? 's' : ''}`;
  } else if (summary.highPriority > 0) {
    gate.state = 'WARNING';
    gate.detail = `${summary.highPriority} high-priority issue${summary.highPriority > 1 ? 's' : ''} remain`;
  } else {
    gate.detail = 'No unresolved critical bugs';
  }
  return gate;
}

function evaluateChanges(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'changes', label: GATE_LABELS.changes, state: 'PASS', detail: '' };
  const cs = computeChangesSummary(input.changeRequests);
  // No launch-blocking field exists in the model → never fabricate a hard fail.
  if (cs.highImpact > 0) {
    gate.state = 'WARNING';
    gate.detail = `${cs.highImpact} high-impact change${cs.highImpact > 1 ? 's' : ''} open`;
  } else {
    gate.detail = 'No high-impact changes open';
  }
  return gate;
}

function evaluateBudget(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'budget', label: GATE_LABELS.budget, state: 'UNKNOWN', detail: '' };
  if (input.budgetError) {
    gate.detail = 'Budget data unavailable';
    return gate;
  }
  if (!input.budget.hasAnyBudget) {
    gate.state = 'NOT_CONFIGURED';
    gate.detail = 'No budget records';
    return gate;
  }
  if (input.budget.launchCosts.blocked) {
    gate.state = 'FAIL';
    gate.detail = `£${input.budget.launchCosts.outstanding.toLocaleString()} required launch cost unpaid`;
  } else if (input.budget.status === 'OVER BUDGET' || input.budget.status === 'AT RISK') {
    gate.state = 'WARNING';
    gate.detail = input.budget.status === 'OVER BUDGET' ? 'Project over budget' : 'Budget at risk';
  } else {
    gate.state = 'PASS';
    gate.detail = 'No required commercial blockers';
  }
  return gate;
}

function evaluateSupport(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'support', label: GATE_LABELS.support, state: 'UNKNOWN', detail: '' };
  if (input.supportError) {
    gate.detail = 'Support data unavailable';
    return gate;
  }
  const status = deriveSupportStatus(input.supportTickets, false);
  switch (status) {
    case 'CRITICAL':
      gate.state = 'FAIL';
      gate.detail = 'Critical incident open';
      break;
    case 'DEGRADED':
      gate.state = 'WARNING';
      gate.detail = 'High-priority support issues open';
      break;
    case 'ACTIVE':
    case 'CLEAR':
      gate.state = 'PASS';
      gate.detail = status === 'CLEAR' ? 'No active issues' : 'Normal open tickets only';
      break;
    default:
      gate.state = 'NOT_CONFIGURED';
      gate.detail = 'No linked support tickets';
  }
  return gate;
}

function evaluateMonitoring(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'monitoring', label: GATE_LABELS.monitoring, state: 'UNKNOWN', detail: '' };
  if (input.monitoringAnyLoadFailed) {
    gate.detail = 'Monitoring data unavailable';
    return gate;
  }
  switch (input.monitoring.health) {
    case 'OFFLINE':
    case 'CRITICAL':
      gate.state = 'FAIL';
      gate.detail = 'Production confirmed down / critical';
      break;
    case 'HEALTHY':
      gate.state = 'PASS';
      gate.detail = 'Monitoring configured & healthy';
      break;
    case 'DEGRADED':
      gate.state = 'WARNING';
      gate.detail = 'Monitoring degraded';
      break;
    case 'NOT CONFIGURED':
      gate.state = 'NOT_CONFIGURED';
      gate.detail = 'Monitoring not configured';
      break;
    default:
      gate.state = 'WARNING';
      gate.detail = 'Configured but state unknown/stale';
  }
  return gate;
}

function evaluateAi(input: LaunchEvalInput): LaunchGate {
  const gate: LaunchGate = { key: 'ai', label: GATE_LABELS.ai, state: 'NOT_REQUIRED', detail: 'Project not AI-powered' };
  if (input.project.is_ai_powered) {
    // Honest: AI-ops records are keyed to ai_sites, not internal_projects, so
    // no project-scoped AI state is available here — surfaced via deep link.
    gate.state = 'UNKNOWN';
    gate.detail = 'AI runtime state not project-scoped';
  }
  return gate;
}

// ─── Decision derivation (honest — never manufacture GO) ──────────────────

function deepLinkFor(source: GateKey, slug: string): { label: string; to: string } | null {
  switch (source) {
    case 'build': return { label: 'Open Build', to: '/build-process' };
    case 'github': return { label: 'Open GitHub', to: '/github' };
    case 'infrastructure': return { label: 'Open Infrastructure', to: `/projects/${slug}?section=infrastructure` };
    case 'uat': return { label: 'Open UAT', to: '/admin/website-uat' };
    case 'bugs': return { label: 'Open Bugs', to: '/bugs' };
    case 'changes': return { label: 'Open Changes', to: '/change-requests' };
    case 'budget': return { label: 'Open Budget', to: '/project-budget' };
    case 'support': return { label: 'Open Support', to: '/support-tickets' };
    case 'monitoring': return { label: 'Open Monitoring', to: '/system-status' };
    case 'ai': return { label: 'Open AI Operations', to: '/ai-operations' };
    default: return null;
  }
}

export function evaluateLaunch(input: LaunchEvalInput): LaunchEvaluation {
  const gates: LaunchGate[] = [
    evaluateBuild(input),
    evaluateGitHub(input),
    evaluateReaddy(input),
    evaluateInfrastructure(input),
    evaluateUat(input),
    evaluateBugs(input),
    evaluateChanges(input),
    evaluateBudget(input),
    evaluateSupport(input),
    evaluateMonitoring(input),
    evaluateAi(input),
  ];

  const blockers: LaunchIssue[] = [];
  const warnings: LaunchIssue[] = [];

  const slug = input.project.project_slug;
  for (const g of gates) {
    if (g.state === 'FAIL') {
      blockers.push({
        key: g.key,
        source: g.label,
        label: g.label,
        severity: 'HARD',
        reason: g.detail,
        deepLink: deepLinkFor(g.key, slug),
      });
    } else if (g.state === 'WARNING') {
      warnings.push({
        key: g.key,
        source: g.label,
        label: g.label,
        severity: 'WARNING',
        reason: g.detail,
        deepLink: deepLinkFor(g.key, slug),
      });
    }
  }

  // ── Approval invalidation (SHA / config change after approval) ───────────
  let codeChangedAfterApproval = false;
  let configChangedAfterApproval = false;
  const approval = input.approval;
  const approved = approval?.decision === 'APPROVED';

  const latestSha: string | null = null; // no per-project SHA telemetry exists yet
  const lastKnownGoodSha: string | null = approval?.last_known_good_sha ?? null;
  const productionDomain = input.integration?.production_url ?? input.project.domain_live ?? null;

  if (approved) {
    if (approval.github_sha && latestSha && approval.github_sha !== latestSha) {
      codeChangedAfterApproval = true;
      blockers.push({
        key: 'sha-change',
        source: 'Code',
        label: 'CODE CHANGED AFTER APPROVAL',
        severity: 'HARD',
        reason: 'Approval applies to a known code version that has since changed',
        deepLink: { label: 'Open GitHub', to: '/github' },
      });
    }
    const snap = approval.evaluation_snapshot;
    if (snap) {
      const repoChanged = Boolean(snap.githubRepository) && snap.githubRepository !== (input.integration?.github_repository ?? null);
      const domainChanged = Boolean(snap.productionDomain) && snap.productionDomain !== productionDomain;
      const supabaseChanged = Boolean(snap.supabaseRef) && snap.supabaseRef !== (input.integration?.supabase_project_ref ?? null);
      if (repoChanged || domainChanged || supabaseChanged) {
        configChangedAfterApproval = true;
        blockers.push({
          key: 'config-change',
          source: 'Configuration',
          label: 'CONFIGURATION CHANGED AFTER APPROVAL',
          severity: 'HARD',
          reason: 'Repository / domain / backend mapping changed since approval',
          deepLink: { label: 'Open Infrastructure', to: `/projects/${slug}?section=infrastructure` },
        });
      }
    }
  }

  // ── Source availability ──────────────────────────────────────────────────
  const anySourceAvailable =
    !input.buildError ||
    !input.infraError ||
    !input.uatError ||
    !input.budgetError ||
    !input.supportError ||
    !input.monitoringAnyLoadFailed ||
    input.buildRuns.length > 0 ||
    input.integration != null ||
    input.uat.uatProject != null ||
    input.budget.hasAnyBudget ||
    input.supportTickets.length > 0;

  // ── Decision ─────────────────────────────────────────────────────────────
  let decision: LaunchDecision;
  const hasHardBlocker = blockers.length > 0;

  if (!anySourceAvailable && !input.approvalConfigured) {
    decision = 'UNKNOWN';
  } else if (hasHardBlocker || approval?.decision === 'REJECTED') {
    decision = 'NO-GO';
  } else {
    const softIncomplete = gates.some(
      (g) => g.state === 'PENDING' || g.state === 'UNKNOWN' || g.state === 'NOT_CONFIGURED',
    );
    if (softIncomplete) {
      decision = 'PENDING';
    } else if (approved) {
      decision = 'GO';
    } else {
      decision = 'PENDING'; // approval required (or still pending)
    }
  }

  const passedCount = gates.filter((g) => g.state === 'PASS').length;
  const totalCount = gates.filter((g) => g.state !== 'NOT_REQUIRED').length;

  return {
    decision,
    gates,
    blockers,
    warnings,
    passedCount,
    totalCount,
    warningCount: warnings.length,
    blockerCount: blockers.length,
    approvalAtRisk: approved && (hasHardBlocker || codeChangedAfterApproval || configChangedAfterApproval),
    codeChangedAfterApproval,
    configChangedAfterApproval,
    latestSha,
    lastKnownGoodSha,
    productionDomain,
    anySourceAvailable,
  };
}

export function buildLaunchSnapshot(
  gates: LaunchGate[],
  project: Project,
  integration: ProjectIntegration | null,
): LaunchSnapshot {
  return {
    gates: gates.map((g) => ({ key: g.key, state: g.state, detail: g.detail })),
    productionDomain: integration?.production_url ?? project.domain_live ?? null,
    githubRepository: integration?.github_repository ?? null,
    supabaseRef: integration?.supabase_project_ref ?? null,
    githubSha: null,
    lastKnownGoodSha: null,
    evaluatedAt: new Date().toISOString(),
  };
}