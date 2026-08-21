import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { MonitoredWebsite, Project } from '../types';

interface Props {
  websites: MonitoredWebsite[];
  projects: Project[];
  onRefresh: () => void;
}

export default function WebsiteMonitoringTab({ websites, projects, onRefresh }: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterEnv, setFilterEnv] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const runWebsiteCheck = async (website: MonitoredWebsite) => {
    setCheckingIds(prev => new Set(prev).add(website.id));
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('internal-monitoring-run-check', {
        body: {
          check_type: 'website',
          target_url: website.url,
          monitor_id: website.id,
          project_id: website.project_id,
        },
      });
      if (fnErr || data?.code !== 'OK') throw new Error(fnErr?.message ?? 'Check failed');
      showToast(`${website.website_name}: ${data.data.message}`, data.data.status === 'failed' ? 'error' : 'success');
    } catch (e: any) {
      showToast(`${website.website_name}: ${e.message}`, 'error');
    } finally {
      setCheckingIds(prev => { const next = new Set(prev); next.delete(website.id); return next; });
    }
  };

  const runAllChecks = async () => {
    setRunAllLoading(true);
    const results: string[] = [];
    for (const website of websites) {
      try {
        const { data } = await supabase.functions.invoke('internal-monitoring-run-check', {
          body: {
            check_type: 'website',
            target_url: website.url,
            monitor_id: website.id,
            project_id: website.project_id,
          },
        });
        if (data?.code === 'OK') {
          results.push(`${website.website_name}: ${data.data.status}`);
        }
      } catch { results.push(`${website.website_name}: failed`); }
    }
    const failed = results.filter(r => r.includes('failed') || r.includes('error') || r.includes('offline')).length;
    const ok = results.length - failed;
    showToast(
      failed > 0 ? `${ok} healthy, ${failed} failed` : `All ${ok} websites healthy`,
      failed > 0 ? 'error' : 'success'
    );
    setRunAllLoading(false);
    onRefresh();
  };

  const filtered = websites.filter(w => {
    if (filterProject !== 'all' && w.project_id !== Number(filterProject)) return false;
    if (filterEnv !== 'all' && w.environment !== filterEnv) return false;
    if (filterStatus !== 'all' && w.status !== filterStatus) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const order = { offline: 0, error: 0, slow: 1, warning: 1, online: 2, healthy: 2, unknown: 3 };
    return (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4);
  });

  const getProjectName = (pid: number) => projects.find(p => p.id === pid)?.project_name ?? '';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50"
        >
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <select
          value={filterEnv}
          onChange={e => setFilterEnv(e.target.value)}
          className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50"
        >
          <option value="all">All Environments</option>
          <option value="live">Live</option>
          <option value="staging">Staging</option>
          <option value="demo">Demo</option>
          <option value="local">Local</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-1.5 text-sm text-foreground-200 cursor-pointer outline-none focus:border-accent-500/50"
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="slow">Slow</option>
          <option value="offline">Offline</option>
          <option value="error">Error</option>
          <option value="unknown">Unknown</option>
        </select>

        <div className="ml-auto flex items-center gap-1 bg-background-50 border border-background-200/60 rounded-full p-0.5">
          <button
            onClick={() => setViewMode('card')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer ${viewMode === 'card' ? 'bg-accent-500/10 text-accent-400' : 'text-foreground-400 hover:text-foreground-200'}`}
          >
            <i className="ri-layout-grid-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-accent-500/10 text-accent-400' : 'text-foreground-400 hover:text-foreground-200'}`}
          >
            <i className="ri-list-check w-3.5 h-3.5 flex items-center justify-center"></i>
          </button>
        </div>
        <button
          onClick={runAllChecks}
          disabled={runAllLoading}
          className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 hover:text-foreground-100 text-sm px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={`${runAllLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
          {runAllLoading ? 'Checking All...' : 'Run All Checks'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message="No websites found matching filters" />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map(w => (
            <WebsiteCard key={w.id} website={w} projectName={getProjectName(w.project_id)} onRefresh={onRefresh} onCheck={runWebsiteCheck} isChecking={checkingIds.has(w.id)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/60">
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Website</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Project</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Env</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Status</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Code</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Response</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">SSL</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Last Checked</th>
                <th className="text-left text-[10px] font-label text-foreground-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(w => (
                <tr key={w.id} className={`border-b border-background-200/40 hover:bg-background-200/30 transition-colors ${w.status === 'offline' || w.status === 'error' ? 'bg-red-500/5' : ''}`}>
                  <td className="px-3 py-2.5 text-foreground-100 font-medium">{w.website_name}</td>
                  <td className="px-3 py-2.5 text-foreground-400">{getProjectName(w.project_id)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-label text-foreground-400 bg-background-200/60 px-1.5 py-0.5 rounded capitalize">{w.environment}</span>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={w.status} /></td>
                  <td className="px-3 py-2.5 text-foreground-400 font-mono text-xs">{w.last_status_code ?? '-'}</td>
                  <td className="px-3 py-2.5 text-foreground-400 font-mono text-xs">{w.last_response_time_ms ? `${w.last_response_time_ms}ms` : '-'}</td>
                  <td className="px-3 py-2.5"><SSLIcon status={w.ssl_status} /></td>
                  <td className="px-3 py-2.5 text-foreground-500 text-xs whitespace-nowrap">{formatTimeAgo(w.last_checked_at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => runWebsiteCheck(w)} disabled={checkingIds.has(w.id)} className="px-2 py-1 text-[10px] text-accent-400 bg-accent-500/10 hover:bg-accent-500/15 rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5">
                        {checkingIds.has(w.id) ? <i className="ri-loader-4-line animate-spin w-3 h-3 flex items-center justify-center"></i> : null}
                        {checkingIds.has(w.id) ? '...' : 'Check'}
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(w.url); }}
                        className="px-1.5 py-1 text-[10px] text-foreground-400 hover:text-foreground-200 rounded transition-colors cursor-pointer"
                        title="Copy URL"
                      >
                        <i className="ri-file-copy-line w-3 h-3 flex items-center justify-center"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
          <div className="flex items-center gap-2">
            <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-close-line'} w-4 h-4 flex items-center justify-center`}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

function WebsiteCard({ website, projectName, onRefresh, onCheck, isChecking }: { website: MonitoredWebsite; projectName: string; onRefresh: () => void; onCheck: (w: MonitoredWebsite) => void; isChecking: boolean }) {
  return (
    <div className={`bg-background-50 border rounded-lg p-3.5 transition-colors ${website.status === 'offline' || website.status === 'error' ? 'border-red-500/30' : 'border-background-200/60 hover:border-background-300/60'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${website.status === 'online' ? 'bg-emerald-400' : website.status === 'slow' ? 'bg-amber-400' : website.status === 'offline' || website.status === 'error' ? 'bg-red-400' : 'bg-foreground-400'}`}></div>
          <h4 className="text-sm font-heading font-semibold text-foreground-100 truncate">{website.website_name}</h4>
        </div>
        <StatusBadge status={website.status} />
      </div>
      <div className="text-[10px] text-foreground-500 space-y-1 mb-2">
        <div className="flex justify-between"><span>Project</span><span className="text-foreground-300">{projectName}</span></div>
        <div className="flex justify-between"><span>Env</span><span className="text-foreground-300 capitalize">{website.environment}</span></div>
        <div className="flex justify-between"><span>URL</span><span className="text-foreground-300 truncate ml-2 max-w-[180px]">{website.url}</span></div>
        {website.last_status_code && <div className="flex justify-between"><span>Status Code</span><span className={`font-mono ${website.last_status_code >= 400 ? 'text-red-400' : 'text-emerald-400'}`}>{website.last_status_code}</span></div>}
        {website.last_response_time_ms && <div className="flex justify-between"><span>Response</span><span className={`font-mono ${website.last_response_time_ms > 350 ? 'text-amber-400' : 'text-emerald-400'}`}>{website.last_response_time_ms}ms</span></div>}
        <div className="flex justify-between"><span>SSL</span><SSLIcon status={website.ssl_status} /></div>
        <div className="flex justify-between"><span>Last Checked</span><span>{formatTimeAgo(website.last_checked_at)}</span></div>
      </div>
      {website.notes && <p className="text-[10px] text-foreground-400 mb-2 line-clamp-2">{website.notes}</p>}
      <div className="flex items-center gap-1.5">
        <button onClick={() => onCheck(website)} disabled={isChecking} className="px-2 py-1 text-[10px] font-label text-accent-400 bg-accent-500/10 hover:bg-accent-500/15 rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
          {isChecking ? <i className="ri-loader-4-line animate-spin w-3 h-3 flex items-center justify-center"></i> : null}
          {isChecking ? 'Checking...' : 'Check Now'}
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(website.url); }}
          className="px-2 py-1 text-[10px] font-label text-foreground-400 hover:text-foreground-200 rounded transition-colors cursor-pointer whitespace-nowrap"
        >
          Copy URL
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'text-emerald-400 bg-emerald-500/10',
    healthy: 'text-emerald-400 bg-emerald-500/10',
    slow: 'text-amber-400 bg-amber-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    offline: 'text-red-400 bg-red-500/10',
    error: 'text-red-400 bg-red-500/10',
    failed: 'text-red-400 bg-red-500/10',
    unknown: 'text-foreground-400 bg-foreground-500/10',
  };
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${colors[status] ?? colors.unknown}`}>{status}</span>;
}

function SSLIcon({ status }: { status: string }) {
  if (status === 'valid') return <span className="text-emerald-400 font-mono text-xs">Valid</span>;
  if (status === 'expiring') return <span className="text-amber-400 font-mono text-xs">Expiring</span>;
  if (status === 'expired') return <span className="text-red-400 font-mono text-xs">Expired</span>;
  return <span className="text-foreground-400 font-mono text-xs">Unknown</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
        <i className="ri-global-line text-xl text-foreground-500 w-5 h-5 flex items-center justify-center"></i>
      </div>
      <p className="text-sm text-foreground-500">{message}</p>
    </div>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}