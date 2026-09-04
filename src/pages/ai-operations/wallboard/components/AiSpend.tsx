import { getWallboardSpend, getWallboardStatus } from '@/pages/ai-operations/wallboard/selectors';
import UnavailableState from '@/pages/ai-operations/wallboard/components/UnavailableState';
import { BUDGET_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AiSpend() {
  const status = getWallboardStatus().costs;
  const spend = getWallboardSpend();
  const budget = BUDGET_STATUS[spend.budgetStatus as keyof typeof BUDGET_STATUS];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Spend Today</h3>
        <StatusPill tone={budget.tone} label={budget.label} />
      </div>

      {status === 'live' ? (
      <div className="px-4 py-3">
        <p className="text-3xl font-heading font-bold text-foreground-100 tabular-nums">{spend.total}</p>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground-500">Highest-cost site</span>
            <span className="text-foreground-200 font-medium">{spend.highestSite}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-500">Highest-cost model</span>
            <span className="text-foreground-200 font-medium">{spend.highestModel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground-500">Budget status</span>
            <span className="text-foreground-200 font-medium">{spend.budgetStatusLabel}</span>
          </div>
        </div>
      </div>
      ) : (
        <UnavailableState label="Cost data unavailable." />
      )}
    </section>
  );
}