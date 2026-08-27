import { useState } from 'react';
import type { KpiMetric, SiteAiStatusRow, AgentActivity, ApprovalRequest, SystemHealthRow, OrchestratorStatus, SiteRegistryRecord, AiApproval } from '@/pages/ai-operations/types';
import {
  demoKpiMetrics,
  demoAgentActivities,
  demoSystemHealth,
  demoOrchestrator,
} from '@/mocks/ai-operations';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoApprovals as demoApprovalRecords } from '@/mocks/ai-operations-approvals';
import KpiCards from '@/pages/ai-operations/components/KpiCards';
import MasterOrchestrator from '@/pages/ai-operations/components/MasterOrchestrator';
import GroupSiteStatus from '@/pages/ai-operations/components/GroupSiteStatus';
import LiveActivity from '@/pages/ai-operations/components/LiveActivity';
import PendingApprovals from '@/pages/ai-operations/components/PendingApprovals';
import PlatformHealth from '@/pages/ai-operations/components/PlatformHealth';
import QuickActions from '@/pages/ai-operations/components/QuickActions';

// Demo/placeholder data — see src/mocks/ai-operations.ts. Not connected to live systems.
const kpiMetrics: KpiMetric[] = demoKpiMetrics;
// Derived from the shared Group Site Registry (single source of truth).
const siteStatuses: SiteAiStatusRow[] = (demoSites as SiteRegistryRecord[]).map((s) => ({
  id: s.id,
  name: s.name,
  status: s.operationalStatus,
  activeAgents: s.activeAgentCount,
  currentJobs: s.currentJobs,
  failedJobs: s.failedJobs,
  alerts: s.openAlerts,
  lastActivity: s.lastAgentActivity,
}));
const activities: AgentActivity[] = demoAgentActivities;
// Derived from the central approval registry (single source of truth) — the
// "View Review" action now links through to the matching approval detail page.
const approvals: ApprovalRequest[] = (demoApprovalRecords as AiApproval[])
  .filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status))
  .map((a) => ({
    id: a.id,
    site: a.siteName,
    agent: a.agentName,
    action: a.requestedAction,
    risk: a.severity,
    dateTime: a.requestedAt,
  }));
const healthRows: SystemHealthRow[] = demoSystemHealth;
const orchestrator: OrchestratorStatus = demoOrchestrator;

export default function AiOperationsPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    // Local/mock refresh — no live data is fetched yet.
    setTimeout(() => {
      setLastUpdated(new Date());
      setRefreshing(false);
    }, 700);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">AI Operations</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              Demo data
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central control, monitoring and governance for the AI agents operating across the Digital Footprint group.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-foreground-200 whitespace-nowrap">Group AI Status:</span>
            <span className="text-emerald-400 font-medium whitespace-nowrap">Operational</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            title="Refresh overview"
          >
            <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}></i>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Last updated */}
      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
      </p>

      {/* Master orchestrator (prominent, near top) */}
      <MasterOrchestrator orchestrator={orchestrator} />

      {/* KPI cards */}
      <KpiCards metrics={kpiMetrics} />

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

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}