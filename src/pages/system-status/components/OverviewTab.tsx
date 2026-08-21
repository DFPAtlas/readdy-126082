import type { MonitoredWebsite, SupabaseMonitor, EdgeFunctionMonitor, AgentMonitor, WebhookMonitor, MonitoringIncident, Project } from '../types';

interface Props {
  projects: Project[];
  websites: MonitoredWebsite[];
  supabaseMonitors: SupabaseMonitor[];
  edgeFunctions: EdgeFunctionMonitor[];
  agents: AgentMonitor[];
  webhooks: WebhookMonitor[];
  incidents: MonitoringIncident[];
  onRefresh: () => void;
}

export default function OverviewTab({ projects, websites, supabaseMonitors, edgeFunctions, agents, webhooks, incidents, onRefresh }: Props) {
  const getProjectWebsites = (pid: number) => websites.filter(w => w.project_id === pid);
  const getProjectSupabase = (pid: number) => supabaseMonitors.find(s => s.project_id === pid);
  const getProjectEdgeFns = (pid: number) => edgeFunctions.filter(e => e.project_id === pid);
  const getProjectAgents = (pid: number) => agents.filter(a => a.project_id === pid);
  const getProjectWebhooks = (pid: number) => webhooks.filter(w => w.project_id === pid);
  const getProjectIncidents = (pid: number) => incidents.filter(i => i.project_id === pid && i.status !== 'resolved');

  const calcHealthScore = (pid: number): number => {
    let score = 100;
    const pw = getProjectWebsites(pid);
    const ps = getProjectSupabase(pid);
    const pe = getProjectEdgeFns(pid);
    const pa = getProjectAgents(pid);
    const pwh = getProjectWebhooks(pid);
    const pi = getProjectIncidents(pid);

    pw.forEach(w => { if (w.status === 'offline' || w.status === 'error') score -= 15; else if (w.status === 'slow') score -= 5; });
    if (ps) {
      if (ps.database_status === 'failed') score -= 20; else if (ps.database_status === 'warning') score -= 8;
      if (ps.auth_status === 'failed') score -= 10; else if (ps.auth_status === 'warning') score -= 4;
      if (ps.storage_status === 'failed') score -= 8; else if (ps.storage_status === 'warning') score -= 3;
      if (ps.edge_functions_status === 'failed') score -= 12; else if (ps.edge_functions_status === 'warning') score -= 5;
    }
    pe.forEach(e => { if (e.status === 'failed') score -= 8; else if (e.status === 'warning') score -= 3; });
    pa.forEach(a => { if (a.status === 'failed') score -= 10; else if (a.status === 'warning') score -= 4; });
    pwh.forEach(w => { if (w.status === 'failed') score -= 6; else if (w.status === 'warning') score -= 2; });
    pi.forEach(i => { if (i.severity === 'critical') score -= 12; else if (i.severity === 'high') score -= 6; else score -= 3; });

    return Math.max(0, score);
  };

  const getVerdict = (score: number) => {
    if (score >= 90) return { label: 'Healthy', color: 'text-emerald-400 bg-emerald-500/10' };
    if (score >= 75) return { label: 'Warning', color: 'text-amber-400 bg-amber-500/10' };
    if (score >= 50) return { label: 'At Risk', color: 'text-orange-400 bg-orange-500/10' };
    return { label: 'Critical', color: 'text-red-400 bg-red-500/10' };
  };

  const activeProjects = projects.filter(p => getProjectWebsites(p.id).length > 0 || getProjectSupabase(p.id) || getProjectAgents(p.id).length > 0);

  if (activeProjects.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
          <i className="ri-pulse-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No monitored projects</h3>
        <p className="text-sm text-foreground-500">Add websites, agents, or monitors to start tracking health.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {activeProjects.map((project) => {
        const score = calcHealthScore(project.id);
        const verdict = getVerdict(score);
        const pw = getProjectWebsites(project.id);
        const ps = getProjectSupabase(project.id);
        const pe = getProjectEdgeFns(project.id);
        const pa = getProjectAgents(project.id);
        const pwh = getProjectWebhooks(project.id);
        const pi = getProjectIncidents(project.id);
        const liveSite = pw.find(w => w.environment === 'live');

        return (
          <div key={project.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent-400 shrink-0"></div>
                <h3 className="font-heading font-semibold text-sm text-foreground-100">{project.project_name}</h3>
              </div>
              <span className={`text-[10px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${verdict.color}`}>{verdict.label}</span>
            </div>

            {/* Health score bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-foreground-500">Health Score</span>
                <span className="text-sm font-heading font-bold text-foreground-100">{score}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    score >= 90 ? 'bg-emerald-400' : score >= 75 ? 'bg-amber-400' : score >= 50 ? 'bg-orange-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>

            {/* Status rows */}
            <div className="space-y-1.5 mb-3 text-xs">
              {liveSite && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-500">Live Site</span>
                  <StatusBadge status={liveSite.status} />
                </div>
              )}
              {pw.find(w => w.environment === 'staging') && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-500">Staging</span>
                  <StatusBadge status={pw.find(w => w.environment === 'staging')!.status} />
                </div>
              )}
              {ps && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-500">Supabase</span>
                  <StatusBadge status={ps.database_status} />
                </div>
              )}
              {pe.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-500">Edge Functions</span>
                  <StatusBadge status={pe.every(e => e.status === 'healthy') ? 'healthy' : pe.some(e => e.status === 'failed') ? 'failed' : 'warning'} />
                </div>
              )}
              {pa.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-500">Agents</span>
                  <StatusBadge status={pa.every(a => a.status === 'healthy' || a.status === 'running') ? 'healthy' : pa.some(a => a.status === 'failed') ? 'failed' : 'warning'} />
                </div>
              )}
            </div>

            {/* Last checked & open issues */}
            <div className="flex items-center justify-between text-[10px] text-foreground-500 mb-3">
              <span>Last checked: {liveSite?.last_checked_at ? formatTimeAgo(liveSite.last_checked_at) : 'never'}</span>
              <span>Open issues: {pi.length}</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={onRefresh} className="text-[10px] font-label text-accent-400 hover:text-accent-300 bg-accent-500/10 hover:bg-accent-500/15 px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer">
                Run Check
              </button>
              {pi.length > 0 && (
                <span className="text-[10px] font-label text-red-400 bg-red-500/10 px-2 py-1 rounded whitespace-nowrap">
                  {pi.length} issue{pi.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'text-emerald-400 bg-emerald-500/10',
    healthy: 'text-emerald-400 bg-emerald-500/10',
    running: 'text-emerald-400 bg-emerald-500/10',
    slow: 'text-amber-400 bg-amber-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    offline: 'text-red-400 bg-red-500/10',
    error: 'text-red-400 bg-red-500/10',
    failed: 'text-red-400 bg-red-500/10',
    unknown: 'text-foreground-400 bg-foreground-500/10',
    paused: 'text-foreground-400 bg-foreground-500/10',
  };
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${colors[status] ?? colors.unknown}`}>{status}</span>;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}