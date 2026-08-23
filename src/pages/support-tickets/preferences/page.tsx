import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import type { TicketNotificationPreferences } from '@/types/support-tickets';

interface ToggleField {
  key: keyof Pick<
    TicketNotificationPreferences,
    | 'notify_new_ticket'
    | 'notify_customer_reply'
    | 'notify_assignment'
    | 'notify_overdue'
    | 'notify_urgent'
    | 'daily_summary'
  >;
  label: string;
  description: string;
  icon: string;
}

const FIELDS: ToggleField[] = [
  {
    key: 'notify_new_ticket',
    label: 'New tickets',
    description: 'Email me when a new support ticket arrives.',
    icon: 'ri-mail-add-line',
  },
  {
    key: 'notify_urgent',
    label: 'Urgent tickets',
    description: 'Email me immediately for urgent or critical tickets.',
    icon: 'ri-alarm-warning-line',
  },
  {
    key: 'notify_customer_reply',
    label: 'Customer replies',
    description: 'Email me when a customer replies to a ticket.',
    icon: 'ri-chat-1-line',
  },
  {
    key: 'notify_assignment',
    label: 'Assignments',
    description: 'Email me when a ticket is assigned to me.',
    icon: 'ri-user-add-line',
  },
  {
    key: 'notify_overdue',
    label: 'Overdue tickets',
    description: 'Email me when a ticket becomes overdue.',
    icon: 'ri-timer-line',
  },
  {
    key: 'daily_summary',
    label: 'Daily summary',
    description: 'Email me a daily digest of my support activity.',
    icon: 'ri-calendar-check-line',
  },
];

type PrefState = Record<ToggleField['key'], boolean>;

const DEFAULTS: PrefState = {
  notify_new_ticket: false,
  notify_customer_reply: false,
  notify_assignment: true,
  notify_overdue: false,
  notify_urgent: false,
  daily_summary: false,
};

export default function NotificationPreferences() {
  const auth = useAuth();
  const [prefs, setPrefs] = useState<PrefState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!auth.user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_ticket_notification_preferences')
        .select('notify_new_ticket,notify_customer_reply,notify_assignment,notify_overdue,notify_urgent,daily_summary')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (error) {
        setFeedback({ type: 'error', message: 'Could not load preferences.' });
        return;
      }
      if (data) {
        const d = data as PrefState;
        setPrefs({
          notify_new_ticket: d.notify_new_ticket,
          notify_customer_reply: d.notify_customer_reply,
          notify_assignment: d.notify_assignment,
          notify_overdue: d.notify_overdue,
          notify_urgent: d.notify_urgent,
          daily_summary: d.daily_summary,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: ToggleField['key']) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setFeedback(null);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc('internal_upsert_notification_preferences', {
        p_notify_new_ticket: prefs.notify_new_ticket,
        p_notify_customer_reply: prefs.notify_customer_reply,
        p_notify_assignment: prefs.notify_assignment,
        p_notify_overdue: prefs.notify_overdue,
        p_notify_urgent: prefs.notify_urgent,
        p_daily_summary: prefs.daily_summary,
      });
      if (error) {
        setFeedback({ type: 'error', message: error.message || 'Save failed.' });
        return;
      }
      setFeedback({ type: 'success', message: 'Preferences saved.' });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link
          to="/support-tickets"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to tickets
        </Link>
        <h1 className="text-2xl font-heading font-bold text-foreground-50 mt-2">Notification preferences</h1>
        <p className="text-sm text-foreground-500 mt-1">
          Choose which support email notifications you receive. These apply to your account only.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-background-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-4 px-4 py-4">
              <div className="w-9 h-9 rounded-lg bg-background-200/60 flex items-center justify-center shrink-0">
                <i className={`${f.icon} text-base text-foreground-300 w-4 h-4 flex items-center justify-center`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-100">{f.label}</p>
                <p className="text-xs text-foreground-500 mt-0.5">{f.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[f.key]}
                aria-label={f.label}
                onClick={() => toggle(f.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  prefs[f.key] ? 'bg-accent-500' : 'bg-background-300/70'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform ${
                    prefs[f.key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                ></span>
              </button>
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}