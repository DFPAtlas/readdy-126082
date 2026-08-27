// ============================================================================
// AI Operations — Alerts & Incident Operations derived-data layer.
//
// Pure projections over the central Alerts registry. Lookup helpers resolve
// run / agent / approval / orchestration IDs to matching alerts so other
// modules (Live, Runs, Orchestrator) can link without duplicating records.
// ============================================================================

import type { AiAlert, AlertSourceHealth } from '@/pages/ai-operations/types';
import { demoAlerts } from '@/mocks/ai-operations-alerts';
import { demoAlerts2 } from '@/mocks/ai-operations-alerts-2';

export const allAlerts: AiAlert[] = [...demoAlerts, ...demoAlerts2];

export function getAlertById(id: string): AiAlert | undefined {
  return allAlerts.find((a) => a.id === id);
}

export function getAlertByRun(runId: string): AiAlert | undefined {
  return allAlerts.find((a) => a.runId === runId);
}

export function getAlertByAgent(agentId: string): AiAlert | undefined {
  return allAlerts.find((a) => a.agentId === agentId);
}

export function getAlertByApproval(approvalId: string): AiAlert | undefined {
  return allAlerts.find((a) => a.approvalId === approvalId);
}

export function getAlertByOrchestration(orchestrationId: string): AiAlert | undefined {
  return allAlerts.find((a) => a.orchestrationId === orchestrationId);
}

// Resolves an OperationsAlert-style reference (referenceType + referenceId)
// from Live Operations to a central alert, where one matches.
export function getAlertByReference(referenceType: string, referenceId: string): AiAlert | undefined {
  if (!referenceId) return undefined;
  switch (referenceType) {
    case 'run':
      return getAlertByRun(referenceId);
    case 'agent':
      return getAlertByAgent(referenceId);
    case 'approval':
      return getAlertByApproval(referenceId);
    default:
      return undefined;
  }
}

// Priority incidents: critical OR high-severity unresolved alerts, plus
// repeated and policy/security violations.
export function getPriorityIncidents(): AiAlert[] {
  const open = (a: AiAlert) => !['resolved', 'closed', 'suppressed'].includes(a.status);
  return allAlerts
    .filter(open)
    .filter((a) => a.severity === 'critical' || a.severity === 'high' || a.repeating || a.type === 'policy_violation' || a.type === 'security')
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5);
    });
}

export function countOpenAlerts(): number {
  return allAlerts.filter((a) => !['resolved', 'closed', 'suppressed'].includes(a.status)).length;
}

export function countResolvedToday(): number {
  return allAlerts.filter((a) => ['resolved', 'closed'].includes(a.status)).length;
}

// Demo alert source health — no live monitoring.
export const demoAlertSources: AlertSourceHealth[] = [
  { source: 'Monitoring', status: 'operational', alertsToday: 3, lastAlert: '2026-08-25 09:12' },
  { source: 'Agents', status: 'degraded', alertsToday: 5, lastAlert: '2026-08-25 10:00' },
  { source: 'Runs', status: 'degraded', alertsToday: 6, lastAlert: '2026-08-25 10:31' },
  { source: 'Orchestrator', status: 'operational', alertsToday: 2, lastAlert: '2026-08-25 09:05' },
  { source: 'Tools', status: 'degraded', alertsToday: 4, lastAlert: '2026-08-25 09:15' },
  { source: 'Models', status: 'degraded', alertsToday: 1, lastAlert: '2026-08-25 09:12' },
  { source: 'Security Policies', status: 'operational', alertsToday: 2, lastAlert: '2026-08-25 09:30' },
  { source: 'UAT', status: 'operational', alertsToday: 1, lastAlert: '2026-08-25 09:35' },
];

// Deterministic priority explanation — no real prioritisation engine.
export function priorityReason(a: AiAlert): string {
  if (a.severity === 'critical') return 'Critical severity';
  if (a.severity === 'high') return 'High severity, unresolved';
  if (a.repeating) return 'Repeating incident';
  if (a.type === 'policy_violation') return 'Policy violation';
  if (a.type === 'security') return 'Security alert';
  return 'Awaiting review';
}