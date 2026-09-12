// ============================================================================
// Agent Deployment — Step 3: Runtime & Workflow.
// ============================================================================

import type { StepProps } from '@/pages/ai-operations/agent-deployment/types';

const selectCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';
const labelCls = 'block text-xs font-label text-foreground-500 mb-1';

export default function RuntimeStep({ draft, patch, data }: StepProps) {
  const runtime = draft.runtimeReference
    ? data.runtimes.find((n) => n.node_key === draft.runtimeReference) ?? null
    : null;
  const workflow = draft.workflowId
    ? data.workflows.find((w) => w.id === draft.workflowId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Runtime host */}
      <div>
        <label className={labelCls}>Runtime host</label>
        <select
          value={draft.runtimeReference ?? ''}
          onChange={(e) => patch({ runtimeReference: e.target.value || null })}
          className={selectCls}
        >
          <option value="">No runtime selected…</option>
          {data.runtimes.map((n) => (
            <option key={n.node_key} value={n.node_key}>{n.name ?? n.node_key}</option>
          ))}
        </select>
        {data.runtimes.length === 0 && (
          <p className="text-[11px] font-label text-amber-400 mt-1">No runtime bridge nodes are registered.</p>
        )}
      </div>

      {runtime && (
        <div className="bg-background-50 border border-background-200/60 rounded-md p-3 space-y-1">
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Runtime connectivity</p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Node:</span> {runtime.name ?? runtime.node_key}
          </p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Status:</span> {runtime.status}
          </p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Execution enabled:</span> {runtime.execution_enabled ? 'Yes' : 'No'}
          </p>
          <p className="text-[11px] font-label text-foreground-600">Credentials are managed server-side — never stored or shown here.</p>
        </div>
      )}

      {/* Workflow mapping */}
      <div>
        <label className={labelCls}>Approved n8n workflow</label>
        <select
          value={draft.workflowId ?? ''}
          onChange={(e) => patch({ workflowId: e.target.value || null })}
          className={selectCls}
        >
          <option value="">No workflow mapped…</option>
          {data.workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name ?? w.workflow_key}{w.is_active === true ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
        {data.workflows.length === 0 && (
          <p className="text-[11px] font-label text-amber-400 mt-1">No approved workflows are registered yet.</p>
        )}
      </div>

      {workflow && (
        <div className="bg-background-50 border border-background-200/60 rounded-md p-3 space-y-1">
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Workflow identity & mapping state</p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Workflow:</span> {workflow.name ?? workflow.workflow_key}
          </p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Runtime status:</span> {workflow.runtime_status}
          </p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Execution mode:</span> {workflow.execution_mode}
          </p>
          <p className="text-sm text-foreground-300">
            <span className="text-foreground-500">Active:</span> {workflow.is_active === true ? 'Yes' : 'No'}
          </p>
        </div>
      )}

      <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
        <p className="text-[11px] font-label text-foreground-600">
          Mapping this workflow records a reference only — it does not start, activate or alter the workflow in n8n.
        </p>
      </div>
    </div>
  );
}