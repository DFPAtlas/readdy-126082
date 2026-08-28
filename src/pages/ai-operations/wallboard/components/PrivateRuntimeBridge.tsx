import { useEffect } from 'react';
import {
  useRuntimeBridge,
  refreshBridge,
} from '@/pages/ai-operations/runtime-controls/runtimeBridgeStore';
import {
  deriveBridgeNodeState,
  BRIDGE_NODE_STATE_META,
} from '@/lib/ai-operations/runtimeBridge';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Wallboard "Private Runtime Bridge" widget — shows the latest persisted bridge
 * state only. It never queries local services or performs a bridge check from
 * the browser (all local checks run inside the bridge itself).
 */
export default function PrivateRuntimeBridge() {
  const { nodes, summary } = useRuntimeBridge();

  useEffect(() => {
    void refreshBridge();
  }, []);

  const firstNode = nodes[0] ?? null;
  const nodeState = firstNode ? deriveBridgeNodeState(firstNode) : 'not_registered';
  const stateMeta = BRIDGE_NODE_STATE_META[nodeState];
  const latest = summary?.latest ?? null;

  const stateTone =
    stateMeta.tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
      : stateMeta.tone === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
        : stateMeta.tone === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/25'
          : 'bg-background-200/60 text-foreground-500 border-background-300/60';

  return (
    <section className="h-full flex flex-col bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-background-200/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-server-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </div>
          <h3 className="text-xs font-label font-semibold text-foreground-200 uppercase tracking-wide truncate">Private Runtime Bridge</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
          BLOCKED
        </span>
      </div>

      <div className="flex-1 min-h-0 px-4 py-3 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Bridge state</span>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${stateTone}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stateMeta.tone === 'emerald' ? 'bg-emerald-400' : stateMeta.tone === 'amber' ? 'bg-amber-400' : stateMeta.tone === 'red' ? 'bg-red-400' : 'bg-secondary-400'}`}></span>
            {stateMeta.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="n8n local" value={latest?.n8n_status ?? '—'} tone={latest?.n8n_status === 'healthy' ? 'emerald' : 'secondary'} />
          <MiniStat label="Ollama local" value={latest?.ollama_status ?? '—'} tone={latest?.ollama_status === 'healthy' ? 'emerald' : 'secondary'} />
          <MiniStat label="Nodes" value={String(summary?.nodeCount ?? 0)} tone="secondary" />
          <MiniStat label="Heartbeat" value={firstNode ? formatTime(firstNode.last_heartbeat_at) : '—'} tone="secondary" />
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'secondary' }) {
  const color = tone === 'emerald' ? 'text-emerald-400' : 'text-foreground-100';
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2">
      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold mt-0.5 truncate ${color}`}>{value}</p>
    </div>
  );
}