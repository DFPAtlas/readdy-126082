import { useEffect } from 'react';
import {
  useRuntimeCallbacks,
  refreshCallbacks,
} from '@/pages/ai-operations/runtime-controls/runtimeCallbacksStore';
import type { AiRuntimeCallback } from '@/lib/ai-operations/runtimeCallbacks';

const CALLBACK_TYPE_LABELS: Record<string, string> = {
  connector_handshake: 'Handshake',
  connector_heartbeat: 'Heartbeat',
  dispatch_ack: 'Dispatch Ack',
  workflow_progress: 'Workflow Progress',
  workflow_result: 'Workflow Result',
  workflow_error: 'Workflow Error',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CallbackChannel() {
  const { callbacks, summary, loading, error } = useRuntimeCallbacks();

  useEffect(() => {
    void refreshCallbacks();
  }, []);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-plug-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">n8n Callback Channel</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Signed inbound channel — verification &amp; recording only.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
            Dispatch processing disabled
          </span>
        </div>
      </div>

      {/* Channel state */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-background-200/60">
        <ChannelStat label="Callback framework" value="Ready" tone="ready" />
        <ChannelStat label="Service identity" value="Registered · blocked" note="dfp-n8n-runtime (registry identity only)." tone="amber" />
        <ChannelStat label="Signing configuration" value="Not configured" note="DFP_N8N_RUNTIME_SIGNING_KEY unset → fails closed." tone="amber" />
        <ChannelStat label="Last verified handshake" value={summary?.handshakes ? 'Verified' : 'Not verified'} tone={summary?.handshakes ? 'ready' : 'amber'} />
        <ChannelStat label="Last authenticated callback" value={summary?.lastCallback ? formatTime(summary.lastCallback.received_at) : '—'} tone={summary?.lastCallback ? 'ready' : 'amber'} />
        <ChannelStat label="Replay protection" value="Ready" note="Nonce + message_id + timestamp window." tone="ready" />
      </div>

      {/* Callback history — safe metadata only */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">
          Callback History <span className="text-foreground-600 normal-case font-normal">(safe metadata only — no raw payload or signature)</span>
        </h4>

        {loading && callbacks.length === 0 ? (
          <div className="py-6 text-center text-xs text-foreground-500">
            <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
            <span className="ml-2">Loading callbacks…</span>
          </div>
        ) : error && callbacks.length === 0 ? (
          <div className="py-4 text-center text-xs text-amber-400">{error}</div>
        ) : callbacks.length === 0 ? (
          <p className="text-xs text-foreground-500 py-2">
            No callbacks recorded yet. A valid signed <span className="font-mono">connector_handshake</span> is required before n8n callback connectivity can be considered verified — callbacks are inserted server-side only, never by the browser.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {callbacks.slice(0, 12).map((c) => (
              <CallbackRow key={c.id} callback={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CallbackRow({ callback }: { callback: AiRuntimeCallback }) {
  const typeLabel = CALLBACK_TYPE_LABELS[callback.callback_type] ?? callback.callback_type;
  const verified = callback.verification_state === 'verified';
  const blocked = callback.processing_state === 'blocked';

  return (
    <div className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-foreground-100 whitespace-nowrap">{callback.message_id}</span>
          <span className="text-[10px] font-label text-foreground-600 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">{typeLabel}</span>
        </div>
        <p className="text-[11px] text-foreground-600 mt-0.5 truncate">
          {formatTime(callback.received_at)} · {callback.source_system} · {callback.environment}
          {callback.correlation_id ? ` · ${callback.correlation_id}` : ''}
          {callback.workflow_key ? ` · ${callback.workflow_key}` : ''}
        </p>
        {callback.safe_summary && <p className="text-[11px] text-foreground-500 mt-0.5 truncate">{callback.safe_summary}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${
            verified ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-red-400 bg-red-500/10 border-red-500/25'
          }`}
        >
          <i className={`${verified ? 'ri-shield-check-line' : 'ri-close-circle-line'} w-3 h-3 flex items-center justify-center`}></i>
          {callback.verification_state}
        </span>
        {blocked && (
          <span className="inline-flex items-center gap-1 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            blocked
          </span>
        )}
      </div>
    </div>
  );
}

function ChannelStat({ label, value, note, tone }: { label: string; value: string; note?: string; tone: 'ready' | 'amber' }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-label font-semibold mt-0.5 ${tone === 'ready' ? 'text-emerald-400' : 'text-amber-400'}`}>{value}</p>
      {note && <p className="text-[11px] text-foreground-600 mt-1">{note}</p>}
    </div>
  );
}