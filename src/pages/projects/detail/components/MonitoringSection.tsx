// ============================================================================
// DFP COMMAND 10 — PROJECT MONITORING / OPERATIONAL HEALTH DASHBOARD
// ============================================================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Project, SectionKey } from '../types';
import type { ProjectIntegration } from '../infrastructureTypes';
import { configured } from '../infrastructureUtils';
import type { MonitoringAlert } from '../monitoringTypes';
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_HEALTH_STYLES,
  type ComponentState,
} from '../monitoringTypes';
import {
  productionState,
  stagingState,
  runtimeState,
  backendState,
  agentsState,
  edgeFunctionsState,
  webhooksState,
  websiteForEnvironment,
  deriveProjectHealth,
  computeMonitoringSummary,
  normalizeSeverity,
  isActiveStatus,
  buildRecentChecks,
} from '../monitoringUtils';
import { formatRelative, formatDate } from '../utils';
import type { ProjectMonitoringData } from '../useProjectMonitoring';
import {
  MonitorStateBadge,
  SeverityBadge,
  FreshnessBadge,
  Panel,
  FieldRow,
  EmptyNote,
  SourceUnavailableNote,
  ExternalLink,
  StalenessNote,
} from './MonitoringPanels';
import ConfirmDialog from '@/components/base/ConfirmDialog';

interface MonitoringSectionProps {
  project: Project;
  monitoring: ProjectMonitoringData;
  integration: ProjectIntegration | null;
  onNavigate: (key: SectionKey) => void;
}

export default function MonitoringSection({ project, monitoring, integration, onNavigate }: MonitoringSectionProps) {
  const [incidentTarget, setIncidentTarget] = useState<MonitoringAlert | null>(null);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [actionNote, setActionNote] = useState('');

  const productionUrlConfigured = configured(integration?.production_url) || configured(project.domain_live);
  const stagingUrlConfigured = configured(integration?.staging_url) || configured(project.domain_staging);
  const supabaseRefConfigured = configured(integration?.supabase_project_ref) || configured(integration?.supabase_project_name);
  const runtimeNodeConfigured = configured(integration?.runtime_node);

  const config = {
    monitoringProvider: integration?.monitoring_provider,
    productionUrl: integration?.production_url ?? project.domain_live,
    stagingUrl: integration?.staging_url ?? project.domain_staging,
    supabaseRef: integration?.supabase_project_ref,
    runtimeNode: integration?.runtime_node,
  };

  const anyLoadFailed = Object.keys(monitoring.errors).length > 0;

  const health = deriveProjectHealth({
    websites: monitoring.websites,
    supabaseMonitors: monitoring.supabaseMonitors,
    edgeFunctions: monitoring.edgeFunctions,
    agents: monitoring.agents,
    webhooks: monitoring.webhooks,
    incidents: monitoring.incidents,
    alerts: monitoring.alerts,
    config,
    anyLoadFailed,
  });

  const summary = computeMonitoringSummary({
    websites: monitoring.websites,
    supabaseMonitors: monitoring.supabaseMonitors,
    edgeFunctions: monitoring.edgeFunctions,
    agents: monitoring.agents,
    webhooks: monitoring.webhooks,
    incidents: monitoring.incidents,
    alerts: monitoring.alerts,
    config,
    anyLoadFailed,
  });

  const prod = productionState(monitoring.websites, productionUrlConfigured);
  const stage = stagingState(monitoring.websites, stagingUrlConfigured);
  const runtime = runtimeState(runtimeNodeConfigured);
  const backend = backendState(monitoring.supabaseMonitors[0], supabaseRefConfigured);
  const ai = agentsState(monitoring.agents);
  const edge = edgeFunctionsState(monitoring.edgeFunctions);
  const webhook = webhooksState(monitoring.webhooks);

  const live = websiteForEnvironment(monitoring.websites, 'live');
  const stagingSite = websiteForEnvironment(monitoring.websites, 'staging');
  const supabaseMonitor = monitoring.supabaseMonitors[0];

  const activeAlerts = monitoring.alerts.filter((a) => isActiveStatus(a.status));
  const activeIncidents = monitoring.incidents.filter((i) => isActiveStatus(i.status));

  const lastCheck = computeLastCheck(monitoring);

  const recentChecks = buildRecentChecks(monitoring.websites, monitoring.edgeFunctions, monitoring.agents);

  const notConfigured = health === 'NOT CONFIGURED';

  const handleCreateIncident = async () => {
    if (!incidentTarget || !project) return;
    setCreatingIncident(true);
    setActionNote('');
    try {
      // Duplicate protection — never create a second active incident for the same alert.
      const dup = monitoring.incidents.find(
        (i) => isActiveStatus(i.status) && i.incident_title === incidentTarget.alert_title,
      );
      if (dup) {
        setActionNote('An active incident already exists for this alert.');
        setIncidentTarget(null);
        return;
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from('internal_monitoring_incidents').insert({
        project_id: project.id,
        incident_title: incidentTarget.alert_title,
        incident_type: incidentTarget.alert_type ?? 'operational',
        severity: incidentTarget.severity ?? 'medium',
        status: 'new',
        source_monitor_type: 'alert',
        source_monitor_id: incidentTarget.id,
        first_seen_at: incidentTarget.time_detected ?? now,
        last_seen_at: incidentTarget.time_detected ?? now,
        summary: incidentTarget.notes ?? null,
      });
      if (error) throw error;
      try {
        await supabase.from('internal_activity_log').insert({
          entity_type: 'project',
          entity_id: project.id,
          action: 'Monitoring incident opened',
          description: `Monitoring incident opened from alert "${incidentTarget.alert_title}": ${project.project_name}`,
        });
      } catch {
        // non-critical
      }
      setActionNote('Incident opened.');
      monitoring.refresh();
    } catch (err: any) {
      setActionNote(err.message || 'Failed to open incident.');
    } finally {
      setCreatingIncident(false);
      setIncidentTarget(null);
    }
  };

  const healthNote = healthNoteFor(health, live);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Monitoring</h3>
          <p className="text-sm text-foreground-500 mt-1">
            Operational health for {project.project_name} — reachability, runtime, backend and alerts.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={monitoring.refresh}
            disabled={!monitoring.configured}
            className="flex items-center gap-1.5 bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
            Refresh Status
          </button>
          <Link
            to="/system-status"
            className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
            Open System Status
          </Link>
        </div>
      </div>

      {/* Action feedback */}
      {actionNote && (
        <div className="flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 text-sm text-foreground-300">
          <i className="ri-information-line w-4 h-4 flex items-center justify-center text-accent-400"></i>
          {actionNote}
        </div>
      )}

      {/* Overall health */}
      <div className={`rounded-lg border p-5 ${PROJECT_HEALTH_STYLES[health].split(' ').slice(1).join(' ')}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-background-50 flex items-center justify-center">
              <i className={`${healthIcon(health)} text-xl text-foreground-300 w-6 h-6 flex items-center justify-center`}></i>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Overall Health</p>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-heading font-bold ${PROJECT_HEALTH_STYLES[health].split(' ')[1]}`}>
                  {PROJECT_HEALTH_LABELS[health]}
                </span>
                <span className={`inline-block text-[10px] font-label px-2 py-0.5 rounded-full border whitespace-nowrap ${PROJECT_HEALTH_STYLES[health]}`}>
                  {health}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Last Check</p>
            <p className="text-sm text-foreground-200">{lastCheck}</p>
          </div>
        </div>
        <p className="text-sm text-foreground-400 mt-3 leading-relaxed">{healthNote}</p>
        <StalenessNote />
      </div>

      {/* Critical banner */}
      {(health === 'CRITICAL' || health === 'OFFLINE') && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <i className="ri-alert-fill text-lg text-red-400 w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-heading font-semibold text-red-300">CRITICAL OPERATIONAL ISSUE</p>
              <p className="text-sm text-foreground-300 mt-1">
                {live && (live.status === 'offline' || live.status === 'error')
                  ? 'Production site unreachable'
                  : criticalSummary(activeAlerts, activeIncidents)}
              </p>
              {live && (
                <p className="text-xs text-foreground-500 mt-1">
                  Detected: {formatDate(live.last_checked_at ?? live.updated_at)} · Source: DFP Command
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Production" state={prod} />
        <SummaryCard label="Staging" state={stage} />
        <SummaryCard label="Runtime" state={runtime} />
        <SummaryCard label="Database / Backend" state={backend} />
        <SummaryCard label="AI Operations" state={ai} />
        <SummaryCard label="Active Alerts" value={summary.activeAlerts} tone={summary.criticalAlerts > 0 ? 'red' : 'neutral'} />
      </div>

      {/* Production + Staging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Production"
          icon="ri-global-line"
          source="DFP Command"
          actions={live ? <ExternalLink href={live.url} label="Open Site" /> : undefined}
        >
          {live ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <MonitorStateBadge state={prod} />
                <FreshnessBadge lastCheckedAt={live.last_checked_at} />
              </div>
              <FieldRow label="Domain" value={live.url} mono />
              <FieldRow label="HTTP Status" value={live.last_status_code != null ? String(live.last_status_code) : '—'} />
              <FieldRow label="Response Time" value={live.last_response_time_ms != null ? `${live.last_response_time_ms} ms` : '—'} />
              <FieldRow label="SSL" value={live.ssl_status ?? '—'} />
              <FieldRow label="Last Check" value={live.last_checked_at ? formatDate(live.last_checked_at) : '—'} />
            </div>
          ) : productionUrlConfigured ? (
            <EmptyNote text="Production is configured but has no reachability check yet." />
          ) : (
            <EmptyNote text="Production is not monitored." />
          )}
        </Panel>

        <Panel
          title="Staging"
          icon="ri-stack-line"
          source="DFP Command"
          actions={stagingSite ? <ExternalLink href={stagingSite.url} label="Open Staging" /> : undefined}
        >
          {stagingSite ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <MonitorStateBadge state={stage} />
                <FreshnessBadge lastCheckedAt={stagingSite.last_checked_at} />
              </div>
              <FieldRow label="Domain" value={stagingSite.url} mono />
              <FieldRow label="HTTP Status" value={stagingSite.last_status_code != null ? String(stagingSite.last_status_code) : '—'} />
              <FieldRow label="Response Time" value={stagingSite.last_response_time_ms != null ? `${stagingSite.last_response_time_ms} ms` : '—'} />
              <FieldRow label="Last Check" value={stagingSite.last_checked_at ? formatDate(stagingSite.last_checked_at) : '—'} />
            </div>
          ) : stagingUrlConfigured ? (
            <EmptyNote text="Staging is configured but has no reachability check yet." />
          ) : (
            <EmptyNote text="No staging environment configured. This is not an operational fault." />
          )}
        </Panel>
      </div>

      {/* Runtime + Backend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Runtime" icon="ri-cpu-line" source="Runtime Bridge">
          {runtimeNodeConfigured ? (
            <div className="space-y-3">
              <MonitorStateBadge state={runtime} />
              <FieldRow label="Runtime Node" value={integration?.runtime_node} mono />
              <FieldRow label="Runtime Environment" value={integration?.runtime_environment} />
              <FieldRow label="Active Agents" value={monitoring.agents.length > 0 ? String(monitoring.agents.length) : '—'} />
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Link
                  to="/ai-operations/runtime-health"
                  className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-pulse-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Open Runtime Health
                </Link>
              </div>
              <p className="text-xs text-foreground-500 leading-relaxed">
                Runtime heartbeat telemetry is keyed to runtime nodes, not projects. Live heartbeat/CPU/memory is
                available in Runtime Health — no physical server status is inferred from the mapping.
              </p>
            </div>
          ) : (
            <EmptyNote text="Runtime mapping is not configured. No runtime services are started or stopped here." />
          )}
        </Panel>

        <Panel
          title="Database / Backend"
          icon="ri-database-2-line"
          source="Supabase Heartbeat"
          actions={integration?.supabase_dashboard_url ? <ExternalLink href={integration.supabase_dashboard_url} label="Open Supabase" /> : undefined}
        >
          {supabaseMonitor ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <MonitorStateBadge state={backend} />
                <FreshnessBadge lastCheckedAt={supabaseMonitor.last_checked_at} />
              </div>
              <FieldRow label="Project" value={supabaseMonitor.supabase_project_name} />
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Database" value={supabaseMonitor.database_status} />
                <FieldRow label="Auth" value={supabaseMonitor.auth_status} />
                <FieldRow label="Storage" value={supabaseMonitor.storage_status} />
                <FieldRow label="Edge Functions" value={supabaseMonitor.edge_functions_status} />
                <FieldRow label="Realtime" value={supabaseMonitor.realtime_status} />
              </div>
            </div>
          ) : supabaseRefConfigured ? (
            <EmptyNote text="Configured — health check not available. Only claim database/auth/storage health when those exact checks exist." />
          ) : (
            <EmptyNote text="No backend is mapped to this project." />
          )}
        </Panel>
      </div>

      {/* AI Operations + Edge/Webhooks */}
      <Panel title="AI Operations" icon="ri-robot-2-line" source="AI Operations">
        {monitoring.agents.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <MonitorStateBadge state={ai} />
              <span className="text-xs text-foreground-500">
                {monitoring.agents.filter((a) => a.status === 'healthy' || a.status === 'running').length} /{' '}
                {monitoring.agents.length} agents online
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {monitoring.agents.slice(0, 4).map((a) => (
                <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-3">
                  <p className="text-xs font-heading font-semibold text-foreground-200 truncate mb-1.5">{a.agent_name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${agentStatusStyle(a.status)}`}>
                      {a.status}
                    </span>
                    <span className="text-[10px] text-foreground-500 whitespace-nowrap">
                      {a.last_run_at ? formatRelative(a.last_run_at) : 'no run'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/ai-operations"
                className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                Open AI Operations
              </Link>
            </div>
          </div>
        ) : (
          <EmptyNote text="No project-scoped agents are monitored. AI alerts/incidents are keyed to AI sites — see AI Operations." />
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Edge Functions" icon="ri-function-line" source="DFP Command">
          {monitoring.edgeFunctions.length > 0 ? (
            <div className="space-y-3">
              <MonitorStateBadge state={edge} />
              <div className="divide-y divide-background-200/60">
                {monitoring.edgeFunctions.map((f) => (
                  <div key={f.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground-200 truncate">{f.function_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${agentStatusStyle(f.status)}`}>{f.status}</span>
                      <span className="text-[10px] text-foreground-500 whitespace-nowrap">{f.last_response_time_ms != null ? `${f.last_response_time_ms}ms` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyNote text="No edge functions are monitored for this project." />
          )}
        </Panel>

        <Panel title="Webhooks" icon="ri-webhook-line" source="DFP Command">
          {monitoring.webhooks.length > 0 ? (
            <div className="space-y-3">
              <MonitorStateBadge state={webhook} />
              <div className="divide-y divide-background-200/60">
                {monitoring.webhooks.map((w) => (
                  <div key={w.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground-200 truncate">{w.webhook_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${agentStatusStyle(w.status)}`}>{w.status}</span>
                      <span className="text-[10px] text-foreground-500 whitespace-nowrap">{w.failure_count_today} fails today</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyNote text="No webhooks are monitored for this project." />
          )}
        </Panel>
      </div>

      {/* Active alerts */}
      <Panel title="Active Operational Alerts" icon="ri-alert-line" source={undefined}>
        {monitoring.errors.alerts ? (
          <SourceUnavailableNote text={monitoring.errors.alerts} />
        ) : activeAlerts.length === 0 ? (
          <EmptyNote text="No active alerts." />
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((a) => (
              <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-100 font-medium truncate">{a.alert_title}</p>
                    <p className="text-[11px] text-foreground-500 mt-0.5">
                      {a.source ? `${a.source} · ` : ''}Detected {formatDate(a.time_detected)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <SeverityBadge severity={normalizeSeverity(a.severity)} />
                    <span className="text-[10px] font-label px-1.5 py-0.5 rounded capitalize bg-background-200/60 text-foreground-400 whitespace-nowrap">{a.status}</span>
                    <button
                      type="button"
                      onClick={() => setIncidentTarget(a)}
                      disabled={!monitoring.configured}
                      className="text-[10px] font-label text-accent-400 hover:text-accent-300 bg-accent-500/10 hover:bg-accent-500/15 px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Create Incident
                    </button>
                  </div>
                </div>
                {a.notes && <p className="text-xs text-foreground-500 mt-2 leading-relaxed">{a.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Recent incidents */}
      <Panel title="Recent Incidents" icon="ri-error-warning-line" source={undefined}>
        {monitoring.errors.incidents ? (
          <SourceUnavailableNote text={monitoring.errors.incidents} />
        ) : monitoring.incidents.length === 0 ? (
          <EmptyNote text="No incidents on record for this project." />
        ) : (
          <div className="space-y-2">
            {monitoring.incidents.slice(0, 6).map((i) => (
              <div key={i.id} className="bg-background-100 border border-background-200/60 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-100 font-medium truncate">{i.incident_title}</p>
                    <p className="text-[11px] text-foreground-500 mt-0.5">
                      Opened {formatDate(i.first_seen_at)} · {i.source_monitor_type ?? 'unknown source'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <SeverityBadge severity={normalizeSeverity(i.severity)} />
                    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${isActiveStatus(i.status) ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {i.status}
                    </span>
                  </div>
                </div>
                {i.summary && <p className="text-xs text-foreground-500 mt-2 leading-relaxed">{i.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Operational dependencies */}
      <Panel title="Operational Dependencies" icon="ri-git-branch-line">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <DependencyRow label="Production" state={prod} />
          <DependencyRow label="Database" state={backend} />
          <DependencyRow label="Runtime" state={runtime} />
          <DependencyRow label="AI" state={ai} />
          <DependencyRow label="DNS" state={configured(integration?.dns_provider) ? 'UNKNOWN' : 'NOT MONITORED'} note={configured(integration?.dns_provider) ? 'No live DNS check' : undefined} />
          <DependencyRow label="Monitoring" state={configured(integration?.monitoring_provider) ? 'UNKNOWN' : 'NOT MONITORED'} note={configured(integration?.monitoring_provider) ? 'Configured' : undefined} />
        </div>
      </Panel>

      {/* Monitoring configuration */}
      <Panel
        title="Monitoring Configuration"
        icon="ri-settings-3-line"
        actions={
          <button
            type="button"
            onClick={() => onNavigate('infrastructure')}
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-pencil-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Edit Monitoring Mapping
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
          <FieldRow label="Provider" value={integration?.monitoring_provider} />
          <FieldRow label="Target" value={integration?.monitoring_target} mono />
          <FieldRow label="Production URL" value={integration?.production_url ?? project.domain_live} mono />
          <FieldRow label="Staging URL" value={integration?.staging_url ?? project.domain_staging} mono />
          <FieldRow label="Runtime Node" value={integration?.runtime_node} mono />
          <FieldRow label="Backend Ref" value={integration?.supabase_project_ref} mono />
        </div>
        {integration?.monitoring_provider && integration.monitoring_provider.toLowerCase().includes('librenms') && (
          <p className="text-xs text-foreground-500 mt-3">
            LibreNMS is configured as the monitoring provider — live telemetry is not integrated into DFP Command.
          </p>
        )}
        {integration?.monitoring_dashboard_url && (
          <div className="mt-3">
            <ExternalLink href={integration.monitoring_dashboard_url} label="Open Monitoring Dashboard" />
          </div>
        )}
      </Panel>

      {/* Recent checks */}
      <Panel title="Recent Checks" icon="ri-time-line">
        {recentChecks.length === 0 ? (
          <EmptyNote text="Historical check data unavailable — only current state is stored." />
        ) : (
          <div className="divide-y divide-background-200/60">
            {recentChecks.map((c) => (
              <div key={c.key} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground-200 truncate">{c.component}</p>
                  <p className="text-[10px] text-foreground-500">{formatDate(c.time)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${agentStatusStyle(c.result)}`}>{c.result}</span>
                  {c.durationMs != null && <span className="text-[10px] text-foreground-500 whitespace-nowrap">{c.durationMs}ms</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Not configured empty state */}
      {notConfigured && monitoring.websites.length === 0 && monitoring.supabaseMonitors.length === 0 && monitoring.agents.length === 0 && (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-pulse-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-100 mb-1">Monitoring not configured</h4>
          <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">
            No monitoring source is linked to this project. Map a monitoring provider and target to begin tracking reachability.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('infrastructure')}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Configure Monitoring
          </button>
        </div>
      )}

      {/* Create incident confirm */}
      <ConfirmDialog
        open={incidentTarget != null}
        onClose={() => setIncidentTarget(null)}
        title="Create Incident"
        message={`Open a monitoring incident for "${incidentTarget?.alert_title ?? ''}"? This does not trigger remediation, restart or auto-recovery.`}
        confirmLabel={creatingIncident ? 'Creating...' : 'Create Incident'}
        confirmVariant="danger"
        onConfirm={handleCreateIncident}
        loading={creatingIncident}
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function SummaryCard({ label, state, value, tone }: { label: string; state?: ComponentState; value?: number; tone?: 'red' | 'neutral' }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2 whitespace-nowrap">{label}</p>
      {state != null ? (
        <MonitorStateBadge state={state} />
      ) : (
        <span className={`text-lg font-heading font-bold ${tone === 'red' ? 'text-red-400' : 'text-foreground-50'}`}>{value}</span>
      )}
    </div>
  );
}

function DependencyRow({ label, state, note }: { label: string; state: ComponentState; note?: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-1.5 whitespace-nowrap">{label}</p>
      <MonitorStateBadge state={state} />
      {note && <p className="text-[10px] text-foreground-500 mt-1.5 whitespace-nowrap">{note}</p>}
    </div>
  );
}

function computeLastCheck(monitoring: ProjectMonitoringData): string {
  const times: string[] = [];
  for (const w of monitoring.websites) if (w.last_checked_at) times.push(w.last_checked_at);
  for (const s of monitoring.supabaseMonitors) if (s.last_checked_at) times.push(s.last_checked_at);
  for (const f of monitoring.edgeFunctions) if (f.last_success_at) times.push(f.last_success_at);
  for (const a of monitoring.agents) if (a.last_run_at) times.push(a.last_run_at);
  if (times.length === 0) return 'Never';
  const latest = times.map((t) => new Date(t).getTime()).reduce((m, t) => Math.max(m, t), 0);
  return formatRelative(new Date(latest).toISOString()) ?? formatDate(new Date(latest).toISOString());
}

function agentStatusStyle(status: string): string {
  const map: Record<string, string> = {
    online: 'bg-emerald-500/10 text-emerald-400',
    healthy: 'bg-emerald-500/10 text-emerald-400',
    running: 'bg-emerald-500/10 text-emerald-400',
    slow: 'bg-amber-500/10 text-amber-400',
    warning: 'bg-amber-500/10 text-amber-400',
    offline: 'bg-red-500/10 text-red-400',
    error: 'bg-red-500/10 text-red-400',
    failed: 'bg-red-500/10 text-red-400',
    unknown: 'bg-foreground-500/10 text-foreground-400',
    paused: 'bg-foreground-500/10 text-foreground-400',
  };
  return map[status] ?? map.unknown;
}

function healthIcon(health: string): string {
  switch (health) {
    case 'HEALTHY':
      return 'ri-check-double-line';
    case 'DEGRADED':
      return 'ri-alert-line';
    case 'CRITICAL':
    case 'OFFLINE':
      return 'ri-alert-fill';
    case 'NOT CONFIGURED':
      return 'ri-pulse-line';
    default:
      return 'ri-question-line';
  }
}

function healthNoteFor(health: string, live: ReturnType<typeof websiteForEnvironment>): string {
  switch (health) {
    case 'HEALTHY':
      return 'All monitored components report current, successful telemetry with no active critical or high operational alerts.';
    case 'DEGRADED':
      return 'One or more monitored components are impaired, stale, warning, or a high-severity alert exists.';
    case 'CRITICAL':
      return 'A critical operational condition exists — a critical alert, incident or backend failure requires attention.';
    case 'OFFLINE':
      return 'A required production service is confirmed offline.';
    case 'NOT CONFIGURED':
      return 'No monitoring mapping exists for this project yet.';
    default:
      return live
        ? 'Monitoring is configured but the current state could not be determined from available telemetry.'
        : 'Monitoring is configured but no live check has been recorded yet.';
  }
}

function criticalSummary(
  activeAlerts: MonitoringAlert[],
  activeIncidents: { incident_title: string; severity: string; status: string }[],
): string {
  const crit = activeAlerts.find((a) => normalizeSeverity(a.severity) === 'CRITICAL');
  if (crit) return crit.alert_title;
  const critInc = activeIncidents.find((i) => normalizeSeverity(i.severity) === 'CRITICAL');
  if (critInc) return critInc.incident_title;
  return 'A critical operational condition exists.';
}