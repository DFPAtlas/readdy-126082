// ============================================================================
// Agent Deployment — Step 1: Identity & Site.
// ============================================================================

import { slugify } from '@/pages/ai-operations/agent-deployment/deploymentLogic';
import { templatesForSite } from '@/pages/ai-operations/agent-deployment/templates';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type DeploymentDraft,
  type DeploymentRole,
  type StepProps,
} from '@/pages/ai-operations/agent-deployment/types';
import { AGENT_CATEGORY_OPTIONS, AGENT_CATEGORY_LABELS } from '@/pages/ai-operations/constants';

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';
const selectCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';
const labelCls = 'block text-xs font-label text-foreground-500 mb-1';

export default function IdentityStep({ draft, patch, data }: StepProps) {
  const site = draft.siteId ? data.sites.find((s) => s.id === draft.siteId) ?? null : null;
  const siteKey = site?.site_key ?? null;
  const templates = templatesForSite(siteKey);
  const keyLocked = Boolean(draft.agentId);

  const applyTemplate = (templateKey: string) => {
    const t = templates.find((x) => x.key === templateKey);
    if (!t) return;
    if (t.key === 'blank') {
      patch({ templateKey: t.key, role: 'sub_agent', name: '', responsibility: '', description: '' });
      return;
    }
    patch({
      templateKey: t.key,
      role: t.role,
      category: t.category,
      name: t.name,
      responsibility: t.responsibility,
      description: t.description,
    });
  };

  const onNameChange = (v: string) => {
    const p: Partial<DeploymentDraft> = { name: v };
    if (!keyLocked && !draft.agentKey.trim()) p.agentKey = slugify(v);
    patch(p);
  };

  const onRoleChange = (role: DeploymentRole) => {
    const p: Partial<DeploymentDraft> = { role };
    if (role === 'shared_agent') {
      p.siteId = null;
      p.parentAgentId = null;
    } else if (role === 'site_manager') {
      p.category = 'orchestration';
      p.parentAgentId = null;
    }
    patch(p);
  };

  return (
    <div className="space-y-4">
      {/* Template */}
      <div>
        <label className={labelCls}>Setup template</label>
        <select value={draft.templateKey ?? 'blank'} onChange={(e) => applyTemplate(e.target.value)} className={selectCls}>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <p className="text-[11px] font-label text-foreground-600 mt-1">
          Templates are draft definitions only — nothing is created or activated until you save.
        </p>
      </div>

      {/* Role */}
      <div>
        <label className={labelCls}>Agent role</label>
        <select value={draft.role} onChange={(e) => onRoleChange(e.target.value as DeploymentRole)} className={selectCls}>
          {(Object.keys(ROLE_LABELS) as DeploymentRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <p className="text-[11px] font-label text-foreground-600 mt-1">{ROLE_DESCRIPTIONS[draft.role]}</p>
      </div>

      {/* Site */}
      {draft.role !== 'shared_agent' ? (
        <div>
          <label className={labelCls}>Site *</label>
          <select
            value={draft.siteId ?? ''}
            onChange={(e) => patch({ siteId: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Select a registered site…</option>
            {data.sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {!data.sitesAvailable && (
            <p className="text-[11px] font-label text-amber-400 mt-1">Site registry unavailable — site-specific agents cannot be assigned right now.</p>
          )}
        </div>
      ) : (
        <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
          <p className="text-sm text-foreground-400">Group-wide scope — this shared agent has no site or manager assignment.</p>
        </div>
      )}

      {/* Name + key */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Agent name *</label>
          <input type="text" value={draft.name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Platform Health Agent" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Agent key *</label>
          <input
            type="text"
            value={draft.agentKey}
            onChange={(e) => patch({ agentKey: e.target.value })}
            disabled={keyLocked}
            placeholder="lowercase-hyphenated"
            className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
          {keyLocked && <p className="text-[11px] font-label text-foreground-600 mt-1">Stable key is locked after first save.</p>}
        </div>
      </div>

      {/* Category */}
      {draft.role !== 'site_manager' && (
        <div>
          <label className={labelCls}>Category</label>
          <select value={draft.category} onChange={(e) => patch({ category: e.target.value })} className={selectCls}>
            {AGENT_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{AGENT_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      )}

      {/* Responsibility */}
      <div>
        <label className={labelCls}>Responsibility</label>
        <input type="text" value={draft.responsibility} onChange={(e) => patch({ responsibility: e.target.value })} placeholder="One-line summary of what this agent is responsible for" className={inputCls} />
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={draft.description} onChange={(e) => patch({ description: e.target.value })} rows={3} maxLength={500} placeholder="What this agent does, and how it fits the site…" className={`${inputCls} resize-y`} />
      </div>
    </div>
  );
}