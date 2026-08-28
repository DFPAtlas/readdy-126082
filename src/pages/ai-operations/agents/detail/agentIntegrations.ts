// ============================================================================
// AI Operations — Agent Detail cross-module integration (Phase 2 Prompt 17).
//
// Resolves the live cross-module wiring for a single agent from the shared
// group live-data store (no independent Supabase queries, no UUIDs leak):
//   * Registered tool access   → ai_tool_agent_access + ai_tool_connections
//   * Registered model assignments → ai_agent_model_assignments +
//     ai_operations_models + ai_model_providers
//   * Registered knowledge access  → ai_knowledge_permissions + ai_knowledge_sources
//
// This is READ/AGGREGATION only. It never executes agents, tools, models,
// knowledge retrieval or any runtime. Each section reports an honest state:
//   live / empty / unavailable (and the caller handles demo mode separately).
// ============================================================================

import { useMemo } from 'react';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

export type IntegrationState = 'live' | 'empty' | 'unavailable';

export interface ResolvedToolAccess {
  connectionKey: string;
  name: string;
  category: string;
  provider: string;
  accessLevel: string;
  allowedOperations: string[];
  restrictedOperations: string[];
  approvalRequired: boolean;
  riskLimit: string;
  environment: string;
  isActive: boolean;
}

export interface ResolvedModelAssignment {
  modelKey: string;
  modelName: string;
  providerKey: string;
  providerName: string;
  assignmentType: string;
  hostingType: string;
  modelStatus: string;
  riskLevel: string;
  environment: string;
  isActive: boolean;
  fallbackEnabled: boolean;
}

export interface ResolvedKnowledgePermission {
  knowledgeKey: string;
  name: string;
  knowledgeType: string;
  scope: string;
  accessLevel: string;
  canRead: boolean;
  canRetrieve: boolean;
  canReference: boolean;
  approvalRequired: boolean;
  riskLimit: string;
  isActive: boolean;
}

export interface AgentIntegrations {
  loading: boolean;
  tools: { state: IntegrationState; items: ResolvedToolAccess[] };
  models: { state: IntegrationState; items: ResolvedModelAssignment[] };
  knowledge: { state: IntegrationState; items: ResolvedKnowledgePermission[] };
}

// Parse a JSONB array (or JSON string) into a string array. Safe — never throws.
function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asStringArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function titleCase(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyResult(): AgentIntegrations {
  return {
    loading: false,
    tools: { state: 'empty', items: [] },
    models: { state: 'empty', items: [] },
    knowledge: { state: 'empty', items: [] },
  };
}

/**
 * Resolve the live cross-module wiring for the given agent (by stable
 * `agent_key`). When `live` is false (explicit demo mode) this returns empty
 * results — the caller renders the demo dataset instead.
 */
export function useAgentIntegrations(agentKey: string, live: boolean): AgentIntegrations {
  const data = useGroupLiveData();

  return useMemo<AgentIntegrations>(() => {
    if (!live) return emptyResult();
    if (data.loading) {
      return { loading: true, tools: { state: 'empty', items: [] }, models: { state: 'empty', items: [] }, knowledge: { state: 'empty', items: [] } };
    }
    if (data.mode === 'unavailable') {
      return {
        loading: false,
        tools: { state: 'unavailable', items: [] },
        models: { state: 'unavailable', items: [] },
        knowledge: { state: 'unavailable', items: [] },
      };
    }

    const agentRow = data.agents.find((a) => a.agent_key === agentKey);
    if (!agentRow) return emptyResult();
    const agentUuid = agentRow.id;

    // --- Registered tool access ----------------------------------------------
    let toolsState: IntegrationState = 'live';
    if (!data.availability.toolAccess || !data.availability.tools) {
      toolsState = 'unavailable';
    }
    const connByUuid = new Map(data.tools.map((c) => [c.id, c]));
    const toolItems: ResolvedToolAccess[] = data.toolAccess
      .filter((a) => a.agent_id === agentUuid)
      .map((a) => {
        const conn = connByUuid.get(a.connection_id);
        return {
          connectionKey: conn?.connection_key ?? '',
          name: conn?.name ?? 'Unknown connection',
          category: conn?.category ?? '—',
          provider: conn?.provider ?? '—',
          accessLevel: titleCase(a.access_level),
          allowedOperations: asStringArray(a.allowed_operations),
          restrictedOperations: asStringArray(a.restricted_operations),
          approvalRequired: a.approval_required,
          riskLimit: titleCase(a.risk_limit),
          environment: a.environment ?? '—',
          isActive: a.is_active !== false,
        };
      });
    if (toolsState !== 'unavailable' && toolItems.length === 0) toolsState = 'empty';

    // --- Registered model assignments ----------------------------------------
    let modelsState: IntegrationState = 'live';
    if (!data.availability.modelAssignments || !data.availability.models || !data.availability.providers) {
      modelsState = 'unavailable';
    }
    const modelByUuid = new Map(data.models.map((m) => [m.id, m]));
    const providerByUuid = new Map(data.providers.map((p) => [p.id, p]));
    const modelItems: ResolvedModelAssignment[] = data.modelAssignments
      .filter((a) => a.agent_id === agentUuid)
      .map((a) => {
        const model = modelByUuid.get(a.model_id);
        const provider = model ? providerByUuid.get(model.provider_id) : undefined;
        return {
          modelKey: model?.model_key ?? '',
          modelName: model?.name ?? (model?.display_name ?? 'Unknown model'),
          providerKey: provider?.provider_key ?? '',
          providerName: provider?.name ?? '—',
          assignmentType: a.assignment_type ?? '—',
          hostingType: titleCase(model?.hosting_type),
          modelStatus: titleCase(model?.status),
          riskLevel: titleCase(model?.risk_level ?? a.allowed_risk_level),
          environment: a.environment ?? '—',
          isActive: a.is_active !== false,
          fallbackEnabled: a.fallback_enabled,
        };
      });
    if (modelsState !== 'unavailable' && modelItems.length === 0) modelsState = 'empty';

    // --- Registered knowledge access -----------------------------------------
    let knowledgeState: IntegrationState = 'live';
    if (!data.availability.knowledgePermissions || !data.availability.knowledge) {
      knowledgeState = 'unavailable';
    }
    const sourceByUuid = new Map(data.knowledge.map((s) => [s.id, s]));
    const knowledgeItems: ResolvedKnowledgePermission[] = data.knowledgePermissions
      .filter((p) => p.agent_id === agentUuid)
      .map((p) => {
        const source = sourceByUuid.get(p.knowledge_source_id);
        return {
          knowledgeKey: source?.knowledge_key ?? '',
          name: source?.name ?? 'Unknown source',
          knowledgeType: titleCase(source?.knowledge_type),
          scope: titleCase(source?.scope),
          accessLevel: titleCase(p.access_level),
          canRead: p.can_read,
          canRetrieve: p.can_retrieve,
          canReference: p.can_reference,
          approvalRequired: p.approval_required,
          riskLimit: titleCase(p.risk_limit),
          isActive: p.is_active !== false,
        };
      });
    if (knowledgeState !== 'unavailable' && knowledgeItems.length === 0) knowledgeState = 'empty';

    return {
      loading: false,
      tools: { state: toolsState, items: toolItems },
      models: { state: modelsState, items: modelItems },
      knowledge: { state: knowledgeState, items: knowledgeItems },
    };
  }, [agentKey, live, data]);
}