import { useEffect } from 'react';
import { useRuntimeCallbacks, refreshCallbacks } from '@/pages/ai-operations/runtime-controls/runtimeCallbacksStore';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RuntimeMessageBoundary() {
  const { callbacks, summary, loading, error } = useRuntimeCallbacks();

  useEffect(() => {
    void refreshCallbacks();
  }, []);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-mail-send-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Message Boundary</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Signed inbound machine messages — verification &amp; recording only.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
            Envelope v1
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Run mutation disabled
          </span>
        </div>
      </div>

      {/* Boundary status rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-background-200/60">
        <StatusCell label="Message envelope" value="v1" note="Versioned canonical runtime contract." tone="ready" />
        <StatusCell label="Signed callbacks" value="Ready" note="HMAC-SHA256 deterministic canonical signature." tone="ready" />
        <StatusCell label="Replay protection" value="Ready" note="Nonce reuse + duplicate message_id rejected." tone="ready" />
        <StatusCell label="Callback ledger" value="Ready" note="Append-only `ai_runtime_callbacks`." tone="ready" />
        <StatusCell label="n8n handshake" value={summary?.handshakes ? 'Verified' : 'Not verified'} note="Requires a genuine signed handshake." tone={summary?.handshakes ? 'ready' : 'amber'} />
        <StatusCell label="Run mutation" value="Disabled" note="Callbacks never mutate Runs / Orchestrations." tone="blocked" />
      </div>

      {/* Ledger summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-background-200/60">
        <SummaryStat label="Callbacks recorded" value={summary?.total ?? 0} />
        <SummaryStat label="Verified" value={summary?.verified ?? 0} tone="emerald" />
        <SummaryStat label="Blocked" value={summary?.blocked ?? 0} tone="red" />
        <SummaryStat label="Last callback" value={formatTime(summary?.lastCallback?.received_at)} muted />
      </div>

      {loading && callbacks.length === 0 ? (
        <div className="py-6 text-center text-xs text-foreground-500">
          <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
          <span className="ml-2">Loading callback ledger…</span>
        </div>
      ) : error && callbacks.length === 0 ? (
        <div className="px-4 py-4 text-center text-xs text-amber-400">{error}</div>
      ) : null}
    </section>
  );
}

function StatusCell({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'ready' | 'amber' | 'blocked' }) {
  const valueTone =
    tone === 'ready' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="bg-background-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
        <span className={`text-xs font-label font-semibold whitespace-nowrap ${valueTone}`}>{value}</span>
      </div>
      <p className="text-[11px] text-foreground-600 mt-1">{note}</p>
    </div>
  );
}

function SummaryStat({ label, value, tone, muted }: { label: string; value: number | string; tone?: 'emerald' | 'red'; muted?: boolean }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-semibold mt-0.5 ${tone === 'emerald' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : muted ? 'text-foreground-300' : 'text-foreground-100'}`}>
        {value}
      </p>
    </div>
  );
}