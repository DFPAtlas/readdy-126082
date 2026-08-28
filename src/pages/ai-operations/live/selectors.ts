// ============================================================================
// AI Operations — Live Operations selectors.
//
// Re-exports the consolidated group live-data selectors (see liveDataSelectors).
// Kept as a stable import path so existing Live Operations / Wallboard
// components continue to resolve without per-component changes.
// ============================================================================

export {
  getStatusBarMetrics,
  getSiteHealth,
  getAgentsWorkingNow,
  getActiveRuns,
  getQueueMetrics,
  getQueueItems,
  getAgentWorkload,
  getSiteWorkload,
  getMissionControl,
  getMultiAgentWorkflows,
  getFailuresBlockers,
  getPlatformHealthRows,
  getProviderHealth,
  getOrchestratorStatus,
  getActivityEvents,
  getOperationsAlerts,
  getApprovalWatch,
} from '@/pages/ai-operations/live/liveDataSelectors';

export type {
  AgentsWorkingItem,
  ActiveRunItem,
  ApprovalWatchItem,
} from '@/pages/ai-operations/live/liveDataSelectors';