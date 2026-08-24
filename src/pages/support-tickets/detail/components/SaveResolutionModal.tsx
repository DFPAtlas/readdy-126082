import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { ResolutionOutcome, ResolutionRecord } from '@/types/support-tickets';
import { categoryLabels, CATEGORY_OPTIONS } from '@/pages/support-tickets/constants';

const OUTCOMES: { value: ResolutionOutcome; label: string }[] = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'partially_resolved', label: 'Partially Resolved' },
  { value: 'workaround', label: 'Workaround' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'known_issue', label: 'Known Issue' },
];

interface SaveResolutionModalProps {
  open: boolean;
  onClose: () => void;
  ticket: {
    id: string;
    site_id: string;
    category: string | null;
    subject: string;
  } | null;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

interface FormState {
  symptom: string;
  root_cause: string;
  diagnostic_evidence: string;
  resolution_action: string;
  outcome: ResolutionOutcome;
  customer_safe_summary: string;
  category: string;
}

const empty: FormState = {
  symptom: '',
  root_cause: '',
  diagnostic_evidence: '',
  resolution_action: '',
  outcome: 'resolved',
  customer_safe_summary: '',
  category: '',
};

export default function SaveResolutionModal({ open, onClose, ticket, onToast }: SaveResolutionModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState<ResolutionRecord[]>([]);

  useEffect(() => {
    if (open && ticket) {
      setForm({
        symptom: ticket.subject,
        root_cause: '',
        diagnostic_evidence: '',
        resolution_action: '',
        outcome: 'resolved',
        customer_safe_summary: '',
        category: ticket.category ?? '',
      });
      setDuplicates([]);
      setError('');
    }
  }, [open, ticket]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const findDuplicates = async (): Promise<ResolutionRecord[]> => {
    const { data } = await supabase.rpc('support_find_similar_resolutions', {
      p_site_id: ticket?.site_id ?? null,
      p_category: form.category || null,
      p_symptom: form.symptom,
    });
    return (data ?? []) as ResolutionRecord[];
  };

  const createResolution = async () => {
    if (!ticket) return;
    setSaving(true);
    setError('');
    const { error: e } = await supabase.rpc('support_create_resolution', {
      p_site_id: ticket.site_id,
      p_category: form.category || null,
      p_symptom: form.symptom,
      p_root_cause: form.root_cause || null,
      p_diagnostic_evidence: form.diagnostic_evidence || null,
      p_resolution_action: form.resolution_action || null,
      p_outcome: form.outcome,
      p_customer_safe_summary: form.customer_safe_summary || null,
      p_ticket_id: ticket.id,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onToast('Resolution saved for approval.', 'success');
    onClose();
  };

  const checkDuplicates = async () => {
    if (!form.symptom.trim()) return;
    setChecking(true);
    const found = await findDuplicates();
    setChecking(false);
    setDuplicates(found);
    if (found.length === 0) {
      onToast('No similar resolutions found.', 'success');
    }
  };

  const submit = async () => {
    if (!form.symptom.trim()) {
      setError('Problem description is required.');
      return;
    }
    setError('');
    const found = await findDuplicates();
    if (found.length > 0) {
      setDuplicates(found);
      return;
    }
    await createResolution();
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Resolution" className="max-w-2xl">
      <div className="p-5 space-y-4">
        <p className="text-sm text-foreground-400">
          Capture a sanitised resolution record from this ticket for future reference. It is saved as a
          <span className="text-foreground-200"> draft</span> and requires approval before it can be used for replies.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">— Select —</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Outcome</label>
            <select
              value={form.outcome}
              onChange={(e) => set({ outcome: e.target.value as ResolutionOutcome })}
              className={`${inputCls} cursor-pointer`}
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Problem *</label>
          <input
            type="text"
            value={form.symptom}
            onChange={(e) => set({ symptom: e.target.value })}
            placeholder="What was the customer experiencing?"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Root cause</label>
          <textarea
            value={form.root_cause}
            onChange={(e) => set({ root_cause: e.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="What actually caused the issue?"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Diagnostics</label>
          <textarea
            value={form.diagnostic_evidence}
            onChange={(e) => set({ diagnostic_evidence: e.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="Diagnostic evidence / findings..."
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Repair / resolution</label>
          <textarea
            value={form.resolution_action}
            onChange={(e) => set({ resolution_action: e.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="What was done to resolve it?"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Customer-safe explanation</label>
          <textarea
            value={form.customer_safe_summary}
            onChange={(e) => set({ customer_safe_summary: e.target.value })}
            rows={2}
            maxLength={3000}
            placeholder="A safe, non-technical summary suitable for reuse in replies..."
            className={`${inputCls} resize-y`}
          />
        </div>

        {duplicates.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-3">
            <p className="text-sm text-amber-300 font-medium mb-2">Possible existing resolution found</p>
            <div className="space-y-2 mb-3">
              {duplicates.map((d) => (
                <div key={d.id} className="bg-background-50 border border-background-200/60 rounded-lg p-3">
                  <p className="text-xs text-foreground-200 font-medium">{d.symptom}</p>
                  {d.resolution_action && (
                    <p className="text-xs text-foreground-500 mt-1">{d.resolution_action}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-400/80 mb-3">
              Consider using the existing resolution instead of creating a duplicate.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={createResolution}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Create new anyway
              </button>
              <button
                type="button"
                onClick={() => setDuplicates([])}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={checkDuplicates}
            disabled={checking || !form.symptom.trim()}
            className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Check for similar'}
          </button>
          <div className="flex items-center gap-3">
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
              {saving ? 'Saving…' : 'Save resolution'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}