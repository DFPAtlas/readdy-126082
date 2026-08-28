import { useEffect } from 'react';
import {
  useRuntimeN8n,
  refreshN8n,
} from '@/pages/ai-operations/runtime-controls/runtimeN8nStore';

/**
 * Agent Detail — small n8n runtime mapping section shown when the agent has an
 * approved workflow mapping. Display-only: shows the workflow, mapping state,
 * connectivity, and that execution is disabled. Does not imply the agent is
 * running through n8n yet.
 */
export default function AgentN8nMapping({ agentName }: { agentName: string }) {
  const { registry, connection, loading } = useRuntimeN8n();

  useEffect(() => {
    void refreshN8n();
  }, []);

  const matching = registry.filter(
    (r) => r.name?.toLowerCase().includes(agentName.toLowerCase()) ?? false,
  );

  if (loading && registry.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <p className="text-xs text-foreground-500">
          <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
          <span className="ml-2">Loading n8n mappings…</span>
        </p>
      </section>
    );
  }

  if (matching.length === 0) {
    return null;
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-flow-chart w-4 h-4 flex items-center justify-center"></i>
          </div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">n8n Runtime Mapping</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
          Execution disabled
        </span>
      </div>

      <div className="space-y-2">
        {matching.map((r) => (
          <div key={r.id} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm text-foreground-100 whitespace-nowrap">{r.name ?? r.workflow_key}</p>
                <p className="text-[11px] text-foreground-600 mt-0.5">
                  Mapping: {r.runtime_status === 'verified' ? 'verified' : r.runtime_status === 'review_required' ? 'review required' : 'not verified'} · execution mode: {r.execution_mode}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${r.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-foreground-500 bg-background-100 border-background-300/60'}`}>
                {r.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-foreground-600 mt-3 leading-relaxed">
        n8n connectivity: {connection?.configured ? (connection.reachable ? 'configured · reachable' : 'configured · unreachable') : 'not configured'}.{' '}
        <strong className="text-foreground-400">{agentName}</strong> is not running through n8n — this is registry mapping metadata only.
      </p>
    </section>
  );
}