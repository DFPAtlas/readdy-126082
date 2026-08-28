import { useEffect, useState } from 'react';
import { useGroupLiveData, refreshGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getPlatformHealthRows } from '@/pages/ai-operations/live/liveDataSelectors';
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
import RuntimeHealthSummary from '@/pages/ai-operations/runtime-health/components/RuntimeHealthSummary';
import RuntimeSafetyPanel from '@/pages/ai-operations/runtime-controls/components/RuntimeSafetyPanel';
import LocalRuntime from '@/pages/ai-operations/live/components/LocalRuntime';
import { refreshHistory } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';

export default function LiveOperationsPage() {
  const data = useGroupLiveData();
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load persisted runtime health once on mount.
  useEffect(() => {
    void refreshHistory();
  }, []);

  // Coordinated auto-refresh — refreshes the consolidated live registry data
  // (not randomised demo values). Cleaned up on unmount.
  useEffect(() => {
    if (!autoRefresh || paused) return;
    const id = setInterval(() => {
      void refreshGroupLiveData();
    }, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, paused]);

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
          <span className="text-sm text-foreground-400">Loading live operations data…</span>
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
        lastRefreshed={data.lastRefreshed}
      />

      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        Last refreshed {data.lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
        {autoRefresh > 0 && !paused ? ` · auto-refresh every ${autoRefresh}s` : ''}
        {paused ? ' · view paused' : ''}
      </p>

      <LiveStatusBar paused={paused} />

      <RuntimeHealthSummary />

      <RuntimeSafetyPanel />

      <LocalRuntime />

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