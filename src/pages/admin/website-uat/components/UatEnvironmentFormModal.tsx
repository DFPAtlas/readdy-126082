import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

const ENV_TYPES = ['staging', 'uat', 'development', 'production', 'qa', 'demo', 'preview'] as const;

interface FormData {
  environment_name: string;
  type: string;
  base_url: string;
  login_url: string;
  admin_login_url: string;
  tester_login_url: string;
  current_build: string;
  release_candidate: string;
  version: string;
  git_branch: string;
  environment_notes: string;
  is_active: boolean;
}

const INITIAL: FormData = {
  environment_name: '',
  type: 'staging',
  base_url: '',
  login_url: '',
  admin_login_url: '',
  tester_login_url: '',
  current_build: '',
  release_candidate: '',
  version: '',
  git_branch: '',
  environment_notes: '',
  is_active: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId: string;
  projectName: string;
}

export default function UatEnvironmentFormModal({ open, onClose, onCreated, projectId, projectName }: Props) {
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
    if (!form.environment_name.trim()) {
      setError('Environment name is required.');
      return;
    }
    setError('');
    setSaving(true);

    const payload = {
      project_id: projectId,
      environment_name: form.environment_name.trim(),
      type: form.type,
      base_url: form.base_url.trim() || null,
      login_url: form.login_url.trim() || null,
      admin_login_url: form.admin_login_url.trim() || null,
      tester_login_url: form.tester_login_url.trim() || null,
      current_build: form.current_build.trim() || null,
      release_candidate: form.release_candidate.trim() || null,
      version: form.version.trim() || null,
      git_branch: form.git_branch.trim() || null,
      environment_notes: form.environment_notes.trim() || null,
      is_active: form.is_active,
    };

    const { error: insertErr } = await supabase.from('uat_environments').insert(payload);

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
      title="Create New Environment"
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
            {saving ? 'Creating...' : 'Create Environment'}
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

        <p className="text-sm text-foreground-400">
          Add a staging or UAT environment to <span className="font-semibold text-foreground-200">{projectName}</span>.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">
              Environment Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameInputRef}
              value={form.environment_name}
              onChange={(e) => update('environment_name', e.target.value)}
              placeholder="e.g. DFP Platform Staging"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Type</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
            >
              {ENV_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Base URL</label>
          <input
            value={form.base_url}
            onChange={(e) => update('base_url', e.target.value)}
            placeholder="https://staging.example.com"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Login URL</label>
            <input
              value={form.login_url}
              onChange={(e) => update('login_url', e.target.value)}
              placeholder="https://staging.example.com/login"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Admin Login URL</label>
            <input
              value={form.admin_login_url}
              onChange={(e) => update('admin_login_url', e.target.value)}
              placeholder="https://staging.example.com/admin"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Tester Login URL</label>
          <input
            value={form.tester_login_url}
            onChange={(e) => update('tester_login_url', e.target.value)}
            placeholder="https://staging.example.com/tester-login"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Version</label>
            <input
              value={form.version}
              onChange={(e) => update('version', e.target.value)}
              placeholder="e.g. 2.4.1"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Git Branch</label>
            <input
              value={form.git_branch}
              onChange={(e) => update('git_branch', e.target.value)}
              placeholder="e.g. release/v2.4"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Current Build</label>
            <input
              value={form.current_build}
              onChange={(e) => update('current_build', e.target.value)}
              placeholder="e.g. build-2026-08-01-a"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Release Candidate</label>
            <input
              value={form.release_candidate}
              onChange={(e) => update('release_candidate', e.target.value)}
              placeholder="e.g. rc-2.4.2"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Environment Notes</label>
          <textarea
            value={form.environment_notes}
            onChange={(e) => update('environment_notes', e.target.value)}
            placeholder="Any notes about this environment? special config, test accounts, known quirks..."
            rows={2}
            maxLength={500}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
          />
          <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.environment_notes.length}/500</p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => update('is_active', !form.is_active)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
              form.is_active ? 'bg-emerald-500' : 'bg-foreground-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                form.is_active ? 'left-[18px]' : 'left-0.5'
              }`}
            ></span>
          </button>
          <span className="text-sm text-foreground-300">{form.is_active ? 'Active' : 'Inactive'}</span>
          <span className="text-xs text-foreground-500">— testers can access this environment</span>
        </div>
      </div>
    </Modal>
  );
}