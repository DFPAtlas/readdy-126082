// ============================================================================
// AI Operations — Live Operations derived-data layer.
//
// Pure helper functions that transform the central Site / Agent / Run /
// Approval registries (plus the small Live-specific demo feed) into the
// operational views rendered by the Mission Control screen.
//
// No record is duplicated here — these are read-only projections over the
// existing demo datasets. No live polling, execution or writes occur.
// ============================================================================

import type {
  AiTaskRun,
  AiApproval,
  AgentRegistryRecord,
  SiteRegistryRecord,
  SystemHealthRow,
  OperationsAlert,
  AgentWorkload,
  SiteWorkload,
  ProviderHealth,
  MissionControlItem,
  MultiAgentWorkflow,
  SiteHealthCard,
  LiveOrchestratorStatus,
  CapacityState,
  RunChainNode,
  RiskLevel,
  LiveActivityEvent,
} from '@/pages/ai-operations/types';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoRuns } from '@/mocks/ai-operations-runs';
import { demoApprovals } from '@/mocks/ai-operations-approvals';
import { demoLiveActivityEvents, demoOperationsAlerts, demoProviderHealth, demoActiveWorkflowChain } from '@/mocks/ai-operations-live';

function pounds(value: string): number {
  const n = parseFloat(value.replace(/[£,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sumCost(runs: AiTaskRun[]): string {
  const total = runs.reduce((acc, r) => acc + pounds(r.actualCost), 0);
  return `£${total.toFixed(2)}`;
}

const sites = demoSites as SiteRegistryRecord[];
const agents = demoAgents as AgentRegistryRecord[];
const runs = demoRuns as AiTaskRun[];
const approvals = demoApprovals as AiApproval[];
const alerts = demoOperationsAlerts as OperationsAlert[];

// --- Status bar metrics ---------------------------------------------------------

export function getStatusBarMetrics() {
  return {
    sitesHealthy: sites.filter((s) => s.operationalStatus === 'healthy').length,
    sitesTotal: sites.length,
    agentsWorking: agents.filter((a) => a.status === 'working').length,
    activeRuns: runs.filter((r) => r.status === 'working').length,
    queuedRuns: runs.filter((r) => r.status === 'queued').length,
    pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
    failedRuns: runs.filter((r) => r.status === 'failed').length,
    criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
    aiCostToday: sumCost(runs),
  };
}

// --- Site health matrix ---------------------------------------------------------

export function getSiteHealth(): SiteHealthCard[] {
  return sites.map((s) => {
    const siteAgents = agents.filter((a) => a.assignedSite === s.id);
    const siteRuns = runs.filter((r) => r.siteId === s.id);
    const siteApprovals = approvals.filter((a) => a.siteId === s.id);
    const siteAlerts = alerts.filter((a) => a.site === s.id);
    return {
      id: s.id,
      name: s.name,
      operationalStatus: s.operationalStatus,
      aiStatus: s.aiStatus,
      activeAgents: siteAgents.filter((a) => ['working', 'active', 'error'].includes(a.status)).length,
      activeRuns: siteRuns.filter((r) => r.status === 'working').length,
      queuedRuns: siteRuns.filter((r) => ['queued', 'waiting'].includes(r.status)).length,
      failedRuns: siteRuns.filter((r) => r.status === 'failed').length,
      pendingApprovals: siteApprovals.filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status)).length,
      alerts: siteAlerts.length,
      lastActivity: s.lastAgentActivity,
    };
  });
}

// --- Agents working now ---------------------------------------------------------

export function getAgentsWorkingNow(): AgentRegistryRecord[] {
  return agents.filter((a) => ['working', 'error'].includes(a.status));
}

// --- Active runs ----------------------------------------------------------------

const INFLIGHT_STATUSES = ['working', 'awaiting_approval', 'waiting', 'retry_scheduled', 'paused', 'blocked'];

export function getActiveRuns(): AiTaskRun[] {
  return runs.filter((r) => INFLIGHT_STATUSES.includes(r.status));
}

// --- Approval watch -------------------------------------------------------------

const SEVERITY_ORDER: Record<RiskLevel, number> = { low: 3, medium: 2, high: 1, critical: 0 };

export function getApprovalWatch(): AiApproval[] {
  return approvals
    .filter((a) => ['pending', 'under_review'].includes(a.status))
    .sort((x, y) => (SEVERITY_ORDER[x.severity] ?? 9) - (SEVERITY_ORDER[y.severity] ?? 9));
}

// --- Queue monitor --------------------------------------------------------------

export function getQueueMetrics() {
  const queued = runs.filter((r) => ['queued', 'waiting'].includes(r.status));
  const byPriority = (p: string) => queued.filter((r) => r.priority === p).length;
  return {
    totalQueued: queued.length,
    highPriority: byPriority('high'),
    urgent: byPriority('urgent'),
    critical: byPriority('critical'),
    retryScheduled: runs.filter((r) => r.status === 'retry_scheduled').length,
    awaitingApproval: runs.filter((r) => r.status === 'awaiting_approval').length,
    blocked: runs.filter((r) => r.status === 'blocked').length,
  };
}

const WAIT_BY_POSITION = ['1m', '4m', '9m', '12m', '18m', '24m', '30m'];

export function getQueueItems() {
  return runs
    .filter((r) => ['queued', 'waiting'].includes(r.status))
    .sort((a, b) => (a.queuePosition ?? 99) - (b.queuePosition ?? 99))
    .map((r) => ({
      queuePosition: r.queuePosition ?? '—',
      runId: r.id,
      site: r.siteName,
      agent: r.agentName,
      task: r.taskName,
      priority: r.priority,
      waitingTime: WAIT_BY_POSITION[Math.min(Math.max((r.queuePosition ?? 1) - 1, 0), WAIT_BY_POSITION.length - 1)],
      blockingState: r.status === 'waiting' ? 'Dependency not ready' : 'None',
    }));
}

// --- Agent workload -------------------------------------------------------------

function capacityFor(a: AgentRegistryRecord): CapacityState {
  if (a.status === 'disabled' || a.status === 'not_configured') return 'offline';
  if (a.status === 'paused') return 'paused';
  if (a.queueCount >= 4) return 'at_capacity';
  if (a.queueCount >= 2) return 'high_load';
  if (a.status === 'working' || a.status === 'error') return 'busy';
  return 'available';
}

export function getAgentWorkload(): AgentWorkload[] {
  return agents.map((a) => ({
    agentId: a.id,
    agentName: a.name,
    site: a.scope,
    activeTasks: a.status === 'working' || a.status === 'error' ? 1 : 0,
    queueSize: a.queueCount,
    jobsToday: a.jobsToday,
    successRate: a.successRate,
    avgDuration: a.avgRunDuration,
    status: a.status,
    capacity: capacityFor(a),
  }));
}

// --- Site workload --------------------------------------------------------------

export function getSiteWorkload(): SiteWorkload[] {
  return sites.map((s) => {
    const siteAgents = agents.filter((a) => a.assignedSite === s.id);
    const siteRuns = runs.filter((r) => r.siteId === s.id);
    const siteApprovals = approvals.filter((a) => a.siteId === s.id);
    const siteAlerts = alerts.filter((a) => a.site === s.id);
    return {
      siteId: s.id,
      siteName: s.name,
      activeAgents: siteAgents.filter((a) => ['working', 'active', 'error'].includes(a.status)).length,
      jobsToday: siteAgents.reduce((acc, a) => acc + a.jobsToday, 0),
      running: siteRuns.filter((r) => r.status === 'working').length,
      queued: siteRuns.filter((r) => ['queued', 'waiting'].includes(r.status)).length,
      failed: siteRuns.filter((r) => r.status === 'failed').length,
      approvals: siteApprovals.filter((a) => ['pending', 'under_review'].includes(a.status)).length,
      alerts: siteAlerts.length,
      estimatedCostToday: sumCost(siteRuns),
    };
  });
}

// --- Mission control board ------------------------------------------------------

export function getMissionControl(): MissionControlItem[] {
  return runs
    .filter((r) => ['working', 'awaiting_approval'].includes(r.status) && ['high', 'critical', 'urgent'].includes(r.priority))
    .map((r) => {
      const step = r.steps && r.steps.length >= r.currentStep ? r.steps[r.currentStep - 1] : null;
      return {
        siteId: r.siteId,
        siteName: r.siteName,
        agentId: r.agentId,
        agentName: r.agentName,
        task: r.taskName,
        currentStep: r.currentStep,
        totalSteps: r.totalSteps,
        stepName: step ? step.name : '—',
        risk: r.risk,
        runId: r.id,
      };
    });
}

// --- Multi-agent workflows ------------------------------------------------------

export function getMultiAgentWorkflows(): MultiAgentWorkflow[] {
  const workflows: MultiAgentWorkflow[] = [];
  const active = runs.find((r) => r.id === 'RUN-3C9B7');
  const parent = runs.find((r) => r.id === 'RUN-A1000');

  if (active) {
    workflows.push({
      id: active.id,
      title: active.taskName,
      site: active.siteName,
      status: 'running',
      chain: demoActiveWorkflowChain as RunChainNode[],
    });
  }
  if (parent && parent.chain && parent.chain.length) {
    workflows.push({
      id: parent.id,
      title: parent.taskName,
      site: parent.siteName,
      status: 'success',
      chain: parent.chain,
    });
  }
  return workflows;
}

// --- Failures & blockers --------------------------------------------------------

export function getFailuresBlockers(): OperationsAlert[] {
  const fromRuns: OperationsAlert[] = runs
    .filter((r) => ['failed', 'blocked'].includes(r.status))
    .map((r) => ({
      id: r.id,
      site: r.siteId,
      siteName: r.siteName,
      source: r.agentName,
      message: r.errorSummary || r.resultSummary,
      severity: (r.risk === 'critical' || r.risk === 'high' ? r.risk : 'high') as OperationsAlert['severity'],
      detectedAt: r.completedTime !== '—' ? r.completedTime : r.startedTime,
      state: r.status === 'failed' ? 'Failed' : 'Blocked',
      recommendedAction: r.failure?.recommendedAction || r.result.nextAction,
      referenceType: 'run',
      referenceId: r.id,
    }));

  const fromAlerts: OperationsAlert[] = alerts.filter((a) => ['critical', 'high'].includes(a.severity));

  return [...fromRuns, ...fromAlerts];
}

// --- Platform health ------------------------------------------------------------

export function getPlatformHealthRows(): SystemHealthRow[] {
  return [
    { key: 'orchestrator', label: 'Group Master Orchestrator', status: 'operational', detail: 'v2.4.1' },
    { key: 'supabase', label: 'Supabase', status: 'operational', detail: 'eu-west-1' },
    { key: 'n8n', label: 'n8n Automation', status: 'degraded', detail: 'The Forge workflow' },
    { key: 'models', label: 'AI Model Providers', status: 'degraded', detail: '1 provider latency' },
    { key: 'notifications', label: 'Notification Service', status: 'operational', detail: 'All channels' },
    { key: 'monitoring', label: 'Monitoring Service', status: 'operational', detail: 'All checks green' },
    { key: 'email', label: 'Email', status: 'degraded', detail: 'GuardianHub Resend' },
    { key: 'billing', label: 'Billing', status: 'operational', detail: 'Stripe' },
    { key: 'github', label: 'Repository / GitHub', status: 'operational', detail: 'All repos synced' },
    { key: 'readdy', label: 'Readdy', status: 'operational', detail: 'Platform API' },
  ];
}

// --- Model provider status ------------------------------------------------------

export function getProviderHealth(): ProviderHealth[] {
  return demoProviderHealth as ProviderHealth[];
}

// --- Orchestrator status --------------------------------------------------------

export function getOrchestratorStatus(): LiveOrchestratorStatus {
  const tasksRoutedToday = agents.reduce((acc, a) => acc + a.jobsToday, 0);
  return {
    status: 'operational',
    activeTasks: 18,
    queueDepth: 5,
    tasksRoutedToday,
    failedRoutingAttempts: 3,
    avgRoutingTime: '1.2s',
    workflowCount: 38,
    lastRoutingEvent: '10:44:02',
  };
}

// --- Activity feed & alerts -----------------------------------------------------

export function getActivityEvents(): LiveActivityEvent[] {
  return demoLiveActivityEvents as LiveActivityEvent[];
}

export function getOperationsAlerts(): OperationsAlert[] {
  return alerts;
}