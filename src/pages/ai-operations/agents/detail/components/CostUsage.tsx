import { Link } from 'react-router-dom';
import { getAgentCost } from '@/pages/ai-operations/costs/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { BUDGET_STATUS } from '@/pages/ai-operations/constants';

export default function CostUsage({ agentId }: { agentId: string }) {
  const cost = getAgentCost(agentId);

  return (
    <section aria-label="Cost and usage" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Cost &amp; Usage</h3>
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
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Jobs</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.jobs}</p>
            </div>
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Cost today</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.costToday}</p>
            </div>
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Monthly</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.monthlyCost}</p>
            </div>
            <div className="p-3 rounded-md bg-background-50 border border-background-200/50">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Avg / run</p>
              <p className="text-sm font-heading font-semibold text-foreground-100 mt-1">{cost.avgCostPerRun}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-500">Budget status</span>
            <StatusPill tone={BUDGET_STATUS[cost.budgetStatus].tone} label={BUDGET_STATUS[cost.budgetStatus].label} />
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground-500">No cost record available for this agent yet.</p>
      )}
    </section>
  );
}