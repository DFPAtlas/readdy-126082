import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  TicketNotification,
  TicketNotificationType,
  TicketNotificationStatus,
} from '@/types/support-tickets';

const typeLabels: Record<TicketNotificationType, string> = {
  new_ticket: 'New ticket alert',
  customer_reply: 'Customer reply alert',
  staff_reply: 'Customer email',
  assignment: 'Assignment alert',
  overdue: 'Overdue alert',
  urgent_ticket: 'Urgent ticket alert',
  daily_summary: 'Daily summary',
};

const statusMeta: Record<TicketNotificationStatus, { label: string; cls: string; icon: string }> = {
  queued: { label: 'Queued', cls: 'bg-secondary-500/15 text-secondary-300', icon: 'ri-time-line' },
  sending: { label: 'Sending', cls: 'bg-secondary-500/15 text-secondary-300', icon: 'ri-loader-4-line' },
  sent: { label: 'Sent', cls: 'bg-primary-500/15 text-primary-400', icon: 'ri-send-plane-line' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-500/15 text-emerald-400', icon: 'ri-check-double-line' },
  failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-400', icon: 'ri-error-warning-line' },
  cancelled: { label: 'Cancelled', cls: 'bg-foreground-500/10 text-foreground-400', icon: 'ri-close-circle-line' },
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
}

interface NotificationStatusProps {
  ticketId: string;
  canRetry: boolean;
}

export default function NotificationStatus({ ticketId, canRetry }: NotificationStatusProps) {
  const [notifications, setNotifications] = useState<TicketNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_ticket_notifications')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });
      if (error) {
        setNotifications([]);
        return;
      }
      setNotifications((data ?? []) as TicketNotification[]);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (n: TicketNotification) => {
    if (!n.message_id) return;
    setRetrying(true);
    setMessage(null);
    try {
      const { data: msg } = await supabase
        .from('internal_ticket_messages')
        .select('message_body')
        .eq('id', n.message_id)
        .maybeSingle();
      const body = (msg?.message_body ?? '') as string;
      const { data, error } = await supabase.functions.invoke('notify-support-ticket-reply', {
        body: { ticket_id: ticketId, message_id: n.message_id, message_body: body },
      });
      if (error) {
        setMessage('Retry failed. Please try again.');
      } else {
        const d = data as { status?: string } | null;
        setMessage(d?.status === 'sent' ? 'Email re-sent.' : 'Retry completed.');
        load();
      }
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground-200">
          <i className="ri-mail-send-line text-base w-4 h-4 flex items-center justify-center"></i>
          Email notifications
        </span>
      </div>

      {notifications.length === 0 ? (
        <p className="px-4 py-5 text-sm text-foreground-500 text-center">
          No email notifications recorded for this ticket yet.
        </p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {notifications.map((n) => {
            const meta = statusMeta[n.status];
            return (
              <div key={n.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${meta.cls}`}>
                    <i className={`${meta.icon} w-3 h-3 flex items-center justify-center`}></i>
                    {meta.label}
                  </span>
                  <span className="text-xs text-foreground-300 font-medium">{typeLabels[n.notification_type]}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-foreground-500">
                  <span className="truncate max-w-[220px]">{n.recipient_email}</span>
                  {n.sent_at && <span>· sent {formatTime(n.sent_at)}</span>}
                  {n.delivered_at && <span className="text-emerald-400">· delivered {formatTime(n.delivered_at)}</span>}
                  {n.last_error_code && (
                    <span className="text-red-400">· {n.last_error_code}</span>
                  )}
                  {n.status === 'failed' && canRetry && n.notification_type === 'staff_reply' && (
                    <button
                      type="button"
                      onClick={() => retry(n)}
                      disabled={retrying}
                      className="ml-auto text-[11px] font-medium text-accent-400 hover:text-accent-300 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {message && (
        <p className="px-4 py-2 text-xs text-foreground-500 border-t border-background-200/60" role="status">
          {message}
        </p>
      )}
    </div>
  );
}