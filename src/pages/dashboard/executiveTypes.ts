// ============================================================================
// DFP COMMAND 15B — EXECUTIVE DASHBOARD — TYPES + DISPLAY CONSTANTS
// ============================================================================
// Read-only executive roll-up over the existing project portfolio aggregation
// (15A), AI Operations group live store, runtime bridge telemetry, support and
// activity records. Nothing here persists data or invents a new source of truth
// — every value is derived at read time. Unavailable → Unknown, never zero.
import type {
  PortfolioSummary,
  LaunchPipeline,
  LiveSummary,
  CommercialSummary,
} from '@/pages/projects/portfolioTypes';

export type { PortfolioSummary, LaunchPipeline, LiveSummary, CommercialSummary };

// ─── Portfolio health (display-only executive roll-up) ─────────────────────

export type PortfolioHealthState = 'HEALTHY' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN';

export const PORTFOLIO_HEALTH_LABELS: Record<PortfolioHealthState, string> = {
  HEALTHY: 'Healthy',
  ATTENTION: 'Attention',
  CRITICAL: 'Critical',
  UNKNOWN: 'Unknown',
};

export const PORTFOLIO_HEALTH_STYLES: Record<PortfolioHealthState, string> = {
  HEALTHY: 'bg-emerald-500/15 text-emerald-400',
  ATTENTION: 'bg-amber-500/15 text-amber-400',
  CRITICAL: 'bg-red-500/15 text-red-400',
  UNKNOWN: 'bg-foreground-500/15 text-foreground-400',
};

// ─── Needs Attention (§3) ──────────────────────────────────────────────────

export interface NeedsAttentionItem {
  key: string;
  rank: number;
  projectName: string;
  /** Null for group-wide (AI / runtime) issues. */
  projectSlug: string | null;
  issue: string;
  source: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  ageLabel: string;
  deepLink: { label: string; to: string } | null;
}

// ─── Live Operations (§6) ──────────────────────────────────────────────────

export interface LiveOpsItem {
  projectName: string;
  projectSlug: string;
  health: string;
  healthState: string;
  productionState: string;
  activeIncident: string;
  supportLoad: string;
  currentRelease: string;
  lastCheck: string;
}

// ─── Deployments (§7) ──────────────────────────────────────────────────────

export interface DeploymentRow {
  id: string;
  projectName: string;
  projectSlug: string;
  sha: string;
  status: string;
  statusKey: string;
  environment: string;
  startedAt: string | null;
  operator: string | null;
}

export interface DeploymentsExec {
  available: boolean;
  active: number;
  verifying: number;
  failed: number;
  rollbackRequired: number;
  recentlyCompleted: number;
  rows: DeploymentRow[];
}

// ─── AI Operations (§8) ────────────────────────────────────────────────────

export interface AiExecSummary {
  available: boolean;
  sites: number;
  agents: number;
  activeRuns: number;
  pendingApprovals: number;
  criticalAlerts: number;
  runtimeOnline: number;
  runtimeOfflineStale: number;
  /** Estimated/migrated baseline — labelled honestly, never "live cost". */
  costThisMonth: number | null;
}

// ─── Runtime nodes (§9) ────────────────────────────────────────────────────

export type RuntimeNodeState = 'online' | 'stale' | 'offline' | 'not_registered';

export const RUNTIME_NODE_LABELS: Record<RuntimeNodeState, string> = {
  online: 'Online',
  stale: 'Stale',
  offline: 'Offline',
  not_registered: 'Not Registered',
};

export const RUNTIME_NODE_STYLES: Record<RuntimeNodeState, string> = {
  online: 'bg-emerald-500/10 text-emerald-400',
  stale: 'bg-amber-500/10 text-amber-400',
  offline: 'bg-red-500/10 text-red-400',
  not_registered: 'bg-foreground-500/10 text-foreground-500',
};

export interface RuntimeNodeStatus {
  key: string;
  name: string;
  state: RuntimeNodeState;
  lastHeartbeat: string | null;
  n8n: string | null;
  ollama: string | null;
}

export interface RuntimeExec {
  available: boolean;
  nodes: RuntimeNodeStatus[];
}

// ─── Commercial (§10) ──────────────────────────────────────────────────────

export interface CommercialExec extends CommercialSummary {
  available: boolean;
  upcomingRequiredCosts: number;
}

// ─── Support / incidents (§11) ─────────────────────────────────────────────

export interface SupportExec {
  available: boolean;
  ticketsAvailable: boolean;
  incidentsAvailable: boolean;
  openTickets: number;
  criticalTickets: number;
  highPriority: number;
  activeIncidents: number;
  criticalIncidents: number;
  oldestCritical: { subject: string; ageLabel: string; id: string } | null;
  recentlyResolved: { title: string; resolvedAt: string }[];
}

// ─── Build health (§12) ────────────────────────────────────────────────────

export interface BuildExec {
  available: boolean;
  activeRuns: number;
  blockedProjects: number;
  requiredItemsRemaining: number;
  nearLaunchReadiness: number;
  noChecklist: number;
}

// ─── UAT summary (§13) ─────────────────────────────────────────────────────

export interface UatExec {
  available: boolean;
  inUat: number;
  testsRunning: number;
  awaitingApproval: number;
  approved: number;
  rejected: number;
  criticalDefects: number;
  readyForLaunch: number;
}

// ─── Recent activity (§14) ─────────────────────────────────────────────────

export interface RecentActivityItem {
  key: string;
  timeLabel: string;
  projectName: string;
  projectSlug: string | null;
  source: string;
  event: string;
  severity: 'Critical' | 'Warning' | 'Info';
  deepLink: { label: string; to: string } | null;
}

// ─── Upcoming milestones (§15) ─────────────────────────────────────────────

export type MilestoneType = 'launch' | 'maintenance' | 'payment' | 'uat' | 'approval';

export interface UpcomingMilestone {
  key: string;
  type: MilestoneType;
  date: string | null;
  label: string;
  projectName: string;
  projectSlug: string | null;
  deepLink: { label: string; to: string } | null;
}

// ─── Quick access (§16) ────────────────────────────────────────────────────

export interface QuickAccessItem {
  projectName: string;
  projectSlug: string;
  lifecycle: string;
  priority: string;
  health: string;
  launchState: string;
  lastActivity: string;
}

// ─── Executive header metrics (§2) ─────────────────────────────────────────

export interface ExecHeaderMetric {
  key: string;
  label: string;
  value: string;
  icon: string;
  accent: string;
}