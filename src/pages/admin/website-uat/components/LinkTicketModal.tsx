import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import { statusColors, statusLabels } from '@/pages/support-tickets/constants';
import type { UatDefectItem, UatDefectTicket } from '../types';

interface Props {
  open: boolean;
  defect: UatDefectItem | null;
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkTicketModal({ open, defect, onClose, onLinked }: Props) {
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<UatDefectTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      let req = supabase
        .from('internal_support_tickets')
        .select('id,ticket_number,status,subject')
        .order('created_at', { ascending: false })
        .limit(30);
      const term = q.trim();
      if (term) {
        req = req.or(`ticket_number.ilike.%${term}%,subject.ilike.%${term}%`);
      }
      const { data, error: err } = await req;
      if (err) throw err;
      setTickets((data || []) as UatDefectTicket[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setError('');
      search('');
    }
  }, [open, search]);

  const link = async (ticketId: string) => {
    if (!defect?.defect?.id) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.rpc('link_uat_defect_ticket', {
        p_feedback_id: defect.defect.id,
        p_ticket_id: ticketId,
      });
      if (err) throw err;
      onLinked();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link ticket.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Link Existing Ticket" variant="default" lockScroll={true}>
      <div className="p-5 space-y-4">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          placeholder="Search by ticket number or subject..."
          className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none"
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-foreground-500">Searching tickets...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-foreground-500">No tickets found.</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => link(t.id)}
                disabled={busy}
                className="w-full text-left bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 hover:border-accent-500/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground-100">{t.ticket_number}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[t.status as keyof typeof statusColors] || 'bg-foreground-500/10 text-foreground-500'}`}>
                    {statusLabels[t.status as keyof typeof statusLabels] || t.status}
                  </span>
                </div>
                <p className="text-xs text-foreground-500 truncate mt-1">{t.subject}</p>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}