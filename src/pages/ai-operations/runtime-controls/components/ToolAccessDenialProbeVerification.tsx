import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  runToolAccessDenialProbe,
  getToolAccessDenialProbeStatus,
  deriveToolAccessDenialProbeStatus,
  TOOL_ACCESS_DENIAL_STATUS_META,
  TOOL_ACCESS_DENIAL_AGENT_KEY,
  TOOL_ACCESS_DENIAL_AGENT_NAME,
  TOOL_ACCESS_DENIAL_TOOL_KEY,
  TOOL_ACCESS_DENIAL_TOOL_NAME,
  TOOL_ACCESS_DENIAL_PROBE_ID,
  TOOL_ACCESS_DENIAL_MODE,
  TOOL_ACCESS_DENIAL_EXPECTED_DECISION,
  TOOL_ACCESS_DENIAL_EXPECTED_REASON,
  type ToolAccessDenialProbeStatusResult,
  type ToolAccessDenialProbeStatusEntry,
  type ToolAccessDenialProbeStatus,
} from '@/lib/ai-operations/runtimeToolAccessDenialProbe';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ToolAccessDenialProbeVerification() {
  const { role } = useAuth();

  // Owner/admin may run; any internal role may view + refresh.
  const isPrivileged = role === 'owner' || role === 'admin';

  const [status, setStatus] = useState<ToolAccessDenialProbeStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    const res = await getToolAccessDenialProbeStatus();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }

  async function handleRunProbe() {
    if (!isPrivileged) return;
    setSending(true);
    setError(null);
    // Cloud-side only — the run resolves synchronously (no HAL round trip).
    const run = await runToolAccessDenialProbe();
    if (run.error) {
      setError(run.error);
    }
    // Re-read the authoritative audit evidence (covers denied / blocked / failed).
    await refreshStatus();
    setSending(false);
  }

  const latest: ToolAccessDenialProbeStatusEntry | undefined = status?.probes?.[0];
  const latestStatus: ToolAccessDenialProbeStatus = latest ? deriveToolAccessDenialProbeStatus(latest) : 'not_run';
  const meta = TOOL_ACCESS_DENIAL_STATUS_META[latestStatus];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-shield-keyhole-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Tool Access Gate</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Verify unapproved tool access is denied before runtime</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-vip-diamond-line w-3 h-3 flex items-center justify-center"></i>
            Fixed agent + tool only
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Execution BLOCKED
          </span>
        </div>
      </div>

      {/* Read-only probe configuration */}
      <div className="px-4 py-3">
        <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Fixed Denial Configuration</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-background-200/60 rounded-md overflow-hidden">
          <ConfigStat label="Agent" value={TOOL_ACCESS_DENIAL_AGENT_NAME} />
          <ConfigStat label="Agent key" value={TOOL_ACCESS_DENIAL_AGENT_KEY} mono />
          <ConfigStat label="Tool" value={TOOL_ACCESS_DENIAL_TOOL_NAME} />
          <ConfigStat label="Tool key" value={TOOL_ACCESS_DENIAL_TOOL_KEY} mono />
          <ConfigStat label="Probe ID" value={TOOL_ACCESS_DENIAL_PROBE_ID} mono />
          <ConfigStat label="Mode" value={TOOL_ACCESS_DENIAL_MODE} mono />
          <ConfigStat label="Expected decision" value={TOOL_ACCESS_DENIAL_EXPECTED_DECISION} tone="emerald" />
          <ConfigStat label="Expected reason" value={TOOL_ACCESS_DENIAL_EXPECTED_REASON} mono />
        </div>
      </div>

      {/* Verification summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60">
        <SummaryStat label="Agent" value={TOOL_ACCESS_DENIAL_AGENT_NAME} />
        <SummaryStat label="Tool" value={TOOL_ACCESS_DENIAL_TOOL_NAME} />
        <SummaryStat
          label="Probe Status"
          value={latest ? meta.label : 'Not run'}
          tone={meta.tone === 'emerald' ? 'emerald' : meta.tone === 'red' ? 'red' : undefined}
        />
        <SummaryStat
          label="Decision"
          value={latest ? (latest.decision || '—') : '—'}
          tone={latest?.decision === 'denied' ? 'emerald' : latest?.decision === 'blocked' ? 'red' : latest?.decision === 'failed' ? 'red' : undefined}
        />
        <SummaryStat
          label="Reason"
          value={latest ? (latest.reason || '—') : '—'}
          tone={latest?.reason === 'tool_permission_missing' ? 'emerald' : undefined}
          mono
        />
        <SummaryStat label="Execution" value="BLOCKED" tone="red" />
      </div>

      {/* Manual trigger + refresh */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => void handleRunProbe()}
            disabled={sending || loading || !isPrivileged}
            title={isPrivileged ? undefined : 'Owner or admin role required to run a tool access denial probe'}
            className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${sending ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'} w-4 h-4 flex items-center justify-center`}></i>
            {sending ? 'Running…' : 'Run Tool Denial Probe'}
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
              Read-only — owner/admin required to run
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
              <DetailStat label="Agent key" value={latest.agentKey || TOOL_ACCESS_DENIAL_AGENT_KEY} mono />
              <DetailStat label="Tool key" value={latest.toolKey || TOOL_ACCESS_DENIAL_TOOL_KEY} mono />
              <DetailStat
                label="Permission state"
                value={latest.permissionState || '—'}
                tone={latest.permissionState === 'none' ? 'emerald' : latest.permissionState === 'present' ? 'red' : undefined}
              />
              <DetailStat
                label="Decision"
                value={latest.decision || '—'}
                tone={latest.decision === 'denied' ? 'emerald' : latest.decision === 'blocked' || latest.decision === 'failed' ? 'red' : undefined}
              />
              <DetailStat
                label="Reason"
                value={latest.reason || '—'}
                tone={latest.reason === 'tool_permission_missing' ? 'emerald' : latest.reason ? 'red' : undefined}
                mono
              />
              <DetailStat
                label="Audit result"
                value={latest.outcome || '—'}
                tone={latest.outcome === 'success' ? 'emerald' : latest.outcome === 'blocked' || latest.outcome === 'failed' ? 'red' : undefined}
              />
              <DetailStat label="Occurred at" value={formatTime(latest.occurredAt)} />
              <DetailStat label="Execution state" value="BLOCKED" tone="red" />
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">Authorization verification only — no tool, HAL, n8n, Ollama or runtime action is ever executed.</strong>{' '}
          The probe always checks the fixed diagnostic agent and fixed registry-only diagnostic tool (which has no credential, endpoint or executable capability) and succeeds only when no explicit tool permission exists — producing an expected <strong className="text-emerald-400">DENIED</strong> / <strong className="text-emerald-400">tool_permission_missing</strong> result. An unexpected active permission yields a BLOCKED result, never a pass. Execution remains <strong className="text-red-400">BLOCKED</strong>.
        </p>
      </div>
    </section>
  );
}

function ResultBanner({ latest }: { latest: ToolAccessDenialProbeStatusEntry }) {
  const status = deriveToolAccessDenialProbeStatus(latest);

  if (status === 'denied') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-3">
        <div className="flex items-center gap-2.5 mb-1.5">
          <i className="ri-shield-check-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-emerald-300/90 font-semibold">Tool Access Denial Verified</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Decision</span>
            <span className="text-xs text-emerald-100 font-semibold">{TOOL_ACCESS_DENIAL_EXPECTED_DECISION}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Reason</span>
            <span className="text-xs text-emerald-100 font-mono">{TOOL_ACCESS_DENIAL_EXPECTED_REASON}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Permission state</span>
            <span className="text-xs text-emerald-100 font-semibold">none</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Audit result</span>
            <span className="text-xs text-emerald-100 font-semibold">success</span>
          </div>
        </div>
        <p className="text-[11px] text-emerald-400/70 mt-2">The DFP Runtime Diagnostic Agent was denied access to the diagnostic tool because no explicit tool permission exists. No tool or runtime action was executed.</p>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-forbid-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe BLOCKED — an unexpected active tool permission is present for the diagnostic agent and diagnostic tool. The denial precondition is violated; no tool was executed.</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe failed a precondition ({latest.reason || 'unknown'}): {latest.reason === 'agent_not_registered' ? 'diagnostic agent not registered/active' : latest.reason === 'diagnostic_tool_missing' ? 'diagnostic tool not registered' : latest.reason === 'tool_has_executable_config' ? 'diagnostic tool unexpectedly has an executable configuration' : latest.reason === 'kill_switch_state_invalid' ? 'master kill switch not in the required state' : 'denial could not be verified'}. No tool was executed.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
      <i className="ri-time-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
      <p className="text-xs text-amber-300/90">No denial result recorded yet — run the probe to record cloud-side authorization evidence.</p>
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

function SummaryStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'emerald' | 'red'; mono?: boolean }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold mt-0.5 truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function DetailStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'emerald' | 'red'; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
      <span className="text-xs text-foreground-500 whitespace-nowrap">{label}</span>
      <span className={`text-xs truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}