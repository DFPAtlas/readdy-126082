import { Link } from 'react-router-dom';
import type { SiteAiStatusRow } from '@/pages/ai-operations/types';
import { SITE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function GroupSiteStatus({ sites }: { sites: SiteAiStatusRow[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Group Site AI Status</h3>
        <span className="text-xs font-label text-foreground-600">{sites.length} sites</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-center">Agents</th>
              <th className="px-4 py-2.5 font-medium text-center">Jobs</th>
              <th className="px-4 py-2.5 font-medium text-center">Failed</th>
              <th className="px-4 py-2.5 font-medium text-center">Alerts</th>
              <th className="px-4 py-2.5 font-medium">Last Activity</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => {
              const display = SITE_STATUS[site.status];
              return (
                <tr key={site.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground-200 whitespace-nowrap">{site.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={display.tone} label={display.label} pulse={site.status === 'critical'} />
                  </td>
                  <td className="px-4 py-3 text-center text-foreground-300 font-label">{site.activeAgents}</td>
                  <td className="px-4 py-3 text-center text-foreground-300 font-label">{site.currentJobs}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-label ${site.failedJobs > 0 ? 'text-red-400 font-medium' : 'text-foreground-600'}`}>{site.failedJobs}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-label ${site.alerts > 0 ? 'text-amber-400 font-medium' : 'text-foreground-600'}`}>{site.alerts}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{site.lastActivity}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/sites/${site.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      Open AI Ops
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}