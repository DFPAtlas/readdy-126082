import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTaskSample, sanitiseTaskEvents } from '../runtime-bridge/src/taskTelemetry.ts';
import { deriveHalRunActivity } from '../src/lib/ai-operations/halRunActivity.ts';
const now = Date.parse('2026-11-01T17:00:00Z');
const stamp = new Date(now).toISOString();
const event = { eventId: 'event-1', instance: 'hall-n8n', workflowId: 'wf1', executionId: '1', taskId: 'task-1', phase: 'checking', occurredAt: stamp };
const context = { registry: [], agents: [], sites: [], available: false, environment: 'production' };
const samples = [{ instance: 'hall-n8n', state: 'available', sampledAt: stamp, truncated: false,
  runs: [{ id: '1', workflowId: 'wf1', status: 'running', startedAt: new Date(now - 10000).toISOString(), stoppedAt: null }] }];
const tasks = (events = [event]) => ({ state: 'available', sampledAt: stamp, events, truncated: false });
const derive = (value, time = now, simulated = false, runs = samples) => deriveHalRunActivity(runs, stamp, time, simulated, context, value);
test('event boundary drops payload, free text, unknown phases and invalid identities', () => {
  const result = sanitiseTaskEvents([{ ...event, payload: 'private', message: 'secret', error: 'secret' }], now);
  assert.deepEqual(result, [event]);
  for (const change of [{ phase: 'secret message' }, { taskId: 'customer@example.com' }, { instance: 'other' }, { occurredAt: 'bad' }, { occurredAt: new Date(now + 60000).toISOString() }, { occurredAt: new Date(now - 86400001).toISOString() }]) {
    assert.deepEqual(sanitiseTaskEvents([{ ...event, ...change }], now), []);
  }
});
test('events are bounded, sorted, deduplicated and conflicts fail closed', () => {
  assert.equal(sanitiseTaskEvents([event, event], now).length, 1);
  assert.equal(sanitiseTaskEvents([event, { ...event, phase: 'ranking' }], now).length, 0);
  assert.equal(sanitiseTaskEvents(Array.from({ length: 200 }, (_, i) => ({ ...event, eventId: `event-${i}` })), now).length, 100);
});
test('handover request and receiver report are separate facts with explicit peers', () => {
  assert.deepEqual(sanitiseTaskEvents([{ ...event, phase: 'handoff_requested' }], now), []);
  const request = { ...event, phase: 'handoff_requested', targetInstance: 'leadgen_n8n', targetWorkflowId: 'wf2' };
  assert.equal(sanitiseTaskEvents([request], now)[0].phase, 'handoff_requested');
  assert.equal(derive(tasks([request])).rows[0].taskCurrent, false);
  assert.equal(derive(tasks([request])).rows[0].taskTarget, 'Workflow wf2');
});
test('step joins require exact instance, workflow, execution and execution time window', () => {
  assert.equal(derive(tasks()).rows[0].taskCurrent, true);
  for (const change of [{ instance: 'leadgen_n8n' }, { workflowId: 'wf2' }, { executionId: '2' }, { occurredAt: new Date(now - 20000).toISOString() }]) {
    assert.equal(derive(tasks([{ ...event, ...change }])).rows[0].taskEvent, undefined);
  }
});
test('old steps, missing sources, terminal events, simulation and completed runs cannot claim current work', () => {
  assert.equal(derive(undefined).tasks.state, 'not_configured');
  assert.equal(derive(tasks(), now + 120000).rows[0].taskCurrent, false);
  assert.equal(derive(tasks(), now, true).rows[0].taskCurrent, false);
  assert.equal(derive({ ...tasks(), state: 'unavailable' }).rows[0].taskEvent, undefined);
  assert.equal(derive(tasks([{ ...event, phase: 'completed' }])).rows[0].taskCurrent, false);
  const completed = [{ ...samples[0], runs: [{ ...samples[0].runs[0], status: 'success', stoppedAt: stamp }] }];
  assert.equal(derive(tasks(), now, false, completed).rows[0].taskCurrent, false);
  const beforeEvent = [{ ...samples[0], runs: [{ ...completed[0].runs[0], stoppedAt: new Date(now - 1000).toISOString() }] }];
  assert.equal(derive(tasks(), now, false, beforeEvent).rows[0].taskEvent, undefined);
});
test('optional snapshot reader contains errors, bounds input and exposes configuration state', async () => {
  assert.equal((await collectTaskSample('', async () => { throw Error(); }, now)).state, 'not_configured');
  for (const read of [async () => { throw Error('private'); }, async () => 'invalid', async () => 'x'.repeat(65537), async () => JSON.stringify({ version: 2, events: [] })]) {
    const result = await collectTaskSample('/fixed/operator/path', read, now);
    assert.equal(result.state, 'unavailable'); assert(!JSON.stringify(result).includes('private'));
  }
  const sample = await collectTaskSample('/fixed/operator/path', async () => JSON.stringify({ version: 1, events: [event] }), now);
  assert.deepEqual(sample.events, [event]); assert.equal(sample.state, 'available');
});
