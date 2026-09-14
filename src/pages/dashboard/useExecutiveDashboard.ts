// ============================================================================
// DFP COMMAND 15B — EXECUTIVE DASHBOARD — DATA HOOK
// ============================================================================
// Composes the existing project portfolio aggregation (15A), the AI Operations
// group live store, runtime bridge telemetry, support and activity records into
// a single executive read-only model. Each source fails independently — a
// failed source surfaces as "unavailable" (never a fabricated zero or green),
// and the dashboard renders even when one module is down.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePortfolio } from '@/pages/projects/usePortfolio';
import type { PortfolioProject } from '@/pages/projects/portfolioTypes';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import {
  getAiRuntimeBridgeNodes,
  getAiRuntimeBridgeHeartbeats,
  deriveBridgeNodeState,
  type AiRuntimeBridgeNode,
  type AiRuntimeBridgeHeartbeat,
} from '@/lib/ai-operations/runtimeBridge';
import {
  computePortfolioHealth,
  buildNeedsAttention,
  computePortfolioSummaryExec,
  computeLaunchPipelineExec,
  computeLiveOps,
  computeLiveSummaryExec,
  computeBuildExec,
  computeUatExec,
  computeAiExec,
  computeCommercialExec,
  buildSupportExec,
  buildRecentActivity,
  buildUpcomingMilestones,
  buildQuickAccess,
  buildHeaderMetrics,
  buildDeploymentsExec,
  buildRuntimeExec,
  type DeploymentRowInput,
  type ActivityRowInput,
  type RuntimeNodeInput,
  type AiCriticalAlertInput,
  type RuntimeOfflineInput,
  type LaunchPipelineExec,
} from './executiveDerive';
import { formatRelative, formatDate } from '@/pages/projects/detail/utils';
import type {
  PortfolioHealthState,
  NeedsAttentionItem,
  LiveOpsItem,
  LiveSummary,
  CommercialExec,
  SupportExec,
  BuildExec,
  UatExec,
  RecentActivityItem,
  UpcomingMilestone,
  QuickAccessItem,
  ExecHeaderMetric,
  AiExecSummary,
  DeploymentsExec,
  RuntimeExec,
  PortfolioSummary,
} from './executiveTypes';

export interface ExecutiveDashboardData {
  configured: boolean;
  loading: boolean;
  portfolioLoading: boolean;
  projectsAvailable: boolean;
  health: PortfolioHealthState;
  headerMetrics: ExecHeaderMetric[];
  needsAttention: NeedsAttentionItem[];
  portfolioSummary: PortfolioSummary;
  launchPipeline: LaunchPipelineExec;
  liveOps: LiveOpsItem[];
  liveSummary: LiveSummary;
  deployments: DeploymentsExec;
  ai: AiExecSummary;
  runtime: RuntimeExec;
  commercial: CommercialExec;
  support: SupportExec;
  build: BuildExec;
  uat: UatExec;
  recentActivity: RecentActivityItem[];
  upcoming: UpcomingMilestone[];
  quickAccess: QuickAccessItem[];
  refresh: () => void;
}

const OPEN_TICKET = new Set(['new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_staff']);
const ACTIVE_INCIDENT = new Set(['open', 'investigating', 'acknowledged', 'active']);
const REGISTERED_ACTIVE = new Set(['active', 'working', 'idle', 'degraded']);

interface ExtraState {
  loaded: boolean;
  deploymentsAvailable: boolean;
  deployments: DeploymentRowInput[];
  activityAvailable: boolean;
  activity: ActivityRowInput[];
  ticketsAvailable: boolean;
  tickets: { open: number; critical: number; high: number; oldestCritical: { subject: string; ageLabel: string; id: string } | null; recentlyResolved: { title: string; resolvedAt: string }[] };
  incidentsAvailable: boolean;
  incidents: { active: number; critical: number; recentlyResolved: { title: string; resolvedAt: string }[] };
  buildAvailable: boolean;
  build: { activeRuns: number; requiredItemsRemaining: number };
  upcomingCosts: { key: string; name: string; projectId: number | null; date: string; amount: number }[];
  maintenance: { key: string; title: string; projectId: number; date: string }[];
  runtimeAvailable: boolean;
  runtimeNodes: RuntimeNodeInput[];
}

const EMPTY_EXTRA: ExtraState = {
  loaded: false,
  deploymentsAvailable: false,
  deployments: [],
  activityAvailable: false,
  activity: [],
  ticketsAvailable: false,
  tickets: { open: 0, critical: 0, high: 0, oldestCritical: null, recentlyResolved: [] },
  incidentsAvailable: false,
  incidents: { active: 0, critical: 0, recentlyResolved: [] },
  buildAvailable: false,
  build: { activeRuns: 0, requiredItemsRemaining: 0 },
  upcomingCosts: [],
  maintenance: [],
  runtimeAvailable: false,
  runtimeNodes: [],
};

function ageLabel(ts: string | null | undefined): string {
  if (!ts) return '—';
  const rel = formatRelative(ts);
  return rel ?? formatDate(ts);
}

export function useExecutiveDashboard(): ExecutiveDashboardData {
  const portfolio = usePortfolio();
  const ai = useGroupLiveData();
  const [extra, setExtra] = useState<ExtraState>(EMPTY_EXTRA);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = portfolio.configured;

  // Load the executive-specific extra sources (deployments, activity, support,
  // incidents, build counts, upcoming, runtime nodes) in one coordinated pass.
  useEffect(() => {
    if (!configured) {
      setExtra(EMPTY_EXTRA);
      return;
    }
    const id = ++requestIdRef.current;
    let cancelled = false;

    (async () => {
      const bulk = async <T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<{ data: T[]; ok: boolean }> => {
        try {
          const { data, error } = await fn();
          if (error) return { data: [], ok: false };
          return { data: (data ?? []) as T[], ok: true };
        } catch {
          return { data: [], ok: false };
        }
      };

      const [
        depRes,
        actRes,
        tickRes,
        incRes,
        buildRunRes,
        buildItemRes,
        costRes,
        maintRes,
        nodeRes,
        hbRes,
      ] = await Promise.all([
        bulk<DeploymentRowInput>(() =>
          supabase.from('internal_project_deployments')
            .select('id,project_id,status,github_sha,deployed_sha,rollback_sha,environment,started_at,started_by,production_accepted,created_at')
            .order('created_at', { ascending: false }).limit(30)),
        bulk<ActivityRowInput>(() =>
          supabase.from('internal_activity_log')
            .select('id,action,description,entity_type,project_id,created_at')
            .order('created_at', { ascending: false }).limit(20)),
        bulk<{ id: string; subject: string; priority: string; status: string; created_at: string; resolved_at: string | null }>(() =>
          supabase.from('internal_support_tickets')
            .select('id,subject,priority,status,created_at,resolved_at')
            .in('status', ['new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_staff'])
            .order('created_at', { ascending: true }).limit(500)),
        bulk<{ id: number; incident_title: string; severity: string; status: string; resolved_at: string | null }>(() =>
          supabase.from('internal_monitoring_incidents')
            .select('id,incident_title,severity,status,resolved_at')
            .order('created_at', { ascending: false }).limit(200)),
        bulk<{ id: number }>(() =>
          supabase.from('internal_build_process_runs')
            .select('id').eq('run_status', 'active')),
        bulk<{ id: number }>(() =>
          supabase.from('internal_build_process_run_items')
            .select('id').eq('is_required', true).eq('checked', false)),
        bulk<{ id: string; recurring_name: string; project_id: number | null; monthly_cost: number; next_payment_date: string | null }>(() =>
          supabase.from('internal_project_recurring_costs')
            .select('id,recurring_name,project_id,monthly_cost,next_payment_date')
            .eq('status', 'active').not('next_payment_date', 'is', null)
            .order('next_payment_date', { ascending: true }).limit(20)),
        bulk<{ id: string; title: string; project_id: number; planned_start: string | null }>(() =>
          supabase.from('internal_project_maintenance')
            .select('id,title,project_id,planned_start')
            .in('status', ['PLANNED', 'READY', 'IN_PROGRESS'])
            .not('planned_start', 'is', null)
            .order('planned_start', { ascending: true }).limit(20)),
        getAiRuntimeBridgeNodes(),
        getAiRuntimeBridgeHeartbeats(50),
      ]);

      if (cancelled || id !== requestIdRef.current) return;

      // ── Deployments ──────────────────────────────────────────────────────
      const deployments = depRes.data as DeploymentRowInput[];

      // ── Activity ─────────────────────────────────────────────────────────
      const activity = actRes.data as ActivityRowInput[];

      // ── Support tickets ──────────────────────────────────────────────────
      const ticketRows = tickRes.data;
      const openTickets = ticketRows.length;
      const criticalTickets = ticketRows.filter((t) => t.priority === 'critical' || t.priority === 'urgent').length;
      const highPriority = ticketRows.filter((t) => t.priority === 'high').length;
      const oldestCriticalRow = ticketRows
        .filter((t) => t.priority === 'critical' || t.priority === 'urgent')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0] ?? null;

      // Recently resolved tickets.
      let recentlyResolvedTickets: { title: string; resolvedAt: string }[] = [];
      if (tickRes.ok) {
        const rr = await bulk<{ subject: string; resolved_at: string | null }>(() =>
          supabase.from('internal_support_tickets')
            .select('subject,resolved_at').eq('status', 'resolved')
            .order('resolved_at', { ascending: false }).limit(5));
        recentlyResolvedTickets = rr.data
          .filter((t) => t.resolved_at)
          .map((t) => ({ title: t.subject, resolvedAt: t.resolved_at as string }));
      }

      // ── Incidents ────────────────────────────────────────────────────────
      const incidentRows = incRes.data;
      const activeIncidents = incidentRows.filter((i) => ACTIVE_INCIDENT.has((i.status ?? '').toLowerCase()) || !i.status).length;
      const criticalIncidents = incidentRows.filter(
        (i) => (i.severity ?? '').toLowerCase() === 'critical' && (ACTIVE_INCIDENT.has((i.status ?? '').toLowerCase()) || !i.status),
      ).length;
      const recentlyResolvedIncidents = incidentRows
        .filter((i) => i.resolved_at)
        .sort((a, b) => new Date(b.resolved_at as string).getTime() - new Date(a.resolved_at as string).getTime())
        .slice(0, 5)
        .map((i) => ({ title: i.incident_title, resolvedAt: i.resolved_at as string }));

      // ── Build ────────────────────────────────────────────────────────────
      const activeRuns = buildRunRes.data.length;
      const requiredItemsRemaining = buildItemRes.data.length;

      // ── Upcoming costs + maintenance ─────────────────────────────────────
      const upcomingCosts = costRes.data.map((c) => ({
        key: `cost-${c.id}`,
        name: c.recurring_name,
        projectId: c.project_id,
        date: c.next_payment_date as string,
        amount: c.monthly_cost ?? 0,
      }));
      const maintenance = maintRes.data.map((m) => ({
        key: `maint-${m.id}`,
        title: m.title,
        projectId: m.project_id,
        date: m.planned_start as string,
      }));

      // ── Runtime nodes ────────────────────────────────────────────────────
      const nodes: AiRuntimeBridgeNode[] = (nodeRes.data ?? []) as AiRuntimeBridgeNode[];
      const heartbeats: AiRuntimeBridgeHeartbeat[] = (hbRes.data ?? []) as AiRuntimeBridgeHeartbeat[];
      const hbByNode = new Map<string, AiRuntimeBridgeHeartbeat>();
      for (const hb of heartbeats) {
        if (!hbByNode.has(hb.node_id)) hbByNode.set(hb.node_id, hb);
      }
      const runtimeNodes: RuntimeNodeInput[] = nodes.map((n) => {
        const hb = hbByNode.get(n.id);
        const state = deriveBridgeNodeState(n);
        const map: Record<string, RuntimeNodeInput['state']> = {
          reachable: 'online',
          stale: 'stale',
          offline: 'offline',
          not_registered: 'not_registered',
          degraded: 'stale',
        };
        return {
          key: n.node_key,
          name: n.name,
          state: map[state] ?? 'not_registered',
          lastHeartbeat: hb?.received_at ?? n.last_seen_at ?? null,
          n8n: hb?.n8n_status ?? null,
          ollama: hb?.ollama_status ?? null,
        };
      });

      if (cancelled || id !== requestIdRef.current) return;

      setExtra({
        loaded: true,
        deploymentsAvailable: depRes.ok,
        deployments,
        activityAvailable: actRes.ok,
        activity,
        ticketsAvailable: tickRes.ok,
        tickets: {
          open: openTickets,
          critical: criticalTickets,
          high: highPriority,
          oldestCritical: oldestCriticalRow
            ? { subject: oldestCriticalRow.subject, ageLabel: ageLabel(oldestCriticalRow.created_at), id: oldestCriticalRow.id }
            : null,
          recentlyResolved: recentlyResolvedTickets,
        },
        incidentsAvailable: incRes.ok,
        incidents: { active: activeIncidents, critical: criticalIncidents, recentlyResolved: recentlyResolvedIncidents },
        buildAvailable: buildRunRes.ok && buildItemRes.ok,
        build: { activeRuns, requiredItemsRemaining },
        upcomingCosts,
        maintenance,
        runtimeAvailable: nodeRes.error == null,
        runtimeNodes,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, reloadKey]);

  // ── AI ops snapshot (from the shared group live store) ────────────────────
  const aiAvailable = ai.mode !== 'unavailable';
  const aiAgents = ai.agents.filter((a) => REGISTERED_ACTIVE.has(a.status ?? '')).length;
  const aiActiveRuns = ai.runs.filter((r) => r.status === 'working').length;
  const aiPendingApprovals = ai.approvals.filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status)).length;
  const aiCriticalAlerts = ai.alerts.filter(
    (a) => a.severity === 'critical' && !['resolved', 'closed', 'suppressed'].includes(a.status ?? ''),
  );
  const aiCost = ai.usageCosts.reduce((acc, u) => acc + (u.estimated_cost ?? 0) + (u.actual_cost ?? 0), 0);

  const aiCriticalAlertInputs: AiCriticalAlertInput[] = aiCriticalAlerts.map((a) => ({
    key: a.alert_key,
    label: a.summary ?? a.title ?? 'Critical AI alert',
    age: a.last_seen_at ?? null,
  }));

  const runtimeOffline: RuntimeOfflineInput[] = extra.runtimeNodes
    .filter((n) => n.state === 'offline' || n.state === 'stale')
    .map((n) => ({ key: n.key, name: n.name }));

  // ── Assemble the final executive model ────────────────────────────────────
  return useMemo<ExecutiveDashboardData>(() => {
    const pps: PortfolioProject[] = portfolio.projects;
    const projectsAvailable = !portfolio.sourceErrors.projects;

    const projectMap = new Map<number, PortfolioProject>();
    for (const p of pps) projectMap.set(p.project.id, p);

    const health = computePortfolioHealth(pps, projectsAvailable, aiCriticalAlertInputs.length);

    const needsAttention = buildNeedsAttention(pps, aiCriticalAlertInputs, runtimeOffline);

    const portfolioSummary = computePortfolioSummaryExec(pps);
    const launchPipeline = computeLaunchPipelineExec(pps);
    const liveOps = computeLiveOps(pps, !portfolio.sourceErrors.monitoring);
    const liveSummary = computeLiveSummaryExec(pps);

    const deployments = buildDeploymentsExec(extra.deployments, projectMap, extra.deploymentsAvailable);

    const runtimeOnline = extra.runtimeNodes.filter((n) => n.state === 'online').length;
    const runtimeOfflineStale = extra.runtimeNodes.filter((n) => n.state === 'offline' || n.state === 'stale').length;
    const aiExec = computeAiExec(
      aiAvailable,
      { sites: ai.sites.length, agents: aiAgents, activeRuns: aiActiveRuns, pendingApprovals: aiPendingApprovals, criticalAlerts: aiCriticalAlerts.length, costThisMonth: aiAvailable ? aiCost : null },
      runtimeOnline,
      runtimeOfflineStale,
    );
    const runtime = buildRuntimeExec(extra.runtimeNodes, extra.runtimeAvailable);

    const commercial = computeCommercialExec(pps, !portfolio.sourceErrors.budget, extra.upcomingCosts.reduce((s, c) => s + c.amount, 0));

    const supportAvailable = extra.ticketsAvailable || extra.incidentsAvailable;
    const support = buildSupportExec(
      supportAvailable,
      extra.ticketsAvailable,
      extra.incidentsAvailable,
      {
        openTickets: extra.tickets.open,
        criticalTickets: extra.tickets.critical,
        highPriority: extra.tickets.high,
        activeIncidents: extra.incidents.active,
        criticalIncidents: extra.incidents.critical,
        oldestCritical: extra.tickets.oldestCritical,
        recentlyResolved: extra.incidents.recentlyResolved.length > 0 ? extra.incidents.recentlyResolved : extra.tickets.recentlyResolved,
      },
    );

    const build = computeBuildExec(pps, !portfolio.sourceErrors.build, extra.build.activeRuns, extra.build.requiredItemsRemaining);
    const uat = computeUatExec(pps, !portfolio.sourceErrors.uat);

    const recentActivity = buildRecentActivity(extra.activity, projectMap, extra.activityAvailable);

    // Resolve project names for upcoming costs + maintenance.
    const upcomingCosts = extra.upcomingCosts.map((c) => {
      const pp = c.projectId != null ? projectMap.get(c.projectId) : undefined;
      return { key: c.key, name: c.name, projectName: pp?.project.project_name ?? '—', date: c.date, amount: c.amount };
    });
    const maintenance = extra.maintenance.map((m) => {
      const pp = projectMap.get(m.projectId);
      return { key: m.key, title: m.title, projectName: pp?.project.project_name ?? '—', projectSlug: pp?.project.project_slug ?? null, date: m.date };
    });
    const upcoming = buildUpcomingMilestones(pps, upcomingCosts, maintenance);

    const quickAccess = buildQuickAccess(pps);

    const totalCritical = pps.reduce((acc, p) => acc + p.criticalIssues, 0) + aiCriticalAlerts.length + extra.incidents.critical;

    const headerMetrics = buildHeaderMetrics({
      health,
      criticalIssues: totalCritical,
      activeProjects: portfolioSummary.active,
      liveProjects: portfolioSummary.live,
      launchesPending: launchPipeline.pendingApproval + launchPipeline.awaitingDeployment,
      deploymentsActive: deployments.active + deployments.verifying,
      aiSites: ai.sites.length,
      aiCriticalAlerts: aiCriticalAlerts.length,
    });

    return {
      configured,
      loading: portfolio.loading || !extra.loaded,
      portfolioLoading: portfolio.loading,
      projectsAvailable,
      health,
      headerMetrics,
      needsAttention,
      portfolioSummary,
      launchPipeline,
      liveOps,
      liveSummary,
      deployments,
      ai: aiExec,
      runtime,
      commercial,
      support,
      build,
      uat,
      recentActivity,
      upcoming,
      quickAccess,
      refresh: () => {
        portfolio.refresh();
        setReloadKey((k) => k + 1);
      },
    };
  }, [
    configured,
    portfolio.projects,
    portfolio.loading,
    portfolio.sourceErrors,
    ai,
    aiCriticalAlertInputs,
    runtimeOffline,
    extra,
    aiAvailable,
    aiAgents,
    aiActiveRuns,
    aiPendingApprovals,
    aiCriticalAlerts,
    aiCost,
  ]);
}