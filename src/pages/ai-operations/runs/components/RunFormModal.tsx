import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { TaskType, RunPriority, RiskLevel, Environment, TriggerSource } from '@/pages/ai-operations/types';
import type { TaskCreateInput } from '@/pages/ai-operations/runs/taskMapper';
import type { RunSiteOption, RunAgentOption } from '@/pages/ai-operations/runs/RunsContext';
import {
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  TASK_TYPE_OPTIONS,
  TASK_TYPE_LABELS,
  TRIGGER_SOURCE_OPTIONS,
  TRIGGER_SOURCE_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';

interface RunFormModalProps {
  open: boolean;
  onClose: () => void;
  sites: RunSiteOption[];
  agents: RunAgentOption[];
  liveMode: boolean;
  onSave: (input: TaskCreateInput) => Promise<{ error: string | null }>;
}

interface FormState {
  taskName: string;
  description: string;
  site: string; // 'group' = group-wide
  agentId: string;
  taskType: TaskType;
  priority: RunPriority;
  risk: RiskLevel;
  environment: Environment;
  triggerSource: TriggerSource;
  approvalRequired: boolean;
  uatRequired: boolean;
  verificationRequired: boolean;
  notes: string;
}

const empty: FormState = {
  taskName: '',
  description: '',
  site: 'group',
  agentId: '',
  taskType: 'support',
  priority: 'normal',
  risk: 'low',
  environment: 'production',
  triggerSource: 'user',
  approvalRequired: false,
  uatRequired: false,
  verificationRequired: false,
  notes: '',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

// Stable-ish unique task key (timestamp + random suffix). The database UUID is
// a separate internal key; `task_key` is the stable application identifier.
function newTaskKey(): string {
  return `TASK-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export default function RunFormModal({ open, onClose, sites, agents, liveMode, onSave }: RunFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setError('');
      setSaving(false);
    }
  }, [open]);

  const agentOptions = useMemo(() => {
    if (form.site === 'group') return agents.filter((a) => a.assignedSite === null);
    if (form.site) return agents.filter((a) => a.assignedSite === null || a.assignedSite === form.site);
    return agents;
  }, [form.site, agents]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.taskName.trim()) {
      setError('Task name is required.');
      return;
    }
    setSaving(true);
    setError('');

    const input: TaskCreateInput = {
      taskKey: newTaskKey(),
      name: form.taskName.trim(),
      description: form.description.trim(),
      taskType: form.taskType,
      siteId: form.site === 'group' ? null : form.site,
      requestedBy: 'Draft',
      triggerSource: form.triggerSource,
      priority: form.priority,
      riskLevel: form.risk,
      environment: form.environment,
      // A newly created task is a safe non-executing record — never started.
      status: 'draft',
      approvalRequired: form.approvalRequired,
      verificationRequired: form.verificationRequired,
      uatRequired: form.uatRequired,
      auditRequired: true,
      notes: form.notes.trim() || 'Draft task — persistence connected; execution runtime not connected yet.',
    };

    const { error: saveError } = await onSave(input);
    setSaving(false);
    if (saveError) {
      // Preserve entered form data; surface a sanitised error.
      setError(saveError);
      return;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Task" className="max-w-2xl">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Task name *</label>
          <input type="text" value={form.taskName} onChange={(e) => set({ taskName: e.target.value })} placeholder="e.g. Match guards to open shift" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} placeholder="What should this task do..." className={`${inputCls} resize-y`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site</label>
            <select value={form.site} onChange={(e) => set({ site: e.target.value, agentId: '' })} className={`${inputCls} cursor-pointer`}>
              <option value="group">Group-wide</option>
              {sites.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Agent</label>
            <select value={form.agentId} onChange={(e) => set({ agentId: e.target.value })} className={`${inputCls} cursor-pointer`}>
              <option value="">Unassigned</option>
              {agentOptions.map((a) => (
                <option key={a.key} value={a.key}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Task type</label>
            <select value={form.taskType} onChange={(e) => set({ taskType: e.target.value as TaskType })} className={`${inputCls} cursor-pointer`}>
              {TASK_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => set({ priority: e.target.value as RunPriority })} className={`${inputCls} cursor-pointer`}>
              {(['low', 'normal', 'high', 'urgent', 'critical'] as RunPriority[]).map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Risk</label>
            <select value={form.risk} onChange={(e) => set({ risk: e.target.value as RiskLevel })} className={`${inputCls} cursor-pointer`}>
              {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((r) => (
                <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Environment</label>
            <select value={form.environment} onChange={(e) => set({ environment: e.target.value as Environment })} className={`${inputCls} cursor-pointer`}>
              {ENVIRONMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-label text-foreground-500 mb-1">Trigger source</label>
            <select value={form.triggerSource} onChange={(e) => set({ triggerSource: e.target.value as TriggerSource })} className={`${inputCls} cursor-pointer`}>
              {TRIGGER_SOURCE_OPTIONS.map((t) => (
                <option key={t} value={t}>{TRIGGER_SOURCE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={form.approvalRequired} onChange={(e) => set({ approvalRequired: e.target.checked })} className="w-4 h-4 rounded accent-accent-500 cursor-pointer" />
            Approval required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={form.uatRequired} onChange={(e) => set({ uatRequired: e.target.checked })} className="w-4 h-4 rounded accent-accent-500 cursor-pointer" />
            UAT required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={form.verificationRequired} onChange={(e) => set({ verificationRequired: e.target.checked })} className="w-4 h-4 rounded accent-accent-500 cursor-pointer" />
            Verification required
          </label>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} maxLength={500} placeholder="Optional notes..." className={`${inputCls} resize-y`} />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-[11px] font-label text-foreground-600 max-w-xs">
            {liveMode
              ? 'Creates a task record only — execution runtime is not connected.'
              : 'Demo mode: the task is kept local only (not written to Supabase).'}
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating…' : liveMode ? 'Create Task' : 'Save Draft'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}