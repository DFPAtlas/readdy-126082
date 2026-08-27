// ============================================================================
// AI Operations — Models & AI Providers derived-data layer.
//
// Pure projections over the central Agent Registry that transform the agent
// model configuration into per-model assignment rows. No agent record is
// duplicated — the assignment view is derived from the single source-of-truth
// agent registry, matching primary/fallback model names to registry models.
// ============================================================================

import type { AiModel, ModelAssignment, ModelRole } from '@/pages/ai-operations/types';
import { demoAgents } from '@/mocks/ai-operations-agents';

export function getModelAssignments(model: AiModel): ModelAssignment[] {
  const result: ModelAssignment[] = [];

  demoAgents.forEach((agent) => {
    const isPrimary = agent.model.primaryModel.toLowerCase() === model.name.toLowerCase();
    const isFallback = agent.model.fallbackModel.toLowerCase() === model.name.toLowerCase();
    if (!isPrimary && !isFallback) return;

    const role: ModelRole = isPrimary ? 'primary' : 'fallback';

    result.push({
      agentId: agent.id,
      agentName: agent.name,
      site: agent.scope,
      category: agent.category,
      role,
      status: agent.status,
    });
  });

  return result;
}

export function countAgentsUsingModels(models: AiModel[]): number {
  const assigned = new Set<string>();
  models.forEach((model) => {
    getModelAssignments(model).forEach((a) => assigned.add(a.agentId));
  });
  return assigned.size;
}