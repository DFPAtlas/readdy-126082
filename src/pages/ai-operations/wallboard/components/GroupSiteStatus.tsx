import { Link } from 'react-router-dom';
import { getWallboardSites, getWallboardStatus } from '@/pages/ai-operations/wallboard/selectors';
import UnavailableState from '@/pages/ai-operations/wallboard/components/UnavailableState';
import { SITE_STATUS, AI_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function GroupSiteStatus() {
  const sites = getWallboardSites();
  const status = getWallboardStatus().sites;

  return (
    <section className="h-full bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Group Site Status</h3>
        <span className="text-xs font-label text-foreground-600">{sites.length} sites</span>
      </div>

      {status === 'live' ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3 overflow-y-auto">
        {sites.map((site) => {
          const op = SITE_STATUS[site.operationalStatus];
          const ai = AI_STATUS[site.aiStatus];
          return (
            <Link
              key={site.id}
              to={`/ai-operations/sites/${site.id}`}
              className="bg-background-50 border border-background-200/40 rounded-lg p-3.5 hover:border-background-300/60 transition-colors duration-150 cursor-pointer block"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-medium text-foreground-100 leading-tight">{site.name}</p>
                <StatusPill tone={op.tone} label={op.label} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">AI</span>
                <StatusPill tone={ai.tone} label={ai.label} />
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                <div className="bg-background-100 border border-background-200/40 rounded-md py-2">
                  <p className="text-xl font-heading font-bold text-foreground-100">{site.activeAgents}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Agents</p>
                </div>
                <div className="bg-background-100 border border-background-200/40 rounded-md py-2">
                  <p className="text-xl font-heading font-bold text-foreground-100">{site.activeRuns}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Runs</p>
                </div>
                <div className="bg-background-100 border border-background-200/40 rounded-md py-2">
                  <p className={`text-xl font-heading font-bold ${site.alerts > 0 ? 'text-amber-400' : 'text-foreground-100'}`}>{site.alerts}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Alerts</p>
                </div>
                <div className="bg-background-100 border border-background-200/40 rounded-md py-2">
                  <p className={`text-xl font-heading font-bold ${site.failedRuns > 0 ? 'text-red-400' : 'text-foreground-100'}`}>{site.failedRuns}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failed</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] font-label text-foreground-500">
                <span className="whitespace-nowrap">
                  Approvals · <span className={site.pendingApprovals > 0 ? 'text-amber-400' : 'text-foreground-300'}>{site.pendingApprovals}</span>
                </span>
                <span className="whitespace-nowrap text-foreground-600">Act. {site.lastActivity}</span>
              </div>
            </Link>
          );
        })}
      </div>
      ) : (
        <UnavailableState label="Site registry unavailable." />
      )}
    </section>
  );
}