import { useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Compact "Local Runtime" section for Live Operations. Display-only — shows
 * bridge reachability + n8n/Ollama local health from the latest persisted
 * heartbeat. Never triggers a bridge check or queries local services from the
 * browser (all local checks run inside the bridge itself).
 */
export default function LocalRuntime() {
  const { nodes, summary } = useRuntimeBridge();

  useEffect(() => {
    void refreshBridge();
  }, []);

  const firstNode = nodes[0] ?? null;
  const nodeState = firstNode ? deriveBridgeNodeState(firstNode) : 'not_registered';
  const stateMeta = BRIDGE_NODE_STATE_META[nodeState];
  const latest = summary?.latest ?? null;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-server-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Local Runtime</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Private runtime bridge — outbound heartbeat &amp; health relay.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
          Execution BLOCKED
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-background-200/60">
        <Metric label="Bridge reachability" value={stateMeta.label} tone={stateMeta.tone} />
        <Metric label="n8n local health" value={latest?.n8n_status ?? 'Not reported'} tone={latest?.n8n_status === 'healthy' ? 'emerald' : latest?.n8n_status === 'unavailable' ? 'red' : latest?.n8n_status === 'degraded' ? 'amber' : 'secondary'} />
        <Metric label="Ollama local health" value={latest?.ollama_status ?? 'Not reported'} tone={latest?.ollama_status === 'healthy' ? 'emerald' : latest?.ollama_status === 'unavailable' ? 'red' : latest?.ollama_status === 'degraded' ? 'amber' : 'secondary'} />
        <Metric label="Last heartbeat" value={formatTime(firstNode?.last_heartbeat_at)} tone="secondary" muted />
        <Metric label="Runtime execution" value="Disabled" tone="red" />
      </div>

      <div className="px-4 py-2.5 border-t border-background-200/60 flex items-center justify-between gap-3">
        <p className="text-[11px] text-foreground-600">
          {firstNode
            ? `Node ${firstNode.node_key} · ${firstNode.environment} · bridge transport only — no local ports exposed.`
            : 'No bridge node registered yet — a genuine authenticated handshake is required.'}
        </p>
        <Link
          to="/ai-operations/runtime-controls"
          className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-external-link-line w-3 h-3 flex items-center justify-center"></i>
          Runtime Controls
        </Link>
      </div>
    </section>
  );
}

function Metric({ label, value, tone, muted }: { label: string; value: string; tone: 'emerald' | 'amber' | 'red' | 'secondary'; muted?: boolean }) {
  const color =
    tone === 'emerald' ? 'text-emerald-400'
      : tone === 'amber' ? 'text-amber-400'
        : tone === 'red' ? 'text-red-400'
          : muted ? 'text-foreground-300' : 'text-foreground-100';
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold mt-0.5 truncate ${color}`}>{value}</p>
    </div>
  );
}