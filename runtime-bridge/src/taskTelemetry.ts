// Explicit producer events only; never infer specialist activity from workflow names.
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
const instances = ['hall-n8n', 'leadgen_n8n'];
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function sanitiseTaskEvents(value: unknown, now = Date.now()): TaskEvent[] {
  if (!Array.isArray(value)) return [];
  const events = new Map<string, TaskEvent>();
  for (const raw of value.slice(0, 200)) {
    if (!object(raw) || !id(raw.eventId) || !id(raw.workflowId) || !id(raw.executionId) || !id(raw.taskId)
      || !instances.includes(String(raw.instance)) || !TASK_PHASES.includes(raw.phase as TaskPhase)) continue;
    const stamp = typeof raw.occurredAt === 'string' ? Date.parse(raw.occurredAt) : NaN;
    if (!Number.isFinite(stamp) || stamp > now + 30_000 || stamp < now - 86_400_000) continue;
    const handoff = String(raw.phase).startsWith('handoff_');
    if (handoff && (!instances.includes(String(raw.targetInstance)) || !id(raw.targetWorkflowId))) continue;
    const event: TaskEvent = { eventId: raw.eventId, instance: String(raw.instance), workflowId: raw.workflowId,
      executionId: raw.executionId, taskId: raw.taskId, phase: raw.phase as TaskPhase, occurredAt: new Date(stamp).toISOString() };
    if (handoff) { event.targetInstance = String(raw.targetInstance); event.targetWorkflowId = String(raw.targetWorkflowId); }
    // Deduplicate within an instance; reject conflicting copies of an event ID.
    const key = `${event.instance}:${event.eventId}`;
    const previous = events.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(event)) return [];
    events.set(key, event);
  }
  return [...events.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.eventId.localeCompare(b.eventId)).slice(0, 100);
}
export function readTaskSample(value: unknown, now = Date.now()): TaskSample {
  const fallback: TaskSample = { state: 'not_configured', sampledAt: '', events: [], truncated: false };
  if (!object(value)) return fallback;
  if (!['available', 'unavailable', 'not_configured'].includes(String(value.state)) || typeof value.sampledAt !== 'string' || !Number.isFinite(Date.parse(value.sampledAt))) return { ...fallback, state: 'unavailable' };
  return { state: value.state as TaskSample['state'], sampledAt: value.sampledAt,
    events: value.state === 'available' ? sanitiseTaskEvents(value.events, now) : [], truncated: value.truncated === true };
}
/** Read at most 64 KiB from an operator-configured local snapshot. */
export async function collectTaskSample(path: string, read: (path: string) => Promise<string>, now = Date.now()): Promise<TaskSample> {
  const sample: TaskSample = { state: 'not_configured', sampledAt: new Date(now).toISOString(), events: [], truncated: false };
  if (!path) return sample;
  try {
    const text = await read(path);
    if (new TextEncoder().encode(text).byteLength > 65_536) throw new Error('Too large');
    const raw: unknown = JSON.parse(text);
    if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.events) || raw.events.length > 200) throw new Error('Invalid snapshot');
    sample.events = sanitiseTaskEvents(raw.events, now);
    sample.truncated = raw.events.length > 100;
    sample.state = 'available';
  } catch { sample.state = 'unavailable'; }
  return sample;
}
