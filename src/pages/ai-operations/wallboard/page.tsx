// ============================================================================
// DFP COMMAND — OPERATIONS WALL (full-screen, read-only office display).
//
// Replaces the previous rotation-based wallboard with a single integrated
// command-centre interface. All existing data hooks / refresh logic are
// PRESERVED — the coordinated group-registry refresh, per-source isolation,
// resilience (network loss/recovery), and the live clock remain intact.
//
// READ-ONLY: no navigation, controls, editing, or management actions.
// ============================================================================

import { useEffect, useCallback, useLayoutEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import { loadWallboardRegistries } from './registrySnapshot';
import { GroupLiveDataProvider, refreshGroupLiveData, getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { refreshHistory } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import WallboardErrorBoundary from '@/pages/ai-operations/wallboard/components/WallboardErrorBoundary';
import OperationsWallHeader from '@/pages/ai-operations/wallboard/components/operations/OperationsWallHeader';
import CoreSystemsRail from '@/pages/ai-operations/wallboard/components/operations/CoreSystemsRail';
import GroupOperationsCenter from '@/pages/ai-operations/wallboard/components/operations/GroupOperationsCenter';
import AutonomousOperationsRail from '@/pages/ai-operations/wallboard/components/operations/AutonomousOperationsRail';
import ComputeCore from '@/pages/ai-operations/wallboard/components/operations/ComputeCore';
import LiveEventsStrip from '@/pages/ai-operations/wallboard/components/operations/LiveEventsStrip';
import { useWallboardResilience } from '@/pages/ai-operations/wallboard/useWallboardResilience';
import { useWallData } from '@/pages/ai-operations/wallboard/useWallData';
import { clearBusinessData, refreshBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { refreshInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import { refreshPowerData } from '@/pages/ai-operations/wallboard/powerStore';
import { refreshSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { clearBackupData, refreshBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import { refreshSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import { refreshWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import { refreshDeploymentData } from '@/pages/ai-operations/wallboard/deploymentStore';
import { refreshPortfolioData } from '@/pages/ai-operations/wallboard/portfolioStore';
import { refreshSupportData } from '@/pages/ai-operations/wallboard/supportStore';
import { refreshLaunchReadinessData } from '@/pages/ai-operations/wallboard/launchReadinessStore';
import { refreshGithubData } from '@/pages/ai-operations/wallboard/githubStore';
import { refreshDatabaseData } from '@/pages/ai-operations/wallboard/databaseStore';
import { refreshN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { refreshAiInfraData } from '@/pages/ai-operations/wallboard/aiInfraStore';
import { refreshOperationsHealthData } from '@/pages/ai-operations/wallboard/operationsHealthStore';
import { refreshKnowledgeData } from '@/pages/ai-operations/wallboard/knowledgeStore';
import { refreshCommunicationsData } from '@/pages/ai-operations/wallboard/communicationsStore';
import { refreshOllamaCatalogue } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { refreshManagerReportData } from '@/pages/ai-operations/wallboard/managerReportStore';
import { refreshWidgetConfigData } from '@/pages/ai-operations/wallboard/widgetConfigStore';
import { refreshRuntimeResilience } from '@/pages/ai-operations/wallboard/runtimeResilienceStore';
import './operationsWall.css';

/** Auto-refresh cadence (seconds) for the operational-data snapshot. */
const REFRESH_INTERVAL_SECONDS = 30;

export default function WallboardPage() {
  const { user, role, mfaStatus } = useAuth();
  const canReadRegistries = mfaStatus === 'satisfied' && (role === 'owner' || role === 'admin');

  return (
    <GroupLiveDataProvider>
      <WallboardErrorBoundary>
        <WallboardSession
          key={`${user?.id ?? ''}:${role ?? ''}:${mfaStatus ?? ''}`}
          canReadRegistries={canReadRegistries}
        />
      </WallboardErrorBoundary>
    </GroupLiveDataProvider>
  );
}

function WallboardSession({ canReadRegistries }: { canReadRegistries: boolean }) {
  const [session, setSession] = useState<AbortSignal | null>(null);

  // Mount the new wall only after the previous session's layout cleanup ran.
  useLayoutEffect(() => {
    const controller = new AbortController();
    setSession(controller.signal);
    return () => {
      controller.abort();
      clearBusinessData();
      clearBackupData();
    };
  }, []);

  return session && !session.aborted
    ? <OperationsWall canReadRegistries={canReadRegistries} session={session} />
    : null;
}

function OperationsWall({ canReadRegistries, session }: {
  canReadRegistries: boolean;
  session: AbortSignal;
}) {
  // Subscribe to every data source the wall reads so it re-renders on refresh.
  useWallData();

  // Single guarded refresh cycle — an individual store failing is isolated and
  // never marks the whole wall as offline. Returns true only when the core
  // group registries loaded.
  const performRefresh = useCallback(async (): Promise<boolean> => {
    await refreshGroupLiveData();
    if (session.aborted) return false;

    void refreshHistory();
    const registries = canReadRegistries ? loadWallboardRegistries() : Promise.resolve(null);
    void refreshBusinessData(registries, session);
    void refreshInfrastructureData();
    void refreshPowerData();
    void refreshSecurityData();
    void refreshBackupData(registries, session);
    void refreshSiteMonitorData();
    void refreshWorkloadData();
    void refreshDeploymentData();
    void refreshPortfolioData();
    void refreshSupportData();
    void refreshLaunchReadinessData();
    void refreshGithubData();
    void refreshDatabaseData();
    void refreshN8nData();
    void refreshAiInfraData();
    void refreshOperationsHealthData();
    void refreshKnowledgeData();
    void refreshCommunicationsData();
    void refreshOllamaCatalogue();
    void refreshManagerReportData();
    void refreshWidgetConfigData();
    void refreshRuntimeResilience();
    return getGroupLiveData().mode !== 'unavailable';
  }, [canReadRegistries, session]);

  // Resilience — connectivity, last-success tracking, and wake/reconnect refresh.
  const { refresh } = useWallboardResilience(performRefresh);

  // Load all wallboard data once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh — one coordinated live-registry refresh (no per-widget polling).
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL_SECONDS * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="ow-root ow-grid h-screen w-screen overflow-hidden flex flex-col select-none">
      <OperationsWallHeader />

      <main className="ow-wall-main">
        <CoreSystemsRail />

        <div className="ow-wall-centre">
          <GroupOperationsCenter />
          <ComputeCore />
        </div>

        <AutonomousOperationsRail />
      </main>

      <LiveEventsStrip />
    </div>
  );
}
