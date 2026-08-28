import { useMemo } from 'react';
import type { UatAssignment, UatJob, UatProject, UatReward } from '@/pages/admin/website-uat/types';
import { REWARD_STATUS_COLORS, REWARD_STATUS_LABELS } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import { formatDate, normalizeRewardStatus } from '../types';
import EmptyState from './EmptyState';

interface Props {
  assignments: UatAssignment[];
  payments: UatReward[];
  jobById: Map<string, UatJob>;
  projectById: Map<string, UatProject>;
}

export default function CompletedTab({ assignments, payments, jobById, projectById }: Props) {
  const paymentByAssignment = useMemo(
    () => new Map(payments.map((p) => [p.assignment_id, p])),
    [payments],
  );

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon="ri-check-double-line"
        title="No completed tests yet"
        description="Completed UAT work will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const job = jobById.get(a.job_id);
        const project = job ? projectById.get(job.project_id) : undefined;
        const payment = paymentByAssignment.get(a.id);
        const rStatus = normalizeRewardStatus(payment?.status);
        const rColor = REWARD_STATUS_COLORS[rStatus] ?? 'bg-foreground-500/10 text-foreground-500';
        const rLabel = REWARD_STATUS_LABELS[rStatus] ?? rStatus;
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
                <p className="text-xs text-foreground-500">reward</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-400">
              <span className="flex items-center gap-1.5">
                <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                Completed {formatDate(a.completed_at ?? a.reviewed_at ?? a.submitted_at)}
              </span>
              <span className={`text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${rColor}`}>
                {rLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}