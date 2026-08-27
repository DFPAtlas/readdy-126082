// ============================================================================
// AI Operations — Wallboard / Big Screen derived-data layer.
//
// Thin read-only projections over the central registries (via the existing
// Live Operations / Cost selectors). No record is duplicated here and no
// production polling, execution or write occurs — the wallboard renders the
// same demo data the Live Operations screen already uses, only reformatted
// for a large, distance-viewed display.
// ============================================================================

import type {
  SiteHealthCard,
  OperationsAlert,
  LiveActivityEvent,
  SystemHealthRow,
  AgentRegistryRecord,
  AiApproval,
} from '@/pages/ai-operations/types';
import {
  getStatusBarMetrics,
  getSiteHealth,
  getAgentsWorkingNow,
  getMissionControl,
  getApprovalWatch,
  getPlatformHealthRows,
  getActivityEvents,
  getOperationsAlerts,
} from '@/pages/ai-operations/live/selectors';
import { getCostSummary } from '@/pages/ai-operations/costs/selectors';
import { demoBudgets } from '@/mocks/ai-operations-costs';
import { demoAgents } from '@/mocks/ai-operations-agents';

// --- Primary KPI strip ----------------------------------------------------------

export interface WallboardKpis {
  sitesHealthy: string;
  agentsOnline: number;
  agentsWorking: number;
  activeRuns: number;
  queuedRuns: number;
  pendingApprovals: number;
  criticalAlerts: number;
  failedRuns: number;
  aiCostToday: string;
}

export function getWallboardKpis(): WallboardKpis {
  const m = getStatusBarMetrics();
  const agents = demoAgents as AgentRegistryRecord[];
  const agentsOnline = agents.filter(
    (a) => !['disabled', 'not_configured', 'paused'].includes(a.status),
  ).length;
  return {
    sitesHealthy: `${m.sitesHealthy} / ${m.sitesTotal}`,
    agentsOnline,
    agentsWorking: m.agentsWorking,
    activeRuns: m.activeRuns,
    queuedRuns: m.queuedRuns,
    pendingApprovals: m.pendingApprovals,
    criticalAlerts: m.criticalAlerts,
    failedRuns: m.failedRuns,
    aiCostToday: m.aiCostToday,
  };
}

// --- Site status ------------------------------------------------------------------

export function getWallboardSites(): SiteHealthCard[] {
  return getSiteHealth();
}

// --- Active operations (Runs + Orchestrator) --------------------------------------

export interface ActiveOperation {
  site: string;
  agent: string;
  task: string;
  currentStep: string;
  progress: number;
  risk: string;
  duration: string;
  status: string;
  kind: 'run' | 'orchestration';
  refId: string;
}

export function getActiveOperations(): ActiveOperation[] {
  const mission = getMissionControl().map((item) => ({
    site: item.siteName,
    agent: item.agentName,
    task: item.task,
    currentStep: item.stepName,
    progress: item.totalSteps > 0 ? Math.round((item.currentStep / item.totalSteps) * 100) : 0,
    risk: item.risk,
    duration: '—',
    status: 'working',
    kind: 'run' as const,
    refId: item.runId,
  }));

  return mission.slice(0, 8);
}

// --- Agents working now (limited) -------------------------------------------------

export function getWallboardAgents(limit = 6): AgentRegistryRecord[] {
  return getAgentsWorkingNow().slice(0, limit);
}

// --- Critical alerts --------------------------------------------------------------

const CRITICAL_SEVERITIES = ['critical', 'high'];

export function getCriticalAlerts(limit = 6): OperationsAlert[] {
  return getOperationsAlerts()
    .filter((a) => CRITICAL_SEVERITIES.includes(a.severity))
    .slice(0, limit);
}

// --- Approvals watch ---------------------------------------------------------------

export function getWallboardApprovals(limit = 5): AiApproval[] {
  return getApprovalWatch().slice(0, limit);
}

// --- System health -----------------------------------------------------------------

const WALLBOARD_SYSTEM_KEYS = ['orchestrator', 'supabase', 'n8n', 'models', 'monitoring', 'notifications', 'email', 'billing'];

export function getWallboardSystemHealth(): SystemHealthRow[] {
  return getPlatformHealthRows().filter((row) => WALLBOARD_SYSTEM_KEYS.includes(row.key));
}

// --- Live activity ---------------------------------------------------------------

export function getWallboardActivity(limit = 10): LiveActivityEvent[] {
  return getActivityEvents().slice(0, limit);
}

// --- Users online (demo placeholder) ---------------------------------------------

export interface UsersOnlineBreakdown {
  site: string;
  users: number;
}

export function getUsersOnline(): { total: number; sites: UsersOnlineBreakdown[] } {
  return {
    total: 37,
    sites: [
      { site: 'Digital Footprint', users: 6 },
      { site: 'QuickGuard', users: 9 },
      { site: 'GuardianHub', users: 8 },
      { site: 'LetHub', users: 5 },
      { site: 'Wedora', users: 6 },
      { site: 'The Forge', users: 3 },
    ],
  };
}

// --- AI spend --------------------------------------------------------------------

export interface WallboardSpend {
  total: string;
  highestSite: string;
  highestModel: string;
  budgetStatus: string;
  budgetStatusLabel: string;
}

export function getWallboardSpend(): WallboardSpend {
  const summary = getCostSummary();
  const groupBudget = demoBudgets.find((b) => b.scope === 'group');
  const status = groupBudget?.status ?? 'warning';
  const labels: Record<string, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    exceeded: 'Exceeded',
    disabled: 'Disabled',
    not_configured: 'Not Configured',
  };
  return {
    total: summary.costToday,
    highestSite: summary.highestCostSite,
    highestModel: summary.highestCostModel,
    budgetStatus: status,
    budgetStatusLabel: labels[status] ?? status,
  };
}