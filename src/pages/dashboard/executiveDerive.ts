// ============================================================================
// DFP COMMAND 15B — EXECUTIVE DASHBOARD — PURE DERIVATION
// ============================================================================
// Read-time aggregation over the existing project portfolio (15A), AI
// Operations group live snapshot, runtime bridge telemetry, support and
// activity records. Reuses the portfolio helpers wherever possible so the
// executive view never invents a second source of truth. Every value is honest:
// unavailable → Unknown, never a fabricated zero or a green state.
import type {
  PortfolioProject,
  PortfolioSummary,
  LaunchPipeline,
  LiveSummary,
  CommercialSummary,
} from '@/pages/projects/portfolioTypes';
import {
  computePortfolioSummary,
  computeLiveSummary,
  computeCommercialSummary,
  computeLaunchPipeline,
  formatMoney,
} from '@/pages/projects/portfolioDerive';
import { formatRelative, formatDate } from '@/pages/projects/detail/utils';
import type {
  PortfolioHealthState,
  NeedsAttentionItem,
  LiveOpsItem,
  DeploymentRow,
  DeploymentsExec,
  AiExecSummary,
  RuntimeNodeStatus,
  RuntimeExec,
  RuntimeNodeState,
  CommercialExec,
  SupportExec,
  BuildExec,
  UatExec,
  RecentActivityItem,
  UpcomingMilestone,
  QuickAccessItem,
  ExecHeaderMetric,
} from './executiveTypes';

// ─── Small helpers ──────────────────────────────────────────────────────────

const SHORT = (sha: string | null | undefined) => (sha ? sha.slice(0, 8) : '');

function ageLabel(ts: string | null | undefined): string {
  if (!ts) return '—';
  const rel = formatRelative(ts);
  if (rel) return rel;
  return formatDate(ts);
}

function sectionDeepLink(slug: string, section: string): { label: string; to: string } {
  const label = section.charAt(0).toUpperCase() + section.slice(1);
  return { label: `Open ${label}`, to: `/projects/${slug}?section=${section}` };
}

function severityFromRank(rank: number): NeedsAttentionItem['severity'] {
  if (rank <= 2) return 'Critical';
  if (rank <= 4) return 'High';
  if (rank <= 6) return 'Medium';
  return 'Low';
}

// ─── Portfolio health (§17) ─────────────────────────────────────────────────

export function computePortfolioHealth(
  pps: PortfolioProject[],
  sourceAvailable: boolean,
  aiCriticalAlerts: number,
): PortfolioHealthState {
  if (!sourceAvailable) return 'UNKNOWN';

  const live = pps.filter((p) => p.project.status === 'live' || p.project.launched_at != null);
  const criticalLive = live.some(
    (p) => p.health.state === 'CRITICAL' || p.health.state === 'OFFLINE',
  );
  const criticalDeploy = pps.some(
    (p) =>
      p.deployment.state === 'FAILED' ||
      p.deployment.state === 'ROLLBACK_REQUIRED' ||
      p.deployment.state === 'ROLLING_BACK',
  );

  if (criticalLive || criticalDeploy || aiCriticalAlerts > 0) return 'CRITICAL';

  const anyAttention = pps.some((p) => p.attention.length > 0);
  if (anyAttention) return 'ATTENTION';

  return 'HEALTHY';
}

// ─── Needs attention (§3 / §14) ────────────────────────────────────────────

export interface AiCriticalAlertInput {
  key: string;
  label: string;
  age: string | null;
}

export interface RuntimeOfflineInput {
  key: string;
  name: string;
}

export function buildNeedsAttention(
  pps: PortfolioProject[],
  aiCriticalAlerts: AiCriticalAlertInput[],
  runtimeOffline: RuntimeOfflineInput[],
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];

  for (const p of pps) {
    if (p.attention.length === 0) continue;
    const top = p.attention[0];
    items.push({
      key: `project-${p.project.id}-${top.section}`,
      rank: top.rank,
      projectName: p.project.project_name,
      projectSlug: p.project.project_slug,
      issue: top.reason,
      source: top.section.charAt(0).toUpperCase() + top.section.slice(1),
      severity: severityFromRank(top.rank),
      ageLabel: ageLabel(p.lastActivity?.timestamp),
      deepLink: sectionDeepLink(p.project.project_slug, top.section),
    });
  }

  for (const a of aiCriticalAlerts) {
    items.push({
      key: `ai-${a.key}`,
      rank: 1,
      projectName: 'AI Operations',
      projectSlug: null,
      issue: a.label,
      source: 'AI Operations',
      severity: 'Critical',
      ageLabel: ageLabel(a.age),
      deepLink: { label: 'Open AI Operations', to: '/ai-operations' },
    });
  }

  for (const n of runtimeOffline) {
    items.push({
      key: `runtime-${n.key}`,
      rank: 1,
      projectName: 'Runtime',
      projectSlug: null,
      issue: `${n.name} runtime node offline/stale`,
      source: 'Runtime',
      severity: 'Critical',
      ageLabel: '—',
      deepLink: { label: 'Open Runtime Health', to: '/ai-operations/runtime-health' },
    });
  }

  return items.sort((a, b) => a.rank - b.rank);
}

// ─── Portfolio summary + launch pipeline + build + uat roll-ups ────────────

export function computePortfolioSummaryExec(pps: PortfolioProject[]): PortfolioSummary {
  return computePortfolioSummary(pps);
}

export interface LaunchPipelineExec extends LaunchPipeline {
  recentlyLaunched: number;
}

export function computeLaunchPipelineExec(pps: PortfolioProject[]): LaunchPipelineExec {
  const pipeline = computeLaunchPipeline(pps);
  const now = Date.now();
  const recentlyLaunched = pps.filter((p) => {
    if (!p.project.launched_at) return false;
    const t = new Date(p.project.launched_at).getTime();
    return !Number.isNaN(t) && now - t <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  return { ...pipeline, recentlyLaunched };
}

export function computeBuildExec(
  pps: PortfolioProject[],
  available: boolean,
  activeRuns: number,
  requiredItemsRemaining: number,
): BuildExec {
  if (!available) {
    return { available: false, activeRuns: 0, blockedProjects: 0, requiredItemsRemaining: 0, nearLaunchReadiness: 0, noChecklist: 0 };
  }
  return {
    available: true,
    activeRuns,
    blockedProjects: pps.filter((p) => p.build.state === 'BLOCKED').length,
    requiredItemsRemaining,
    nearLaunchReadiness: pps.filter((p) => p.build.state === 'READY' || p.build.state === 'COMPLETE').length,
    noChecklist: pps.filter((p) => p.build.state === 'NOT_STARTED').length,
  };
}

export function computeUatExec(pps: PortfolioProject[], available: boolean): UatExec {
  if (!available) {
    return { available: false, inUat: 0, testsRunning: 0, awaitingApproval: 0, approved: 0, rejected: 0, criticalDefects: 0, readyForLaunch: 0 };
  }
  const linked = pps.filter((p) => p.uat.state !== 'NOT_CONFIGURED');
  return {
    available: true,
    inUat: linked.length,
    testsRunning: linked.filter((p) => p.uat.state === 'IN_TESTING').length,
    awaitingApproval: linked.filter((p) => p.uat.state === 'AWAITING_APPROVAL').length,
    approved: linked.filter((p) => p.uat.state === 'APPROVED').length,
    rejected: linked.filter((p) => p.uat.state === 'REJECTED').length,
    criticalDefects: linked.filter((p) => p.uat.state === 'BLOCKED').length,
    readyForLaunch: linked.filter(
      (p) => p.uat.state === 'APPROVED' || p.launch.state === 'AWAITING_DEPLOYMENT',
    ).length,
  };
}

// ─── Live operations (§6) ───────────────────────────────────────────────────

export function computeLiveOps(pps: PortfolioProject[], available: boolean): LiveOpsItem[] {
  if (!available) return [];
  const live = pps.filter((p) => p.project.status === 'live' || p.project.launched_at != null);

  const healthToProduction: Record<string, string> = {
    HEALTHY: 'Healthy',
    DEGRADED: 'Degraded',
    CRITICAL: 'Critical',
    OFFLINE: 'Offline',
    UNKNOWN: 'Unknown',
    NOT_CONFIGURED: 'Not Monitored',
    PRE_LAUNCH: 'Pre-Launch',
  };

  return live
    .map((p) => {
      const detail = p.health.detail ?? '';
      const hasIncident = /incident/i.test(detail);
      return {
        projectName: p.project.project_name,
        projectSlug: p.project.project_slug,
        health: p.health.state,
        healthState: p.health.state,
        productionState: healthToProduction[p.health.state] ?? 'Unknown',
        activeIncident: hasIncident ? detail : 'None',
        supportLoad: p.criticalIssues > 0 ? `${p.criticalIssues} critical` : 'Clear',
        currentRelease: p.deployment.state === 'RELEASE_ACCEPTED' ? `SHA ${p.deployment.detail.replace(/^SHA /, '')}` : p.deployment.state,
        lastCheck: ageLabel(p.lastActivity?.timestamp),
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { OFFLINE: 0, CRITICAL: 1, DEGRADED: 2, UNKNOWN: 3, HEALTHY: 4, NOT_CONFIGURED: 5, PRE_LAUNCH: 6 };
      return (order[a.health] ?? 9) - (order[b.health] ?? 9);
    });
}

export function computeLiveSummaryExec(pps: PortfolioProject[]): LiveSummary {
  return computeLiveSummary(pps);
}

// ─── Deployments (§7) ───────────────────────────────────────────────────────

export interface DeploymentRowInput {
  id: string;
  project_id: number | null;
  status: string;
  github_sha: string | null;
  deployed_sha: string | null;
  rollback_sha: string | null;
  environment: string | null;
  started_at: string | null;
  started_by: string | null;
  production_accepted: boolean;
  created_at: string;
}

const ACTIVE_DEPLOY = new Set(['DEPLOYING', 'DEPLOYED', 'VERIFYING']);
const ROLLBACK_DEPLOY = new Set(['ROLLBACK_REQUIRED', 'ROLLING_BACK', 'ROLLED_BACK']);

export function buildDeploymentsExec(
  rows: DeploymentRowInput[],
  projectMap: Map<number, PortfolioProject>,
  available: boolean,
): DeploymentsExec {
  if (!available) {
    return { available: false, active: 0, verifying: 0, failed: 0, rollbackRequired: 0, recentlyCompleted: 0, rows: [] };
  }

  const mapped: DeploymentRow[] = rows.map((r) => {
    const pp = r.project_id != null ? projectMap.get(r.project_id) : undefined;
    const sha = r.rollback_sha ?? r.deployed_sha ?? r.github_sha;
    return {
      id: r.id,
      projectName: pp?.project.project_name ?? 'Unknown',
      projectSlug: pp?.project.project_slug ?? '',
      sha: SHORT(sha),
      status: r.status,
      statusKey: r.status,
      environment: r.environment ?? 'production',
      startedAt: r.started_at,
      operator: r.started_by,
    };
  });

  return {
    available: true,
    active: mapped.filter((r) => ACTIVE_DEPLOY.has(r.statusKey)).length,
    verifying: mapped.filter((r) => r.statusKey === 'VERIFYING').length,
    failed: mapped.filter((r) => r.statusKey === 'FAILED').length,
    rollbackRequired: mapped.filter((r) => ROLLBACK_DEPLOY.has(r.statusKey)).length,
    recentlyCompleted: mapped.filter((r) => r.production_accepted || r.statusKey === 'ROLLED_BACK').length,
    rows: mapped,
  };
}

// ─── AI operations (§8) ─────────────────────────────────────────────────────

export function computeAiExec(
  available: boolean,
  input: {
    sites: number;
    agents: number;
    activeRuns: number;
    pendingApprovals: number;
    criticalAlerts: number;
    costThisMonth: number | null;
  },
  runtimeOnline: number,
  runtimeOfflineStale: number,
): AiExecSummary {
  return {
    available,
    sites: input.sites,
    agents: input.agents,
    activeRuns: input.activeRuns,
    pendingApprovals: input.pendingApprovals,
    criticalAlerts: input.criticalAlerts,
    runtimeOnline,
    runtimeOfflineStale,
    costThisMonth: input.costThisMonth,
  };
}

// ─── Runtime nodes (§9) ─────────────────────────────────────────────────────

export interface RuntimeNodeInput {
  key: string;
  name: string | null;
  state: RuntimeNodeState;
  lastHeartbeat: string | null;
  n8n: string | null;
  ollama: string | null;
}

export function buildRuntimeExec(nodes: RuntimeNodeInput[], available: boolean): RuntimeExec {
  if (!available) return { available: false, nodes: [] };
  return {
    available: true,
    nodes: nodes.map((n) => ({
      key: n.key,
      name: n.name ?? n.key,
      state: n.state,
      lastHeartbeat: n.lastHeartbeat,
      n8n: n.n8n,
      ollama: n.ollama,
    })) as RuntimeNodeStatus[],
  };
}

// ─── Commercial (§10) ───────────────────────────────────────────────────────

export function computeCommercialExec(
  pps: PortfolioProject[],
  available: boolean,
  upcomingRequiredCosts: number,
): CommercialExec {
  const base: CommercialSummary = computeCommercialSummary(pps);
  return {
    ...base,
    available,
    upcomingRequiredCosts: available ? upcomingRequiredCosts : 0,
  };
}

// ─── Support / incidents (§11) ──────────────────────────────────────────────

export function buildSupportExec(
  available: boolean,
  ticketsAvailable: boolean,
  incidentsAvailable: boolean,
  input: {
    openTickets: number;
    criticalTickets: number;
    highPriority: number;
    activeIncidents: number;
    criticalIncidents: number;
    oldestCritical: { subject: string; ageLabel: string; id: string } | null;
    recentlyResolved: { title: string; resolvedAt: string }[];
  },
): SupportExec {
  if (!available) {
    return { available: false, ticketsAvailable: false, incidentsAvailable: false, openTickets: 0, criticalTickets: 0, highPriority: 0, activeIncidents: 0, criticalIncidents: 0, oldestCritical: null, recentlyResolved: [] };
  }
  return { available: true, ticketsAvailable, incidentsAvailable, ...input };
}

// ─── Recent activity (§14) ──────────────────────────────────────────────────

export interface ActivityRowInput {
  id: number;
  action: string;
  description: string | null;
  entity_type: string;
  project_id: number | null;
  created_at: string;
}

function classifyActivitySource(a: string): { source: string; severity: RecentActivityItem['severity'] } {
  const s = a.toLowerCase();
  if (/launch|deploy|release/.test(s)) return { source: 'Deployment', severity: /rollback|fail/.test(s) ? 'Warning' : 'Info' };
  if (/budget|cost|spend|payment|over.?budget|commercial/.test(s)) return { source: 'Budget', severity: /over.?budget|blocker/.test(s) ? 'Warning' : 'Info' };
  if (/uat|defect|approval/.test(s)) return { source: 'UAT', severity: /reject|critical/.test(s) ? 'Warning' : 'Info' };
  if (/support|ticket|incident/.test(s)) return { source: 'Support', severity: /critical|escalat/.test(s) ? 'Critical' : 'Info' };
  if (/bug/.test(s)) return { source: 'Bugs', severity: /critical/.test(s) ? 'Critical' : 'Warning' };
  if (/build|checklist|blocker/.test(s)) return { source: 'Build', severity: /blocker/.test(s) ? 'Warning' : 'Info' };
  if (/ai |agent|runtime|model|monitor/.test(s)) return { source: 'AI Ops', severity: /offline|fail|critical/.test(s) ? 'Critical' : 'Info' };
  if (/github|repository|readdy|supabase|infrastructure/.test(s)) return { source: 'Infrastructure', severity: 'Info' };
  if (s === 'deleted') return { source: 'Lifecycle', severity: 'Warning' };
  if (s === 'archived' || s === 'restored') return { source: 'Lifecycle', severity: 'Info' };
  if (s === 'created') return { source: 'Lifecycle', severity: 'Info' };
  if (s === 'updated') return { source: 'Project', severity: 'Info' };
  return { source: 'Project', severity: 'Info' };
}

export function buildRecentActivity(
  rows: ActivityRowInput[],
  projectMap: Map<number, PortfolioProject>,
  available: boolean,
): RecentActivityItem[] {
  if (!available) return [];
  return rows.map((r) => {
    const pp = r.project_id != null ? projectMap.get(r.project_id) : undefined;
    const c = classifyActivitySource(r.action);
    return {
      key: `activity-${r.id}`,
      timeLabel: ageLabel(r.created_at),
      projectName: pp?.project.project_name ?? '—',
      projectSlug: pp?.project.project_slug ?? null,
      source: c.source,
      event: r.description || r.action,
      severity: c.severity,
      deepLink: pp ? { label: 'Open Project', to: `/projects/${pp.project.project_slug}` } : null,
    };
  });
}

// ─── Upcoming milestones (§15) ──────────────────────────────────────────────

export function buildUpcomingMilestones(
  pps: PortfolioProject[],
  upcomingCosts: { key: string; name: string; projectName: string; date: string; amount: number }[],
  maintenance: { key: string; title: string; projectName: string; projectSlug: string | null; date: string }[],
): UpcomingMilestone[] {
  const items: UpcomingMilestone[] = [];

  for (const p of pps) {
    if (!p.project.target_launch_date) continue;
    if (p.project.status === 'live' || p.project.launched_at != null) continue;
    items.push({
      key: `launch-${p.project.id}`,
      type: 'launch',
      date: p.project.target_launch_date,
      label: 'Target launch',
      projectName: p.project.project_name,
      projectSlug: p.project.project_slug,
      deepLink: { label: 'Open Launch', to: `/projects/${p.project.project_slug}?section=launch` },
    });
  }

  for (const c of upcomingCosts) {
    items.push({
      key: c.key,
      type: 'payment',
      date: c.date,
      label: `${c.name} — ${formatMoney(c.amount)}`,
      projectName: c.projectName,
      projectSlug: null,
      deepLink: { label: 'Open Budget', to: '/project-budget' },
    });
  }

  for (const m of maintenance) {
    items.push({
      key: m.key,
      type: 'maintenance',
      date: m.date,
      label: m.title,
      projectName: m.projectName,
      projectSlug: m.projectSlug,
      deepLink: m.projectSlug ? { label: 'Open Operations', to: `/projects/${m.projectSlug}?section=operations` } : null,
    });
  }

  // Awaiting-action items (no fabricated deadline) sorted to the end.
  for (const p of pps) {
    if (p.uat.state === 'AWAITING_APPROVAL') {
      items.push({
        key: `uat-await-${p.project.id}`,
        type: 'uat',
        date: null,
        label: 'UAT approval awaiting action',
        projectName: p.project.project_name,
        projectSlug: p.project.project_slug,
        deepLink: { label: 'Open UAT', to: `/projects/${p.project.project_slug}?section=uat` },
      });
    }
    if (p.launch.state === 'PENDING') {
      items.push({
        key: `launch-await-${p.project.id}`,
        type: 'approval',
        date: null,
        label: 'Launch approval awaiting action',
        projectName: p.project.project_name,
        projectSlug: p.project.project_slug,
        deepLink: { label: 'Open Launch', to: `/projects/${p.project.project_slug}?section=launch` },
      });
    }
  }

  const now = Date.now();
  return items.sort((a, b) => {
    if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  }).filter((m) => {
    if (!m.date) return true;
    const t = new Date(m.date).getTime();
    return Number.isNaN(t) || t >= now - 24 * 60 * 60 * 1000; // keep recently-passed too
  });
}

// ─── Quick access (§16) ─────────────────────────────────────────────────────

export function buildQuickAccess(pps: PortfolioProject[], limit = 6): QuickAccessItem[] {
  const scored = pps
    .filter((p) => p.project.status !== 'archived')
    .map((p) => ({
      p,
      score:
        p.attention.reduce((acc, a) => acc + (100 - a.rank * 10), 0) +
        (p.project.priority === 'critical' ? 30 : p.project.priority === 'high' ? 15 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ p }) => ({
    projectName: p.project.project_name,
    projectSlug: p.project.project_slug,
    lifecycle: p.project.status,
    priority: p.project.priority,
    health: p.health.state,
    launchState: p.launch.state,
    lastActivity: ageLabel(p.lastActivity?.timestamp),
  }));
}

// ─── Header metrics (§2) ────────────────────────────────────────────────────

export function buildHeaderMetrics(input: {
  health: PortfolioHealthState;
  criticalIssues: number;
  activeProjects: number;
  liveProjects: number;
  launchesPending: number;
  deploymentsActive: number;
  aiSites: number;
  aiCriticalAlerts: number;
}): ExecHeaderMetric[] {
  return [
    { key: 'health', label: 'Portfolio Health', value: input.health, icon: 'ri-heart-pulse-line', accent: 'bg-emerald-500/15 text-emerald-400' },
    { key: 'critical', label: 'Critical Issues', value: String(input.criticalIssues), icon: 'ri-alert-line', accent: 'bg-red-500/15 text-red-400' },
    { key: 'active', label: 'Active Projects', value: String(input.activeProjects), icon: 'ri-folder-3-line', accent: 'bg-accent-500/15 text-accent-400' },
    { key: 'live', label: 'Live Projects', value: String(input.liveProjects), icon: 'ri-earth-line', accent: 'bg-emerald-500/15 text-emerald-400' },
    { key: 'launches', label: 'Launches Pending', value: String(input.launchesPending), icon: 'ri-rocket-line', accent: 'bg-amber-500/15 text-amber-400' },
    { key: 'deployments', label: 'Deployments Active', value: String(input.deploymentsActive), icon: 'ri-git-commit-line', accent: 'bg-sky-500/15 text-sky-400' },
    { key: 'ai', label: 'AI Operations', value: `${input.aiSites} sites`, icon: 'ri-robot-2-line', accent: 'bg-violet-500/15 text-violet-400' },
    { key: 'aiAlerts', label: 'AI Critical Alerts', value: String(input.aiCriticalAlerts), icon: 'ri-alarm-warning-line', accent: 'bg-red-500/15 text-red-400' },
  ];
}