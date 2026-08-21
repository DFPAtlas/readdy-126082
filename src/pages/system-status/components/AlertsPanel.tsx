import { useState } from 'react';
import type { MonitoringAlert, Project } from '../types';

interface Props {
  alerts: MonitoringAlert[];
  projects: Project[];
  onRefresh: () => void;
}

export default function AlertsPanel({ alerts, projects, onRefresh }: Props) {
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const getProjectName = (pid: number) => projects.find(p => p.id === pid)?.project_name ?? '';

  const filtered = alerts.filter(a => {
    if (filterProject !== 'all' && a.project_id !== Number(filterProject)) return false;
    if (filterType !== 'all' && a.alert_type !== filterType) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const openAlerts = alerts.filter(a => a.status === 'open' || a.status === 'investigating').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading font-semibold text-foreground-100">{openAlerts} open alert{openAlerts !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={onRefresh} className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1">
          <i className="ri-refresh-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Types</option>
          <option value="website_offline">Website Offline</option>
          <option value="supabase_failed">Supabase Failed</option>
          <option value="edge_function_failed">Edge Function Failed</option>
          <option value="agent_failed">Agent Failed</option>
          <option value="webhook_failed">Webhook Failed</option>
          <option value="slow_response">Slow Response</option>
          <option value="critical_incident">Critical Incident</option>
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <i className="ri-check-line text-2xl text-emerald-400 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No alerts</h3>
          <p className="text-sm text-foreground-500">All systems are running smoothly.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className={`flex items-start gap-3 bg-background-50 border rounded-lg p-3 ${a.severity === 'critical' ? 'border-red-500/30' : a.severity === 'high' ? 'border-orange-500/20' : 'border-background-200/60'}`}>
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${a.severity === 'critical' ? 'bg-red-400' : a.severity === 'high' ? 'bg-orange-400' : a.severity === 'medium' ? 'bg-amber-400' : 'bg-foreground-400'}`}></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-medium text-foreground-100">{a.alert_title}</span>
                  <AlertStatusBadge status={a.status} />
                  <span className="text-[10px] font-label text-foreground-500 capitalize">{a.alert_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-foreground-500 flex-wrap">
                  <span>Project: {getProjectName(a.project_id)}</span>
                  {a.source && <span>Source: {a.source}</span>}
                  <span>Detected: {fmtDate(a.detected_at)}</span>
                  {a.resolved_at && <span className="text-emerald-400">Resolved: {fmtDate(a.resolved_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="px-2 py-1 text-[10px] font-label text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 rounded transition-colors whitespace-nowrap cursor-pointer">Investigate</button>
                <button className="px-2 py-1 text-[10px] font-label text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 rounded transition-colors whitespace-nowrap cursor-pointer">Resolve</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'text-red-400 bg-red-500/10', investigating: 'text-amber-400 bg-amber-500/10', resolved: 'text-emerald-400 bg-emerald-500/10', ignored: 'text-foreground-400 bg-foreground-500/10',
  };
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${colors[status] ?? colors.ignored}`}>{status}</span>;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}