// ============================================================================
// DFP COMMAND 10 — PROJECT MONITORING / OPERATIONAL HEALTH TYPES
// ============================================================================
// Read-time aggregation over the existing System Status monitoring tables
// (already project-scoped by internal_projects.id). Nothing here persists a new
// canonical status — every value is derived honestly from stored telemetry.
import type {
  MonitoredWebsite,
  SupabaseMonitor,
  EdgeFunctionMonitor,
  AgentMonitor,
  WebhookMonitor,
  MonitoringIncident,
  MonitoringAlert,
} from '@/pages/system-status/types';

export type {
  MonitoredWebsite,
  SupabaseMonitor,
  EdgeFunctionMonitor,
  AgentMonitor,
  WebhookMonitor,
  MonitoringIncident,
  MonitoringAlert,
};

// ─── Overall project health (display only — never persisted) ───────────────

export type ProjectHealth =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'OFFLINE'
  | 'UNKNOWN'
  | 'NOT CONFIGURED';

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  HEALTHY: 'Healthy',
  DEGRADED: 'Degraded',
  CRITICAL: 'Critical',
  OFFLINE: 'Offline',
  UNKNOWN: 'Unknown',
  'NOT CONFIGURED': 'Not Configured',
};

export const PROJECT_HEALTH_STYLES: Record<ProjectHealth, string> = {
  HEALTHY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DEGRADED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
  OFFLINE: 'bg-red-500/10 text-red-400 border-red-500/20',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400 border-foreground-500/20',
  'NOT CONFIGURED': 'bg-foreground-500/10 text-foreground-500 border-foreground-500/20',
};

// ─── Component state (per monitored component) ─────────────────────────────

export type ComponentState =
  | 'UP'
  | 'DEGRADED'
  | 'DOWN'
  | 'STALE'
  | 'UNKNOWN'
  | 'NOT MONITORED';

export const COMPONENT_STATE_STYLES: Record<ComponentState, string> = {
  UP: 'bg-emerald-500/10 text-emerald-400',
  DEGRADED: 'bg-amber-500/10 text-amber-400',
  DOWN: 'bg-red-500/10 text-red-400',
  STALE: 'bg-orange-500/10 text-orange-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-400',
  'NOT MONITORED': 'bg-foreground-500/10 text-foreground-500',
};

// ─── Normalized severity (display only — source severity preserved) ────────

export type NormalizedSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | 'UNKNOWN';

export const SEVERITY_STYLES: Record<NormalizedSeverity, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400',
  HIGH: 'bg-orange-500/10 text-orange-400',
  MEDIUM: 'bg-amber-500/10 text-amber-400',
  LOW: 'bg-sky-500/10 text-sky-400',
  INFO: 'bg-foreground-500/10 text-foreground-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

// ─── Monitoring source labels (provenance) ─────────────────────────────────

export type MonitorSource =
  | 'DFP Command'
  | 'LibreNMS'
  | 'Runtime Bridge'
  | 'AI Operations'
  | 'Supabase Heartbeat'
  | 'External Uptime Monitor'
  | 'Manual'
  | 'Unknown';