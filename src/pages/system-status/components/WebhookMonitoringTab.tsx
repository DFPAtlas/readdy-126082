import { useState } from 'react';
import type { WebhookMonitor, Project } from '../types';

interface Props {
  webhooks: WebhookMonitor[];
  projects: Project[];
  onRefresh: () => void;
}

export default function WebhookMonitoringTab({ webhooks, projects, onRefresh }: Props) {
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const getProjectName = (pid: number) => projects.find(p => p.id === pid)?.project_name ?? '';

  const filtered = webhooks.filter(w => {
    if (filterProject !== 'all' && w.project_id !== Number(filterProject)) return false;
    if (filterProvider !== 'all' && w.provider !== filterProvider) return false;
    if (filterStatus !== 'all' && w.status !== filterStatus) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'failed' && b.status !== 'failed') return -1;
    if (b.status === 'failed' && a.status !== 'failed') return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Providers</option>
          <option value="stripe">Stripe</option>
          <option value="supabase">Supabase</option>
          <option value="n8n">n8n</option>
          <option value="readdy">Readdy</option>
          <option value="custom">Custom</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50">
          <option value="all">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="failed">Failed</option>
          <option value="paused">Paused</option>
        </select>
        <button onClick={onRefresh} className="ml-auto bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1">
          <i className="ri-refresh-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i> Run All Checks
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-foreground-500">No webhooks found</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/60">
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Webhook</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Project</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Provider</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Purpose</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Status</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Failures</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Last Received</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Last Success</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(w => (
                <tr key={w.id} className={`border-b border-background-200/40 hover:bg-background-200/30 transition-colors ${w.status === 'failed' ? 'bg-red-500/5' : ''}`}>
                  <td className="px-3 py-2.5 text-foreground-100 font-medium">{w.webhook_name}</td>
                  <td className="px-3 py-2.5 text-foreground-400">{getProjectName(w.project_id)}</td>
                  <td className="px-3 py-2.5"><span className="text-[10px] font-label text-foreground-400 bg-background-200/60 px-1.5 py-0.5 rounded capitalize">{w.provider}</span></td>
                  <td className="px-3 py-2.5 text-foreground-400 max-w-[200px] truncate">{w.purpose ?? '-'}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={w.status} /></td>
                  <td className="px-3 py-2.5"><span className={`font-mono text-xs ${w.failure_count_today > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{w.failure_count_today}</span></td>
                  <td className="px-3 py-2.5 text-foreground-400 text-xs whitespace-nowrap">{fmtAgo(w.last_received_at)}</td>
                  <td className="px-3 py-2.5 text-foreground-400 text-xs whitespace-nowrap">{fmtAgo(w.last_success_at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {w.webhook_url && (
                        <button onClick={() => navigator.clipboard.writeText(w.webhook_url!)} className="px-2 py-1 text-[10px] text-foreground-400 hover:text-foreground-200 rounded transition-colors cursor-pointer whitespace-nowrap">
                          Copy URL
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: 'text-emerald-400 bg-emerald-500/10', warning: 'text-amber-400 bg-amber-500/10', failed: 'text-red-400 bg-red-500/10', paused: 'text-foreground-400 bg-foreground-500/10', unknown: 'text-foreground-400 bg-foreground-500/10',
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