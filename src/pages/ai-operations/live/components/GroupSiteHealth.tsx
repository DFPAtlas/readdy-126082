import { Link } from 'react-router-dom';
import { getSiteHealth } from '@/pages/ai-operations/live/selectors';
import { SITE_STATUS, AI_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function GroupSiteHealth() {
  const sites = getSiteHealth();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Group Site Health</h3>
        <span className="text-xs font-label text-foreground-600">{sites.length} sites</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sites.map((site) => {
          const op = SITE_STATUS[site.operationalStatus];
          const ai = AI_STATUS[site.aiStatus];
          return (
            <Link
              key={site.id}
              to={`/ai-operations/sites/${site.id}`}
              className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150 cursor-pointer block"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground-200">{site.name}</p>
                <StatusPill tone={op.tone} label={op.label} pulse={site.operationalStatus === 'critical'} />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">AI:</span>
                <StatusPill tone={ai.tone} label={ai.label} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-background-50 border border-background-200/40 rounded-md py-1.5">
                  <p className="text-sm font-heading font-bold text-foreground-200">{site.activeAgents}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Agents</p>
                </div>
                <div className="bg-background-50 border border-background-200/40 rounded-md py-1.5">
                  <p className="text-sm font-heading font-bold text-foreground-200">{site.activeRuns}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Running</p>
                </div>
                <div className="bg-background-50 border border-background-200/40 rounded-md py-1.5">
                  <p className={`text-sm font-heading font-bold ${site.failedRuns > 0 ? 'text-red-400' : 'text-foreground-200'}`}>{site.failedRuns}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failed</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-label text-foreground-500">
                <span className="whitespace-nowrap">Queued · <span className="text-foreground-300">{site.queuedRuns}</span></span>
                <span className="whitespace-nowrap">
                  Approvals · <span className={site.pendingApprovals > 0 ? 'text-amber-400' : 'text-foreground-300'}>{site.pendingApprovals}</span>
                </span>
                <span className="whitespace-nowrap">
                  Alerts · <span className={site.alerts > 0 ? 'text-amber-400' : 'text-foreground-300'}>{site.alerts}</span>
                </span>
              </div>
              <p className="mt-2 text-[10px] font-label text-foreground-600">Last activity {site.lastActivity}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}