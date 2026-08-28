import { Link } from 'react-router-dom';
import type { UatAssignment, UatJob, UatProject } from '@/pages/admin/website-uat/types';
import { ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUS_LABELS } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import { formatDate } from '../types';
import type { AssignmentProgress } from '../hooks';
import ProgressBar from './ProgressBar';
import EmptyState from './EmptyState';

interface Props {
  assignments: UatAssignment[];
  jobById: Map<string, UatJob>;
  projectById: Map<string, UatProject>;
  progressByAssignment: Map<string, AssignmentProgress>;
  lastActivityByAssignment: Map<string, string>;
}

export default function ActiveTab({
  assignments,
  jobById,
  projectById,
  progressByAssignment,
  lastActivityByAssignment,
}: Props) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon="ri-play-circle-line"
        title="No active tests"
        description="You do not currently have an active UAT assignment."
      />
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const job = jobById.get(a.job_id);
        const project = job ? projectById.get(job.project_id) : undefined;
        const statusColor = ASSIGNMENT_STATUS_COLORS[a.status] ?? 'bg-foreground-500/10 text-foreground-500';
        const statusLabel = ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status;
        const progress = progressByAssignment.get(a.id) ?? { total: 0, completed: 0 };
        const lastActivity = lastActivityByAssignment.get(a.id);
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

            <div className="mt-4">
              <ProgressBar completed={progress.completed} total={progress.total} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-400">
              <span className="flex items-center gap-1.5">
                <i className="ri-calendar-check-line w-4 h-4 flex items-center justify-center"></i>
                Assigned {formatDate(a.created_at)}
              </span>
              {a.deadline && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
                  Due {formatDate(a.deadline)}
                </span>
              )}
              {lastActivity && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-history-line w-4 h-4 flex items-center justify-center"></i>
                  Last activity {formatDate(lastActivity)}
                </span>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Link
                to={`/account/uat/assignment/${a.id}/run`}
                className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
              >
                Continue Test
              </Link>
              <Link
                to={`/account/uat/assignment/${a.id}`}
                className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                View Details
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}