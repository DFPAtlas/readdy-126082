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

// Exact legacy demo fingerprints from 202609140000_ai_operations_alerts_incidents.sql.
// That migration inserted demo cases with production defaults. Preserve source
// records for review, but exclude unchanged fixtures from live totals. Match
// content and event timestamps as well as keys so new occurrences stay visible.
// This is provenance matching, not an age cutoff or automatic resolution.
type LegacyDemoFingerprint = readonly [string, string, string, string, string, string, string | null, number | null];
const LEGACY_DEMO_CASES: readonly LegacyDemoFingerprint[] = [
  ["ALR-5001", "OpenAI provider degraded — elevated latency", "The shared cloud model provider is reporting elevated response latency and intermittent 5xx errors on completion calls.", "high", "investigating", "2026-08-25T09:12:00Z", "2026-08-25T10:05:00Z", 1],
  ["ALR-5002", "n8n connection failure — automation queue stalled", "The shared n8n automation connection is unreachable, stalling scheduled workflow execution across the group.", "critical", "escalated", "2026-08-25T08:55:00Z", "2026-08-25T09:50:00Z", 1],
  ["ALR-5003", "Blocked RED action — production data deletion attempt", "An agent attempted a production data deletion that was blocked by policy and routed to human approval.", "high", "awaiting_approval", "2026-08-25T09:30:00Z", "2026-08-25T10:10:00Z", 1],
  ["ALR-5004", "Approval expiring — RED deployment authorisation", "A RED deployment approval is approaching expiry without sign-off, risking workflow stall.", "high", "awaiting_approval", "2026-08-25T08:40:00Z", "2026-08-25T10:00:00Z", 1],
  ["ALR-5005", "Group security anomaly scan blocked", "The group-wide security anomaly scan was blocked at the execution gate pending risk review.", "critical", "investigating", "2026-08-25T09:05:00Z", "2026-08-25T10:15:00Z", 1],
  ["ALR-5006", "Repeated escalation-policy mismatch", "A recurring mismatch between escalation routing and policy has been detected again.", "medium", "acknowledged", "2026-08-25T07:50:00Z", "2026-08-25T08:30:00Z", 3],
  ["ALR-5010", "Digital Footprint support diagnostics failure", "The Digital Footprint diagnostics agent failed a support-diagnosis run, delaying ticket resolution.", "high", "investigating", "2026-08-25T09:58:00Z", "2026-08-25T10:20:00Z", 1],
  ["ALR-5011", "Digital Footprint data health warning", "A data health check flagged a minor inconsistency in project records.", "medium", "monitoring", "2026-08-25T08:30:00Z", "2026-08-25T09:00:00Z", 1],
  ["ALR-5020", "QuickGuard guard matching run failure", "The guard matching agent failed a shift-matching run, leaving a shift unassigned.", "high", "investigating", "2026-08-25T10:31:00Z", "2026-08-25T10:45:00Z", 1],
  ["ALR-5021", "QuickGuard compliance licence warning", "A licence renewal window is approaching for several guards, flagged by the compliance agent.", "medium", "waiting", "2026-08-25T08:10:00Z", "2026-08-25T09:00:00Z", 1],
  ["ALR-5022", "QuickGuard timesheet sync failure", "Timesheet data failed to sync to payroll, flagged for reconciliation.", "medium", "acknowledged", "2026-08-25T07:30:00Z", "2026-08-25T08:10:00Z", 1],
  ["ALR-5030", "GuardianHub check-call failure (repeating)", "The check-call agent failed again on a welfare check-call, matching a previously documented incident.", "critical", "escalated", "2026-08-25T09:20:00Z", "2026-08-25T10:10:00Z", 3],
  ["ALR-5031", "GuardianHub Supabase degraded", "The GuardianHub Supabase connection is degraded, slowing database operations.", "high", "investigating", "2026-08-25T09:00:00Z", "2026-08-25T10:00:00Z", 1],
  ["ALR-5032", "GuardianHub welfare escalation blocked", "A welfare escalation was blocked pending human approval.", "critical", "awaiting_approval", "2026-08-25T09:40:00Z", "2026-08-25T10:20:00Z", 1],
  ["ALR-5040", "LetHub tenancy compliance warning", "A tenancy compliance review flagged documents approaching expiry.", "medium", "monitoring", "2026-08-25T08:20:00Z", "2026-08-25T09:10:00Z", 1],
  ["ALR-5041", "LetHub maintenance triage failure", "The maintenance agent failed to triage an incoming maintenance request.", "high", "investigating", "2026-08-25T09:50:00Z", "2026-08-25T10:15:00Z", 1],
  ["ALR-5050", "Wedora RSVP notification failure", "The RSVP agent failed to send guest notifications due to an email connection issue.", "high", "investigating", "2026-08-25T09:15:00Z", "2026-08-25T10:05:00Z", 1],
  ["ALR-5051", "Wedora supplier quote chase failure", "The supplier agent failed to chase an outstanding quote.", "medium", "acknowledged", "2026-08-25T08:05:00Z", "2026-08-25T08:50:00Z", 1],
  ["ALR-5060", "The Forge UAT failure", "A release UAT cycle failed validation, blocking the release gate.", "high", "investigating", "2026-08-25T09:35:00Z", "2026-08-25T10:20:00Z", 1],
  ["ALR-5061", "The Forge code agent error", "The code agent entered an error state during a generation task.", "high", "escalated", "2026-08-25T10:00:00Z", "2026-08-25T10:25:00Z", 1],
  ["ALR-5062", "The Forge n8n degraded", "The Forge n8n connection is degraded, slowing build automation.", "medium", "monitoring", "2026-08-25T08:45:00Z", "2026-08-25T09:30:00Z", 1],
  ["ALR-5007", "Group billing threshold warning", "Group AI spend approached its daily cost threshold.", "low", "acknowledged", "2026-08-25T08:00:00Z", "2026-08-25T08:40:00Z", 1],
  ["ALR-5008", "Group backup failure", "A scheduled backup failed to complete.", "medium", "investigating", "2026-08-25T09:10:00Z", "2026-08-25T10:00:00Z", 1],
  ["ALR-5090", "LetHub property sync resolved", "A property sync issue was diagnosed and fixed.", "medium", "resolved", "2026-08-24T16:20:00Z", "2026-08-24T18:00:00Z", 1],
  ["ALR-5091", "Wedora seating validation resolved", "A seating chart validation failure was fixed and re-verified.", "medium", "resolved", "2026-08-24T15:40:00Z", "2026-08-24T17:30:00Z", 1],
  ["ALR-5092", "QuickGuard payroll reconciliation closed", "A payroll reconciliation run failure was resolved and closed.", "high", "closed", "2026-08-24T14:10:00Z", "2026-08-24T16:40:00Z", 2],
  ["ALR-5093", "The Forge sandbox isolation resolved", "A sandbox isolation breach attempt was contained and resolved.", "high", "resolved", "2026-08-24T13:30:00Z", "2026-08-24T15:50:00Z", 1],
  ["INC-8101", "OpenAI provider degraded — elevated latency", "The shared cloud model provider is reporting elevated response latency and intermittent 5xx errors on completion calls.", "high", "investigating", "2026-08-25T09:18:00Z", null, null],
  ["INC-8102", "n8n connection failure — automation queue stalled", "The shared n8n automation connection is unreachable, stalling scheduled workflow execution across the group.", "critical", "escalated", "2026-08-25T09:00:00Z", null, null],
  ["INC-8103", "Blocked RED action — production data deletion attempt", "An agent attempted a production data deletion that was blocked by policy and routed to human approval.", "high", "awaiting_approval", "2026-08-25T09:35:00Z", null, null],
  ["INC-8104", "Approval expiring — RED deployment authorisation", "A RED deployment approval is approaching expiry without sign-off, risking workflow stall.", "high", "awaiting_approval", "2026-08-25T08:45:00Z", null, null],
  ["INC-8105", "Group security anomaly scan blocked", "The group-wide security anomaly scan was blocked at the execution gate pending risk review.", "critical", "investigating", "2026-08-25T09:10:00Z", null, null],
  ["INC-8106", "Repeated escalation-policy mismatch", "A recurring mismatch between escalation routing and policy has been detected again.", "medium", "acknowledged", "2026-08-25T08:00:00Z", null, null],
  ["INC-8110", "Digital Footprint support diagnostics failure", "The Digital Footprint diagnostics agent failed a support-diagnosis run, delaying ticket resolution.", "high", "investigating", "2026-08-25T10:02:00Z", null, null],
  ["INC-8120", "QuickGuard guard matching run failure", "The guard matching agent failed a shift-matching run, leaving a shift unassigned.", "high", "investigating", "2026-08-25T10:35:00Z", null, null],
  ["INC-8130", "GuardianHub check-call failure (repeating)", "The check-call agent failed again on a welfare check-call, matching a previously documented incident.", "critical", "escalated", "2026-08-25T09:25:00Z", null, null],
  ["INC-8131", "GuardianHub Supabase degraded", "The GuardianHub Supabase connection is degraded, slowing database operations.", "high", "investigating", "2026-08-25T09:05:00Z", null, null],
  ["INC-8132", "GuardianHub welfare escalation blocked", "A welfare escalation was blocked pending human approval.", "critical", "awaiting_approval", "2026-08-25T09:45:00Z", null, null],
  ["INC-8141", "LetHub maintenance triage failure", "The maintenance agent failed to triage an incoming maintenance request.", "high", "investigating", "2026-08-25T09:55:00Z", null, null],
  ["INC-8150", "Wedora RSVP notification failure", "The RSVP agent failed to send guest notifications due to an email connection issue.", "high", "investigating", "2026-08-25T09:20:00Z", null, null],
  ["INC-8160", "The Forge UAT failure", "A release UAT cycle failed validation, blocking the release gate.", "high", "investigating", "2026-08-25T09:40:00Z", null, null],
  ["INC-8161", "The Forge code agent error", "The code agent entered an error state during a generation task.", "high", "escalated", "2026-08-25T10:05:00Z", null, null],
  ["INC-8192", "QuickGuard payroll reconciliation closed", "A payroll reconciliation run failure was resolved and closed.", "high", "closed", "2026-08-24T14:20:00Z", null, null],
  ["INC-8193", "The Forge sandbox isolation resolved", "A sandbox isolation breach attempt was contained and resolved.", "high", "resolved", "2026-08-24T13:40:00Z", null, null],
];

function isLegacyDemoCase(row: AiAlertRow | AiIncidentRow): boolean {
  const alert = 'alert_key' in row;
  const key = alert ? row.alert_key : row.incident_key;
  const seed = LEGACY_DEMO_CASES.find((entry) => entry[0] === key);
  if (!seed || (alert && row.source_reference)) return false;
  const sameInstant = (value: string | null, expected: string | null) =>
    value != null && expected != null && Date.parse(value) === Date.parse(expected);
  return row.title === seed[1] && row.summary === seed[2] &&
    row.severity === seed[3] && row.status === seed[4] &&
    sameInstant(alert ? row.first_seen_at : row.started_at, seed[5]) &&
    (!alert || (sameInstant(row.last_seen_at, seed[6]) && row.occurrence_count === seed[7])) &&
    !row.correlation_id;
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
  const alerts = (alertsRes.data ?? []).filter((r) => !isTestOrSandbox(r) && !isLegacyDemoCase(r));
  const incidents = (incidentsRes.data ?? []).filter((r) => !isTestOrSandbox(r) && !isLegacyDemoCase(r));
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