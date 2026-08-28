import type { UatAssignment, UatJob, UatProject } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import { formatDate, TESTER_REVIEW_STATUS_LABELS, TESTER_REVIEW_STATUS_COLORS } from '../types';
import type { ResultSummary } from '../hooks';
import EmptyState from './EmptyState';

interface Props {
  assignments: UatAssignment[];
  jobById: Map<string, UatJob>;
  projectById: Map<string, UatProject>;
  resultSummaryByAssignment: Map<string, ResultSummary>;
}

export default function AwaitingReviewTab({
  assignments,
  jobById,
  projectById,
  resultSummaryByAssignment,
}: Props) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon="ri-time-line"
        title="Nothing awaiting review"
        description="Submitted UAT work that is waiting for DFP review will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const job = jobById.get(a.job_id);
        const project = job ? projectById.get(job.project_id) : undefined;
        const changesRequested = a.review_status === 'changes_requested';
        const reviewStatus = a.review_status ?? 'pending_review';
        const reviewLabel = TESTER_REVIEW_STATUS_LABELS[reviewStatus] ?? 'Awaiting Review';
        const reviewColor =
          TESTER_REVIEW_STATUS_COLORS[reviewStatus] ?? 'bg-yellow-500/10 text-yellow-400';
        const summary = resultSummaryByAssignment.get(a.id) ?? { passed: 0, failed: 0, blocked: 0 };
        return (
          <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-foreground-50">{job?.title ?? 'UAT Test'}</h3>
                <p className="text-sm text-foreground-500 mt-0.5">{project?.name ?? '—'}</p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-lg font-heading font-semibold text-foreground-100">
                  {formatMinorCurrency(a.agreed_reward_amount_minor, a.currency)}
                </p>
                <p className="text-xs text-foreground-500">agreed reward</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-400">
              <span className="flex items-center gap-1.5">
                <i className="ri-send-plane-line w-4 h-4 flex items-center justify-center"></i>
                Submitted {formatDate(a.submitted_at)}
              </span>
              <span className={`text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${reviewColor}`}>
                {reviewLabel}
              </span>
            </div>

            {/* Result totals — real data, never hard-coded */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <TotalsPill label="Passed" value={summary.passed} cls="text-emerald-400" />
              <TotalsPill label="Failed" value={summary.failed} cls="text-red-400" />
              <TotalsPill label="Blocked" value={summary.blocked} cls="text-orange-400" />
            </div>

            {changesRequested && (
              <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <i className="ri-information-line text-amber-400 text-lg w-5 h-5 flex items-center justify-center"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground-100">More Information Required</p>
                    {a.review_feedback && (
                      <p className="text-sm text-foreground-400 leading-relaxed mt-1.5">{a.review_feedback}</p>
                    )}
                    {a.deadline && (
                      <p className="text-xs text-foreground-500 mt-2 flex items-center gap-1.5">
                        <i className="ri-calendar-line w-3.5 h-3.5 flex items-center justify-center"></i>
                        Please respond by {formatDate(a.deadline)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TotalsPill({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 whitespace-nowrap">
      <span className={cls}>{value}</span> {label}
    </span>
  );
}