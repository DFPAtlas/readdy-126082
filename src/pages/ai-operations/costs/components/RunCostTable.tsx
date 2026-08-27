import { Link } from 'react-router-dom';
import { getRunCostRows } from '@/pages/ai-operations/costs/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { RUN_STATUS } from '@/pages/ai-operations/constants';

export default function RunCostTable() {
  const rows = getRunCostRows();

  return (
    <section aria-label="Run cost integration" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Run Costs</h3>
        <span className="text-[11px] font-label text-foreground-500">Reuses Tasks &amp; Runs data</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-medium">Run</th>
              <th className="py-2 px-4 font-medium">Site</th>
              <th className="py-2 px-4 font-medium">Agent</th>
              <th className="py-2 px-4 font-medium">Model</th>
              <th className="py-2 px-4 font-medium">Duration</th>
              <th className="py-2 px-4 font-medium">Est. Cost</th>
              <th className="py-2 px-4 font-medium">Tool Cost</th>
              <th className="py-2 px-4 font-medium">Total</th>
              <th className="py-2 pl-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.runId} className="border-b border-background-200/40 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                <td className="py-2.5 pr-4">
                  <Link to={`/ai-operations/runs/${r.runId}`} className="text-foreground-100 font-mono text-xs hover:text-accent-400 transition-colors duration-150 whitespace-nowrap cursor-pointer">
                    {r.runId}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.siteName}</td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.agentName}</td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.model}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.duration}</td>
                <td className="py-2.5 px-4 text-foreground-100">{r.estimatedCost}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.toolCost}</td>
                <td className="py-2.5 px-4 text-foreground-100">{r.totalCost}</td>
                <td className="py-2.5 pl-4">
                  <StatusPill tone={RUN_STATUS[r.status].tone} label={RUN_STATUS[r.status].label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.runId} className="border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link to={`/ai-operations/runs/${r.runId}`} className="text-sm font-mono text-foreground-100 hover:text-accent-400 cursor-pointer">
                {r.runId}
              </Link>
              <StatusPill tone={RUN_STATUS[r.status].tone} label={RUN_STATUS[r.status].label} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground-500">Site</span><span className="text-foreground-300 text-right">{r.siteName}</span>
              <span className="text-foreground-500">Agent</span><span className="text-foreground-300 text-right">{r.agentName}</span>
              <span className="text-foreground-500">Model</span><span className="text-foreground-300 text-right">{r.model}</span>
              <span className="text-foreground-500">Total</span><span className="text-foreground-300 text-right">{r.totalCost}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}