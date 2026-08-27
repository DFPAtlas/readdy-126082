// ============================================================================
// AI Operations — Notifications & Escalations derived-data layer.
//
// Pure projections over the central Notifications registry. Lookup helpers
// resolve alert / approval / policy / orchestration / budget / run / agent IDs
// to matching rules so other modules can link without duplicating records.
// ============================================================================

import type { NotificationRule, NotificationEvent, NotificationTestResult } from '@/pages/ai-operations/types';
import { demoNotificationRules } from '@/mocks/ai-operations-notifications';
import { demoNotificationEvents } from '@/mocks/ai-operations-notifications-events';

export const allNotificationRules: NotificationRule[] = [...demoNotificationRules];

export const allNotificationEvents: NotificationEvent[] = [...demoNotificationEvents];

export function getRuleById(id: string): NotificationRule | undefined {
  return allNotificationRules.find((r) => r.id === id);
}

// Resolves a matching rule for a given event source + event type (best-effort,
// used by integration points to surface "Notification & Escalation" on other
// modules without duplicating the rule registry).
export function getRuleBySource(source: string, eventType: string): NotificationRule | undefined {
  return allNotificationRules.find((r) => r.eventSource === source && r.eventType === eventType);
}

export function getRuleByAlertType(alertType: string): NotificationRule | undefined {
  const map: Record<string, string> = {
    site_health: 'site_health',
    agent_failure: 'agent_failure',
    run_failure: 'run_failure',
    orchestration: 'orchestration_blocked',
    tool_connection: 'tool_connection',
    model_provider: 'model_provider',
    security: 'security',
    policy_violation: 'policy_violation',
    approval: 'approval_expiring',
    uat: 'uat_failure',
    billing: 'budget_alert',
    integration: 'integration',
  };
  const eventType = map[alertType];
  if (!eventType) return undefined;
  return allNotificationRules.find((r) => r.eventType === eventType);
}

export function getEventsByRule(ruleId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.ruleId === ruleId);
}

export function getEventsByAlert(alertId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.relatedRecordType === 'alert' && e.relatedRecordId === alertId);
}

export function getEventsByApproval(approvalId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.relatedRecordType === 'approval' && e.relatedRecordId === approvalId);
}

export function getEventsByPolicy(policyId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.relatedRecordType === 'policy' && e.relatedRecordId === policyId);
}

export function getEventsByBudget(budgetId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.relatedRecordType === 'budget' && e.relatedRecordId === budgetId);
}

export function getEventsByRun(runId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.relatedRecordType === 'run' && e.relatedRecordId === runId);
}

export function getEventsByOrchestration(orchestrationId: string): NotificationEvent[] {
  return allNotificationEvents.filter((e) => e.relatedRecordType === 'orchestration' && e.relatedRecordId === orchestrationId);
}

// --- KPI counters --------------------------------------------------------------

export function countActiveRules(): number {
  return allNotificationRules.filter((r) => r.status === 'active').length;
}

export function countNotificationsToday(): number {
  return allNotificationEvents.filter((e) => e.time.startsWith('2026-08-25')).length;
}

export function countCriticalNotifications(): number {
  return allNotificationEvents.filter((e) => e.priority === 'critical').length;
}

export function countAwaitingAcknowledgement(): number {
  return allNotificationEvents.filter((e) => e.acknowledgement === 'awaiting').length;
}

export function countEscalated(): number {
  return allNotificationEvents.filter((e) => e.status === 'escalated').length;
}

export function countFailedDeliveries(): number {
  return allNotificationEvents.filter((e) => e.status === 'failed').length;
}

export function countSuppressed(): number {
  return allNotificationEvents.filter((e) => e.status === 'suppressed').length;
}

export function countRulesRequiringReview(): number {
  return allNotificationRules.filter((r) => r.status === 'review_required' || r.status === 'draft').length;
}

// --- Test rule simulation ------------------------------------------------------

// Frontend-only simulation: matches an event source + severity against rules
// and returns the matched rule's routing metadata. No delivery occurs.
export function simulateRuleMatch(eventSource: string, severity: string): NotificationTestResult {
  const sevRank: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const targetRank = sevRank[severity] ?? 0;

  const match = allNotificationRules
    .filter((r) => r.status === 'active')
    .filter((r) => r.eventSource === eventSource)
    .sort((a, b) => (sevRank[b.severityThreshold] ?? 0) - (sevRank[a.severityThreshold] ?? 0))
    .find((r) => (sevRank[r.severityThreshold] ?? 0) <= targetRank);

  if (!match) {
    return {
      matchedRuleId: null,
      ruleName: '',
      matched: false,
      priority: null,
      recipientTeam: '',
      channels: [],
      acknowledgementRequired: false,
      escalationPath: [],
    };
  }

  return {
    matchedRuleId: match.id,
    ruleName: match.name,
    matched: true,
    priority: match.priority,
    recipientTeam: match.initialTeam,
    channels: match.channels,
    acknowledgementRequired: match.acknowledgementRequired,
    escalationPath: match.escalationPath,
  };
}