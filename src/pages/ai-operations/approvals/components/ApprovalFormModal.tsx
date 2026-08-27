import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { AiApproval, RequestType, RiskLevel, RiskClass, Environment } from '@/pages/ai-operations/types';
import type {
  ApprovalSiteOption,
  ApprovalAgentOption,
  ApprovalRunOption,
  ApprovalsDataSourceMode,
} from '@/pages/ai-operations/approvals/ApprovalsContext';
import {
  REQUEST_TYPE_OPTIONS,
  REQUEST_TYPE_LABELS,
  RISK_LEVEL,
  RISK_CLASS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';

interface ApprovalFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create new approval; otherwise edit this approval. */
  approval: AiApproval | null;
  mode: ApprovalsDataSourceMode;
  sites: ApprovalSiteOption[];
  agents: ApprovalAgentOption[];
  runs: ApprovalRunOption[];
  onSave: (record: AiApproval) => Promise<{ error: string | null }>;
}

interface FormState {
  title: string;
  description: string;
  site: string; // '' or 'group' = Group-wide
  agentId: string;
  runId: string;
  requestType: RequestType;
  requestedAction: string;
  riskClass: RiskClass;
  severity: RiskLevel;
  environment: Environment;
  businessJustification: string;
  approvalTeam: string;
  minApprovers: number;
  expiry: string;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
  notes: string;
}

const empty: FormState = {
  title: '',
  description: '',
  site: 'group',
  agentId: '',
  runId: '',
  requestType: 'manual',
  requestedAction: '',
  riskClass: 'green',
  severity: 'low',
  environment: 'production',
  businessJustification: '',
  approvalTeam: 'Group AI Operations',
  minApprovers: 1,
  expiry: '24h',
  verificationRequired: false,
  uatRequired: false,
  auditRequired: true,
  notes: '',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

// Stable unique approval key (timestamp + random suffix). The database UUID is
// a separate internal key; `approval_key` is the stable application identifier.
function newApprovalKey(): string {
  return `APR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export default function ApprovalFormModal({ open, onClose, approval, mode, sites, agents, runs, onSave }: ApprovalFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isLive = mode === 'live';

  useEffect(() => {
    if (open) {
      setForm(
        approval
          ? {
              title: approval.title,
              description: approval.description,
              site: approval.siteId,
              agentId: approval.agentId,
              runId: approval.runId ?? '',
              requestType: approval.requestType,
              requestedAction: approval.requestedAction,
              riskClass: approval.riskClass,
              severity: approval.severity,
              environment: approval.environment,
              businessJustification: approval.businessJustification,
              approvalTeam: approval.approvalTeam,
              minApprovers: approval.minApprovers,
              expiry: approval.requirement.expiry,
              verificationRequired: approval.verificationRequired,
              uatRequired: approval.uatRequired,
              auditRequired: approval.auditRequired,
              notes: approval.notes,
            }
          : empty,
      );
      setError('');
      setSubmitting(false);
    }
  }, [open, approval]);

  const siteOptions = useMemo(() => [{ key: 'group', name: 'Group-wide' }, ...sites], [sites]);

  const agentOptions = useMemo(() => {
    if (form.site === 'group') return agents.filter((a) => a.assignedSite === null);
    if (form.site) return agents.filter((a) => a.assignedSite === null || a.assignedSite === form.site);
    return agents;
  }, [form.site, agents]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    const site = siteOptions.find((s) => s.key === form.site);
    const agent = agentOptions.find((a) => a.key === form.agentId);
    const id = approval?.id ?? newApprovalKey();

    const requirement = {
      requiredTeam: form.approvalTeam.trim(),
      requiredRole: 'AI Operations Lead',
      minApprovers: form.minApprovers,
      currentApprovals: approval?.approvalCount ?? 0,
      maxPermittedRisk: (form.severity === 'critical' ? 'high' : 'medium') as RiskLevel,
      separationOfDutiesRequired: true,
      expiry: form.expiry.trim(),
      uatRequired: form.uatRequired,
      verificationRequired: form.verificationRequired,
      auditRequired: form.auditRequired,
    };

    const base = (approval ?? {}) as Partial<AiApproval>;

    const record: AiApproval = {
      id,
      title: form.title.trim(),
      description: form.description.trim(),
      siteId: form.site === 'group' ? 'group' : form.site,
      siteName: site?.name ?? 'Group-wide',
      agentId: form.agentId || '',
      agentName: agent?.name ?? 'Unassigned',
      runId: form.runId.trim() || null,
      parentRunId: base.parentRunId ?? null,
      taskId: base.taskId ?? null,
      requestType: form.requestType,
      requestedAction: form.requestedAction.trim() || form.title.trim(),
      actionCategory: REQUEST_TYPE_LABELS[form.requestType],
      riskClass: form.riskClass,
      severity: form.severity,
      environment: form.environment,
      status: approval?.status ?? 'draft',
      requestedBy: approval?.requestedBy ?? 'Manual',
      requestedAt: approval?.requestedAt ?? 'Just now',
      approvalTeam: form.approvalTeam.trim(),
      requiredRole: 'AI Operations Lead',
      minApprovers: form.minApprovers,
      approvalCount: approval?.approvalCount ?? 0,
      expiryTime: approval?.expiryTime ?? '—',
      expiryState: approval?.expiryState ?? 'no_expiry',
      businessJustification: form.businessJustification.trim(),
      aiReasoning: base.aiReasoning ?? '',
      evidenceSummary: base.evidenceSummary ?? '',
      expectedResult: base.expectedResult ?? 'Requested change applied and verified.',
      potentialImpact: base.potentialImpact ?? '',
      affectedSystems: base.affectedSystems ?? [],
      affectedRecords: base.affectedRecords ?? '—',
      rollbackAvailable: base.rollbackAvailable ?? false,
      rollbackSummary: base.rollbackSummary ?? '',
      verificationRequired: form.verificationRequired,
      uatRequired: form.uatRequired,
      auditRequired: form.auditRequired,
      decision: base.decision ?? { type: null, reason: '', timestamp: '', actor: '', conditions: '' },
      notes: form.notes.trim() || (approval ? approval.notes : ''),
      createdAt: base.createdAt ?? '2026-08-26',
      updatedAt: 'Just now',
      recommendation: base.recommendation ?? {
        recommendation: 'Pending review.',
        confidence: '—',
        reasoningSummary: '',
        expectedOutcome: '',
        alternativeConsidered: '',
        whyApprovalRequired: '',
        riskIfApproved: '',
        riskIfRejected: '',
        riskIfDelayed: '',
      },
      evidence: base.evidence ?? [],
      impact: base.impact ?? {
        systemsAffected: '',
        sitesAffected: site?.name ?? 'Group-wide',
        usersAffected: '',
        recordsAffected: '—',
        serviceInterruptionExpected: false,
        estimatedDowntime: 'None',
        customerImpact: '',
        financialImpact: '',
        securityImpact: '',
        complianceImpact: '',
        reversibility: 'Unknown',
      },
      rollback: base.rollback ?? {
        available: false,
        method: '',
        estimatedTime: '—',
        backupRef: '—',
        owner: form.approvalTeam.trim(),
        validation: '',
      },
      requirement,
      separation: base.separation ?? {
        requestingAgent: agent?.name ?? '—',
        recommendingAgent: agent?.name ?? '—',
        approverTeam: form.approvalTeam.trim(),
        executingAgent: agent?.name ?? '—',
        verifyingAgent: 'Verification Agent',
        uatAgent: 'UAT Agent',
      },
      history: base.history ?? [],
      executionGate: base.executionGate ?? [],
    };

    setSubmitting(true);
    setError('');
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

  const saveLabel = isLive ? (approval ? 'Update Approval' : 'Create Approval Request') : 'Save Draft';

  return (
    <Modal open={open} onClose={onClose} title={approval ? 'Edit Approval' : 'Create Approval Request'} className="max-w-2xl">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Title *</label>
          <input type="text" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Modify supervisor database access" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} placeholder="What action needs approval..." className={`${inputCls} resize-y`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site</label>
            <select value={form.site} onChange={(e) => set({ site: e.target.value, agentId: '' })} className={`${inputCls} cursor-pointer`}>
              {siteOptions.map((s) => (
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
            <label className="block text-xs font-label text-foreground-500 mb-1">Run (optional)</label>
            <select value={form.runId} onChange={(e) => set({ runId: e.target.value })} className={`${inputCls} cursor-pointer`}>
              <option value="">None</option>
              {runs.map((r) => (
                <option key={r.key} value={r.key}>{r.key}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Request type</label>
            <select value={form.requestType} onChange={(e) => set({ requestType: e.target.value as RequestType })} className={`${inputCls} cursor-pointer`}>
              {REQUEST_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Requested action</label>
            <input type="text" value={form.requestedAction} onChange={(e) => set({ requestedAction: e.target.value })} placeholder="e.g. Modify RLS policy" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Risk class</label>
            <select value={form.riskClass} onChange={(e) => set({ riskClass: e.target.value as RiskClass })} className={`${inputCls} cursor-pointer`}>
              {(['green', 'amber', 'red'] as RiskClass[]).map((r) => (
                <option key={r} value={r}>{RISK_CLASS[r].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Severity</label>
            <select value={form.severity} onChange={(e) => set({ severity: e.target.value as RiskLevel })} className={`${inputCls} cursor-pointer`}>
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
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Approval team</label>
            <input type="text" value={form.approvalTeam} onChange={(e) => set({ approvalTeam: e.target.value })} placeholder="e.g. Group AI Operations" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Minimum approvers</label>
            <select value={form.minApprovers} onChange={(e) => set({ minApprovers: Number(e.target.value) })} className={`${inputCls} cursor-pointer`}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Expiry</label>
            <input type="text" value={form.expiry} onChange={(e) => set({ expiry: e.target.value })} placeholder="e.g. 24h" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Business justification</label>
          <textarea value={form.businessJustification} onChange={(e) => set({ businessJustification: e.target.value })} rows={2} maxLength={500} placeholder="Why is this action required..." className={`${inputCls} resize-y`} />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={form.verificationRequired} onChange={(e) => set({ verificationRequired: e.target.checked })} className="w-4 h-4 rounded accent-accent-500 cursor-pointer" />
            Verification required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={form.uatRequired} onChange={(e) => set({ uatRequired: e.target.checked })} className="w-4 h-4 rounded accent-accent-500 cursor-pointer" />
            UAT required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={form.auditRequired} onChange={(e) => set({ auditRequired: e.target.checked })} className="w-4 h-4 rounded accent-accent-500 cursor-pointer" />
            Audit required
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
            {isLive
              ? 'Creates an approval request only — no production action has executed.'
              : 'Demo mode: the approval is kept local only (not written to Supabase).'}
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
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