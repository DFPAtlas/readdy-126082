// ============================================================================
// Agent Deployment — Step 6: Review & Finish.
// ============================================================================

import type { StepProps } from '@/pages/ai-operations/agent-deployment/types';
import { ROLE_LABELS } from '@/pages/ai-operations/agent-deployment/types';
import { AGENT_AUTONOMY_LABELS } from '@/pages/ai-operations/constants';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-200 text-right break-all">{value}</span>
    </div>
  );
}

export default function ReviewStep({ draft, data, checks }: StepProps) {
  const site = draft.siteId ? data.sites.find((s) => s.id === draft.siteId) ?? null : null;
  const parent = draft.parentAgentId ? data.agents.find((a) => a.id === draft.parentAgentId) ?? null : null;
  const runtime = draft.runtimeReference ? data.runtimes.find((n) => n.node_key === draft.runtimeReference) ?? null : null;
  const workflow = draft.workflowId ? data.workflows.find((w) => w.id === draft.workflowId) ?? null : null;

  const blockers = checks.filter((c) => c.status === 'fail');
  const warnings = checks.filter((c) => c.status === 'warning');

  return (
    <div className="space-y-4">
      {/* Configuration summary */}
      <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
        <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-2">Exact configuration</p>
        <div>
          <Row label="Name" value={draft.name.trim() || '—'} />
          <Row label="Agent key" value={draft.agentKey.trim() || '—'} />
          <Row label="Role" value={ROLE_LABELS[draft.role]} />
          <Row label="Site" value={site?.name ?? (draft.role === 'shared_agent' ? 'Group-wide' : '—')} />
          <Row label="Parent manager" value={parent?.name ?? '—'} />
          <Row label="Runtime" value={runtime ? runtime.name ?? runtime.node_key : '—'} />
          <Row label="Workflow" value={workflow ? workflow.name ?? workflow.workflow_key : '—'} />
          <Row label="Permitted actions" value={AGENT_AUTONOMY_LABELS[draft.autonomy as keyof typeof AGENT_AUTONOMY_LABELS] ?? draft.autonomy} />
          <Row label="Data scope" value={draft.dataScope || '—'} />
          <Row label="Approval required" value={draft.approvalRequired ? 'Yes' : 'No'} />
          <Row label="Risk level" value={draft.riskLevel} />
        </div>
      </div>

      {/* Blockers */}
      {blockers.length > 0 ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2.5">
          <p className="text-sm text-red-400 font-medium mb-1">Remaining blockers ({blockers.length})</p>
          <ul className="text-xs text-foreground-400 space-y-1">
            {blockers.map((b) => (
              <li key={b.key}>· {b.label}: {b.note}</li>
            ))}
          </ul>
          <p className="text-xs text-foreground-500 mt-2">Resolve these before this setup can be marked ready.</p>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2.5">
          <p className="text-sm text-emerald-400 font-medium">Ready for deployment — activation not connected</p>
          <p className="text-xs text-foreground-400 mt-1">
            All checks pass and this setup can be saved. Activation is unsupported: there is no authorised backend operation to deploy an n8n workflow or start execution.
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
          <p className="text-sm text-amber-300 font-medium">Warnings ({warnings.length})</p>
          <ul className="text-xs text-foreground-400 space-y-1 mt-1">
            {warnings.map((w) => (
              <li key={w.key}>· {w.label}: {w.note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
        <p className="text-xs text-foreground-500">
          Saving this setup writes registry metadata only. It never starts a workflow, alters a runtime gate, or enables execution.
        </p>
      </div>
    </div>
  );
}