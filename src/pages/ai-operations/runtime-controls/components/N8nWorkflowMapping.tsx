import { useEffect } from 'react';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import {
  useRuntimeN8n,
  refreshN8n,
  runN8nDispatchPreview,
  resetN8nPreview,
} from '@/pages/ai-operations/runtime-controls/runtimeN8nStore';

/**
 * Orchestrator Detail — "n8n Workflow Mapping". Shows the approved n8n workflow
 * mappings (verification state, n8n state, AI Ops execution mode, risk, approval
 * requirement) relevant to this orchestration, plus a single "Preview Dispatch"
 * action. No Execute button — preview is dry-run / deny-only.
 */
export default function N8nWorkflowMapping({ orchestration }: { orchestration: AiOrchestration }) {
  const { registry, connection, preview, loading } = useRuntimeN8n();

  useEffect(() => {
    void refreshN8n();
  }, []);

  const previewing = preview.status === 'running';
  const previewResult = preview.result;

  const primaryMapping = registry.find(
    (r) => r.name?.toLowerCase().includes(orchestration.primaryAgentName?.toLowerCase() ?? '') ?? false,
  ) ?? registry[0];

  const handlePreview = () => {
    if (!primaryMapping) return;
    void runN8nDispatchPreview({
      workflow_key: primaryMapping.workflow_key,
      request_type: 'evaluate_orchestration',
      orchestration_key: orchestration.correlationId || orchestration.id,
      risk_level: orchestration.riskClass,
    });
  };

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-flow-chart w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">n8n Workflow Mapping</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Read-only mapping — no workflow is executed.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
          Execution disabled
        </span>
      </div>

      {loading && registry.length === 0 ? (
        <p className="text-xs text-foreground-500 py-3">
          <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
          <span className="ml-2">Loading workflow mappings…</span>
        </p>
      ) : registry.length === 0 ? (
        <div className="py-3">
          <p className="text-xs text-foreground-500">
            No approved n8n workflow mapping is assigned to this orchestration yet. n8n discovery is read-only and does not automatically approve workflows.
          </p>
          <p className="text-[11px] text-foreground-600 mt-1">
            n8n connectivity: {connection?.configured ? (connection.reachable ? 'configured · reachable' : 'configured · unreachable') : 'not configured'}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {registry.map((r) => (
            <div key={r.id} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground-100 whitespace-nowrap">{r.name ?? r.workflow_key}</span>
                  <span className="text-[10px] font-label text-foreground-600 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">{r.workflow_type ?? 'workflow'}</span>
                </div>
                <p className="text-[11px] text-foreground-600 mt-0.5">
                  n8n state: {r.is_active ? 'Active' : 'Inactive'} · AI Ops execution: {r.execution_mode} · last verified: {r.last_verified_at ? new Date(r.last_verified_at).toLocaleString() : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${r.risk_level === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/25' : r.risk_level === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'}`}>
                  {(r.risk_level ?? 'green').toUpperCase()}
                </span>
                {r.approval_required && (
                  <span className="text-[10px] font-label text-amber-400 whitespace-nowrap">approval req.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {primaryMapping && (
        <div className="mt-3 pt-3 border-t border-background-200/60">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${previewing ? 'ri-loader-4-line animate-spin' : 'ri-scan-line'} w-4 h-4 flex items-center justify-center`}></i>
            {previewing ? 'Previewing…' : 'Preview Dispatch'}
          </button>
        </div>
      )}

      {preview.error && (
        <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
          <p className="text-xs text-red-300/90">{preview.error}</p>
        </div>
      )}

      {previewResult && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1 whitespace-nowrap">
              <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
              {previewResult.decision}
            </span>
            <span className="text-[11px] text-foreground-600">dry-run preview · no execution occurred</span>
          </div>
          <div className="space-y-1">
            {previewResult.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground-300">
                <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                <span>{reason}</span>
              </div>
            ))}
          </div>
          <button
            onClick={resetN8nPreview}
            className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Reset preview
          </button>
        </div>
      )}
    </section>
  );
}