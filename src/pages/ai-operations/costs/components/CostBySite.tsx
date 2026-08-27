import { Link } from 'react-router-dom';
import { getCostBySite } from '@/pages/ai-operations/costs/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { BUDGET_STATUS } from '@/pages/ai-operations/constants';

export default function CostBySite() {
  const rows = getCostBySite();

  return (
    <section aria-label="Cost by site" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Cost by Site</h3>
        <span className="text-[11px] font-label text-foreground-500">This month</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-medium">Site</th>
              <th className="py-2 px-4 font-medium">Today</th>
              <th className="py-2 px-4 font-medium">This Month</th>
              <th className="py-2 px-4 font-medium">Budget</th>
              <th className="py-2 px-4 font-medium">Remaining</th>
              <th className="py-2 px-4 font-medium">Forecast</th>
              <th className="py-2 pl-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.siteId} className="border-b border-background-200/40 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                <td className="py-2.5 pr-4">
                  <Link to={`/ai-operations/sites/${r.siteId}`} className="text-foreground-100 font-label hover:text-accent-400 transition-colors duration-150 whitespace-nowrap cursor-pointer">
                    {r.siteName}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-foreground-300">{r.today}</td>
                <td className="py-2.5 px-4 text-foreground-100">{r.thisMonth}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.budget}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.remaining}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.forecast}</td>
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
          <div key={r.siteId} className="border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link to={`/ai-operations/sites/${r.siteId}`} className="text-sm font-label font-semibold text-foreground-100 hover:text-accent-400 cursor-pointer">
                {r.siteName}
              </Link>
              <StatusPill tone={BUDGET_STATUS[r.budgetStatus].tone} label={BUDGET_STATUS[r.budgetStatus].label} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground-500">Today</span><span className="text-foreground-300 text-right">{r.today}</span>
              <span className="text-foreground-500">This month</span><span className="text-foreground-300 text-right">{r.thisMonth}</span>
              <span className="text-foreground-500">Budget</span><span className="text-foreground-300 text-right">{r.budget}</span>
              <span className="text-foreground-500">Remaining</span><span className="text-foreground-300 text-right">{r.remaining}</span>
              <span className="text-foreground-500">Forecast</span><span className="text-foreground-300 text-right">{r.forecast}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}