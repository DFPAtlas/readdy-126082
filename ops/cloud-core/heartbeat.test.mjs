import test from 'node:test';
import assert from 'node:assert/strict';
import { heartbeat } from './heartbeat.mjs';

const env = {
  SUPABASE_URL: 'https://zjqftnkrmqhmbrtkvafy.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only',
};

test('does not update Supabase when local n8n is unavailable', async () => {
  let calls = 0;
  const result = await heartbeat({
    env,
    fetchImpl: async () => { calls += 1; throw new Error('offline'); },
  });
  assert.equal(result.healthy, false);
  assert.equal(calls, 1);
});

test('sends only the heartbeat field to the fixed Cloud Core node', async () => {
  const calls = [];
  const result = await heartbeat({
    env,
    now: () => new Date('2026-09-23T16:00:00.000Z'),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? { ok: true }
        : { ok: true, json: async () => [{ node_key: 'cloud-core-01' }] };
    },
  });
  assert.equal(result.healthy, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'http://127.0.0.1:5678/healthz');
  assert.match(calls[1].url, /node_key=eq.cloud-core-01$/);
  assert.equal(calls[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    heartbeat_at: '2026-09-23T16:00:00.000Z',
  });
});

test('rejects a response that did not update the expected node', async () => {
  let calls = 0;
  await assert.rejects(
    heartbeat({
      env,
      fetchImpl: async () => {
        calls += 1;
        return calls === 1 ? { ok: true } : { ok: true, json: async () => [] };
      },
    }),
    /not updated exactly once/,
  );
});
