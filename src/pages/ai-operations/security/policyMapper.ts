// ============================================================================
// AI Operations — Security & Policy Engine — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase `ai_security_policies` row and
// the existing `AiSecurityPolicy` contract. All DB→frontend field differences
// are handled here so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `policy_key` (text, unique) is the stable application identifier used by
//     routes (/ai-operations/security/policies/:policyId).
//   * The database `id` (UUID) remains the internal primary key and is never
//     exposed as the frontend `id`.
//
// Live vs demo:
//   * Authoritative policy base metadata comes from the live row: name,
//     description, category, effect, scope, site/agent linkage, action, risk,
//     environment, priority, status, approval/audit requirement, owner/version/
//     review dates, and safe condition summary.
//   * Nested supporting metadata (target id arrays, structured conditions,
//     decision explanation, exceptions, history, enforcement stage) has no
//     production table yet, so it is merged from the demo registry as clearly
//     labelled "Demo Supporting Metadata".
// ============================================================================

import type {
  AiSecurityPolicy,
  PolicyCategory,
  PolicyEffect,
  PolicyStatus,
  RiskClass,
  RiskLevel,
  Environment,
  EnforcementStage,
  EvaluationResult,
  PolicyCondition,
} from '@/pages/ai-operations/types';
import type { AiSecurityPolicyRow } from '@/lib/ai-operations';

// Resolved site lookup maps (key & name by UUID), built by the Security context
// from the live Sites registry. No UUIDs leak into the UI.
export interface PolicyResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse the JSONB `requirements` column ({ min_approvers, ... }) safely.
function readMinApprovers(value: unknown): number {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const min = (value as Record<string, unknown>).min_approvers;
    if (typeof min === 'number') return min;
  }
  return 0;
}

// Normalise an effect into a valid EvaluationResult. `audit_only` is a policy
// effect but not a decision result, so it collapses to the non-blocking
// "allow" (the decision section only describes enforcement outcome).
function effectToResult(effect: string | null): EvaluationResult {
  if (effect === 'deny') return 'deny';
  if (effect === 'restrict') return 'restrict';
  if (effect === 'require_approval') return 'require_approval';
  if (effect === 'allow_with_conditions') return 'allow_with_conditions';
  return 'allow';
}

// Safe empty defaults for a newly created live policy (no demo match).
function emptySupporting(): Partial<AiSecurityPolicy> {
  return {
    agentIds: [],
    toolIds: [],
    modelIds: [],
    knowledgeIds: [],
    enforcementStage: 'execution_gate',
    exceptionAllowed: false,
    conditions: [],
    exceptions: [],
    history: [],
  };
}

/**
 * Map a live `ai_security_policies` row to an `AiSecurityPolicy`.
 *
 * @param row  The Supabase row.
 * @param demo Optional matching demo record (by `policy_key`) supplying
 *             nested supporting metadata (target arrays, structured conditions,
 *             decision explanation, exceptions, history, enforcement stage).
 * @param ctx  Resolved site lookup maps.
 */
export function mapPolicyRowToRecord(
  row: AiSecurityPolicyRow,
  demo: AiSecurityPolicy | undefined,
  ctx: PolicyResolutionContext,
): AiSecurityPolicy {
  const d = demo ?? (emptySupporting() as AiSecurityPolicy);

  // Resolve site key & name (no UUID in the UI).
  const siteKey = row.site_id ? (ctx.siteKeyById.get(row.site_id) ?? null) : null;
  const siteName = row.site_id
    ? (ctx.siteNameById.get(row.site_id) ?? 'Unresolved Site')
    : (row.scope === 'site' ? 'Site' : 'Group-wide');

  const effect = (row.effect as PolicyEffect) ?? d.effect;

  return {
    // Stable application identifier — equals the DB `policy_key`.
    id: row.policy_key,
    name: row.name,
    description: row.description ?? d.description,
    category: (row.category as PolicyCategory) ?? d.category,
    status: (row.status as PolicyStatus) ?? 'draft',
    effect,
    priority: (row.priority as RiskLevel) ?? d.priority,
    scope: row.scope ?? (siteKey ? 'site' : 'group'),
    siteId: siteKey,
    siteName,
    // Demo supporting metadata (target arrays — no production tables yet).
    agentIds: d.agentIds ?? [],
    toolIds: d.toolIds ?? [],
    modelIds: d.modelIds ?? [],
    knowledgeIds: d.knowledgeIds ?? [],
    environment: (row.environment as Environment) ?? d.environment,
    riskClass: (row.risk_class as RiskClass) ?? d.riskClass,
    actionType: row.action_pattern ?? row.subject_reference ?? d.actionType,
    approvalRequired: row.approval_required,
    minApprovers: readMinApprovers(row.requirements) || d.minApprovers,
    // Demo supporting metadata (no production tables yet).
    enforcementStage: (d.enforcementStage ?? 'execution_gate') as EnforcementStage,
    exceptionAllowed: d.exceptionAllowed ?? false,
    auditRequired: row.audit_required,
    ownerTeam: row.owner_team ?? d.ownerTeam,
    version: row.version ?? d.version,
    effectiveDate: formatDate(row.effective_from) || d.effectiveDate,
    reviewDate: formatDate(row.next_review_at) || d.reviewDate,
    createdAt: formatDate(row.created_at) || d.createdAt,
    updatedAt: formatDate(row.updated_at) || d.updatedAt,
    notes: row.notes ?? d.notes,
    // Demo supporting metadata.
    conditions: (d.conditions ?? []) as PolicyCondition[],
    decision: {
      result: effectToResult(row.effect),
      explanation: d.decision?.explanation ?? row.condition_summary ?? '',
    },
    exceptions: d.exceptions ?? [],
    history: d.history ?? [],
  };
}

/**
 * Map an `AiSecurityPolicy` record to the database input for create/update.
 * Only base governance metadata is persisted — target arrays, structured
 * conditions, decision explanation, exceptions and history are demo supporting
 * metadata and are intentionally excluded. `siteUuid` is the resolved
 * `ai_sites.id` (or null for group-wide). No secrets are accepted.
 */
export function mapRecordToPolicyInput(
  record: AiSecurityPolicy,
  siteUuid: string | null,
): import('@/lib/ai-operations').AiSecurityPolicyUpsertInput {
  return {
    policy_key: record.id,
    name: record.name,
    description: record.description,
    category: record.category,
    effect: record.effect,
    scope: record.siteId ? 'site' : 'group',
    site_id: siteUuid,
    agent_id: null,
    subject_type: 'action',
    subject_reference: record.actionType,
    action_pattern: record.actionType,
    risk_level: record.riskClass,
    environment: record.environment,
    priority: record.priority,
    status: record.status,
    condition_summary: record.conditions.map((c) => c.then).join('; ') || null,
    requirements: { min_approvers: record.approvalRequired ? record.minApprovers : 0 },
    approval_required: record.approvalRequired,
    audit_required: record.auditRequired,
    owner_team: record.ownerTeam,
    version: record.version,
    effective_from: record.effectiveDate === '—' ? null : record.effectiveDate,
    next_review_at: record.reviewDate === '—' ? null : record.reviewDate,
    is_active: true,
    notes: record.notes,
  };
}