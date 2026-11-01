import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { useEffect, useState } from 'react';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { deriveHalRunActivity } from '@/lib/ai-operations/halRunActivity';
import { useAutoPage } from '@/pages/ai-operations/wallboard/useAutoPage';

const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour12: false }) : '—';

/** Read-only wall view. Names use exact instance-bound registry mappings. */
export default function HalRunActivityPanel() {
  const { latestHeartbeat, bridgeNode } = useRuntimeHealth();
  const group = useGroupLiveData();
  const registry = useN8nData();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  const activity = deriveHalRunActivity(latestHeartbeat?.local_services?.n8n_executions,
    latestHeartbeat?.received_at ?? null, now, latestHeartbeat?.heartbeat_key?.startsWith('SIM-') ?? false, {
      registry: registry.workflows, agents: group.agents, sites: group.sites, environment: bridgeNode?.environment ?? '',
      available: registry.registryAvailability && group.availability.agents && group.availability.sites,
    });
  const pageCount = Math.max(1, Math.ceil(activity.rows.length / 2));
  const [page] = useAutoPage(pageCount);
  return <HalRunActivityView activity={activity} page={page} />;
}

export function HalRunActivityView({ activity, page = 0 }: { activity: ReturnType<typeof deriveHalRunActivity>; page?: number }) {
  const pageCount = Math.max(1, Math.ceil(activity.rows.length / 2));
  const visible = activity.rows.slice(page * 2, page * 2 + 2);
  return <section className="ow-hal-activity" aria-label="HAL workflow run activity">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold tracking-wider text-cyan-300">HAL RUN ACTIVITY</h3>
      <span className="text-[10px] text-slate-400">{activity.complete ? `${activity.running} running` : `${activity.running} observed · partial`}</span>
    </div>
    <div className="mt-1 mb-2 space-y-0.5">
      {activity.instances.map(source => <div key={source.instance} className="flex justify-between gap-1 text-[9px]">
        <span className="text-slate-400">{source.instance}</span>
        <span className={source.current ? 'text-cyan-300' : 'text-amber-400'}>{source.sample?.mappingState === 'invalid' ? `${source.label} / MAP INVALID` : source.label} · {time(source.sample?.sampledAt ?? null)}</span>
      </div>)}
    </div>
    <div className="flex-1 min-h-0 space-y-2">
      {visible.length === 0 ? <p className="text-[11px] text-slate-400 leading-relaxed">{activity.complete ? 'No saved executions in the current samples.' : 'Run activity unknown. Awaiting configured, current HAL telemetry.'}</p> : visible.map(run => <article key={run.key} className="ow-hal-run" aria-label={`${run.identity.title}, ${run.identity.siteName ?? run.identity.scopeLabel ?? 'site unassigned'}, ${run.instance}, ${run.status}`}>
        <div className="flex justify-between gap-2">
          <span className="text-[11px] text-slate-100 truncate" title={`${run.identity.title} · Workflow ${run.workflowId}${run.identity.observedOn ? ` · inventory ${run.identity.observedOn}; workflow ${run.identity.workflowActiveAtInventory ? 'active' : 'inactive'} then` : ''}`}>{run.identity.title}</span>
          <strong className={`text-[10px] uppercase shrink-0 ${run.simulated || run.status === 'unknown' ? 'text-amber-400' : ['error', 'crashed'].includes(run.status) ? 'text-red-400' : run.status === 'success' ? 'text-green-400' : 'text-cyan-300'}`}>{run.simulated ? 'SIMULATED' : run.status}</strong>
        </div>
        <p className="text-[9px] text-amber-400 truncate" title={run.identity.label}>{run.identity.siteName ?? run.identity.scopeLabel ?? 'Site unassigned'} · {run.identity.label}</p>
        <p className="text-[9px] text-slate-400 truncate" title={`Workflow ${run.workflowId} · ${run.instance} · Run ${run.id}`}>{run.instance} · Run {run.id}</p>
        <p className="text-[10px] text-slate-300 tabular-nums">Start {time(run.startedAt)} · {run.stoppedAt ? `End ${time(run.stoppedAt)}` : run.status === 'unknown' ? `Last: ${run.lastStatus}` : ['new', 'running', 'waiting'].includes(run.status) ? 'In progress' : 'End unknown'}{run.durationMs === null ? '' : ` · ${(run.durationMs / 1000).toFixed(0)}s ${run.durationLabel}`}</p>
      </article>)}
    </div>
    <div className="flex justify-between gap-2 mt-2 text-[9px] text-slate-500">
      <span>Saved workflow sample · London time</span><span>{activity.rows.length ? `${page + 1}/${pageCount}` : '—'}</span>
    </div>
    <p className="text-[9px] text-slate-500">Workflow labels ≠ specialist step activity</p>
  </section>;
}
