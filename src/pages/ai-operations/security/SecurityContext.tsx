import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiSecurityPolicy, PolicyEvaluation } from '@/pages/ai-operations/types';
import { demoPolicies } from '@/mocks/ai-operations-security';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import {
  getAiSites,
  getAiAgents,
  getAiSecurityPolicies,
  createAiSecurityPolicy,
  updateAiSecurityPolicy,
  createAiPolicyEvaluation,
  createAiAuditEvent,
} from '@/lib/ai-operations';
import { mapPolicyRowToRecord, mapRecordToPolicyInput, type PolicyResolutionContext } from '@/pages/ai-operations/security/policyMapper';
import { evaluateRequest, type PolicyEvaluateInput } from '@/pages/ai-operations/security/selectors';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Security & Policy Engine. Mirrors the proven
// Sites/Agents/Runs/Approvals/Audit pattern so the page never pretends demo
// data is live:
//   * live  — Supabase ai_security_policies rows loaded successfully.
//   * demo  — the existing mock policy registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type SecurityDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

export interface SecuritySiteOption {
  key: string;
  name: string;
}
export interface SecurityAgentOption {
  key: string;
  name: string;
}

interface SecurityContextValue {
  policies: AiSecurityPolicy[];
  mode: SecurityDataSourceMode;
  loading: boolean;
  error: string | null;
  /** Live site options for the Add/Edit form (resolved from ai_sites). */
  sites: SecuritySiteOption[];
  /** Live agent options for the evaluator (resolved from ai_operations_agents). */
  agents: SecurityAgentOption[];
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getPolicy: (policyKey: string) => AiSecurityPolicy | undefined;
  /** Create a live policy (inserts ai_security_policies + audit event; never executes). */
  createPolicy: (record: AiSecurityPolicy, actor: string) => Promise<SaveResult>;
  /** Update a live policy (updates ai_security_policies + audit event; never executes). */
  updatePolicy: (id: string, record: AiSecurityPolicy, actor: string) => Promise<SaveResult>;
  /** Deterministic governance simulation against the active policy set. */
  simulate: (input: PolicyEvaluateInput) => PolicyEvaluation;
  /** Persist a simulated evaluation as governance evidence (never executes). */
  saveEvaluation: (input: PolicyEvaluateInput, result: PolicyEvaluation, actor: string) => Promise<SaveResult>;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

// Demo lookup keyed by stable id (= policy_key) so live rows can merge their
// "Demo Supporting Metadata" (target arrays, structured conditions, decision
// explanation, exceptions, history, enforcement stage) where no production
// table exists yet.
const demoPolicyById = new Map((demoPolicies as AiSecurityPolicy[]).map((p) => [p.id, p]));

const demoSiteOptions: SecuritySiteOption[] = demoSites.map((s) => ({ key: s.id, name: s.name }));
const demoAgentOptions: SecurityAgentOption[] = demoAgents.map((a) => ({ key: a.id, name: a.name }));

// Map a risk class to a conservative audit severity.
function riskToSeverity(risk: string | null | undefined): string {
  if (risk === 'red') return 'high';
  if (risk === 'amber') return 'medium';
  return 'low';
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [policies, setPolicies] = useState<AiSecurityPolicy[]>([]);
  const [mode, setMode] = useState<SecurityDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<SecuritySiteOption[]>([]);
  const [agents, setAgents] = useState<SecurityAgentOption[]>([]);

  // Mutable resolution maps, rebuilt on each refresh (kept in a ref to avoid
  // re-renders).
  const mapsRef = useRef({
    siteUuidByKey: new Map<string, string>(),
    agentUuidByKey: new Map<string, string>(),
    policyUuidByKey: new Map<string, string>(),
    ctx: null as PolicyResolutionContext | null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, policiesRes] = await Promise.all([
      getAiSites(),
      getAiAgents(),
      getAiSecurityPolicies(),
    ]);

    // Site maps (TEST/SANDBOX excluded).
    const siteRows = (sitesRes.data ?? []).filter((r) => r.is_active !== false);
    const siteKeyById = new Map<string, string>();
    const siteNameById = new Map<string, string>();
    const siteUuidByKey = new Map<string, string>();
    for (const row of siteRows) {
      siteKeyById.set(row.id, row.site_key);
      siteNameById.set(row.id, row.name);
      siteUuidByKey.set(row.site_key, row.id);
    }

    // Agent maps (TEST/SANDBOX excluded).
    const agentRows = (agentsRes.data ?? []).filter((r) => r.is_active !== false);
    const agentUuidByKey = new Map<string, string>();
    for (const row of agentRows) {
      agentUuidByKey.set(row.agent_key, row.id);
    }

    const ctx: PolicyResolutionContext = { siteKeyById, siteNameById };
    mapsRef.current = { siteUuidByKey, agentUuidByKey, policyUuidByKey: new Map(), ctx };

    // Form/evaluator dropdowns (live).
    setSites(siteRows.map((r) => ({ key: r.site_key, name: r.name })));
    setAgents(agentRows.map((r) => ({ key: r.agent_key, name: r.name })));

    if (policiesRes.error) {
      setMode('error');
      setError(policiesRes.error);
      setPolicies([]);
      setLoading(false);
      return;
    }

    const rows = (policiesRes.data ?? []).filter((r) => r.is_active !== false);
    // Policy-key → UUID map for evaluation persistence.
    const policyUuidByKey = new Map<string, string>();
    for (const row of rows) policyUuidByKey.set(row.policy_key, row.id);
    mapsRef.current.policyUuidByKey = policyUuidByKey;

    const mapped = rows.map((r) => mapPolicyRowToRecord(r, demoPolicyById.get(r.policy_key), ctx));
    setPolicies(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setPolicies(demoPolicies as AiSecurityPolicy[]);
    setSites(demoSiteOptions);
    setAgents(demoAgentOptions);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createPolicy = useCallback(
    async (record: AiSecurityPolicy, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: never write demo records to Supabase.
        setPolicies((prev) => [record, ...prev]);
        return { error: null };
      }
      const siteUuid = record.siteId && record.siteId !== 'group'
        ? (mapsRef.current.siteUuidByKey.get(record.siteId) ?? null)
        : null;
      const { error: writeError } = await createAiSecurityPolicy(mapRecordToPolicyInput(record, siteUuid));
      if (writeError) return { error: writeError };

      // Audit the successful create (metadata only — never executes).
      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'policy_created',
        action: 'Create policy',
        outcome: 'success',
        severity: riskToSeverity(record.riskClass),
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'security',
        risk_level: record.riskClass,
        environment: record.environment,
        before_summary: 'Policy did not exist.',
        after_summary: `Policy created: ${record.name} (${record.id}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Policy creation recorded — runtime enforcement is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updatePolicy = useCallback(
    async (id: string, record: AiSecurityPolicy, actor: string): Promise<SaveResult> => {
      const previous = policies.find((p) => p.id === id);
      if (mode !== 'live') {
        // Demo/local-only edit.
        setPolicies((prev) =>
          prev.map((p) => (p.id === id ? { ...record, updatedAt: 'Just now' } : p)),
        );
        return { error: null };
      }
      const siteUuid = record.siteId && record.siteId !== 'group'
        ? (mapsRef.current.siteUuidByKey.get(record.siteId) ?? null)
        : null;
      const { error: writeError } = await updateAiSecurityPolicy(id, mapRecordToPolicyInput(record, siteUuid));
      if (writeError) return { error: writeError };

      // Audit the successful update (metadata only — never executes).
      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'policy_updated',
        action: 'Update policy',
        outcome: 'success',
        severity: riskToSeverity(record.riskClass),
        site_id: siteUuid,
        agent_id: null,
        run_id: null,
        approval_id: null,
        actor_type: 'human',
        actor_reference: actor,
        trigger_source: 'security',
        risk_level: record.riskClass,
        environment: record.environment,
        before_summary: previous ? `Policy was: ${previous.name} (effect ${previous.effect}).` : 'Unknown prior state.',
        after_summary: `Policy updated: ${record.name} (effect ${record.effect}).`,
        decision_reason: null,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Policy update recorded — runtime enforcement is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, policies, refresh],
  );

  // Deterministic governance simulation against the active policy set. In demo
  // mode this runs against demo policies; in live mode against live policies.
  const simulate = useCallback(
    (input: PolicyEvaluateInput): PolicyEvaluation =>
      evaluateRequest(mode === 'live' ? policies : (demoPolicies as AiSecurityPolicy[]), input),
    [mode, policies],
  );

  // Persist a simulated evaluation as append-only governance evidence.
  const saveEvaluation = useCallback(
    async (input: PolicyEvaluateInput, result: PolicyEvaluation, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') return { error: null };

      const primaryKey = result.blockingPolicies[0] ?? result.matchedPolicies[0] ?? null;
      const policyId = primaryKey ? (mapsRef.current.policyUuidByKey.get(primaryKey) ?? null) : null;
      const siteId = input.siteKey && input.siteKey !== 'group'
        ? (mapsRef.current.siteUuidByKey.get(input.siteKey) ?? null)
        : null;
      const agentId = input.agentKey ? (mapsRef.current.agentUuidByKey.get(input.agentKey) ?? null) : null;

      const { error: writeError } = await createAiPolicyEvaluation({
        evaluation_key: `EVL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        policy_id: policyId,
        site_id: siteId,
        agent_id: agentId,
        run_id: null,
        approval_id: null,
        subject_type: 'action',
        subject_reference: input.action,
        requested_action: input.action,
        requested_risk: input.risk,
        environment: input.environment,
        result: result.result,
        effect: result.result,
        matched: result.matchedPolicies.length > 0,
        approval_required: result.approvalRequired,
        reason: `Matched policies: ${result.matchedPolicies.join(', ') || 'none'}.`,
        condition_summary: result.requiredControls.join('; '),
        correlation_id: null,
        actor_type: 'human',
        actor_reference: actor,
      });
      if (writeError) return { error: writeError };
      return { error: null };
    },
    [mode],
  );

  const getPolicy = useCallback(
    (policyKey: string) => policies.find((p) => p.id === policyKey),
    [policies],
  );

  // Load live policies (and site/agent maps) on first mount. A failure surfaces
  // as `error` mode and never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SecurityContextValue>(
    () => ({
      policies,
      mode,
      loading,
      error,
      sites,
      agents,
      refresh,
      loadDemo,
      getPolicy,
      createPolicy,
      updatePolicy,
      simulate,
      saveEvaluation,
    }),
    [policies, mode, loading, error, sites, agents, refresh, loadDemo, getPolicy, createPolicy, updatePolicy, simulate, saveEvaluation],
  );

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within a SecurityProvider');
  return ctx;
}