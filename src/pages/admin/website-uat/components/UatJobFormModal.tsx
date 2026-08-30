import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  DEVICES,
  DEVICE_LABELS,
  BROWSERS,
  BROWSER_LABELS,
} from '../marketplace';

interface ProjectOption {
  id: string;
  name: string;
}

interface EnvironmentOption {
  id: string;
  environment_name: string;
}

interface FormData {
  project_id: string;
  environment_id: string;
  title: string;
  description: string;
  test_instructions: string;
  required_experience_level: string;
  required_devices: string[];
  required_browsers: string[];
  pay_type: string;
  pay_amount: string;
  max_testers: string;
  deadline: string;
}

const INITIAL: FormData = {
  project_id: '',
  environment_id: '',
  title: '',
  description: '',
  test_instructions: '',
  required_experience_level: 'any',
  required_devices: [],
  required_browsers: [],
  pay_type: 'fixed',
  pay_amount: '',
  max_testers: '1',
  deadline: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const DESCRIPTION_MAX = 500;
const INSTRUCTIONS_MAX = 500;

export default function UatJobFormModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('uat_projects')
        .select('id,name,status')
        .is('archived_at', null)
        .neq('status', 'archived')
        .order('name', { ascending: true });
      if (error) throw error;
      setProjects((data || []) as ProjectOption[]);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const loadEnvironments = useCallback(async (projectId: string) => {
    if (!projectId) {
      setEnvironments([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('uat_environments')
        .select('id,environment_name')
        .eq('project_id', projectId)
        .order('environment_name', { ascending: true });
      if (error) throw error;
      setEnvironments((data || []) as EnvironmentOption[]);
    } catch {
      setEnvironments([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setErrors({});
      setSaveError('');
      setEnvironments([]);
      loadProjects();
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [open, loadProjects]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProjectChange = (projectId: string) => {
    setForm((prev) => ({ ...prev, project_id: projectId, environment_id: '' }));
    loadEnvironments(projectId);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};

    if (!form.project_id) e.project_id = 'A project is required.';
    if (!form.title.trim()) e.title = 'Title is required.';

    if (form.pay_amount.trim() !== '') {
      const amount = Number(form.pay_amount);
      if (Number.isNaN(amount) || amount <= 0) {
        e.pay_amount = 'Pay amount must be a positive number.';
      }
    }

    const testers = Number(form.max_testers);
    if (!Number.isInteger(testers) || testers < 1) {
      e.max_testers = 'Maximum testers must be at least 1.';
    }

    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setSaveError('');

    const payAmount = form.pay_amount.trim() === '' ? 0 : Number(form.pay_amount);

    const payload = {
      project_id: form.project_id,
      environment_id: form.environment_id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      test_instructions: form.test_instructions.trim() || null,
      required_devices: form.required_devices,
      required_browsers: form.required_browsers,
      required_experience_level: form.required_experience_level,
      pay_amount: payAmount,
      pay_type: form.pay_type,
      max_testers: Number(form.max_testers),
      deadline: form.deadline || null,
      status: 'open',
      marketplace_status: 'draft',
      visibility: 'internal',
      claim_mode: 'approval_required',
      reward_amount_minor: 0,
      currency: 'GBP',
      tester_slots_filled: 0,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('uat_jobs')
      .insert(payload)
      .select('id')
      .single();

    if (insertErr) {
      setSaveError(insertErr.message);
      setSaving(false);
      return;
    }

    const newJobId = inserted?.id as string | undefined;

    // Best-effort audit — a failure here must never undo a successful create.
    if (newJobId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('uat_audit_log').insert({
          actor_id: session?.user?.id ?? null,
          action: 'uat_job_created',
          entity_type: 'uat_job',
          entity_id: newJobId,
          new_value: {
            project_id: form.project_id,
            environment_id: form.environment_id || null,
            title: form.title.trim(),
            pay_type: form.pay_type,
            max_testers: Number(form.max_testers),
            status: 'open',
            marketplace_status: 'draft',
          },
        });
      } catch {
        /* audit is best-effort */
      }
    }

    setSaving(false);
    onCreated(newJobId ?? '');
    onClose();
  };

  const fieldClass =
    'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';
  const labelClass = 'block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5';
  const errClass = 'text-xs text-red-400 mt-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Test Run"
      className="max-w-2xl"
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
            {saving ? 'Creating...' : 'Create Test Run'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {saveError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        <p className="text-sm text-foreground-400">
          Create a new UAT test job. It is saved as a draft for the tester marketplace and is not published yet.
        </p>

        <div>
          <label className={labelClass}>
            Project <span className="text-red-400">*</span>
          </label>
          <select
            value={form.project_id}
            onChange={(e) => handleProjectChange(e.target.value)}
            disabled={loadingProjects}
            className={`${fieldClass} cursor-pointer disabled:opacity-60`}
          >
            <option value="">{loadingProjects ? 'Loading projects...' : 'Select a project'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.project_id && <p className={errClass}>{errors.project_id}</p>}
        </div>

        <div>
          <label className={labelClass}>Environment <span className="text-foreground-600 normal-case font-normal">(optional)</span></label>
          <select
            value={form.environment_id}
            onChange={(e) => update('environment_id', e.target.value)}
            disabled={!form.project_id}
            className={`${fieldClass} cursor-pointer disabled:opacity-60`}
          >
            <option value="">No environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>{env.environment_name}</option>
            ))}
          </select>
          <p className="text-[10px] text-foreground-600 mt-1">
            {form.project_id ? 'Optional — you can leave this empty.' : 'Select a project first to see its environments.'}
          </p>
        </div>

        <div>
          <label className={labelClass}>
            Title <span className="text-red-400">*</span>
          </label>
          <input
            ref={titleInputRef}
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. DFP Stripe UAT Payout Test"
            className={fieldClass}
          />
          {errors.title && <p className={errClass}>{errors.title}</p>}
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What does this test run involve?"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            className={`${fieldClass} resize-none`}
          />
          <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.description.length}/{DESCRIPTION_MAX}</p>
        </div>

        <div>
          <label className={labelClass}>Test Instructions</label>
          <textarea
            value={form.test_instructions}
            onChange={(e) => update('test_instructions', e.target.value)}
            placeholder="Specific steps or guidance for testers."
            rows={3}
            maxLength={INSTRUCTIONS_MAX}
            className={`${fieldClass} resize-none`}
          />
          <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.test_instructions.length}/{INSTRUCTIONS_MAX}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Required Experience</label>
            <select
              value={form.required_experience_level}
              onChange={(e) => update('required_experience_level', e.target.value)}
              className={`${fieldClass} cursor-pointer`}
            >
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Pay Type</label>
            <select
              value={form.pay_type}
              onChange={(e) => update('pay_type', e.target.value)}
              className={`${fieldClass} cursor-pointer`}
            >
              <option value="fixed">Fixed</option>
              <option value="per_hour">Per hour</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Pay Amount (GBP)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-500">£</span>
              <input
                value={form.pay_amount}
                onChange={(e) => update('pay_amount', e.target.value)}
                inputMode="decimal"
                placeholder="5.00"
                className={`${fieldClass} pl-7`}
              />
            </div>
            {errors.pay_amount && <p className={errClass}>{errors.pay_amount}</p>}
            <p className="text-[10px] text-foreground-600 mt-1">Legacy display value — the tester reward is configured separately.</p>
          </div>
          <div>
            <label className={labelClass}>
              Maximum Testers <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.max_testers}
              onChange={(e) => update('max_testers', e.target.value)}
              placeholder="1"
              className={fieldClass}
            />
            {errors.max_testers && <p className={errClass}>{errors.max_testers}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Deadline <span className="text-foreground-600 normal-case font-normal">(optional)</span></label>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => update('deadline', e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Required Devices</label>
          <div className="flex flex-wrap gap-2">
            {DEVICES.map((d) => {
              const active = form.required_devices.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => update('required_devices', toggle(form.required_devices, d))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                      : 'bg-background-50 border-background-300/60 text-foreground-400 hover:text-foreground-200'
                  }`}
                >
                  {DEVICE_LABELS[d]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-foreground-600 mt-1">Leave all unselected for no specific device requirement.</p>
        </div>

        <div>
          <label className={labelClass}>Required Browsers</label>
          <div className="flex flex-wrap gap-2">
            {BROWSERS.map((b) => {
              const active = form.required_browsers.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => update('required_browsers', toggle(form.required_browsers, b))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                      : 'bg-background-50 border-background-300/60 text-foreground-400 hover:text-foreground-200'
                  }`}
                >
                  {BROWSER_LABELS[b]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-foreground-600 mt-1">Leave all unselected for no specific browser requirement.</p>
        </div>
      </div>
    </Modal>
  );
}