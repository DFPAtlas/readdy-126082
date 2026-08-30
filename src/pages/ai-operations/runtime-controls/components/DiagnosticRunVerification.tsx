import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import { useRuntimeBridge } from '@/pages/ai-operations/runtime-controls/runtimeBridgeStore';
import {
  queueDiagnosticRun,
  getDiagnosticRunStatus,
  deriveDiagnosticRunStatus,
  isDiagnosticRunTerminal,
  formatDiagnosticRunMs,
  DIAGNOSTIC_RUN_STATUS_META,
  DIAGNOSTIC_RUN_NODE_KEY,
  DIAGNOSTIC_RUN_PROBE_ID,
  DIAGNOSTIC_RUN_MODE,
  DIAGNOSTIC_RUN_TASK_KEY_PREFIX,
  DIAGNOSTIC_RUN_TASK_NAME,
  DIAGNOSTIC_RUN_AGENT_KEY,
  DIAGNOSTIC_RUN_AGENT_NAME,
  DIAGNOSTIC_RUN_TOOL_KEY,
  DIAGNOSTIC_RUN_TOOL_NAME,
  DIAGNOSTIC_RUN_TOOL_OPERATION,
  DIAGNOSTIC_RUN_PERMISSION,
  DIAGNOSTIC_RUN_STEPS,
  type DiagnosticRunStatusResult,
  type DiagnosticRunStatus,
} from '@/lib/ai-operations/runtimeDiagnosticRun';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DiagnosticRunVerification() {
  const { role } = useAuth();
  const { nodes } = useRuntimeBridge();

  const isPrivileged = role === 'owner' || role === 'admin';

  const [status, setStatus] = useState<DiagnosticRunStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollActiveRef = useRef(false);

  useEffect(() => {
    void refreshStatus();
    return () => {
      pollActiveRef.current = false;
    };
  }, []);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    const res = await getDiagnosticRunStatus();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }

  async function pollUntilTerminal() {
    pollActiveRef.current = true;
    let attempts = 0;
    while (pollActiveRef.current && attempts < 14) {
      await new Promise((r) => setTimeout(r, 2500));
      if (!pollActiveRef.current) break;
      const res = await getDiagnosticRunStatus();
      if (res.error) {
        setError(res.error);
        break;
      }
      if (res.data) {
        setStatus(res.data);
        if (isDiagnosticRunTerminal(deriveDiagnosticRunStatus(res.data))) break;
      }
      attempts += 1;
    }
    pollActiveRef.current = false;
  }

  async function handleRunDiagnostic() {
    if (!isPrivileged) return;
    setSending(true);
    setError(null);
    const queued = await queueDiagnosticRun(DIAGNOSTIC_RUN_NODE_KEY);
    if (queued.error) {
      setError(queued.error);
      setSending(false);
      return;
    }
    await refreshStatus();
    setSending(false);
    void pollUntilTerminal();
  }

  const nodeName = nodes.length > 0 ? (nodes[0].name ?? nodes[0].node_key) : 'HAL Runtime Bridge';

  const runStatus: DiagnosticRunStatus = status ? deriveDiagnosticRunStatus(status) : 'queued';
  const meta = DIAGNOSTIC_RUN_STATUS_META[runStatus];
  const completedSteps = (status?.steps ?? []).filter((s) => s.status === 'completed').length;
  const totalSteps = status?.run?.totalSteps ?? DIAGNOSTIC_RUN_STEPS.length;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0">
            <i className="ri-flow-chart w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime-Backed Diagnostic Run</h3>
            <p className="text-xs text-foreground-500 mt-0.5">First persisted AI Operations run backed by HAL evidence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-vip-diamond-line w-3 h-3 flex items-center justify-center"></i>
            Sandbox diagnostic only
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Normal execution BLOCKED
          </span>
        </div>
      </div>

      {/* Fixed diagnostic run configuration */}
      <div className="px-4 py-3">
        <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Fixed Diagnostic Configuration</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60 rounded-md overflow-hidden">
          <ConfigStat label="Task" value={DIAGNOSTIC_RUN_TASK_NAME} />
          <ConfigStat label="Task key prefix" value={DIAGNOSTIC_RUN_TASK_KEY_PREFIX} mono />
          <ConfigStat label="Agent" value={DIAGNOSTIC_RUN_AGENT_NAME} />
          <ConfigStat label="Agent key" value={DIAGNOSTIC_RUN_AGENT_KEY} mono />
          <ConfigStat label="Tool" value={DIAGNOSTIC_RUN_TOOL_NAME} />
          <ConfigStat label="Tool key" value={DIAGNOSTIC_RUN_TOOL_KEY} mono />
          <ConfigStat label="Operation" value={DIAGNOSTIC_RUN_TOOL_OPERATION} mono />
          <ConfigStat label="Permission" value={DIAGNOSTIC_RUN_PERMISSION} tone="emerald" />
          <ConfigStat label="Probe ID" value={DIAGNOSTIC_RUN_PROBE_ID} mono />
          <ConfigStat label="Mode" value={DIAGNOSTIC_RUN_MODE} mono />
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60">
        <SummaryStat label="Task" value={DIAGNOSTIC_RUN_TASK_NAME} />
        <SummaryStat label="Agent" value={DIAGNOSTIC_RUN_AGENT_NAME} />
        <SummaryStat label="Tool" value={DIAGNOSTIC_RUN_TOOL_NAME} />
        <SummaryStat label="HAL node" value={nodeName} />
        <SummaryStat
          label="Run Status"
          value={status && status.run ? meta.label : 'Not run'}
          tone={meta.tone === 'emerald' ? 'emerald' : meta.tone === 'red' ? 'red' : meta.tone === 'amber' ? 'amber' : undefined}
        />
        <SummaryStat label="Mutation" value="NONE" tone="red" />
      </div>

      {/* Manual trigger + refresh */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => void handleRunDiagnostic()}
            disabled={sending || loading || !isPrivileged}
            title={isPrivileged ? undefined : 'Owner or admin role required to queue a diagnostic run'}
            className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-primary-500 hover:bg-primary-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${sending ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'} w-4 h-4 flex items-center justify-center`}></i>
            {sending ? 'Queueing…' : 'Run Diagnostic Task'}
          </button>
          <button
            onClick={() => void refreshStatus()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <i className={`${loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
            Refresh
          </button>

          {!isPrivileged && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-600 whitespace-nowrap">
              <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Read-only — owner/admin required to queue
            </span>
          )}
        </div>

        {error && (
          <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
            <p className="text-xs text-red-300/90">{error}</p>
          </div>
        )}

        {status && status.run && (
          <div className="mt-3 space-y-2">
            <ResultBanner status={status} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <DetailStat label="Run ID" value={status.run.runKey || '—'} mono />
              <DetailStat label="Task key" value={status.task?.taskKey || '—'} mono />
              <DetailStat label="Run status" value={status.run.status || '—'} tone={runStatus === 'completed' ? 'emerald' : runStatus === 'failed' ? 'red' : undefined} />
              <DetailStat label="Task status" value={status.task?.status || '—'} />
              <DetailStat label="Current step" value={`${status.run.currentStep ?? 0} / ${totalSteps}`} />
              <DetailStat label="Completed steps" value={`${completedSteps} / ${totalSteps}`} />
              <DetailStat
                label="n8n status"
                value={status.signedResult?.n8nStatus || '—'}
                tone={status.signedResult?.n8nStatus === 'healthy' ? 'emerald' : status.signedResult?.n8nStatus === 'degraded' ? 'amber' : undefined}
              />
              <DetailStat
                label="Ollama status"
                value={status.signedResult?.ollamaStatus || '—'}
                tone={status.signedResult?.ollamaStatus === 'healthy' ? 'emerald' : status.signedResult?.ollamaStatus === 'degraded' ? 'amber' : undefined}
              />
              <DetailStat
                label="Model count"
                value={status.signedResult?.ollamaModelCount === null || status.signedResult?.ollamaModelCount === undefined ? '—' : String(status.signedResult.ollamaModelCount)}
              />
              <DetailStat label="Tool latency" value={formatDiagnosticRunMs(status.signedResult?.latencyMs)} />
              <DetailStat
                label="Signed evidence"
                value={status.signedResult?.verified ? 'Verified' : status.signedResult ? 'Not verified' : 'Awaiting'}
                tone={status.signedResult?.verified ? 'emerald' : status.signedResult ? 'red' : 'amber'}
              />
              <DetailStat label="Business data" value="NONE" tone="red" />
              <DetailStat label="Mutation" value="NONE" tone="red" />
              <DetailStat label="Normal execution" value="BLOCKED" tone="red" />
            </div>

            {status.steps.length > 0 && (
              <div className="mt-2">
                <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Run Lifecycle Steps</h4>
                <div className="space-y-1">
                  {status.steps.map((s) => (
                    <div key={s.stepNumber} className="flex items-center gap-2.5 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${s.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-background-200/60 text-foreground-500'}`}>
                        {s.status === 'completed' ? (
                          <i className="ri-check-line w-3 h-3 flex items-center justify-center"></i>
                        ) : s.status === 'failed' ? (
                          <i className="ri-close-line w-3 h-3 flex items-center justify-center"></i>
                        ) : (
                          <i className="ri-time-line w-3 h-3 flex items-center justify-center"></i>
                        )}
                      </span>
                      <span className="text-xs text-foreground-200 font-mono">{s.stepNumber}.</span>
                      <span className="text-xs text-foreground-100 font-mono flex-1 truncate">{s.name}</span>
                      <span className={`text-[10px] font-label uppercase tracking-wide ${s.status === 'completed' ? 'text-emerald-400' : s.status === 'failed' ? 'text-red-400' : 'text-foreground-500'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">A real, persisted AI Operations task + run lifecycle.</strong>{' '}
          The dedicated diagnostic agent executes the fixed read-only runtime-health tool through HAL exactly once, and the cloud persists six deterministic run steps plus the signed evidence before closing the run. No business data is accessed, no mutation occurs, no model inference runs, and normal runtime execution remains <strong className="text-red-400">BLOCKED</strong>.
        </p>
      </div>
    </section>
  );
}

function ResultBanner({ status }: { status: DiagnosticRunStatusResult }) {
  const runStatus = deriveDiagnosticRunStatus(status);

  if (runStatus === 'completed' && status.signedResult?.verified) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-3">
        <div className="flex items-center gap-2.5 mb-1.5">
          <i className="ri-shield-check-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-emerald-300/90 font-semibold">Diagnostic Run Verified</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Run</span>
            <span className="text-xs text-emerald-100 font-mono">{status.run?.runKey || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Steps</span>
            <span className="text-xs text-emerald-100 font-semibold">{status.steps.filter((s) => s.status === 'completed').length} / {status.run?.totalSteps ?? DIAGNOSTIC_RUN_STEPS.length}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">n8n</span>
            <span className="text-xs text-emerald-100 font-semibold">{status.signedResult?.n8nStatus || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Ollama</span>
            <span className="text-xs text-emerald-100 font-semibold">{status.signedResult?.ollamaStatus || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Mutation</span>
            <span className="text-xs text-emerald-100 font-semibold">NONE</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Execution</span>
            <span className="text-xs text-emerald-100 font-semibold">BLOCKED</span>
          </div>
        </div>
        <p className="text-[11px] text-emerald-400/70 mt-2">A real AI Operations task and run completed through the fixed read-only HAL tool. The run lifecycle, step history and signed runtime evidence were persisted without accessing business data or enabling normal execution.</p>
      </div>
    );
  }

  if (runStatus === 'failed') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Diagnostic run did not verify — the signed evidence or cloud-side permission revalidation failed. No normal execution occurred.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
      <i className="ri-time-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
      <p className="text-xs text-amber-300/90">Diagnostic run {runStatus} — awaiting signed verified evidence from HAL. Only the fixed read-only health snapshot is queried.</p>
    </div>
  );
}

function ConfigStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'emerald'; mono?: boolean }) {
  return (
    <div className="bg-background-100 px-3 py-2">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-xs font-heading font-semibold mt-0.5 truncate ${tone === 'emerald' ? 'text-emerald-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryStat({ label, value, tone, mono }: { label: string; value: number | string; tone?: 'emerald' | 'amber' | 'red'; mono?: boolean }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold mt-0.5 truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function DetailStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'red'; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
      <span className="text-xs text-foreground-500 whitespace-nowrap">{label}</span>
      <span className={`text-xs truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}