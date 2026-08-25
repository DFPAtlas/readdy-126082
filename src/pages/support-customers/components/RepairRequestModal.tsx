import { useState } from 'react';
import Modal from '@/components/base/Modal';
import { useAuth } from '@/components/feature/AuthGuard';
import { requestRepair } from '@/pages/support-customers/hooks';
import {
  repairTypeLabel,
  repairRiskLabels,
  repairRiskColors,
  displayValue,
} from '@/pages/support-customers/constants';
import type { RecommendedRepair } from '@/types/support-customers';

interface RepairRequestModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  userId?: string | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
  diagnosticRunId?: string | null;
  recommendation: RecommendedRepair | null;
  onRequested: (message: string, type: 'success' | 'error') => void;
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

export default function RepairRequestModal({
  open,
  onClose,
  customerId,
  customerName,
  customerEmail,
  siteId,
  siteName,
  userId,
  ticketId,
  ticketNumber,
  diagnosticRunId,
  recommendation,
  onRequested,
  onDone,
}: RepairRequestModalProps) {
  const auth = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const risk = recommendation?.risk_level ?? null;
  const executable = risk === 'low' || risk === 'medium';

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async () => {
    if (!recommendation) return;
    setSubmitting(true);
    const res = await requestRepair({
      ticketId: ticketId ?? null,
      customerId,
      siteId: siteId ?? null,
      userId: userId ?? null,
      diagnosticRunId: diagnosticRunId ?? null,
      recommendation,
    });
    onRequested(res.message, res.success ? 'success' : 'error');
    setSubmitting(false);
    if (res.success) {
      onClose();
      onDone();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Review recommended repair" className="max-w-lg">
      <div className="p-5 space-y-5">
        <p className="text-sm text-foreground-400">
          A repair action is suggested but never executed automatically. Request approval for a
          controlled, human-reviewed change.
        </p>

        <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          <Row label="Customer">{customerName ?? displayValue(customerEmail)}</Row>
          <Row label="Site / Product">{displayValue(siteName)}</Row>
          {ticketNumber && <Row label="Ticket">{ticketNumber}</Row>}
          <Row label="Requested By">{auth.user?.email ?? 'Not available'}</Row>
        </div>

        {!recommendation ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-6 text-center">
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-search-eye-line text-lg text-foreground-500 w-5 h-5 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-foreground-400">Manual investigation required.</p>
            <p className="text-xs text-foreground-600 mt-1">
              No safe repair action could be determined from the diagnostic result.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
              <Row label="Problem Detected">{displayValue(recommendation.problem_detected)}</Row>
              <Row label="Recommended Action">{repairTypeLabel(recommendation.action_type)}</Row>
              <Row label="Reason">{displayValue(recommendation.reason)}</Row>
              <Row label="Requested Change">{displayValue(recommendation.requested_change)}</Row>
              <Row label="Current Value">{displayValue(recommendation.current_value)}</Row>
              <Row label="Proposed Value">{displayValue(recommendation.proposed_value)}</Row>
              <Row label="Risk Level">
                <span
                  className={`inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairRiskColors[recommendation.risk_level]}`}
                >
                  {repairRiskLabels[recommendation.risk_level]}
                </span>
              </Row>
            </div>

            {recommendation.security_related && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <i className="ri-shield-flash-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                <span className="text-xs text-red-300">
                  Security related — do not clear security restrictions without a security review.
                </span>
              </div>
            )}

            {!executable && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                <i className="ri-lock-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                <span className="text-xs text-amber-300">
                  Manual administrative process required. This action cannot be executed through this workflow.
                </span>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !recommendation || !executable}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center"></i>
            {submitting ? 'Requesting…' : 'Request Approval'}
          </button>
        </div>
      </div>
    </Modal>
  );
}