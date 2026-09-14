import { Link } from 'react-router-dom';
import type { AiExecSummary, RuntimeExec } from '../executiveTypes';
import { RUNTIME_NODE_LABELS, RUNTIME_NODE_STYLES } from '../executiveTypes';
import { SectionHeading, Unavailable, Metric } from './shared';

export default function AiRuntimePanel({ ai, runtime }: { ai: AiExecSummary; runtime: RuntimeExec }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <SectionHeading
        icon="ri-robot-2-line"
        title="AI Operations"
        action={{ label: 'Open AI Operations', to: '/ai-operations' }}
      />

      {!ai.available ? (
        <Unavailable label="AI operations data unavailable" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <Metric label="AI Sites" value={ai.sites} />
          <Metric label="Agents" value={ai.agents} />
          <Metric label="Active Runs" value={ai.activeRuns} />
          <Metric label="Pending Approvals" value={ai.pendingApprovals} tone="text-amber-400" />
          <Metric label="Critical Alerts" value={ai.criticalAlerts} tone={ai.criticalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'} />
          <Metric label="Runtime Online" value={ai.runtimeOnline} tone="text-emerald-400" />
          <Metric label="Runtime Offline / Stale" value={ai.runtimeOfflineStale} tone={ai.runtimeOfflineStale > 0 ? 'text-red-400' : 'text-foreground-400'} />
          <Metric
            label="AI Cost (Est.) This Month"
            value={ai.costThisMonth != null ? `£${ai.costThisMonth.toFixed(2)}` : '—'}
            tone="text-foreground-300"
          />
        </div>
      )}

      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2 mt-1">Runtime Nodes</p>
      {!runtime.available ? (
        <Unavailable label="Runtime telemetry unavailable" />
      ) : runtime.nodes.length === 0 ? (
        <p className="text-sm text-foreground-500">No runtime nodes registered.</p>
      ) : (
        <div className="space-y-1.5">
          {runtime.nodes.map((n) => (
            <Link
              key={n.key}
              to="/ai-operations/runtime-health"
              className="flex items-center gap-3 bg-background-50 border border-background-200/50 hover:border-accent-500/30 rounded-md px-3 py-2 transition-colors cursor-pointer"
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-label whitespace-nowrap shrink-0 ${RUNTIME_NODE_STYLES[n.state]}`}>
                {RUNTIME_NODE_LABELS[n.state]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground-100 font-mono truncate">{n.name}</p>
                <p className="text-[10px] text-foreground-500 truncate">
                  {n.n8n ? `n8n: ${n.n8n}` : 'n8n: —'} · {n.ollama ? `ollama: ${n.ollama}` : 'ollama: —'}
                </p>
              </div>
              <span className="text-[10px] text-foreground-600 whitespace-nowrap shrink-0">
                {n.lastHeartbeat ? `Last seen ${formatAge(n.lastHeartbeat)}` : 'No heartbeat'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function formatAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}