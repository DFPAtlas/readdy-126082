// Frontend-safe mirrors of the runtime bridge sample parsers.
// These are pure, read-only readers used by the operations wall; they never fetch or persist anything.

export const TASK_PHASES = ['checking', 'discovering', 'ranking', 'drafting', 'notifying', 'repairing', 'waiting', 'completed', 'failed', 'handoff_requested', 'handoff_received'] as const;
export type TaskPhase = typeof TASK_PHASES[number];

export interface TaskEvent {
  eventId: string;
  instance: string;
  workflowId: string;
  executionId: string;
  taskId: string;
  phase: TaskPhase;
  occurredAt: string;
  targetInstance?: string;
  targetWorkflowId?: string;
}

export interface TaskSample {
  state: 'available' | 'not_configured' | 'unavailable';
  sampledAt: string;
  events: TaskEvent[];
  truncated: boolean;
}

export const RUN_LIMIT = 50;

const STATES = new Set(['new', 'running', 'waiting', 'success', 'error', 'canceled', 'crashed', 'unknown']);
const INSTANCES = ['hall-n8n', 'leadgen_n8n'];

export interface N8nRun {
  id: string;
  workflowId: string;
  status: string;
  registryWorkflowKey?: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
}

export interface N8nRunSample {
  instance: string;
  state: 'available' | 'not_configured' | 'unavailable';
  sampledAt: string;
  truncated: boolean;
  runs: N8nRun[];
  mappingState?: 'not_configured' | 'configured' | 'invalid';
}

const isIdentifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const toDate = (value: unknown): string | null => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export function sanitiseTaskEvents(value: unknown, now = Date.now()): TaskEvent[] {
  if (!Array.isArray(value)) return [];
  const events = new Map<string, TaskEvent>();
  for (const raw of value.slice(0, 200)) {
    if (!isObject(raw) || !isIdentifier(raw.eventId) || !isIdentifier(raw.workflowId) || !isIdentifier(raw.executionId) || !isIdentifier(raw.taskId)
      || !INSTANCES.includes(String(raw.instance)) || !TASK_PHASES.includes(raw.phase as TaskPhase)) continue;
    const stamp = typeof raw.occurredAt === 'string' ? Date.parse(raw.occurredAt) : NaN;
    if (!Number.isFinite(stamp) || stamp > now + 30_000 || stamp < now - 86_400_000) continue;
    const handoff = String(raw.phase).startsWith('handoff_');
    if (handoff && (!INSTANCES.includes(String(raw.targetInstance)) || !isIdentifier(raw.targetWorkflowId))) continue;
    const event: TaskEvent = {
      eventId: raw.eventId,
      instance: String(raw.instance),
      workflowId: raw.workflowId,
      executionId: raw.executionId,
      taskId: raw.taskId,
      phase: raw.phase as TaskPhase,
      occurredAt: new Date(stamp).toISOString(),
    };
    if (handoff) {
      event.targetInstance = String(raw.targetInstance);
      event.targetWorkflowId = String(raw.targetWorkflowId);
    }
    const key = `${event.instance}:${event.eventId}`;
    const previous = events.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(event)) return [];
    events.set(key, event);
  }
  return [...events.values()]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.eventId.localeCompare(b.eventId))
    .slice(0, 100);
}

export function readTaskSample(value: unknown, now = Date.now()): TaskSample {
  const fallback: TaskSample = { state: 'not_configured', sampledAt: '', events: [], truncated: false };
  if (!isObject(value)) return fallback;
  if (!['available', 'unavailable', 'not_configured'].includes(String(value.state))
    || typeof value.sampledAt !== 'string' || !Number.isFinite(Date.parse(value.sampledAt))) {
    return { ...fallback, state: 'unavailable' };
  }
  return {
    state: value.state as TaskSample['state'],
    sampledAt: value.sampledAt,
    events: value.state === 'available' ? sanitiseTaskEvents(value.events, now) : [],
    truncated: value.truncated === true,
  };
}

export function parseWorkflowMap(raw: string) {
  const mappings: Record<string, string> = Object.create(null);
  if (!raw.trim()) return { mappings, state: 'not_configured' as const };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 128) throw new Error('Invalid mapping');
    for (const [workflowId, workflowKey] of Object.entries(value)) {
      if (!isIdentifier(workflowId) || !isIdentifier(workflowKey)) throw new Error('Invalid mapping');
      mappings[workflowId] = workflowKey as string;
    }
    return { mappings, state: 'configured' as const };
  } catch {
    return { mappings: Object.create(null) as Record<string, string>, state: 'invalid' as const };
  }
}

export function sanitiseRuns(rows: unknown): N8nRun[] {
  if (!Array.isArray(rows)) return [];
  const result = new Map<string, N8nRun>();
  for (const raw of rows.slice(0, RUN_LIMIT * 2)) {
    if (!isObject(raw)) continue;
    const id = isIdentifier(raw.id) ? raw.id : null;
    const workflowId = isIdentifier(raw.workflowId) ? raw.workflowId : null;
    if (!id || !workflowId) continue;
    result.set(id, {
      id,
      workflowId,
      status: STATES.has(String(raw.status)) ? String(raw.status) : 'unknown',
      registryWorkflowKey: isIdentifier(raw.registryWorkflowKey) ? raw.registryWorkflowKey : null,
      startedAt: toDate(raw.startedAt),
      stoppedAt: toDate(raw.stoppedAt),
    });
  }
  return [...result.values()].slice(0, RUN_LIMIT);
}

export function readN8nRunSamples(value: unknown): N8nRunSample[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).flatMap(raw => {
    if (!isObject(raw) || !INSTANCES.includes(String(raw.instance)) || !toDate(raw.sampledAt)) return [];
    return [{
      instance: String(raw.instance),
      sampledAt: toDate(raw.sampledAt) as string,
      state: ['available', 'not_configured', 'unavailable'].includes(String(raw.state))
        ? (raw.state as N8nRunSample['state']) : 'unavailable',
      mappingState: ['not_configured', 'configured', 'invalid'].includes(String(raw.mappingState))
        ? (raw.mappingState as NonNullable<N8nRunSample['mappingState']>) : 'not_configured',
      truncated: raw.truncated === true,
      runs: sanitiseRuns(raw.runs),
    }];
  });
}

export function sampleIsFresh(sample: Pick<N8nRunSample, 'sampledAt'>, receivedAt: string | null, now = Date.now()): boolean {
  return [sample.sampledAt, receivedAt].every(iso => {
    const age = iso ? now - Date.parse(iso) : NaN;
    return Number.isFinite(age) && age >= -30_000 && age < 120_000;
  });
}