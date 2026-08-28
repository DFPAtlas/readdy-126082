import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroupLiveData, refreshGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import {
  getOverviewKpis,
  getOverviewSiteStatus,
  getOverviewActivity,
  getOverviewApprovals,
  getPlatformHealthRows,
  getOverviewOrchestrator,
  getReadinessSummary,
} from '@/pages/ai-operations/live/liveDataSelectors';
import KpiCards from '@/pages/ai-operations/components/KpiCards';
import MasterOrchestrator from '@/pages/ai-operations/components/MasterOrchestrator';
import GroupSiteStatus from '@/pages/ai-operations/components/GroupSiteStatus';
import LiveActivity from '@/pages/ai-operations/components/LiveActivity';
import PendingApprovals from '@/pages/ai-operations/components/PendingApprovals';
import PlatformHealth from '@/pages/ai-operations/components/PlatformHealth';
import QuickActions from '@/pages/ai-operations/components/QuickActions';

export default function AiOperationsPage() {
  const data = useGroupLiveData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshGroupLiveData();
    setRefreshing(false);
  };

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Loading AI Operations live data…</span>
        </div>
      </div>
    );
  }

  if (data.mode === 'unavailable' && data.error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-alert-line text-red-400 text-2xl w-6 h-6 flex items-center justify-center"></i>
          </div>
          <h1 className="font-heading text-lg font-bold text-foreground-50 mb-2">Live data unavailable</h1>
          <p className="text-sm text-foreground-500 mb-6">{data.error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const kpis = getOverviewKpis();
  const siteStatuses = getOverviewSiteStatus();
  const activities = getOverviewActivity();
  const approvals = getOverviewApprovals();
  const healthRows = getPlatformHealthRows();
  const orchestrator = getOverviewOrchestrator();
  const readiness = getReadinessSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">AI Operations</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              Partial Live
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central control, monitoring and governance for the AI agents operating across the Digital Footprint group.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-foreground-200 whitespace-nowrap">Source:</span>
            <span className="text-amber-400 font-medium whitespace-nowrap">Partial Live</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            title="Refresh live data"
          >
            <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}></i>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Last updated */}
      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        Last updated {data.lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
      </p>

      {/* Master orchestrator (prominent, near top) */}
      <MasterOrchestrator orchestrator={orchestrator} />

      {/* KPI cards */}
      <KpiCards metrics={kpis} />

      {/* Group site status + live activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <GroupSiteStatus sites={siteStatuses} />
        </div>
        <LiveActivity activities={activities} />
      </div>

      {/* Pending approvals + platform health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PendingApprovals approvals={approvals} />
        <PlatformHealth rows={healthRows} />
      </div>

      {/* Production readiness (compact) */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Production Readiness</h3>
          <Link
            to="/ai-operations/readiness"
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
            Full readiness
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Production Enabled</p>
            <p className="text-lg font-heading font-bold text-foreground-100 mt-1">{readiness.productionEnabled}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Overall</p>
            <p className="text-lg font-heading font-bold text-red-400 mt-1">{readiness.overall}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Persisted Modules</p>
            <p className="text-lg font-heading font-bold text-foreground-100 mt-1">{readiness.modulesPersisted}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Runtime</p>
            <p className="text-lg font-heading font-bold text-foreground-500 mt-1">Not Started</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Agent Execution</p>
            <p className="text-lg font-heading font-bold text-red-400 mt-1">{readiness.agentExecution}</p>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}