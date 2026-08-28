import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { demoOrchestrations } from '@/mocks/ai-operations-orchestrator';
import {
  getAiOrchestrations,
  getAiSites,
  getAiAgents,
  getAiRuns,
  getAiApprovals,
  getAllAiOrchestrationDecisions,
  createAiOrchestration,
  createAiOrchestrationCandidate,
  createAiOrchestrationStep,
  appendAiOrchestrationDecision,
  createAiAuditEvent,
  type AiOrchestrationDecisionRow,
} from '@/lib/ai-operations';
import {
  mapOrchestrationRowToRecord,
  mapDecisionRowToTimeline,
  type OrchestratorResolutionContext,
  type OrchestrationDecisionTimeline,
} from '@/pages/ai-operations/orchestrator/orchestratorMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

export type OrchestratorDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Safe metadata input for creating an orchestration request. Saving NEVER
// creates a run, executes an agent, calls a tool/model, or triggers n8n.
// `execution_allowed` remains false.
export interface SimulationCandidateInput {
  agentKey: string;
  rank: number;
  score: number;
  eligible: boolean;
  rejectionReason?: string | null;
  selectionReason?: string | null;
}

export interface OrchestrationRequestInput {
  title: string;
  description?: string | null;
  source: string;
  site?: string | null;
  taskType?: string | null;
  environment: string;
  priority: string;
  risk: string;
  recommendedAgentId?: string | null;
  recommendedAgentName?: string | null;
  approvalRequired?: boolean;
  /** Planning-only policy result label (deny/restrict/require_approval/…). */
  policyResult?: string | null;
  /** Planning-only candidate scoring rows (registry eligibility, not runtime). */
  candidates?: SimulationCandidateInput[];
  /** Planning-only proposed workflow steps. */
  workflowSteps?: string[];
  /** Planning-only requirement checks for the selected agent. */
  checks?: { toolReady: boolean; modelReady: boolean; knowledgeReady: boolean };
}

interface OrchestratorContextValue {
  orchestrations: AiOrchestration[];
  mode: OrchestratorDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getOrchestration: (id: string) => AiOrchestration | undefined;
  /** Append-oriented live routing-decision timeline for an orchestration (by
      stable orchestration_key). */
  getDecisions: (orchestrationKey: string) => OrchestrationDecisionTimeline[];
  /** Persist a new orchestration request + plan (status 'received',
      execution_allowed false). No run/agent/tool/model/n8n execution. Appends
      routing decisions, candidate records, planned steps and an audit event. */
  saveRequest: (input: OrchestrationRequestInput) => Promise<SaveResult>;
}

const OrchestratorContext = createContext<OrchestratorContextValue | null>(null);

const demoByKey = new Map<string, AiOrchestration>(
  (demoOrchestrations as AiOrchestration[]).map((o) => [o.id, o]),
);

export function OrchestratorProvider({ children }: { children: ReactNode }) {
  const [orchestrations, setOrchestrations] = useState<AiOrchestration[]>([]);
  const [mode, setMode] = useState<OrchestratorDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<OrchestratorResolutionContext>({
    siteKeyById: new Map(),
    siteNameById: new Map(),
    agentKeyById: new Map(),
    agentNameById: new Map(),
    runKeyById: new Map(),
    approvalKeyById: new Map(),
  });
  const siteUuidByKey = useRef<Map<string, string>>(new Map());
  const agentUuidByKey = useRef<Map<string, string>>(new Map());
  const orchUuidByKey = useRef<Map<string, string>>(new Map());
  const decisionsByUuid = useRef<Map<string, AiOrchestrationDecisionRow[]>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    const [orchRes, sitesRes, agentsRes, runsRes, approvalsRes, decisionsRes] = await Promise.all([
      getAiOrchestrations(),
      getAiSites(),
      getAiAgents(),
      getAiRuns(),
      getAiApprovals(),
      getAllAiOrchestrationDecisions(),
    ]);

    if (orchRes.error) {
      setMode('error');
      setError(orchRes.error);
      setOrchestrations([]);
      setLoading(false);
      return;
    }

    const rows = orchRes.data ?? [];

    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    const siteUuidMap = new Map<string, string>();
    for (const r of sitesRes.data ?? []) {
      siteKeyById.set(r.id, r.site_key);
      siteNameById.set(r.id, r.name);
      siteUuidMap.set(r.site_key, r.id);
    }

    const agentKeyById = new Map<string, string>();
    const agentNameById = new Map<string, string>();
    const agentUuidMap = new Map<string, string>();
    for (const r of agentsRes.data ?? []) {
      agentKeyById.set(r.id, r.agent_key);
      agentNameById.set(r.id, r.name);
      agentUuidMap.set(r.agent_key, r.id);
    }

    const runKeyById = new Map<string, string>();
    for (const r of runsRes.data ?? []) runKeyById.set(r.id, r.run_key);
    const approvalKeyById = new Map<string, string>();
    for (const r of approvalsRes.data ?? []) approvalKeyById.set(r.id, r.approval_key);

    const ctx: OrchestratorResolutionContext = {
      siteKeyById,
      siteNameById,
      agentKeyById,
      agentNameById,
      runKeyById,
      approvalKeyById,
    };
    ctxRef.current = ctx;
    siteUuidByKey.current = siteUuidMap;
    agentUuidByKey.current = agentUuidMap;

    const orchUuidMap = new Map<string, string>();
    for (const r of rows) orchUuidMap.set(r.orchestration_key, r.id);
    orchUuidByKey.current = orchUuidMap;

    const decisionsMap = new Map<string, AiOrchestrationDecisionRow[]>();
    for (const r of decisionsRes.data ?? []) {
      const list = decisionsMap.get(r.orchestration_id) ?? [];
      list.push(r);
      decisionsMap.set(r.orchestration_id, list);
    }
    decisionsByUuid.current = decisionsMap;

    const mapped = rows.map((r) =>
      mapOrchestrationRowToRecord(r, ctx, demoByKey.get(r.orchestration_key)),
    );

    setOrchestrations(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setOrchestrations([...demoOrchestrations] as AiOrchestration[]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const getOrchestration = useCallback(
    (id: string) => orchestrations.find((o) => o.id === id),
    [orchestrations],
  );

  const getDecisions = useCallback((orchestrationKey: string): OrchestrationDecisionTimeline[] => {
    const uuid = orchUuidByKey.current.get(orchestrationKey);
    if (!uuid) return [];
    return (decisionsByUuid.current.get(uuid) ?? []).map(mapDecisionRowToTimeline);
  }, []);

  // Persist a new orchestration request + plan — metadata only. No run/agent/
  // tool/model/n8n execution. `execution_allowed` stays false.
  const saveRequest = useCallback(
    async (input: OrchestrationRequestInput): Promise<SaveResult> => {
      if (mode !== 'live') return { error: 'Creating orchestration requests requires live data.' };

      const siteUuid = input.site && input.site !== 'group'
        ? (siteUuidByKey.current.get(input.site) ?? null)
        : null;
      const agentUuid = input.recommendedAgentId
        ? (agentUuidByKey.current.get(input.recommendedAgentId) ?? null)
        : null;
      const now = new Date().toISOString();
      const key = `ORC-${Date.now().toString().slice(-6)}`;

      const { data: created, error: writeError } = await createAiOrchestration({
        orchestration_key: key,
        title: input.title,
        description: input.description,
        request_type: input.taskType ?? 'other',
        request_source: input.source,
        requested_action: input.taskType ?? 'Other',
        site_id: siteUuid,
        environment: input.environment,
        priority: input.priority,
        risk_level: input.risk,
        status: 'received',
        classification: input.taskType ?? 'Other',
        selected_agent_id: agentUuid,
        policy_result: input.policyResult ?? 'pending',
        permission_result: 'pending',
        approval_required: input.approvalRequired ?? false,
        verification_required: false,
        uat_required: false,
        audit_required: false,
        execution_allowed: false,
        requested_by: 'Operator',
        result_summary: 'Orchestration request saved — execution runtime is not connected.',
        is_active: true,
        notes: 'Planning metadata only — no execution occurred.',
      });
      if (writeError) return { error: writeError };
      if (!created) return { error: 'Unable to persist the orchestration request.' };

      const appendDecision = async (
        decisionType: string,
        decision: string,
        reason: string,
      ): Promise<void> => {
        await appendAiOrchestrationDecision({
          orchestration_id: created.id,
          decision_type: decisionType,
          decision,
          reason,
          actor_type: 'human',
          actor_reference: 'Operator',
        });
      };

      // Append-oriented routing/governance decisions (never edited/deleted).
      await appendDecision('request_classified', input.taskType ?? 'Other', input.description ?? input.title);
      await appendDecision(
        'site_resolved',
        input.site && input.site !== 'group' ? input.site : 'Group-wide',
        'Site scope resolved during planning.',
      );
      if (input.recommendedAgentId) {
        await appendDecision('agent_selected', input.recommendedAgentId, 'Highest-scoring eligible candidate (registry eligibility).');
      }
      if (input.policyResult) {
        await appendDecision('policy_checked', input.policyResult, 'Applicable policy result at planning level.');
      }
      if (input.checks) {
        await appendDecision(
          'tool_requirement_checked',
          input.checks.toolReady ? 'Tool access registered' : 'BLOCKED — Tool access not registered',
          'Required tool access evaluated from live registry.',
        );
        await appendDecision(
          'model_requirement_checked',
          input.checks.modelReady ? 'Model assignment registered' : 'BLOCKED — Model assignment missing',
          'Required model assignment evaluated from live registry.',
        );
        await appendDecision(
          'knowledge_requirement_checked',
          input.checks.knowledgeReady ? 'Knowledge access registered' : 'BLOCKED — Knowledge access missing',
          'Required knowledge permission evaluated from live registry.',
        );
      }
      if (input.approvalRequired) {
        await appendDecision('approval_required', 'Approval required', 'Policy/risk indicates human approval is required (planning only).');
      }

      // Persist candidate scoring rows (registry eligibility, not runtime).
      if (input.candidates && input.candidates.length > 0) {
        for (const c of input.candidates) {
          const cUuid = agentUuidByKey.current.get(c.agentKey);
          if (!cUuid) continue;
          await createAiOrchestrationCandidate({
            orchestration_id: created.id,
            agent_id: cUuid,
            rank: c.rank,
            score: c.score,
            capability_score: c.score,
            eligible: c.eligible,
            rejection_reason: c.rejectionReason ?? null,
            selection_reason: c.selectionReason ?? null,
          });
        }
      }

      // Persist planned workflow steps (no run created).
      if (input.workflowSteps && input.workflowSteps.length > 0) {
        for (let i = 0; i < input.workflowSteps.length; i += 1) {
          await createAiOrchestrationStep({
            orchestration_id: created.id,
            step_number: i + 1,
            name: input.workflowSteps[i],
            step_type: 'plan',
            agent_id: agentUuid,
            status: 'pending',
            risk_level: input.risk,
            approval_required: input.approvalRequired ?? false,
          });
        }
      }

      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: now,
        event_type: 'orchestration_created',
        action: 'Create orchestration request',
        outcome: 'success',
        severity: 'low',
        site_id: siteUuid,
        agent_id: agentUuid,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: 'Operator',
        trigger_source: 'orchestrator',
        risk_level: input.risk,
        environment: input.environment,
        before_summary: 'No prior orchestration.',
        after_summary: `Orchestration request ${key} created (planning only).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Planning metadata only — no execution occurred.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<OrchestratorContextValue>(
    () => ({
      orchestrations,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      getOrchestration,
      getDecisions,
      saveRequest,
    }),
    [orchestrations, mode, loading, error, refresh, loadDemo, getOrchestration, getDecisions, saveRequest],
  );

  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>;
}

export function useOrchestrator(): OrchestratorContextValue {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) throw new Error('useOrchestrator must be used within OrchestratorProvider');
  return ctx;
}