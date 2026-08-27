// ============================================================================
// AI Operations — Audit & Evidence derived-data layer.
//
// Pure projections over the central Audit registry. Lookup helpers resolve
// run / approval / orchestration / tool / model / knowledge / alert / policy
// IDs to matching audit events so other modules can link without duplicating
// records. No production logs, no secrets, no real validation.
// ============================================================================

import type {
  AiAuditEvent,
  AuditEvidence,
  AuditReviewItem,
  HumanOverrideAudit,
  ComplianceReadinessCheck,
} from '@/pages/ai-operations/types';
import { demoAuditEvents, demoAuditEvidence } from '@/mocks/ai-operations-audit';
import { demoAuditEvents2, demoAuditEvidence2, demoHumanOverrides, demoComplianceChecks } from '@/mocks/ai-operations-audit-2';

export const allAuditEvents: AiAuditEvent[] = [...demoAuditEvents, ...demoAuditEvents2];
export const allAuditEvidence: AuditEvidence[] = [...demoAuditEvidence, ...demoAuditEvidence2];

export function getAuditById(id: string): AiAuditEvent | undefined {
  return allAuditEvents.find((e) => e.id === id);
}

export function getAuditByRun(runId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.runId === runId);
}

export function getAuditByApproval(approvalId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.approvalId === approvalId);
}

export function getAuditByOrchestration(orchestrationId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.orchestrationId === orchestrationId);
}

export function getAuditByTool(toolId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.toolId === toolId);
}

export function getAuditByModel(modelId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.modelId === modelId);
}

export function getAuditByKnowledge(knowledgeId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.knowledgeId === knowledgeId);
}

export function getAuditByAlert(alertId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.alertId === alertId);
}

export function getAuditByPolicy(policyId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.policyId === policyId);
}

export function getAuditByAgent(agentId: string): AiAuditEvent[] {
  return allAuditEvents.filter((e) => e.agentId === agentId);
}

export function getEvidenceById(id: string): AuditEvidence | undefined {
  return allAuditEvidence.find((e) => e.id === id);
}

export function getEvidenceForEvent(event: AiAuditEvent): AuditEvidence[] {
  return event.evidenceIds.map((id) => getEvidenceById(id)).filter((e): e is AuditEvidence => Boolean(e));
}

export function getHumanOverrides(): HumanOverrideAudit[] {
  return demoHumanOverrides;
}

export function getComplianceChecks(): ComplianceReadinessCheck[] {
  return demoComplianceChecks;
}

// Deterministic review queue — events that are high/critical risk, missing
// evidence, failed verification/UAT, human override, or otherwise incomplete.
export function getReviewQueue(): AuditReviewItem[] {
  return allAuditEvents
    .filter((e) => e.reviewRequired)
    .map((e) => {
      let reason: string;
      if (e.eventType === 'human_override') reason = 'Human override used';
      else if (e.verification.required && e.verification.status === 'Failed') reason = 'Failed verification';
      else if (e.uat.required && e.uat.blockingFailures) reason = 'Blocking UAT failures';
      else if (e.verification.required && !e.verification.evidenceAvailable) reason = 'Missing evidence';
      else if (e.outcome === 'blocked') reason = 'Blocked action requires review';
      else if (e.risk === 'red') reason = 'High/critical risk event';
      else reason = 'Incomplete record';
      return { auditId: e.id, reason, severity: e.severity, risk: e.risk };
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5);
    });
}

// KPI helpers (demo/derived values only).
export function countAuditToday(): number {
  return allAuditEvents.filter((e) => e.timestamp.startsWith('2026-08-25')).length;
}

export function countHighRisk(): number {
  return allAuditEvents.filter((e) => e.risk === 'red' || e.severity === 'critical' || e.severity === 'high').length;
}

export function countEvidenceComplete(): number {
  return allAuditEvidence.filter((e) => e.status === 'available' && e.integrityState === 'pass').length;
}

export function countEvidenceMissing(): number {
  return allAuditEvidence.filter((e) => e.status === 'missing').length;
}

export function countApprovalDecisions(): number {
  return allAuditEvents.filter((e) => e.eventType === 'approval_decision').length;
}

export function countPolicyBlocks(): number {
  return allAuditEvents.filter((e) => e.outcome === 'blocked').length;
}

export function countVerificationFailures(): number {
  return allAuditEvents.filter((e) => e.verification.required && e.verification.status === 'Failed').length;
}

export function countReviewRequired(): number {
  return allAuditEvents.filter((e) => e.reviewRequired).length;
}