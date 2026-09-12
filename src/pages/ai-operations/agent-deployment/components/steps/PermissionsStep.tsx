// ============================================================================
// Agent Deployment — Step 4: Permissions & Schedule.
// ============================================================================

import type { StepProps } from '@/pages/ai-operations/agent-deployment/types';
import { AGENT_AUTONOMY_OPTIONS, AGENT_AUTONOMY_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import type { RiskLevel } from '@/pages/ai-operations/types';

const selectCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';
const labelCls = 'block text-xs font-label text-foreground-500 mb-1';

export default function PermissionsStep({ draft, patch }: StepProps) {
  return (
    <div className="space-y-4">
      {/* Permitted actions / autonomy */}
      <div>
        <label className={labelCls}>Permitted actions (autonomy)</label>
        <select value={draft.autonomy} onChange={(e) => patch({ autonomy: e.target.value })} className={selectCls}>
          {AGENT_AUTONOMY_OPTIONS.map((a) => (
            <option key={a} value={a}>{AGENT_AUTONOMY_LABELS[a]}</option>
          ))}
        </select>
        <p className="text-[11px] font-label text-foreground-600 mt-1">
          New agents default to <span className="text-foreground-300">Observe Only</span> (read-only supervision). No writes are permitted until you choose otherwise.
        </p>
      </div>

      {/* Data scope */}
      <div>
        <label className={labelCls}>Data scope</label>
        <select value={draft.dataScope} onChange={(e) => patch({ dataScope: e.target.value })} className={selectCls}>
          <option value="group">Group-wide</option>
          <option value="site">Site-scoped</option>
          <option value="agent">Agent-scoped</option>
        </select>
      </div>

      {/* Approval requirement */}
      <div className="flex items-start gap-3 bg-background-50 border border-background-200/60 rounded-md p-3">
        <input
          type="checkbox"
          id="deploy-approval"
          checked={draft.approvalRequired}
          onChange={(e) => patch({ approvalRequired: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-background-300 accent-accent-500 cursor-pointer"
        />
        <label htmlFor="deploy-approval" className="text-sm text-foreground-200 cursor-pointer">
          Require human approval before execution
        </label>
      </div>

      {/* Risk level */}
      <div>
        <label className={labelCls}>Risk level</label>
        <select value={draft.riskLevel} onChange={(e) => patch({ riskLevel: e.target.value })} className={selectCls}>
          {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((r) => (
            <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
          ))}
        </select>
      </div>

      {/* Schedule (honest — not installed in n8n) */}
      <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
        <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-1">Schedule</p>
        <p className="text-sm text-foreground-400">
          Schedule linkage is not connected in this phase. Recording a schedule reference here does not install it in n8n — that action is not supported.
        </p>
      </div>
    </div>
  );
}