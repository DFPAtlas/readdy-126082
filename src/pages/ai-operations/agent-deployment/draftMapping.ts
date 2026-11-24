import type { DeploymentDraft } from './types';
import type { AiAgentUpsertInput } from '@/lib/ai-operations';

export function draftToInput(draft: DeploymentDraft): AiAgentUpsertInput {
  return {
    agent_key: draft.agentKey.trim(),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    agent_type: draft.role === 'shared_agent' ? 'core' : 'site_specific',
    category: draft.category || 'other',
    site_id: draft.role === 'shared_agent' ? null : draft.siteId,
    environment: 'production',
    status: 'not_configured',
    health: 'unknown',
    risk_level: draft.riskLevel,
    autonomy_level: draft.autonomy,
    approval_required: draft.approvalRequired,
    data_scope: draft.dataScope || null,
    parent_agent_id: draft.parentAgentId,
    workflow_id: draft.workflowId,
    runtime_reference: draft.runtimeReference,
    responsibility: draft.responsibility.trim() || null,
    setup_stage: draft.setupStage,
    deployment_status: draft.deploymentStatus,
    last_validated_at: draft.lastValidatedAt,
    last_validation_result: draft.lastValidationResult,
  };
}
