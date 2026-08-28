import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  useRuntimeBridge,
} from '@/pages/ai-operations/runtime-controls/runtimeBridgeStore';
import {
  queueN8nSandboxProbe,
  getN8nSandboxProbeStatus,
  deriveN8nProbeStatus,
  isN8nProbeTerminal,
  formatN8nMs,
  N8N_PROBE_STATUS_META,
  N8N_PROBE_NODE_KEY,
  N8N_PROBE_PROBE_ID,
  N8N_PROBE_MODE,
  N8N_PROBE_WORKFLOW_ALIAS,
  N8N_PROBE_TIMEOUT_SECONDS,
  N8N_PROBE_EXPECTED_STATUS,
  type N8nProbeStatusResult,
  type N8nProbeStatusEntry,
  type N8nProbeStatus,
} from '@/lib/ai-operations/runtimeN8nProbe';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function N8nSandboxProbeVerification() {
  const { role } = useAuth();
  const { nodes } = useRuntimeBridge();

  // Owner/admin may queue; any internal role may view + refresh.
  const isPrivileged = role === 'owner' || role === 'admin';

  const [status, setStatus] = useState<N8nProbeStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollActiveRef = useRef(false);

  useEffect(() => {
    void refreshStatus();
    // Stop any in-flight polling on unmount.
    return () => {
      pollActiveRef.current = false;
    };
  }, []);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    const res = await getN8nSandboxProbeStatus();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }

  async function pollUntilTerminal(correlationId: string) {
    pollActiveRef.current = true;
    let attempts = 0;
    while (pollActiveRef.current && attempts < 12) {
      await new Promise((r) => setTimeout(r, 2500));
      if (!pollActiveRef.current) break;
      const res = await getN8nSandboxProbeStatus(correlationId);
      if (res.error) {
        setError(res.error);
        break;
      }
      if (res.data) {
        setStatus(res.data);
        const latest = res.data.probes[0];
        if (latest && isN8nProbeTerminal(deriveN8nProbeStatus(latest))) break;
      }
      attempts += 1;
    }
    pollActiveRef.current = false;
  }

  async function handleRunProbe() {
    if (!isPrivileged) return;
    setSending(true);
    setError(null);
    const queued = await queueN8nSandboxProbe(N8N_PROBE_NODE_KEY);
    if (queued.error) {
      setError(queued.error);
      setSending(false);
      return;
    }
    // Immediately re-read status, then short-poll until terminal (read-only).
    await refreshStatus();
    setSending(false);
    if (queued.data?.correlationId) {
      void pollUntilTerminal(queued.data.correlationId);
    }
  }

  const nodeName = nodes.length > 0 ? (nodes[0].name ?? nodes[0].node_key) : 'HAL Runtime Bridge';

  const latest: N8nProbeStatusEntry | undefined = status?.probes?.[0];
  const latestStatus: N8nProbeStatus = latest ? deriveN8nProbeStatus(latest) : 'pending';
  const meta = N8N_PROBE_STATUS_META[latestStatus];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-flow-chart w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Controlled n8n Sandbox Probe</h3>
            <p className="text-xs text-foreground-500 mt-0.5">One fixed harmless local n8n diagnostic workflow through HAL — no arbitrary workflow.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-vip-diamond-line w-3 h-3 flex items-center justify-center"></i>
            Fixed workflow only
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Execution BLOCKED
          </span>
        </div>
      </div>

      {/* Read-only probe configuration */}
      <div className="px-4 py-3">
        <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Fixed Probe Configuration</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60 rounded-md overflow-hidden">
          <ConfigStat label="Node" value={nodeName} />
          <ConfigStat label="Probe ID" value={N8N_PROBE_PROBE_ID} mono />
          <ConfigStat label="Workflow" value={N8N_PROBE_WORKFLOW_ALIAS} />
          <ConfigStat label="Mode" value={N8N_PROBE_MODE} mono />
          <ConfigStat label="Timeout" value={`${N8N_PROBE_TIMEOUT_SECONDS} seconds`} />
          <ConfigStat label="Execution" value="BLOCKED" tone="red" />
        </div>
      </div>

      {/* Verification summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60">
        <SummaryStat label="Node" value={nodeName} />
        <SummaryStat label="Probe ID" value={N8N_PROBE_PROBE_ID} mono />
        <SummaryStat label="Workflow" value={N8N_PROBE_WORKFLOW_ALIAS} />
        <SummaryStat
          label="Probe Status"
          value={latest ? meta.label : 'Not run'}
          tone={meta.tone === 'emerald' ? 'emerald' : meta.tone === 'red' ? 'red' : meta.tone === 'amber' ? 'amber' : undefined}
        />
        <SummaryStat
          label="Verified"
          value={latest?.verified ? 'Verified' : latest ? 'No' : '—'}
          tone={latest?.verified ? 'emerald' : 'amber'}
        />
        <SummaryStat label="Execution" value="BLOCKED" tone="red" />
      </div>

      {/* Manual trigger + refresh */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => void handleRunProbe()}
            disabled={sending || loading || !isPrivileged}
            title={isPrivileged ? undefined : 'Owner or admin role required to queue a probe'}
            className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${sending ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'} w-4 h-4 flex items-center justify-center`}></i>
            {sending ? 'Queueing…' : 'Run n8n Sandbox Probe'}
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

        {latest && (
          <div className="mt-3 space-y-2">
            <ResultBanner latest={latest} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <DetailStat label="Probe Key" value={latest.probeKey || '—'} mono />
              <DetailStat label="Correlation ID" value={latest.correlationId || '—'} mono />
              <DetailStat label="Result Status" value={latest.resultStatus || (latest.hasResult ? 'received' : 'awaiting')} />
              <DetailStat
                label="Verified"
                value={latest.verified ? 'Verified' : latest.hasResult ? 'Not verified' : 'Awaiting'}
                tone={latest.verified ? 'emerald' : latest.hasResult ? 'red' : 'amber'}
              />
              <DetailStat label="Workflow alias" value={latest.workflowReference || N8N_PROBE_WORKFLOW_ALIAS} />
              <DetailStat label="Safe Output" value={latest.safeOutput || '—'} mono />
              <DetailStat label="n8n latency" value={formatN8nMs(latest.latencyMs)} />
              <DetailStat label="End-to-end round trip" value={formatN8nMs(latest.roundTripMs)} />
              <DetailStat label="Expiry" value={formatTime(latest.expiresAt)} />
              <DetailStat label="Execution state" value="BLOCKED" tone="red" />
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">Controlled diagnostic workflow only — no agent, tool, model or business workflow executed.</strong>{' '}
          The probe always uses the fixed workflow and payload; it never sends arbitrary workflow IDs, URLs or payloads, and success is only shown when the backend returns a verified match. Execution remains <strong className="text-red-400">BLOCKED</strong>.
        </p>
      </div>
    </section>
  );
}

function ResultBanner({ latest }: { latest: N8nProbeStatusEntry }) {
  const status = deriveN8nProbeStatus(latest);

  if (status === 'completed' && latest.verified) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-3">
        <div className="flex items-center gap-2.5 mb-1.5">
          <i className="ri-shield-check-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-emerald-300/90 font-semibold">n8n Sandbox Probe Verified</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Expected result</span>
            <span className="text-xs text-emerald-100 font-mono">{N8N_PROBE_EXPECTED_STATUS}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Signed Result</span>
            <span className="text-xs text-emerald-100 font-semibold">Verified</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Workflow</span>
            <span className="text-xs text-emerald-100">{latest.workflowReference || N8N_PROBE_WORKFLOW_ALIAS}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Execution</span>
            <span className="text-xs text-emerald-100 font-semibold">BLOCKED</span>
          </div>
        </div>
        <p className="text-[11px] text-emerald-400/70 mt-2">Controlled diagnostic workflow only — no agent, tool, model or business workflow executed.</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-time-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe expired without a verified result — not verified.</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe rejected — not verified. No workflow was executed.</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe returned a result that was not verified — output did not match the expected deterministic result.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
      <i className="ri-time-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
      <p className="text-xs text-amber-300/90">Probe {status} — awaiting a signed verified result from HAL. No arbitrary workflow is executed.</p>
    </div>
  );
}

function ConfigStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'red'; mono?: boolean }) {
  return (
    <div className="bg-background-100 px-3 py-2">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-xs font-heading font-semibold mt-0.5 truncate ${tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
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