import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTester } from '@/components/feature/TesterAuthGuard';
import type {
  UatAssignment,
  UatJob,
  UatProject,
  UatEnvironment,
  UatReward,
} from '@/pages/admin/website-uat/types';
import {
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  REWARD_STATUS_COLORS,
  REWARD_STATUS_LABELS,
} from '@/pages/admin/website-uat/types';
import { formatMinorCurrency, DEVICE_LABELS, BROWSER_LABELS } from '@/pages/admin/website-uat/marketplace';
import { formatDate, normalizeRewardStatus, TESTER_REVIEW_STATUS_LABELS, TESTER_REVIEW_STATUS_COLORS } from '../types';
import ProgressBar from '../components/ProgressBar';

const ACTIVE_STATUSES = ['assigned', 'reserved', 'in_progress', 'testing'];
const COMPLETED_RESULT_STATUSES = ['passed', 'failed', 'blocked', 'skipped', 'needs_retest'];

interface DetailState {
  loading: boolean;
  error: string;
  assignment: UatAssignment | null;
  job: UatJob | null;
  project: UatProject | null;
  environment: UatEnvironment | null;
  payment: UatReward | null;
  progress: { total: number; completed: number };
  resultSummary: { passed: number; failed: number; blocked: number };
  lastActivity: string | null;
}

/**
 * Tester-facing assignment detail. Reads only the caller's own assignment
 * (RLS `select_own`), so a request for another tester's assignment id safely
 * resolves to "not found" without leaking existence. Test credentials / staging
 * URLs are shown only here, only for an authorised (active) assignment, and
 * never include admin/secret surfaces.
 */
export default function AssignmentDetail() {
  const { assignmentId } = useParams();
  const { tester } = useTester();
  const [state, setState] = useState<DetailState>({
    loading: true,
    error: '',
    assignment: null,
    job: null,
    project: null,
    environment: null,
    payment: null,
    progress: { total: 0, completed: 0 },
    resultSummary: { passed: 0, failed: 0, blocked: 0 },
    lastActivity: null,
  });

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const { data: a, error: ae } = await supabase
          .from('uat_assignments')
          .select('*')
          .eq('id', assignmentId)
          .maybeSingle();
        if (ae) throw ae;
        if (!a) {
          if (!cancelled) setState((s) => ({ ...s, loading: false, error: 'Assignment not found.' }));
          return;
        }
        const assignment = a as UatAssignment;

        const { data: j } = await supabase
          .from('uat_jobs')
          .select('*')
          .eq('id', assignment.job_id)
          .maybeSingle();
        const job = (j as UatJob) ?? null;

        const [prRes, envRes, payRes, atcRes, tcrRes, sRes] = await Promise.all([
          job
            ? supabase.from('uat_projects').select('*').eq('id', job.project_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          job?.environment_id
            ? supabase
                .from('uat_environments')
                .select('*')
                .eq('id', job.environment_id)
                .eq('is_active', true)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          tester
            ? supabase
                .from('uat_payments')
                .select('*')
                .eq('assignment_id', assignmentId)
                .eq('tester_id', tester.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('uat_assignment_test_cases')
            .select('id,assignment_id,status')
            .eq('assignment_id', assignmentId),
          supabase
            .from('uat_test_case_results')
            .select('assignment_id,assignment_test_case_id,status')
            .eq('assignment_id', assignmentId),
          supabase
            .from('uat_sessions')
            .select('assignment_id,last_activity_at,updated_at,created_at')
            .eq('assignment_id', assignmentId),
        ]);

        if (cancelled) return;

        // Progress: total = assigned test cases; completed = distinct cases with
        // a terminal result. Derived from real rows, never fabricated.
        const total = (atcRes.data ?? []).length;
        const completedSet = new Set<string>();
        for (const r of tcrRes.data ?? []) {
          if (COMPLETED_RESULT_STATUSES.includes(r.status ?? '')) {
            completedSet.add(r.assignment_test_case_id);
          }
        }

        // Pass / fail / blocked tallies, de-duplicated per test case.
        const passedSet = new Set<string>();
        const failedSet = new Set<string>();
        const blockedSet = new Set<string>();
        for (const r of tcrRes.data ?? []) {
          const s = r.status ?? '';
          if (s === 'passed') passedSet.add(r.assignment_test_case_id);
          else if (s === 'failed') failedSet.add(r.assignment_test_case_id);
          else if (s === 'blocked') blockedSet.add(r.assignment_test_case_id);
        }

        let lastActivity: string | null = null;
        for (const s of sRes.data ?? []) {
          const t = s.last_activity_at ?? s.updated_at ?? s.created_at;
          if (t && (!lastActivity || t > lastActivity)) lastActivity = t;
        }

        setState({
          loading: false,
          error: '',
          assignment,
          job,
          project: (prRes.data as UatProject) ?? null,
          environment: (envRes.data as UatEnvironment) ?? null,
          payment: (payRes.data as UatReward) ?? null,
          progress: { total, completed: completedSet.size },
          resultSummary: {
            passed: passedSet.size,
            failed: failedSet.size,
            blocked: blockedSet.size,
          },
          lastActivity,
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignmentId, tester]);

  if (state.loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-28 bg-background-300/40 rounded"></div>
        <div className="h-44 bg-background-300/30 rounded-lg"></div>
        <div className="h-24 bg-background-300/30 rounded-lg"></div>
      </div>
    );
  }

  if (state.error || !state.assignment) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-14 h-14 bg-background-200/60 rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-question-line text-foreground-500 text-2xl w-7 h-7 flex items-center justify-center"></i>
        </div>
        <p className="text-foreground-400 text-sm mb-4">{state.error || 'Assignment not found.'}</p>
        <Link
          to="/account/uat"
          className="bg-accent-500 text-background-950 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { assignment, job, project, environment, payment, progress, resultSummary, lastActivity } = state;
  const status = assignment.status;
  const statusColor = ASSIGNMENT_STATUS_COLORS[status] ?? 'bg-foreground-500/10 text-foreground-500';
  const statusLabel = ASSIGNMENT_STATUS_LABELS[status] ?? status;
  const isActive = ACTIVE_STATUSES.includes(status);
  const isSubmitted = status === 'submitted' || assignment.submitted_at != null;
  const isCompleted = status === 'completed' || assignment.review_status === 'approved';
  const isTerminal = ['cancelled', 'rejected', 'expired'].includes(status);

  const devices = (job?.required_devices ?? []).map((d) => DEVICE_LABELS[d] ?? d).filter(Boolean);
  const browsers = (job?.required_browsers ?? []).map((b) => BROWSER_LABELS[b] ?? b).filter(Boolean);
  const duration =
    job?.estimated_minutes_min != null && job?.estimated_minutes_max != null
      ? `${job.estimated_minutes_min}–${job.estimated_minutes_max} min`
      : job?.estimated_minutes_max != null
        ? `Up to ${job.estimated_minutes_max} min`
        : '—';

  const rewardStatus = normalizeRewardStatus(payment?.status);
  const rewardColor = REWARD_STATUS_COLORS[rewardStatus] ?? 'bg-foreground-500/10 text-foreground-500';
  const rewardLabel = REWARD_STATUS_LABELS[rewardStatus] ?? rewardStatus;

  const reviewStatus = assignment.review_status ?? 'pending_review';
  const reviewLabel = TESTER_REVIEW_STATUS_LABELS[reviewStatus] ?? 'Awaiting Review';
  const reviewColor = TESTER_REVIEW_STATUS_COLORS[reviewStatus] ?? 'bg-yellow-500/10 text-yellow-400';
  const isRejectedReview = reviewStatus === 'rejected';
  const changesRequested = reviewStatus === 'changes_requested';

  return (
    <div className="space-y-6">
      <Link
        to="/account/uat"
        className="inline-flex items-center gap-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer"
      >
        <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
        Back to dashboard
      </Link>

      {/* Header card */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-heading font-bold text-foreground-50">{job?.title ?? 'UAT Test'}</h1>
              <span className={`text-[11px] font-label px-2.5 py-1 rounded-full ${statusColor} whitespace-nowrap`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-foreground-500">{project?.name ?? '—'}</p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-2xl font-heading font-bold text-foreground-100">
              {formatMinorCurrency(assignment.agreed_reward_amount_minor, assignment.currency)}
            </p>
            <p className="text-xs text-foreground-500">agreed reward</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <Meta label="Estimated time" value={duration} />
          <Meta label="Assigned" value={formatDate(assignment.created_at)} />
          <Meta label="Deadline" value={formatDate(assignment.deadline)} />
          <Meta label="Last activity" value={formatDate(lastActivity)} />
        </div>
      </div>

      {/* Progress */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
        <h2 className="font-heading text-base font-semibold text-foreground-50 mb-4">Progress</h2>
        <ProgressBar completed={progress.completed} total={progress.total} />
      </div>

      {/* Secure testing access — only for authorised (active) assignments */}
      {isActive && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-1">Testing access</h2>
          <p className="text-sm text-foreground-500 mb-4">
            Authorised for this assignment only. Do not share these details.
          </p>
          {environment ? (
            <div className="space-y-3">
              <AccessRow
                label="Test URL"
                value={environment.tester_login_url || environment.login_url || environment.base_url}
                href={environment.tester_login_url || environment.login_url || environment.base_url}
              />
              {(environment.current_build || environment.version) && (
                <AccessRow label="Build" value={environment.current_build || environment.version || '—'} />
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground-400">
              Test environment details are not available yet. Please check back shortly.
            </p>
          )}
        </div>
      )}

      {/* Requirements */}
      {(devices.length > 0 || browsers.length > 0) && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-3">Requirements</h2>
          <div className="flex flex-wrap gap-2">
            {devices.map((d) => (
              <span key={d} className="text-[11px] font-label px-2 py-1 rounded-full bg-secondary-500/10 text-secondary-300 whitespace-nowrap">
                {d}
              </span>
            ))}
            {browsers.map((b) => (
              <span key={b} className="text-[11px] font-label px-2 py-1 rounded-full bg-secondary-500/10 text-secondary-300 whitespace-nowrap">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {job?.test_instructions && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-3">Tester instructions</h2>
          <p className="text-sm text-foreground-400 leading-relaxed whitespace-pre-wrap">{job.test_instructions}</p>
        </div>
      )}

      {job?.evidence_requirements && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-3">Evidence requirements</h2>
          <p className="text-sm text-foreground-400 leading-relaxed whitespace-pre-wrap">{job.evidence_requirements}</p>
        </div>
      )}

      {/* Status-specific action / message panel */}
      {isActive && <ActivePanel assignmentId={assignment.id} />}

      {/* Submission summary — real result totals, shown once work is submitted */}
      {(isSubmitted || isCompleted) && !isActive && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h2 className="font-heading text-base font-semibold text-foreground-50 mb-4">Submission summary</h2>
          <div className="flex flex-wrap gap-3">
            <SummaryStat label="Passed" value={resultSummary.passed} cls="text-emerald-400" />
            <SummaryStat label="Failed" value={resultSummary.failed} cls="text-red-400" />
            <SummaryStat label="Blocked" value={resultSummary.blocked} cls="text-orange-400" />
            <SummaryStat label="Total cases" value={progress.total} cls="text-foreground-100" />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-400">
            <span>Submitted {formatDate(assignment.submitted_at)}</span>
            <span>Agreed reward {formatMinorCurrency(assignment.agreed_reward_amount_minor, assignment.currency)}</span>
          </div>
        </div>
      )}

      {/* Awaiting DFP review */}
      {isSubmitted && !isCompleted && !isActive && !changesRequested && !isRejectedReview && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-time-line text-yellow-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading text-base font-semibold text-foreground-50">Submitted for Review</h2>
                <span className={`text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${reviewColor}`}>
                  {reviewLabel}
                </span>
              </div>
              <p className="text-sm text-foreground-500 mt-1.5">
                Your work is with DFP for review. We&apos;ll let you know the outcome here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* More Information Required */}
      {isSubmitted && !isCompleted && !isActive && changesRequested && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-information-line text-amber-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading text-base font-semibold text-foreground-50">More Information Required</h2>
              {assignment.review_feedback && (
                <p className="text-sm text-foreground-300 leading-relaxed mt-2">{assignment.review_feedback}</p>
              )}
              {assignment.deadline && (
                <p className="text-xs text-foreground-500 mt-3 flex items-center gap-1.5">
                  <i className="ri-calendar-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Please respond by {formatDate(assignment.deadline)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submission rejected — preserve results, evidence and history */}
      {isSubmitted && !isCompleted && !isActive && isRejectedReview && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-close-circle-line text-red-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading text-base font-semibold text-foreground-50">Submission Rejected</h2>
              {assignment.review_feedback ? (
                <p className="text-sm text-foreground-400 leading-relaxed mt-2">{assignment.review_feedback}</p>
              ) : (
                <p className="text-sm text-foreground-500 mt-1.5">
                  This submission was not accepted. Your results and evidence have been preserved.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accepted / completed — reward state shown separately, never implies paid */}
      {isCompleted && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-check-line text-emerald-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="flex-1">
              <h2 className="font-heading text-base font-semibold text-foreground-50">
                {assignment.review_status === 'approved' ? 'Submission Accepted' : 'Completed'}
              </h2>
              <p className="text-sm text-foreground-500 mt-1.5">
                Completed {formatDate(assignment.completed_at ?? assignment.reviewed_at ?? assignment.submitted_at)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Agreed Reward</p>
                  <p className="text-base font-heading font-semibold text-foreground-100 mt-0.5">
                    {formatMinorCurrency(assignment.agreed_reward_amount_minor, assignment.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Reward Status</p>
                  <span className={`inline-block mt-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${rewardColor}`}>
                    {rewardLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTerminal && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-foreground-500/10 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-close-circle-line text-foreground-400 text-xl w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground-50">{statusLabel}</h2>
              <p className="text-sm text-foreground-500 mt-1">
                {status === 'expired'
                  ? 'This test reached its deadline and is no longer active.'
                  : 'This test is no longer active.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-sm text-foreground-200 mt-1">{value}</p>
    </div>
  );
}

function SummaryStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 min-w-[88px]">
      <p className={`text-2xl font-heading font-bold ${cls}`}>{value}</p>
      <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mt-0.5 whitespace-nowrap">{label}</p>
    </div>
  );
}

function AccessRow({ label, value, href }: { label: string; value: string | null | undefined; href?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5 border-b border-background-200/60 last:border-0">
      <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-sm text-accent-400 hover:text-accent-300 font-medium break-all cursor-pointer"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-foreground-200 break-all">{value}</span>
      )}
    </div>
  );
}

function ActivePanel({ assignmentId }: { assignmentId: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex-1">
        <h2 className="font-heading text-base font-semibold text-foreground-50">Ready to continue?</h2>
        <p className="text-sm text-foreground-500 mt-1">
          Work through your test cases one by one, record PASS / FAIL / BLOCKED results, and submit your UAT.
        </p>
      </div>
      <Link
        to={`/account/uat/assignment/${assignmentId}/run`}
        className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
      >
        Continue Test
      </Link>
    </div>
  );
}