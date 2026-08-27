import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { AgentRegistryRecord, AgentType, AgentCategory, AgentAutonomy, RiskLevel, Environment } from '@/pages/ai-operations/types';
import type { AgentDataSourceMode, AgentSiteOption } from '@/pages/ai-operations/agents/AgentsContext';
import {
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  AGENT_TYPE_OPTIONS,
  AGENT_TYPE_LABELS,
  AGENT_CATEGORY_OPTIONS,
  AGENT_CATEGORY_LABELS,
  AGENT_AUTONOMY_OPTIONS,
  AGENT_AUTONOMY_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';

interface AgentFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create new agent; otherwise edit this agent. */
  agent: AgentRegistryRecord | null;
  /** Current data-source mode — controls the save label and behaviour. */
  mode: AgentDataSourceMode;
  /** Live site options for the scope dropdown (stable key + display name). */
  sites: AgentSiteOption[];
  /** False when live sites could not be loaded — blocks site assignment. */
  sitesAvailable: boolean;
  onSave: (record: AgentRegistryRecord) => Promise<{ error: string | null }>;
}

interface FormState {
  name: string;
  description: string;
  type: AgentType;
  category: AgentCategory;
  scope: string; // 'Group-wide' or a stable site key
  environment: Environment;
  risk: RiskLevel;
  autonomy: AgentAutonomy;
  ownerTeam: string;
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider: string;
  fallbackModel: string;
}

const empty: FormState = {
  name: '',
  description: '',
  type: 'site_specific',
  category: 'support',
  scope: '',
  environment: 'production',
  risk: 'low',
  autonomy: 'limited_automatic',
  ownerTeam: '',
  primaryProvider: 'Anthropic',
  primaryModel: 'Claude Sonnet',
  fallbackProvider: 'OpenAI',
  fallbackModel: 'GPT-4o',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function AgentFormModal({ open, onClose, agent, mode, sites, sitesAvailable, onSave }: AgentFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isLive = mode === 'live';
  const liveSitesUnavailable = isLive && !sitesAvailable;

  useEffect(() => {
    if (open) {
      setForm(
        agent
          ? {
              name: agent.name,
              description: agent.description,
              type: agent.type,
              category: agent.category,
              scope: agent.assignedSite ?? 'Group-wide',
              environment: agent.environment,
              risk: agent.risk,
              autonomy: agent.autonomy,
              ownerTeam: agent.ownerTeam,
              primaryProvider: agent.model.primaryProvider,
              primaryModel: agent.model.primaryModel,
              fallbackProvider: agent.model.fallbackProvider,
              fallbackModel: agent.model.fallbackModel,
            }
          : empty,
      );
      setError('');
      setSubmitting(false);
    }
  }, [open, agent]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Agent name is required.');
      return;
    }

    const isGroup = form.scope === 'Group-wide' || form.scope === '';
    const site = sites.find((s) => s.key === form.scope);
    const scopeLabel = isGroup ? 'Group-wide' : site?.name ?? form.scope;

    const base = (agent ?? {}) as Partial<AgentRegistryRecord>;

    const record: AgentRegistryRecord = {
      id: agent?.id ?? slugify(form.name),
      name: form.name.trim(),
      description: form.description.trim(),
      type: isGroup ? 'core' : 'site_specific',
      category: form.category,
      assignedSite: isGroup ? null : form.scope,
      scope: scopeLabel,
      environment: form.environment,
      status: base.status ?? 'not_configured',
      health: base.health ?? 'unknown',
      risk: form.risk,
      autonomy: form.autonomy,
      currentTask: base.currentTask ?? 'Awaiting configuration',
      currentRunId: base.currentRunId ?? '—',
      queueCount: base.queueCount ?? 0,
      lastRun: base.lastRun ?? 'Never',
      lastSuccessfulRun: base.lastSuccessfulRun ?? 'Never',
      successRate: base.successRate ?? '—',
      jobsToday: base.jobsToday ?? 0,
      failedJobsToday: base.failedJobsToday ?? 0,
      avgRunDuration: base.avgRunDuration ?? '—',
      avgEstimatedCost: base.avgEstimatedCost ?? '—',
      ownerTeam: form.ownerTeam.trim(),
      escalationTeam: base.escalationTeam ?? 'Group Incident Team',
      createdAt: base.createdAt ?? '2026-08-25',
      updatedAt: 'Just now',
      notes: base.notes ?? 'Draft entry — agent persistence and execution will be connected in a later phase.',
      model: {
        primaryProvider: form.primaryProvider.trim(),
        primaryModel: form.primaryModel.trim(),
        fallbackProvider: form.fallbackProvider.trim(),
        fallbackModel: form.fallbackModel.trim(),
        purpose: base.model?.purpose ?? 'General reasoning and task execution',
        configStatus: base.model?.configStatus ?? 'Draft',
        promptRef: base.model?.promptRef ?? 'prompt-registry/draft',
        lastConfigUpdate: 'Just now',
      },
      tools: base.tools ?? [],
      dataPermissions: base.dataPermissions ?? [],
      actionPermissions: base.actionPermissions ?? [],
      approvalPolicy: base.approvalPolicy ?? {
        approvalRequired: true,
        minApprovers: 1,
        approvalTeam: 'Group AI Operations',
        maxPermittedRisk: 'medium',
        autoExpiry: '24h',
        verificationRequired: true,
        uatRequired: false,
        auditRequired: true,
      },
      dependencies: base.dependencies ?? [],
      runs: base.runs ?? [],
      events: base.events ?? [],
    };

    setSubmitting(true);
    const { error: saveError } = await onSave(record);
    if (saveError) {
      // Preserve entered form data and surface a sanitised error.
      setError(saveError);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
  };

  const saveLabel = isLive ? (agent ? 'Update Agent' : 'Create Agent') : 'Save Draft';

  return (
    <Modal open={open} onClose={onClose} title={agent ? 'Edit Agent' : 'Add Agent'} className="max-w-2xl">
      <div className="p-5 space-y-4">
        {liveSitesUnavailable && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-amber-300">
              Live site registry is unavailable, so site-specific agents cannot be assigned right now. You can still create a group-wide agent.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Agent name *</label>
            <input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Guard Matching Agent" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site / Group scope</label>
            <select
              value={liveSitesUnavailable ? 'Group-wide' : form.scope}
              onChange={(e) => set({ scope: e.target.value })}
              disabled={liveSitesUnavailable}
              className={`${inputCls} cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <option value="Group-wide">Group-wide (Core / Shared)</option>
              {sites.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} placeholder="What this agent does..." className={`${inputCls} resize-y`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Agent type</label>
            <select value={form.type} onChange={(e) => set({ type: e.target.value as AgentType })} className={`${inputCls} cursor-pointer`}>
              {AGENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{AGENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Category</label>
            <select value={form.category} onChange={(e) => set({ category: e.target.value as AgentCategory })} className={`${inputCls} cursor-pointer`}>
              {AGENT_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{AGENT_CATEGORY_LABELS[c]}</option>
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
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Risk</label>
            <select value={form.risk} onChange={(e) => set({ risk: e.target.value as RiskLevel })} className={`${inputCls} cursor-pointer`}>
              {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((r) => (
                <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-label text-foreground-500 mb-1">Autonomy</label>
            <select value={form.autonomy} onChange={(e) => set({ autonomy: e.target.value as AgentAutonomy })} className={`${inputCls} cursor-pointer`}>
              {AGENT_AUTONOMY_OPTIONS.map((a) => (
                <option key={a} value={a}>{AGENT_AUTONOMY_LABELS[a]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Owner / team</label>
          <input type="text" value={form.ownerTeam} onChange={(e) => set({ ownerTeam: e.target.value })} placeholder="e.g. QuickGuard Ops" className={inputCls} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Primary model / provider</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={form.primaryProvider} onChange={(e) => set({ primaryProvider: e.target.value })} placeholder="Provider" className={inputCls} />
              <input type="text" value={form.primaryModel} onChange={(e) => set({ primaryModel: e.target.value })} placeholder="Model" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Fallback model / provider</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={form.fallbackProvider} onChange={(e) => set({ fallbackProvider: e.target.value })} placeholder="Provider" className={inputCls} />
              <input type="text" value={form.fallbackModel} onChange={(e) => set({ fallbackModel: e.target.value })} placeholder="Model" className={inputCls} />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-[11px] font-label text-foreground-600">
            {isLive
              ? 'Saves directly to the live agent registry (Supabase). Runtime execution is not connected yet.'
              : 'Local draft only — not written to the live registry.'}
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 disabled:opacity-60 disabled:cursor-not-allowed text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting && <i className="ri-loader-4-line text-sm w-4 h-4 flex items-center justify-center animate-spin"></i>}
              {submitting ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}