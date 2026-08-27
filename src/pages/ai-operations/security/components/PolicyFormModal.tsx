import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { AiSecurityPolicy, PolicyEffect, RiskClass } from '@/pages/ai-operations/types';
import type { SecurityDataSourceMode, SecuritySiteOption } from '@/pages/ai-operations/security/SecurityContext';
import {
  POLICY_CATEGORY_OPTIONS,
  POLICY_CATEGORY_LABELS,
  POLICY_EFFECT_OPTIONS,
  POLICY_EFFECT,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  RISK_CLASS,
} from '@/pages/ai-operations/constants';

interface PolicyFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create new policy; otherwise edit this policy. */
  policy: AiSecurityPolicy | null;
  mode: SecurityDataSourceMode;
  sites: SecuritySiteOption[];
  onSave: (policy: AiSecurityPolicy) => Promise<{ error: string | null }>;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

function newPolicyKey(): string {
  return `POL-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export default function PolicyFormModal({ open, onClose, policy, mode, sites, onSave }: PolicyFormModalProps) {
  const [name, setName] = useState(policy?.name ?? '');
  const [category, setCategory] = useState(policy?.category ?? 'security');
  const [effect, setEffect] = useState(policy?.effect ?? 'require_approval');
  const [scope, setScope] = useState(policy?.siteId ?? 'group');
  const [environment, setEnvironment] = useState(policy?.environment ?? 'production');
  const [riskClass, setRiskClass] = useState(policy?.riskClass ?? 'amber');
  const [approvalRequired, setApprovalRequired] = useState(policy?.approvalRequired ?? true);
  const [minApprovers, setMinApprovers] = useState(policy?.minApprovers ?? 1);
  const [ownerTeam, setOwnerTeam] = useState(policy?.ownerTeam ?? '');
  const [notes, setNotes] = useState(policy?.notes ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isLive = mode === 'live';

  useEffect(() => {
    if (open) {
      setName(policy?.name ?? '');
      setCategory(policy?.category ?? 'security');
      setEffect(policy?.effect ?? 'require_approval');
      setScope(policy?.siteId ?? 'group');
      setEnvironment(policy?.environment ?? 'production');
      setRiskClass(policy?.riskClass ?? 'amber');
      setApprovalRequired(policy?.approvalRequired ?? true);
      setMinApprovers(policy?.minApprovers ?? 1);
      setOwnerTeam(policy?.ownerTeam ?? '');
      setNotes(policy?.notes ?? '');
      setError('');
      setSubmitting(false);
    }
  }, [open, policy]);

  const siteOptions = useMemo(() => [{ key: 'group', name: 'Group-wide' }, ...sites], [sites]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Policy name is required.');
      return;
    }

    const site = siteOptions.find((s) => s.key === scope);
    const base = (policy ?? {}) as Partial<AiSecurityPolicy>;
    const id = policy?.id ?? newPolicyKey();
    const priority = riskClass === 'red' ? 'critical' : riskClass === 'amber' ? 'high' : 'medium';

    const record: AiSecurityPolicy = {
      id,
      name: name.trim(),
      description: base.description ?? (notes.trim() || 'Newly added policy (draft metadata only).'),
      category,
      status: policy?.status ?? 'draft',
      effect: effect as PolicyEffect,
      priority: priority as AiSecurityPolicy['priority'],
      scope: scope === 'group' ? 'group' : 'site',
      siteId: scope === 'group' ? null : scope,
      siteName: site?.name ?? 'Group-wide',
      agentIds: base.agentIds ?? [],
      toolIds: base.toolIds ?? [],
      modelIds: base.modelIds ?? [],
      knowledgeIds: base.knowledgeIds ?? [],
      environment,
      riskClass: riskClass as RiskClass,
      actionType: base.actionType ?? (name.trim() || 'Policy action'),
      approvalRequired,
      minApprovers: approvalRequired ? minApprovers : 0,
      enforcementStage: base.enforcementStage ?? 'execution_gate',
      exceptionAllowed: base.exceptionAllowed ?? false,
      auditRequired: true,
      ownerTeam: ownerTeam.trim() || 'Group AI Operations',
      version: policy?.version ?? 'v0.1',
      effectiveDate: policy?.effectiveDate ?? '2026-08-25',
      reviewDate: policy?.reviewDate ?? '2026-11-25',
      createdAt: policy?.createdAt ?? '2026-08-25',
      updatedAt: 'Just now',
      notes: notes.trim(),
      conditions: base.conditions ?? [],
      decision: { result: effect as AiSecurityPolicy['decision']['result'], explanation: 'Draft policy — not yet enforced.' },
      exceptions: base.exceptions ?? [],
      history: base.history ?? [
        { timestamp: 'Just now', version: 'v0.1', actor: 'Group AI Operations', change: 'Draft created', previousStatus: '—', newStatus: 'Draft' },
      ],
    };

    setSubmitting(true);
    setError('');
    const { error: saveError } = await onSave(record);
    if (saveError) {
      setError(saveError);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
  };

  const saveLabel = isLive ? (policy ? 'Update Policy' : 'Create Policy') : 'Save Draft';

  return (
    <Modal open={open} onClose={onClose} title={policy ? 'Edit Policy' : 'Add Policy'} className="max-w-xl">
      <div className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Policy name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. New governance rule" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as AiSecurityPolicy['category'])} className={`${inputCls} cursor-pointer`}>
              {POLICY_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{POLICY_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Effect</label>
            <select value={effect} onChange={(e) => setEffect(e.target.value as AiSecurityPolicy['effect'])} className={`${inputCls} cursor-pointer`}>
              {POLICY_EFFECT_OPTIONS.map((ef) => (
                <option key={ef} value={ef}>{POLICY_EFFECT[ef].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {siteOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value as AiSecurityPolicy['environment'])} className={`${inputCls} cursor-pointer`}>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Risk class</label>
            <select value={riskClass} onChange={(e) => setRiskClass(e.target.value as RiskClass)} className={`${inputCls} cursor-pointer`}>
              {(['green', 'amber', 'red'] as const).map((r) => (
                <option key={r} value={r}>{RISK_CLASS[r].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Owner / team</label>
            <input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} className={inputCls} placeholder="e.g. Security Working Group" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Approval required</label>
            <select value={approvalRequired ? 'yes' : 'no'} onChange={(e) => setApprovalRequired(e.target.value === 'yes')} className={`${inputCls} cursor-pointer`}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Minimum approvers</label>
            <input type="number" min={1} max={5} value={minApprovers} onChange={(e) => setMinApprovers(Number(e.target.value))} className={inputCls} disabled={!approvalRequired} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className={`${inputCls} resize-y`} placeholder="Optional notes (no credentials)" />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            Policy enforcement and production integration will be connected in a later phase. This form stores safe governance metadata only — no credentials, keys or secrets.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-[11px] font-label text-foreground-600 max-w-xs">
            {isLive ? 'Writes to the live policy registry (Supabase).' : 'Local draft only — not written to the live registry.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 disabled:opacity-60 disabled:cursor-not-allowed text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
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