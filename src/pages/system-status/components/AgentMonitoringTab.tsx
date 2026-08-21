import { useState } from 'react';
import type { AgentMonitor, Project } from '../types';

interface Props {
  agents: AgentMonitor[];
  projects: Project[];
  onRefresh: () => void;
}

export default function AgentMonitoringTab({ agents, projects, onRefresh }: Props) {
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const getProjectName = (pid: number) => projects.find(p => p.id === pid)?.project_name ?? '';

  const filtered = agents.filter(a => {
    if (filterProject !== 'all' && a.project_id !== Number(filterProject)) return false;
    if (filterType !== 'all' && a.agent_type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Types</option>
          <option value="n8n">n8n</option>
          <option value="ai">AI</option>
          <option value="cron">Cron</option>
          <option value="webhook">Webhook</option>
          <option value="manual">Manual</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="running">Running</option>
          <option value="warning">Warning</option>
          <option value="failed">Failed</option>
          <option value="paused">Paused</option>
        </select>
        <button onClick={onRefresh} className="ml-auto bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1">
          <i className="ri-refresh-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i> Run All Checks
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-foreground-500">No agents found</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id} className={`bg-background-50 border rounded-lg p-4 ${a.status === 'failed' ? 'border-red-500/30' : 'border-background-200/60'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-heading font-semibold text-foreground-100">{a.agent_name}</h4>
                <AgentStatusBadge status={a.status} />
              </div>
              <div className="text-[10px] text-foreground-500 space-y-1 mb-3">
                <div className="flex justify-between"><span>Project</span><span className="text-foreground-300">{getProjectName(a.project_id)}</span></div>
                <div className="flex justify-between"><span>Type</span><span className="text-foreground-300 capitalize">{a.agent_type}</span></div>
                <div className="flex justify-between"><span>Last Run</span><span className="text-foreground-300">{fmtAgo(a.last_run_at)}</span></div>
                <div className="flex justify-between"><span>Last Success</span><span className="text-foreground-300">{fmtAgo(a.last_success_at)}</span></div>
                <div className="flex justify-between"><span>Runs Today</span><span className="text-foreground-100 font-mono">{a.run_count_today}</span></div>
                <div className="flex justify-between"><span>Failures Today</span><span className={`font-mono ${a.failure_count_today > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{a.failure_count_today}</span></div>
                {a.average_runtime_ms && <div className="flex justify-between"><span>Avg Runtime</span><span className="text-foreground-100 font-mono">{a.average_runtime_ms}ms</span></div>}
              </div>
              {a.last_error_message && (
                <p className="text-[10px] text-red-400 bg-red-500/5 rounded px-2 py-1 mb-2 line-clamp-2">{a.last_error_message}</p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={onRefresh} className="px-2 py-1 text-[10px] text-accent-400 bg-accent-500/10 hover:bg-accent-500/15 rounded transition-colors whitespace-nowrap cursor-pointer">Check Now</button>
                {a.webhook_url && (
                  <button onClick={() => navigator.clipboard.writeText(a.webhook_url!)} className="px-2 py-1 text-[10px] text-foreground-400 hover:text-foreground-200 rounded transition-colors cursor-pointer whitespace-nowrap">
                    Copy Webhook
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: 'text-emerald-400 bg-emerald-500/10', running: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-400 bg-amber-500/10', failed: 'text-red-400 bg-red-500/10',
    paused: 'text-foreground-400 bg-foreground-500/10', unknown: 'text-foreground-400 bg-foreground-500/10',
  };
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${colors[status] ?? colors.unknown}`}>{status}</span>;
}

function fmtAgo(s: string | null): string {
  if (!s) return 'never';
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}