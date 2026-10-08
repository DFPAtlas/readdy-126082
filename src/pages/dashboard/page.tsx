import { useState } from 'react';
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

type DashboardView = 'overview' | 'delivery' | 'operations' | 'commercial';

const VIEWS: { key: DashboardView; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-3-line' },
  { key: 'delivery', label: 'Projects & UAT', icon: 'ri-folder-3-line' },
  { key: 'operations', label: 'Operations & AI', icon: 'ri-radar-line' },
  { key: 'commercial', label: 'Commercial & Support', icon: 'ri-customer-service-2-line' },
];

function Skeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-background-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-background-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-40 bg-background-100 rounded-lg animate-pulse" />
        <div className="h-40 bg-background-100 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const d = useExecutiveDashboard();
  const [view, setView] = useState<DashboardView>('overview');

  const activity = (
    <ActivityPanel
      activity={d.recentActivity}
      activityAvailable={d.projectsAvailable}
      upcoming={d.upcoming}
      quickAccess={d.quickAccess}
    />
  );

  return (
    <div className="space-y-5">
      <ExecutiveHeader health={d.health} metrics={d.headerMetrics} compact />

      <nav aria-label="Dashboard views" className="flex flex-wrap gap-2 border-b border-background-200/60 pb-3">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-current={view === item.key ? 'page' : undefined}
            onClick={() => setView(item.key)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === item.key
              ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30'
              : 'bg-background-100 text-foreground-400 hover:text-foreground-100 border border-background-200/60'}`}
          >
            <i className={`${item.icon} text-base`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      {!d.configured ? (
        <div className="flex flex-col items-center justify-center py-16 bg-background-100 border border-background-200/60 rounded-lg">
          <i className="ri-radar-line text-accent-400 text-2xl mb-4" aria-hidden="true" />
          <h2 className="text-base font-heading font-semibold text-foreground-100">Backend not connected</h2>
          <p className="text-sm text-foreground-500 mt-1 max-w-md text-center">
            Connect the backend to see live project, launch, deployment, AI and support information.
          </p>
        </div>
      ) : d.loading ? (
        <Skeleton />
      ) : (
        <>
          {view === 'overview' && (
            <>
              <NeedsAttentionPanel items={d.needsAttention} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <LiveOperationsPanel summary={d.liveSummary} items={d.liveOps} available={d.projectsAvailable} />
                <DeploymentsPanel data={d.deployments} />
              </div>
              {activity}
            </>
          )}
          {view === 'delivery' && (
            <>
              <NeedsAttentionPanel items={d.needsAttention} />
              <PortfolioSummaryPanel summary={d.portfolioSummary} pipeline={d.launchPipeline} available={d.projectsAvailable} />
              <BuildUatPanel build={d.build} uat={d.uat} />
            </>
          )}
          {view === 'operations' && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <LiveOperationsPanel summary={d.liveSummary} items={d.liveOps} available={d.projectsAvailable} />
                <DeploymentsPanel data={d.deployments} />
              </div>
              <AiRuntimePanel ai={d.ai} runtime={d.runtime} />
            </>
          )}
          {view === 'commercial' && (
            <>
              <CommercialSupportPanel commercial={d.commercial} support={d.support} />
              {activity}
            </>
          )}
        </>
      )}
    </div>
  );
}
