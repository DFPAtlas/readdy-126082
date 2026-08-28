import { useEffect, useState } from 'react';
import {
  useRuntimeN8n,
  refreshN8n,
  discoverN8nWorkflows,
  verifyN8nMapping,
  runN8nDispatchPreview,
  resetN8nPreview,
} from '@/pages/ai-operations/runtime-controls/runtimeN8nStore';

const EXECUTION_MODE_LABELS: Record<string, string> = {
  disabled: 'Disabled',
  dry_run: 'Dry-run',
  future_pilot: 'Future pilot',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function N8nConnectorPanel() {
  const { registry, connection, summary, discovered, discoveredError, loading, error, preview, lastValidation } = useRuntimeN8n();
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);

  useEffect(() => {
    void refreshN8n();
  }, []);

  const handleDiscover = () => void discoverN8nWorkflows();
  const handleVerify = (key: string) => {
    setVerifyingKey(key);
    void verifyN8nMapping(key).finally(() => setVerifyingKey(null));
  };

  const previewing = preview.status === 'running';
  const previewResult = preview.result;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-flow-chart w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">n8n Connector</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Read-only metadata adapter — dry-run only.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ConnectionPill connection={connection} />
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            DISABLED / DRY-RUN ONLY
          </span>
        </div>
      </div>

      {/* Connection summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-background-200/60">
        <SummaryStat label="Configuration" value={connection?.configured ? 'Configured' : 'Not configured'} tone={connection?.configured ? 'emerald' : 'amber'} />
        <SummaryStat label="API connectivity" value={connection?.reachable ? 'Reachable' : connection?.configured ? 'Unreachable' : 'Unknown'} tone={connection?.reachable ? 'emerald' : 'amber'} />
        <SummaryStat label="Approved workflows" value={summary?.approvedWorkflows ?? registry.length ?? 0} />
        <SummaryStat label="Verified mappings" value={summary?.verifiedMappings ?? 0} tone={summary?.verifiedMappings ? 'emerald' : undefined} />
      </div>

      {connection?.configured && !connection?.reachable && connection?.error && (
        <div className="px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/25 flex items-start gap-2">
          <i className="ri-alert-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
          <p className="text-xs text-amber-300/90">{connection.error}</p>
        </div>
      )}

      {/* Approved workflow mappings */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide">Approved Workflow Mappings</h4>
          <button
            onClick={handleDiscover}
            className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-search-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Discover workflows
          </button>
        </div>

        {loading && registry.length === 0 ? (
          <div className="py-6 text-center text-xs text-foreground-500">
            <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
            <span className="ml-2">Loading workflow registry…</span>
          </div>
        ) : error && registry.length === 0 ? (
          <div className="py-4 text-center text-xs text-amber-400">{error}</div>
        ) : registry.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-foreground-500">
              No workflows have been intentionally registered as AI Operations mappings yet. Discovery and approval are separate concepts — discovered workflows are not automatically approved.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="text-[11px] font-label text-foreground-600 uppercase tracking-wide border-b border-background-200/60">
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Workflow</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">n8n state</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">AI Ops execution</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Risk</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Verification</th>
                  <th className="py-1.5 font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registry.map((r) => (
                  <tr key={r.id} className="border-b border-background-200/40 last:border-0">
                    <td className="py-2 pr-3">
                      <p className="text-sm text-foreground-100 whitespace-nowrap">{r.name ?? r.workflow_key}</p>
                      <p className="text-[11px] text-foreground-600 font-mono whitespace-nowrap">{r.workflow_key}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${r.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-foreground-500 bg-background-50 border-background-300/60'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
                        <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
                        {EXECUTION_MODE_LABELS[r.execution_mode] ?? r.execution_mode}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <RiskPill risk={r.risk_level ?? 'green'} />
                    </td>
                    <td className="py-2 pr-3">
                      <MappingStatePill state={r.runtime_status} />
                      <p className="text-[10px] text-foreground-600 mt-0.5 whitespace-nowrap">{formatTime(r.last_verified_at)}</p>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleVerify(r.workflow_key)}
                        disabled={verifyingKey === r.workflow_key}
                        className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <i className={`${verifyingKey === r.workflow_key ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
                        Verify
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastValidation && (
          <div className="mt-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
            <p className="text-xs text-foreground-400">
              <span className="font-mono text-foreground-300">{lastValidation.key}</span>
              {' · '}
              {lastValidation.result.verified ? 'Verified' : 'Review required'}
              {lastValidation.result.driftReasons.length > 0 && ` — ${lastValidation.result.driftReasons.join(' ')}`}
            </p>
          </div>
        )}
      </div>

      {/* Discovered workflows (sanitised metadata only) */}
      {discovered.length > 0 && (
        <div className="px-4 py-3 border-t border-background-200/60">
          <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">
            Discovered Workflows <span className="text-foreground-600 normal-case font-normal">(not approved — metadata only)</span>
          </h4>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {discovered.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-100 whitespace-nowrap">{w.name}</span>
                    {w.active && <span className="text-[10px] font-label text-emerald-400 whitespace-nowrap">active</span>}
                  </div>
                  <p className="text-[11px] text-foreground-600">{w.nodeCount} nodes · triggers: {w.triggers.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RiskPill risk={w.risk} />
                  <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-300/60 rounded-full px-2 py-0.5 whitespace-nowrap">
                    Discovered — Not Approved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {discoveredError && (
        <div className="px-4 py-2.5 border-t border-background-200/60">
          <p className="text-xs text-amber-400">{discoveredError}</p>
        </div>
      )}

      {/* Dispatch preview (dry-run, deny-only) */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">Dispatch Preview</h4>
        {registry.length === 0 ? (
          <p className="text-xs text-foreground-500">Register an approved workflow mapping to run a dispatch preview. Preview is dry-run only — no workflow or webhook is ever called.</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void runN8nDispatchPreview({ workflow_key: registry[0].workflow_key, request_type: 'request_agent_run' })}
              disabled={previewing}
              className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className={`${previewing ? 'ri-loader-4-line animate-spin' : 'ri-scan-line'} w-4 h-4 flex items-center justify-center`}></i>
              {previewing ? 'Previewing…' : 'Preview Dispatch'}
            </button>
            {previewResult && (
              <button
                onClick={resetN8nPreview}
                className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
                Reset
              </button>
            )}
          </div>
        )}

        {preview.error && (
          <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
            <p className="text-xs text-red-300/90">{preview.error}</p>
          </div>
        )}

        {previewResult && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1 whitespace-nowrap">
                <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
                {previewResult.decision}
              </span>
              <span className="text-[11px] text-foreground-600">
                workflow <span className="font-mono text-foreground-400">{previewResult.workflow.workflowKey}</span>
                {' · '}{previewResult.workflow.n8nState} · {previewResult.workflow.executionMode}
              </span>
            </div>

            {previewResult.reasons.length > 0 && (
              <div className="space-y-1">
                {previewResult.reasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground-300">
                    <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            )}

            {previewResult.gates.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {previewResult.gates.map((g) => (
                  <div key={g.key} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                    <span className="text-xs text-foreground-300 whitespace-nowrap">{g.label}</span>
                    <PreviewGatePill state={g.state} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ConnectionPill({ connection }: { connection: { configured: boolean; reachable: boolean; authenticated: boolean | null } | null }) {
  if (!connection || !connection.configured) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
        Not configured
      </span>
    );
  }
  if (connection.reachable && connection.authenticated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-checkbox-circle-line w-3 h-3 flex items-center justify-center"></i>
        Reachable · Authenticated
      </span>
    );
  }
  if (connection.reachable && connection.authenticated === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-close-circle-line w-3 h-3 flex items-center justify-center"></i>
        Auth failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
      <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
      Unreachable
    </span>
  );
}

function RiskPill({ risk }: { risk: string }) {
  const tone = risk === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/25' : risk === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${tone}`}>
      {risk.toUpperCase()}
    </span>
  );
}

function MappingStatePill({ state }: { state: string }) {
  if (state === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
        Verified
      </span>
    );
  }
  if (state === 'review_required') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
        <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
        Review Required
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-500 bg-background-50 border border-background-300/60 rounded-full px-2 py-0.5 whitespace-nowrap">
      Not verified
    </span>
  );
}

function PreviewGatePill({ state }: { state: 'pass' | 'block' | 'not_required' | 'not_ready' }) {
  if (state === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
        Pass
      </span>
    );
  }
  if (state === 'block') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
        Block
      </span>
    );
  }
  if (state === 'not_ready') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
        Not Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-300/60 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
      Not Required
    </span>
  );
}

function SummaryStat({ label, value, tone, muted }: { label: string; value: number | string; tone?: 'emerald' | 'amber'; muted?: boolean }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-semibold mt-0.5 ${tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : muted ? 'text-foreground-300' : 'text-foreground-100'}`}>
        {value}
      </p>
    </div>
  );
}