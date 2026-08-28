import type { UatAssignment, UatJob, UatProject } from '@/pages/admin/website-uat/types';
import { ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUS_LABELS } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import { formatDate } from '../types';
import EmptyState from './EmptyState';

interface Props {
  assignments: UatAssignment[];
  jobById: Map<string, UatJob>;
  projectById: Map<string, UatProject>;
}

export default function CancelledTab({ assignments, jobById, projectById }: Props) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon="ri-close-circle-line"
        title="No cancelled, expired or rejected tests"
        description="Tests that were cancelled, reached their deadline, or were rejected will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const job = jobById.get(a.job_id);
        const project = job ? projectById.get(job.project_id) : undefined;
        // A rejected submission is surfaced as terminal even though its raw
        // `status` may still read "submitted".
        const rejected = a.review_status === 'rejected';
        const statusColor = rejected
          ? 'bg-red-500/10 text-red-400'
          : ASSIGNMENT_STATUS_COLORS[a.status] ?? 'bg-foreground-500/10 text-foreground-500';
        const statusLabel = rejected ? 'Rejected' : ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status;
        return (
          <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-heading text-base font-semibold text-foreground-50">{job?.title ?? 'UAT Test'}</h3>
                  <span className={`text-[11px] font-label px-2 py-0.5 rounded-full ${statusColor} whitespace-nowrap`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="text-sm text-foreground-500">{project?.name ?? '—'}</p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-lg font-heading font-semibold text-foreground-100">
                  {formatMinorCurrency(a.agreed_reward_amount_minor, a.currency)}
                </p>
                <p className="text-xs text-foreground-500">agreed reward</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-400">
              <span className="flex items-center gap-1.5">
                <i className="ri-calendar-check-line w-4 h-4 flex items-center justify-center"></i>
                Assigned {formatDate(a.created_at)}
              </span>
              {a.deadline && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
                  Deadline {formatDate(a.deadline)}
                </span>
              )}
            </div>

            {rejected && a.review_feedback && (
              <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Reason</p>
                <p className="text-sm text-foreground-400 leading-relaxed">{a.review_feedback}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}