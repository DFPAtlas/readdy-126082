// ============================================================================
// AI Operations — Scheduling & Automation derived-data layer.
//
// Pure projections over the central Schedules registry. Lookup helpers resolve
// site / agent / notification / run IDs so other modules can link without
// duplicating records.
// ============================================================================

import type {
  AiSchedule,
  EventAutomationRule,
  MaintenanceWindow,
  QuietHoursPolicy,
} from '@/pages/ai-operations/types';
import { demoSchedulesPart1 } from '@/mocks/ai-operations-schedules';
import {
  demoSchedulesPart2,
  demoEventAutomationRules,
  demoMaintenanceWindows,
  demoQuietHours,
} from '@/mocks/ai-operations-schedules-2';

export const allSchedules: AiSchedule[] = [...demoSchedulesPart1, ...demoSchedulesPart2];

export const allEventAutomationRules: EventAutomationRule[] = [...demoEventAutomationRules];

export const allMaintenanceWindows: MaintenanceWindow[] = [...demoMaintenanceWindows];

export const allQuietHours: QuietHoursPolicy[] = [...demoQuietHours];

export function getScheduleById(id: string): AiSchedule | undefined {
  return allSchedules.find((s) => s.id === id);
}

export function getSchedulesBySite(siteId: string): AiSchedule[] {
  return allSchedules.filter((s) => s.siteId === siteId);
}

export function getSchedulesByAgent(agentId: string): AiSchedule[] {
  return allSchedules.filter((s) => s.agentId === agentId);
}

export function getSchedulesByNotificationRule(ruleId: string): AiSchedule[] {
  return allSchedules.filter((s) => s.notificationRuleId === ruleId);
}

// --- KPI counters --------------------------------------------------------------

export function countActiveSchedules(): number {
  return allSchedules.filter((s) => s.status === 'active').length;
}

export function countDueToday(): number {
  return allSchedules.filter((s) => s.nextRun.startsWith('2026-08-26')).length;
}

export function countRunningNow(): number {
  return allSchedules.filter((s) => s.status === 'running').length;
}

export function countFailedLastRun(): number {
  return allSchedules.filter((s) => s.lastRunStatus === 'failed').length;
}

export function countPaused(): number {
  return allSchedules.filter((s) => s.status === 'paused').length;
}

export function countAwaitingApproval(): number {
  return allSchedules.filter((s) => s.approvalRequired && s.status !== 'draft' && s.status !== 'disabled' && s.status !== 'expired').length;
}

export function countEventTriggeredRules(): number {
  return allEventAutomationRules.length;
}

export function countReviewsRequired(): number {
  return allSchedules.filter((s) => s.status === 'review_required' || s.status === 'draft').length;
}