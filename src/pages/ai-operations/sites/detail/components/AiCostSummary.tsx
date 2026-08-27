import { Link } from 'react-router-dom';
import { getSiteCost } from '@/pages/ai-operations/costs/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { BUDGET_STATUS } from '@/pages/ai-operations/constants';

export default function AiCostSummary({ siteId }: { siteId: string }) {
  const cost = getSiteCost(siteId);

  return (
    <section aria-label="AI cost summary" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">AI Cost</h3>
        <Link
          to="/ai-operations/costs"
          className="text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          Open Cost module
        </Link>
      </div>

      {cost ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Today</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.today}</p>
            </div>
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">This month</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.thisMonth}</p>
            </div>
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Budget</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.budget}</p>
            </div>
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Remaining</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.remaining}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-500">Budget status</span>
            <StatusPill tone={BUDGET_STATUS[cost.budgetStatus].tone} label={BUDGET_STATUS[cost.budgetStatus].label} />
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground-500">No cost record available for this site yet.</p>
      )}
    </section>
  );
}