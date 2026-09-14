import { useExecutiveDashboard } from './useExecutiveDashboard';
import ExecutiveHeader from './components/ExecutiveHeader';
import NeedsAttentionPanel from './components/NeedsAttentionPanel';
import PortfolioSummaryPanel from './components/PortfolioSummaryPanel';
import LiveOperationsPanel from './components/LiveOperationsPanel';
import DeploymentsPanel from './components/DeploymentsPanel';
import AiRuntimePanel from './components/AiRuntimePanel';
import CommercialSupportPanel from './components/CommercialSupportPanel';
import BuildUatPanel from './components/BuildUatPanel';
import ActivityPanel from './components/ActivityPanel';

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="h-10 w-56 bg-background-100 rounded-lg animate-pulse"></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
        ))}
      </div>
      <div className="h-48 bg-background-100 rounded-lg animate-pulse"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-40 bg-background-100 rounded-lg animate-pulse"></div>
        <div className="h-40 bg-background-100 rounded-lg animate-pulse"></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const d = useExecutiveDashboard();

  return (
    <div className="space-y-5">
      <ExecutiveHeader health={d.health} metrics={d.headerMetrics} />

      {!d.configured ? (
        <div className="flex flex-col items-center justify-center py-16 bg-background-100 border border-background-200/60 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-accent-500/10 flex items-center justify-center mb-4">
            <i className="ri-radar-line text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
          </div>
          <h2 className="text-base font-heading font-semibold text-foreground-100">Backend not connected</h2>
          <p className="text-sm text-foreground-500 mt-1 max-w-md text-center">
            The executive dashboard reads live project, launch, deployment, operations, AI, support and commercial data.
            Connect a backend to populate this control room with real figures.
          </p>
        </div>
      ) : d.loading ? (
        <Skeleton />
      ) : (
        <>
          <NeedsAttentionPanel items={d.needsAttention} />

          <PortfolioSummaryPanel summary={d.portfolioSummary} pipeline={d.launchPipeline} available={d.projectsAvailable} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <LiveOperationsPanel summary={d.liveSummary} items={d.liveOps} available={d.projectsAvailable} />
            <DeploymentsPanel data={d.deployments} />
          </div>

          <AiRuntimePanel ai={d.ai} runtime={d.runtime} />

          <CommercialSupportPanel commercial={d.commercial} support={d.support} />

          <BuildUatPanel build={d.build} uat={d.uat} />

          <ActivityPanel
            activity={d.recentActivity}
            activityAvailable={d.projectsAvailable}
            upcoming={d.upcoming}
            quickAccess={d.quickAccess}
          />
        </>
      )}
    </div>
  );
}