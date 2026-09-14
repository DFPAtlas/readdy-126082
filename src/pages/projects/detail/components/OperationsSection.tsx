import { useState } from 'react';
import type { Project, Bug, ChangeRequest, SectionKey } from '../types';
import type { ProjectIntegration } from '../infrastructureTypes';
import type { RecurringCost, CostItem } from '@/pages/project-budget/types';
import type { MonitoringIncident, MonitoringAlert } from '../monitoringTypes';
import type { ProjectOperationsData } from '../useProjectOperations';
import type { ProjectDeploymentData } from '../useProjectDeployment';
import {
  computeMaintenanceSummary,
  computeTechnicalDebtSummary,
  buildImprovementBacklog,
  computeRecurringCostReview,
  computeHealthTrend,
  deriveSecurityReviewState,
} from '../operationsTypes';
import OperationsMaintenancePanel from './OperationsMaintenancePanel';
import OperationsImprovementPanel from './OperationsImprovementPanel';
import OperationsReviewPanel from './OperationsReviewPanel';
import OperationsChecksPanel from './OperationsChecksPanel';
import PlanMaintenanceModal from './PlanMaintenanceModal';

interface OperationsSectionProps {
  project: Project;
  operations: ProjectOperationsData;
  changeRequests: ChangeRequest[];
  bugs: Bug[];
  integration: ProjectIntegration | null;
  deployment: ProjectDeploymentData;
  monitoringStatusLabel: string;
  monitoringIncidents: MonitoringIncident[];
  monitoringAlerts: MonitoringAlert[];
  supportOpen: number;
  supportCritical: number;
  budgetStatusLabel: string;
  recurringCosts: RecurringCost[];
  costItems: CostItem[];
  onNavigate: (key: SectionKey) => void;
  onRefresh: () => void;
}

export default function OperationsSection({
  project,
  operations,
  changeRequests,
  bugs,
  integration,
  deployment,
  monitoringStatusLabel,
  monitoringIncidents,
  monitoringAlerts,
  supportOpen,
  supportCritical,
  budgetStatusLabel,
  recurringCosts,
  costItems,
  onNavigate,
  onRefresh,
}: OperationsSectionProps) {
  const [showPlanMaintenance, setShowPlanMaintenance] = useState(false);

  const maintenanceSummary = computeMaintenanceSummary(operations.maintenance);
  const technicalDebtSummary = computeTechnicalDebtSummary(changeRequests);
  const backlog = buildImprovementBacklog(changeRequests, bugs, operations.maintenance);
  const costReview = computeRecurringCostReview(recurringCosts, costItems);
  const healthTrend = computeHealthTrend(monitoringIncidents, monitoringAlerts);
  const securityState = deriveSecurityReviewState(operations.maintenance, false);

  const criticalBugs = bugs.filter(
    (b) => b.severity === 'critical' && !['fixed', 'resolved', 'wont_fix', 'duplicate', 'closed'].includes(b.status),
  ).length;

  const isLive = project.status === 'live' || project.launched_at != null;
  const hasPostLaunchReview = operations.reviews.some(
    (r) => r.review_type === 'POST_LAUNCH' && r.status === 'COMPLETED',
  );
  const postLaunchReviewRequired = isLive && !hasPostLaunchReview;

  const needsAttention: { label: string; detail: string; icon: string; tone: string }[] = [];
  if (maintenanceSummary.overdue > 0) {
    needsAttention.push({ label: 'Overdue maintenance', detail: `${maintenanceSummary.overdue} overdue`, icon: 'ri-alarm-warning-line', tone: 'text-red-400' });
  }
  if (technicalDebtSummary.criticalHigh > 0) {
    needsAttention.push({ label: 'Critical technical debt', detail: `${technicalDebtSummary.criticalHigh} critical/high`, icon: 'ri-error-warning-line', tone: 'text-red-400' });
  }
  if (postLaunchReviewRequired) {
    needsAttention.push({ label: 'Post-launch review required', detail: 'Project live with no completed review', icon: 'ri-file-list-3-line', tone: 'text-amber-400' });
  }
  const highPriorityBacklog = backlog.filter((i) => i.priority === 'critical' || i.priority === 'high').length;
  if (highPriorityBacklog > 0) {
    needsAttention.push({ label: 'High-priority improvement backlog', detail: `${highPriorityBacklog} high priority`, icon: 'ri-lightbulb-line', tone: 'text-sky-400' });
  }
  if (costReview.overdue.length > 0) {
    needsAttention.push({ label: 'Critical recurring-cost issue', detail: `${costReview.overdue.length} overdue`, icon: 'ri-money-pound-circle-line', tone: 'text-red-400' });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Project Operations</h3>
          <p className="text-sm text-foreground-500 mt-1">Continuous improvement for {project.project_name} — maintenance, technical debt, backlog and operational review.</p>
        </div>
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div className="bg-background-50 border border-amber-500/20 rounded-lg p-4">
          <h4 className="flex items-center gap-2 text-xs font-label font-semibold text-amber-400 uppercase tracking-wide mb-3">
            <i className="ri-alert-line w-4 h-4 flex items-center justify-center"></i>
            Operations Needs Attention
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {needsAttention.map((n) => (
              <div key={n.label} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-background-100 border border-background-200/60">
                <i className={`${n.icon} ${n.tone} w-4 h-4 flex items-center justify-center shrink-0`}></i>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-200 truncate">{n.label}</p>
                  <p className="text-[10px] text-foreground-500 truncate">{n.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OperationsMaintenancePanel
            project={project}
            operations={operations}
            bugs={bugs}
            changeRequests={changeRequests}
            onPlanMaintenance={() => setShowPlanMaintenance(true)}
            onRefresh={onRefresh}
          />
          <OperationsImprovementPanel
            project={project}
            changeRequests={changeRequests}
            bugs={bugs}
            maintenance={operations.maintenance}
            onRefresh={onRefresh}
          />
        </div>
        <div className="space-y-6">
          <OperationsReviewPanel
            project={project}
            operations={operations}
            deployment={deployment}
            monitoringStatusLabel={monitoringStatusLabel}
            monitoringIncidents={monitoringIncidents}
            supportOpen={supportOpen}
            supportCritical={supportCritical}
            criticalBugs={criticalBugs}
            budgetStatusLabel={budgetStatusLabel}
            backlogCount={backlog.length}
            onPlanMaintenance={() => setShowPlanMaintenance(true)}
            onRefresh={onRefresh}
          />
          <OperationsChecksPanel
            recurringCosts={recurringCosts}
            costItems={costItems}
            integration={integration}
            securityState={securityState}
            healthTrend={healthTrend}
            budgetStatusLabel={budgetStatusLabel}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      <PlanMaintenanceModal
        open={showPlanMaintenance}
        onClose={() => setShowPlanMaintenance(false)}
        onSubmit={operations.planMaintenance}
        projectName={project.project_name}
      />
    </div>
  );
}