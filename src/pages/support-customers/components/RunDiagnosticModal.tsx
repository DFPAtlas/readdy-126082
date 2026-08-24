import { useState } from 'react';
import Modal from '@/components/base/Modal';
import { useAuth } from '@/components/feature/AuthGuard';
import { runDiagnostic } from '@/pages/support-customers/hooks';
import { SCOPE_KEYS, scopeLabels, displayValue } from '@/pages/support-customers/constants';
import type { ScopeKey } from '@/types/support-customers';

interface RunDiagnosticModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  userId?: string | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
  onStarted: (message: string, type: 'success' | 'error') => void;
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

export default function RunDiagnosticModal({
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
  onStarted,
  onDone,
}: RunDiagnosticModalProps) {
  const auth = useAuth();
  const [scope, setScope] = useState<ScopeKey[]>([...SCOPE_KEYS]);
  const [submitting, setSubmitting] = useState(false);

  const toggleScope = (key: ScopeKey) => {
    setScope((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  };

  const reset = () => setScope([...SCOPE_KEYS]);

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const start = async () => {
    setSubmitting(true);
    const res = await runDiagnostic({
      customer_id: customerId,
      site_id: siteId ?? null,
      user_id: userId ?? null,
      ticket_id: ticketId ?? null,
      scope,
    });
    onStarted(res.message, res.success ? 'success' : 'error');
    setSubmitting(false);
    if (res.success) {
      reset();
      onClose();
      onDone();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Run diagnostics" className="max-w-lg">
      <div className="p-5 space-y-5">
        <p className="text-sm text-foreground-400">
          Start a read-only account diagnostic. The n8n support agent will run approved checks and
          return a structured result. No customer credentials are used.
        </p>

        <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          <Row label="Customer">{customerName ?? displayValue(customerEmail)}</Row>
          <Row label="Site / Product">{displayValue(siteName)}</Row>
          {ticketNumber && <Row label="Ticket">{ticketNumber}</Row>}
          <Row label="Requested By">{auth.user?.email ?? 'Not available'}</Row>
        </div>

        <div>
          <p className="text-xs font-label font-semibold text-foreground-400 uppercase tracking-wider mb-2">
            Diagnostic scope
          </p>
          <div className="flex flex-wrap gap-2">
            {SCOPE_KEYS.map((key) => {
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
                  {scopeLabels[key]}
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
            disabled={submitting || scope.length === 0}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            <i className="ri-stethoscope-line w-4 h-4 flex items-center justify-center"></i>
            {submitting ? 'Starting…' : 'Confirm & Run'}
          </button>
        </div>
      </div>
    </Modal>
  );
}