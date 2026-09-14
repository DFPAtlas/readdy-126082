// ============================================================================
// DFP COMMAND 15A — PROJECT PORTFOLIO CONTROL — DATA HOOK
// ============================================================================
// Bulk-loads every project + its project-scoped source data in a small number
// of shared queries (no per-project N+1), then aggregates into PortfolioProject
// records via the pure helpers in portfolioDerive.ts. Each source fails
// independently — a single failed query surfaces as "unavailable" (Unknown),
// never a fabricated zero or a green state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Project, Bug } from './detail/types';
import type { ProjectIntegration } from './detail/infrastructureTypes';
import type { ProjectBuildRun } from './detail/buildUtils';
import type { ProjectDeployment } from './detail/deploymentTypes';
import type { LaunchApproval } from './detail/launchTypes';
import type { MonitoringInputs } from './detail/monitoringUtils';
import type {
  MonitoredWebsite,
  SupabaseMonitor,
  MonitoringIncident,
  MonitoringAlert,
} from './detail/monitoringTypes';
import type {
  ProjectBudget,
  CostItem,
  RecurringCost,
} from '@/pages/project-budget/types';
import { computeBudgetSummary } from './detail/budgetUtils';
import type { SupportTicket } from '@/types/support-tickets';
import type { UatFeedback } from '@/pages/admin/website-uat/types';
import type { PortfolioProject } from './portfolioTypes';
import {
  deriveBuildIndicator,
  deriveUatIndicator,
  deriveLaunchIndicator,
  deriveDeploymentIndicator,
  deriveBudgetIndicator,
  deriveHealthIndicator,
  portfolioIntegrationCompleteness,
  computeCriticalIssues,
  deriveAttentionReasons,
  deriveTargetLaunch,
  isStaleProject,
  describeLastActivity,
} from './portfolioDerive';

export interface PortfolioSourceErrors {
  projects: boolean;
  integrations: boolean;
  build: boolean;
  uat: boolean;
  bugs: boolean;
  support: boolean;
  monitoring: boolean;
  deployment: boolean;
  launch: boolean;
  budget: boolean;
  activity: boolean;
}

const NO_ERRORS: PortfolioSourceErrors = {
  projects: false,
  integrations: false,
  build: false,
  uat: false,
  bugs: false,
  support: false,
  monitoring: false,
  deployment: false,
  launch: false,
  budget: false,
  activity: false,
};

export interface PortfolioData {
  projects: PortfolioProject[];
  loading: boolean;
  configured: boolean;
  sourceErrors: PortfolioSourceErrors;
  refresh: () => void;
}

interface ActivityRow {
  id: number;
  action: string;
  description: string | null;
  entity_type: string;
  entity_id: number | null;
  project_id: number | null;
  created_at: string;
}

const BUILD_SELECT =
  'id,project_id,run_name,run_status,progress_percent,launch_blockers_remaining,total_items,completed_items,started_at,completed_at,created_at';
const DEPLOY_SELECT =
  'id,project_id,status,github_sha,deployed_sha,rollback_sha,production_accepted,failure_reason,created_at';
const LAUNCH_SELECT =
  'id,project_id,decision,requested_at,decided_at,github_sha,last_known_good_sha,created_at';
const ACTIVITY_SELECT =
  'id,action,description,entity_type,entity_id,project_id,created_at';

export function usePortfolio(): PortfolioData {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceErrors, setSourceErrors] = useState<PortfolioSourceErrors>(NO_ERRORS);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setSourceErrors(NO_ERRORS);

    if (!configured) {
      if (id === requestIdRef.current) {
        setProjects([]);
        setLoading(false);
      }
      return;
    }

    // 1. Canonical registry.
    const { data: projectRows, error: projErr } = await supabase
      .from('internal_projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (id !== requestIdRef.current) return;
    if (projErr) {
      setSourceErrors((e) => ({ ...e, projects: true }));
      setProjects([]);
      setLoading(false);
      return;
    }

    const allProjects = (projectRows ?? []) as Project[];
    const ids = allProjects.map((p) => p.id);
    const errors: PortfolioSourceErrors = { ...NO_ERRORS };

    // Helper: run a query, capture error, return rows.
    const bulk = async <T extends { [key: string]: unknown }>(
      fn: () => Promise<{ data: T[] | null; error: { message?: string } | null }>,
      onError: () => void,
    ): Promise<T[]> => {
      try {
        const { data, error } = await fn();
        if (error) {
          onError();
          return [];
        }
        return (data ?? []) as T[];
      } catch {
        onError();
        return [];
      }
    };

    const flag = (key: keyof PortfolioSourceErrors) => {
      errors[key] = true;
    };

    // Fire all source queries in parallel.
    const [
      integrations,
      buildRuns,
      uatProjects,
      bugs,
      supportTickets,
      websites,
      supabaseMonitors,
      incidents,
      alerts,
      deployments,
      approvals,
      budgets,
      costItems,
      recurringCosts,
      activityByProject,
      activityByEntity,
    ] = await Promise.all([
      bulk<ProjectIntegration>(
        () => supabase.from('internal_project_integrations').select('*').in('project_id', ids),
        () => flag('integrations'),
      ),
      bulk<ProjectBuildRun>(
        () => supabase.from('internal_build_process_runs').select(BUILD_SELECT).in('project_id', ids),
        () => flag('build'),
      ),
      bulk<{ id: string; internal_project_id: number | null }>(
        () => supabase.from('uat_projects').select('id,internal_project_id').in('internal_project_id', ids),
        () => flag('uat'),
      ),
      bulk<Bug>(
        () => supabase.from('internal_bugs').select('id,project_id,severity,status').in('project_id', ids),
        () => flag('bugs'),
      ),
      bulk<SupportTicket>(
        () => supabase.from('internal_support_tickets').select('id,project_id,priority,status').in('project_id', ids),
        () => flag('support'),
      ),
      bulk<MonitoredWebsite>(
        () => supabase.from('internal_monitored_websites').select('*').in('project_id', ids),
        () => flag('monitoring'),
      ),
      bulk<SupabaseMonitor>(
        () => supabase.from('internal_supabase_monitors').select('*').in('project_id', ids),
        () => flag('monitoring'),
      ),
      bulk<MonitoringIncident>(
        () => supabase.from('internal_monitoring_incidents').select('*').in('project_id', ids),
        () => flag('monitoring'),
      ),
      bulk<MonitoringAlert>(
        () => supabase.from('internal_monitoring_alerts').select('*').in('project_id', ids),
        () => flag('monitoring'),
      ),
      bulk<ProjectDeployment>(
        () => supabase.from('internal_project_deployments').select(DEPLOY_SELECT).in('project_id', ids),
        () => flag('deployment'),
      ),
      bulk<LaunchApproval>(
        () => supabase.from('internal_project_launch_approvals').select(LAUNCH_SELECT).in('project_id', ids),
        () => flag('launch'),
      ),
      bulk<ProjectBudget>(
        () => supabase.from('internal_project_budgets').select('*').in('project_id', ids),
        () => flag('budget'),
      ),
      bulk<CostItem>(
        () => supabase.from('internal_project_cost_items').select('*').in('project_id', ids),
        () => flag('budget'),
      ),
      bulk<RecurringCost>(
        () => supabase.from('internal_project_recurring_costs').select('*').in('project_id', ids),
        () => flag('budget'),
      ),
      bulk<ActivityRow>(
        () => supabase.from('internal_activity_log').select(ACTIVITY_SELECT).in('project_id', ids).order('created_at', { ascending: false }).limit(500),
        () => flag('activity'),
      ),
      bulk<ActivityRow>(
        () => supabase.from('internal_activity_log').select(ACTIVITY_SELECT).eq('entity_type', 'project').in('entity_id', ids).order('created_at', { ascending: false }).limit(500),
        () => flag('activity'),
      ),
    ]);

    if (id !== requestIdRef.current) return;

    // ── Group sources by project ────────────────────────────────────────────
    const byProject = <T extends { project_id?: number | null }>(rows: T[]): Map<number, T[]> => {
      const m = new Map<number, T[]>();
      for (const r of rows) {
        if (r.project_id == null) continue;
        const arr = m.get(r.project_id) ?? [];
        arr.push(r);
        m.set(r.project_id, arr);
      }
      return m;
    };

    const integrationMap = new Map<number, ProjectIntegration>();
    for (const r of integrations) integrationMap.set(r.project_id, r);

    const buildMap = byProject(buildRuns);
    const bugMap = byProject(bugs);
    const supportMap = byProject(supportTickets);
    const websiteMap = byProject(websites);
    const supabaseMap = byProject(supabaseMonitors);
    const incidentMap = byProject(incidents);
    const alertMap = byProject(alerts);
    const deploymentMap = byProject(deployments);
    const approvalMap = byProject(approvals);
    const budgetMap = byProject(budgets);
    const costMap = byProject(costItems);
    const recurringMap = byProject(recurringCosts);

    // UAT: map internal_project_id -> uat project id, then per-uat-project data.
    const uatInternalToUuid = new Map<number, string>();
    for (const u of uatProjects) {
      if (u.internal_project_id != null) uatInternalToUuid.set(u.internal_project_id, u.id);
    }
    const uatUuids = Array.from(uatInternalToUuid.values());

    let uatApprovals: { project_id: string; status: string; created_at: string | null }[] = [];
    let uatFeedback: UatFeedback[] = [];
    let uatJobs: { project_id: string }[] = [];
    if (uatUuids.length > 0) {
      const [a, f, j] = await Promise.all([
        bulk<{ project_id: string; status: string; created_at: string | null }>(
          () => supabase.from('uat_approvals').select('project_id,status,created_at').in('project_id', uatUuids),
          () => flag('uat'),
        ),
        bulk<UatFeedback>(
          () => supabase.from('uat_feedback').select('id,project_id,severity,status,internal_bug_id').in('project_id', uatUuids),
          () => flag('uat'),
        ),
        bulk<{ project_id: string }>(
          () => supabase.from('uat_jobs').select('project_id').in('project_id', uatUuids),
          () => flag('uat'),
        ),
      ]);
      uatApprovals = a;
      uatFeedback = f;
      uatJobs = j;
    }

    if (id !== requestIdRef.current) return;

    const latestApprovalByUuid = new Map<string, string | null>();
    for (const a of uatApprovals) {
      if (!latestApprovalByUuid.has(a.project_id)) latestApprovalByUuid.set(a.project_id, a.status);
    }
    const uatJobUuids = new Set(uatJobs.map((j) => j.project_id));
    const uatCriticalByUuid = new Map<string, boolean>();
    const RESOLVED = new Set(['fixed', 'closed', 'wont_fix', 'duplicate', 'resolved']);
    for (const f of uatFeedback) {
      if ((f.severity ?? '').toLowerCase() === 'critical' && !RESOLVED.has((f.status ?? '').toLowerCase())) {
        uatCriticalByUuid.set(f.project_id, true);
      }
    }

    // Latest activity per project (merge both activity queries).
    const activityByProjectMap = new Map<number, ActivityRow>();
    for (const a of [...activityByProject, ...activityByEntity]) {
      const pid = a.entity_type === 'project' && a.entity_id != null ? a.entity_id : a.project_id;
      if (pid == null) continue;
      const cur = activityByProjectMap.get(pid);
      if (!cur || a.created_at > cur.created_at) activityByProjectMap.set(pid, a);
    }

    // ── Assemble PortfolioProject per project ───────────────────────────────
    const result: PortfolioProject[] = allProjects.map((project) => {
      const integration = integrationMap.get(project.id) ?? null;
      const runList = buildMap.get(project.id) ?? [];
      const activeRun = runList.find((r) => r.run_status === 'active') ?? runList[0] ?? null;

      const uatUuid = uatInternalToUuid.get(project.id);
      const uatInput = {
        linked: uatUuid != null,
        approvalStatus: uatUuid ? latestApprovalByUuid.get(uatUuid) ?? null : null,
        hasCritical: uatUuid ? uatCriticalByUuid.get(uatUuid) ?? false : false,
        hasRun: uatUuid ? uatJobUuids.has(uatUuid) : false,
      };

      const budgetSummary = computeBudgetSummary(
        budgetMap.get(project.id) ?? [],
        costMap.get(project.id) ?? [],
        recurringMap.get(project.id) ?? [],
      );

      const monitoringInputs: MonitoringInputs = {
        websites: websiteMap.get(project.id) ?? [],
        supabaseMonitors: supabaseMap.get(project.id) ?? [],
        edgeFunctions: [],
        agents: [],
        webhooks: [],
        incidents: incidentMap.get(project.id) ?? [],
        alerts: alertMap.get(project.id) ?? [],
        config: {
          monitoringProvider: integration?.monitoring_provider,
          productionUrl: integration?.production_url ?? project.domain_live,
          stagingUrl: integration?.staging_url ?? project.domain_staging,
          supabaseRef: integration?.supabase_project_ref,
          runtimeNode: integration?.runtime_node,
        },
        anyLoadFailed: errors.monitoring,
      };

      const latestApproval = (approvalMap.get(project.id) ?? [])
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .find((a) => a.decision !== 'SUPERSEDED') ?? null;

      const latestActivity = activityByProjectMap.get(project.id) ?? null;
      const lastActivity = describeLastActivity(
        latestActivity?.created_at ?? null,
        latestActivity?.description ?? latestActivity?.action ?? null,
      );

      const pp: PortfolioProject = {
        project,
        integration,
        build: deriveBuildIndicator(activeRun, errors.build),
        uat: deriveUatIndicator(uatInput, errors.uat),
        launch: deriveLaunchIndicator(project, latestApproval, errors.launch),
        deployment: deriveDeploymentIndicator(deploymentMap.get(project.id) ?? [], errors.deployment),
        budget: deriveBudgetIndicator(budgetSummary, errors.budget),
        health: deriveHealthIndicator(project, monitoringInputs, errors.monitoring),
        integrations: portfolioIntegrationCompleteness(project, integration),
        criticalIssues: computeCriticalIssues(
          bugMap.get(project.id) ?? [],
          uatFeedback.filter((f) => f.project_id === uatUuid),
          incidentMap.get(project.id) ?? [],
          alertMap.get(project.id) ?? [],
          supportMap.get(project.id) ?? [],
        ),
        attention: [],
        targetLaunch: deriveTargetLaunch(project),
        lastActivity,
        stale: isStaleProject(project, latestActivity?.created_at ?? null),
      };
      pp.attention = deriveAttentionReasons(pp);
      return pp;
    });

    setProjects(result);
    setSourceErrors(errors);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { projects, loading, configured, sourceErrors, refresh };
}