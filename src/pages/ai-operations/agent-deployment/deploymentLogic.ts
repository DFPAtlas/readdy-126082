// ============================================================================
// DFP AI Operations — Agent Deployment selectors + validation (Prompt 03).
//
// Pure, read-only derivation and validation over the existing shared sources
// (ai_sites, ai_operations_agents, ai_n8n_workflow_registry, runtime bridge
// nodes). No new fetch, no polling, no execution.
//
// Honesty guarantees:
//   * Manager resolution uses STABLE ids only — never display-name matching.
//   * Self-parenting, cycles and cross-site parents are blocked (client here,
//     and again server-side via the BEFORE trigger).
//   * Duplicate site managers are surfaced, never silently collapsed.
//   * Connection validation, dispatch preview and actual test execution are
//     kept as three DISTINCT signals — a dispatch preview is never a run.
//   * "Missing data" never becomes a green/pass state.
// ============================================================================

import type { AiAgentRow, AiSiteRow } from '@/lib/ai-operations';
import type { N8nWorkflowRegistryRow } from '@/pages/ai-operations/wallboard/n8nStore';
import type { AiRuntimeBridgeNode } from '@/lib/ai-operations/runtimeBridge';
import type {
  DeploymentDraft,
  DeploymentRole,
  SetupStage,
  ValidationCheck,
} from '@/pages/ai-operations/agent-deployment/types';
import { SETUP_STAGES } from '@/pages/ai-operations/agent-deployment/types';

// --- Identity helpers ---------------------------------------------------------

export function isOrchestration(a: AiAgentRow): boolean {
  return (a.category ?? '').toLowerCase() === 'orchestration';
}

/** Derive a display role from an existing agent row (for the setup list). */
export function deriveRole(a: AiAgentRow): DeploymentRole {
  if (isOrchestration(a)) return a.site_id ? 'site_manager' : 'shared_agent';
  if (a.parent_agent_id) return 'sub_agent';
  if (!a.site_id) return 'shared_agent';
  return 'sub_agent';
}

// --- Manager resolution -------------------------------------------------------

/** Site-scoped orchestration agents = candidate site managers. */
export function managersForSite(agents: AiAgentRow[], siteId: string): AiAgentRow[] {
  return agents.filter((a) => a.site_id === siteId && isOrchestration(a));
}

/** True when another orchestration agent already occupies the manager role. */
export function duplicateSiteManager(
  agents: AiAgentRow[],
  siteId: string,
  excludeAgentId?: string | null,
): boolean {
  return managersForSite(agents, siteId).some((a) => a.id !== excludeAgentId);
}

/** Would assigning `parentAgentId` to `agentId` create a cycle? */
export function wouldCreateCycle(
  agentId: string | null,
  parentAgentId: string | null,
  agents: AiAgentRow[],
): boolean {
  if (!agentId || !parentAgentId) return false;
  if (agentId === parentAgentId) return true;
  const byId = new Map(agents.map((a) => [a.id, a]));
  let cursor: string | null = parentAgentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    if (cursor === agentId) return true;
    cursor = byId.get(cursor)?.parent_agent_id ?? null;
  }
  return false;
}

// --- Agent key ----------------------------------------------------------------

export function isValidAgentKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(key.trim());
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --- Validation ---------------------------------------------------------------

export interface ValidationSummary {
  checks: ValidationCheck[];
  blocking: boolean;
  ready: boolean;
  summary: string;
}

/**
 * Validate a draft against the live registries. Each check carries a timestamp
 * and a useful, honest failure note. A 'fail' is blocking; a 'warning' is not.
 * Connection validation, dispatch preview and actual test execution are
 * surfaced as separate checks — never conflated.
 */
export function validateDeployment(
  draft: DeploymentDraft,
  agents: AiAgentRow[],
  sites: AiSiteRow[],
  workflows: N8nWorkflowRegistryRow[],
  runtimes: AiRuntimeBridgeNode[],
  now: Date = new Date(),
): ValidationSummary {
  const checks: ValidationCheck[] = [];
  const ts = now.toISOString();

  // 1. Required fields.
  const missingName = !draft.name.trim();
  const missingKey = !draft.agentKey.trim();
  const keyFormat = isValidAgentKey(draft.agentKey);
  const keyDuplicate = agents.some(
    (a) => a.agent_key.toLowerCase() === draft.agentKey.trim().toLowerCase() && a.id !== draft.agentId,
  );
  const missingSite = draft.role !== 'shared_agent' && !draft.siteId;

  const requiredIssues: string[] = [];
  if (missingName) requiredIssues.push('name is missing');
  if (missingKey) requiredIssues.push('agent key is missing');
  if (!missingKey && !keyFormat) requiredIssues.push('agent key must be lowercase letters, digits and hyphens');
  if (keyDuplicate) requiredIssues.push('agent key already exists in the registry');
  if (missingSite) requiredIssues.push('a site is required for this role');

  checks.push({
    key: 'required',
    label: 'Required fields',
    status: requiredIssues.length === 0 ? 'pass' : 'fail',
    note: requiredIssues.length === 0 ? `All required fields present (${ts}).` : requiredIssues.join('; ') + '.',
    kind: 'required',
  });

  // 2. Site resolution.
  const site = draft.siteId ? sites.find((s) => s.id === draft.siteId) ?? null : null;
  checks.push({
    key: 'site_resolution',
    label: 'Site resolution',
    status: draft.role === 'shared_agent' ? 'pass' : site ? 'pass' : 'fail',
    note:
      draft.role === 'shared_agent'
        ? 'Shared agent has no site requirement.'
        : site
          ? `Resolved site ${site.site_key}.`
          : 'Selected site is not in the registry.',
    kind: 'required',
  });

  // 3. Manager assignment (sub-agents only).
  if (draft.role === 'sub_agent') {
    if (!draft.parentAgentId) {
      checks.push({
        key: 'manager',
        label: 'Manager assignment',
        status: 'fail',
        note: 'A sub-agent must have a parent manager on the same site.',
        kind: 'consistency',
      });
    } else {
      const parent = agents.find((a) => a.id === draft.parentAgentId);
      const selfParent = draft.parentAgentId === draft.agentId;
      const cycle = wouldCreateCycle(draft.agentId, draft.parentAgentId, agents);
      const crossSite = Boolean(parent && draft.siteId && parent.site_id && parent.site_id !== draft.siteId);
      if (!parent) {
        checks.push({
          key: 'manager',
          label: 'Manager assignment',
          status: 'fail',
          note: 'Selected parent manager is not in the registry.',
          kind: 'consistency',
        });
      } else if (selfParent || cycle) {
        checks.push({
          key: 'manager',
          label: 'Manager assignment',
          status: 'fail',
          note: 'Parent assignment would self-parent or create a cycle.',
          kind: 'consistency',
        });
      } else if (crossSite) {
        checks.push({
          key: 'manager',
          label: 'Manager assignment',
          status: 'fail',
          note: 'Parent manager belongs to a different site.',
          kind: 'consistency',
        });
      } else if (!isOrchestration(parent)) {
        checks.push({
          key: 'manager',
          label: 'Manager assignment',
          status: 'warning',
          note: 'Selected parent is not an orchestration agent (site manager).',
          kind: 'consistency',
        });
      } else {
        checks.push({
          key: 'manager',
          label: 'Manager assignment',
          status: 'pass',
          note: `Parent manager ${parent.name} on the same site.`,
          kind: 'consistency',
        });
      }
    }
  } else {
    checks.push({
      key: 'manager',
      label: 'Manager assignment',
      status: 'pass',
      note: draft.role === 'site_manager' ? 'This agent is a site manager (no parent).' : 'Shared agents have no parent manager.',
      kind: 'consistency',
    });
  }

  // 4. Duplicate site manager.
  if (draft.role === 'site_manager' && draft.siteId) {
    const dup = duplicateSiteManager(agents, draft.siteId, draft.agentId);
    checks.push({
      key: 'duplicate_manager',
      label: 'Duplicate site manager',
      status: dup ? 'fail' : 'pass',
      note: dup
        ? 'Another orchestration agent already manages this site.'
        : 'No duplicate site manager.',
      kind: 'consistency',
    });
  }

  // 5. Runtime availability (connection validation).
  if (draft.runtimeReference) {
    const node = runtimes.find((n) => n.node_key === draft.runtimeReference);
    checks.push({
      key: 'runtime',
      label: 'Runtime connectivity',
      status: node ? (node.status === 'not_registered' ? 'warning' : 'pass') : 'warning',
      note: node
        ? `Runtime ${node.name ?? node.node_key} registered (status: ${node.status}).`
        : 'Selected runtime node is not registered.',
      kind: 'connectivity',
    });
  } else {
    checks.push({
      key: 'runtime',
      label: 'Runtime connectivity',
      status: 'warning',
      note: 'No runtime host selected.',
      kind: 'connectivity',
    });
  }

  // 6. Workflow mapping.
  if (draft.workflowId) {
    const wf = workflows.find((w) => w.id === draft.workflowId);
    checks.push({
      key: 'workflow',
      label: 'Workflow mapping',
      status: wf ? (wf.is_active === true ? 'pass' : 'warning') : 'warning',
      note: wf
        ? `Mapped workflow ${wf.name ?? wf.workflow_key} (${wf.runtime_status}).`
        : 'Selected workflow is not in the registry.',
      kind: 'mapping',
    });
  } else {
    checks.push({
      key: 'workflow',
      label: 'Workflow mapping',
      status: 'warning',
      note: 'No approved workflow mapped yet.',
      kind: 'mapping',
    });
  }

  // 7. Gate: approval vs autonomy (honest, no runtime gate is changed).
  const autonomous = draft.autonomy === 'autonomous';
  checks.push({
    key: 'approval_gate',
    label: 'Approval requirement',
    status: autonomous && !draft.approvalRequired ? 'warning' : 'pass',
    note: autonomous && !draft.approvalRequired
      ? 'Autonomous autonomy without an approval requirement is higher-risk.'
      : draft.approvalRequired
        ? 'Approval is required before execution.'
        : 'Approval not required (read-only supervision).',
    kind: 'gate',
  });

  // 8. Execution test — always unavailable (no backend test-run exists).
  checks.push({
    key: 'execution_test',
    label: 'Test execution',
    status: 'warning',
    note: 'Actual test execution is not connected — this setup is validated by registry checks only.',
    kind: 'gate',
  });

  const blocking = checks.some((c) => c.status === 'fail');
  const ready = !blocking;
  const summary = blocking
    ? 'Blocked — resolve failed checks before this setup can be marked ready.'
    : 'All checks passed — ready for deployment (activation not connected).';

  return { checks, blocking, ready, summary };
}

/** The persisted validation-result string (never a fabricated "deployed"). */
export function resultSummary(summary: ValidationSummary): string {
  const failures = summary.checks.filter((c) => c.status === 'fail').length;
  const warnings = summary.checks.filter((c) => c.status === 'warning').length;
  if (summary.blocking) return `Failed (${failures} blocking).`;
  if (warnings > 0) return `Passed with ${warnings} warning${warnings === 1 ? '' : 's'}.`;
  return 'Passed.';
}

// --- Draft from an existing agent (continue setup) ----------------------------

function mapSetupStage(value: string | null): SetupStage {
  if (value && (SETUP_STAGES as string[]).includes(value)) return value as SetupStage;
  return 'identity';
}

/** Reopen an existing registry agent as a wizard draft (Continue setup). */
export function draftFromAgent(a: AiAgentRow): DeploymentDraft {
  return {
    agentId: a.id,
    templateKey: null,
    agentKey: a.agent_key,
    name: a.name,
    description: a.description ?? '',
    responsibility: a.responsibility ?? '',
    role: deriveRole(a),
    siteId: a.site_id,
    category: a.category ?? 'monitoring',
    parentAgentId: a.parent_agent_id,
    workflowId: a.workflow_id,
    runtimeReference: a.runtime_reference,
    autonomy: a.autonomy_level ?? 'observe_only',
    riskLevel: a.risk_level ?? 'low',
    approvalRequired: a.approval_required !== false,
    dataScope: a.data_scope ?? 'site',
    scheduleKey: null,
    setupStage: mapSetupStage(a.setup_stage),
    deploymentStatus: a.deployment_status === 'ready' ? 'ready' : 'draft',
    lastValidatedAt: a.last_validated_at,
    lastValidationResult: a.last_validation_result,
  };
}