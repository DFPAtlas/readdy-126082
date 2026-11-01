import test from 'node:test';
import assert from 'node:assert/strict';
import { collectN8nRuns, sanitiseRuns, sampleIsFresh, readN8nRunSamples } from '../runtime-bridge/src/n8nExecutions.ts';
const run = (id, status = 'success') => ({id, workflowId: 'wf1', status, startedAt: '2026-11-01T12:00:00Z', stoppedAt: status === 'success' ? '2026-11-01T12:00:05Z' : null});
test('collector reads only metadata, keeps instances separate, strips private fields and merges duplicate runs', async () => {
  const calls = [];
  const sample = await collectN8nRuns('hall-n8n', 'http://localhost:5678', 'private-key', async (url, options) => {
    calls.push({url: String(url), options});
    return Response.json({data: [run('1', 'running'), {...run('2'), data: {secret: 'secret-input'}, error: 'private'}], nextCursor: null});
  });
  assert.equal(sample.state, 'available'); assert.equal(sample.runs.length, 2);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.options.method, 'GET'); assert.equal(call.options.redirect, 'error');
    assert.match(call.url, /includeData=false/); assert.equal(call.options.headers['X-N8N-API-KEY'], 'private-key');
  }
  assert(!JSON.stringify(sample).includes('private')); assert(!JSON.stringify(sample).includes('secret'));
});
test('missing configuration and failures remain unknown rather than idle', async () => {
  assert.equal((await collectN8nRuns('hall-n8n', '', '')).state, 'not_configured');
  const sample = await collectN8nRuns('leadgen_n8n', 'http://localhost:5680', 'key', async () => new Response('private error', {status: 401}));
  assert.equal(sample.state, 'unavailable'); assert.deepEqual(sample.runs, []);
  assert(!JSON.stringify(sample).includes('private error'));
});
test('bounded sample flags pagination and prioritises long-running executions', async () => {
  const sample = await collectN8nRuns('hall-n8n', 'http://localhost', 'key', async url => Response.json({
    data: new URL(url).searchParams.get('status') ? [run('old', 'running')] : Array.from({length: 50}, (_, n) => run(String(n))), nextCursor: 'more'
  }));
  assert.equal(sample.runs.length, 50); assert.equal(sample.runs[0].id, 'old'); assert.equal(sample.truncated, true);
});
test('stale, missing, invalid and future timestamps cannot claim live activity', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const sample = {sampledAt: new Date(now).toISOString()};
  assert(sampleIsFresh(sample, sample.sampledAt, now));
  assert(!sampleIsFresh(sample, sample.sampledAt, now + 120000));
  assert(!sampleIsFresh(sample, null, now));
  assert(!sampleIsFresh({...sample, sampledAt: 'invalid'}, sample.sampledAt, now));
  assert(!sampleIsFresh({...sample, sampledAt: new Date(now + 60000).toISOString()}, sample.sampledAt, now));
});
test('normalisation rejects malformed rows, unknown instances and invalid dates', () => {
  assert.deepEqual(sanitiseRuns([null, {}, {id: '1'}]), []);
  assert.equal(sanitiseRuns([{...run('1'), status: 'invented', startedAt: 'bad'}])[0].status, 'unknown');
  assert.deepEqual(readN8nRunSamples([{instance: 'other', sampledAt: new Date().toISOString()}]), []);
});
