import { useState } from 'react';
import type { SupabaseMonitor, Project } from '../types';

interface Props {
  monitors: SupabaseMonitor[];
  projects: Project[];
  onRefresh: () => void;
}

export default function SupabaseMonitoringTab({ monitors, projects, onRefresh }: Props) {
  const [filterProject, setFilterProject] = useState<string>('all');
  const getProjectName = (pid: number) => projects.find(p => p.id === pid)?.project_name ?? '';

  const filtered = monitors.filter(m => filterProject === 'all' || m.project_id === Number(filterProject));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <button onClick={onRefresh} className="ml-auto bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1">
          <i className="ri-refresh-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i> Run All Checks
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-foreground-500">No Supabase monitors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-heading font-semibold text-foreground-100">{m.supabase_project_name}</h4>
                  <p className="text-[10px] text-foreground-500">{getProjectName(m.project_id)}</p>
                </div>
                <OverallBadge statuses={[m.database_status, m.auth_status, m.storage_status, m.edge_functions_status, m.realtime_status]} />
              </div>
              <div className="space-y-1.5 mb-3">
                <ServiceRow label="Database" status={m.database_status} />
                <ServiceRow label="Auth" status={m.auth_status} />
                <ServiceRow label="Storage" status={m.storage_status} />
                <ServiceRow label="Edge Functions" status={m.edge_functions_status} />
                <ServiceRow label="Realtime" status={m.realtime_status} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-foreground-500">
                <span className="flex items-center gap-1"><i className={`w-3 h-3 flex items-center justify-center ${m.anon_key_configured ? 'ri-check-line text-emerald-400' : 'ri-close-line text-red-400'}`}></i>Anon Key</span>
                <span className="flex items-center gap-1"><i className={`w-3 h-3 flex items-center justify-center ${m.service_role_configured ? 'ri-check-line text-emerald-400' : 'ri-close-line text-red-400'}`}></i>Service Role</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-background-200/40">
                <span className="text-[10px] text-foreground-500">Last checked: {fmtAgo(m.last_checked_at)}</span>
                <button onClick={onRefresh} className="px-2 py-1 text-[10px] text-accent-400 bg-accent-500/10 hover:bg-accent-500/15 rounded transition-colors whitespace-nowrap cursor-pointer">Check Now</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceRow({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    healthy: 'text-emerald-400', warning: 'text-amber-400', failed: 'text-red-400', unknown: 'text-foreground-400',
  };
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-foreground-400">{label}</span>
      <span className={`font-medium capitalize ${colors[status] ?? colors.unknown}`}>{status}</span>
    </div>
  );
}

function OverallBadge({ statuses }: { statuses: string[] }) {
  const allHealthy = statuses.every(s => s === 'healthy');
  const anyFailed = statuses.some(s => s === 'failed');
  const anyWarning = statuses.some(s => s === 'warning');

  let color = 'text-emerald-400 bg-emerald-500/10';
  let label = 'Healthy';
  if (anyFailed) { color = 'text-red-400 bg-red-500/10'; label = 'Failed'; }
  else if (anyWarning) { color = 'text-amber-400 bg-amber-500/10'; label = 'Warning'; }

  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${color}`}>{label}</span>;
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