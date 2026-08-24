import { useState } from 'react';
import Modal from '@/components/base/Modal';
import { useAuth } from '@/components/feature/AuthGuard';
import { approveAndExecuteRepair, rejectRepair, cancelRepair } from '@/pages/support-customers/hooks';
import {
  repairTypeLabel,
  repairRiskLabels,
  repairRiskColors,
  repairStatusLabels,
  repairStatusColors,
  displayValue,
} from '@/pages/support-customers/constants';
import type { SupportRepairAction } from '@/types/support-customers';

interface RepairReviewModalProps {
  open: boolean;
  onClose: () => void;
  repair: SupportRepairAction | null;
  onAction: (message: string, type: 'success' | 'error') => void;
  onDone: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-words min-w-0">{children}</span>
    </div>
  );
}

export default function RepairReviewModal({
  open,
  onClose,
  repair,
  onAction,
  onDone,
}: RepairReviewModalProps) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'idle' | 'confirm' | 'reject'>('idle');
  const [rejectReason, setRejectReason] = useState('');

  const isMedium = repair?.risk_level === 'medium';
  const isPending = repair?.status === 'pending_approval';
  const isOwnRequest = repair?.requested_by === auth.user?.id;

  const reset = () => {
    setMode('idle');
    setRejectReason('');
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const doApprove = async () => {
    if (!repair) return;
    setBusy(true);
    const res = await approveAndExecuteRepair(repair.id);
    onAction(res.message, res.success ? 'success' : 'error');
    setBusy(false);
    if (res.success) {
      reset();
      onClose();
      onDone();
    }
  };

  const doReject = async () => {
    if (!repair) return;
    setBusy(true);
    const res = await rejectRepair(repair.id, rejectReason.trim() || 'No reason provided');
    onAction(res.message, res.success ? 'success' : 'error');
    setBusy(false);
    if (res.success) {
      reset();
      onClose();
      onDone();
    }
  };

  const doCancel = async () => {
    if (!repair) return;
    setBusy(true);
    const res = await cancelRepair(repair.id);
    onAction(res.message, res.success ? 'success' : 'error');
    setBusy(false);
    if (res.success) {
      reset();
      onClose();
      onDone();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Repair review" className="max-w-lg">
      <div className="p-5 space-y-5">
        {!repair ? (
          <p className="text-sm text-foreground-500">No repair selected.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairStatusColors[repair.status]}`}
              >
                {repairStatusLabels[repair.status]}
              </span>
              <span
                className={`inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairRiskColors[repair.risk_level]}`}
              >
                {repairRiskLabels[repair.risk_level]} risk
              </span>
              {repair.security_related && (
                <span className="inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 whitespace-nowrap">
                  <i className="ri-shield-flash-line w-3 h-3 flex items-center justify-center"></i>
                  Security related
                </span>
              )}
            </div>

            <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
              <Row label="Customer">{displayValue(repair.customer_name ?? repair.customer_email)}</Row>
              <Row label="Site / Product">{displayValue(repair.site_name)}</Row>
              <Row label="Problem Detected">{displayValue(repair.problem_detected)}</Row>
              <Row label="Action">{repairTypeLabel(repair.action_type)}</Row>
              <Row label="Reason">{displayValue(repair.reason)}</Row>
              <Row label="Requested Change">{displayValue(repair.requested_change)}</Row>
              <Row label="Current">{displayValue(repair.current_value)}</Row>
              <Row label="Proposed">{displayValue(repair.proposed_value)}</Row>
              <Row label="Requested By">{displayValue(repair.requested_by_name)}</Row>
            </div>

            {/* Second confirmation for higher-risk actions */}
            {mode === 'confirm' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-300">You are about to modify this customer&apos;s account.</p>
                <div className="mt-3 text-sm text-foreground-300 space-y-1">
                  <p>Customer: <span className="text-foreground-100">{displayValue(repair.customer_name ?? repair.customer_email)}</span></p>
                  <p>Action: <span className="text-foreground-100">{repairTypeLabel(repair.action_type)}</span></p>
                  <p>Current: <span className="text-foreground-100">{displayValue(repair.current_value)}</span></p>
                  <p>New: <span className="text-foreground-100">{displayValue(repair.proposed_value)}</span></p>
                </div>
                {isMedium && isOwnRequest && (
                  <p className="text-xs text-amber-400 mt-3">
                    You requested this medium-risk repair. A different authorised staff member must approve it.
                  </p>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={doApprove}
                    disabled={busy || (isMedium && isOwnRequest)}
                    className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                    {busy ? 'Executing…' : 'Confirm Repair'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('idle')}
                    disabled={busy}
                    className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {mode === 'reject' && (
              <div className="space-y-3">
                <label className="text-xs font-label text-foreground-400 uppercase tracking-wider">Rejection reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Why is this repair being rejected?"
                  className="w-full bg-background-50 border border-background-300/60 focus:border-red-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-y"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={doReject}
                    disabled={busy}
                    className="inline-flex items-center gap-2 bg-red-500/20 text-red-200 hover:bg-red-500/30 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    <i className="ri-close-line w-4 h-4 flex items-center justify-center"></i>
                    {busy ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('idle')}
                    disabled={busy}
                    className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {mode === 'idle' && isPending && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => (isMedium ? setMode('confirm') : doApprove())}
                  className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center"></i>
                  Approve &amp; Execute
                </button>
                <button
                  type="button"
                  onClick={() => setMode('reject')}
                  className="inline-flex items-center gap-2 border border-red-500/40 text-red-400 hover:text-red-300 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-close-line w-4 h-4 flex items-center justify-center"></i>
                  Reject
                </button>
                <button
                  type="button"
                  onClick={doCancel}
                  disabled={busy}
                  className="inline-flex items-center gap-2 border border-background-300/60 text-foreground-400 hover:text-foreground-200 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Retry for failed/approved-waiting repairs */}
            {mode === 'idle' && (repair.status === 'failed' || repair.status === 'approved') && (
              <div className="space-y-2">
                {repair.error_message && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <i className="ri-error-warning-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                    <span className="text-xs text-red-300">{repair.error_message}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (isMedium ? setMode('confirm') : doApprove())}
                    disabled={isMedium && isOwnRequest}
                    className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                    Retry
                  </button>
                  {repair.status === 'failed' && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Escalate later
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}