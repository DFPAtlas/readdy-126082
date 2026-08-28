import type { UatAssignment, UatJob, UatReward } from '@/pages/admin/website-uat/types';
import { REWARD_STATUS_COLORS, REWARD_STATUS_LABELS } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import { formatDate, normalizeRewardStatus } from '../types';
import type { EarningsSummary } from '../hooks';
import EmptyState from './EmptyState';

interface Props {
  payments: UatReward[];
  jobById: Map<string, UatJob>;
  assignmentById: Map<string, UatAssignment>;
  earnings: EarningsSummary;
  currency: string;
}

export default function EarningsTab({ payments, jobById, assignmentById, earnings, currency }: Props) {
  if (payments.length === 0) {
    return (
      <EmptyState
        icon="ri-money-pound-circle-line"
        title="No earnings yet"
        description="Your approved and paid UAT rewards will appear here."
      />
    );
  }

  const tiles = [
    { label: 'Pending Review', minor: earnings.pendingMinor, icon: 'ri-time-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Approved', minor: earnings.approvedMinor, icon: 'ri-check-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Paid', minor: earnings.paidMinor, icon: 'ri-bank-card-line', accent: 'bg-sky-500/10 text-sky-400' },
    { label: 'Total Earned', minor: earnings.totalMinor, icon: 'ri-money-pound-circle-line', accent: 'bg-secondary-500/10 text-secondary-300' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{t.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.accent}`}>
                <i className={`${t.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
              </div>
            </div>
            <p className="text-xl font-heading font-bold text-foreground-100">{formatMinorCurrency(t.minor, currency)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {payments.map((p) => {
          const job = jobById.get(p.job_id);
          const assignment = assignmentById.get(p.assignment_id);
          const rStatus = normalizeRewardStatus(p.status);
          const rColor = REWARD_STATUS_COLORS[rStatus] ?? 'bg-foreground-500/10 text-foreground-500';
          const rLabel = REWARD_STATUS_LABELS[rStatus] ?? rStatus;
          const completedDate = assignment?.completed_at ?? assignment?.submitted_at ?? p.created_at;
          const rejectReason = rStatus === 'rejected' ? p.rejection_reason : null;
          const cancelReason = rStatus === 'cancelled' ? p.cancellation_reason : null;
          return (
            <div key={p.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-foreground-100 truncate">{job?.title ?? 'UAT Test'}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-foreground-500">
                    <span className="flex items-center gap-1.5">
                      <i className="ri-calendar-check-line w-3.5 h-3.5 flex items-center justify-center"></i>
                      {formatDate(completedDate)}
                    </span>
                    {p.approved_at && <span>Approved {formatDate(p.approved_at)}</span>}
                    {p.paid_at && <span>Paid {formatDate(p.paid_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${rColor}`}>{rLabel}</span>
                  <span className="text-base font-heading font-semibold text-foreground-100 whitespace-nowrap">
                    {formatMinorCurrency(p.reward_amount_minor, p.currency)}
                  </span>
                </div>
              </div>

              {(rejectReason || cancelReason) && (
                <div className="mt-3 p-3 bg-background-50 border border-background-200/60 rounded-lg">
                  <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">
                    {rejectReason ? 'Reason' : 'Reason'}
                  </p>
                  <p className="text-sm text-foreground-400 leading-relaxed">{rejectReason || cancelReason}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}