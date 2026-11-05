import type { WorkflowMappingContext } from './halWorkflowMapping.ts';
import { resolveHalRunIdentity } from './halWorkflowCatalogue.ts';
import { readN8nRunSamples, readTaskSample, sampleIsFresh } from './runtimeBridgeSamples.ts';

export function deriveHalRunActivity(value: unknown, receivedAt: string | null, now = Date.now(), simulated = false, mapping: WorkflowMappingContext = { registry: [], agents: [], sites: [], environment: '', available: false }, taskValue?: unknown) {
  const samples = readN8nRunSamples(value);
  const tasks = readTaskSample(taskValue, now);
  const taskSourceCurrent = !simulated && tasks.state === 'available' && sampleIsFresh({ sampledAt: tasks.sampledAt } as Parameters<typeof sampleIsFresh>[0], receivedAt, now);
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
    const taskEvent = tasks.events.find(event => event.instance === source.instance && event.workflowId === run.workflowId
      && event.executionId === run.id && !!run.startedAt && Date.parse(event.occurredAt) >= Date.parse(run.startedAt)
      && (!run.stoppedAt || Date.parse(event.occurredAt) <= Date.parse(run.stoppedAt)));
    const taskCurrent = !!taskEvent && !['completed', 'failed', 'handoff_requested'].includes(taskEvent.phase)
      && taskSourceCurrent && source.current && active && now - Date.parse(taskEvent.occurredAt) < 120_000;
    const target = taskEvent?.targetInstance && taskEvent.targetWorkflowId
      ? resolveHalRunIdentity(taskEvent.targetInstance, taskEvent.targetWorkflowId, null, mapping).title : null;
    return {
      ...run, key: `${source.instance}:${run.id}`, instance: source.instance,
      identity: resolveHalRunIdentity(source.instance, run.workflowId, run.registryWorkflowKey, mapping),
      status, lastStatus: run.status, current: source.current, simulated,
      taskEvent, taskCurrent, taskTarget: target,
      durationMs: Number.isFinite(duration) && duration >= 0 ? duration : null,
      durationLabel: run.stoppedAt ? 'duration' : 'elapsed',
    };
  }) ?? []).sort((a, b) => {
    const rank = (status: string) => status === 'running' ? 0 : ['new', 'waiting'].includes(status) ? 1 : 2;
    return rank(a.status) - rank(b.status) || Date.parse(b.startedAt ?? '1970-01-01') - Date.parse(a.startedAt ?? '1970-01-01') || a.key.localeCompare(b.key);
  });
  // Freshness is displayed at a glance: how long ago the newest saved run sample arrived.
  const sampledStamps = instances
    .map(source => source.sample?.sampledAt ?? null)
    .filter((iso): iso is string => !!iso && Number.isFinite(Date.parse(iso)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const lastTelemetryAt = sampledStamps[0] ?? (receivedAt && Number.isFinite(Date.parse(receivedAt)) ? receivedAt : null);
  const telemetryAgeMs = lastTelemetryAt ? Math.max(0, now - Date.parse(lastTelemetryAt)) : null;
  const freshness = simulated ? 'simulated'
    : telemetryAgeMs === null ? 'none'
    : telemetryAgeMs < 60_000 ? 'fresh'
    : telemetryAgeMs < 120_000 ? 'aging' : 'stale';
  return { instances, rows, tasks, taskSourceCurrent, running: rows.filter(run => run.status === 'running').length,
    lastTelemetryAt, telemetryAgeMs, freshness,
    complete: instances.every(instance => instance.current) && samples.every(sample => !sample.truncated) };
}
