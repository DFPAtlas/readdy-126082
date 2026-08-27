import { useState } from 'react';
import type { ToolConnection, ToolCategory, Environment, Criticality } from '@/pages/ai-operations/types';
import Modal from '@/components/base/Modal';
import { demoSites } from '@/mocks/ai-operations-sites';
import {
  TOOL_CATEGORY_OPTIONS,
  TOOL_CATEGORY_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';

const fieldCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';
const labelCls = 'block text-xs font-label text-foreground-400 mb-1.5';

interface ConnectionFormModalProps {
  open: boolean;
  onClose: () => void;
  connection: ToolConnection | null;
  onSave: (connection: ToolConnection) => void;
}

const CRITICALITY_OPTIONS: Criticality[] = ['low', 'medium', 'high', 'critical'];

export default function ConnectionFormModal({ open, onClose, connection, onSave }: ConnectionFormModalProps) {
  const [name, setName] = useState(connection?.name ?? '');
  const [provider, setProvider] = useState(connection?.provider ?? '');
  const [category, setCategory] = useState<ToolCategory>(connection?.category ?? 'other');
  const [scope, setScope] = useState(connection?.scope ?? 'Group-wide');
  const [siteId, setSiteId] = useState<string | null>(connection?.siteId ?? null);
  const [environment, setEnvironment] = useState<Environment>(connection?.environment ?? 'production');
  const [criticality, setCriticality] = useState<Criticality>(connection?.criticality ?? 'medium');
  const [ownerTeam, setOwnerTeam] = useState(connection?.ownerTeam ?? '');
  const [reference, setReference] = useState(connection?.reference ?? '');
  const [approvalRequired, setApprovalRequired] = useState(connection?.approvalRequired ?? false);
  const [auditRequired, setAuditRequired] = useState(connection?.auditRequired ?? true);

  const handleSave = () => {
    if (!name.trim() || !provider.trim()) return;
    const base: ToolConnection = {
      id: connection?.id ?? `CON-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim(),
      provider: provider.trim(),
      category,
      description: connection?.description ?? `Central connection for ${name.trim()}.`,
      scope,
      siteId,
      environment,
      status: connection?.status ?? 'not_configured',
      criticality,
      configurationState: connection?.configurationState ?? 'partial',
      accessMode: connection?.accessMode ?? 'read',
      reference: reference.trim() || '—',
      ownerTeam: ownerTeam.trim() || 'DFP Core Team',
      lastChecked: connection?.lastChecked ?? '—',
      lastSuccessfulUse: connection?.lastSuccessfulUse ?? 'Never',
      failureCount: connection?.failureCount ?? 0,
      approvalRequired,
      auditRequired,
      notes: connection?.notes ?? '',
      createdAt: connection?.createdAt ?? '2026-08-25',
      updatedAt: '2026-08-25',
      agentAccess: connection?.agentAccess ?? [],
      siteUsage: connection?.siteUsage ?? [],
      operationGroups: connection?.operationGroups ?? [],
      permissions: connection?.permissions ?? [],
      health: connection?.health ?? { state: 'unknown', lastSuccessfulCheck: '—', lastFailure: '—', failureSummary: 'Not yet configured.', responseTime: '—', availability: '—', recommendedAction: 'Complete connection setup.' },
      dependencies: connection?.dependencies ?? [],
      usageEvents: connection?.usageEvents ?? [],
      security: connection?.security ?? { credentialsExternal: true, secretsHiddenFromAgents: true, environmentIsolation: true, leastPrivilege: true, approvalForHighRisk: true, auditEnabled: true, rotationStatus: '—', lastSecurityReview: '—' },
    };
    onSave(base);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={connection ? 'Edit Connection' : 'Add Connection'}>
      <div className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Supabase" className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Provider</label>
          <input type="text" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Supabase" className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as ToolCategory)} className={`${fieldCls} cursor-pointer`}>
            {TOOL_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{TOOL_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Site / Group scope</label>
          <select
            value={siteId ?? 'group'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'group') {
                setSiteId(null);
                setScope('Group-wide');
              } else {
                const s = demoSites.find((x) => x.id === v);
                setSiteId(v);
                setScope(s?.name ?? 'Group-wide');
              }
            }}
            className={`${fieldCls} cursor-pointer`}
          >
            <option value="group">Group-wide</option>
            {demoSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)} className={`${fieldCls} cursor-pointer`}>
              {ENVIRONMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Criticality</label>
            <select value={criticality} onChange={(e) => setCriticality(e.target.value as Criticality)} className={`${fieldCls} cursor-pointer`}>
              {CRITICALITY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Owner / team</label>
          <input type="text" value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} placeholder="e.g. DFP Core Team" className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Reference name (safe identifier only)</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. supabase-group-prod" className={fieldCls} />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground-200 cursor-pointer">
            <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} className="w-4 h-4 accent-accent-500" />
            Approval required for high-risk actions
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground-200 cursor-pointer">
            <input type="checkbox" checked={auditRequired} onChange={(e) => setAuditRequired(e.target.checked)} className="w-4 h-4 accent-accent-500" />
            Audit required
          </label>
        </div>

        <div className="bg-background-50 border border-background-200/60 rounded-md p-3 text-[11px] font-label text-foreground-500 leading-relaxed">
          Credentials and production connectivity will be configured through a secure connection process in a later phase.
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-background-400/60">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 hover:text-foreground-100 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !provider.trim()}
          className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-background-950 rounded-md px-3 py-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-save-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Save Draft
        </button>
      </div>
    </Modal>
  );
}