import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { ApprovalDecisionType, RiskLevel } from '@/pages/ai-operations/types';
import { APPROVAL_DECISION_LABELS } from '@/pages/ai-operations/constants';

export interface DecisionPayload {
  type: ApprovalDecisionType;
  reason: string;
  conditions: string;
}

interface DecisionModalProps {
  open: boolean;
  onClose: () => void;
  decisionType: ApprovalDecisionType;
  severity: RiskLevel;
  onSubmit: (payload: DecisionPayload) => void;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

export default function DecisionModal({ open, onClose, decisionType, severity, onSubmit }: DecisionModalProps) {
  const [reason, setReason] = useState('');
  const [conditions, setConditions] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [criticalAck, setCriticalAck] = useState(false);
  const [error, setError] = useState('');

  const needsConditions = decisionType === 'approve_with_conditions';
  const needsAcknowledge = decisionType === 'approve';
  const needsCritical = severity === 'critical';

  useEffect(() => {
    if (open) {
      setReason('');
      setConditions('');
      setAcknowledge(false);
      setCriticalAck(false);
      setError('');
    }
  }, [open, decisionType]);

  const primaryLabel =
    decisionType === 'reject'
      ? 'Rejection reason *'
      : decisionType === 'request_changes'
        ? 'Requested changes *'
        : decisionType === 'request_more_information'
          ? 'Information required *'
          : 'Decision reason *';

  const submit = () => {
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    if (needsConditions && !conditions.trim()) {
      setError('Conditions are required for this decision.');
      return;
    }
    if (needsAcknowledge && !acknowledge) {
      setError('Please confirm the decision.');
      return;
    }
    if (needsCritical && !criticalAck) {
      setError('Please acknowledge the critical-risk warning.');
      return;
    }

    onSubmit({ type: decisionType, reason: reason.trim(), conditions: conditions.trim() });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={APPROVAL_DECISION_LABELS[decisionType]} className="max-w-lg">
      <div className="p-5 space-y-4">
        <p className="text-sm text-foreground-500">
          Recording a {APPROVAL_DECISION_LABELS[decisionType].toLowerCase()} decision updates governance metadata
          only. No production execution will occur.
        </p>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">{primaryLabel}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={`${inputCls} resize-y`} />
        </div>

        {needsConditions && (
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Conditions *</label>
            <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Verify final figures before processing." className={`${inputCls} resize-y`} />
          </div>
        )}

        {needsAcknowledge && (
          <label className="flex items-start gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} className="w-4 h-4 rounded accent-accent-500 mt-0.5 cursor-pointer" />
            <span>I confirm this decision.</span>
          </label>
        )}

        {needsCritical && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <label className="flex items-start gap-2 text-sm text-red-300 cursor-pointer">
              <input type="checkbox" checked={criticalAck} onChange={(e) => setCriticalAck(e.target.checked)} className="w-4 h-4 rounded accent-red-500 mt-0.5 cursor-pointer" />
              <span>I understand this is a critical-risk action and would affect a production system if execution were enabled.</span>
            </label>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] font-label text-foreground-600">Approval recorded — execution runtime is not connected.</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}