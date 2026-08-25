import { useState } from 'react';
import Modal from '@/components/base/Modal';
import { useCustomerSearch, linkTicketCustomer } from '@/pages/support-customers/hooks';
import { displayValue, formatShortId } from '@/pages/support-customers/constants';
import CustomerResultCard from '@/pages/support-customers/components/CustomerResultCard';
import type { CustomerSearchResult } from '@/types/support-customers';
import type { TicketDetailRecord } from '../hooks';

interface LinkCustomerModalProps {
  open: boolean;
  onClose: () => void;
  ticket: TicketDetailRecord;
  onLinked: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export default function LinkCustomerModal({
  open,
  onClose,
  ticket,
  onLinked,
  onToast,
}: LinkCustomerModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CustomerSearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { results, loading, error, searched, search } = useCustomerSearch();

  const isClient = selected?.entity_type === 'client';

  const reset = () => {
    setQuery('');
    setSelected(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runSearch = () => search(query);

  const confirmLink = async () => {
    if (!selected) return;
    setSubmitting(true);
    const clientOnly = selected.entity_type === 'client';
    const res = await linkTicketCustomer(
      ticket.id,
      clientOnly ? null : selected.customer_id,
      clientOnly ? selected.organisation_id : null,
      ticket.site_id,
    );
    onToast(res.message, res.success ? 'success' : 'error');
    setSubmitting(false);
    if (res.success) {
      reset();
      onLinked();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Link Customer" className="max-w-xl">
      <div className="p-5 space-y-4">
        {!selected ? (
          <>
            <p className="text-sm text-foreground-400">
              Search for the customer to attach to ticket{' '}
              <span className="font-mono text-foreground-200">{ticket.ticket_number}</span>. You must
              confirm the match before the relationship is saved.
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 w-4 h-4 flex items-center justify-center"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  placeholder="Name, email, user ID, organisation, site or ticket number"
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={runSearch}
                disabled={loading || !query.trim()}
                className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
              >
                Search
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {loading && (
                <div className="space-y-2">
                  <div className="h-16 bg-background-100 rounded-lg animate-pulse"></div>
                  <div className="h-16 bg-background-100 rounded-lg animate-pulse"></div>
                </div>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              {!loading && !error && searched && results.length === 0 && (
                <p className="text-sm text-foreground-500 py-4 text-center">No customers found.</p>
              )}
              {!loading &&
                results.map((r) => (
                  <CustomerResultCard
                    key={r.entity_type === 'client' ? `org-${r.organisation_id}` : `user-${r.customer_id}`}
                    result={r}
                    onClick={() => setSelected(r)}
                  />
                ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-400">
              Confirm the relationship before saving. This link is recorded in the audit log.
            </p>
            <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
              <div className="flex items-start justify-between gap-3 p-3">
                <span className="text-xs text-foreground-600">Ticket</span>
                <span className="text-sm text-foreground-200 font-mono">{ticket.ticket_number}</span>
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <span className="text-xs text-foreground-600">Type</span>
                <span className="text-sm text-foreground-200">
                  {isClient ? 'Client / Organisation' : 'User Customer'}
                </span>
              </div>
              {isClient && selected.organisation_name && (
                <div className="flex items-start justify-between gap-3 p-3">
                  <span className="text-xs text-foreground-600">Organisation</span>
                  <span className="text-sm text-foreground-200">{selected.organisation_name}</span>
                </div>
              )}
              {isClient && selected.company_name && (
                <div className="flex items-start justify-between gap-3 p-3">
                  <span className="text-xs text-foreground-600">Company</span>
                  <span className="text-sm text-foreground-200">{selected.company_name}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 p-3">
                <span className="text-xs text-foreground-600">Contact</span>
                <span className="text-sm text-foreground-200">{selected.full_name ?? 'Unknown name'}</span>
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <span className="text-xs text-foreground-600">Email</span>
                <span className="text-sm text-foreground-200 break-all">{displayValue(selected.email)}</span>
              </div>
              {isClient && selected.status && (
                <div className="flex items-start justify-between gap-3 p-3">
                  <span className="text-xs text-foreground-600">Status</span>
                  <span className="text-sm text-foreground-200">{selected.status}</span>
                </div>
              )}
              {!isClient && (
                <div className="flex items-start justify-between gap-3 p-3">
                  <span className="text-xs text-foreground-600">User ID</span>
                  <span className="text-sm text-foreground-200 font-mono">{formatShortId(selected.customer_id)}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 p-3">
                <span className="text-xs text-foreground-600">Site</span>
                <span className="text-sm text-foreground-200">{ticket.site_name}</span>
              </div>
            </div>

            {isClient && (
              <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                This client has no portal account. The ticket will be linked to the organisation only.
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Back
              </button>
              <button
                type="button"
                onClick={confirmLink}
                disabled={submitting}
                className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
              >
                {submitting ? 'Linking…' : 'Confirm link'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}