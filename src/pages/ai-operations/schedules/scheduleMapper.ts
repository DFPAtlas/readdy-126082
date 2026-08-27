// ============================================================================
// AI Operations — Scheduling & Automation — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_schedules,
// ai_event_automation_rules, ai_maintenance_windows) and the existing
// `AiSchedule` / `EventAutomationRule` / `MaintenanceWindow` contracts. All
// DB↔frontend field differences are handled here so no mapping logic leaks
// into JSX.
//
// ID strategy:
//   * `schedule_key` / `event_rule_key` / `window_key` are the stable
//     application identifiers used by routes (/ai-operations/schedules/:id).
//     DB UUIDs are never exposed as the frontend `id`.
//   * All FK UUIDs (site/agent/notification-rule) are resolved back to stable
//     keys here via the resolution context.
//
// Live vs demo:
//   * Authoritative registry metadata (identity, automation/trigger type,
//     scope/site, agent, timing, timezone, status, risk/priority, approval +
//     audit flags, quiet-hours reference, maintenance behaviour, retry policy,
//     owner, notes) comes from live rows.
//   * Nested/derived metadata with no fully-structured production
//     representation yet (task summary, expected outcome, required tools/
//     knowledge, policy references, review date, trigger detail, run history,
//     cost estimates, recurrence/allow-critical on maintenance windows) is
//     merged from the demo registry as clearly-labelled "Demo Supporting
//     Metadata".
//
// Safety: no scheduler runtime, no event listener, no execution, no secrets.
// ============================================================================

import type {
  AiSchedule,
  EventAutomationRule,
  MaintenanceWindow,
  AutomationType,
  ScheduleStatus,
  Environment,
  RiskLevel,
  RunPriority,
  TaskType,
  ActivityStatus,
  RetryPolicy,
  ScheduleTrigger,
} from '@/pages/ai-operations/types';
import type {
  AiScheduleRow,
  AiEventAutomationRuleRow,
  AiMaintenanceWindowRow,
} from '@/lib/ai-operations';

// Resolved lookup maps, built by the Schedules context from the live
// registries. No UUIDs leak into the UI — every FK is resolved to its key here.
export interface ScheduleResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  ruleKeyById: Map<string, string>;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function emptyRetry(): RetryPolicy {
  return {
    maxRetries: 0,
    retryDelay: '0m',
    backoffStrategy: 'none',
    failureEscalation: '',
    fallbackAgent: '',
    disableAfterRepeatedFailure: false,
    createIncidentAfterThreshold: false,
  };
}

function emptyTrigger(): ScheduleTrigger {
  return { triggerType: 'time', expressionSummary: '', recurrence: '', eventSource: '', condition: '', manual: '' };
}

/**
 * Map a live `ai_schedules` row to an `AiSchedule`.
 *
 * @param row   The Supabase row.
 * @param ctx   Resolved UUID → stable-key maps (site/agent/notification rule).
 * @param demo  Optional matching demo record (by `schedule_key`) supplying the
 *              nested demo supporting metadata.
 */
export function mapScheduleRowToRecord(
  row: AiScheduleRow,
  ctx: ScheduleResolutionContext,
  demo?: AiSchedule,
): AiSchedule {
  const d = demo;
  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—') : 'Group-wide';
  const agentId = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? 'unknown') : (d?.agentId ?? '');
  const agentName = row.agent_id ? (ctx.agentNameById.get(row.agent_id) ?? d?.agentName ?? '—') : (d?.agentName ?? '—');
  const notificationRuleId = row.notification_rule_id
    ? (ctx.ruleKeyById.get(row.notification_rule_id) ?? null)
    : null;

  const retry: RetryPolicy = {
    ...(d?.retry ?? emptyRetry()),
    ...asRecord(row.retry_policy),
  };

  return {
    // Stable application identifier — equals the DB `schedule_key`.
    id: row.schedule_key,
    name: row.name,
    description: row.description ?? '',
    automationType: (row.automation_type as AutomationType) ?? d?.automationType ?? 'scheduled',
    siteId,
    siteName,
    agentId,
    agentName,
    taskType: (d?.taskType as TaskType) ?? 'other',
    environment: (row.environment as Environment) ?? 'production',
    status: (row.status as ScheduleStatus) ?? 'draft',
    priority: (row.priority as RunPriority) ?? d?.priority ?? 'normal',
    risk: (row.risk_level as RiskLevel) ?? d?.risk ?? 'low',
    triggerType: row.trigger_type ?? d?.triggerType ?? 'time',
    expressionSummary: row.schedule_expression ?? d?.expressionSummary ?? '',
    timezone: row.timezone ?? d?.timezone ?? 'Europe/London',
    frequency: row.recurrence_summary ?? d?.frequency ?? '',
    startDate: formatDate(row.start_at) || d?.startDate || '',
    endDate: formatDate(row.end_at) || d?.endDate || '',
    nextRun: d?.nextRun ?? formatTimestamp(row.next_run_at) ?? '',
    lastRun: d?.lastRun ?? formatTimestamp(row.last_run_at) ?? '',
    lastRunStatus: (d?.lastRunStatus as ActivityStatus | null) ?? null,
    lastRunId: d?.lastRunId ?? null,
    failureCount: d?.failureCount ?? 0,
    retry,
    approvalRequired: row.approval_required,
    quietHoursBehaviour: d?.quietHoursBehaviour ?? '—',
    maintenanceWindowBehaviour: row.maintenance_behavior ?? d?.maintenanceWindowBehaviour ?? '—',
    notificationRuleId,
    ownerTeam: row.owner_team ?? '—',
    reviewDate: d?.reviewDate ?? '',
    createdAt: formatTimestamp(row.created_at) || d?.createdAt || '',
    updatedAt: formatTimestamp(row.updated_at) || d?.updatedAt || '',
    notes: row.notes ?? '',
    trigger: d?.trigger ?? emptyTrigger(),
    taskSummary: d?.taskSummary ?? '',
    expectedOutcome: d?.expectedOutcome ?? '',
    requiredTools: d?.requiredTools ?? [],
    requiredKnowledge: d?.requiredKnowledge ?? [],
    verificationRequired: d?.verificationRequired ?? false,
    uatRequired: d?.uatRequired ?? false,
    auditRequired: row.audit_required,
    policyIds: d?.policyIds ?? [],
    runHistory: d?.runHistory ?? [],
    avgRunCost: d?.avgRunCost ?? '£0.00',
    estimatedMonthlyExecutions: d?.estimatedMonthlyExecutions ?? 0,
    estimatedMonthlyCost: d?.estimatedMonthlyCost ?? '£0.00',
  };
}

/**
 * Map a live `ai_event_automation_rules` row to an `EventAutomationRule`.
 *
 * @param row   The Supabase row.
 * @param ctx   Resolved UUID → stable-key maps.
 * @param demo  Optional matching demo record (by `event_rule_key`) supplying
 *              the descriptive resulting-task text and condition wording.
 */
export function mapEventRuleRowToRecord(
  row: AiEventAutomationRuleRow,
  ctx: ScheduleResolutionContext,
  demo?: EventAutomationRule,
): EventAutomationRule {
  const d = demo;
  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—') : 'Group-wide';
  const agentId = row.agent_id ? (ctx.agentKeyById.get(row.agent_id) ?? 'unknown') : (d?.agentId ?? '');
  const agentName = row.agent_id ? (ctx.agentNameById.get(row.agent_id) ?? d?.agentName ?? '—') : (d?.agentName ?? '—');
  const conditions = asRecord(row.conditions);

  return {
    id: row.event_rule_key,
    name: row.name,
    eventSource: row.event_type ?? d?.eventSource ?? 'other',
    condition: (conditions.condition as string) ?? d?.condition ?? '',
    agentId,
    agentName,
    siteId,
    siteName,
    resultingTask: d?.resultingTask ?? row.action_reference ?? row.action_type ?? '',
    approvalRequired: row.approval_required,
    status: (row.status as ScheduleStatus) ?? 'active',
  };
}

/**
 * Map a live `ai_maintenance_windows` row to a `MaintenanceWindow`.
 *
 * @param row   The Supabase row.
 * @param ctx   Resolved UUID → stable-key maps.
 * @param demo  Optional matching demo record (by `window_key`) supplying the
 *              recurrence label and allow-critical flag.
 */
export function mapMaintenanceWindowRowToRecord(
  row: AiMaintenanceWindowRow,
  ctx: ScheduleResolutionContext,
  demo?: MaintenanceWindow,
): MaintenanceWindow {
  const d = demo;
  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—') : 'Group-wide';

  return {
    id: row.window_key,
    name: row.name,
    siteId,
    siteName,
    start: formatTimestamp(row.starts_at) || d?.start || '',
    end: formatTimestamp(row.ends_at) || d?.end || '',
    recurrence: d?.recurrence ?? 'One-time',
    pauseAutomation: row.suppress_schedules,
    allowCriticalAutomation: d?.allowCriticalAutomation ?? true,
    ownerTeam: row.owner_team ?? '—',
  };
}