import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

const STATUSES = ['planning', 'active', 'completed', 'draft', 'archived', 'paused'] as const;

interface FormData {
  name: string;
  client_company: string;
  description: string;
  live_url: string;
  product_website: string;
  status: string;
  reference: string;
  objective: string;
  start_date: string;
  completion_date: string;
  required_testers: string;
  coverage_target: string;
}

const INITIAL: FormData = {
  name: '',
  client_company: '',
  description: '',
  live_url: '',
  product_website: '',
  status: 'planning',
  reference: '',
  objective: '',
  start_date: '',
  completion_date: '',
  required_testers: '',
  coverage_target: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function UatProjectFormModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setError('');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Project name is required.');
      return;
    }
    setError('');
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      client_company: form.client_company.trim() || null,
      description: form.description.trim() || null,
      live_url: form.live_url.trim() || null,
      product_website: form.product_website.trim() || null,
      status: form.status,
      reference: form.reference.trim() || null,
      objective: form.objective.trim() || null,
      start_date: form.start_date || null,
      completion_date: form.completion_date || null,
      required_testers: form.required_testers ? Number(form.required_testers) : 0,
      coverage_target: form.coverage_target.trim() || null,
    };

    const { error: insertErr } = await supabase.from('uat_projects').insert(payload);

    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New UAT Project"
      className="max-w-xl"
      lockScroll={true}
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
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <p className="text-sm text-foreground-400">Add a new project to the UAT testing pipeline.</p>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input
            ref={nameInputRef}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. DFP Platform v3"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Required Testers</label>
            <input
              type="number"
              value={form.required_testers}
              onChange={(e) => update('required_testers', e.target.value)}
              placeholder="0"
              min="0"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Client / Company</label>
          <input
            value={form.client_company}
            onChange={(e) => update('client_company', e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Live URL</label>
            <input
              value={form.live_url}
              onChange={(e) => update('live_url', e.target.value)}
              placeholder="https://..."
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Product Website</label>
            <input
              value={form.product_website}
              onChange={(e) => update('product_website', e.target.value)}
              placeholder="https://..."
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What does this project involve? What are we testing?"
            rows={3}
            maxLength={500}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
          />
          <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.description.length}/500</p>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Objective</label>
          <input
            value={form.objective}
            onChange={(e) => update('objective', e.target.value)}
            placeholder="e.g. Full regression test of checkout flow"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Reference</label>
          <input
            value={form.reference}
            onChange={(e) => update('reference', e.target.value)}
            placeholder="e.g. UAT-2026-004"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Coverage Target</label>
          <input
            value={form.coverage_target}
            onChange={(e) => update('coverage_target', e.target.value)}
            placeholder="e.g. All critical paths + edge cases"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => update('start_date', e.target.value)}
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Completion Date</label>
            <input
              type="date"
              value={form.completion_date}
              onChange={(e) => update('completion_date', e.target.value)}
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}