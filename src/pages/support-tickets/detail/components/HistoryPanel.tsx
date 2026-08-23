import { useState } from 'react';
import type { TicketEvent } from '@/types/support-tickets';
import { formatFullDateTime } from '@/pages/support-tickets/constants';

const eventMeta: Record<string, { label: string; icon: string }> = {
  ticket_created: { label: 'Created', icon: 'ri-add-circle-line' },
  status_changed: { label: 'Status changed', icon: 'ri-git-commit-line' },
  priority_changed: { label: 'Priority changed', icon: 'ri-flag-line' },
  assigned: { label: 'Assigned', icon: 'ri-user-add-line' },
  staff_reply: { label: 'Staff reply', icon: 'ri-reply-line' },
  internal_note_added: { label: 'Internal note', icon: 'ri-lock-line' },
};

function metaFor(eventType: string) {
  return eventMeta[eventType] ?? { label: eventType.replace(/_/g, ' '), icon: 'ri-time-line' };
}

interface HistoryPanelProps {
  events: TicketEvent[];
}

export default function HistoryPanel({ events }: HistoryPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-background-200/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground-200">
          <i className="ri-history-line text-base w-4 h-4 flex items-center justify-center"></i>
          Ticket history
          <span className="text-xs text-foreground-600">{events.length}</span>
        </span>
        <i
          className={`ri-arrow-down-s-line text-foreground-500 transition-transform w-4 h-4 flex items-center justify-center ${open ? 'rotate-180' : ''}`}
        ></i>
      </button>

      {open && (
        <div className="border-t border-background-200/60 divide-y divide-background-200/40 max-h-[420px] overflow-y-auto">
          {events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground-500 text-center">No history recorded.</p>
          ) : (
            events.map((e) => {
              const meta = metaFor(e.event_type);
              return (
                <div key={e.id} className="px-4 py-2.5 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-background-200/60 flex items-center justify-center shrink-0 mt-0.5">
                    <i className={`${meta.icon} text-xs text-foreground-400 w-3 h-3 flex items-center justify-center`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground-200 capitalize">{meta.label}</span>
                      {e.actor_type && (
                        <span className="text-[10px] text-foreground-600 uppercase tracking-wide whitespace-nowrap">
                          {e.actor_type}
                        </span>
                      )}
                    </div>
                    {e.description && (
                      <p className="text-xs text-foreground-500 mt-0.5 break-words">{e.description}</p>
                    )}
                    <time className="block text-[10px] text-foreground-600 mt-0.5" dateTime={e.created_at}>
                      {formatFullDateTime(e.created_at)}
                    </time>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}