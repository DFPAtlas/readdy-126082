import { useEffect, useState } from 'react';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { readN8nRunSamples, sampleIsFresh } from '../../../../../runtime-bridge/src/n8nExecutions';

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London', hour12: false }) : '—';
}

export default function HalAgentRuns() {
  const health = useRuntimeHealth();
  const { workflows } = useN8nData();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  const heartbeat = health.latestHeartbeat;
  const samples = readN8nRunSamples(heartbeat?.local_services?.n8n_executions);
  const [filter, setFilter] = useState('all');

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground-100">HAL agent runs</h4>
          <p className="text-xs text-foreground-500">Workflow executions · times in London · refreshes with the runtime bridge</p>
        </div>
        <label className="text-xs text-foreground-300">Status{' '}
          <select value={filter} onChange={event => setFilter(event.target.value)} className="bg-background-200 rounded p-2">
            <option value="all">All</option><option value="running">Running</option>
            <option value="success">Success</option><option value="failed">Failed</option><option value="waiting">Waiting</option>
          </select>
        </label>
      </div>
      {samples.length === 0 && <p className="text-sm text-amber-400">Agent run telemetry has not been received from HAL. Enable execution metadata collection on the runtime bridge.</p>}
      {samples.map(sample => {
        const fresh = sampleIsFresh(sample, heartbeat?.received_at ?? null, now);
        const available = sample.state === 'available';
        const runs = sample.runs.filter(run => filter === 'all' || (filter === 'failed' ? ['error', 'crashed'].includes(run.status) : run.status === filter));
        return <div key={sample.instance} className="mt-4">
          <div className="flex flex-wrap justify-between gap-2 text-xs mb-2">
            <strong className="text-foreground-200">{sample.instance}</strong>
            <span className={available && fresh ? 'text-emerald-400' : 'text-amber-400'}>
              {sample.state === 'not_configured' ? 'Collection not configured' : !available ? 'Collection unavailable' : !fresh ? 'Telemetry stale — current activity unknown' : 'Telemetry current'}
              {' · sampled '}{timestamp(sample.sampledAt)}
            </span>
          </div>
          {available && <>
            <p className="text-xs text-foreground-500 mb-2">{sample.runs.length} executions in this sample{sample.truncated ? ' · partial results; more runs exist in n8n' : ''}. Workflow IDs are shown where no unambiguous registry mapping exists.</p>
            {runs.length === 0 ? <p className="text-sm text-foreground-500">No matching executions in this sample.</p> :
              <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                <thead className="text-foreground-500"><tr>{['Agent / workflow', 'Run', 'Status', 'Started', 'Finished', 'Duration'].map(title => <th key={title} className="p-2">{title}</th>)}</tr></thead>
                <tbody>{runs.map(run => {
                  // Existing registry has no per-instance identity. Do not guess on collisions.
                  const matches = workflows.filter(workflow => workflow.n8n_workflow_id === run.workflowId);
                  const name = sample.instance === 'hall-n8n' && matches.length === 1 ? matches[0].name : null;
                  const active = ['new', 'running', 'waiting'].includes(run.status);
                  const status = active && !fresh ? 'Unknown (last: ' + run.status + ')' : run.status;
                  const elapsed = run.startedAt && run.stoppedAt ? Date.parse(run.stoppedAt) - Date.parse(run.startedAt) : null;
                  return <tr key={run.id} className="border-t border-background-200/60 text-foreground-200">
                    <td className="p-2">{name || `Workflow ${run.workflowId}`}</td>
                    <td className="p-2">{run.id}</td>
                    <td className={`p-2 ${['error', 'crashed'].includes(run.status) ? 'text-red-400' : run.status === 'success' ? 'text-emerald-400' : 'text-amber-400'}`}>{status}</td>
                    <td className="p-2 whitespace-nowrap">{timestamp(run.startedAt)}</td>
                    <td className="p-2 whitespace-nowrap">{timestamp(run.stoppedAt)}</td>
                    <td className="p-2">{elapsed !== null && elapsed >= 0 ? `${(elapsed / 1000).toFixed(1)}s` : '—'}</td>
                  </tr>;
                })}</tbody>
              </table></div>}
          </>}
        </div>;
      })}
      <p className="text-xs text-foreground-500 mt-3">Recent saved n8n executions only; this is not a complete audit log or visibility into individual specialist nodes inside a workflow.</p>
    </section>
  );
}
