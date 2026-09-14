import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import { logWorkstreamActivity } from '../workstreamUtils';

interface UnlinkedTicket {
  id: string;
  ticket_number: string;
  subject: string;
  site_name: string | null;
  created_at: string;
}

interface LinkSupportTicketModalProps {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
  projectId: number;
  projectName: string;
}

export default function LinkSupportTicketModal({
  open,
  onClose,
  onLinked,
  projectId,
  projectName,
}: LinkSupportTicketModalProps) {
  const [tickets, setTickets] = useState<UnlinkedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setError('');
    setLoading(true);
    (async () => {
      const configured = Boolean(
        import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
      );
      if (!configured) {
        setError('Support data unavailable — backend is not connected.');
        setLoading(false);
        return;
      }
      try {
        const { data, error: dbError } = await supabase
          .from('internal_support_tickets')
          .select('id,ticket_number,subject,created_at,internal_support_sites(site_name)')
          .is('project_id', null)
          .order('created_at', { ascending: false })
          .limit(50);
        if (dbError) throw dbError;
        setTickets(
          ((data ?? []) as Array<UnlinkedTicket & { internal_support_sites: { site_name: string } | null }>).map(
            (t) => ({
              id: t.id,
              ticket_number: t.ticket_number,
              subject: t.subject,
              site_name: t.internal_support_sites?.site_name ?? null,
              created_at: t.created_at,
            }),
          ),
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load unlinked tickets');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      const { error: dbError } = await supabase
        .from('internal_support_tickets')
        .update({ project_id: projectId })
        .eq('id', selectedId);
      if (dbError) throw dbError;
      const chosen = tickets.find((t) => t.id === selectedId);
      await logWorkstreamActivity(
        projectId,
        'Support ticket linked to project',
        `Support ticket ${chosen?.ticket_number ?? ''} linked to ${projectName}`,
      );
      onLinked();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to link ticket');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link Support Ticket"
      className="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={saving || !selectedId}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            {saving ? 'Linking...' : 'Link Ticket'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <p className="text-sm text-foreground-500">
          Associate an existing, currently-unlinked ticket with <span className="text-foreground-200 font-medium">{projectName}</span>.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-foreground-500">Loading unlinked tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-foreground-500">No unlinked tickets found.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-background-200/60 border border-background-200/60 rounded-lg">
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                  selectedId === t.id ? 'bg-accent-500/10' : 'hover:bg-background-200/40'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs font-mono text-foreground-400">{t.ticket_number}</span>
                  {t.site_name && (
                    <span className="text-[10px] font-label text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {t.site_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground-100 line-clamp-1">{t.subject}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}