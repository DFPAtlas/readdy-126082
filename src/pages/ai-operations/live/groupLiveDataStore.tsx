// ============================================================================
// AI Operations — Group Live Data Store (Phase 2 Prompt 16 consolidation).
//
// A single, centralised read-only aggregation layer over the live Supabase
// registries (ai_sites, ai_operations_agents, ai_runs, ai_approvals,
// ai_audit_events, ai_alerts, ai_incidents, ai_orchestrations, tools, models,
// knowledge, policies, notifications, schedules, costs/budgets).
//
// This is READ/AGGREGATION ONLY — it never executes agents, models, tools,
// n8n, schedules, notifications or remediation, and never writes production
// business data. Every registry is loaded once in a single coordinated
// Promise.all (no per-component polling), and the resulting snapshot is shared
// by the Overview, Live Operations, Wallboard and Global Search surfaces.
//
// No Supabase UUIDs leave this layer — the snapshot carries stable keys and
// the resolution maps needed to resolve display names.
// ============================================================================

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type {
  AiSiteRow,
  AiAgentRow,
  AiRunRow,
  AiRunStepRow,
  AiApprovalRow,
  AiAuditEventRow,
  AiAlertRow,
  AiIncidentRow,
  AiOrchestrationRow,
  AiToolConnectionRow,
  AiToolAgentAccessRow,
  AiModelProviderRow,
  AiOperationsModelRow,
  AiAgentModelAssignmentRow,
  AiKnowledgeSourceRow,
  AiKnowledgePermissionRow,
  AiSecurityPolicyRow,
  AiNotificationRuleRow,
  AiScheduleRow,
  AiBudgetRow,
  AiUsageCostRow,
  AiBudgetEventRow,
  OnlinePresenceRow,
} from '@/lib/ai-operations';
import {
  getAiSites,
  getAiAgents,
  getAiRuns,
  getAllAiRunSteps,
  getAiApprovals,
  getAiAuditEvents,
  getAiAlerts,
  getAiIncidents,
  getAiOrchestrations,
  getAiToolConnections,
  getAiToolAgentAccess,
  getAiModelProviders,
  getAiOperationsModels,
  getAiAgentModelAssignments,
  getAiKnowledgeSources,
  getAiKnowledgePermissions,
  getAiSecurityPolicies,
  getAiNotificationRules,
  getAiSchedules,
  getAiBudgets,
  getAiUsageCosts,
  getAiBudgetEvents,
  getOnlinePresence,
} from '@/lib/ai-operations';

// ---------------------------------------------------------------------------
// Source state
// ---------------------------------------------------------------------------

// Honest data-source state for the group surfaces. Group dashboards are never
// labelled `live` in full because runtime monitoring, agent execution and
// online-user analytics are not connected — so a fully-loaded snapshot is
// reported as `partial-live`.
export type GroupSourceState = 'live' | 'partial-live' | 'demo' | 'unavailable';

export interface GroupAvailability {
  sites: boolean;
  agents: boolean;
  runs: boolean;
  approvals: boolean;
  audit: boolean;
  alerts: boolean;
  incidents: boolean;
  orchestrations: boolean;
  tools: boolean;
  toolAccess: boolean;
  models: boolean;
  modelAssignments: boolean;
  providers: boolean;
  knowledge: boolean;
  knowledgePermissions: boolean;
  policies: boolean;
  rules: boolean;
  schedules: boolean;
  budgets: boolean;
  usageCosts: boolean;
  budgetEvents: boolean;
  usersOnline: boolean;
}

export interface GroupLiveData {
  mode: GroupSourceState;
  loading: boolean;
  /** Sanitised, user-safe error message (never a raw Supabase error). */
  error: string | null;
  lastRefreshed: Date;
  availability: GroupAvailability;
  sites: AiSiteRow[];
  agents: AiAgentRow[];
  runs: AiRunRow[];
  runSteps: AiRunStepRow[];
  approvals: AiApprovalRow[];
  auditEvents: AiAuditEventRow[];
  alerts: AiAlertRow[];
  incidents: AiIncidentRow[];
  orchestrations: AiOrchestrationRow[];
  tools: AiToolConnectionRow[];
  toolAccess: AiToolAgentAccessRow[];
  providers: AiModelProviderRow[];
  models: AiOperationsModelRow[];
  modelAssignments: AiAgentModelAssignmentRow[];
  knowledge: AiKnowledgeSourceRow[];
  knowledgePermissions: AiKnowledgePermissionRow[];
  policies: AiSecurityPolicyRow[];
  rules: AiNotificationRuleRow[];
  schedules: AiScheduleRow[];
  budgets: AiBudgetRow[];
  usageCosts: AiUsageCostRow[];
  budgetEvents: AiBudgetEventRow[];
  presence: OnlinePresenceRow[];
  siteKeyByUuid: Map<string, string>;
  siteNameByUuid: Map<string, string>;
  agentKeyByUuid: Map<string, string>;
  agentNameByUuid: Map<string, string>;
}

function emptyAvailability(): GroupAvailability {
  return {
    sites: false,
    agents: false,
    runs: false,
    approvals: false,
    audit: false,
    alerts: false,
    incidents: false,
    orchestrations: false,
    tools: false,
    toolAccess: false,
    models: false,
    modelAssignments: false,
    providers: false,
    knowledge: false,
    knowledgePermissions: false,
    policies: false,
    rules: false,
    schedules: false,
    budgets: false,
    usageCosts: false,
    budgetEvents: false,
    usersOnline: false,
  };
}

function emptySnapshot(): GroupLiveData {
  return {
    mode: 'unavailable',
    loading: true,
    error: null,
    lastRefreshed: new Date(),
    availability: emptyAvailability(),
    sites: [],
    agents: [],
    runs: [],
    runSteps: [],
    approvals: [],
    auditEvents: [],
    alerts: [],
    incidents: [],
    orchestrations: [],
    tools: [],
    toolAccess: [],
    providers: [],
    models: [],
    modelAssignments: [],
    knowledge: [],
    knowledgePermissions: [],
    policies: [],
    rules: [],
    schedules: [],
    budgets: [],
    usageCosts: [],
    budgetEvents: [],
    presence: [],
    siteKeyByUuid: new Map(),
    siteNameByUuid: new Map(),
    agentKeyByUuid: new Map(),
    agentNameByUuid: new Map(),
  };
}

// --- External store (module-level) --------------------------------------------

let snapshot: GroupLiveData = emptySnapshot();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): GroupLiveData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current snapshot, for pure selectors. */
export function getGroupLiveData(): GroupLiveData {
  return snapshot;
}

function setSnapshot(next: GroupLiveData) {
  snapshot = next;
  emit();
}

// Subscribe to the shared group live snapshot. Consumers that call this re-render
// whenever the snapshot changes (initial load, manual refresh, auto-refresh).
export function useGroupLiveData(): GroupLiveData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader -------------------------------------------------------------------

function isTestOrSandbox(row: { environment?: string | null; is_active?: boolean }): boolean {
  return row.environment === 'sandbox' || row.is_active === false;
}

function buildResolutionMaps(
  sites: AiSiteRow[],
  agents: AiAgentRow[],
): Pick<GroupLiveData, 'siteKeyByUuid' | 'siteNameByUuid' | 'agentKeyByUuid' | 'agentNameByUuid'> {
  const siteKeyByUuid = new Map<string, string>();
  const siteNameByUuid = new Map<string, string>();
  for (const row of sites) {
    siteKeyByUuid.set(row.id, row.site_key);
    siteNameByUuid.set(row.id, row.name);
  }
  const agentKeyByUuid = new Map<string, string>();
  const agentNameByUuid = new Map<string, string>();
  for (const row of agents) {
    agentKeyByUuid.set(row.id, row.agent_key);
    agentNameByUuid.set(row.id, row.name);
  }
  return { siteKeyByUuid, siteNameByUuid, agentKeyByUuid, agentNameByUuid };
}

export async function refreshGroupLiveData(): Promise<void> {
  setSnapshot({ ...getSnapshot(), loading: true });

  const [
    sitesRes,
    agentsRes,
    runsRes,
    stepsRes,
    approvalsRes,
    auditRes,
    alertsRes,
    incidentsRes,
    orchRes,
    toolsRes,
    toolAccessRes,
    providersRes,
    modelsRes,
    modelAssignmentsRes,
    knowledgeRes,
    knowledgePermissionsRes,
    policiesRes,
    rulesRes,
    schedulesRes,
    budgetsRes,
    usageRes,
    budgetEventsRes,
    presenceRes,
  ] = await Promise.all([
    getAiSites(),
    getAiAgents(),
    getAiRuns(),
    getAllAiRunSteps(),
    getAiApprovals(),
    getAiAuditEvents(),
    getAiAlerts(),
    getAiIncidents(),
    getAiOrchestrations(),
    getAiToolConnections(),
    getAiToolAgentAccess(),
    getAiModelProviders(),
    getAiOperationsModels(),
    getAiAgentModelAssignments(),
    getAiKnowledgeSources(),
    getAiKnowledgePermissions(),
    getAiSecurityPolicies(),
    getAiNotificationRules(),
    getAiSchedules(),
    getAiBudgets(),
    getAiUsageCosts(),
    getAiBudgetEvents(),
    getOnlinePresence(),
  ]);

  const availability: GroupAvailability = {
    sites: !sitesRes.error,
    agents: !agentsRes.error,
    runs: !runsRes.error,
    approvals: !approvalsRes.error,
    audit: !auditRes.error,
    alerts: !alertsRes.error,
    incidents: !incidentsRes.error,
    orchestrations: !orchRes.error,
    tools: !toolsRes.error,
    toolAccess: !toolAccessRes.error,
    models: !modelsRes.error,
    modelAssignments: !modelAssignmentsRes.error,
    providers: !providersRes.error,
    knowledge: !knowledgeRes.error,
    knowledgePermissions: !knowledgePermissionsRes.error,
    policies: !policiesRes.error,
    rules: !rulesRes.error,
    schedules: !schedulesRes.error,
    budgets: !budgetsRes.error,
    usageCosts: !usageRes.error,
    budgetEvents: !budgetEventsRes.error,
    usersOnline: !presenceRes.error,
  };

  const sites = (sitesRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const agents = (agentsRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const runs = (runsRes.data ?? []).filter((r) => r.environment !== 'sandbox');
  const runSteps = stepsRes.data ?? [];
  const approvals = (approvalsRes.data ?? []).filter((r) => r.environment !== 'sandbox');
  const auditEvents = (auditRes.data ?? []).filter((r) => r.environment !== 'sandbox');
  const alerts = (alertsRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const incidents = (incidentsRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const orchestrations = orchRes.data ?? [];
  const tools = (toolsRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const toolAccess = toolAccessRes.data ?? [];
  const providers = (providersRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const models = (modelsRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const modelAssignments = modelAssignmentsRes.data ?? [];
  const knowledge = (knowledgeRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const knowledgePermissions = knowledgePermissionsRes.data ?? [];
  const policies = (policiesRes.data ?? []).filter((r) => !isTestOrSandbox(r));
  const rules = rulesRes.data ?? [];
  const schedules = schedulesRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const usageCosts = usageRes.data ?? [];
  const budgetEvents = budgetEventsRes.data ?? [];
  const presence = presenceRes.data ?? [];

  const { siteKeyByUuid, siteNameByUuid, agentKeyByUuid, agentNameByUuid } =
    buildResolutionMaps(sites, agents);

  // Core registries (sites/agents/runs/approvals) are required for the group
  // surfaces to be meaningful. A total core failure surfaces as `unavailable`;
  // otherwise we report `partial-live` (runtime monitoring, agent execution and
  // online-user analytics remain unconnected).
  const coreAvailable = availability.sites && availability.agents && availability.runs && availability.approvals;
  const mode: GroupSourceState = coreAvailable ? 'partial-live' : 'unavailable';
  const error = coreAvailable
    ? null
    : 'Unable to load the core AI Operations registries. Please try again.';

  setSnapshot({
    mode,
    loading: false,
    error,
    lastRefreshed: new Date(),
    availability,
    sites,
    agents,
    runs,
    runSteps,
    approvals,
    auditEvents,
    alerts,
    incidents,
    orchestrations,
    tools,
    toolAccess,
    providers,
    models,
    modelAssignments,
    knowledge,
    knowledgePermissions,
    policies,
    rules,
    schedules,
    budgets,
    usageCosts,
    budgetEvents,
    presence,
    siteKeyByUuid,
    siteNameByUuid,
    agentKeyByUuid,
    agentNameByUuid,
  });
}

// --- Provider -----------------------------------------------------------------

// Mounts the shared live-data store. Loads once on mount; pages trigger manual
// refresh via `refreshGroupLiveData()` (e.g. auto-refresh cycles).
export function GroupLiveDataProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    void refreshGroupLiveData();
    // Re-render this provider when the snapshot changes so children can react to
    // loading/error state transitions (the store subscription handles data).
    const unsubscribe = subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, []);

  return <>{children}</>;
}