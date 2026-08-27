// ============================================================================
// AI Operations — Knowledge & Memory derived-data layer.
//
// Pure projections over the central Knowledge & Memory Registry. Agent access
// is derived from the source's agentAccess list (no agent record is
// duplicated), and orchestrator "required knowledge" is derived from the
// orchestration's site assignment. No retrieval occurs.
// ============================================================================

import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { demoKnowledgeSourcesA } from '@/mocks/ai-operations-knowledge';
import { demoKnowledgeSourcesB } from '@/mocks/ai-operations-knowledge-2';

const ALL: KnowledgeSource[] = [...demoKnowledgeSourcesA, ...demoKnowledgeSourcesB];

export function getAllKnowledgeSources(): KnowledgeSource[] {
  return ALL;
}

export function getKnowledgeForAgent(agentId: string): KnowledgeSource[] {
  return ALL.filter(
    (s) => s.assignedAgentIds.includes(agentId) || s.agentAccess.some((a) => a.agentId === agentId),
  );
}

export function countAgentsWithKnowledgeAccess(): number {
  const ids = new Set<string>();
  ALL.forEach((s) => s.agentAccess.forEach((a) => ids.add(a.agentId)));
  return ids.size;
}

export function getKnowledgeForOrchestration(siteId: string): KnowledgeSource[] {
  if (siteId === 'group') {
    return ALL.filter((s) => s.scope === 'group' && s.status !== 'archived').slice(0, 4);
  }
  const site = ALL.filter((s) => s.siteId === siteId && s.status !== 'archived').slice(0, 3);
  const governance = ALL.filter((s) => s.scope === 'group' && ['KNOW-GOV', 'KNOW-APPROVAL'].includes(s.id));
  return [...site, ...governance];
}