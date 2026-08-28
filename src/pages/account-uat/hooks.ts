import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  UatAssignment,
  UatJob,
  UatProject,
  UatReward,
  UatJobApplication,
} from '@/pages/admin/website-uat/types';
import { isMarketplaceVisible } from '@/pages/admin/website-uat/marketplace';

export interface EarningsSummary {
  pendingMinor: number;
  approvedMinor: number;
  paidMinor: number;
  totalMinor: number;
}

export interface AssignmentProgress {
  total: number;
  completed: number;
}

/** Pass / fail / blocked tallies for a submitted assignment's real results. */
export interface ResultSummary {
  passed: number;
  failed: number;
  blocked: number;
}

export interface TesterUatData {
  loading: boolean;
  error: string;
  reload: () => void;
  assignments: UatAssignment[];
  payments: UatReward[];
  jobs: UatJob[];
  projects: UatProject[];
  applications: UatJobApplication[];
  jobById: Map<string, UatJob>;
  projectById: Map<string, UatProject>;
  availableJobs: UatJob[];
  activeAssignments: UatAssignment[];
  awaitingReviewAssignments: UatAssignment[];
  completedAssignments: UatAssignment[];
  inactiveAssignments: UatAssignment[];
  pendingApplications: UatJobApplication[];
  rejectedApplications: UatJobApplication[];
  progressByAssignment: Map<string, AssignmentProgress>;
  lastActivityByAssignment: Map<string, string>;
  resultSummaryByAssignment: Map<string, ResultSummary>;
  assignmentById: Map<string, UatAssignment>;
  earnings: EarningsSummary;
}

// Minimal row shapes used only to derive progress / last-activity locally.
interface AssignmentTestCaseRow {
  id: string;
  assignment_id: string;
  status: string | null;
}
interface TestCaseResultRow {
  assignment_id: string;
  assignment_test_case_id: string;
  status: string | null;
}
interface SessionRow {
  assignment_id: string;
  last_activity_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

const ACTIVE_ASSIGNMENT_STATUSES = ['assigned', 'reserved', 'in_progress', 'testing'];
const TERMINAL_ASSIGNMENT_STATUSES = ['completed', 'cancelled', 'rejected', 'expired'];
const INACTIVE_ASSIGNMENT_STATUSES = ['cancelled', 'expired', 'rejected'];
/** A test-case result counts toward "completed" only in these terminal states. */
const COMPLETED_RESULT_STATUSES = ['passed', 'failed', 'blocked', 'skipped', 'needs_retest'];

/**
 * Loads everything a tester needs for their UAT dashboard. All reads go
 * through the existing tester-scoped RLS policies (`select_own` /
 * `can_access_uat_job`), so a tester can only ever see their own data.
 */
export function useTesterUat(testerId: string | null): TesterUatData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignments, setAssignments] = useState<UatAssignment[]>([]);
  const [payments, setPayments] = useState<UatReward[]>([]);
  const [jobs, setJobs] = useState<UatJob[]>([]);
  const [projects, setProjects] = useState<UatProject[]>([]);
  const [applications, setApplications] = useState<UatJobApplication[]>([]);
  const [assignmentTestCases, setAssignmentTestCases] = useState<AssignmentTestCaseRow[]>([]);
  const [testCaseResults, setTestCaseResults] = useState<TestCaseResultRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const load = useCallback(async () => {
    if (!testerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [aRes, pRes, jRes, prRes, appRes, atcRes, tcrRes, sRes] = await Promise.all([
        supabase.from('uat_assignments').select('*').eq('tester_id', testerId).order('created_at', { ascending: false }),
        supabase.from('uat_payments').select('*').eq('tester_id', testerId).order('created_at', { ascending: false }),
        supabase.from('uat_jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('uat_projects').select('*'),
        supabase.from('uat_job_applications').select('*').eq('tester_id', testerId).order('created_at', { ascending: false }),
        supabase.from('uat_assignment_test_cases').select('id,assignment_id,status').eq('tester_id', testerId),
        supabase.from('uat_test_case_results').select('assignment_id,assignment_test_case_id,status').eq('tester_id', testerId),
        supabase.from('uat_sessions').select('assignment_id,last_activity_at,updated_at,created_at').eq('tester_id', testerId),
      ]);
      if (aRes.error) throw aRes.error;
      if (pRes.error) throw pRes.error;
      if (jRes.error) throw jRes.error;
      if (prRes.error) throw prRes.error;
      if (appRes.error) throw appRes.error;
      if (atcRes.error) throw atcRes.error;
      if (tcrRes.error) throw tcrRes.error;
      if (sRes.error) throw sRes.error;
      setAssignments((aRes.data ?? []) as UatAssignment[]);
      setPayments((pRes.data ?? []) as UatReward[]);
      setJobs((jRes.data ?? []) as UatJob[]);
      setProjects((prRes.data ?? []) as UatProject[]);
      setApplications((appRes.data ?? []) as UatJobApplication[]);
      setAssignmentTestCases((atcRes.data ?? []) as AssignmentTestCaseRow[]);
      setTestCaseResults((tcrRes.data ?? []) as TestCaseResultRow[]);
      setSessions((sRes.data ?? []) as SessionRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [testerId]);

  useEffect(() => {
    load();
  }, [load]);

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const assignmentById = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);

  const assignedJobIds = useMemo(() => new Set(assignments.map((a) => a.job_id)), [assignments]);

  const availableJobs = useMemo(
    () => jobs.filter((j) => isMarketplaceVisible(j) && !assignedJobIds.has(j.id)),
    [jobs, assignedJobIds],
  );

  const activeAssignments = useMemo(
    () => assignments.filter((a) => ACTIVE_ASSIGNMENT_STATUSES.includes(a.status)),
    [assignments],
  );

  const awaitingReviewAssignments = useMemo(
    () =>
      assignments.filter(
        (a) =>
          a.submitted_at != null &&
          !TERMINAL_ASSIGNMENT_STATUSES.includes(a.status) &&
          a.review_status !== 'rejected' &&
          a.review_status !== 'approved',
      ),
    [assignments],
  );

  const completedAssignments = useMemo(
    () => assignments.filter((a) => a.status === 'completed' || a.review_status === 'approved'),
    [assignments],
  );

  const inactiveAssignments = useMemo(
    () =>
      assignments.filter(
        (a) =>
          INACTIVE_ASSIGNMENT_STATUSES.includes(a.status) ||
          (a.review_status === 'rejected' && a.status !== 'completed'),
      ),
    [assignments],
  );

  const pendingApplications = useMemo(
    () => applications.filter((a) => a.status === 'pending'),
    [applications],
  );

  const rejectedApplications = useMemo(
    () => applications.filter((a) => a.status === 'rejected'),
    [applications],
  );

  const progressByAssignment = useMemo(() => {
    const totalBy = new Map<string, number>();
    for (const c of assignmentTestCases) {
      totalBy.set(c.assignment_id, (totalBy.get(c.assignment_id) ?? 0) + 1);
    }
    const completedBy = new Map<string, Set<string>>();
    for (const r of testCaseResults) {
      if (!COMPLETED_RESULT_STATUSES.includes(r.status ?? '')) continue;
      if (!completedBy.has(r.assignment_id)) completedBy.set(r.assignment_id, new Set());
      completedBy.get(r.assignment_id)!.add(r.assignment_test_case_id);
    }
    const map = new Map<string, AssignmentProgress>();
    for (const [aid, total] of totalBy) {
      map.set(aid, { total, completed: completedBy.get(aid)?.size ?? 0 });
    }
    return map;
  }, [assignmentTestCases, testCaseResults]);

  // Pass / fail / blocked tallies, de-duplicated per test case so a re-saved
  // result never inflates the totals (mirrors the admin submission review).
  const resultSummaryByAssignment = useMemo(() => {
    const buckets = new Map<
      string,
      { passed: Set<string>; failed: Set<string>; blocked: Set<string> }
    >();
    for (const r of testCaseResults) {
      const s = r.status ?? '';
      if (s !== 'passed' && s !== 'failed' && s !== 'blocked') continue;
      let b = buckets.get(r.assignment_id);
      if (!b) {
        b = { passed: new Set(), failed: new Set(), blocked: new Set() };
        buckets.set(r.assignment_id, b);
      }
      if (s === 'passed') b.passed.add(r.assignment_test_case_id);
      else if (s === 'failed') b.failed.add(r.assignment_test_case_id);
      else b.blocked.add(r.assignment_test_case_id);
    }
    const map = new Map<string, ResultSummary>();
    for (const [aid, b] of buckets) {
      map.set(aid, { passed: b.passed.size, failed: b.failed.size, blocked: b.blocked.size });
    }
    return map;
  }, [testCaseResults]);

  const lastActivityByAssignment = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      const t = s.last_activity_at ?? s.updated_at ?? s.created_at;
      if (!t) continue;
      const cur = map.get(s.assignment_id);
      if (!cur || t > cur) map.set(s.assignment_id, t);
    }
    return map;
  }, [sessions]);

  const earnings = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let paid = 0;
    for (const p of payments) {
      const minor = p.reward_amount_minor ?? 0;
      const s = p.status ?? 'pending';
      if (s === 'paid') paid += minor;
      else if (s === 'approved') approved += minor;
      else if (s === 'pending' || s === 'pending_review') pending += minor;
    }
    return { pendingMinor: pending, approvedMinor: approved, paidMinor: paid, totalMinor: approved + paid };
  }, [payments]);

  return {
    loading,
    error,
    reload: load,
    assignments,
    payments,
    jobs,
    projects,
    applications,
    jobById,
    projectById,
    availableJobs,
    activeAssignments,
    awaitingReviewAssignments,
    completedAssignments,
    inactiveAssignments,
    pendingApplications,
    rejectedApplications,
    progressByAssignment,
    lastActivityByAssignment,
    resultSummaryByAssignment,
    assignmentById,
    earnings,
  };
}