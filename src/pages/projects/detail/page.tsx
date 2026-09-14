import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import ProjectWizardModal from '@/pages/projects/components/ProjectWizardModal';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import {
  Project,
  Idea,
  Bug,
  ChangeRequest,
  Note,
  FileLink,
  SectionKey,
  isSectionKey,
} from './types';
import CommandNav from './components/CommandNav';
import ProjectHeader from './components/ProjectHeader';
import OverviewSection from './components/OverviewSection';
import BugsSection from './components/BugsSection';
import ChangesSection from './components/ChangesSection';
import FilesSection from './components/FilesSection';
import ActivitySection from './components/ActivitySection';
import PlaceholderSection from './components/PlaceholderSection';
import BuildSection from './components/BuildSection';
import InfrastructureSection from './components/InfrastructureSection';
import GitHubSection from './components/GitHubSection';
import { useProjectBuild } from './useProjectBuild';
import { useProjectInfrastructure } from './useProjectInfrastructure';
import { useProjectUat } from './useProjectUat';
import { buildStatusSummary } from './buildUtils';
import UatSection from './components/UatSection';
import BudgetSection from './components/BudgetSection';
import { useProjectBudget } from './useProjectBudget';
import { formatMoney, statusLabel } from './budgetUtils';
import SupportSection from './components/SupportSection';
import { useProjectSupport } from './useProjectSupport';
import { computeSupportSummary, deriveSupportStatus, SUPPORT_STATUS_LABELS } from './supportTypes';
import MonitoringSection from './components/MonitoringSection';
import { useProjectMonitoring } from './useProjectMonitoring';
import { computeMonitoringSummary } from './monitoringUtils';
import { PROJECT_HEALTH_LABELS } from './monitoringTypes';
import LaunchSection from './components/LaunchSection';
import { useProjectLaunch } from './useProjectLaunch';
import { evaluateLaunch, DECISION_LABELS } from './launchTypes';
import DeploymentSection from './components/DeploymentSection';
import { useProjectDeployment } from './useProjectDeployment';
import { evaluateDeployment, computeDeploymentOverview } from './deploymentTypes';
import { useProjectActivity } from './useProjectActivity';
import { buildActivityTimeline, computeLifecycleMilestones } from './activityTypes';
import OperationsSection from './components/OperationsSection';
import { useProjectOperations } from './useProjectOperations';
import { computeMaintenanceSummary, computeTechnicalDebtSummary, buildImprovementBacklog } from './operationsTypes';

function titleCase(s: string): string {
  return s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSection = searchParams.get('section');
  const section: SectionKey = isSectionKey(rawSection) ? rawSection : 'overview';

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedError, setRelatedError] = useState('');

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [fileLinks, setFileLinks] = useState<FileLink[]>([]);

  const [relatedLoading, setRelatedLoading] = useState(false);


  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const refreshProject = useCallback(async () => {
    if (!slug) return;
    try {
      const { data, error: dbError } = await supabase
        .from('internal_projects')
        .select('*')
        .eq('project_slug', slug)
        .maybeSingle();
      if (dbError) throw dbError;
      if (data) setProject(data);
    } catch {
      // keep existing project state on refresh failure
    }
  }, [slug]);

  const build = useProjectBuild(project?.id);
  const infra = useProjectInfrastructure(project?.id, project?.project_name);
  const uat = useProjectUat(project?.id, project?.project_name);
  const budget = useProjectBudget(project?.id, project?.project_name);
  const support = useProjectSupport(project?.id);
  const monitoring = useProjectMonitoring(project?.id);
  const activity = useProjectActivity(project?.id);
  const launch = useProjectLaunch(project?.id, project?.project_name);
  const deployment = useProjectDeployment(project?.id, project?.project_name, project, refreshProject);
  const operations = useProjectOperations(project?.id, project?.project_name);

  const activityTimeline = useMemo(
    () =>
      buildActivityTimeline({
        activityEntries: activity.entries,
        budgetEvents: budget.events,
        buildRuns: build.runs,
        uat: uat.data,
        bugs,
        changeRequests,
        supportTickets: support.tickets,
        supportEvents: support.events,
        monitoringIncidents: monitoring.incidents,
        monitoringAlerts: monitoring.alerts,
        integration: infra.integration,
      }),
    [
      activity.entries,
      budget.events,
      build.runs,
      uat.data,
      bugs,
      changeRequests,
      support.tickets,
      support.events,
      monitoring.incidents,
      monitoring.alerts,
      infra.integration,
    ],
  );

  const activityMilestones = useMemo(
    () =>
      computeLifecycleMilestones({
        projectCreatedAt: project?.created_at ?? null,
        launchedAt: project?.launched_at ?? null,
        isLive: project?.status === 'live' || project?.launched_at != null,
        buildRuns: build.runs,
        uat: uat.data,
        monitoringConfigured: Boolean(infra.integration?.monitoring_provider),
      }),
    [project?.created_at, project?.launched_at, project?.status, build.runs, uat.data, infra.integration?.monitoring_provider],
  );

  const loadProject = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('internal_projects')
        .select('*')
        .eq('project_slug', slug)
        .maybeSingle();

      if (dbError) throw dbError;
      if (!data) throw new Error('Project not found');
      setProject(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const loadRelated = useCallback(async (projectId: number) => {
    setRelatedLoading(true);
    setRelatedError('');
    try {
      const [
        { data: ideasData },
        { data: bugsData },
        { data: crData },
        { data: notesData },
        { data: flData },
      ] = await Promise.all([
        supabase.from('internal_ideas').select('id,idea_name,category,priority,status,description,owner,ai_generated').eq('related_project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('internal_bugs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('internal_change_requests').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('internal_notes').select('id,title,category,content,tags,pinned,created_at').eq('project_id', projectId).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('internal_files_links').select('id,name,type,url,description,category').eq('project_id', projectId).order('created_at', { ascending: false }),
      ]);
      setIdeas(ideasData ?? []);
      setBugs(bugsData ?? []);
      setChangeRequests(crData ?? []);
      setNotes(notesData ?? []);
      setFileLinks(flData ?? []);
    } catch {
      setRelatedError('Some project data could not be loaded.');
    } finally {
      setRelatedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (project?.id) {
      loadRelated(project.id);
    }
  }, [project?.id, loadRelated]);


  const selectSection = useCallback(
    (key: SectionKey) => {
      setSearchParams({ section: key });
    },
    [setSearchParams],
  );

  const logActivity = async (action: string) => {
    if (!project) return;
    try {
      await supabase.from('internal_activity_log').insert({
        entity_type: 'project',
        entity_id: project.id,
        action,
        description: `${action} project: ${project.project_name}`,
      });
    } catch {
      // non-critical
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    setActionLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('internal_projects')
        .update({ status: 'archived' })
        .eq('id', project.id);
      if (dbError) throw dbError;
      await logActivity('archived');
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Failed to archive project');
    } finally {
      setActionLoading(false);
      setShowArchiveDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    setActionLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('internal_projects')
        .delete()
        .eq('id', project.id);
      if (dbError) throw dbError;
      await logActivity('deleted');
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-5 bg-background-100 rounded w-56"></div>
        <div className="h-40 bg-background-100 rounded-lg"></div>
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-background-100 rounded-full w-24"></div>
          ))}
        </div>
        <div className="h-64 bg-background-100 rounded-lg"></div>
      </div>
    );
  }

  // --- Error ---
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-error-warning-line text-2xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
        </div>
        <h2 className="text-lg font-heading font-semibold text-foreground-200 mb-2">
          {error || 'Project not found'}
        </h2>
        <p className="text-sm text-foreground-500 mb-4">The project you're looking for doesn't exist or was removed.</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadProject}
            className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
          <Link
            to="/projects"
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const counts: Partial<Record<SectionKey, number>> = {
    bugs: bugs.length,
    changes: changeRequests.length,
    files: fileLinks.length,
  };

  const buildSummary = buildStatusSummary(
    build.activeRun,
    build.activeRun ? (build.itemsByRun[build.activeRun.id] ?? []) : [],
  );
  const buildProgressLabel = build.activeRun ? `${buildSummary.progressPercent}%` : 'Not Started';
  const buildStatusDetail = build.activeRun
    ? `${buildSummary.progressPercent}% complete${buildSummary.openBlockers > 0 ? ` · ${buildSummary.openBlockers} blockers` : ''}`
    : 'No checklist';

  const uatStatusLabel = uat.summary.linked ? titleCase(uat.summary.uatStatus) : 'Not Configured';
  const uatStatusDetail = uat.summary.linked
    ? `${uat.summary.passRate == null ? 'No completed tests' : `${Math.round(uat.summary.passRate * 100)}% pass`} · ${uat.summary.openDefects} open defects`
    : 'No linked UAT project';
  const uatCardValue = uat.summary.linked
    ? `${titleCase(uat.summary.uatStatus)}${uat.summary.passRate != null ? ` · ${Math.round(uat.summary.passRate * 100)}%` : ''}`
    : 'Not Configured';

  const budgetStatusLabel = budget.summary.hasAnyBudget ? statusLabel(budget.summary.status) : 'No Budget';
  const budgetStatusDetail = budget.summary.hasAnyBudget
    ? `${formatMoney(budget.summary.actualSpend)} spent · ${formatMoney(budget.summary.remainingBudget)} remaining`
    : 'No approved budget';

  const supportSummary = computeSupportSummary(support.tickets, bugs, changeRequests);
  const supportStatus = deriveSupportStatus(support.tickets, Boolean(support.error));
  const supportStatusLabel = SUPPORT_STATUS_LABELS[supportStatus];
  const supportStatusDetail = supportSummary.openTickets > 0
    ? `${supportSummary.openTickets} open · ${supportSummary.critical} critical`
    : 'No linked tickets';

  const monitoringSummary = computeMonitoringSummary({
    websites: monitoring.websites,
    supabaseMonitors: monitoring.supabaseMonitors,
    edgeFunctions: monitoring.edgeFunctions,
    agents: monitoring.agents,
    webhooks: monitoring.webhooks,
    incidents: monitoring.incidents,
    alerts: monitoring.alerts,
    config: {
      monitoringProvider: infra.integration?.monitoring_provider,
      productionUrl: infra.integration?.production_url ?? project.domain_live,
      stagingUrl: infra.integration?.staging_url ?? project.domain_staging,
      supabaseRef: infra.integration?.supabase_project_ref,
      runtimeNode: infra.integration?.runtime_node,
    },
    anyLoadFailed: Object.keys(monitoring.errors).length > 0,
  });
  const monitoringStatusLabel = PROJECT_HEALTH_LABELS[monitoringSummary.health];
  const monitoringStatusDetail = monitoringSummary.activeAlerts > 0
    ? `${monitoringSummary.productionLabel} · ${monitoringSummary.activeAlerts} alert${monitoringSummary.activeAlerts > 1 ? 's' : ''}`
    : monitoringSummary.productionLabel;

  const launchEvaluation = evaluateLaunch({
    project,
    buildRuns: build.runs,
    buildItemsByRun: build.itemsByRun,
    buildError: Boolean(build.error),
    integration: infra.integration,
    infraError: Boolean(infra.error),
    uat: uat.data,
    uatError: Boolean(uat.error),
    bugs,
    changeRequests,
    budget: budget.summary,
    budgetError: Boolean(budget.error),
    supportTickets: support.tickets,
    supportError: Boolean(support.error),
    monitoring: monitoringSummary,
    monitoringAnyLoadFailed: Object.keys(monitoring.errors).length > 0,
    approval: launch.latest,
    approvalConfigured: launch.configured,
  });

  const deploymentEvaluation = evaluateDeployment({
    project,
    approval: launch.latest,
    approvalConfigured: launch.configured,
    evaluation: launchEvaluation,
    integration: infra.integration,
  });

  const isLaunched = project.status === 'live' || project.launched_at != null;
  const launchStatusLabel = isLaunched ? 'Live' : DECISION_LABELS[launchEvaluation.decision];
  const launchStatusDetail = launchEvaluation.blockerCount > 0
    ? `${launchEvaluation.blockerCount} blocker${launchEvaluation.blockerCount > 1 ? 's' : ''} · ${launchEvaluation.warningCount} warning${launchEvaluation.warningCount > 1 ? 's' : ''}`
    : launchEvaluation.decision === 'PENDING'
      ? 'Approval required'
      : launchEvaluation.decision === 'GO'
        ? 'Approved · awaiting deployment'
        : undefined;

  const deploymentOverview = computeDeploymentOverview(deploymentEvaluation, deployment.active, deployment.deployments, project);
  const deploymentStatusLabel = deploymentOverview.label;
  const deploymentStatusDetail = deploymentOverview.detail;

  const operationsMaintenanceSummary = computeMaintenanceSummary(operations.maintenance);
  const operationsTechDebt = computeTechnicalDebtSummary(changeRequests);
  const operationsBacklog = buildImprovementBacklog(changeRequests, bugs, operations.maintenance);
  const operationsStatusLabel = operations.error
    ? 'Unavailable'
    : operationsMaintenanceSummary.overdue > 0 || operationsTechDebt.criticalHigh > 0
      ? 'Attention'
      : project.status === 'live'
        ? 'Healthy'
        : 'Not Launched';
  const operationsStatusDetail = `${operationsMaintenanceSummary.openActions} maintenance · ${operationsBacklog.length} improvements`;

  const handleWorkstreamRefresh = () => {
    if (project?.id) loadRelated(project.id);
    uat.refresh();
  };

  const handleSupportRefresh = () => {
    if (project?.id) loadRelated(project.id);
    support.refresh();
  };

  const handleLaunchRefresh = () => {
    if (project?.id) loadRelated(project.id);
    build.refresh();
    infra.refresh();
    uat.refresh();
    budget.refresh();
    support.refresh();
    monitoring.refresh();
    launch.refresh();
  };

  const handleDeploymentRefresh = () => {
    if (project?.id) loadRelated(project.id);
    launch.refresh();
    deployment.refresh();
    monitoring.refresh();
  };

  const handleOperationsRefresh = () => {
    if (project?.id) loadRelated(project.id);
    operations.refresh();
  };

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return (
          <OverviewSection
            project={project}
            ideas={ideas}
            bugs={bugs}
            changeRequests={changeRequests}
            notes={notes}
            fileLinks={fileLinks}
            onNavigate={selectSection}
            buildProgressLabel={buildProgressLabel}
            uatLabel={uatCardValue}
            integration={infra.integration}
            integrationUnavailable={Boolean(infra.error)}
            budgetSummary={budget.summary}
            supportStatusLabel={supportStatusLabel}
            supportStatusDetail={supportStatusDetail}
            monitoringStatusLabel={monitoringStatusLabel}
            monitoringStatusDetail={monitoringStatusDetail}
            launchStatusLabel={launchStatusLabel}
            launchStatusDetail={launchStatusDetail}
            deploymentStatusLabel={deploymentStatusLabel}
            deploymentStatusDetail={deploymentStatusDetail}
            operationsStatusLabel={operationsStatusLabel}
            operationsStatusDetail={operationsStatusDetail}
            activityEvents={activityTimeline}
          />
        );
      case 'uat':
        return <UatSection project={project} uat={uat} buildSummary={buildSummary} integration={infra.integration} />;
      case 'bugs':
        return (
          <BugsSection
            project={project}
            bugs={bugs}
            uat={uat}
            build={build}
            changeRequests={changeRequests}
            onRefresh={handleWorkstreamRefresh}
          />
        );
      case 'changes':
        return (
          <ChangesSection
            project={project}
            changeRequests={changeRequests}
            bugs={bugs}
            build={build}
            uat={uat}
            onRefresh={handleWorkstreamRefresh}
          />
        );
      case 'files':
        return <FilesSection fileLinks={fileLinks} />;
      case 'activity':
        return (
          <ActivitySection
            project={project}
            events={activityTimeline}
            milestones={activityMilestones}
            loading={activity.loading}
            error={activity.error}
            lifecycleStatusLabel={titleCase(project.status)}
            operationalHealthLabel={monitoringStatusLabel}
            onRefresh={activity.refresh}
          />
        );
      case 'build':
        return <BuildSection project={project} build={build} />;
      case 'infrastructure':
        return <InfrastructureSection project={project} infra={infra} />;
      case 'github':
        return (
          <GitHubSection
            project={project}
            integration={infra.integration}
            unavailable={Boolean(infra.error)}
            latestSha={launch.latest?.github_sha ?? null}
            lastKnownGoodSha={launch.latest?.last_known_good_sha ?? null}
            onEdit={() => selectSection('infrastructure')}
          />
        );
      case 'budget':
        return <BudgetSection project={project} budget={budget} buildSummary={buildSummary} uatSummary={uat.summary} />;
      case 'support':
        return (
          <SupportSection
            project={project}
            support={support}
            bugs={bugs}
            changeRequests={changeRequests}
            onRefresh={handleSupportRefresh}
          />
        );
      case 'monitoring':
        return (
          <MonitoringSection
            project={project}
            monitoring={monitoring}
            integration={infra.integration}
            onNavigate={selectSection}
          />
        );
      case 'launch':
        return (
          <LaunchSection
            project={project}
            integration={infra.integration}
            evaluation={launchEvaluation}
            launch={launch}
            onRefresh={handleLaunchRefresh}
          />
        );
      case 'deployment':
        return (
          <DeploymentSection
            project={project}
            integration={infra.integration}
            evaluation={deploymentEvaluation}
            deployment={deployment}
            monitoring={monitoring}
            monitoringSummary={monitoringSummary}
            launchApproval={launch.latest}
            onRefresh={handleDeploymentRefresh}
          />
        );
      case 'operations':
        return (
          <OperationsSection
            project={project}
            operations={operations}
            changeRequests={changeRequests}
            bugs={bugs}
            integration={infra.integration}
            deployment={deployment}
            monitoringStatusLabel={monitoringStatusLabel}
            monitoringIncidents={monitoring.incidents}
            monitoringAlerts={monitoring.alerts}
            supportOpen={supportSummary.openTickets}
            supportCritical={supportSummary.critical}
            budgetStatusLabel={budgetStatusLabel}
            recurringCosts={budget.recurringCosts}
            costItems={budget.costItems}
            onNavigate={selectSection}
            onRefresh={handleOperationsRefresh}
          />
        );
      default:
        return <PlaceholderSection section={section} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-foreground-500">
        <Link to="/projects" className="hover:text-foreground-300 transition-colors whitespace-nowrap">Projects</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <span className="text-foreground-200 font-medium truncate">{project.project_name}</span>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <span className="text-foreground-500 truncate">Command Centre</span>
      </div>

      {/* Header */}
      <ProjectHeader
        project={project}
        onEdit={() => setShowEditWizard(true)}
        onArchive={() => setShowArchiveDialog(true)}
        onDelete={() => setShowDeleteDialog(true)}
        buildStatusLabel={buildSummary.statusLabel}
        buildStatusDetail={buildStatusDetail}
        uatStatusLabel={uatStatusLabel}
        uatStatusDetail={uatStatusDetail}
        budgetStatusLabel={budgetStatusLabel}
        budgetStatusDetail={budgetStatusDetail}
        supportStatusLabel={supportStatusLabel}
        supportStatusDetail={supportStatusDetail}
        monitoringStatusLabel={monitoringStatusLabel}
        monitoringStatusDetail={monitoringStatusDetail}
      />

      {/* Command Centre navigation */}
      <CommandNav active={section} onSelect={selectSection} counts={counts} />

      {/* Related-data failure banner */}
      {relatedError && (
        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{relatedError}</p>
          <button
            type="button"
            onClick={() => loadRelated(project.id)}
            className="text-sm text-red-300 underline whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Section content */}
      {relatedLoading ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse h-48"></div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          {renderSection()}
        </div>
      )}

      {/* Edit wizard */}
      <ProjectWizardModal
        open={showEditWizard}
        onClose={() => setShowEditWizard(false)}
        onCreated={loadProject}
        project={project}
      />

      {/* Archive confirm */}
      <ConfirmDialog
        open={showArchiveDialog}
        onClose={() => setShowArchiveDialog(false)}
        title="Archive Project"
        message={`Archive "${project.project_name}"? It'll be hidden from the active projects list but can be restored later by changing its status back.`}
        confirmLabel={actionLoading ? 'Archiving...' : 'Archive'}
        confirmVariant="accent"
        onConfirm={handleArchive}
        loading={actionLoading}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Project"
        message={`Permanently delete "${project.project_name}"? This action cannot be undone. All related ideas, bugs, change requests, notes, and file links will also be removed.`}
        confirmLabel={actionLoading ? 'Deleting...' : 'Delete Permanently'}
        confirmVariant="danger"
        onConfirm={handleDelete}
        loading={actionLoading}
      />
    </div>
  );
}