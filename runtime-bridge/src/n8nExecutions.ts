// Metadata only. Never fetch execution input/output, credentials or workflow JSON.
export const RUN_LIMIT = 50;
const STATES = new Set(['new', 'running', 'waiting', 'success', 'error', 'canceled', 'crashed', 'unknown']);
export interface N8nRun {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string | null;
  stoppedAt: string | null;
}
export interface N8nRunSample {
  instance: string;
  state: 'available' | 'not_configured' | 'unavailable';
  sampledAt: string;
  truncated: boolean;
  runs: N8nRun[];
}
const text = (v: unknown) => typeof v === 'string' ? v.slice(0, 100) : '';
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
export function sanitiseRuns(rows: unknown): N8nRun[] {
  if (!Array.isArray(rows)) return [];
  const result = new Map<string, N8nRun>();
  for (const raw of rows.slice(0, RUN_LIMIT * 2)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = text(raw.id);
    const workflowId = text(raw.workflowId);
    if (!id || !workflowId) continue;
    result.set(id, { id, workflowId, status: STATES.has(raw.status) ? raw.status : 'unknown',
      startedAt: date(raw.startedAt), stoppedAt: date(raw.stoppedAt) });
  }
  return [...result.values()].slice(0, RUN_LIMIT);
}
export async function collectN8nRuns(instance: string, baseUrl: string, apiKey: string,
  request: typeof fetch = fetch): Promise<N8nRunSample> {
  const sample: N8nRunSample = { instance, state: 'not_configured', sampledAt: new Date().toISOString(), truncated: false, runs: [] };
  if (!baseUrl || !apiKey) return sample;
  try {
    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid local URL');
    // Read recent and running separately so long-running work is not hidden by busy workflows.
    const pages = await Promise.all(['running', 'recent'].map(async (kind) => {
      const url = new URL(base.href.replace(/\/+$/, '') + '/api/v1/executions');
      url.searchParams.set('includeData', 'false');
      url.searchParams.set('limit', String(RUN_LIMIT));
      if (kind === 'running') url.searchParams.set('status', 'running');
      const response = await request(url, { method: 'GET', headers: { 'X-N8N-API-KEY': apiKey },
        redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Execution metadata unavailable');
      const page = await response.json();
      if (!Array.isArray(page.data)) throw new Error('Invalid execution response');
      return page;
    }));
    const combined = [...pages[0].data, ...pages[1].data];
    sample.runs = sanitiseRuns(combined);
    sample.truncated = pages.some(p => !!p.nextCursor) || new Set(combined.map(r => r.id)).size > RUN_LIMIT;
    sample.state = 'available';
  } catch {
    // Never persist upstream errors: they may contain URLs, credentials or payload data.
    sample.state = 'unavailable';
  }
  sample.sampledAt = new Date().toISOString();
  return sample;
}
export function readN8nRunSamples(value: unknown): N8nRunSample[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).flatMap(raw => {
    if (!raw || !['hall-n8n', 'leadgen_n8n'].includes(raw.instance) || !date(raw.sampledAt)) return [];
    return [{ instance: raw.instance, sampledAt: date(raw.sampledAt)!,
      state: ['available', 'not_configured', 'unavailable'].includes(raw.state) ? raw.state : 'unavailable',
      truncated: raw.truncated === true, runs: sanitiseRuns(raw.runs) } as N8nRunSample];
  });
}
export function sampleIsFresh(sample: N8nRunSample, receivedAt: string | null, now = Date.now()): boolean {
  return [sample.sampledAt, receivedAt].every(iso => {
    const age = iso ? now - Date.parse(iso) : NaN;
    return Number.isFinite(age) && age >= -30_000 && age < 120_000;
  });
}
