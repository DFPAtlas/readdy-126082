import { useState } from 'react';
import Modal from '@/components/base/Modal';
import { revokeSupportSession } from '@/pages/support-customers/hooks';

interface RevokeSessionModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  customerName?: string | null;
  onRevoked: (message: string, type: 'success' | 'error') => void;
  onDone: () => void;
}

export default function RevokeSessionModal({
  open,
  onClose,
  sessionId,
  customerName,
  onRevoked,
  onDone,
}: RevokeSessionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    onClose();
  };

  const confirm = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    const res = await revokeSupportSession(sessionId, reason.trim());
    onRevoked(res.message, res.success ? 'success' : 'error');
    setSubmitting(false);
    if (res.success) {
      setReason('');
      onClose();
      onDone();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Revoke support session" className="max-w-md">
      <div className="p-5 space-y-4">
        <p className="text-sm text-foreground-300">
          Revoke this staff member&apos;s active read-only session{customerName ? ` for ${customerName}` : ''}.
          Access will be terminated immediately.
        </p>

        <div>
          <p className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider mb-2">
            Revocation reason <span className="text-red-400">*</span>
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Why is this session being revoked?"
            className="w-full bg-background-50 border border-background-300/60 focus:border-red-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-y"
          />
        </div>

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
            onClick={confirm}
            disabled={submitting || reason.trim().length === 0}
            className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            <i className="ri-forbid-line w-4 h-4 flex items-center justify-center"></i>
            {submitting ? 'Revoking…' : 'Revoke Session'}
          </button>
        </div>
      </div>
    </Modal>
  );
}