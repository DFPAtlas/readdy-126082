import type {
  UatProject,
  UatFeedback,
  UatApproval,
  UatJob,
  UatTestCaseResult,
  UatEvidence,
  UatSession,
  UatTester,
  UatAssignment,
  UatTestCase,
} from '@/pages/admin/website-uat/types';

// ─── Local shapes ────────────────────────────────────────────────

export interface LinkedUatProject extends UatProject {
  internal_project_id?: number | null;
}

/** uat_reports is queried defensively; its exact columns are not typed in the
 * admin types, so we keep it as a loose row and read fields optionally. */
export interface UatReportRow {
  id: string;
  project_id?: string | null;
  name?: string | null;
  title?: string | null;
  reference?: string | null;
  created_at?: string | null;
  run_id?: string | null;
  outcome?: string | null;
  recommendation?: string | null;
  go_no_go_score?: number | null;
  generated_by?: string | null;
  [key: string]: unknown;
}

export interface UatData {
  uatProject: LinkedUatProject | null;
  jobs: UatJob[];
  assignments: UatAssignment[];
  results: UatTestCaseResult[];
  testCases: UatTestCase[];
  feedback: UatFeedback[];
  evidence: UatEvidence[];
  sessions: UatSession[];
  approvals: UatApproval[];
  testers: UatTester[];
  reports: UatReportRow[];
}

export type UatStatusState =
  | 'NOT_CONFIGURED'
  | 'NOT_STARTED'
  | 'IN_TESTING'
  | 'BLOCKED'
  | 'FAILED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'READY'
  | 'UNKNOWN';

export type GoNoGo = 'GO' | 'NO-GO' | 'PENDING' | 'UNKNOWN';

export interface UatSummary {
  linked: boolean;
  uatProject: LinkedUatProject | null;
  currentRun: UatJob | null;
  hasRun: boolean;
  hasResults: boolean;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsBlocked: number;
  testsSkipped: number;
  completedExecutable: number;
  passRate: number | null;
  openDefects: number;
  criticalDefects: number;
  evidenceCount: number;
  requiredTotal: number;
  requiredPassed: number;
  approval: UatApproval | null;
  approvalStatus: string | null;
  uatStatus: UatStatusState;
  goNoGo: GoNoGo;
}

// ─── Colour maps ─────────────────────────────────────────────────

export const UAT_STATUS_COLORS: Record<UatStatusState, string> = {
  NOT_CONFIGURED: 'bg-foreground-500/10 text-foreground-500',
  NOT_STARTED: 'bg-foreground-500/10 text-foreground-400',
  IN_TESTING: 'bg-yellow-500/10 text-yellow-400',
  BLOCKED: 'bg-orange-500/10 text-orange-400',
  FAILED: 'bg-red-500/10 text-red-400',
  AWAITING_APPROVAL: 'bg-violet-500/10 text-violet-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400',
  REJECTED: 'bg-red-500/10 text-red-400',
  READY: 'bg-emerald-500/10 text-emerald-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export const GONOGO_COLORS: Record<GoNoGo, string> = {
  GO: 'bg-emerald-500 text-background-950',
  'NO-GO': 'bg-red-500 text-background-950',
  PENDING: 'bg-yellow-500 text-background-950',
  UNKNOWN: 'bg-foreground-500 text-background-950',
};

// ─── Derivation helpers (honest, display-only) ───────────────────

const RESOLVED_FEEDBACK = ['fixed', 'closed', 'wont_fix', 'duplicate', 'resolved'];

export function isUnresolvedDefect(f: UatFeedback): boolean {
  const s = (f.status || '').toLowerCase();
  return !RESOLVED_FEEDBACK.includes(s);
}

interface Tally {
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  needsRetest: number;
  inProgress: number;
  completedExecutable: number;
  passRate: number | null;
  total: number;
}

export function tallyResults(results: UatTestCaseResult[]): Tally {
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let skipped = 0;
  let needsRetest = 0;
  let inProgress = 0;
  for (const r of results) {
    const s = r.status;
    if (s === 'passed') passed += 1;
    else if (s === 'failed') failed += 1;
    else if (s === 'blocked') blocked += 1;
    else if (s === 'skipped') skipped += 1;
    else if (s === 'needs_retest') needsRetest += 1;
    else if (s === 'in_progress') inProgress += 1;
  }
  const completedExecutable = passed + failed + blocked + needsRetest;
  return {
    passed,
    failed,
    blocked,
    skipped,
    needsRetest,
    inProgress,
    completedExecutable,
    passRate: completedExecutable > 0 ? passed / completedExecutable : null,
    total: results.length,
  };
}

/** Keep only the latest result per test case (re-saved results never inflate). */
export function dedupeLatestResults(results: UatTestCaseResult[]): UatTestCaseResult[] {
  const map = new Map<string, UatTestCaseResult>();
  for (const r of results) {
    const key = r.assignment_test_case_id || r.id;
    const cur = map.get(key);
    if (!cur || (r.created_at || '') > (cur.created_at || '')) map.set(key, r);
  }
  return Array.from(map.values());
}

/** Latest result per test_case_id (for required-test completeness checks). */
export function latestResultByTestCase(results: UatTestCaseResult[]): Map<string, UatTestCaseResult> {
  const map = new Map<string, UatTestCaseResult>();
  for (const r of results) {
    const cur = map.get(r.test_case_id);
    if (!cur || (r.created_at || '') > (cur.created_at || '')) map.set(r.test_case_id, r);
  }
  return map;
}

interface StatusInput {
  linked: boolean;
  hasRun: boolean;
  runFailed: boolean;
  hasBlocked: boolean;
  approvalStatus: string | null;
  hasCritical: boolean;
  hasResults: boolean;
}

export function deriveUatStatus(s: StatusInput): UatStatusState {
  if (!s.linked) return 'NOT_CONFIGURED';
  if (s.approvalStatus === 'rejected') return 'REJECTED';
  if (s.hasCritical) return 'BLOCKED';
  if (s.approvalStatus === 'approved') return s.hasResults ? 'READY' : 'APPROVED';
  if (s.approvalStatus === 'pending') return 'AWAITING_APPROVAL';
  if (s.hasBlocked) return 'BLOCKED';
  if (s.runFailed) return 'FAILED';
  if (!s.hasRun) return 'NOT_STARTED';
  return 'IN_TESTING';
}

export function deriveGoNoGo(s: {
  linked: boolean;
  approvalStatus: string | null;
  hasCritical: boolean;
  runFailed: boolean;
  hasRun: boolean;
  hasResults: boolean;
}): GoNoGo {
  if (!s.linked) return 'UNKNOWN';
  if (s.approvalStatus === 'rejected') return 'NO-GO';
  if (s.hasCritical) return 'NO-GO';
  if (s.runFailed) return 'NO-GO';
  if (s.approvalStatus === 'approved') return s.hasResults ? 'GO' : 'PENDING';
  if (s.approvalStatus === 'pending') return 'PENDING';
  if (s.hasRun || s.hasResults) return 'PENDING';
  return 'UNKNOWN';
}

export function computeUatSummary(d: UatData): UatSummary {
  const uatProject = d.uatProject;
  const linked = uatProject != null;
  const sortedJobs = [...d.jobs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const currentRun = sortedJobs[0] ?? null;
  const hasRun = d.jobs.length > 0;

  const currentRunAssignmentIds = new Set(
    d.assignments.filter((a) => a.job_id === currentRun?.id).map((a) => a.id),
  );
  const currentRunResults = dedupeLatestResults(
    d.results.filter((r) => currentRunAssignmentIds.has(r.assignment_id)),
  );
  const t = tallyResults(currentRunResults);

  const unresolved = d.feedback.filter(isUnresolvedDefect);
  const criticalDefects = unresolved.filter((f) => (f.severity || '').toLowerCase() === 'critical');

  const approval = d.approvals.length
    ? [...d.approvals].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
    : null;

  const runFailed = currentRun?.status === 'failed';
  const hasResults = t.completedExecutable > 0;
  const hasCritical = criticalDefects.length > 0;
  const hasBlocked = t.blocked > 0;
  const approvalStatus = approval?.status ?? null;

  const requiredTestCases = d.testCases.filter((tc) => tc.is_required);
  const latestByTestCase = latestResultByTestCase(d.results);
  const requiredTotal = requiredTestCases.length;
  const requiredPassed = requiredTestCases.filter((tc) => latestByTestCase.get(tc.id)?.status === 'passed').length;

  const uatStatus = deriveUatStatus({
    linked,
    hasRun,
    runFailed,
    hasBlocked,
    approvalStatus,
    hasCritical,
    hasResults,
  });

  const goNoGo = deriveGoNoGo({
    linked,
    approvalStatus,
    hasCritical,
    runFailed,
    hasRun,
    hasResults,
  });

  return {
    linked,
    uatProject,
    currentRun,
    hasRun,
    hasResults,
    testsTotal: t.total,
    testsPassed: t.passed,
    testsFailed: t.failed,
    testsBlocked: t.blocked,
    testsSkipped: t.skipped,
    completedExecutable: t.completedExecutable,
    passRate: t.passRate,
    openDefects: unresolved.length,
    criticalDefects: criticalDefects.length,
    evidenceCount: d.evidence.length,
    requiredTotal,
    requiredPassed,
    approval,
    approvalStatus,
    uatStatus,
    goNoGo,
  };
}