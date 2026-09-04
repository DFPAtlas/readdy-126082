// ============================================================================
// AI Operations — Wallboard Scheduled Operations & Job Health selectors.
//
// Pure read-only derivations over the EXISTING shared sources — no new
// scheduler, no new job registry, no execution, no schedule controls:
//   * getGroupLiveData()  → ai_schedules (the DFP Command schedule registry),
//                           ai_sites + ai_operations_agents resolution maps.
//   * getBackupData()     → Wallboard 28 backup status (backup_records +
//                           restore_drills), reused for the backup-schedule
//                           relationship.
//   * getN8nData()        → Wallboard 45 n8n workflow registry + callbacks +
//                           connector status, reused for scheduled workflows.
//   * getSiteMasterCards() / getGroupOrchestrator() → Wallboard 47/48
//                           site → master-agent relationships.
//
// Honesty rules honoured here:
//   * There is NO scheduler runtime, NO cron/systemd telemetry, and NO real
//     execution history — `ai_schedule_history` is entirely migration_baseline
//     (22 rows, no live executions). Therefore:
//       - "Last success vs last attempt" cannot be distinguished → last_run_at
//         is shown as a registry timestamp, never as proof of success.
//       - "Consecutive failures" cannot be computed → reported N/A, never
//         fabricated.
//       - "MISSED" cannot be determined (no execution telemetry + no grace-
//         period policy) → never marked missed merely from age.
//   * `status='failed'` is the registry's own authoritative failure marker.
//   * Criticality is derived ONLY from the existing `risk_level` field
//     (critical/high), never invented from job names.
//   * No shell commands, environment variables, secrets, credentials or
//     private payloads are ever selected or displayed.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getBackupSummary } from '@/pages/ai-operations/wallboard/backupSelectors';
import { getN8nSummary, getN8nInstances } from '@/pages/ai-operations/wallboard/n8nSelectors';
import { getSiteMasterCards, getGroupOrchestrator } from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import type { AiScheduleRow } from '@/lib/ai-operations';

// --- Normalised job state ------------------------------------------------------

export type ScheduleJobState = 'active' | 'failed' | 'disabled' | 'review' | 'unknown';

export const SCHEDULE_STATE_META: Record<
  ScheduleJobState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  active: { label: 'ACTIVE', tone: 'emerald' },
  failed: { label: 'FAILED', tone: 'red' },
  disabled: { label: 'DISABLED', tone: 'secondary' },
  review: { label: 'REVIEW', tone: 'amber' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/**
 * Normalise the registry `status` onto wallboard levels. The underlying
 * scheduler state is never rewritten — this is presentation only.
 * `failed` is the registry's own authoritative failure marker; `paused` and
 * `draft` are not-active (disabled); `review_required` needs attention.
 * SUCCESS / RUNNING / MISSED are deliberately absent — no execution telemetry
 * exists to support them.
 */
function deriveJobState(row: AiScheduleRow): ScheduleJobState {
  const status = (row.status ?? '').toLowerCase();
  if (status === 'failed') return 'failed';
  if (status === 'paused' || status === 'draft') return 'disabled';
  if (status === 'review_required') return 'review';
  if (row.is_active === true || status === 'active') return 'active';
  return 'unknown';
}

// --- Job registry ---------------------------------------------------------------

export interface ScheduleJob {
  key: string;
  name: string;
  automationType: string;
  triggerType: string;
  schedule: string;
  timezone: string;
  lastRun: string | null;
  nextRun: string | null;
  state: ScheduleJobState;
  criticality: string | null;
  site: string;
  agent: string;
  status: string;
}

const DEFAULT_TIMEZONE = 'Europe/London';

/** The DFP Command schedule registry (ai_schedules), enriched with site/agent
 *  names from the stable resolution maps. This is the authoritative job list —
 *  no secondary registry is created. */
export function getScheduleJobs(): ScheduleJob[] {
  const data = getGroupLiveData();
  return data.schedules.map((row: AiScheduleRow) => ({
    key: row.schedule_key,
    name: row.name,
    automationType: row.automation_type ?? 'scheduled',
    triggerType: row.trigger_type ?? 'time',
    schedule: row.recurrence_summary ?? '—',
    timezone: row.timezone ?? DEFAULT_TIMEZONE,
    lastRun: row.last_run_at,
    nextRun: row.next_run_at,
    state: deriveJobState(row),
    criticality: row.risk_level,
    site: row.site_id ? (data.siteNameByUuid.get(row.site_id) ?? 'Group-wide') : 'Group-wide',
    agent: row.agent_id ? (data.agentNameByUuid.get(row.agent_id) ?? 'Unassigned') : 'Unassigned',
    status: row.status ?? 'unknown',
  }));
}

// --- Critical jobs --------------------------------------------------------------

export interface CriticalJob {
  job: ScheduleJob;
  criticality: 'critical' | 'high';
}

/** Jobs identified as critical by the EXISTING risk_level configuration
 *  (critical/high) — never inferred from names. Sorted critical → high, then
 *  by name. */
export function getCriticalJobs(): CriticalJob[] {
  const jobs = getScheduleJobs();
  const order = { critical: 0, high: 1 } as const;

  return jobs
    .filter((j): j is ScheduleJob & { criticality: 'critical' | 'high' } =>
      j.criticality === 'critical' || j.criticality === 'high')
    .map((j) => ({ job: j, criticality: j.criticality as 'critical' | 'high' }))
    .sort((a, b) => order[a.criticality] - order[b.criticality] || a.job.name.localeCompare(b.job.name));
}

// --- Categories (by actual trigger model) ---------------------------------------

export interface ScheduleCategory {
  label: string;
  count: number;
  active: number;
  failed: number;
}

const TRIGGER_LABEL: Record<string, string> = {
  time: 'Scheduled',
  recurrence: 'Recurring',
  event: 'Event-driven',
  condition: 'Condition-based',
};

/** Group jobs by their registered trigger_type — the actual scheduling model,
 *  not an invented business classification. */
export function getScheduleCategories(): ScheduleCategory[] {
  const jobs = getScheduleJobs();
  const byTrigger = new Map<string, ScheduleJob[]>();
  for (const j of jobs) {
    const list = byTrigger.get(j.triggerType) ?? [];
    list.push(j);
    byTrigger.set(j.triggerType, list);
  }

  return Array.from(byTrigger.entries())
    .map(([trigger, items]) => ({
      label: TRIGGER_LABEL[trigger] ?? trigger,
      count: items.length,
      active: items.filter((j) => j.state === 'active').length,
      failed: items.filter((j) => j.state === 'failed').length,
    }))
    .sort((a, b) => b.count - a.count);
}

// --- Upcoming runs ---------------------------------------------------------------

export interface UpcomingRun {
  job: ScheduleJob;
  nextRun: string;
}

const UPCOMING_WINDOW_MS = 60 * 60 * 1000;

/** Jobs with a next run within the next 60 minutes (authoritative next_run_at,
 *  active jobs only). An empty result is honest — the registry next-run values
 *  are migration baseline and no live scheduler updates them. */
export function getUpcomingRuns(now: Date = new Date()): UpcomingRun[] {
  const jobs = getScheduleJobs();
  const horizon = now.getTime() + UPCOMING_WINDOW_MS;

  return jobs
    .filter((j) => {
      if (j.state !== 'active' || !j.nextRun) return false;
      const t = new Date(j.nextRun).getTime();
      return !Number.isNaN(t) && t > now.getTime() && t <= horizon;
    })
    .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())
    .map((j) => ({ job: j, nextRun: j.nextRun! }));
}

// --- Cross-system schedule relationships -----------------------------------------

export interface ScheduleBackupRelationship {
  sourceState: 'live' | 'unavailable';
  total: number;
  current: number;
  failed: number;
  stale: number;
}

/** Reuse Wallboard 28 backup status for the scheduled-backup relationship.
 *  Detailed backup state remains sourced from the backup system. */
export function getScheduleBackupRelationship(): ScheduleBackupRelationship {
  const summary = getBackupSummary();
  return {
    sourceState: summary.sourceState,
    total: summary.total,
    current: summary.current,
    failed: summary.failed,
    stale: summary.stale,
  };
}

export interface ScheduleN8nRelationship {
  sourceState: 'live' | 'unavailable';
  instancesOnline: number;
  activeWorkflows: number;
  running: number;
  failed: number;
}

/** Reuse Wallboard 45 n8n automation status for scheduled workflows. The
 *  workflow registry is empty, so scheduled-workflow counts are honest. */
export function getScheduleN8nRelationship(): ScheduleN8nRelationship {
  const summary = getN8nSummary();
  const instances = getN8nInstances();
  return {
    sourceState: summary.sourceState === 'live' ? 'live' : 'unavailable',
    instancesOnline: instances.filter((i) => i.state === 'healthy').length,
    activeWorkflows: summary.activeWorkflows,
    running: summary.running,
    failed: summary.failed,
  };
}

export interface ScheduleAgentMapping {
  sitesWithMaster: number;
  sitesTotal: number;
  groupOrchestrator: string | null;
}

/** Reuse Wallboard 47/48 site → master-agent relationships for scheduled AI
 *  jobs. No duplicate agent assignments are created. */
export function getScheduleAgentMapping(): ScheduleAgentMapping {
  const cards = getSiteMasterCards();
  const group = getGroupOrchestrator();
  return {
    sitesWithMaster: cards.filter((c) => c.masterAgentKey != null).length,
    sitesTotal: cards.length,
    groupOrchestrator: group?.name ?? null,
  };
}

// --- Summary -----------------------------------------------------------------------

export interface ScheduleSummary {
  sourceState: 'live' | 'unavailable';
  total: number;
  active: number;
  failed: number;
  disabled: number;
  review: number;
  critical: number;
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getScheduleSummary(): ScheduleSummary {
  const data = getGroupLiveData();
  const jobs = getScheduleJobs();

  const count = (state: ScheduleJobState) => jobs.filter((j) => j.state === state).length;
  const critical = jobs.filter((j) => j.criticality === 'critical' || j.criticality === 'high').length;

  const sourceState: ScheduleSummary['sourceState'] =
    data.availability.schedules && !data.loading ? 'live' : 'unavailable';

  let label: string;
  let detail: string;
  let tone: ScheduleSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'SCHEDULE STATUS UNKNOWN';
    detail = 'The schedule registry could not be reached.';
    tone = 'secondary';
  } else if (count('failed') > 0) {
    label = 'SCHEDULE FAILURE';
    detail = `${count('failed')} scheduled job${count('failed') > 1 ? 's' : ''} failed.`;
    tone = 'red';
  } else if (count('review') > 0) {
    label = 'REVIEW REQUIRED';
    detail = `${count('review')} schedule${count('review') > 1 ? 's' : ''} awaiting review.`;
    tone = 'amber';
  } else {
    label = 'SCHEDULES HEALTHY';
    detail = `${count('active')} of ${jobs.length} jobs active.`;
    tone = 'emerald';
  }

  return {
    sourceState,
    total: jobs.length,
    active: count('active'),
    failed: count('failed'),
    disabled: count('disabled'),
    review: count('review'),
    critical,
    label,
    detail,
    tone,
  };
}

// --- Monitoring gaps (honest, never fabricated) ------------------------------------

export interface ScheduleGap {
  area: string;
  note: string;
}

export function getScheduleGaps(): ScheduleGap[] {
  return [
    { area: 'Scheduler runtime', note: 'No scheduler runtime is connected — ai_schedules is configuration metadata only (no cron/n8n/systemd execution).' },
    { area: 'Execution history', note: 'ai_schedule_history contains only migration_baseline records — last-success and consecutive-failure cannot be derived from real runs.' },
    { area: 'Cron / systemd timers', note: 'No Supabase cron, database cron or server systemd-timer telemetry source exists.' },
    { area: 'Missed-run policy', note: 'No grace-period policy exists, so MISSED is never computed merely from age.' },
    { area: 'Criticality escalation', note: 'No approved rule maps repeated schedule failure to a criticality level — only the registry risk_level is used.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) --------------------------

export interface ScheduleIncident {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  affectedService: string;
  sourceLabel: string;
  firstDetected: string | null;
  lastUpdated: string | null;
  status: string;
  description: string;
}

/**
 * Authoritative scheduled-operations incidents only. There is currently NO
 * authoritative escalation signal here:
 *   * There is no scheduler runtime to be "unavailable", and no execution
 *     telemetry to confirm a repeated production failure.
 *   * `status='failed'` on a registry row is a configuration/observation state,
 *     not a confirmed runtime outage.
 *   * No criticality escalation rule maps repeated schedule failure to a level.
 * Returns an empty list until an authoritative escalation rule exists.
 */
export function getScheduleIncidents(): ScheduleIncident[] {
  return [];
}