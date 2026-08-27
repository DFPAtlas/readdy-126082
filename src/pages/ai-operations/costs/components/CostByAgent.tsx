import { Link } from 'react-router-dom';
import { getCostByAgent } from '@/pages/ai-operations/costs/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { BUDGET_STATUS } from '@/pages/ai-operations/constants';

export default function CostByAgent() {
  const rows = getCostByAgent();

  return (
    <section aria-label="Cost by agent" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Cost by Agent</h3>
        <span className="text-[11px] font-label text-foreground-500">This month</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-medium">Agent</th>
              <th className="py-2 px-4 font-medium">Scope</th>
              <th className="py-2 px-4 font-medium">Jobs</th>
              <th className="py-2 px-4 font-medium">Cost Today</th>
              <th className="py-2 px-4 font-medium">Monthly Cost</th>
              <th className="py-2 px-4 font-medium">Avg / Run</th>
              <th className="py-2 pl-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.agentId} className="border-b border-background-200/40 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                <td className="py-2.5 pr-4">
                  <Link to={`/ai-operations/agents/${r.agentId}`} className="text-foreground-100 font-label hover:text-accent-400 transition-colors duration-150 whitespace-nowrap cursor-pointer">
                    {r.agentName}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.site}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.jobs}</td>
                <td className="py-2.5 px-4 text-foreground-100">{r.costToday}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.monthlyCost}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.avgCostPerRun}</td>
                <td className="py-2.5 pl-4">
                  <StatusPill tone={BUDGET_STATUS[r.budgetStatus].tone} label={BUDGET_STATUS[r.budgetStatus].label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.agentId} className="border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link to={`/ai-operations/agents/${r.agentId}`} className="text-sm font-label font-semibold text-foreground-100 hover:text-accent-400 cursor-pointer">
                {r.agentName}
              </Link>
              <StatusPill tone={BUDGET_STATUS[r.budgetStatus].tone} label={BUDGET_STATUS[r.budgetStatus].label} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground-500">Scope</span><span className="text-foreground-300 text-right">{r.site}</span>
              <span className="text-foreground-500">Jobs</span><span className="text-foreground-300 text-right">{r.jobs}</span>
              <span className="text-foreground-500">Cost today</span><span className="text-foreground-300 text-right">{r.costToday}</span>
              <span className="text-foreground-500">Monthly</span><span className="text-foreground-300 text-right">{r.monthlyCost}</span>
              <span className="text-foreground-500">Avg / run</span><span className="text-foreground-300 text-right">{r.avgCostPerRun}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}