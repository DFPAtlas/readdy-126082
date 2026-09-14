import type { BuildExec, UatExec } from '../executiveTypes';
import { SectionHeading, Unavailable, Metric } from './shared';

export default function BuildUatPanel({ build, uat }: { build: BuildExec; uat: UatExec }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Build pipeline */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-hammer-line" title="Build Pipeline" action={{ label: 'Open Build Process', to: '/build-process' }} />

        {!build.available ? (
          <Unavailable label="Build data unavailable" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric label="Active Build Runs" value={build.activeRuns} />
            <Metric label="Blocked Projects" value={build.blockedProjects} tone={build.blockedProjects > 0 ? 'text-red-400' : 'text-emerald-400'} />
            <Metric label="Required Items Remaining" value={build.requiredItemsRemaining} />
            <Metric label="Near Launch Readiness" value={build.nearLaunchReadiness} tone="text-emerald-400" />
            <Metric label="No Build Checklist" value={build.noChecklist} tone={build.noChecklist > 0 ? 'text-amber-400' : 'text-foreground-100'} />
          </div>
        )}
      </section>

      {/* UAT summary */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-clipboard-line" title="UAT Summary" action={{ label: 'Open UAT', to: '/admin/website-uat' }} />

        {!uat.available ? (
          <Unavailable label="UAT data unavailable" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="In UAT" value={uat.inUat} />
            <Metric label="Tests Running" value={uat.testsRunning} />
            <Metric label="Awaiting Approval" value={uat.awaitingApproval} tone={uat.awaitingApproval > 0 ? 'text-amber-400' : 'text-foreground-100'} />
            <Metric label="Approved" value={uat.approved} tone="text-emerald-400" />
            <Metric label="Rejected" value={uat.rejected} tone={uat.rejected > 0 ? 'text-red-400' : 'text-foreground-100'} />
            <Metric label="Critical Defects" value={uat.criticalDefects} tone={uat.criticalDefects > 0 ? 'text-red-400' : 'text-emerald-400'} />
            <Metric label="Ready for Launch" value={uat.readyForLaunch} tone="text-emerald-400" />
          </div>
        )}
      </section>
    </div>
  );
}