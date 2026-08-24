import { useState } from 'react';
import Modal from '@/components/base/Modal';
import { useAuth } from '@/components/feature/AuthGuard';
import { createSupportSession } from '@/pages/support-customers/hooks';
import {
  displayValue,
  SESSION_DURATIONS,
  SESSION_SCOPE_KEYS,
  sessionScopeLabels,
  type SessionScopeKey,
} from '@/pages/support-customers/constants';

interface SessionRequestModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
  onStarted: (message: string, type: 'success' | 'error') => void;
  onSessionCreated: (sessionId: string) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-words min-w-0">{children}</span>
    </div>
  );
}

const DEFAULT_SCOPE: SessionScopeKey[] = [...SESSION_SCOPE_KEYS];

export default function SessionRequestModal({
  open,
  onClose,
  customerId,
  customerName,
  customerEmail,
  siteId,
  siteName,
  ticketId,
  ticketNumber,
  onStarted,
  onSessionCreated,
}: SessionRequestModalProps) {
  const auth = useAuth();
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [scope, setScope] = useState<SessionScopeKey[]>([...DEFAULT_SCOPE]);
  const [submitting, setSubmitting] = useState(false);

  const toggleScope = (key: SessionScopeKey) => {
    setScope((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  };

  const reset = () => {
    setReason('');
    setDuration(30);
    setScope([...DEFAULT_SCOPE]);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const start = async () => {
    setSubmitting(true);
    const res = await createSupportSession({
      customerId,
      siteId: siteId ?? null,
      ticketId: ticketId ?? null,
      reason: reason.trim(),
      durationMinutes: duration,
      accessScope: scope,
    });
    onStarted(res.message, res.success ? 'success' : 'error');
    setSubmitting(false);
    if (res.success && res.session) {
      reset();
      onClose();
      onSessionCreated(res.session.id);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Start support session" className="max-w-lg">
      <div className="p-5 space-y-5">
        <p className="text-sm text-foreground-400">
          Open a <strong className="text-foreground-200">read-only</strong>, temporary view of this
          customer&apos;s account. No customer password or credentials are used, and no changes can
          be made. All access is audited.
        </p>

        <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          <Row label="Customer">
            {customerName ?? displayValue(customerEmail)}
            {customerEmail && customerName && (
              <span className="block text-xs text-foreground-600">{customerEmail}</span>
            )}
          </Row>
          <Row label="Site / Product">{displayValue(siteName)}</Row>
          {ticketNumber && <Row label="Related Ticket">{ticketNumber}</Row>}
          <Row label="Session Type">
            <span className="inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              <i className="ri-eye-line w-3 h-3 flex items-center justify-center"></i>
              Read Only
            </span>
          </Row>
          <Row label="Requested By">{auth.user?.email ?? 'Not available'}</Row>
        </div>

        <div>
          <p className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider mb-2">
            Reason for access <span className="text-red-400">*</span>
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Investigating the customer's reported dashboard loading issue."
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-y"
          />
        </div>

        <div>
          <p className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider mb-2">
            Duration
          </p>
          <div className="flex gap-2">
            {SESSION_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                aria-pressed={duration === d}
                className={`px-4 py-1.5 rounded-full text-xs border transition-colors cursor-pointer whitespace-nowrap ${
                  duration === d
                    ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                    : 'bg-background-100 border-background-300/60 text-foreground-500 hover:text-foreground-300'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider mb-2">
            Access scope
          </p>
          <div className="flex flex-wrap gap-2">
            {SESSION_SCOPE_KEYS.map((key) => {
              const on = scope.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleScope(key)}
                  aria-pressed={on}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer whitespace-nowrap ${
                    on
                      ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                      : 'bg-background-100 border-background-300/60 text-foreground-500 hover:text-foreground-300'
                  }`}
                >
                  {sessionScopeLabels[key]}
                </button>
              );
            })}
          </div>
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
            onClick={start}
            disabled={submitting || reason.trim().length === 0 || scope.length === 0}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            <i className="ri-eye-line w-4 h-4 flex items-center justify-center"></i>
            {submitting ? 'Starting…' : 'Create Support Session'}
          </button>
        </div>
      </div>
    </Modal>
  );
}