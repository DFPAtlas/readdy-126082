// ============================================================================
// AI Operations — Wallboard selectors.
//
// Derived exclusively from the consolidated group live-data selectors (shared
// with Live Operations / Overview). No separate wallboard data model exists —
// these are read-only reformattings of the same live snapshot for a large,
// distance-viewed display.
//
// "Users Online" is derived from the platform's built-in analytics
// (`public_analytics_events`) via `wallboard_online_presence()`, aggregated by
// distinct anonymous session within the last 5 minutes and mapped to the site
// registry by stable domain. Sites without presence data surface as
// `not_connected` rather than invented figures.
// ============================================================================

import type {
  SiteHealthCard,
  OperationsAlert,
  LiveActivityEvent,
  SystemHealthRow,
  BudgetStatus,
} from '@/pages/ai-operations/types';
import {
  getStatusBarMetrics,
  getSiteHealth,
  getAgentsWorkingNow,
  getMissionControl,
  getApprovalWatch,
  getPlatformHealthRows,
  getActivityEvents,
  getOperationsAlerts,
  type AgentsWorkingItem,
  type ApprovalWatchItem,
} from '@/pages/ai-operations/live/liveDataSelectors';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getInfrastructureIncidents } from '@/pages/ai-operations/wallboard/infrastructureSelectors';
import { getPowerIncidents } from '@/pages/ai-operations/wallboard/powerSelectors';
import { getSecurityIncidents } from '@/pages/ai-operations/wallboard/securitySelectors';
import { getBackupIncidents } from '@/pages/ai-operations/wallboard/backupSelectors';
import { getSitesIncidents } from '@/pages/ai-operations/wallboard/siteSelectors';
import { getAiCapacityIncidents } from '@/pages/ai-operations/wallboard/aiCapacitySelectors';
import { getDatabaseIncidents } from '@/pages/ai-operations/wallboard/databaseSelectors';
import { getN8nIncidents } from '@/pages/ai-operations/wallboard/n8nSelectors';
import { getAiInfrastructureIncidents } from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import { getMasterAgentIncidents } from '@/pages/ai-operations/wallboard/masterAgentsSelectors';
import { getOrchestrationIncidents } from '@/pages/ai-operations/wallboard/orchestrationSelectors';
import { getKnowledgeIncidents } from '@/pages/ai-operations/wallboard/knowledgeSelectors';
import { getCommunicationIncidents } from '@/pages/ai-operations/wallboard/communicationsSelectors';
import { getScheduleIncidents } from '@/pages/ai-operations/wallboard/scheduleSelectors';

// --- Wallboard data status --------------------------------------------------------

export type WallboardSectionStatus = 'live' | 'demo' | 'unavailable' | 'error';

export interface WallboardStatus {
  sites: WallboardSectionStatus;
  agents: WallboardSectionStatus;
  operations: WallboardSectionStatus;
  approvals: WallboardSectionStatus;
  alerts: WallboardSectionStatus;
  activity: WallboardSectionStatus;
  systemHealth: WallboardSectionStatus;
  costs: WallboardSectionStatus;
  usersOnline: WallboardSectionStatus;
}

// One clean data contract: which wallboard sections are backed by a live source
// versus unavailable. During the initial load we do not yet know whether a
// source failed, so every section reports `live` (rendering its empty state) to
// avoid a misleading "Unavailable" flash before the first snapshot resolves.
export function getWallboardStatus(): WallboardStatus {
  const data = getGroupLiveData();
  const a = data.availability;
  const ok = (flag: boolean): WallboardSectionStatus => {
    if (data.loading) return 'live';
    return flag ? 'live' : 'unavailable';
  };
  return {
    sites: ok(a.sites),
    agents: ok(a.agents),
    operations: ok(a.runs),
    approvals: ok(a.approvals),
    alerts: ok(a.alerts),
    activity: ok(a.audit),
    systemHealth: ok(a.sites && a.agents && a.runs && a.tools && a.models),
    costs: ok(a.usageCosts),
    usersOnline: ok(a.usersOnline),
  };
}

// --- Primary KPI strip ----------------------------------------------------------

export interface WallboardKpis {
  sitesHealthy: string;
  agentsOnline: number;
  agentsWorking: number;
  activeRuns: number;
  queuedRuns: number;
  pendingApprovals: number;
  criticalAlerts: number;
  failedRuns: number;
  aiCostToday: string;
}

export function getWallboardKpis(): WallboardKpis {
  const m = getStatusBarMetrics();
  const data = getGroupLiveData();
  const agentsRegistered = data.agents.filter((a) => !['disabled', 'not_configured', 'paused'].includes(a.status ?? '')).length;
  return {
    sitesHealthy: `${m.sitesHealthy} / ${m.sitesTotal}`,
    agentsOnline: agentsRegistered,
    agentsWorking: m.agentsWorking,
    activeRuns: m.activeRuns,
    queuedRuns: m.queuedRuns,
    pendingApprovals: m.pendingApprovals,
    criticalAlerts: m.criticalAlerts,
    failedRuns: m.failedRuns,
    aiCostToday: m.aiCostToday,
  };
}

// --- Overall operating state ------------------------------------------------------

export type WallboardOverallState = 'normal' | 'degraded' | 'action_required' | 'critical' | 'unknown';

export interface WallboardOverallStatus {
  state: WallboardOverallState;
  label: string;
  detail: string;
}

/**
 * Derives a single "operating state" for the wall display from the live
 * snapshot. Priority: critical (incident mode) > unknown > action required >
 * degraded > normal. Pure read of existing data — no new status system.
 */
export function getWallboardOverallState(): WallboardOverallStatus {
  const data = getGroupLiveData();
  const m = getStatusBarMetrics();
  const inc = getWallboardIncidents();

  if (data.mode === 'unavailable') {
    return { state: 'critical', label: 'NO DATA', detail: 'Core registries failed to load' };
  }

  // Failure safety: unknown alert state must never be reported as healthy.
  if (inc.mode === 'unknown') {
    return { state: 'unknown', label: 'ALERT STATUS UNKNOWN', detail: 'Alert registry unavailable' };
  }

  if (inc.mode === 'incident') {
    const parts: string[] = [];
    if (inc.criticalCount > 0) parts.push(`${inc.criticalCount} critical incident${inc.criticalCount > 1 ? 's' : ''}`);
    if (inc.highCount > 0) parts.push(`${inc.highCount} high`);
    return { state: 'critical', label: 'INCIDENT MODE', detail: parts.join(' · ') };
  }

  if (inc.highCount > 0) {
    return { state: 'action_required', label: 'ACTION REQUIRED', detail: `${inc.highCount} high incident${inc.highCount > 1 ? 's' : ''}` };
  }

  if (m.pendingApprovals > 0) {
    return { state: 'action_required', label: 'ACTION REQUIRED', detail: `${m.pendingApprovals} approval${m.pendingApprovals > 1 ? 's' : ''} waiting` };
  }

  const sites = getSiteHealth();
  const degradedSites = sites.filter((s) => ['warning', 'unknown', 'maintenance'].includes(s.operationalStatus)).length;
  if (degradedSites > 0) {
    return { state: 'degraded', label: 'DEGRADED', detail: `${degradedSites} site${degradedSites > 1 ? 's' : ''} degraded` };
  }

  return { state: 'normal', label: 'ALL SYSTEMS NORMAL', detail: `${m.sitesHealthy}/${m.sitesTotal} sites healthy` };
}

// --- Incidents & Incident Mode -----------------------------------------------------

export type WallboardIncidentSeverity = 'info' | 'warning' | 'high' | 'critical';

export interface WallboardIncident {
  id: string;
  severity: WallboardIncidentSeverity;
  title: string;
  /** Affected site name, or 'Group-wide'. */
  affectedService: string;
  /** Source of the incident: Alert / Incident / Site / Run / Agent. */
  sourceLabel: string;
  firstDetected: string;
  lastUpdated: string;
  status: string;
  description: string;
  /** true = acknowledged, false = unacknowledged, null = not applicable. */
  acknowledged: boolean | null;
  referenceType: 'alert' | 'incident' | 'site' | 'run' | 'agent' | null;
  referenceId: string | null;
}

export interface WallboardIncidentState {
  mode: 'incident' | 'normal' | 'unknown';
  criticalCount: number;
  highCount: number;
  incidents: WallboardIncident[];
}

const SEVERITY_RANK: Record<WallboardIncidentSeverity, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  info: 3,
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

// Normalise the existing severity model onto the wallboard's four levels.
// Only HIGH / CRITICAL are surfaced as wallboard incidents (WARNING / INFO
// remain visible via the alerts list and the overall DEGRADED state).
function mapIncidentSeverity(s: string | null | undefined): WallboardIncidentSeverity {
  switch (s) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'warning':
      return 'warning';
    case 'low':
    case 'info':
    default:
      return 'info';
  }
}

function isActiveAlertRow(status: string | null | undefined): boolean {
  return !['resolved', 'closed', 'suppressed'].includes(status ?? '');
}

/**
 * Aggregates active HIGH/CRITICAL incidents from the existing live sources
 * (formal incidents, operational alerts, offline/critical sites, failed runs,
 * errored agents). Sorted critical → high → newest first. Resolved records are
 * never included. Pure read — no new incident platform.
 */
export function getWallboardIncidents(): WallboardIncidentState {
  const data = getGroupLiveData();

  if (data.mode === 'unavailable' || !data.availability.alerts) {
    return { mode: 'unknown', criticalCount: 0, highCount: 0, incidents: [] };
  }

  const incidents: WallboardIncident[] = [];

  for (const inc of data.incidents) {
    if (['resolved', 'closed'].includes(inc.status ?? '')) continue;
    const severity = mapIncidentSeverity(inc.severity);
    if (severity !== 'critical' && severity !== 'high') continue;
    incidents.push({
      id: `incident-${inc.incident_key}`,
      severity,
      title: inc.title,
      affectedService: inc.site_id ? (data.siteNameByUuid.get(inc.site_id) ?? 'Group-wide') : 'Group-wide',
      sourceLabel: 'Incident',
      firstDetected: fmtTime(inc.started_at),
      lastUpdated: fmtTime(inc.updated_at),
      status: inc.status ?? 'open',
      description: inc.summary ?? inc.impact_summary ?? '',
      acknowledged: inc.acknowledged_at != null,
      referenceType: 'incident',
      referenceId: inc.incident_key,
    });
  }

  for (const a of data.alerts) {
    if (!isActiveAlertRow(a.status)) continue;
    const severity = mapIncidentSeverity(a.severity);
    if (severity !== 'critical' && severity !== 'high') continue;
    incidents.push({
      id: `alert-${a.alert_key}`,
      severity,
      title: a.title,
      affectedService: a.site_id ? (data.siteNameByUuid.get(a.site_id) ?? 'Group-wide') : 'Group-wide',
      sourceLabel: 'Alert',
      firstDetected: fmtTime(a.first_seen_at ?? a.last_seen_at),
      lastUpdated: fmtTime(a.last_seen_at),
      status: a.status ?? 'new',
      description: a.summary ?? '',
      acknowledged: a.acknowledged_at != null,
      referenceType: 'alert',
      referenceId: a.alert_key,
    });
  }

  for (const s of getSiteHealth()) {
    if (s.operationalStatus !== 'offline' && s.operationalStatus !== 'critical') continue;
    incidents.push({
      id: `site-${s.id}`,
      severity: 'critical',
      title: s.operationalStatus === 'offline' ? `${s.name} is offline` : `${s.name} is critical`,
      affectedService: s.name,
      sourceLabel: 'Site',
      firstDetected: s.lastActivity,
      lastUpdated: s.lastActivity,
      status: s.operationalStatus,
      description: `Site operational status is ${s.operationalStatus}.`,
      acknowledged: null,
      referenceType: 'site',
      referenceId: s.id,
    });
  }

  for (const r of data.runs) {
    if (r.status !== 'failed' && r.status !== 'blocked') continue;
    incidents.push({
      id: `run-${r.run_key}`,
      severity: r.risk_level === 'critical' ? 'critical' : 'high',
      title: r.error_summary ?? r.result_summary ?? 'Run did not complete.',
      affectedService: r.site_id ? (data.siteNameByUuid.get(r.site_id) ?? 'Group-wide') : 'Group-wide',
      sourceLabel: 'Run',
      firstDetected: fmtTime(r.completed_at ?? r.updated_at),
      lastUpdated: fmtTime(r.updated_at),
      status: r.status,
      description: r.error_summary ?? r.result_summary ?? 'Run did not complete.',
      acknowledged: null,
      referenceType: 'run',
      referenceId: r.run_key,
    });
  }

  for (const ag of data.agents) {
    if (ag.status !== 'error') continue;
    incidents.push({
      id: `agent-${ag.agent_key}`,
      severity: ag.risk_level === 'critical' ? 'critical' : 'high',
      title: `${ag.name} is reporting an error state`,
      affectedService: ag.site_id ? (data.siteNameByUuid.get(ag.site_id) ?? 'Group-wide') : 'Group-wide',
      sourceLabel: 'Agent',
      firstDetected: fmtTime(ag.updated_at),
      lastUpdated: fmtTime(ag.updated_at),
      status: 'error',
      description: 'Agent registry status is error.',
      acknowledged: null,
      referenceType: 'agent',
      referenceId: ag.agent_key,
    });
  }

  // Infrastructure incidents (Wallboard 25) — authoritative host/service
  // states only: HAL offline (critical) and registered services offline/
  // degraded (high). Reuses dfp_service_health + the runtime bridge node.
  for (const inf of getInfrastructureIncidents()) {
    incidents.push({
      id: inf.id,
      severity: inf.severity,
      title: inf.title,
      affectedService: inf.affectedService,
      sourceLabel: inf.sourceLabel,
      firstDetected: fmtTime(inf.firstDetected),
      lastUpdated: fmtTime(inf.lastUpdated),
      status: inf.status,
      description: inf.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Power incidents (Wallboard 26) — authoritative UPS states only: mains lost
  // (on battery) / low battery (critical), overload / replace-battery /
  // communication-lost (high). Nothing is triggered without a live source.
  for (const pw of getPowerIncidents()) {
    incidents.push({
      id: pw.id,
      severity: pw.severity,
      title: pw.title,
      affectedService: pw.affectedService,
      sourceLabel: pw.sourceLabel,
      firstDetected: fmtTime(pw.firstDetected),
      lastUpdated: fmtTime(pw.lastUpdated),
      status: pw.status,
      description: pw.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Backup & recovery incidents (Wallboard 28) — authoritative failure states
  // only: critical database backup failure (critical), other backup failure /
  // verification failure / failed restore drill (high). The STALE signal is
  // already raised by the Infrastructure view (dfp_service_health "backups") and
  // is not duplicated here. Nothing is triggered without an explicit failure.
  for (const bk of getBackupIncidents()) {
    incidents.push({
      id: bk.id,
      severity: bk.severity,
      title: bk.title,
      affectedService: bk.affectedService,
      sourceLabel: bk.sourceLabel,
      firstDetected: fmtTime(bk.firstDetected),
      lastUpdated: fmtTime(bk.lastUpdated),
      status: bk.status,
      description: bk.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Security & connectivity incidents (Wallboard 27) — authoritative connection
  // states only: authentication/database offline (critical), any other
  // registered connection offline (high). not_configured / unknown / warning
  // connections never raise the alarm. Security ALERTS already feed Incident
  // Mode via data.alerts above, so they are not duplicated here.
  for (const sec of getSecurityIncidents()) {
    incidents.push({
      id: sec.id,
      severity: sec.severity,
      title: sec.title,
      affectedService: sec.affectedService,
      sourceLabel: sec.sourceLabel,
      firstDetected: fmtTime(sec.firstDetected),
      lastUpdated: fmtTime(sec.lastUpdated),
      status: sec.status,
      description: sec.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Sites & services incidents (Wallboard 29) — authoritative certificate-expired
  // readings only. Site outages (offline/critical) and service outages
  // (dfp_service_health) already feed Incident Mode via getSiteHealth() and
  // getInfrastructureIncidents() above, so they are NOT duplicated here. A stale
  // certificate reading never raises the alarm.
  for (const st of getSitesIncidents()) {
    incidents.push({
      id: st.id,
      severity: st.severity,
      title: st.title,
      affectedService: st.affectedService,
      sourceLabel: st.sourceLabel,
      firstDetected: fmtTime(st.firstDetected),
      lastUpdated: fmtTime(st.lastUpdated),
      status: st.status,
      description: st.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // AI capacity incidents (Wallboard 38) — authoritative capacity states only:
  // total AI capacity unavailable (critical) and an explicitly-unavailable
  // provider (high). Degraded / not_configured / unknown never raise the alarm.
  for (const ai of getAiCapacityIncidents()) {
    incidents.push({
      id: ai.id,
      severity: ai.severity,
      title: ai.title,
      affectedService: ai.affectedService,
      sourceLabel: ai.sourceLabel,
      firstDetected: fmtTime(ai.firstDetected),
      lastUpdated: fmtTime(ai.lastUpdated),
      status: ai.status,
      description: ai.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // AI infrastructure incidents (Wallboard 46) — authoritative local AI state
  // only: local Ollama model serving offline (high). HAL offline and n8n
  // unreachable are already CRITICAL via infrastructure/n8n incidents above,
  // so they are NOT duplicated here. Tron/Overwatch being absent is a gap, not
  // an incident.
  for (const ai of getAiInfrastructureIncidents()) {
    incidents.push({
      id: ai.id,
      severity: ai.severity,
      title: ai.title,
      affectedService: ai.affectedService,
      sourceLabel: ai.sourceLabel,
      firstDetected: fmtTime(ai.firstDetected),
      lastUpdated: fmtTime(ai.lastUpdated),
      status: ai.status,
      description: ai.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // n8n automation incidents (Wallboard 45) — authoritative instance state only:
  // production n8n instance configured but unreachable (critical). No repeated-
  // failure threshold is invented, so normal automation failures never raise.
  for (const n8n of getN8nIncidents()) {
    incidents.push({
      id: n8n.id,
      severity: n8n.severity,
      title: n8n.title,
      affectedService: n8n.affectedService,
      sourceLabel: n8n.sourceLabel,
      firstDetected: fmtTime(n8n.firstDetected),
      lastUpdated: fmtTime(n8n.lastUpdated),
      status: n8n.status,
      description: n8n.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Database & Supabase incidents (Wallboard 44) — authoritative monitor states
  // only: database unreachable (critical), authentication unavailable
  // (critical), storage / edge-functions / realtime failed (high). warning /
  // unknown / not_configured never raise the alarm. No thresholds are invented.
  for (const db of getDatabaseIncidents()) {
    incidents.push({
      id: db.id,
      severity: db.severity,
      title: db.title,
      affectedService: db.affectedService,
      sourceLabel: db.sourceLabel,
      firstDetected: fmtTime(db.firstDetected),
      lastUpdated: fmtTime(db.lastUpdated),
      status: db.status,
      description: db.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Master Agents incidents (Wallboard 47) — no new authoritative escalation
  // signal exists (agent errors already flow through the generic agent loop;
  // "no master agent" / "not connected workflow" are configuration gaps, not
  // runtime failures). Wired for future use — currently contributes nothing.
  for (const ma of getMasterAgentIncidents()) {
    incidents.push({
      id: ma.id,
      severity: ma.severity,
      title: ma.title,
      affectedService: ma.affectedService,
      sourceLabel: ma.sourceLabel,
      firstDetected: fmtTime(ma.firstDetected),
      lastUpdated: fmtTime(ma.lastUpdated),
      status: ma.status,
      description: ma.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Cross-site orchestration incidents (Wallboard 48) — no new authoritative
  // escalation signal exists yet (HAL offline / n8n unreachable / master-agent
  // error are already wired by infrastructure/n8n/generic-agent loops; "no
  // master agent" / "workflow missing" are configuration gaps, not runtime
  // failures). Wired for future use — currently contributes nothing.
  for (const oc of getOrchestrationIncidents()) {
    incidents.push({
      id: oc.id,
      severity: oc.severity,
      title: oc.title,
      affectedService: oc.affectedService,
      sourceLabel: oc.sourceLabel,
      firstDetected: fmtTime(oc.firstDetected),
      lastUpdated: fmtTime(oc.lastUpdated),
      status: oc.status,
      description: oc.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Knowledge & memory / vector / retrieval incidents (Wallboard 49) — no new
  // authoritative escalation signal exists (there is no central vector store /
  // retrieval runtime to be "unavailable"; stale/not-embedded are configuration
  // states, not runtime failures). Wired for future use — currently contributes
  // nothing.
  for (const km of getKnowledgeIncidents()) {
    incidents.push({
      id: km.id,
      severity: km.severity,
      title: km.title,
      affectedService: km.affectedService,
      sourceLabel: km.sourceLabel,
      firstDetected: fmtTime(km.firstDetected),
      lastUpdated: fmtTime(km.lastUpdated),
      status: km.status,
      description: km.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Communications / email / notification incidents (Wallboard 50) — no new
  // authoritative escalation signal exists (the email provider / delivery /
  // queue tables are empty, and empty is a "not yet populated" state, not a
  // runtime outage; DFP notification events are baseline migrated data, not
  // live failures). Wired for future use — currently contributes nothing.
  for (const cm of getCommunicationIncidents()) {
    incidents.push({
      id: cm.id,
      severity: cm.severity,
      title: cm.title,
      affectedService: cm.affectedService,
      sourceLabel: cm.sourceLabel,
      firstDetected: fmtTime(cm.firstDetected),
      lastUpdated: fmtTime(cm.lastUpdated),
      status: cm.status,
      description: cm.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  // Scheduled operations / cron / job incidents (Wallboard 51) — no new
  // authoritative escalation signal exists (there is no scheduler runtime to
  // be "unavailable", no execution telemetry to confirm a repeated failure,
  // and no criticality rule maps repeated schedule failure to a level).
  // Wired for future use — currently contributes nothing.
  for (const sc of getScheduleIncidents()) {
    incidents.push({
      id: sc.id,
      severity: sc.severity,
      title: sc.title,
      affectedService: sc.affectedService,
      sourceLabel: sc.sourceLabel,
      firstDetected: fmtTime(sc.firstDetected),
      lastUpdated: fmtTime(sc.lastUpdated),
      status: sc.status,
      description: sc.description,
      acknowledged: null,
      referenceType: null,
      referenceId: null,
    });
  }

  incidents.sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (r !== 0) return r;
    return b.lastUpdated.localeCompare(a.lastUpdated);
  });

  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
  const highCount = incidents.filter((i) => i.severity === 'high').length;

  return {
    mode: criticalCount > 0 ? 'incident' : 'normal',
    criticalCount,
    highCount,
    incidents,
  };
}

// --- Site status ------------------------------------------------------------------

export function getWallboardSites(): SiteHealthCard[] {
  return getSiteHealth();
}

// --- Active operations (Runs) ------------------------------------------------------

export interface ActiveOperation {
  site: string;
  agent: string;
  task: string;
  currentStep: string;
  progress: number;
  risk: string;
  duration: string;
  status: string;
  kind: 'run' | 'orchestration';
  refId: string;
}

export function getActiveOperations(): ActiveOperation[] {
  return getMissionControl().slice(0, 8).map((item) => ({
    site: item.siteName,
    agent: item.agentName,
    task: item.task,
    currentStep: item.stepName,
    progress: item.totalSteps > 0 ? Math.round((item.currentStep / item.totalSteps) * 100) : 0,
    risk: item.risk,
    duration: '—',
    status: 'working',
    kind: 'run' as const,
    refId: item.runId,
  }));
}

// --- Agents working now -----------------------------------------------------------

export function getWallboardAgents(limit = 6): AgentsWorkingItem[] {
  return getAgentsWorkingNow().slice(0, limit);
}

// --- Critical alerts ---------------------------------------------------------------

const CRITICAL_SEVERITIES = ['critical', 'high'];

export function getCriticalAlerts(limit = 6): OperationsAlert[] {
  return getOperationsAlerts()
    .filter((a) => CRITICAL_SEVERITIES.includes(a.severity))
    .slice(0, limit);
}

// --- Approvals watch -----------------------------------------------------------------

export function getWallboardApprovals(limit = 5): ApprovalWatchItem[] {
  return getApprovalWatch().slice(0, limit);
}

// --- System health -------------------------------------------------------------------

const WALLBOARD_SYSTEM_KEYS = ['orchestrator', 'sites', 'agents', 'runs', 'tools', 'models', 'runtime', 'monitoring', 'analytics'];

export function getWallboardSystemHealth(): SystemHealthRow[] {
  return getPlatformHealthRows().filter((row) => WALLBOARD_SYSTEM_KEYS.includes(row.key));
}

// --- Live activity --------------------------------------------------------------------

export function getWallboardActivity(limit = 10): LiveActivityEvent[] {
  return getActivityEvents().slice(0, limit);
}

// --- Users online (aggregate presence from built-in analytics) -----------------

export type PresenceSource = 'live' | 'partial' | 'not_connected';

export interface UsersOnlineBreakdown {
  siteKey: string;
  site: string;
  count: number | null; // null = this site has no presence integration/data
}

export interface UsersOnlineResult {
  source: PresenceSource;
  total: number | null;
  sites: UsersOnlineBreakdown[];
}

// Online = a distinct anonymous session with recorded activity within the last
// 5 minutes (enforced server-side in `wallboard_online_presence`). Stale
// sessions are never counted indefinitely.

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

export function getUsersOnline(): UsersOnlineResult {
  const data = getGroupLiveData();

  const onlineByDomain = new Map<string, number>();
  for (const p of data.presence) {
    const key = normalizeDomain(p.site_domain);
    if (!key) continue;
    onlineByDomain.set(key, (onlineByDomain.get(key) ?? 0) + (p.online_count ?? 0));
  }

  const breakdown: UsersOnlineBreakdown[] = data.sites.map((s) => {
    const key = normalizeDomain(s.domain);
    const connected = key !== '' && onlineByDomain.has(key);
    return {
      siteKey: s.site_key,
      site: s.name,
      count: connected ? (onlineByDomain.get(key) ?? 0) : null,
    };
  });

  const connectedSites = breakdown.filter((b) => b.count !== null).length;
  const total = breakdown.reduce((acc, b) => acc + (b.count ?? 0), 0);

  let source: PresenceSource;
  if (!data.availability.usersOnline) {
    source = 'not_connected'; // presence query failed / source unavailable
  } else if (data.sites.length === 0 || connectedSites === 0) {
    source = 'not_connected'; // no registered site has presence data
  } else if (connectedSites === data.sites.length) {
    source = 'live';
  } else {
    source = 'partial';
  }

  return {
    source,
    total: source === 'not_connected' ? null : total,
    sites: breakdown,
  };
}

// --- AI spend (estimated / migrated baseline) ----------------------------------------

export interface WallboardSpend {
  total: string;
  highestSite: string;
  highestModel: string;
  budgetStatus: string;
  budgetStatusLabel: string;
}

function pounds(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

const BUDGET_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  exceeded: 'Exceeded',
  disabled: 'Disabled',
  not_configured: 'Not Configured',
};

export function getWallboardSpend(): WallboardSpend {
  const data = getGroupLiveData();
  const usage = data.usageCosts;

  const total = usage.reduce((acc, u) => acc + (pounds(u.estimated_cost) || pounds(u.actual_cost)), 0);

  const bySite = new Map<string, number>();
  for (const u of usage) {
    if (!u.site_id) continue;
    const key = data.siteNameByUuid.get(u.site_id) ?? 'Group-wide';
    bySite.set(key, (bySite.get(key) ?? 0) + (pounds(u.estimated_cost) || pounds(u.actual_cost)));
  }
  const highestSite = [...bySite.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const byModel = new Map<string, number>();
  for (const u of usage) {
    if (!u.model_id) continue;
    const key = data.models.find((m) => m.id === u.model_id)?.name ?? '—';
    byModel.set(key, (byModel.get(key) ?? 0) + (pounds(u.estimated_cost) || pounds(u.actual_cost)));
  }
  const highestModel = [...byModel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const groupBudget = data.budgets.find((b) => b.scope_type === 'group');
  const status = (groupBudget?.status ?? 'not_configured') as BudgetStatus;

  return {
    total: `£${total.toFixed(2)}`,
    highestSite,
    highestModel,
    budgetStatus: status,
    budgetStatusLabel: BUDGET_LABELS[status] ?? status,
  };
}