// ============================================================================
// DFP AI Operations — Agent detail selectors (Prompt 02).
//
// Pure read-only derivations for the agent-details drawer, over the EXISTING
// shared sources only (no new fetch/table/polling):
//   * getGroupLiveData()   → agent row, site, runs, approvals, alerts.
//   * getN8nData()         → explicit stored workflow mapping (agent_id).
//   * getRuntimeControlsState() → agent execution gate (registry vs runtime).
//   * getHalHost()         → assigned runtime host (execution host).
//   * getSiteManagerReport → the site manager's live report (where mapped).
//
// Honesty guarantees:
//   * Relationships use STABLE ids only (agent_id / site_id / workflow_key /
//     n8n_workflow_id / approval_key / run_key / alert_key) — never
//     display-name substrings.
//   * "Assigned manager" is verified via the site-scoped orchestration category
//     (or the group orchestrator for managers/shared agents); duplicate
//     managers are surfaced, never silently collapsed.
//   * Registry pause/disable (ai_operations_agents.status) is kept SEPARATE
//     from actual runtime pause/stop (there is no runtime stop path — shown
//     honestly as unavailable).
//   * Workflow execution result vs business health vs report freshness vs host
//     connectivity remain four independent signals.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { getRuntimeControlsState } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { getHalHost } from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import { getGroupOrchestrator } from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import { getSiteManagerReport, type SiteManagerReport } from '@/pages/ai-operations/network/siteManagerReportSelectors';
import type { AiAgentRow, AiRunRow } from '@/lib/ai-operations';

// --- Shapes -------------------------------------------------------------------

export interface AgentRunSummary {
  runKey: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationLabel: string | null;
  summary: string | null;
}

export interface AgentAlertSummary {
  alertKey: string;
  severity: string;
  title: string;
  status: string;
}

export interface AgentApprovalSummary {
  approvalKey: string;
  requestedAction: string;
  status: string;
}

export interface AgentWorkflowInfo {
  workflowKey: string;
  n8nWorkflowId: string | null;
  name: string;
  runtimeStatus: string | null;
  executionMode: string | null;
}

export interface AgentRuntimeInfo {
  hostName: string;
  executionEnabled: boolean;
  agentGate: { enabled: boolean; execution_allowed: boolean } | null;
}

export interface AgentDetailModel {
  agentId: string;
  agentKey: string;
  name: string;
  description: string | null;
  category: string | null;
  categoryLabel: string;
  autonomy: string | null;
  status: string;
  health: string;
  siteKey: string | null;
  siteName: string | null;
  assignedManagerKey: string | null;
  assignedManagerName: string | null;
  duplicateManagers: boolean;
  workflows: AgentWorkflowInfo[];
  runtime: AgentRuntimeInfo;
  currentRun: AgentRunSummary | null;
  lastSuccessfulRun: AgentRunSummary | null;
  recentRuns: AgentRunSummary[];
  alerts: AgentAlertSummary[];
  approvals: AgentApprovalSummary[];
  report: SiteManagerReport | null;
}

// --- Helpers ------------------------------------------------------------------

function categoryLabel(category: string | null | undefined): string {
  const c = (category ?? '').trim();
  if (!c) return 'Other';
  const known: Record<string, string> = {
    orchestration: 'Orchestration',
    support: 'Support',
    diagnostics: 'Diagnostics',
    security: 'Security',
    monitoring: 'Monitoring',
    data: 'Data',
    uat: 'UAT',
    repair: 'Repair',
    communications: 'Communications',
    billing: 'Billing',
    crm: 'CRM / Leads',
    compliance: 'Compliance',
    operations: 'Operations',
    matching: 'Matching',
    planning: 'Planning',
    testing: 'Testing',
    development: 'Development',
    reporting: 'Reporting',
    infrastructure: 'Infrastructure',
    other: 'Other',
  };
  return known[c] ?? c.replace(/_/g, ' ');
}

function isOrchestration(a: AiAgentRow): boolean {
  return (a.category ?? '').toLowerCase() === 'orchestration';
}

function durationLabel(started: string | null, completed: string | null): string | null {
  if (!started || !completed) return null;
  const a = new Date(started).getTime();
  const b = new Date(completed).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  const ms = b - a;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function toRunSummary(r: AiRunRow): AgentRunSummary {
  return {
    runKey: r.run_key,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    durationLabel: durationLabel(r.started_at, r.completed_at),
    summary: r.result_summary ?? r.error_summary ?? null,
  };
}

const INFLIGHT = ['working', 'awaiting_approval', 'waiting', 'retry_scheduled', 'paused', 'blocked'];
const SUCCESS = ['completed', 'partially_completed'];

// --- Builder -------------------------------------------------------------------

/**
 * Full detail model for one agent (resolved by its stable ai_operations_agents.id
 * UUID). Read-only; returns null when the agent is not in the live registry.
 */
export function getAgentDetail(agentId: string): AgentDetailModel | null {
  const data = getGroupLiveData();
  const agent = data.agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const n8n = getN8nData();
  const controls = getRuntimeControlsState();
  const hal = getHalHost();
  const group = getGroupOrchestrator();

  // Site membership + manager resolution.
  const site = agent.site_id ? data.sites.find((s) => s.id === agent.site_id) ?? null : null;
  const siteKey = site?.site_key ?? null;
  const siteName = site?.name ?? null;

  let assignedManagerKey: string | null = null;
  let assignedManagerName: string | null = null;
  let duplicateManagers = false;

  if (isOrchestration(agent) || !site) {
    // Managers and group/shared agents report to the group orchestrator.
    assignedManagerKey = group?.agentKey ?? null;
    assignedManagerName = group?.name ?? null;
  } else {
    const managers = data.agents.filter((a) => a.site_id === site.id && isOrchestration(a));
    duplicateManagers = managers.length > 1;
    const manager = managers[0] ?? null;
    assignedManagerKey = manager?.agent_key ?? null;
    assignedManagerName = manager?.name ?? null;
  }

  // Explicit stored workflow mapping (ai_n8n_workflow_registry.agent_id → row),
  // falling back to the site mapping only when the agent is the site manager.
  const workflows: AgentWorkflowInfo[] = n8n.workflows
    .filter((w) => w.agent_id === agent.id || (isOrchestration(agent) && w.site_id === site?.id && !w.agent_id))
    .map((w) => ({
      workflowKey: w.workflow_key,
      n8nWorkflowId: w.n8n_workflow_id,
      name: w.name ?? w.workflow_key,
      runtimeStatus: w.runtime_status,
      executionMode: w.execution_mode,
    }));

  // Assigned runtime host (HAL execution host) + agent-level execution gate.
  const agentGate = controls.controls.find(
    (c) => c.control_type === 'agent_execution_gate' && c.agent_id === agent.id,
  );
  const runtime: AgentRuntimeInfo = {
    hostName: hal ? hal.name : 'Not registered',
    executionEnabled: hal?.executionEnabled ?? false,
    agentGate: agentGate
      ? { enabled: agentGate.enabled, execution_allowed: agentGate.execution_allowed }
      : null,
  };

  // Runs scoped to this agent.
  const agentRuns = data.runs.filter((r) => r.agent_id === agent.id);
  const sorted = [...agentRuns].sort((a, b) =>
    (b.started_at ?? b.created_at ?? '').localeCompare(a.started_at ?? a.created_at ?? ''),
  );
  const currentRun = sorted.find((r) => INFLIGHT.includes(r.status)) ?? null;
  const lastSuccessfulRun = sorted.find((r) => SUCCESS.includes(r.status)) ?? null;
  const recentRuns = sorted.slice(0, 8).map(toRunSummary);

  // Related alerts + pending approvals.
  const alerts: AgentAlertSummary[] = data.alerts
    .filter((a) => a.agent_id === agent.id && !['resolved', 'closed', 'suppressed'].includes(a.status ?? ''))
    .map((a) => ({
      alertKey: a.alert_key,
      severity: a.severity ?? 'info',
      title: a.title,
      status: a.status ?? 'new',
    }));

  const approvals: AgentApprovalSummary[] = data.approvals
    .filter((a) => a.agent_id === agent.id && ['pending', 'under_review', 'more_info_required'].includes(a.status))
    .map((a) => ({
      approvalKey: a.approval_key,
      requestedAction: a.requested_action ?? a.title ?? '—',
      status: a.status,
    }));

  return {
    agentId: agent.id,
    agentKey: agent.agent_key,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    categoryLabel: categoryLabel(agent.category),
    autonomy: agent.autonomy_level,
    status: agent.status,
    health: agent.health,
    siteKey,
    siteName,
    assignedManagerKey,
    assignedManagerName,
    duplicateManagers,
    workflows,
    runtime,
    currentRun: currentRun ? toRunSummary(currentRun) : null,
    lastSuccessfulRun: lastSuccessfulRun ? toRunSummary(lastSuccessfulRun) : null,
    recentRuns,
    alerts,
    approvals,
    report: siteKey ? getSiteManagerReport(siteKey) : null,
  };
}