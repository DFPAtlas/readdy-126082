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

const { deriveHalRunActivity } = await import('../src/lib/ai-operations/halRunActivity.ts');
test('wall activity namespaces IDs and counts only fresh running rows', () => {
  const now = Date.parse('2026-11-01T12:01:00Z');
  const timestamp = new Date(now).toISOString();
  const samples = ['hall-n8n', 'leadgen_n8n'].map(instance => ({instance, state: 'available', sampledAt: timestamp, truncated: false, runs: [run('1', 'running')]}));
  const activity = deriveHalRunActivity(samples, timestamp, now);
  assert.equal(activity.running, 2); assert.equal(activity.complete, true);
  assert.equal(new Set(activity.rows.map(r => r.key)).size, 2);
  assert.equal(activity.rows[0].durationMs, 60000);
  const stale = deriveHalRunActivity(samples, timestamp, now + 120000);
  assert.equal(stale.running, 0); assert.equal(stale.rows[0].status, 'unknown');
  assert.equal(stale.rows[0].durationMs, null); assert.equal(stale.complete, false);
});
test('wall distinguishes missing, unavailable, partial and simulated sources', () => {
  assert.equal(deriveHalRunActivity(null, null).instances.length, 2);
  assert.equal(deriveHalRunActivity(null, null).instances[0].label, 'NO TELEMETRY');
  const stamp = new Date().toISOString();
  const samples = [{instance: 'hall-n8n', state: 'available', sampledAt: stamp, truncated: true, runs: [run('1', 'running')]}];
  assert.equal(deriveHalRunActivity(samples, stamp).complete, false);
  const simulated = deriveHalRunActivity(samples, stamp, Date.now(), true);
  assert.equal(simulated.running, 0); assert.equal(simulated.rows[0].status, 'unknown');
  assert.equal(simulated.instances[0].label, 'SIMULATED');
});

const { parseWorkflowMap } = await import('../runtime-bridge/src/n8nExecutions.ts');
const { resolveHalWorkflowMapping } = await import('../src/lib/ai-operations/halWorkflowMapping.ts');
const registry = {id:'registry1', workflow_key:'quickguard-manager', n8n_workflow_id:'wf1', name:'Manager workflow', agent_id:'agent1', site_id:'site1', environment:'production', is_active:true, runtime_status:'not_verified'};
const agent = {id:'agent1', name:'QuickGuard Manager', site_id:'site1', workflow_id:null, environment:'production', is_active:true};
const site = {id:'site1', name:'QuickGuard', environment:'production', is_active:true};
const context = {registry:[registry], agents:[agent], sites:[site], environment:'production', available:true};
test('exact mapping resolves saved agent and site but preserves unverified status', () => {
  const result = resolveHalWorkflowMapping('wf1','quickguard-manager',context);
  assert.equal(result.title,'QuickGuard Manager'); assert.equal(result.siteName,'QuickGuard');
  assert.equal(result.label,'REGISTRY UNVERIFIED'); assert.equal(result.registryVerified,false);
  assert.equal(resolveHalWorkflowMapping('wf1','quickguard-manager',{...context,registry:[{...registry,runtime_status:'verified'}]}).registryVerified,true);
});
test('mapping rejects wrong IDs, duplicate keys, environments, inactive rows and site conflicts', () => {
  for (const invalid of [
    {...context,registry:[{...registry,n8n_workflow_id:'wrong'}]},
    {...context,registry:[registry,registry]}, {...context,environment:'staging'},
    {...context,registry:[{...registry,is_active:false}]},
    {...context,agents:[{...agent,site_id:'other'}]},
    {...context,agents:[{...agent,workflow_id:'other'}]},
    {...context,sites:[]}, {...context,available:false}
  ]) assert.equal(resolveHalWorkflowMapping('wf1','quickguard-manager',invalid).mapped,false);
  assert.equal(resolveHalWorkflowMapping('wf1',null,context).label,'UNMAPPED');
});
test('map parser fails closed on invalid JSON, unknown fields and excessive entries', () => {
  assert.equal(parseWorkflowMap('{').state,'invalid'); assert.equal(parseWorkflowMap('[]').state,'invalid');
  assert.equal(parseWorkflowMap('{"wf1":{"name":"not a registry key"}}').state,'invalid');
  assert.equal(parseWorkflowMap(JSON.stringify(Object.fromEntries(Array.from({length:129},(_,n)=>['wf'+n,'key'+n])))).state,'invalid');
});
test('collector ignores upstream identity and uses only its own instance mapping', async () => {
  const request = async () => Response.json({data:[{...run('1'),registryWorkflowKey:'forged'}]});
  const main = await collectN8nRuns('hall-n8n','http://localhost','key',request,'{"wf1":"quickguard-manager"}');
  const leadgen = await collectN8nRuns('leadgen_n8n','http://localhost','key',request);
  assert.equal(main.runs[0].registryWorkflowKey,'quickguard-manager');
  assert.equal(leadgen.runs[0].registryWorkflowKey,null);
  const stamp = new Date().toISOString(); main.sampledAt=stamp;leadgen.sampledAt=stamp;
  const activity = deriveHalRunActivity([main,leadgen],stamp,Date.now(),false,context);
  assert.equal(activity.rows.find(row=>row.instance==='hall-n8n').identity.mapped,true);
  assert.equal(activity.rows.find(row=>row.instance==='leadgen_n8n').identity.mapped,false);
});
