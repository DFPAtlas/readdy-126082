import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiApproval, ApprovalDecisionType, ApprovalStatus, ApprovalHistoryEvent } from '@/pages/ai-operations/types';
import { APPROVAL_STATUS } from '@/pages/ai-operations/constants';
import { demoApprovals } from '@/mocks/ai-operations-approvals';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoRuns } from '@/mocks/ai-operations-runs';
import {
  getAiSites,
  getAiAgents,
  getAiRuns,
  getAiApprovals,
  createAiApproval,
  updateAiApproval,
  recordAiApprovalDecision,
  appendAiApprovalHistory,
  createAiAuditEvent,
  getAllAiApprovalHistory,
  type AiApprovalUpsertInput,
  type AiApprovalHistoryRow,
} from '@/lib/ai-operations';
import {
  mapApprovalRowToRecord,
  type ApprovalResolutionContext,
} from '@/pages/ai-operations/approvals/approvalMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Human Approvals & Governance module. Mirrors the
// proven Sites/Agents/Runs pattern so the page never pretends demo data is live:
//   * live  — Supabase ai_approvals rows loaded successfully.
//   * demo  — the existing mock approval registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type ApprovalsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// Lightweight options for the Create/Edit Approval form (stable keys + names).
export interface ApprovalSiteOption {
  key: string;
  name: string;
}
export interface ApprovalAgentOption {
  key: string;
  name: string;
  assignedSite: string | null;
}
export interface ApprovalRunOption {
  key: string;
}

// Decision payload passed from the detail page (actor is the authenticated
// staff identity — never an invented personal name).
export interface ApprovalDecisionPayload {
  type: ApprovalDecisionType;
  reason: string;
  conditions: string;
  actor: string;
  actorRole?: string;
}

interface ApprovalsContextValue {
  approvals: AiApproval[];
  mode: ApprovalsDataSourceMode;
  loading: boolean;
  error: string | null;
  sites: ApprovalSiteOption[];
  agents: ApprovalAgentOption[];
  runs: ApprovalRunOption[];
  refresh: () => Promise<void>;
  loadDemo: () => void;
  getApproval: (approvalKey: string) => AiApproval | undefined;
  /** Create a new approval (live inserts ai_approvals; never executes anything). */
  createApproval: (record: AiApproval) => Promise<SaveResult>;
  /** Update safe approval metadata (live updates ai_approvals). */
  updateApproval: (record: AiApproval) => Promise<SaveResult>;
  /** Record a governance decision — metadata only, never executes a run. */
  recordDecision: (approvalKey: string, payload: ApprovalDecisionPayload) => Promise<SaveResult>;
}

const ApprovalsContext = createContext<ApprovalsContextValue | null>(null);

// Demo lookup keyed by stable id (= approval_key) so live rows can merge their
// supporting metadata (evidence, impact, rollback, separation, history, gate).
const demoApprovalById = new Map((demoApprovals as AiApproval[]).map((a) => [a.id, a]));

// Demo form options (used only in explicit demo mode).
const demoSiteOptions: ApprovalSiteOption[] = demoSites.map((s) => ({ key: s.id, name: s.name }));
const demoAgentOptions: ApprovalAgentOption[] = demoAgents.map((a) => ({
  key: a.id,
  name: a.name,
  assignedSite: a.assignedSite ?? null,
}));
const demoRunOptions: ApprovalRunOption[] = (demoRuns as { id: string }[]).map((r) => ({ key: r.id }));

// Map a frontend AiApproval record to the DB upsert shape, resolving site/agent/
// run keys to their live UUIDs (or null for group/unresolved). No secrets.
function recordToUpsertInput(
  record: AiApproval,
  siteUuidByKey: Map<string, string>,
  agentUuidByKey: Map<string, string>,
  runUuidByKey: Map<string, string>,
): AiApprovalUpsertInput {
  return {
    approval_key: record.id,
    title: record.title,
    description: record.description,
    site_id: record.siteId && record.siteId !== 'group' ? (siteUuidByKey.get(record.siteId) ?? null) : null,
    agent_id: record.agentId ? (agentUuidByKey.get(record.agentId) ?? null) : null,
    run_id: record.runId ? (runUuidByKey.get(record.runId) ?? null) : null,
    requested_action: record.requestedAction,
    request_type: record.requestType,
    risk_class: record.riskClass,
    severity: record.severity,
    environment: record.environment,
    status: record.status,
    requested_by: record.requestedBy,
    required_team: record.approvalTeam,
    minimum_approvers: record.minApprovers,
    current_approval_count: record.approvalCount,
    business_justification: record.businessJustification,
    reasoning_summary: record.aiReasoning,
    expected_result: record.expectedResult,
    potential_impact: record.potentialImpact,
    rollback_available: record.rollbackAvailable,
    rollback_summary: record.rollbackSummary,
    verification_required: record.verificationRequired,
    uat_required: record.uatRequired,
    audit_required: record.auditRequired,
    decision: record.decision.type,
    decision_reason: record.decision.reason,
    decision_actor: record.decision.actor,
    conditions: record.decision.conditions ? [record.decision.conditions] : null,
    notes: record.notes,
  };
}

// Deterministic status/count transition for a decision. Approve only reaches
// final approved state once the required approver count is satisfied; this is
// metadata-only and never triggers execution.
function resolveDecisionStatus(
  approval: AiApproval,
  type: ApprovalDecisionType,
): { status: ApprovalStatus; count: number } {
  const newCount = approval.approvalCount + 1;
  let status: ApprovalStatus;
  if (type === 'approve') {
    status = approval.minApprovers > 1 && newCount < approval.minApprovers ? 'under_review' : 'approved';
  } else if (type === 'approve_with_conditions') {
    status = 'approved_with_conditions';
  } else if (type === 'reject') {
    status = 'rejected';
  } else if (type === 'request_changes' || type === 'request_more_information') {
    status = 'more_info_required';
  } else {
    status = 'cancelled';
  }
  return { status, count: type === 'approve' ? newCount : approval.approvalCount };
}

function decisionActionLabel(type: ApprovalDecisionType): string {
  switch (type) {
    case 'approve': return 'Approved';
    case 'approve_with_conditions': return 'Approved with conditions';
    case 'reject': return 'Rejected';
    case 'request_changes': return 'Request changes';
    case 'request_more_information': return 'More information requested';
    case 'cancel': return 'Cancelled';
    default: return 'Decision recorded';
  }
}

// Map a decision type to a safe audit outcome (metadata only, never execution).
function decisionOutcome(type: ApprovalDecisionType): string {
  if (type === 'approve' || type === 'approve_with_conditions') return 'approved';
  if (type === 'reject') return 'rejected';
  if (type === 'request_changes' || type === 'request_more_information') return 'warning';
  return 'informational';
}

// Map a risk class to a conservative audit severity.
function riskToSeverity(risk: string | null | undefined): string {
  if (risk === 'red') return 'high';
  if (risk === 'amber') return 'medium';
  return 'low';
}

function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} · ${hh}:${mm}`;
}

// Convert a live ai_approval_history row to the frontend history event shape.
// The `migration_baseline` event is explicitly labelled so it is never
// mistaken for a genuine append-only decision.
function mapHistoryRowToEvent(row: AiApprovalHistoryRow): ApprovalHistoryEvent {
  const isBaseline = row.event_type === 'migration_baseline';
  const action = isBaseline
    ? 'Migrated baseline'
    : row.decision
      ? decisionActionLabel(row.decision as ApprovalDecisionType)
      : row.event_type ?? 'History event';
  return {
    timestamp: formatHistoryTime(row.created_at),
    actor: row.actor_reference ?? '',
    action,
    comment: isBaseline ? 'Conservative baseline — no fabricated chronology.' : (row.reason ?? ''),
    previousStatus: row.previous_status ? (APPROVAL_STATUS[row.previous_status as ApprovalStatus]?.label ?? row.previous_status) : '—',
    newStatus: row.new_status ? (APPROVAL_STATUS[row.new_status as ApprovalStatus]?.label ?? row.new_status) : '—',
  };
}

// Demo-only gate flip once a decision grants approval (supporting metadata).
function flipGatePass(approval: AiApproval): AiApproval['executionGate'] {
  return approval.executionGate.map((c) =>
    c.name === 'Approval complete' || c.name === 'Minimum approvers satisfied' ? { ...c, state: 'pass' as const, note: 'Approved' } : c,
  );
}

export function ApprovalsProvider({ children }: { children: ReactNode }) {
  const [approvals, setApprovals] = useState<AiApproval[]>([]);
  const [mode, setMode] = useState<ApprovalsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<ApprovalSiteOption[]>([]);
  const [agents, setAgents] = useState<ApprovalAgentOption[]>([]);
  const [runs, setRuns] = useState<ApprovalRunOption[]>([]);

  // Mutable resolution maps, rebuilt on each refresh. Kept in a ref so they
  // don't trigger re-renders.
  const mapsRef = useRef({
    siteUuidByKey: new Map<string, string>(),
    agentUuidByKey: new Map<string, string>(),
    runUuidByKey: new Map<string, string>(),
    ctx: null as ApprovalResolutionContext | null,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, runsRes, approvalsRes, historyRes] = await Promise.all([
      getAiSites(),
      getAiAgents(),
      getAiRuns(),
      getAiApprovals(),
      getAllAiApprovalHistory(),
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

    const agentRows = (agentsRes.data ?? []).filter((r) => r.is_active !== false);
    const agentKeyById = new Map<string, string>();
    const agentNameById = new Map<string, string>();
    const agentUuidByKey = new Map<string, string>();
    for (const row of agentRows) {
      agentKeyById.set(row.id, row.agent_key);
      agentNameById.set(row.id, row.name);
      agentUuidByKey.set(row.agent_key, row.id);
    }

    const runRows = (runsRes.data ?? []).filter((r) => r.environment !== 'sandbox');
    const runKeyById = new Map<string, string>();
    const runUuidByKey = new Map<string, string>();
    for (const row of runRows) {
      runKeyById.set(row.id, row.run_key);
      runUuidByKey.set(row.run_key, row.id);
    }

    const ctx: ApprovalResolutionContext = { siteKeyById, siteNameById, agentKeyById, agentNameById, runKeyById };
    mapsRef.current = { siteUuidByKey, agentUuidByKey, runUuidByKey, ctx };

    // Form dropdowns (live).
    setSites(siteRows.map((r) => ({ key: r.site_key, name: r.name })));
    setAgents(
      agentRows.map((r) => ({
        key: r.agent_key,
        name: r.name,
        assignedSite: r.site_id ? (siteKeyById.get(r.site_id) ?? null) : null,
      })),
    );
    setRuns(runRows.map((r) => ({ key: r.run_key })));

    if (approvalsRes.error) {
      setMode('error');
      setError(approvalsRes.error);
      setApprovals([]);
      setLoading(false);
      return;
    }

    // TEST/SANDBOX approvals are excluded from the registry view.
    const approvalRows = (approvalsRes.data ?? []).filter((r) => r.environment !== 'sandbox');

    const historyByApprovalId = new Map<string, AiApprovalHistoryRow[]>();
    if (historyRes.data) {
      for (const row of historyRes.data) {
        const approvalId = row.approval_id;
        if (approvalId) {
          const existing = historyByApprovalId.get(approvalId) ?? [];
          historyByApprovalId.set(approvalId, [...existing, row]);
        }
      }
    }

    const mapped = approvalRows.map((r) => {
      const record = mapApprovalRowToRecord(r, demoApprovalById.get(r.approval_key), ctx);
      const liveHistory = (historyByApprovalId.get(r.id) ?? []).map(mapHistoryRowToEvent);
      return { ...record, history: liveHistory };
    });

    setApprovals(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setApprovals(demoApprovals as AiApproval[]);
    setSites(demoSiteOptions);
    setAgents(demoAgentOptions);
    setRuns(demoRunOptions);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createApproval = useCallback(
    async (record: AiApproval): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: never write demo records to Supabase.
        setApprovals((prev) => [record, ...prev]);
        return { error: null };
      }
      const { error: writeError } = await createAiApproval(
        recordToUpsertInput(record, mapsRef.current.siteUuidByKey, mapsRef.current.agentUuidByKey, mapsRef.current.runUuidByKey),
      );
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateApproval = useCallback(
    async (record: AiApproval): Promise<SaveResult> => {
      if (mode !== 'live') {
        setApprovals((prev) =>
          prev.map((a) => (a.id === record.id ? { ...a, ...record, updatedAt: 'Just now' } : a)),
        );
        return { error: null };
      }
      const { error: writeError } = await updateAiApproval(
        record.id,
        recordToUpsertInput(record, mapsRef.current.siteUuidByKey, mapsRef.current.agentUuidByKey, mapsRef.current.runUuidByKey),
      );
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const recordDecision = useCallback(
    async (approvalKey: string, payload: ApprovalDecisionPayload): Promise<SaveResult> => {
      const approval = approvals.find((a) => a.id === approvalKey);
      if (!approval) return { error: 'Approval not found.' };

      const { status, count } = resolveDecisionStatus(approval, payload.type);

      if (mode !== 'live') {
        // Demo/local-only: update local state (history + gate are demo support).
        const historyEvent: ApprovalHistoryEvent = {
          timestamp: 'Just now',
          actor: payload.actor,
          action: decisionActionLabel(payload.type),
          comment: payload.reason,
          previousStatus: APPROVAL_STATUS[approval.status].label,
          newStatus: APPROVAL_STATUS[status].label,
        };
        const updated: AiApproval = {
          ...approval,
          status,
          approvalCount: count,
          decision: { type: payload.type, reason: payload.reason, timestamp: 'Just now', actor: payload.actor, conditions: payload.conditions },
          history: [...approval.history, historyEvent],
          executionGate:
            status === 'approved' || status === 'approved_with_conditions' ? flipGatePass(approval) : approval.executionGate,
          updatedAt: 'Just now',
        };
        setApprovals((prev) => prev.map((a) => (a.id === approvalKey ? updated : a)));
        return { error: null };
      }

      const prevStatus = approval.status;
      const { data: updated, error: writeError } = await recordAiApprovalDecision(approvalKey, {
        decision: payload.type,
        decision_reason: payload.reason,
        decision_actor: payload.actor,
        status,
        current_approval_count: count,
        conditions: payload.conditions ? [payload.conditions] : null,
      });
      if (writeError) return { error: writeError };
      if (!updated) return { error: 'Unable to record approval decision.' };

      // 1) Append-only history (previous → new state, never overwrites prior).
      const historyRes = await appendAiApprovalHistory({
        approval_id: updated.id,
        event_type: 'decision',
        previous_status: prevStatus,
        new_status: status,
        decision: payload.type,
        actor_reference: payload.actor,
        actor_role: payload.actorRole ?? 'staff',
        reason: payload.reason,
        conditions: payload.conditions ? [payload.conditions] : null,
        approval_count_before: approval.approvalCount,
        approval_count_after: count,
      });
      if (historyRes.error) return { error: historyRes.error };

      // 2) Audit event for the decision (metadata only — never executes).
      const auditRes = await createAiAuditEvent({
        audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        occurred_at: new Date().toISOString(),
        event_type: 'approval_decision',
        action: decisionActionLabel(payload.type),
        outcome: decisionOutcome(payload.type),
        severity: riskToSeverity(updated.risk_class ?? approval.riskClass),
        site_id: updated.site_id,
        agent_id: updated.agent_id,
        run_id: updated.run_id,
        approval_id: updated.id,
        actor_type: 'human',
        actor_reference: payload.actor,
        trigger_source: 'approval',
        risk_level: updated.risk_class ?? approval.riskClass,
        environment: updated.environment ?? approval.environment,
        before_summary: `Approval ${approval.title || approvalKey} in status ${prevStatus}.`,
        after_summary: `Decision recorded: ${decisionActionLabel(payload.type)} (${status}).`,
        decision_reason: payload.reason,
        verification_state: 'not_required',
        uat_state: 'not_required',
        integrity_state: 'complete',
        review_required: false,
        notes: 'Approval decision recorded — execution runtime is not connected.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, approvals, refresh],
  );

  const getApproval = useCallback(
    (approvalKey: string) => approvals.find((a) => a.id === approvalKey),
    [approvals],
  );

  // Load live approvals on first mount. A failure surfaces as `error` mode and
  // never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ApprovalsContextValue>(
    () => ({
      approvals,
      mode,
      loading,
      error,
      sites,
      agents,
      runs,
      refresh,
      loadDemo,
      getApproval,
      createApproval,
      updateApproval,
      recordDecision,
    }),
    [approvals, mode, loading, error, sites, agents, runs, refresh, loadDemo, getApproval, createApproval, updateApproval, recordDecision],
  );

  return <ApprovalsContext.Provider value={value}>{children}</ApprovalsContext.Provider>;
}

export function useApprovals() {
  const ctx = useContext(ApprovalsContext);
  if (!ctx) throw new Error('useApprovals must be used within an ApprovalsProvider');
  return ctx;
}