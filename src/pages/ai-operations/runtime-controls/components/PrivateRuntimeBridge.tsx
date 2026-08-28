import { useEffect } from 'react';
import {
  useRuntimeBridge,
  refreshBridge,
} from '@/pages/ai-operations/runtime-controls/runtimeBridgeStore';
import {
  deriveBridgeNodeState,
  BRIDGE_NODE_STATE_META,
  type AiRuntimeBridgeNode,
  type BridgeNodeState,
} from '@/lib/ai-operations/runtimeBridge';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'red' | 'secondary'> = {
  healthy: 'emerald',
  degraded: 'amber',
  unavailable: 'red',
  not_configured: 'secondary',
  unknown: 'secondary',
};

export default function PrivateRuntimeBridge() {
  const { nodes, heartbeats, summary, loading, error } = useRuntimeBridge();

  useEffect(() => {
    void refreshBridge();
  }, []);

  const latest = summary?.latest ?? null;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-server-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Private Runtime Bridge</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Outbound-first local runtime connectivity — heartbeat &amp; health relay only.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
            Outbound only
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Execution BLOCKED
          </span>
        </div>
      </div>

      {/* Node + state summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-background-200/60">
        <SummaryStat label="Nodes" value={summary?.nodeCount ?? 0} />
        <SummaryStat label="Reachable" value={summary?.reachableNodes ?? 0} tone="emerald" />
        <SummaryStat label="Stale / Offline" value={`${summary?.staleNodes ?? 0} / ${summary?.offlineNodes ?? 0}`} tone="amber" />
        <SummaryStat label="Handshake" value={summary?.handshakeVerified ? 'Verified' : 'Not verified'} tone={summary?.handshakeVerified ? 'emerald' : 'amber'} />
      </div>

      {/* n8n / Ollama — cloud vs local distinction */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-background-200/60">
        <ServiceSplit
          label="n8n"
          cloud="Cloud edge: not configured / unreachable"
          local={latest?.n8n_status ?? null}
          note="Workflow execution state remains DISABLED regardless of local reachability."
        />
        <ServiceSplit
          label="Ollama"
          cloud="Cloud edge: not configured / unreachable"
          local={latest?.ollama_status ?? null}
          note="Inference state remains Disabled / Not Tested regardless of local reachability."
        />
      </div>

      {/* Node registry */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">Bridge Nodes</h4>

        {loading && nodes.length === 0 ? (
          <div className="py-6 text-center text-xs text-foreground-500">
            <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
            <span className="ml-2">Loading bridge nodes…</span>
          </div>
        ) : error && nodes.length === 0 ? (
          <div className="py-4 text-center text-xs text-amber-400">{error}</div>
        ) : nodes.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-foreground-500">
              No bridge nodes registered yet. A node is created only after a genuine authenticated outbound handshake from a deployed <span className="font-mono">dfp-runtime-bridge</span> local service. Code existence is not enough — the handshake stays <strong className="text-foreground-300">Not Verified</strong> until that happens.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="text-[11px] font-label text-foreground-600 uppercase tracking-wide border-b border-background-200/60">
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Node</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Status</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Environment</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Last heartbeat</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">n8n / Ollama</th>
                  <th className="py-1.5 font-medium whitespace-nowrap">Execution</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <BridgeNodeRow key={n.id} node={n} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">Transport only.</strong> The bridge authenticates, heartbeats and relays sanitised local health over outbound HTTPS — it never opens local ports, never accepts arbitrary URLs, and never owns execution authority. Execution remains <strong className="text-red-400">BLOCKED</strong> (Master Kill Switch ON · Production Enabled 0 · Execution Dispatch Not Started).
        </p>
      </div>
    </section>
  );
}

function BridgeNodeRow({ node }: { node: AiRuntimeBridgeNode }) {
  const state = deriveBridgeNodeState(node);
  const meta = BRIDGE_NODE_STATE_META[state];

  return (
    <tr className="border-b border-background-200/40 last:border-0">
      <td className="py-2 pr-3">
        <p className="text-sm text-foreground-100 whitespace-nowrap">{node.name ?? node.node_key}</p>
        <p className="text-[11px] text-foreground-600 font-mono whitespace-nowrap">{node.node_key}</p>
      </td>
      <td className="py-2 pr-3">
        <NodeStatePill state={state} />
      </td>
      <td className="py-2 pr-3 text-xs text-foreground-300 whitespace-nowrap">{node.environment}</td>
      <td className="py-2 pr-3 text-xs text-foreground-300 whitespace-nowrap">{formatTime(node.last_heartbeat_at)}</td>
      <td className="py-2 pr-3 text-xs text-foreground-500 whitespace-nowrap">
        {node.capabilities.includes('n8n_health') || node.capabilities.includes('n8n_metadata') ? 'n8n · ' : ''}
        {node.capabilities.includes('ollama_health') || node.capabilities.includes('ollama_models') ? 'Ollama' : '—'}
      </td>
      <td className="py-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
          {node.execution_enabled ? 'enabled' : 'BLOCKED'}
        </span>
      </td>
    </tr>
  );
}

function NodeStatePill({ state }: { state: BridgeNodeState }) {
  const meta = BRIDGE_NODE_STATE_META[state];
  const tone =
    meta.tone === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
      : meta.tone === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
        : meta.tone === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/25'
          : 'text-foreground-500 bg-background-50 border-background-300/60';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.tone === 'emerald' ? 'bg-emerald-400' : meta.tone === 'amber' ? 'bg-amber-400' : meta.tone === 'red' ? 'bg-red-400' : 'bg-secondary-400'}`}></span>
      {meta.label}
    </span>
  );
}

function ServiceSplit({ label, cloud, local, note }: { label: string; cloud: string; local: string | null; note: string }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label} connectivity</p>
        <LocalStatusPill status={local} />
      </div>
      <div className="space-y-1">
        <div className="flex items-start gap-1.5 text-[11px] text-foreground-500">
          <i className="ri-cloud-off-line w-3.5 h-3.5 flex items-center justify-center shrink-0 mt-0.5"></i>
          <span>{cloud}</span>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-foreground-500">
          <i className="ri-server-line w-3.5 h-3.5 flex items-center justify-center shrink-0 mt-0.5"></i>
          <span>
            Local runtime: {local ? local : 'Not reported (no bridge heartbeat yet)'}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-foreground-600 mt-2">{note}</p>
    </div>
  );
}

function LocalStatusPill({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-500 bg-background-50 border border-background-300/60 rounded-full px-2 py-0.5 whitespace-nowrap">
        Not reported
      </span>
    );
  }
  const tone = STATUS_TONE[status] ?? 'secondary';
  const cls =
    tone === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
      : tone === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
        : tone === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/25'
          : 'text-foreground-500 bg-background-50 border-background-300/60';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap border ${cls}`}>
      {status}
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