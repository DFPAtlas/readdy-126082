import type { UatJobApplication, UatJob, UatProject } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import { formatDate } from '../types';
import EmptyState from './EmptyState';

interface Props {
  pending: UatJobApplication[];
  rejected: UatJobApplication[];
  jobById: Map<string, UatJob>;
  projectById: Map<string, UatProject>;
}

export default function PendingApprovalTab({ pending, rejected, jobById, projectById }: Props) {
  if (pending.length === 0 && rejected.length === 0) {
    return (
      <EmptyState
        icon="ri-hourglass-line"
        title="No pending applications"
        description="Your applications that are awaiting DFP approval will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((app) => {
        const job = jobById.get(app.job_id);
        const project = job ? projectById.get(job.project_id) : undefined;
        return (
          <div key={app.id} className="bg-background-100 border border-background-200/60 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-heading text-base font-semibold text-foreground-50">
                    {job?.title ?? 'UAT Test'}
                  </h3>
                </div>
                <p className="text-sm text-foreground-500">{project?.name ?? '—'}</p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-lg font-heading font-semibold text-foreground-100">
                  {job ? formatMinorCurrency(job.reward_amount_minor, job.currency) : '—'}
                </p>
                <p className="text-xs text-foreground-500">listed reward</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-400">
              <span className="flex items-center gap-1.5">
                <i className="ri-send-plane-line w-4 h-4 flex items-center justify-center"></i>
                Applied {formatDate(app.created_at)}
              </span>
              <span className="text-[11px] font-label px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 whitespace-nowrap">
                Awaiting DFP Approval
              </span>
            </div>
          </div>
        );
      })}

      {rejected.map((app) => {
        const job = jobById.get(app.job_id);
        const project = job ? projectById.get(job.project_id) : undefined;
        return (
          <div key={app.id} className="bg-background-100 border border-background-200/60 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-foreground-50">{job?.title ?? 'UAT Test'}</h3>
                <p className="text-sm text-foreground-500 mt-0.5">{project?.name ?? '—'}</p>
              </div>
              <span className="text-[11px] font-label px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 whitespace-nowrap shrink-0">
                Not Approved
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-400">
              <span className="flex items-center gap-1.5">
                <i className="ri-calendar-check-line w-4 h-4 flex items-center justify-center"></i>
                Applied {formatDate(app.created_at)}
              </span>
            </div>

            {app.decision_reason && (
              <div className="mt-4 p-4 bg-background-50 border border-background-200/60 rounded-lg">
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Feedback</p>
                <p className="text-sm text-foreground-300 leading-relaxed">{app.decision_reason}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}