import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupportStaffMember, TicketCategory, TicketPriority, TicketSiteSettings, SpamProtectionMode } from '@/types/support-tickets';
import { CATEGORIES, CATEGORY_LABELS, PRIORITIES, PRIORITY_LABELS, SPAM_MODES } from '../constants';
import { logAdminEvent } from '../audit';

interface SettingsPanelProps {
  siteId: string;
  siteName: string;
  settings: TicketSiteSettings | null;
  staff: SupportStaffMember[];
  reload: () => void;
}

interface SettingsState {
  enabled_categories: TicketCategory[];
  default_category: TicketCategory;
  max_public_priority: TicketPriority;
  default_priority: TicketPriority;
  auto_assign: boolean;
  default_assigned_user_id: string;
  notify_customer_confirmation: boolean;
  notify_staff_alert: boolean;
  captcha_required: boolean;
  max_attachment_size_mb: number;
  spam_protection_mode: SpamProtectionMode;
  acknowledgement_text: string;
}

const DEFAULTS: SettingsState = {
  enabled_categories: [...CATEGORIES],
  default_category: 'general',
  max_public_priority: 'high',
  default_priority: 'normal',
  auto_assign: false,
  default_assigned_user_id: '',
  notify_customer_confirmation: true,
  notify_staff_alert: true,
  captcha_required: false,
  max_attachment_size_mb: 10,
  spam_protection_mode: 'standard',
  acknowledgement_text: '',
};

export default function SettingsPanel({ siteId, siteName, settings, staff, reload }: SettingsPanelProps) {
  const [form, setForm] = useState<SettingsState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        enabled_categories: settings.enabled_categories ?? [...CATEGORIES],
        default_category: settings.default_category ?? 'general',
        max_public_priority: settings.max_public_priority ?? 'high',
        default_priority: settings.default_priority ?? 'normal',
        auto_assign: settings.auto_assign ?? false,
        default_assigned_user_id: settings.default_assigned_user_id ?? '',
        notify_customer_confirmation: settings.notify_customer_confirmation ?? true,
        notify_staff_alert: settings.notify_staff_alert ?? true,
        captcha_required: settings.captcha_required ?? false,
        max_attachment_size_mb: settings.max_attachment_size_mb ?? 10,
        spam_protection_mode: settings.spam_protection_mode ?? 'standard',
        acknowledgement_text: settings.acknowledgement_text ?? '',
      });
    } else {
      setForm(DEFAULTS);
    }
    setFeedback(null);
  }, [settings]);

  const toggleCategory = (c: TicketCategory) => {
    setForm((f) => ({
      ...f,
      enabled_categories: f.enabled_categories.includes(c)
        ? f.enabled_categories.filter((x) => x !== c)
        : [...f.enabled_categories, c],
    }));
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        site_id: siteId,
        enabled_categories: form.enabled_categories,
        default_category: form.default_category,
        max_public_priority: form.max_public_priority,
        default_priority: form.default_priority,
        auto_assign: form.auto_assign,
        default_assigned_user_id: form.default_assigned_user_id || null,
        notify_customer_confirmation: form.notify_customer_confirmation,
        notify_staff_alert: form.notify_staff_alert,
        captcha_required: form.captcha_required,
        max_attachment_size_mb: form.max_attachment_size_mb,
        spam_protection_mode: form.spam_protection_mode,
        acknowledgement_text: form.acknowledgement_text.trim() || null,
        notify_ticket_received: settings?.notify_ticket_received ?? true,
        notify_staff_reply: settings?.notify_staff_reply ?? true,
        notify_resolved: settings?.notify_resolved ?? true,
        notify_closed: settings?.notify_closed ?? false,
        notify_reopened: settings?.notify_reopened ?? true,
      };

      if (settings?.id) {
        const { error } = await supabase.from('internal_support_site_settings').update(payload).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('internal_support_site_settings').insert(payload);
        if (error) throw error;
      }

      await logAdminEvent('support_site', 'settings_updated', `Ticket settings updated for ${siteName}`, { site_id: siteId });
      setFeedback({ type: 'success', message: 'Settings saved.' });
      reload();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const selectCls = 'w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground-100">Ticket settings</h3>
        <p className="text-xs text-foreground-500 mt-0.5">Site-level defaults and behaviour for incoming tickets.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-400 mb-1.5">Enabled categories</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = form.enabled_categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors cursor-pointer whitespace-nowrap ${
                  on
                    ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                    : 'bg-background-100 border-background-300/60 text-foreground-500 hover:text-foreground-300'
                }`}
                aria-pressed={on}
              >
                {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-default-cat">Default category</label>
          <select id="sp-default-cat" value={form.default_category} onChange={(e) => setForm((f) => ({ ...f, default_category: e.target.value as TicketCategory }))} className={selectCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-default-prio">Default priority</label>
          <select id="sp-default-prio" value={form.default_priority} onChange={(e) => setForm((f) => ({ ...f, default_priority: e.target.value as TicketPriority }))} className={selectCls}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-max-prio">Maximum public priority</label>
        <select id="sp-max-prio" value={form.max_public_priority} onChange={(e) => setForm((f) => ({ ...f, max_public_priority: e.target.value as TicketPriority }))} className={selectCls}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <p className="text-xs text-foreground-600 mt-1">Public submissions cannot request a priority above this.</p>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" checked={form.auto_assign} onChange={(e) => setForm((f) => ({ ...f, auto_assign: e.target.checked }))} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" id="sp-auto-assign" />
        <div>
          <label htmlFor="sp-auto-assign" className="text-sm text-foreground-200 cursor-pointer">Auto-assign new tickets</label>
        </div>
      </div>

      {form.auto_assign && (
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-assignee">Default assignee</label>
          <select id="sp-assignee" value={form.default_assigned_user_id} onChange={(e) => setForm((f) => ({ ...f, default_assigned_user_id: e.target.value }))} className={selectCls}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>{s.full_name || s.email} ({s.role})</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-max-attach">Max attachment size (MB)</label>
          <input id="sp-max-attach" type="number" min={1} max={25} value={form.max_attachment_size_mb} onChange={(e) => setForm((f) => ({ ...f, max_attachment_size_mb: Number(e.target.value) }))} className={selectCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-spam">Spam protection</label>
          <select id="sp-spam" value={form.spam_protection_mode} onChange={(e) => setForm((f) => ({ ...f, spam_protection_mode: e.target.value as SpamProtectionMode }))} className={selectCls}>
            {SPAM_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3 pt-1 border-t border-background-200/60">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.notify_customer_confirmation} onChange={(e) => setForm((f) => ({ ...f, notify_customer_confirmation: e.target.checked }))} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
          <span className="text-sm text-foreground-200">Customer confirmation email</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.notify_staff_alert} onChange={(e) => setForm((f) => ({ ...f, notify_staff_alert: e.target.checked }))} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
          <span className="text-sm text-foreground-200">Staff alert on new tickets</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.captcha_required} onChange={(e) => setForm((f) => ({ ...f, captcha_required: e.target.checked }))} className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40" />
          <span className="text-sm text-foreground-200">Require CAPTCHA in production</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sp-ack">Ticket acknowledgement text</label>
        <textarea id="sp-ack" value={form.acknowledgement_text} onChange={(e) => setForm((f) => ({ ...f, acknowledgement_text: e.target.value }))} rows={3} maxLength={2000} className="w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40" placeholder="Optional message shown to customers after submission." />
      </div>

      {feedback && (
        <div className={`px-3 py-2.5 rounded-md text-sm border ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-400'}`} role="status">
          {feedback.message}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}