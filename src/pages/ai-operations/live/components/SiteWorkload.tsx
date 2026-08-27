import { Link } from 'react-router-dom';
import { getSiteWorkload } from '@/pages/ai-operations/live/selectors';

export default function SiteWorkload() {
  const workloads = getSiteWorkload();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Site AI Workload</h3>
        <span className="text-xs font-label text-foreground-600">{workloads.length} sites</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium text-center">Agents</th>
              <th className="px-4 py-2.5 font-medium text-center">Jobs Today</th>
              <th className="px-4 py-2.5 font-medium text-center">Running</th>
              <th className="px-4 py-2.5 font-medium text-center">Queued</th>
              <th className="px-4 py-2.5 font-medium text-center">Failed</th>
              <th className="px-4 py-2.5 font-medium text-center">Approvals</th>
              <th className="px-4 py-2.5 font-medium text-center">Alerts</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost Today</th>
            </tr>
          </thead>
          <tbody>
            {workloads.map((w) => (
              <tr key={w.siteId} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                <td className="px-4 py-2.5">
                  <Link to={`/ai-operations/sites/${w.siteId}`} className="text-foreground-200 hover:text-foreground-50 transition-colors cursor-pointer font-medium whitespace-nowrap">
                    {w.siteName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.activeAgents}</td>
                <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.jobsToday}</td>
                <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.running}</td>
                <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.queued}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`font-label ${w.failed > 0 ? 'text-red-400 font-medium' : 'text-foreground-600'}`}>{w.failed}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`font-label ${w.approvals > 0 ? 'text-amber-400 font-medium' : 'text-foreground-600'}`}>{w.approvals}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`font-label ${w.alerts > 0 ? 'text-amber-400 font-medium' : 'text-foreground-600'}`}>{w.alerts}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-foreground-300 font-label whitespace-nowrap">{w.estimatedCostToday}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}