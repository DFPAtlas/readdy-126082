import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import OverviewTab from './components/OverviewTab';
import WebsiteMonitoringTab from './components/WebsiteMonitoringTab';
import SupabaseMonitoringTab from './components/SupabaseMonitoringTab';
import EdgeFunctionMonitoringTab from './components/EdgeFunctionMonitoringTab';
import AgentMonitoringTab from './components/AgentMonitoringTab';
import WebhookMonitoringTab from './components/WebhookMonitoringTab';
import LogsIncidentsTab from './components/LogsIncidentsTab';
import AlertsPanel from './components/AlertsPanel';
import type { MonitoredWebsite, SupabaseMonitor, EdgeFunctionMonitor, AgentMonitor, WebhookMonitor, MonitoringIncident, MonitoringAlert, Project } from './types';

const tabs = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-3-line' },
  { key: 'websites', label: 'Websites', icon: 'ri-global-line' },
  { key: 'supabase', label: 'Supabase', icon: 'ri-database-2-line' },
  { key: 'edge-functions', label: 'Edge Functions', icon: 'ri-function-line' },
  { key: 'agents', label: 'Agents', icon: 'ri-robot-2-line' },
  { key: 'webhooks', label: 'Webhooks', icon: 'ri-webhook-line' },
  { key: 'logs', label: 'Logs & Incidents', icon: 'ri-file-list-3-line' },
  { key: 'alerts', label: 'Alerts', icon: 'ri-alert-line' },
];

export default function SystemStatus() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [websites, setWebsites] = useState<MonitoredWebsite[]>([]);
  const [supabaseMonitors, setSupabaseMonitors] = useState<SupabaseMonitor[]>([]);
  const [edgeFunctions, setEdgeFunctions] = useState<EdgeFunctionMonitor[]>([]);
  const [agents, setAgents] = useState<AgentMonitor[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookMonitor[]>([]);
  const [incidents, setIncidents] = useState<MonitoringIncident[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastChecked, setLastChecked] = useState<string>('');

  const loadAll = useCallback(async () => {
    try {
      setError('');
      const [wRes, sRes, eRes, aRes, whRes, iRes, alRes, pRes] = await Promise.all([
        supabase.from('internal_monitored_websites').select('*').order('status'),
        supabase.from('internal_supabase_monitors').select('*').order('database_status'),
        supabase.from('internal_edge_function_monitors').select('*').order('status'),
        supabase.from('internal_agent_monitors').select('*').order('status'),
        supabase.from('internal_webhook_monitors').select('*').order('status'),
        supabase.from('internal_monitoring_incidents').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_monitoring_alerts').select('*').order('detected_at', { ascending: false }),
        supabase.from('internal_projects').select('id,project_name').order('project_name'),
      ]);
      if (wRes.error || sRes.error || eRes.error || aRes.error || whRes.error || iRes.error || alRes.error || pRes.error) throw new Error('Failed to load data');
      setWebsites(wRes.data ?? []);
      setSupabaseMonitors(sRes.data ?? []);
      setEdgeFunctions(eRes.data ?? []);
      setAgents(aRes.data ?? []);
      setWebhooks(whRes.data ?? []);
      setIncidents(iRes.data ?? []);
      setAlerts(alRes.data ?? []);
      setProjects(pRes.data ?? []);
      setLastChecked(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      setError(err.message || 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onlineWebsites = websites.filter(w => w.status === 'online').length;
  const offlineWebsites = websites.filter(w => w.status === 'offline' || w.status === 'error').length;
  const healthySupabase = supabaseMonitors.filter(s => s.database_status === 'healthy').length;
  const healthyEdgeFns = edgeFunctions.filter(e => e.status === 'healthy').length;
  const runningAgents = agents.filter(a => a.status === 'healthy' || a.status === 'running').length;
  const failedAgents = agents.filter(a => a.status === 'failed').length;
  const failedWebhooks = webhooks.filter(w => w.status === 'failed').length;
  const openCriticalIssues = incidents.filter(i => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved').length;

  const getProjectName = (pid: number) => projects.find(p => p.id === pid)?.project_name ?? '';

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-heading font-bold text-foreground-50">System Status</h1>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-96"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">System Status</h1>
          <p className="text-sm text-foreground-500 mt-1">Last checked: {lastChecked}</p>
        </div>
        <button
          onClick={loadAll}
          className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-4 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
        >
          <i className="ri-refresh-line text-sm w-3.5 h-3.5 flex items-center justify-center"></i>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadAll} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Dashboard summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Websites Monitored" value={websites.length} icon="ri-global-line" color="accent" />
        <SummaryCard label="Online" value={onlineWebsites} icon="ri-check-double-line" color="emerald" />
        <SummaryCard label="Offline" value={offlineWebsites} icon="ri-close-circle-line" color="red" alert={offlineWebsites > 0} />
        <SummaryCard label="Supabase Healthy" value={healthySupabase} icon="ri-database-2-line" color="emerald" />
        <SummaryCard label="Edge Fns Healthy" value={healthyEdgeFns} icon="ri-function-line" color="emerald" />
        <SummaryCard label="Agents Running" value={runningAgents} icon="ri-robot-2-line" color="emerald" />
        <SummaryCard label="Agents Failed" value={failedAgents} icon="ri-alert-line" color="red" alert={failedAgents > 0} />
        <SummaryCard label="Webhook Failures" value={failedWebhooks} icon="ri-webhook-line" color="red" alert={failedWebhooks > 0} />
        <SummaryCard label="Critical Issues" value={openCriticalIssues} icon="ri-error-warning-line" color="red" alert={openCriticalIssues > 0} />
        <SummaryCard label="Last Check" value={lastChecked} icon="ri-time-line" color="foreground" isText />
      </div>

      {/* Tabs */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="border-b border-background-200/60 px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-accent-500/10 text-accent-400 font-medium'
                  : 'text-foreground-400 hover:text-foreground-200 hover:bg-background-200/50'
              }`}
            >
              <i className={`${tab.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              projects={projects}
              websites={websites}
              supabaseMonitors={supabaseMonitors}
              edgeFunctions={edgeFunctions}
              agents={agents}
              webhooks={webhooks}
              incidents={incidents}
              onRefresh={loadAll}
            />
          )}
          {activeTab === 'websites' && (
            <WebsiteMonitoringTab websites={websites} projects={projects} onRefresh={loadAll} />
          )}
          {activeTab === 'supabase' && (
            <SupabaseMonitoringTab monitors={supabaseMonitors} projects={projects} onRefresh={loadAll} />
          )}
          {activeTab === 'edge-functions' && (
            <EdgeFunctionMonitoringTab functions={edgeFunctions} projects={projects} onRefresh={loadAll} />
          )}
          {activeTab === 'agents' && (
            <AgentMonitoringTab agents={agents} projects={projects} onRefresh={loadAll} />
          )}
          {activeTab === 'webhooks' && (
            <WebhookMonitoringTab webhooks={webhooks} projects={projects} onRefresh={loadAll} />
          )}
          {activeTab === 'logs' && (
            <LogsIncidentsTab incidents={incidents} projects={projects} onRefresh={loadAll} />
          )}
          {activeTab === 'alerts' && (
            <AlertsPanel alerts={alerts} projects={projects} onRefresh={loadAll} />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, alert, isText }: { label: string; value: string | number; icon: string; color: string; alert?: boolean; isText?: boolean }) {
  const colorMap: Record<string, string> = {
    accent: 'bg-accent-500/10 text-accent-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    foreground: 'bg-foreground-500/10 text-foreground-300',
  };

  return (
    <div className={`bg-background-100 border rounded-lg p-3.5 ${alert ? 'border-red-500/30' : 'border-background-200/60'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${colorMap[color] ?? colorMap.accent}`}>
          <i className={`${icon} text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
        </div>
        <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <p className={`text-xl font-heading font-bold ${alert ? 'text-red-400' : 'text-foreground-50'} ${isText ? 'text-xs' : ''}`}>{value}</p>
    </div>
  );
}