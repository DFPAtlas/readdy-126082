import { useEffect, useState } from 'react';
import {
  useRuntimeBridge,
} from '@/pages/ai-operations/runtime-controls/runtimeBridgeStore';
import {
  queueTransportProbe,
  getTransportProbeStatus,
  deriveProbeStatus,
  formatRoundTrip,
  TRANSPORT_PROBE_STATUS_META,
  type TransportProbeStatusResult,
  type TransportProbeStatusEntry,
  type TransportProbeStatus,
} from '@/lib/ai-operations/runtimeTransportProbe';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const STATUS_TONE: Record<TransportProbeStatus, string> = {
  acknowledged: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  delivered: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  pending: 'text-foreground-500 bg-background-50 border-background-300/60',
  expired: 'text-red-400 bg-red-500/10 border-red-500/25',
  rejected: 'text-red-400 bg-red-500/10 border-red-500/25',
};

export default function TransportProbeVerification() {
  const { nodes } = useRuntimeBridge();
  const [status, setStatus] = useState<TransportProbeStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    const res = await getTransportProbeStatus();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }

  async function handleSendProbe() {
    setSending(true);
    setError(null);
    const queued = await queueTransportProbe();
    if (queued.error) {
      setError(queued.error);
      setSending(false);
      return;
    }
    // Re-read status after queueing (probe will be pending/delivered until HAL acks).
    await refreshStatus();
    setSending(false);
  }

  const nodeName = nodes.length > 0 ? (nodes[0].name ?? nodes[0].node_key) : 'atlas-hal-runtime-01';
  const nodeKey = nodes.length > 0 ? nodes[0].node_key : 'atlas-hal-runtime-01';

  const latest: TransportProbeStatusEntry | undefined = status?.probes?.[0];
  const latestStatus: TransportProbeStatus = latest ? deriveProbeStatus(latest.status) : 'pending';
  const meta = TRANSPORT_PROBE_STATUS_META[latestStatus];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-send-plane-2-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Dry-Run Transport Verification</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Cloud → HAL → cloud control-message path — transport only, no execution.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-vip-diamond-line w-3 h-3 flex items-center justify-center"></i>
            Dry-run only
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Execution BLOCKED
          </span>
        </div>
      </div>

      {/* Verification summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60">
        <SummaryStat label="Node" value={nodeName} mono />
        <SummaryStat label="Last Probe" value={latest ? formatTime(latest.queuedAt) : 'None'} />
        <SummaryStat
          label="Probe Status"
          value={latest ? meta.label : 'Not run'}
          tone={latestStatus === 'acknowledged' ? 'emerald' : latestStatus === 'expired' || latestStatus === 'rejected' ? 'red' : latestStatus === 'delivered' ? 'amber' : undefined}
        />
        <SummaryStat label="Round Trip" value={latest ? formatRoundTrip(latest.roundTripMs) : '—'} />
        <SummaryStat
          label="Signed ACK"
          value={latest?.signedAck ? 'Verified' : latest ? 'Awaiting' : '—'}
          tone={latest?.signedAck ? 'emerald' : 'amber'}
        />
        <SummaryStat label="Execution" value="BLOCKED" tone="red" />
      </div>

      {/* Send probe action + result */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => void handleSendProbe()}
            disabled={sending || loading}
            className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${sending ? 'ri-loader-4-line animate-spin' : 'ri-send-plane-2-line'} w-4 h-4 flex items-center justify-center`}></i>
            {sending ? 'Sending…' : 'Send Dry-Run Probe'}
          </button>
          <button
            onClick={() => void refreshStatus()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <i className={`${loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
            Refresh
          </button>
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
              <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                <span className="text-xs text-foreground-500 whitespace-nowrap">Queued</span>
                <span className="text-xs text-foreground-100 font-mono whitespace-nowrap">{formatTime(latest.queuedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                <span className="text-xs text-foreground-500 whitespace-nowrap">Acknowledged</span>
                <span className="text-xs text-foreground-100 font-mono whitespace-nowrap">{formatTime(latest.acknowledgedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                <span className="text-xs text-foreground-500 whitespace-nowrap">Correlation ID</span>
                <span className="text-xs text-foreground-100 font-mono whitespace-nowrap">{latest.correlationId || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                <span className="text-xs text-foreground-500 whitespace-nowrap">Expected node</span>
                <span className="text-xs text-foreground-100 font-mono whitespace-nowrap">{latest.expectedNodeKey || nodeKey}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">Transport only.</strong> A successful probe proves the control-message path works — it does <strong className="text-foreground-300">not</strong> satisfy the Master Kill Switch, Production Enabled, Site/Agent/Approval/Policy gates, or Execution Dispatch. It never calls n8n, performs Ollama inference, or executes an agent. Execution remains <strong className="text-red-400">BLOCKED</strong>.
        </p>
      </div>
    </section>
  );
}

function ResultBanner({ latest }: { latest: TransportProbeStatusEntry }) {
  const status = deriveProbeStatus(latest.status);
  if (status === 'acknowledged') {
    return (
      <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-2.5">
        <i className="ri-shield-check-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-emerald-300/90 font-medium">Transport Verified — No Execution Performed</p>
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-time-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe expired without a signed acknowledgement — transport not yet verified.</p>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">Probe rejected — transport not verified. No execution was performed.</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
      <i className="ri-time-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
      <p className="text-xs text-amber-300/90">Probe {status} — awaiting signed acknowledgement from HAL. No execution is performed.</p>
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