import type { WorkflowMappingContext } from './halWorkflowMapping.ts';
import { resolveHalRunIdentity } from './halWorkflowCatalogue.ts';
import { readN8nRunSamples, sampleIsFresh } from '../../../runtime-bridge/src/n8nExecutions.ts';

export function deriveHalRunActivity(value: unknown, receivedAt: string | null, now = Date.now(), simulated = false, mapping: WorkflowMappingContext = { registry: [], agents: [], sites: [], environment: '', available: false }) {
  const samples = readN8nRunSamples(value);
  const instances = ['hall-n8n', 'leadgen_n8n'].map(instance => {
    const sample = samples.find(item => item.instance === instance);
    const fresh = !!sample && sampleIsFresh(sample, receivedAt, now);
    const available = sample?.state === 'available';
    return {
      instance, sample, fresh,
      label: simulated ? 'SIMULATED' : !sample ? 'NO TELEMETRY' : sample.state === 'not_configured' ? 'NOT CONFIGURED' : !available ? 'UNAVAILABLE' : !fresh ? 'STALE' : 'CURRENT',
      current: !simulated && fresh && available,
    };
  });
  const rows = instances.flatMap(source => source.sample?.runs.map(run => {
    const active = ['new', 'running', 'waiting'].includes(run.status);
    const status = active && !source.current ? 'unknown' : run.status;
    const end = run.stoppedAt ? Date.parse(run.stoppedAt) : source.current && active ? now : NaN;
    const duration = run.startedAt ? end - Date.parse(run.startedAt) : NaN;
    return {
      ...run, key: `${source.instance}:${run.id}`, instance: source.instance,
      identity: resolveHalRunIdentity(source.instance, run.workflowId, run.registryWorkflowKey, mapping),
      status, lastStatus: run.status, current: source.current, simulated,
      durationMs: Number.isFinite(duration) && duration >= 0 ? duration : null,
      durationLabel: run.stoppedAt ? 'duration' : 'elapsed',
    };
  }) ?? []).sort((a, b) => {
    const rank = (status: string) => status === 'running' ? 0 : ['new', 'waiting'].includes(status) ? 1 : 2;
    return rank(a.status) - rank(b.status) || Date.parse(b.startedAt ?? '1970-01-01') - Date.parse(a.startedAt ?? '1970-01-01') || a.key.localeCompare(b.key);
  });
  return { instances, rows, running: rows.filter(run => run.status === 'running').length,
    complete: instances.every(instance => instance.current) && samples.every(sample => !sample.truncated) };
}
