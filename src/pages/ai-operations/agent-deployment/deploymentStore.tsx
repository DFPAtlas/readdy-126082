// ============================================================================
// DFP AI Operations — Agent Deployment store (Prompt 03).
//
// A self-contained provider for the deployment subpage. Loads the authoritative
// registries (ai_sites, ai_operations_agents), the n8n workflow registry, and
// the runtime bridge nodes, then persists supported configuration through the
// existing authorised services (createAiAgent / updateAiAgent).
//
// Honesty guarantees:
//   * saveDraft writes REGISTRY metadata only — it never starts a workflow,
//     alters a runtime gate, or enables execution (status stays not_configured).
//   * Drafts are persisted to Supabase (never localStorage), so they reopen
//     correctly after a refresh.
//   * Validation results are invalidated by persisting on every step change.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import type { AiAgentRow, AiSiteRow, AiAgentUpsertInput } from '@/lib/ai-operations';
import { getAiSites, getAiAgents, createAiAgent, updateAiAgent } from '@/lib/ai-operations';
import { refreshN8nData, getN8nData, type N8nWorkflowRegistryRow } from '@/pages/ai-operations/wallboard/n8nStore';
import { refreshHistory, getRuntimeHealthState } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import type { AiRuntimeBridgeNode } from '@/lib/ai-operations/runtimeBridge';
import type { DeploymentDraft } from '@/pages/ai-operations/agent-deployment/types';

interface DeploymentContextValue {
  sites: AiSiteRow[];
  agents: AiAgentRow[];
  workflows: N8nWorkflowRegistryRow[];
  runtimes: AiRuntimeBridgeNode[];
  sitesAvailable: boolean;
  agentsAvailable: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveDraft: (draft: DeploymentDraft) => Promise<{ error: string | null; agentId: string | null }>;
  /** Owner/admin only — the registry write is also server-enforced by RLS. */
  canWrite: boolean;
}

const DeploymentContext = createContext<DeploymentContextValue | null>(null);

/** Map a draft to the persisted agent input (metadata only — never execution). */
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

export function DeploymentProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [sites, setSites] = useState<AiSiteRow[]>([]);
  const [agents, setAgents] = useState<AiAgentRow[]>([]);
  const [workflows, setWorkflows] = useState<N8nWorkflowRegistryRow[]>([]);
  const [runtimes, setRuntimes] = useState<AiRuntimeBridgeNode[]>([]);
  const [sitesAvailable, setSitesAvailable] = useState(true);
  const [agentsAvailable, setAgentsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    // n8n registry + runtime bridge nodes come from the existing shared stores.
    await Promise.all([refreshN8nData(), refreshHistory()]);

    const [sitesRes, agentsRes] = await Promise.all([getAiSites(), getAiAgents()]);

    setSitesAvailable(!sitesRes.error);
    setAgentsAvailable(!agentsRes.error);
    setSites((sitesRes.data ?? []).filter((s) => s.is_active !== false));
    setAgents((agentsRes.data ?? []).filter((a) => a.is_active !== false));
    setWorkflows(getN8nData().workflows);
    setRuntimes(getRuntimeHealthState().bridgeNodes);
    setError(agentsRes.error ?? null);
    setLoading(false);
  }, []);

  const saveDraft = useCallback(
    async (draft: DeploymentDraft): Promise<{ error: string | null; agentId: string | null }> => {
      const input = draftToInput(draft);
      if (draft.agentId) {
        const { error: writeError } = await updateAiAgent(draft.agentKey.trim(), input);
        if (writeError) return { error: writeError, agentId: draft.agentId };
        await refresh();
        return { error: null, agentId: draft.agentId };
      }
      const { data, error: writeError } = await createAiAgent(input);
      if (writeError) return { error: writeError, agentId: null };
      const agentId = data?.id ?? null;
      await refresh();
      return { error: null, agentId };
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<DeploymentContextValue>(
    () => ({
      sites,
      agents,
      workflows,
      runtimes,
      sitesAvailable,
      agentsAvailable,
      loading,
      error,
      refresh,
      saveDraft,
      canWrite: role === 'owner' || role === 'admin',
    }),
    [sites, agents, workflows, runtimes, sitesAvailable, agentsAvailable, loading, error, refresh, saveDraft, role],
  );

  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
}

export function useDeployment(): DeploymentContextValue {
  const ctx = useContext(DeploymentContext);
  if (!ctx) throw new Error('useDeployment must be used within a DeploymentProvider');
  return ctx;
}