import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { SupportSite } from '@/types/support-tickets';
import { PRIORITY_OPTIONS, CATEGORY_OPTIONS, priorityLabels, categoryLabels } from '../constants';

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  sites: SupportSite[];
  onCreated: (ticketNumber: string) => void;
}

interface FormState {
  site_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
}

const empty: FormState = {
  site_id: '',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  subject: '',
  description: '',
  category: 'general',
  priority: 'normal',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

export default function CreateTicketModal({ open, onClose, sites, onCreated }: CreateTicketModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ ...empty, site_id: sites[0]?.id ?? '' });
      setErrors({});
      setSubmitError('');
    }
  }, [open, sites]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.site_id) e.site_id = 'Select a website';
    if (!form.customer_name.trim()) e.customer_name = 'Customer name is required';
    if (!form.customer_email.trim()) e.customer_email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim()))
      e.customer_email = 'Enter a valid email address';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.description.trim()) e.description = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    const { data, error } = await supabase.rpc('internal_create_staff_ticket', {
      p_site_id: form.site_id,
      p_customer_name: form.customer_name.trim(),
      p_customer_email: form.customer_email.trim(),
      p_customer_phone: form.customer_phone.trim() || null,
      p_subject: form.subject.trim(),
      p_description: form.description.trim(),
      p_category: form.category,
      p_priority: form.priority,
    });
    setSaving(false);
    if (error) {
      setSubmitError(error.message || 'Failed to create ticket');
      return;
    }
    const number = (data as { ticket_number?: string } | null)?.ticket_number ?? '';
    onCreated(number);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Ticket" className="max-w-xl">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Website *</label>
          <select
            value={form.site_id}
            onChange={(e) => set({ site_id: e.target.value })}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="" disabled>Select a website</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.site_name}</option>
            ))}
          </select>
          {errors.site_id && <p className="text-xs text-red-400 mt-1">{errors.site_id}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Customer name *</label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => set({ customer_name: e.target.value })}
              placeholder="Jane Smith"
              className={inputCls}
            />
            {errors.customer_name && <p className="text-xs text-red-400 mt-1">{errors.customer_name}</p>}
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Customer email *</label>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => set({ customer_email: e.target.value })}
              placeholder="jane@example.com"
              className={inputCls}
            />
            {errors.customer_email && <p className="text-xs text-red-400 mt-1">{errors.customer_email}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Phone (optional)</label>
          <input
            type="text"
            value={form.customer_phone}
            onChange={(e) => set({ customer_phone: e.target.value })}
            placeholder="+44 ..."
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Subject *</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => set({ subject: e.target.value })}
            placeholder="Short summary of the request"
            className={inputCls}
          />
          {errors.subject && <p className="text-xs text-red-400 mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={4}
            maxLength={10000}
            placeholder="Describe the customer's request..."
            className={`${inputCls} resize-y`}
          />
          {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set({ priority: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{priorityLabels[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {submitError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{submitError}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create ticket'}
          </button>
        </div>
      </div>
    </Modal>
  );
}