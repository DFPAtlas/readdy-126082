// ============================================================================
// Agent Deployment — Step 2: Manager Assignment.
// ============================================================================

import {
  managersForSite,
  duplicateSiteManager,
  wouldCreateCycle,
} from '@/pages/ai-operations/agent-deployment/deploymentLogic';
import type { StepProps } from '@/pages/ai-operations/agent-deployment/types';

const selectCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';
const labelCls = 'block text-xs font-label text-foreground-500 mb-1';

export default function ManagerStep({ draft, patch, data }: StepProps) {
  const site = draft.siteId ? data.sites.find((s) => s.id === draft.siteId) ?? null : null;

  if (draft.role === 'shared_agent') {
    return (
      <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
        <p className="text-sm text-foreground-400">Shared agents have no parent manager — they operate group-wide.</p>
      </div>
    );
  }

  if (draft.role === 'site_manager') {
    const dup = draft.siteId ? duplicateSiteManager(data.agents, draft.siteId, draft.agentId) : false;
    return (
      <div className="space-y-3">
        <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
          <p className="text-sm text-foreground-200 font-medium">{site ? `${site.name} — Site Manager` : 'Site Manager'}</p>
          <p className="text-xs text-foreground-500 mt-1">This agent will orchestrate the other agents on the selected site. It has no parent.</p>
        </div>
        {dup && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            <p className="text-sm text-amber-300">
              Duplicate site manager — another orchestration agent already manages this site. Assigning a second manager is flagged as an assignment issue.
            </p>
          </div>
        )}
      </div>
    );
  }

  // sub_agent — select a same-site manager.
  const managers = draft.siteId ? managersForSite(data.agents, draft.siteId) : [];
  const options = managers.filter(
    (m) => m.id !== draft.agentId && !wouldCreateCycle(draft.agentId, m.id, data.agents),
  );

  return (
    <div className="space-y-4">
      {!draft.siteId ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
          <p className="text-sm text-amber-300">Select a site first (Step 1) before assigning a parent manager.</p>
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls}>Parent manager *</label>
            <select
              value={draft.parentAgentId ?? ''}
              onChange={(e) => patch({ parentAgentId: e.target.value || null })}
              className={selectCls}
            >
              <option value="">Select a site manager…</option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <p className="text-[11px] font-label text-foreground-600 mt-1">
              Only orchestration agents on {site?.name ?? 'this site'} are offered — self-parenting, cycles and cross-site parents are blocked.
            </p>
          </div>

          {options.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              <p className="text-sm text-amber-300">
                No eligible manager found on this site. Create a site manager first, then return to assign this sub-agent.
              </p>
            </div>
          )}

          <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
            <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-1">Manager assignment rules</p>
            <ul className="text-xs text-foreground-500 space-y-1">
              <li>· Managers are resolved by stable ids — never by name matching.</li>
              <li>· Self-parenting and parent cycles are prevented.</li>
              <li>· A manager must belong to the same site.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}