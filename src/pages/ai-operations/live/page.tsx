import { useEffect, useState } from 'react';
import { getPlatformHealthRows } from '@/pages/ai-operations/live/selectors';
import PlatformHealth from '@/pages/ai-operations/components/PlatformHealth';
import LiveHeader from '@/pages/ai-operations/live/components/LiveHeader';
import LiveStatusBar from '@/pages/ai-operations/live/components/LiveStatusBar';
import OrchestratorStatus from '@/pages/ai-operations/live/components/OrchestratorStatus';
import GroupSiteHealth from '@/pages/ai-operations/live/components/GroupSiteHealth';
import MissionControl from '@/pages/ai-operations/live/components/MissionControl';
import AgentsWorkingNow from '@/pages/ai-operations/live/components/AgentsWorkingNow';
import ActiveRuns from '@/pages/ai-operations/live/components/ActiveRuns';
import MultiAgentWorkflows from '@/pages/ai-operations/live/components/MultiAgentWorkflows';
import ApprovalWatch from '@/pages/ai-operations/live/components/ApprovalWatch';
import FailuresBlockers from '@/pages/ai-operations/live/components/FailuresBlockers';
import QueueMonitor from '@/pages/ai-operations/live/components/QueueMonitor';
import AgentWorkload from '@/pages/ai-operations/live/components/AgentWorkload';
import SiteWorkload from '@/pages/ai-operations/live/components/SiteWorkload';
import ModelProviderStatus from '@/pages/ai-operations/live/components/ModelProviderStatus';
import GroupActivityFeed from '@/pages/ai-operations/live/components/GroupActivityFeed';
import OperationsTimeline from '@/pages/ai-operations/live/components/OperationsTimeline';

export default function LiveOperationsPage() {
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());

  // Demo auto-refresh — only recomputes local demo state (no production polling).
  useEffect(() => {
    if (!autoRefresh || paused) return;
    const id = setInterval(() => {
      setLastRefreshed(new Date());
    }, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, paused]);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      setLastRefreshed(new Date());
      setRefreshing(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <LiveHeader
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        paused={paused}
        onPauseToggle={() => setPaused((p) => !p)}
        focusMode={focusMode}
        onFocusToggle={() => setFocusMode((f) => !f)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        lastRefreshed={lastRefreshed}
      />

      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        Last refreshed {lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
        {autoRefresh > 0 && !paused ? ` · auto-refresh every ${autoRefresh}s` : ''}
        {paused ? ' · view paused' : ''}
      </p>

      <LiveStatusBar paused={paused} />

      <OrchestratorStatus />

      <GroupSiteHealth />

      <MissionControl />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AgentsWorkingNow />
        <ActiveRuns />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <MultiAgentWorkflows />
        <ApprovalWatch />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <FailuresBlockers />
        <QueueMonitor />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AgentWorkload />
        <SiteWorkload />
      </div>

      {!focusMode && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <PlatformHealth rows={getPlatformHealthRows()} />
          <ModelProviderStatus />
        </div>
      )}

      <GroupActivityFeed focusMode={focusMode} paused={paused} />

      {!focusMode && <OperationsTimeline />}
    </div>
  );
}