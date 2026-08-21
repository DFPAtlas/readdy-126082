import type { ProjectBudget, RecurringCost, Project } from '../types';
import { BUDGET_TYPE_LABELS } from '../types';

interface Props {
  budgets: ProjectBudget[];
  recurringCosts: RecurringCost[];
  getProjectName: (id: number | null) => string;
  onRefresh: () => void;
  onEditBudget: (budget: ProjectBudget) => void;
}

export default function ProfitForecastTab({ budgets, recurringCosts, getProjectName, onEditBudget }: Props) {
  const activeBudgets = budgets.filter((b) => b.budget_status === 'active' || b.budget_status === 'draft');

  if (activeBudgets.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
        <p className="text-sm text-foreground-400">No project budgets to forecast yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Formula explanation */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">How Profit Is Calculated</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-foreground-400">
          <div className="bg-background-50 rounded p-2.5">
            <p className="text-foreground-200 font-medium mb-1">Monthly Profit</p>
            <code className="text-emerald-400">forecast_monthly_revenue - monthly_recurring_costs</code>
          </div>
          <div className="bg-background-50 rounded p-2.5">
            <p className="text-foreground-200 font-medium mb-1">Yearly Profit</p>
            <code className="text-emerald-400">forecast_yearly_revenue - yearly_recurring_costs</code>
          </div>
        </div>
        <p className="text-[10px] text-foreground-600 mt-2">Revenue values are editable on each budget. Recurring costs are calculated from active subscriptions.</p>
      </div>

      {/* Per-project forecast cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {activeBudgets.map((budget) => {
          const budgetRecurring = recurringCosts.filter((r) => r.budget_id === budget.id && r.status === 'active');
          const monthlyRecurring = budgetRecurring.reduce((s, r) => s + r.monthly_cost, 0);
          const yearlyRecurring = budgetRecurring.reduce((s, r) => s + r.yearly_cost, 0);
          const monthlyProfit = budget.forecast_revenue_monthly - monthlyRecurring;
          const yearlyProfit = budget.forecast_revenue_yearly - yearlyRecurring;
          const breakEvenMonths = monthlyProfit > 0 && budget.actual_spend > 0
            ? Math.ceil(budget.actual_spend / monthlyProfit)
            : null;

          return (
            <div key={budget.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground-200">{getProjectName(budget.project_id)}</h4>
                  <p className="text-[10px] text-foreground-500">{BUDGET_TYPE_LABELS[budget.budget_type] || budget.budget_type}</p>
                </div>
                <button onClick={() => onEditBudget(budget)} className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap">Edit Forecast</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Revenue */}
                <div className="bg-background-50 rounded-lg p-3">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Revenue</span>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-500">Monthly</span>
                      <span className="text-foreground-200 font-medium">£{budget.forecast_revenue_monthly.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-500">Yearly</span>
                      <span className="text-foreground-200 font-medium">£{budget.forecast_revenue_yearly.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Costs */}
                <div className="bg-background-50 rounded-lg p-3">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Recurring Costs</span>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-500">Monthly</span>
                      <span className="text-foreground-200 font-medium">£{monthlyRecurring.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-500">Yearly</span>
                      <span className="text-foreground-200 font-medium">£{yearlyRecurring.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Profit */}
                <div className="bg-background-50 rounded-lg p-3">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Profit</span>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-500">Monthly</span>
                      <span className={`font-medium ${monthlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>£{monthlyProfit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-500">Yearly</span>
                      <span className={`font-medium ${yearlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>£{yearlyProfit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Break-even */}
                <div className="bg-background-50 rounded-lg p-3">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Break-Even</span>
                  <div className="mt-1.5">
                    {breakEvenMonths !== null ? (
                      <>
                        <p className="text-lg font-heading font-bold text-accent-400">{breakEvenMonths} months</p>
                        <p className="text-[10px] text-foreground-600">after £{budget.actual_spend.toLocaleString()} spend</p>
                      </>
                    ) : (
                      <p className="text-xs text-foreground-500">Not enough data</p>
                    )}
                  </div>
                </div>
              </div>

              {/* One-off spend summary */}
              <div className="mt-3 pt-3 border-t border-background-200/40">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-500">One-off build spend</span>
                  <span className="text-foreground-200 font-medium">£{budget.actual_spend.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-foreground-500">Active subscriptions</span>
                  <span className="text-foreground-200 font-medium">{budgetRecurring.length}</span>
                </div>
              </div>

              {/* Simple verdict */}
              <div className="mt-3 pt-2 border-t border-background-200/40">
                {yearlyProfit > 0 && monthlyProfit > 0 ? (
                  <span className="text-[10px] font-label px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">PROFITABLE</span>
                ) : yearlyProfit > 0 || monthlyProfit > 0 ? (
                  <span className="text-[10px] font-label px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">MARGINAL</span>
                ) : (
                  <span className="text-[10px] font-label px-2 py-0.5 rounded bg-red-500/10 text-red-400">NOT PROFITABLE</span>
                )}
                <span className="text-[10px] text-foreground-600 ml-2">Based on current revenue forecasts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}