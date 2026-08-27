// ============================================================================
// AI Operations — Notifications & Escalations — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_notification_rules,
// ai_escalation_policies, ai_escalation_levels, ai_notification_events,
// ai_quiet_hours_policies) and the existing `NotificationRule` /
// `NotificationEvent` contracts. All DB↔frontend field differences are handled
// here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `rule_key` / `event_key` are the stable application identifiers used by
//     routes (/ai-operations/notifications/rules/:ruleId). DB UUIDs are never
//     exposed as the frontend `id`.
//   * All FK UUIDs (site/rule/alert/incident/approval/run) are resolved back to
//     stable keys here via the resolution context.
//
// Live vs demo:
//   * Authoritative registry metadata (identity, event type, scope/site,
//     severity/priority thresholds, channels, recipient, acknowledgement flag,
//     dedupe/suppression flags, owner, status, notes) comes from live rows.
//   * Nested/derived metadata (escalation path detail, suppression wording,
//     risk threshold, review dates, policy references, event source labels and
//     the human-readable event timeline) has no fully-structured production
//     representation yet, so it is merged from the demo registry as
//     clearly-labelled "Demo Supporting Metadata".
//
// Safety: no delivery occurs, no secrets or private contact details are mapped.
// ============================================================================

import type {
  NotificationRule,
  NotificationRuleStatus,
  NotificationEvent,
  NotificationStatus,
  AcknowledgementState,
  NotificationChannel,
  NotificationPriority,
  Severity,
  Environment,
  NotificationSuppression,
  EscalationStep,
  RiskClass,
} from '@/pages/ai-operations/types';
import type {
  AiNotificationRuleRow,
  AiEscalationPolicyRow,
  AiEscalationLevelRow,
  AiNotificationEventRow,
} from '@/lib/ai-operations';

// Resolved lookup maps, built by the Notifications context from the live
// registries. No UUIDs leak into the UI — every FK is resolved to its key here.
export interface NotificationResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  ruleKeyById: Map<string, string>;
  alertKeyById: Map<string, string>;
  incidentKeyById: Map<string, string>;
  approvalKeyById: Map<string, string>;
  runKeyById: Map<string, string>;
  maxLevelByPolicyKey: Map<string, number>;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asStringArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptySuppression(): NotificationSuppression {
  return {
    duplicateWindow: '—',
    suppressionCondition: '—',
    quietHours: '—',
    maintenanceHandling: '—',
    repeatHandling: '—',
  };
}

/**
 * Map a live `ai_notification_rules` row to a `NotificationRule`.
 *
 * @param row   The Supabase row.
 * @param ctx   Resolved UUID → stable-key maps (site + escalation max level).
 * @param demo  Optional matching demo record (by `rule_key`) supplying nested
 *              demo supporting metadata (escalation path, suppression wording,
 *              risk threshold, review dates, policy refs, team labels).
 */
export function mapRuleRowToRecord(
  row: AiNotificationRuleRow,
  ctx: NotificationResolutionContext,
  demo?: NotificationRule,
): NotificationRule {
  const d = demo;
  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—') : 'Group-wide';

  const channels = (asStringArray(row.channels) as NotificationChannel[]).filter(
    (c): c is NotificationChannel => true,
  );

  const maxLevel = row.escalation_policy_key
    ? (ctx.maxLevelByPolicyKey.get(row.escalation_policy_key) ?? d?.maxEscalationLevel ?? 0)
    : (d?.maxEscalationLevel ?? 0);

  return {
    // Stable application identifier — equals the DB `rule_key`.
    id: row.rule_key,
    name: row.name,
    description: row.description ?? '',
    status: (row.status as NotificationRuleStatus) ?? 'active',
    // Event source category is demo-only (no dedicated column); fall back to
    // the raw event type as a readable label for new live records.
    eventSource: d?.eventSource ?? row.event_type ?? 'Other',
    eventType: row.event_type ?? d?.eventType ?? 'other',
    siteId,
    siteName,
    agentId: d?.agentId ?? null,
    severityThreshold: (row.severity_minimum as Severity) ?? d?.severityThreshold ?? 'medium',
    riskThreshold: (d?.riskThreshold as RiskClass) ?? 'amber',
    environment: (row.environment as Environment) ?? 'production',
    priority: (row.priority_minimum as NotificationPriority) ?? d?.priority ?? 'normal',
    channels: channels.length > 0 ? channels : (d?.channels ?? []),
    initialTeam: row.recipient_reference ?? d?.initialTeam ?? '—',
    escalationTeam: d?.escalationTeam ?? '—',
    acknowledgementRequired: row.acknowledgement_required,
    acknowledgementDeadline: d?.acknowledgementDeadline ?? (row.acknowledgement_timeout_minutes != null ? `${row.acknowledgement_timeout_minutes}m` : 'N/A'),
    escalationDelay: d?.escalationDelay ?? '—',
    maxEscalationLevel: maxLevel,
    repeatInterval: d?.repeatInterval ?? '—',
    quietHoursBehaviour: d?.quietHoursBehaviour ?? '—',
    deduplicationEnabled: row.suppression_enabled,
    auditRequired: row.audit_required,
    ownerTeam: row.owner_team ?? '—',
    lastReviewed: d?.lastReviewed ?? '',
    nextReview: d?.nextReview ?? '',
    createdAt: formatTimestamp(row.created_at) || d?.createdAt || '',
    updatedAt: formatTimestamp(row.updated_at) || d?.updatedAt || '',
    notes: row.notes ?? '',
    policyIds: d?.policyIds ?? [],
    suppression: d?.suppression ?? emptySuppression(),
    escalationPath: d?.escalationPath ?? [],
  };
}

/**
 * Map a live `ai_notification_events` row to a `NotificationEvent`.
 *
 * @param row   The Supabase row.
 * @param ctx   Resolved UUID → stable-key maps.
 * @param demo  Optional matching demo record (by `event_key`) supplying the
 *              human-readable source/event text and timeline.
 */
export function mapNotificationEventRowToRecord(
  row: AiNotificationEventRow,
  ctx: NotificationResolutionContext,
  demo?: NotificationEvent,
): NotificationEvent {
  const d = demo;
  const siteId = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? 'unknown') : 'group';
  const siteName = row.site_id ? (ctx.siteNameById.get(row.site_id) ?? d?.siteName ?? '—') : 'Group-wide';

  // Derive the related record from the live FKs (alert/incident/approval/run);
  // fall back to the demo record for non-FK related types (policy /
  // orchestration / budget / agent / model).
  let relatedRecordType: NotificationEvent['relatedRecordType'] = d?.relatedRecordType ?? null;
  let relatedRecordId: string | null = d?.relatedRecordId ?? null;
  if (row.alert_id) {
    relatedRecordType = 'alert';
    relatedRecordId = ctx.alertKeyById.get(row.alert_id) ?? null;
  } else if (row.incident_id) {
    relatedRecordType = 'alert';
    relatedRecordId = ctx.incidentKeyById.get(row.incident_id) ?? null;
  } else if (row.approval_id) {
    relatedRecordType = 'approval';
    relatedRecordId = ctx.approvalKeyById.get(row.approval_id) ?? null;
  } else if (row.run_id) {
    relatedRecordType = 'run';
    relatedRecordId = ctx.runKeyById.get(row.run_id) ?? null;
  }

  return {
    id: row.event_key,
    time: d?.time ?? formatTimestamp(row.created_at),
    source: d?.source ?? row.event_type ?? 'Other',
    siteId,
    siteName,
    event: row.summary ?? d?.event ?? '',
    priority: (row.priority as NotificationPriority) ?? d?.priority ?? 'normal',
    channel: (row.channel as NotificationChannel) ?? d?.channel ?? 'other',
    recipientTeam: row.recipient_reference ?? d?.recipientTeam ?? '—',
    status: (row.status as NotificationStatus) ?? d?.status ?? 'sent',
    relatedRecordType,
    relatedRecordId,
    acknowledgement: (row.acknowledgement_state as AcknowledgementState) ?? d?.acknowledgement ?? 'not_required',
    acknowledgementDeadline: d?.acknowledgementDeadline ?? 'N/A',
    acknowledgedByTeam: row.acknowledged_by ?? d?.acknowledgedByTeam ?? '',
    acknowledgedAt: d?.acknowledgedAt ?? formatTimestamp(row.acknowledged_at),
    escalationLevel: row.escalation_level ?? d?.escalationLevel ?? 0,
    ruleId: row.rule_id ? (ctx.ruleKeyById.get(row.rule_id) ?? null) : (d?.ruleId ?? null),
  };
}

/**
 * Map an `ai_escalation_levels` row to an `EscalationStep` (used when a live
 * escalation path is requested). `channels` is a JSONB array; the first
 * channel is used as the step channel, mirroring the demo single-channel model.
 */
export function mapLevelRowToStep(row: AiEscalationLevelRow): EscalationStep {
  const channels = asStringArray(row.channels) as NotificationChannel[];
  const delay =
    row.delay_minutes === 0
      ? 'Immediate'
      : row.delay_minutes < 60
        ? `${row.delay_minutes}m`
        : `${Math.round(row.delay_minutes / 60)}h`;

  return {
    level: row.level_number,
    team: row.recipient_reference ?? '—',
    delay,
    trigger: '—',
    channel: channels[0] ?? 'other',
    acknowledgementRequired: row.requires_acknowledgement,
  };
}

/**
 * Resolve the escalation policy max level from the live policies (keyed by
 * `policy_key`), used by the context to annotate each rule.
 */
export function mapPolicyMaxLevel(policy: AiEscalationPolicyRow): { policyKey: string; maxLevel: number } {
  return { policyKey: policy.policy_key, maxLevel: policy.max_level };
}