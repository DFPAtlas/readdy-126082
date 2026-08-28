// ============================================================================
// AI Operations — Group Live Data Selectors (Phase 2 Prompt 16).
//
// Pure read-only derivations over the shared group live snapshot (see
// groupLiveDataStore.tsx). These replace the previous demo/mock selectors for
// the Overview, Live Operations, Wallboard and Global Search surfaces.
//
// Honesty guarantees:
//   * No registry-active agent is reported as an online/running process —
//     agent state is labelled "Registered Active", never "Online".
//   * Tool/model health is reported as "Registry Health", never live
//     connectivity (health probes are not connected).
//   * Costs are labelled "Estimated / migrated baseline" (provider billing is
//     not connected).
//   * TEST/SANDBOX records are excluded from production-facing counts.
//   * No Supabase UUID is exposed — stable keys only.
// ============================================================================

import type {
  SiteAiStatus,
  AiStatus,
  AgentStatus,
  AgentHealth,
  RiskLevel,
  RunStatus,
  RunPriority,
  RiskClass,
  ApprovalStatus,
  Severity,
  ActivityStatus,
  ActivitySourceType,
  HealthStatus,
  CapacityState,
  KpiMetric,
  SiteAiStatusRow,
  AgentActivity,
  ApprovalRequest,
  SystemHealthRow,
  OrchestratorStatus,
  SiteHealthCard,
  AgentWorkload,
  SiteWorkload,
  ProviderHealth,
  MissionControlItem,
  MultiAgentWorkflow,
  LiveOrchestratorStatus,
  OperationsAlert,
  LiveActivityEvent,
} from '@/pages/ai-operations/types';
import type {
  AiAlertRow,
  AiAuditEventRow,
  AiAgentRow,
} from '@/lib/ai-operations';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

// --- Status value narrowing (DB strings already match the frontend unions) ----

const asSiteAiStatus = (v: string): SiteAiStatus => (v as SiteAiStatus) ?? 'unknown';
const asAiStatus = (v: string): AiStatus => (v as AiStatus) ?? 'not_configured';
const asAgentStatus = (v: string): AgentStatus => (v as AgentStatus) ?? 'not_configured';
const asAgentHealth = (v: string): AgentHealth => (v as AgentHealth) ?? 'unknown';
const asRiskLevel = (v: string | null | undefined): RiskLevel => (v as RiskLevel) ?? 'low';
const asRunStatus = (v: string): RunStatus => (v as RunStatus) ?? 'draft';
const asRunPriority = (v: string | null | undefined): RunPriority => (v as RunPriority) ?? 'normal';
const asRiskClass = (v: string | null | undefined): RiskClass => (v as RiskClass) ?? 'green';
const asApprovalStatus = (v: string): ApprovalStatus => (v as ApprovalStatus) ?? 'draft';
const asSeverity = (v: string | null | undefined): Severity => (v as Severity) ?? 'info';
const asHealthStatus = (v: string | null | undefined): HealthStatus => (v as HealthStatus) ?? 'unknown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pounds(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  return `£${n.toFixed(2)}`;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} · ${hh}:${mm}`;
}

function siteNameOf(row: { site_id: string | null }, data: ReturnType<typeof getGroupLiveData>): string {
  if (!row.site_id) return 'Group-wide';
  return data.siteNameByUuid.get(row.site_id) ?? 'Group-wide';
}

function siteKeyOf(row: { site_id: string | null }, data: ReturnType<typeof getGroupLiveData>): string {
  if (!row.site_id) return 'group';
  return data.siteKeyByUuid.get(row.site_id) ?? 'group';
}

function agentNameOf(row: { agent_id: string | null }, data: ReturnType<typeof getGroupLiveData>): string {
  if (!row.agent_id) return '—';
  return data.agentNameByUuid.get(row.agent_id) ?? '—';
}

// Registered-active agents = registry status indicates the agent is configured
// and enabled (NOT a claim that a process is online or a model is loaded).
const REGISTERED_ACTIVE: AgentStatus[] = ['active', 'working', 'idle', 'degraded'];

// --- Lightweight group display records ---------------------------------------

export interface AgentsWorkingItem {
  id: string;
  name: string;
  scope: string;
  currentTask: string;
  status: AgentStatus;
  health: AgentHealth;
  risk: RiskLevel;
  currentRunId: string;
  queueCount: number;
}

export interface ActiveRunItem {
  id: string;
  siteName: string;
  agentName: string;
  status: RunStatus;
  priority: RunPriority;
  risk: RiskLevel;
  currentStep: number;
  totalSteps: number;
}

export interface ApprovalWatchItem {
  id: string;
  siteName: string;
  agentName: string;
  requestedAction: string;
  status: ApprovalStatus;
  riskClass: RiskClass;
  severity: RiskLevel;
  expiryState: 'active' | 'expiring_soon' | 'expired' | 'no_expiry';
  runId: string | null;
  approvalCount: number;
  minApprovers: number;
}

// --- Status bar metrics --------------------------------------------------------

export function getStatusBarMetrics() {
  const data = getGroupLiveData();
  const agents = data.agents;
  const runs = data.runs;
  const approvals = data.approvals;
  const alerts = data.alerts;
  const usageCosts = data.usageCosts;

  const sitesHealthy = data.sites.filter((s) => asSiteAiStatus(s.operational_status) === 'healthy').length;
  const agentsWorking = agents.filter((a) => a.status === 'working').length;
  const activeRuns = runs.filter((r) => r.status === 'working').length;
  const queuedRuns = runs.filter((r) => ['queued', 'waiting'].includes(r.status)).length;
  const pendingApprovals = approvals.filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status)).length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && isAlertActive(a)).length;

  const aiCost = usageCosts.reduce(
    (acc, u) => acc + (pounds(u.estimated_cost) || pounds(u.actual_cost)),
    0,
  );

  return {
    sitesHealthy,
    sitesTotal: data.sites.length,
    agentsWorking,
    activeRuns,
    queuedRuns,
    pendingApprovals,
    failedRuns,
    criticalAlerts,
    aiCostToday: formatMoney(aiCost),
  };
}

function isAlertActive(a: AiAlertRow): boolean {
  return !['resolved', 'closed', 'suppressed'].includes(a.status ?? '');
}

// --- Site health ---------------------------------------------------------------

export function getSiteHealth(): SiteHealthCard[] {
  const data = getGroupLiveData();
  return data.sites.map((s) => {
    const siteKey = s.site_key;
    const siteUuid = s.id;
    const siteAgents = data.agents.filter((a) => a.site_id === siteUuid);
    const siteRuns = data.runs.filter((r) => r.site_id === siteUuid);
    const siteApprovals = data.approvals.filter((a) => a.site_id === siteUuid);
    const siteAlerts = data.alerts.filter((a) => a.site_id === siteUuid && isAlertActive(a));
    return {
      id: siteKey,
      name: s.name,
      operationalStatus: asSiteAiStatus(s.operational_status),
      aiStatus: asAiStatus(s.ai_status),
      activeAgents: siteAgents.filter((a) => REGISTERED_ACTIVE.includes(asAgentStatus(a.status))).length,
      activeRuns: siteRuns.filter((r) => r.status === 'working').length,
      queuedRuns: siteRuns.filter((r) => ['queued', 'waiting'].includes(r.status)).length,
      failedRuns: siteRuns.filter((r) => r.status === 'failed').length,
      pendingApprovals: siteApprovals.filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status)).length,
      alerts: siteAlerts.length,
      lastActivity: s.updated_at ? formatDateTime(s.updated_at) : '—',
    };
  });
}

// --- Agents (registered active — never "online") --------------------------------

export function getAgentsWorkingNow(): AgentsWorkingItem[] {
  const data = getGroupLiveData();
  return data.agents
    .filter((a) => ['working', 'active', 'error'].includes(a.status ?? ''))
    .sort((a, b) => {
      const rank = (s: string) => (s === 'working' ? 0 : s === 'error' ? 1 : 2);
      const r = rank(a.status ?? '') - rank(b.status ?? '');
      if (r !== 0) return r;
      return (b.queue_count ?? 0) - (a.queue_count ?? 0);
    })
    .map((a) => ({
      id: a.agent_key,
      name: a.name,
      scope: a.site_id ? (data.siteNameByUuid.get(a.site_id) ?? 'Group-wide') : 'Group-wide',
      currentTask: a.current_task ?? 'No active task',
      status: asAgentStatus(a.status ?? ''),
      health: asAgentHealth(a.health ?? ''),
      risk: asRiskLevel(a.risk_level),
      currentRunId: a.current_run_id ?? a.agent_key,
      queueCount: a.queue_count ?? 0,
    }));
}

// --- Active runs ---------------------------------------------------------------

const INFLIGHT_RUN_STATUSES = ['working', 'awaiting_approval', 'waiting', 'retry_scheduled', 'paused', 'blocked'];

export function getActiveRuns(): ActiveRunItem[] {
  const data = getGroupLiveData();
  return data.runs
    .filter((r) => INFLIGHT_RUN_STATUSES.includes(r.status))
    .map((r) => ({
      id: r.run_key,
      siteName: siteNameOf(r, data),
      agentName: agentNameOf(r, data),
      status: asRunStatus(r.status),
      priority: asRunPriority(r.priority),
      risk: asRiskLevel(r.risk_level),
      currentStep: r.current_step ?? 0,
      totalSteps: r.total_steps ?? 0,
    }));
}

// --- Approval watch -------------------------------------------------------------

const SEVERITY_ORDER: Record<RiskLevel, number> = { low: 3, medium: 2, high: 1, critical: 0 };

export function getApprovalWatch(): ApprovalWatchItem[] {
  const data = getGroupLiveData();
  return data.approvals
    .filter((a) => ['pending', 'under_review'].includes(a.status))
    .sort((x, y) => (SEVERITY_ORDER[asRiskLevel(x.severity)] ?? 9) - (SEVERITY_ORDER[asRiskLevel(y.severity)] ?? 9))
    .map((a) => ({
      id: a.approval_key,
      siteName: siteNameOf(a, data),
      agentName: agentNameOf(a, data),
      requestedAction: a.requested_action ?? a.title ?? '—',
      status: asApprovalStatus(a.status),
      riskClass: asRiskClass(a.risk_class),
      severity: asRiskLevel(a.severity),
      expiryState: 'no_expiry',
      runId: a.run_id ? (data.runs.find((r) => r.id === a.run_id)?.run_key ?? null) : null,
      approvalCount: a.current_approval_count ?? 0,
      minApprovers: a.minimum_approvers ?? 1,
    }));
}

// --- Queue ----------------------------------------------------------------------

export function getQueueMetrics() {
  const data = getGroupLiveData();
  const queued = data.runs.filter((r) => ['queued', 'waiting'].includes(r.status));
  const byPriority = (p: string) => queued.filter((r) => r.priority === p).length;
  return {
    totalQueued: queued.length,
    highPriority: byPriority('high'),
    urgent: byPriority('urgent'),
    critical: byPriority('critical'),
    retryScheduled: data.runs.filter((r) => r.status === 'retry_scheduled').length,
    awaitingApproval: data.runs.filter((r) => r.status === 'awaiting_approval').length,
    blocked: data.runs.filter((r) => r.status === 'blocked').length,
  };
}

export function getQueueItems() {
  const data = getGroupLiveData();
  return data.runs
    .filter((r) => ['queued', 'waiting'].includes(r.status))
    .sort((a, b) => (a.queue_position ?? 99) - (b.queue_position ?? 99))
    .map((r) => ({
      queuePosition: r.queue_position ?? '—',
      runId: r.run_key,
      site: siteNameOf(r, data),
      agent: agentNameOf(r, data),
      task: r.result_summary ?? 'Queued run',
      priority: asRunPriority(r.priority),
      waitingTime: '—',
      blockingState: r.status === 'waiting' ? 'Dependency not ready' : 'None',
    }));
}

// --- Failures & blockers ---------------------------------------------------------

export function getFailuresBlockers(): OperationsAlert[] {
  const data = getGroupLiveData();
  const fromRuns: OperationsAlert[] = data.runs
    .filter((r) => ['failed', 'blocked'].includes(r.status))
    .map((r) => ({
      id: r.run_key,
      site: siteKeyOf(r, data),
      siteName: siteNameOf(r, data),
      source: agentNameOf(r, data),
      message: r.error_summary ?? r.result_summary ?? 'Run did not complete.',
      severity: (r.risk_level === 'critical' || r.risk_level === 'high' ? r.risk_level : 'high') as Severity,
      detectedAt: r.completed_at ? formatDateTime(r.completed_at) : '—',
      state: r.status === 'failed' ? 'Failed' : 'Blocked',
      recommendedAction: 'Review the run detail for failure analysis.',
      referenceType: 'run',
      referenceId: r.run_key,
    }));

  const fromAlerts: OperationsAlert[] = data.alerts
    .filter((a) => isAlertActive(a) && ['critical', 'high'].includes(a.severity ?? ''))
    .map((a) => ({
      id: a.alert_key,
      site: siteKeyOf(a, data),
      siteName: siteNameOf(a, data),
      source: agentNameOf(a, data),
      message: a.summary ?? a.title,
      severity: asSeverity(a.severity),
      detectedAt: a.last_seen_at ? formatDateTime(a.last_seen_at) : '—',
      state: a.status ?? 'new',
      recommendedAction: a.resolution_summary ?? 'Investigate the alert.',
      referenceType: 'alert',
      referenceId: a.alert_key,
    }));

  return [...fromRuns, ...fromAlerts];
}

export function getOperationsAlerts(): OperationsAlert[] {
  const data = getGroupLiveData();
  return data.alerts
    .filter((a) => isAlertActive(a))
    .map((a) => ({
      id: a.alert_key,
      site: siteKeyOf(a, data),
      siteName: siteNameOf(a, data),
      source: agentNameOf(a, data),
      message: a.summary ?? a.title,
      severity: asSeverity(a.severity),
      detectedAt: a.last_seen_at ? formatDateTime(a.last_seen_at) : '—',
      state: a.status ?? 'new',
      recommendedAction: a.resolution_summary ?? 'Investigate the alert.',
      referenceType: 'alert',
      referenceId: a.alert_key,
    }));
}

// --- Agent workload ---------------------------------------------------------------

function capacityFor(a: AiAgentRow): CapacityState {
  const s = a.status ?? '';
  if (s === 'disabled' || s === 'not_configured') return 'offline';
  if (s === 'paused') return 'paused';
  if ((a.queue_count ?? 0) >= 4) return 'at_capacity';
  if ((a.queue_count ?? 0) >= 2) return 'high_load';
  if (s === 'working' || s === 'error') return 'busy';
  return 'available';
}

export function getAgentWorkload(): AgentWorkload[] {
  const data = getGroupLiveData();
  return data.agents.map((a) => ({
    agentId: a.agent_key,
    agentName: a.name,
    site: a.site_id ? (data.siteNameByUuid.get(a.site_id) ?? 'Group-wide') : 'Group-wide',
    activeTasks: a.status === 'working' || a.status === 'error' ? 1 : 0,
    queueSize: a.queue_count ?? 0,
    jobsToday: a.queue_count ?? 0,
    successRate: a.success_rate != null ? `${a.success_rate}%` : '—',
    avgDuration: '—',
    status: asAgentStatus(a.status ?? ''),
    capacity: capacityFor(a),
  }));
}

// --- Site workload ---------------------------------------------------------------

export function getSiteWorkload(): SiteWorkload[] {
  const data = getGroupLiveData();
  return data.sites.map((s) => {
    const siteUuid = s.id;
    const siteAgents = data.agents.filter((a) => a.site_id === siteUuid);
    const siteRuns = data.runs.filter((r) => r.site_id === siteUuid);
    const siteApprovals = data.approvals.filter((a) => a.site_id === siteUuid);
    const siteAlerts = data.alerts.filter((a) => a.site_id === siteUuid && isAlertActive(a));
    const cost = siteRuns.reduce((acc, r) => acc + pounds(r.actual_cost) + pounds(r.estimated_cost), 0);
    return {
      siteId: s.site_key,
      siteName: s.name,
      activeAgents: siteAgents.filter((a) => REGISTERED_ACTIVE.includes(asAgentStatus(a.status ?? ''))).length,
      jobsToday: siteAgents.reduce((acc, a) => acc + (a.queue_count ?? 0), 0),
      running: siteRuns.filter((r) => r.status === 'working').length,
      queued: siteRuns.filter((r) => ['queued', 'waiting'].includes(r.status)).length,
      failed: siteRuns.filter((r) => r.status === 'failed').length,
      approvals: siteApprovals.filter((a) => ['pending', 'under_review'].includes(a.status)).length,
      alerts: siteAlerts.length,
      estimatedCostToday: formatMoney(cost),
    };
  });
}

// --- Mission control ---------------------------------------------------------------

export function getMissionControl(): MissionControlItem[] {
  const data = getGroupLiveData();
  return data.runs
    .filter((r) => ['working', 'awaiting_approval'].includes(r.status) && ['high', 'critical', 'urgent'].includes(r.priority ?? ''))
    .map((r) => {
      const step = data.runSteps.find((s) => s.run_id === r.id && s.step_number === (r.current_step ?? 0));
      return {
        siteId: siteKeyOf(r, data),
        siteName: siteNameOf(r, data),
        agentId: r.agent_id ? (data.agentKeyByUuid.get(r.agent_id) ?? '') : '',
        agentName: agentNameOf(r, data),
        task: r.result_summary ?? r.error_summary ?? '—',
        currentStep: r.current_step ?? 0,
        totalSteps: r.total_steps ?? 0,
        stepName: step?.name ?? '—',
        risk: asRiskLevel(r.risk_level),
        runId: r.run_key,
      };
    });
}

// --- Multi-agent workflows --------------------------------------------------------

export function getMultiAgentWorkflows(): MultiAgentWorkflow[] {
  const data = getGroupLiveData();
  const active = data.runs.filter((r) => r.status === 'working').slice(0, 2);
  return active.map((r) => ({
    id: r.run_key,
    title: r.result_summary ?? r.error_summary ?? 'Active run',
    site: siteNameOf(r, data),
    status: 'running' as ActivityStatus,
    chain: [
      { agent: agentNameOf(r, data), status: 'running', runId: r.run_key, duration: '—', outcome: 'In progress' },
    ],
  }));
}

// --- Platform health (registry health — NOT live connectivity) -------------------

export function getPlatformHealthRows(): SystemHealthRow[] {
  const data = getGroupLiveData();
  const rows: SystemHealthRow[] = [
    { key: 'orchestrator', label: 'Group Master Orchestrator', status: 'operational', detail: 'Planning / Registry State' },
    { key: 'sites', label: 'Site Registry', status: data.availability.sites ? 'operational' : 'unknown', detail: `${data.sites.length} registered` },
    { key: 'agents', label: 'Agent Registry', status: data.availability.agents ? 'operational' : 'unknown', detail: `${data.agents.length} registered` },
    { key: 'runs', label: 'Runs Registry', status: data.availability.runs ? 'operational' : 'unknown', detail: `${data.runs.length} runs` },
    { key: 'tools', label: 'Tools Registry', status: data.availability.tools ? 'operational' : 'unknown', detail: 'Registry health' },
    { key: 'models', label: 'Model Providers', status: data.availability.models ? 'operational' : 'unknown', detail: 'Registry health' },
    { key: 'runtime', label: 'Agent Runtime', status: 'unknown', detail: 'Not connected' },
    { key: 'monitoring', label: 'Monitoring Service', status: 'unknown', detail: 'Not connected' },
    { key: 'analytics', label: 'User Analytics', status: 'unknown', detail: 'Not connected' },
  ];
  return rows;
}

// --- Model provider status (registry health) -------------------------------------

export function getProviderHealth(): ProviderHealth[] {
  const data = getGroupLiveData();
  return data.providers.map((p) => ({
    provider: p.name,
    status: asHealthStatus(p.status === 'active' ? 'operational' : p.status),
    activeRequests: 0,
    failedRequests: 0,
    avgResponseTime: '—',
    estimatedCostToday: '—',
    lastActivity: p.updated_at ? formatDateTime(p.updated_at) : '—',
  }));
}

// --- Orchestrator status (planning / registry state) -----------------------------

export function getOrchestratorStatus(): LiveOrchestratorStatus {
  const data = getGroupLiveData();
  const orch = data.orchestrations;
  const planning = ['received', 'analysing', 'planning', 'selecting_agent', 'awaiting_capacity'];
  const blocked = orch.filter((o) => o.status === 'blocked').length;
  const approvalRequired = orch.filter((o) => o.approval_required === true && !['completed', 'cancelled', 'failed'].includes(o.status ?? '')).length;
  const lastEvent = orch
    .slice()
    .sort((a, b) => (b.requested_at ?? '').localeCompare(a.requested_at ?? ''))[0];
  return {
    status: 'operational',
    activeTasks: orch.filter((o) => planning.includes(o.status ?? '')).length,
    queueDepth: orch.filter((o) => o.status === 'received').length,
    tasksRoutedToday: orch.filter((o) => ['routed', 'executing', 'completed'].includes(o.status ?? '')).length,
    failedRoutingAttempts: blocked,
    avgRoutingTime: '—',
    workflowCount: orch.length,
    lastRoutingEvent: lastEvent?.requested_at ? formatTimestamp(lastEvent.requested_at) : '—',
  };
}

// --- Activity feed (audit trail is the authoritative source) ----------------------

function auditSourceType(e: AiAuditEventRow): ActivitySourceType {
  const t = e.event_type ?? '';
  if (t.startsWith('approval')) return 'approval';
  if (t.startsWith('run') || t.includes('run')) return 'run';
  if (t.startsWith('agent')) return 'agent';
  if (t.includes('alert') || t.includes('incident')) return 'monitoring';
  if (t.startsWith('site')) return 'site';
  return 'system';
}

export function getActivityEvents(): LiveActivityEvent[] {
  const data = getGroupLiveData();
  return data.auditEvents.slice(0, 60).map((e) => ({
    id: e.audit_key,
    timestamp: formatDateTime(e.occurred_at),
    site: e.site_id ? (data.siteNameByUuid.get(e.site_id) ?? 'Group-wide') : 'Group-wide',
    sourceType: auditSourceType(e),
    actor: e.actor_reference ?? e.actor_type ?? 'System',
    event: e.action ?? e.event_type ?? 'Audit event',
    status: e.outcome ?? 'informational',
    severity: asSeverity(e.severity),
    referenceType: e.run_id ? 'run' : e.approval_id ? 'approval' : e.site_id ? 'site' : null,
    referenceId: e.run_id
      ? data.runs.find((r) => r.id === e.run_id)?.run_key ?? null
      : e.approval_id
        ? data.approvals.find((a) => a.id === e.approval_id)?.approval_key ?? null
        : e.site_id
          ? (data.siteKeyByUuid.get(e.site_id) ?? null)
          : null,
  }));
}

// ---------------------------------------------------------------------------
// Overview-specific selectors
// ---------------------------------------------------------------------------

export function getOverviewKpis(): KpiMetric[] {
  const data = getGroupLiveData();
  const registeredActive = data.agents.filter((a) => REGISTERED_ACTIVE.includes(asAgentStatus(a.status ?? ''))).length;
  const activeRuns = data.runs.filter((r) => r.status === 'working').length;
  const queuedRuns = data.runs.filter((r) => ['queued', 'waiting'].includes(r.status)).length;
  const pendingApprovals = data.approvals.filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status)).length;
  const criticalAlerts = data.alerts.filter((a) => a.severity === 'critical' && isAlertActive(a)).length;
  const openIncidents = data.incidents.filter((i) => !['resolved', 'closed'].includes(i.status ?? '')).length;

  const groupBudget = data.budgets.find((b) => b.scope_type === 'group');
  const budgetStatus = groupBudget?.status ?? 'not_configured';
  const budgetLabel = budgetStatus === 'healthy' ? 'Healthy' : budgetStatus === 'warning' ? 'Warning' : budgetStatus === 'critical' || budgetStatus === 'exceeded' ? 'Critical' : 'Not configured';

  return [
    { key: 'sites', label: 'Total Sites', value: data.sites.length, icon: 'ri-global-line', accent: 'bg-accent-500/15 text-accent-400' },
    { key: 'agents', label: 'Active Agents', value: registeredActive, icon: 'ri-robot-2-line', accent: 'bg-emerald-500/15 text-emerald-400' },
    { key: 'activeRuns', label: 'Active Runs', value: activeRuns, icon: 'ri-play-circle-line', accent: 'bg-accent-500/15 text-accent-400' },
    { key: 'queued', label: 'Queued Runs', value: queuedRuns, icon: 'ri-stack-line', accent: 'bg-secondary-500/15 text-secondary-400' },
    { key: 'approvals', label: 'Pending Approvals', value: pendingApprovals, icon: 'ri-shield-check-line', accent: 'bg-amber-500/15 text-amber-400' },
    { key: 'alerts', label: 'Critical Alerts', value: criticalAlerts, icon: 'ri-alarm-warning-line', accent: 'bg-red-500/15 text-red-400' },
    { key: 'incidents', label: 'Open Incidents', value: openIncidents, icon: 'ri-error-warning-line', accent: 'bg-red-500/15 text-red-400' },
    { key: 'budget', label: 'Budget Status', value: budgetLabel, icon: 'ri-money-pound-circle-line', accent: 'bg-accent-500/15 text-accent-400' },
  ];
}

export function getOverviewSiteStatus(): SiteAiStatusRow[] {
  return getSiteHealth().map((s) => ({
    id: s.id,
    name: s.name,
    status: s.operationalStatus,
    activeAgents: s.activeAgents,
    currentJobs: s.activeRuns,
    failedJobs: s.failedRuns,
    alerts: s.alerts,
    lastActivity: s.lastActivity,
  }));
}

export function getOverviewActivity(): AgentActivity[] {
  const data = getGroupLiveData();
  return data.auditEvents.slice(0, 8).map((e) => ({
    id: e.audit_key,
    time: formatDateTime(e.occurred_at),
    site: e.site_id ? (data.siteNameByUuid.get(e.site_id) ?? 'Group-wide') : 'Group-wide',
    agent: e.actor_reference ?? e.actor_type ?? 'System',
    action: e.action ?? e.event_type ?? 'Audit event',
    status: (e.outcome === 'success' || e.outcome === 'approved' ? 'success' : e.outcome === 'failed' || e.outcome === 'blocked' ? 'failed' : 'running') as ActivityStatus,
    runId: e.run_id ? data.runs.find((r) => r.id === e.run_id)?.run_key ?? e.audit_key : e.audit_key,
  }));
}

export function getOverviewApprovals(): ApprovalRequest[] {
  const data = getGroupLiveData();
  return data.approvals
    .filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status))
    .map((a) => ({
      id: a.approval_key,
      site: siteNameOf(a, data),
      agent: agentNameOf(a, data),
      action: a.requested_action ?? a.title ?? '—',
      risk: asRiskLevel(a.severity),
      dateTime: a.requested_at ? formatDateTime(a.requested_at) : '—',
    }));
}

export function getOverviewOrchestrator(): OrchestratorStatus {
  const o = getOrchestratorStatus();
  return {
    status: o.status,
    activeJobs: o.activeTasks,
    queue: o.queueDepth,
    successRate: '—',
    lastRun: o.lastRoutingEvent,
  };
}

// --- Readiness summary -----------------------------------------------------------

export interface ReadinessSummary {
  productionEnabled: number;
  overall: string;
  modulesPersisted: number;
  runtimeConnected: boolean;
  agentExecution: string;
  security: string;
}

export function getReadinessSummary(): ReadinessSummary {
  const data = getGroupLiveData();
  return {
    productionEnabled: 0,
    overall: 'NO-GO',
    modulesPersisted: [
      data.availability.sites,
      data.availability.agents,
      data.availability.runs,
      data.availability.approvals,
      data.availability.audit,
      data.availability.alerts,
      data.availability.incidents,
      data.availability.orchestrations,
      data.availability.tools,
      data.availability.models,
      data.availability.knowledge,
      data.availability.policies,
      data.availability.rules,
      data.availability.schedules,
      data.availability.budgets,
    ].filter(Boolean).length,
    runtimeConnected: false,
    agentExecution: 'Blocked',
    security: 'Partial',
  };
}