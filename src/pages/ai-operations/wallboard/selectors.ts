// ============================================================================
// AI Operations — Wallboard selectors.
//
// Derived exclusively from the consolidated group live-data selectors (shared
// with Live Operations / Overview). No separate wallboard data model exists —
// these are read-only reformattings of the same live snapshot for a large,
// distance-viewed display.
//
// "Users Online" intentionally remains a demo placeholder (no live analytics
// source exists) and is clearly labelled as such.
// ============================================================================

import type {
  SiteHealthCard,
  OperationsAlert,
  LiveActivityEvent,
  SystemHealthRow,
  BudgetStatus,
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
  type AgentsWorkingItem,
  type ApprovalWatchItem,
} from '@/pages/ai-operations/live/liveDataSelectors';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

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
  const data = getGroupLiveData();
  const agentsRegistered = data.agents.filter((a) => !['disabled', 'not_configured', 'paused'].includes(a.status ?? '')).length;
  return {
    sitesHealthy: `${m.sitesHealthy} / ${m.sitesTotal}`,
    agentsOnline: agentsRegistered,
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

// --- Active operations (Runs) ------------------------------------------------------

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
  return getMissionControl().slice(0, 8).map((item) => ({
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
}

// --- Agents working now -----------------------------------------------------------

export function getWallboardAgents(limit = 6): AgentsWorkingItem[] {
  return getAgentsWorkingNow().slice(0, limit);
}

// --- Critical alerts ---------------------------------------------------------------

const CRITICAL_SEVERITIES = ['critical', 'high'];

export function getCriticalAlerts(limit = 6): OperationsAlert[] {
  return getOperationsAlerts()
    .filter((a) => CRITICAL_SEVERITIES.includes(a.severity))
    .slice(0, limit);
}

// --- Approvals watch -----------------------------------------------------------------

export function getWallboardApprovals(limit = 5): ApprovalWatchItem[] {
  return getApprovalWatch().slice(0, limit);
}

// --- System health -------------------------------------------------------------------

const WALLBOARD_SYSTEM_KEYS = ['orchestrator', 'sites', 'agents', 'runs', 'tools', 'models', 'runtime', 'monitoring', 'analytics'];

export function getWallboardSystemHealth(): SystemHealthRow[] {
  return getPlatformHealthRows().filter((row) => WALLBOARD_SYSTEM_KEYS.includes(row.key));
}

// --- Live activity --------------------------------------------------------------------

export function getWallboardActivity(limit = 10): LiveActivityEvent[] {
  return getActivityEvents().slice(0, limit);
}

// --- Users online (demo placeholder — no live analytics source) -----------------------

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

// --- AI spend (estimated / migrated baseline) ----------------------------------------

export interface WallboardSpend {
  total: string;
  highestSite: string;
  highestModel: string;
  budgetStatus: string;
  budgetStatusLabel: string;
}

function pounds(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

const BUDGET_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  exceeded: 'Exceeded',
  disabled: 'Disabled',
  not_configured: 'Not Configured',
};

export function getWallboardSpend(): WallboardSpend {
  const data = getGroupLiveData();
  const usage = data.usageCosts;

  const total = usage.reduce((acc, u) => acc + (pounds(u.estimated_cost) || pounds(u.actual_cost)), 0);

  const bySite = new Map<string, number>();
  for (const u of usage) {
    if (!u.site_id) continue;
    const key = data.siteNameByUuid.get(u.site_id) ?? 'Group-wide';
    bySite.set(key, (bySite.get(key) ?? 0) + (pounds(u.estimated_cost) || pounds(u.actual_cost)));
  }
  const highestSite = [...bySite.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const byModel = new Map<string, number>();
  for (const u of usage) {
    if (!u.model_id) continue;
    const key = data.models.find((m) => m.id === u.model_id)?.name ?? '—';
    byModel.set(key, (byModel.get(key) ?? 0) + (pounds(u.estimated_cost) || pounds(u.actual_cost)));
  }
  const highestModel = [...byModel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const groupBudget = data.budgets.find((b) => b.scope_type === 'group');
  const status = (groupBudget?.status ?? 'not_configured') as BudgetStatus;

  return {
    total: `£${total.toFixed(2)}`,
    highestSite,
    highestModel,
    budgetStatus: status,
    budgetStatusLabel: BUDGET_LABELS[status] ?? status,
  };
}