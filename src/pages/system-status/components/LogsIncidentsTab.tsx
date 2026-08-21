import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MonitoringIncident, MonitoringLog, Project } from '../types';

interface Props {
  incidents: MonitoringIncident[];
  projects: Project[];
  onRefresh: () => void;
}

export default function LogsIncidentsTab({ incidents, projects, onRefresh }: Props) {
  const [activeSub, setActiveSub] = useState<'incidents' | 'logs'>('incidents');
  const [logs, setLogs] = useState<MonitoringLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterLogProject, setFilterLogProject] = useState<string>('all');
  const [filterLogType, setFilterLogType] = useState<string>('all');
  const [filterLogStatus, setFilterLogStatus] = useState<string>('all');
  const [searchLogs, setSearchLogs] = useState('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [filterIncidentProject, setFilterIncidentProject] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const getProjectName = (pid: number | null) => projects.find(p => p.id === pid)?.project_name ?? '';

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data, error: e } = await supabase.from('internal_monitoring_logs').select('*').order('checked_at', { ascending: false }).limit(100);
      if (e) throw e;
      setLogs(data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSub === 'logs') loadLogs();
  }, [activeSub, loadLogs]);

  const filteredLogs = logs.filter(l => {
    if (filterLogProject !== 'all' && l.project_id !== Number(filterLogProject)) return false;
    if (filterLogType !== 'all' && l.monitor_type !== filterLogType) return false;
    if (filterLogStatus !== 'all' && l.status !== filterLogStatus) return false;
    if (searchLogs && !l.message?.toLowerCase().includes(searchLogs.toLowerCase()) && !l.error_message?.toLowerCase().includes(searchLogs.toLowerCase())) return false;
    return true;
  });

  const filteredIncidents = incidents.filter(i => {
    if (filterIncidentProject !== 'all' && i.project_id !== Number(filterIncidentProject)) return false;
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-background-50 border border-background-200/60 rounded-full p-0.5 w-fit">
        <button onClick={() => setActiveSub('incidents')} className={`px-3 py-1.5 text-sm rounded-full transition-colors cursor-pointer whitespace-nowrap ${activeSub === 'incidents' ? 'bg-accent-500/10 text-accent-400 font-medium' : 'text-foreground-400 hover:text-foreground-200'}`}>
          Incidents ({incidents.length})
        </button>
        <button onClick={() => setActiveSub('logs')} className={`px-3 py-1.5 text-sm rounded-full transition-colors cursor-pointer whitespace-nowrap ${activeSub === 'logs' ? 'bg-accent-500/10 text-accent-400 font-medium' : 'text-foreground-400 hover:text-foreground-200'}`}>
          Logs
        </button>
      </div>

      {activeSub === 'incidents' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterIncidentProject} onChange={e => setFilterIncidentProject(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="text-center py-12"><p className="text-sm text-foreground-500">No incidents found</p></div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map(i => (
                <div key={i.id} className={`bg-background-50 border rounded-lg p-4 ${i.severity === 'critical' ? 'border-red-500/30' : i.severity === 'high' ? 'border-orange-500/20' : 'border-background-200/60'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <SeverityBadge severity={i.severity} />
                        <IncidentStatusBadge status={i.status} />
                        <span className="text-[10px] text-foreground-500">{i.incident_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <h4 className="text-sm font-heading font-semibold text-foreground-100">{i.incident_title}</h4>
                    </div>
                    <span className="text-[10px] text-foreground-500 whitespace-nowrap">{getProjectName(i.project_id)}</span>
                  </div>
                  {i.summary && <p className="text-xs text-foreground-400 mb-2">{i.summary}</p>}
                  {i.error_message && <p className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1 mb-2">{i.error_message}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-foreground-500">
                    <span>First seen: {fmtDate(i.first_seen_at)}</span>
                    <span>Last seen: {fmtDate(i.last_seen_at)}</span>
                    {i.resolved_at && <span className="text-emerald-400">Resolved: {fmtDate(i.resolved_at)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterLogProject} onChange={e => setFilterLogProject(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            <select value={filterLogType} onChange={e => setFilterLogType(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
              <option value="all">All Types</option>
              <option value="website">Website</option>
              <option value="supabase">Supabase</option>
              <option value="edge_function">Edge Function</option>
              <option value="agent">Agent</option>
              <option value="webhook">Webhook</option>
            </select>
            <select value={filterLogStatus} onChange={e => setFilterLogStatus(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
              <option value="all">All Status</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="failed">Failed</option>
            </select>
            <input
              type="text"
              value={searchLogs}
              onChange={e => setSearchLogs(e.target.value)}
              placeholder="Search logs..."
              className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 placeholder:text-foreground-500 outline-none focus:border-accent-500/50"
            />
            <button onClick={loadLogs} className="ml-auto bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1">
              <i className="ri-refresh-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i> Refresh
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-12"><div className="animate-pulse text-foreground-500 text-sm">Loading logs...</div></div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12"><p className="text-sm text-foreground-500">No logs found</p></div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map(l => (
                <div key={l.id}>
                  <button
                    onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 bg-background-50 border border-background-200/60 rounded-lg hover:bg-background-100 transition-colors text-left cursor-pointer"
                  >
                    <LogStatusIcon status={l.status} />
                    <span className="text-[10px] font-label text-foreground-400 uppercase whitespace-nowrap w-16">{l.monitor_type.replace('_', ' ')}</span>
                    <span className="text-xs text-foreground-200 flex-1 truncate">{l.message ?? l.error_message ?? '-'}</span>
                    <span className="text-[10px] text-foreground-500 whitespace-nowrap">{fmtAgo(l.checked_at)}</span>
                    <i className={`ri-arrow-down-s-line text-foreground-400 w-4 h-4 flex items-center justify-center transition-transform ${expandedLog === l.id ? 'rotate-180' : ''}`}></i>
                  </button>
                  {expandedLog === l.id && (
                    <div className="mx-3 px-3 py-2 bg-background-50 border-x border-b border-background-200/60 rounded-b-lg">
                      <div className="text-[10px] text-foreground-400 space-y-1">
                        <div><span className="text-foreground-500">Status Code:</span> {l.status_code ?? '-'}</div>
                        {l.response_time_ms && <div><span className="text-foreground-500">Response:</span> {l.response_time_ms}ms</div>}
                        {l.error_message && <div className="text-red-400">{l.error_message}</div>}
                        <div><span className="text-foreground-500">Checked:</span> {l.checked_at ? new Date(l.checked_at).toLocaleString() : '-'}</div>
                        {l.project_id && <div><span className="text-foreground-500">Project:</span> {getProjectName(l.project_id)}</div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10', high: 'text-orange-400 bg-orange-500/10', medium: 'text-amber-400 bg-amber-500/10', low: 'text-foreground-400 bg-foreground-500/10',
  };
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${colors[severity] ?? colors.low}`}>{severity}</span>;
}

function IncidentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'text-red-400 bg-red-500/10', investigating: 'text-amber-400 bg-amber-500/10', resolved: 'text-emerald-400 bg-emerald-500/10', ignored: 'text-foreground-400 bg-foreground-500/10',
  };
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${colors[status] ?? colors.ignored}`}>{status}</span>;
}

function LogStatusIcon({ status }: { status: string }) {
  if (status === 'healthy') return <i className="ri-check-line text-emerald-400 w-4 h-4 flex items-center justify-center"></i>;
  if (status === 'warning') return <i className="ri-error-warning-line text-amber-400 w-4 h-4 flex items-center justify-center"></i>;
  if (status === 'failed') return <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center"></i>;
  return <i className="ri-question-line text-foreground-400 w-4 h-4 flex items-center justify-center"></i>;
}

function fmtAgo(s: string): string {
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}