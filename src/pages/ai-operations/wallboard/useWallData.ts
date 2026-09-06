// ============================================================================
// DFP COMMAND — Operations Wall data subscription.
//
// A single hook that subscribes to every store the Operations Wall reads, so
// the whole wall re-renders whenever any source refreshes. Each store's own
// `useXxxData()` hook (useSyncExternalStore) is the subscription; calling them
// here keeps the wall in sync without per-component wiring or polling.
//
// The clock is deliberately NOT part of this hook — it lives in the header and
// updates once per second, isolated from the operational-data refresh (which
// happens on a slower cadence).
// ============================================================================

import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { useDatabaseData } from '@/pages/ai-operations/wallboard/databaseStore';
import { useOperationsHealthData } from '@/pages/ai-operations/wallboard/operationsHealthStore';
import { useSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { useOllamaCatalogue } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { useSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import { useManagerReportData } from '@/pages/ai-operations/wallboard/managerReportStore';
import { useWidgetConfigData } from '@/pages/ai-operations/wallboard/widgetConfigStore';

/**
 * Subscribe to every source the wall depends on. Returns nothing — the
 * subscriptions themselves trigger re-renders when a snapshot changes.
 * 
 * useSiteMonitorData is included so that GroupOperationsCenter/SiteModule
 * re-render automatically whenever refreshSiteMonitorData() resolves a new
 * snapshot — e.g. when GarageFlow (or any other site) changes state.
 */
export function useWallData(): void {
  useGroupLiveData();
  useRuntimeHealth();
  useInfrastructureData();
  useN8nData();
  useDatabaseData();
  useOperationsHealthData();
  useSecurityData();
  useOllamaCatalogue();
  useSiteMonitorData();
  useManagerReportData();
  useWidgetConfigData();
}