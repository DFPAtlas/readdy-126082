import { pathToFileURL } from 'node:url';

const NODE_KEY = 'cloud-core-01';
const PROJECT_URL = 'https://zjqftnkrmqhmbrtkvafy.supabase.co';
const N8N_HEALTH_URL = 'http://127.0.0.1:5678/healthz';

export async function heartbeat({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  const base = env.SUPABASE_URL || PROJECT_URL;
  if (base.replace(/\/+$/, '') !== PROJECT_URL) throw new Error('SUPABASE_URL is not the DFP project');

  let health;
  try {
    health = await fetchImpl(N8N_HEALTH_URL, { signal: AbortSignal.timeout(10000) });
  } catch {
    return { healthy: false, reason: 'n8n_unreachable' };
  }
  if (!health.ok) return { healthy: false, reason: 'n8n_unhealthy' };

  const response = await fetchImpl(
    `${PROJECT_URL}/rest/v1/dfp_runtime_nodes?node_key=eq.${NODE_KEY}`,
    {
      method: 'PATCH',
      signal: AbortSignal.timeout(10000),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      // Never enable execution here. The database remains fail-closed.
      body: JSON.stringify({ heartbeat_at: now().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(`Supabase heartbeat rejected: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].node_key !== NODE_KEY) {
    throw new Error('Cloud Core node was not updated exactly once');
  }
  return { healthy: true, reason: 'heartbeat_recorded' };
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[cloud-core] missing service credential');
    process.exitCode = 1;
    return;
  }
  let stopped = false;
  process.once('SIGTERM', () => { stopped = true; });
  process.once('SIGINT', () => { stopped = true; });
  while (!stopped) {
    try {
      const result = await heartbeat();
      console.log(`[cloud-core] ${new Date().toISOString()} ${result.reason}`);
    } catch (error) {
      console.error(`[cloud-core] ${new Date().toISOString()} ${error instanceof Error ? error.message : 'heartbeat failed'}`);
    }
    if (stopped) break;
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
