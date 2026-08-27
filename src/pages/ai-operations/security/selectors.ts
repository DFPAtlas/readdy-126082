// ============================================================================
// AI Operations — Security & Policy derived-data layer.
//
// Pure projections over the central Security & Policy Engine. Agent / tool /
// model / knowledge / approval "applicable policies" are derived from the
// policy records' target ID arrays (no registry record is duplicated). The
// evaluator produces a deterministic demo result only — no enforcement occurs.
// ============================================================================

import type {
  AiSecurityPolicy,
  PolicyEvaluation,
  Environment,
  RiskClass,
  EvaluationResult,
} from '@/pages/ai-operations/types';
import { demoPolicies } from '@/mocks/ai-operations-security';

// ============================================================================
// Live policy evaluator (deterministic simulation — no enforcement).
//
// `evaluateRequest` runs the same governance preview as the demo evaluator but
// against a caller-supplied policy list (live or demo). It is purely a
// read-only projection: it never executes an agent, blocks a production
// request, triggers a workflow, or mutates business data.
// ============================================================================

export interface PolicyEvaluateInput {
  siteKey: string;
  agentKey: string;
  action: string;
  risk: RiskClass;
  environment: Environment;
  tool: string;
  model: string;
  knowledge: string;
}

// Deterministic precedence: higher rank wins when multiple policies match.
//   deny (5) > restrict (4) > require_approval (3) > allow_with_conditions (2)
//   > audit_only (1) > allow (0)
const EFFECT_RANK: Record<string, number> = {
  deny: 5,
  restrict: 4,
  require_approval: 3,
  allow_with_conditions: 2,
  audit_only: 1,
  allow: 0,
};

// Normalise a policy effect into a decision result (audit_only → non-blocking).
function effectToResult(effect: string | null): EvaluationResult {
  if (effect === 'deny') return 'deny';
  if (effect === 'restrict') return 'restrict';
  if (effect === 'require_approval') return 'require_approval';
  if (effect === 'allow_with_conditions') return 'allow_with_conditions';
  return 'allow';
}

function controlsForEffect(effect: string | null): string[] {
  if (effect === 'deny') return ['Governed exception workflow', 'Immutable audit logging'];
  if (effect === 'restrict') return ['Least-privilege scope enforcement', 'Audit logging'];
  if (effect === 'require_approval') return ['Human approval', 'Minimum approvers satisfied'];
  if (effect === 'allow_with_conditions') return ['Conditional guardrails', 'Audit logging'];
  return ['Audit logging'];
}

export function evaluateRequest(
  policies: AiSecurityPolicy[],
  input: PolicyEvaluateInput,
): PolicyEvaluation {
  const action = input.action.trim().toLowerCase();
  const enforceable = policies.filter((p) => p.status === 'active' || p.status === 'review_required');

  const scored = enforceable
    .map((p) => {
      const hay = `${p.name} ${p.description} ${p.actionType} ${p.category} ${p.notes}`.toLowerCase();
      let score = 0;
      // Environment affinity.
      if (p.environment === input.environment) score += 2;
      // Risk affinity.
      if (p.riskClass === input.risk) score += 2;
      else if (p.riskClass === 'red' && input.risk === 'amber') score += 1;
      // Action keyword overlap.
      const keywords = action.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      for (const kw of keywords) if (hay.includes(kw)) score += 1;
      // Tool / model / knowledge hints.
      if (input.tool && input.tool !== 'None' && hay.includes(input.tool.toLowerCase())) score += 1;
      if (input.model && input.model !== 'None' && hay.includes(input.model.toLowerCase())) score += 1;
      if (input.knowledge && input.knowledge !== 'None' && hay.includes(input.knowledge.toLowerCase())) score += 1;
      return { policy: p, score };
    })
    .filter((s) => s.score >= 2);

  // Safe default: nothing matched → audit + allow.
  if (scored.length === 0) {
    return {
      matchedPolicies: [],
      result: 'allow',
      approvalRequired: false,
      blockingPolicies: [],
      requiredControls: ['Audit logging'],
      auditRequired: true,
    };
  }

  const sorted = [...scored].sort((a, b) => (EFFECT_RANK[b.policy.effect] ?? 0) - (EFFECT_RANK[a.policy.effect] ?? 0));
  const topEffect = sorted[0].policy.effect;
  const topRank = EFFECT_RANK[topEffect] ?? 0;
  const blocking = sorted
    .filter((s) => (EFFECT_RANK[s.policy.effect] ?? 0) === topRank)
    .map((s) => s.policy.id);

  const result = effectToResult(topEffect);

  return {
    matchedPolicies: sorted.map((s) => s.policy.id),
    result,
    approvalRequired: result === 'require_approval' || sorted[0].policy.approvalRequired,
    blockingPolicies: blocking,
    requiredControls: controlsForEffect(topEffect),
    auditRequired: sorted.some((s) => s.policy.auditRequired),
  };
}

export function getAllPolicies(): AiSecurityPolicy[] {
  return demoPolicies;
}

export function getPoliciesForAgent(agentId: string): AiSecurityPolicy[] {
  return demoPolicies.filter((p) => p.agentIds.includes(agentId));
}

export function getPoliciesForTool(toolId: string): AiSecurityPolicy[] {
  return demoPolicies.filter((p) => p.toolIds.includes(toolId));
}

export function getPoliciesForModel(modelId: string): AiSecurityPolicy[] {
  return demoPolicies.filter((p) => p.modelIds.includes(modelId));
}

export function getPoliciesForKnowledge(knowledgeId: string): AiSecurityPolicy[] {
  return demoPolicies.filter((p) => p.knowledgeIds.includes(knowledgeId));
}

// Maps an approval request to the governance policies that would have triggered it.
const REQUEST_TYPE_POLICIES: Record<string, string[]> = {
  security: ['POL-AUTH-CHANGE', 'POL-RLS', 'POL-CREDENTIALS', 'POL-SECRETS-PROMPT'],
  deployment: ['POL-DEPLOY', 'POL-GITHUB', 'POL-READDY-PUBLISH'],
  billing: ['POL-STRIPE', 'POL-COST'],
  compliance: ['POL-PRIVACY'],
  repair: ['POL-SUPABASE-WRITE', 'POL-PROD-CONFIRM'],
  diagnostics: ['POL-PRIVACY'],
  support: ['POL-PRIVACY'],
  uat: ['POL-DEPLOY'],
  manual: ['POL-PROD-CONFIRM'],
};

export function getPoliciesForApproval(requestType: string, riskClass: RiskClass): AiSecurityPolicy[] {
  const ids = REQUEST_TYPE_POLICIES[requestType] ?? [];
  let matches = demoPolicies.filter((p) => ids.includes(p.id));
  if (riskClass === 'red') {
    const separation = demoPolicies.filter((p) => p.id === 'POL-SEPARATION');
    matches = [...matches, ...separation];
  }
  if (matches.length === 0) {
    matches = demoPolicies.filter((p) => ['POL-AUDIT', 'POL-PROD-CONFIRM'].includes(p.id));
  }
  return matches;
}

export function countAgentsGoverned(): number {
  const ids = new Set<string>();
  demoPolicies.forEach((p) => p.agentIds.forEach((id) => ids.add(id)));
  return ids.size;
}

// Deterministic demo evaluation — no real enforcement.
export function evaluateDemoRequest(input: {
  environment: Environment;
  risk: RiskClass;
  action: string;
  toolId: string;
}): PolicyEvaluation {
  const action = input.action.trim().toLowerCase();

  if (input.risk === 'red') {
    return {
      matchedPolicies: ['POL-SEPARATION', 'POL-AUDIT'],
      result: 'require_approval',
      approvalRequired: true,
      blockingPolicies: ['POL-SEPARATION'],
      requiredControls: ['Separation of duties', 'Dual approvers', 'Immutable audit logging'],
      auditRequired: true,
    };
  }

  if (action.includes('delete') || action.includes('credential') || action.includes('secret')) {
    return {
      matchedPolicies: ['POL-DATA-DELETE', 'POL-CREDENTIALS'],
      result: 'deny',
      approvalRequired: false,
      blockingPolicies: ['POL-DATA-DELETE'],
      requiredControls: ['Governed deletion workflow'],
      auditRequired: true,
    };
  }

  if (action.includes('publish') || action.includes('deploy') || action.includes('refund') || action.includes('rls')) {
    return {
      matchedPolicies: ['POL-DEPLOY', 'POL-STRIPE'],
      result: 'require_approval',
      approvalRequired: true,
      blockingPolicies: ['POL-DEPLOY'],
      requiredControls: ['Human approval', 'UAT completion'],
      auditRequired: true,
    };
  }

  if (input.environment === 'sandbox') {
    return {
      matchedPolicies: ['POL-SANDBOX-ISOLATION'],
      result: 'allow_with_conditions',
      approvalRequired: false,
      blockingPolicies: [],
      requiredControls: ['Sandbox isolation'],
      auditRequired: true,
    };
  }

  return {
    matchedPolicies: ['POL-AUDIT'],
    result: 'allow',
    approvalRequired: false,
    blockingPolicies: [],
    requiredControls: ['Audit logging'],
    auditRequired: true,
  };
}