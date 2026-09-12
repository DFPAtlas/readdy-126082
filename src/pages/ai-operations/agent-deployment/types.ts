// ============================================================================
// DFP AI Operations — Agent Deployment subpage (Prompt 03) — shared types.
//
// These describe the guided agent-deployment workflow and its persistence.
// Nothing here implies execution: a saved setup is a REGISTRY record only and
// never starts a workflow, alters a runtime gate, or enables execution.
// ============================================================================

import type { AiAgentRow, AiSiteRow } from '@/lib/ai-operations';
import type { N8nWorkflowRegistryRow } from '@/pages/ai-operations/wallboard/n8nStore';
import type { AiRuntimeBridgeNode } from '@/lib/ai-operations/runtimeBridge';

// --- Role / stage / status ----------------------------------------------------

export type DeploymentRole = 'site_manager' | 'sub_agent' | 'shared_agent';

export type SetupStage =
  | 'identity'
  | 'manager'
  | 'runtime'
  | 'permissions'
  | 'validate'
  | 'review';

// There is intentionally NO 'deployed' status — activation is not connected.
export type DeploymentStatus = 'draft' | 'ready';

export const SETUP_STAGES: SetupStage[] = [
  'identity',
  'manager',
  'runtime',
  'permissions',
  'validate',
  'review',
];

export const SETUP_STAGE_LABELS: Record<SetupStage, string> = {
  identity: 'Identity & Site',
  manager: 'Manager',
  runtime: 'Runtime & Workflow',
  permissions: 'Permissions & Schedule',
  validate: 'Validate',
  review: 'Review & Finish',
};

export const ROLE_LABELS: Record<DeploymentRole, string> = {
  site_manager: 'Site Manager',
  sub_agent: 'Sub-agent',
  shared_agent: 'Shared Agent',
};

export const ROLE_DESCRIPTIONS: Record<DeploymentRole, string> = {
  site_manager: 'Orchestrates the other agents on a single registered site.',
  sub_agent: 'A worker that reports to the site manager on the same site.',
  shared_agent: 'A group-wide agent with no site or manager assignment.',
};

// --- Template ------------------------------------------------------------------

export interface DeploymentTemplate {
  key: string;
  label: string;
  role: DeploymentRole;
  category: string;
  name: string;
  responsibility: string;
  description: string;
}

// --- Validation ----------------------------------------------------------------

export type CheckStatus = 'pass' | 'warning' | 'fail';
export type CheckKind =
  | 'required'
  | 'consistency'
  | 'connectivity'
  | 'mapping'
  | 'gate';

export interface ValidationCheck {
  key: string;
  label: string;
  status: CheckStatus;
  note: string;
  kind: CheckKind;
}

// --- Draft ---------------------------------------------------------------------

export interface DeploymentDraft {
  /** Existing ai_operations_agents.id UUID, or null for a brand-new agent. */
  agentId: string | null;
  templateKey: string | null;
  agentKey: string;
  name: string;
  description: string;
  responsibility: string;
  role: DeploymentRole;
  /** ai_sites.id UUID, or null for shared/group agents. */
  siteId: string | null;
  category: string;
  /** ai_operations_agents.id UUID of the parent manager (sub-agents only). */
  parentAgentId: string | null;
  /** ai_n8n_workflow_registry.id UUID of the mapped workflow. */
  workflowId: string | null;
  /** Runtime bridge node key (safe label only). */
  runtimeReference: string | null;
  autonomy: string;
  riskLevel: string;
  approvalRequired: boolean;
  dataScope: string;
  scheduleKey: string | null;
  setupStage: SetupStage;
  deploymentStatus: DeploymentStatus;
  lastValidatedAt: string | null;
  lastValidationResult: string | null;
}

// --- Wizard data (loaded once, shared across steps) ----------------------------

export interface DeploymentData {
  sites: AiSiteRow[];
  agents: AiAgentRow[];
  workflows: N8nWorkflowRegistryRow[];
  runtimes: AiRuntimeBridgeNode[];
  sitesAvailable: boolean;
  agentsAvailable: boolean;
}

// --- Step component props ------------------------------------------------------

export interface StepProps {
  draft: DeploymentDraft;
  patch: (p: Partial<DeploymentDraft>) => void;
  data: DeploymentData;
  checks: ValidationCheck[];
  canWrite: boolean;
}

export function newDraft(): DeploymentDraft {
  return {
    agentId: null,
    templateKey: null,
    agentKey: '',
    name: '',
    description: '',
    responsibility: '',
    role: 'sub_agent',
    siteId: null,
    category: 'monitoring',
    parentAgentId: null,
    workflowId: null,
    runtimeReference: null,
    autonomy: 'observe_only',
    riskLevel: 'low',
    approvalRequired: true,
    dataScope: 'site',
    scheduleKey: null,
    setupStage: 'identity',
    deploymentStatus: 'draft',
    lastValidatedAt: null,
    lastValidationResult: null,
  };
}