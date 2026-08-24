import { useState } from 'react';
import { useTicketRepairs } from '@/pages/support-customers/hooks';
import {
  repairTypeLabel,
  repairRiskLabels,
  repairRiskColors,
  repairStatusLabels,
  repairStatusColors,
} from '@/pages/support-customers/constants';
import { formatFullDateTime } from '@/pages/support-tickets/constants';
import RepairReviewModal from '@/pages/support-customers/components/RepairReviewModal';
import type { SupportRepairAction } from '@/types/support-customers';

interface RepairPanelProps {
  ticketId: string;
  canApprove: boolean;
  onToast: (message: string, type: 'success' | 'error') => void;
}

function VerificationBadge({ repair }: { repair: SupportRepairAction }) {
  const v = repair.verification;
  if (!v) return null;
  const tone =
    v.status === 'confirmed'
      ? 'bg-emerald-500/15 text-emerald-400'
      : v.status === 'warning'
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-red-500/15 text-red-400';
  const label = v.status === 'confirmed' ? 'Confirmed' : v.status === 'warning' ? 'Warning' : 'Failed';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}>
      <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
      {label}
    </span>
  );
}

export default function RepairPanel({ ticketId, canApprove, onToast }: RepairPanelProps) {
  const { repairs, loading, error } = useTicketRepairs(ticketId);
  const [review, setReview] = useState<SupportRepairAction | null>(null);

  if (loading) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-background-200/60 rounded animate-pulse"></div>
          <div className="h-16 bg-background-200/50 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2 mb-3">
        <i className="ri-tools-line text-sm w-4 h-4 flex items-center justify-center"></i>
        Account Repair
      </h2>

      {error ? (
        <p className="text-sm text-red-400 py-1">{error}</p>
      ) : repairs.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-tools-line text-xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
          </div>
          <p className="text-sm text-foreground-500">No repair actions for this ticket.</p>
          <p className="text-xs text-foreground-600 mt-1">
            Run diagnostics to surface recommended repair actions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {repairs.map((repair) => (
            <div
              key={repair.id}
              className="bg-background-50 border border-background-200/50 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground-100">
                  {repairTypeLabel(repair.action_type)}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <VerificationBadge repair={repair} />
                  <span
                    className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairStatusColors[repair.status]}`}
                  >
                    {repairStatusLabels[repair.status]}
                  </span>
                  <span
                    className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairRiskColors[repair.risk_level]}`}
                  >
                    {repairRiskLabels[repair.risk_level]}
                  </span>
                </div>
              </div>

              {repair.approved_by_name && (
                <p className="text-xs text-foreground-500">Approved by {repair.approved_by_name}</p>
              )}

              {(repair.previous_state || repair.new_state) && (
                <div className="flex items-center gap-2 text-xs text-foreground-400 flex-wrap">
                  {repair.previous_state && <span className="text-foreground-600">{repair.previous_state}</span>}
                  {repair.previous_state && repair.new_state && <span>→</span>}
                  {repair.new_state && <span className="text-foreground-100">{repair.new_state}</span>}
                </div>
              )}

              {repair.result_summary && (
                <p className="text-xs text-foreground-500 break-words">{repair.result_summary}</p>
              )}

              {repair.error_message && (
                <p className="text-xs text-red-400 break-words">{repair.error_message}</p>
              )}

              {repair.rejection_reason && (
                <p className="text-xs text-foreground-500 break-words">
                  Rejected: {repair.rejection_reason}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-foreground-600">
                  {repair.completed_at
                    ? formatFullDateTime(repair.completed_at)
                    : repair.created_at
                      ? formatFullDateTime(repair.created_at)
                      : ''}
                </span>

                {canApprove && (repair.status === 'pending_approval' || repair.status === 'failed' || repair.status === 'approved') && (
                  <button
                    type="button"
                    onClick={() => setReview(repair)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-accent-500/40 text-accent-400 hover:text-accent-300 hover:border-accent-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-shield-check-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    {repair.status === 'pending_approval' ? 'Review' : 'Retry'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RepairReviewModal
        open={review !== null}
        onClose={() => setReview(null)}
        repair={review}
        onAction={onToast}
        onDone={() => setReview(null)}
      />
    </div>
  );
}