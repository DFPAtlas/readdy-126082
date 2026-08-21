import { useState } from 'react';
import type { ProjectBudget, CostItem, RecurringCost, BudgetEvent, Project } from '../types';
import { BUDGET_STATUS_COLORS, BUDGET_TYPE_LABELS, PAYMENT_STATUS_COLORS, COST_STATUS_COLORS } from '../types';

interface Props {
  budgets: ProjectBudget[];
  costItems: CostItem[];
  recurringCosts: RecurringCost[];
  events: BudgetEvent[];
  projects: Project[];
  summary: { totalBudgets: number; totalBudgetedCost: number; totalActualCost: number; totalRemainingBudget: number; monthlyRunningCosts: number; overBudgetProjects: number; forecastMonthlyProfit: number; forecastYearlyProfit: number; unpaidLaunchCosts: number; upcomingPayments: number };
  getProjectName: (id: number | null) => string;
  onEditBudget: (budget: ProjectBudget) => void;
}

export default function BudgetOverviewTab({ budgets, costItems, recurringCosts, projects, summary, getProjectName, onEditBudget }: Props) {
  const [expandedBudget, setExpandedBudget] = useState<number | null>(null);

  const activeBudgets = budgets.filter((b) => b.budget_status === 'active');
  const now = new Date();
  const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const unpaidLaunchItems = costItems.filter((c) => c.is_required_for_launch && c.payment_status !== 'paid' && c.cost_status !== 'cancelled');
  const upcomingRecurring = recurringCosts.filter((r) => {
    if (r.status !== 'active' || !r.next_payment_date) return false;
    const d = new Date(r.next_payment_date);
    return d <= fourteenDays;
  });

  const getBudgetHealth = (budget: ProjectBudget) => {
    if (budget.approved_budget <= 0) return { label: 'No Budget', color: 'text-sky-400', bg: 'bg-sky-500/10' };
    const ratio = budget.actual_spend / budget.approved_budget;
    if (ratio >= 1) return { label: 'Over Budget', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (ratio >= 0.75) return { label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  };

  const getLaunchBlockers = (budget: ProjectBudget) => {
    const blockers: string[] = [];
    const items = costItems.filter((c) => c.budget_id === budget.id);
    const unpaidLaunch = items.filter((c) => c.is_required_for_launch && c.payment_status !== 'paid' && c.cost_status !== 'cancelled');
    if (unpaidLaunch.length > 0) blockers.push(`${unpaidLaunch.length} unpaid launch cost${unpaidLaunch.length > 1 ? 's' : ''}`);
    const requiredRecurring = recurringCosts.filter((r) => r.budget_id === budget.id && r.is_required_for_live_site && r.status !== 'active');
    if (requiredRecurring.length > 0) blockers.push(`${requiredRecurring.length} inactive live-site cost${requiredRecurring.length > 1 ? 's' : ''}`);
    if (budget.approved_budget > 0 && budget.actual_spend > budget.approved_budget) blockers.push('Over budget');
    if (budget.approved_budget <= 0) blockers.push('No approved budget');
    if (budget.target_launch_date) {
      const launchDate = new Date(budget.target_launch_date);
      if (launchDate <= fourteenDays && unpaidLaunch.length > 0) blockers.push('Launch within 14 days + unpaid costs');
    }
    const hasHosting = recurringCosts.some((r) => r.budget_id === budget.id && (r.cost_category === 'Hosting' || r.cost_category === 'AWS'));
    const hasDomain = recurringCosts.some((r) => r.budget_id === budget.id && r.cost_category === 'Domain');
    const hasEmail = recurringCosts.some((r) => r.budget_id === budget.id && r.cost_category === 'Email');
    if (!hasHosting) blockers.push('No hosting recorded');
    if (!hasDomain) blockers.push('No domain recorded');
    if (!hasEmail) blockers.push('No email recorded');
    return blockers;
  };

  if (activeBudgets.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/50 flex items-center justify-center">
          <i className="ri-money-pound-circle-line text-foreground-500 text-xl w-6 h-6 flex items-center justify-center"></i>
        </div>
        <p className="text-sm text-foreground-400 mb-2">No active budgets yet</p>
        <p className="text-xs text-foreground-600">Create a budget from the Project Budgets tab to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Quick overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Total Budgeted</span>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">£{summary.totalBudgetedCost.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Actual Spend</span>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">£{summary.totalActualCost.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Remaining</span>
          <p className="text-lg font-heading font-bold text-emerald-400 mt-1">£{summary.totalRemainingBudget.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Monthly Running</span>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">£{summary.monthlyRunningCosts.toLocaleString()}</p>
        </div>
      </div>

      {/* Budget warnings */}
      {summary.overBudgetProjects > 0 && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-lg px-4 py-3 flex items-start gap-3">
          <i className="ri-alert-line text-red-400 text-base w-5 h-5 flex items-center justify-center mt-0.5"></i>
          <div>
            <p className="text-sm text-red-300 font-medium">{summary.overBudgetProjects} project{summary.overBudgetProjects > 1 ? 's' : ''} over budget</p>
            {summary.unpaidLaunchCosts > 0 && <p className="text-xs text-red-400/70 mt-0.5">{summary.unpaidLaunchCosts} unpaid launch-required cost{summary.unpaidLaunchCosts > 1 ? 's' : ''}</p>}
          </div>
        </div>
      )}

      {/* Unpaid launch items warning */}
      {unpaidLaunchItems.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-4 py-3">
          <div className="flex items-start gap-3">
            <i className="ri-time-line text-amber-400 text-base w-5 h-5 flex items-center justify-center mt-0.5"></i>
            <div>
              <p className="text-sm text-amber-300 font-medium">Unpaid launch-required costs</p>
              <p className="text-xs text-amber-400/70 mt-0.5">Total: £{unpaidLaunchItems.reduce((sum, c) => sum + (c.actual_cost || c.estimated_cost), 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {unpaidLaunchItems.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-amber-300/80 pl-8">
                <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0"></span>
                <span>{getProjectName(c.project_id)} — {c.cost_name}</span>
                <span className="text-amber-400/50">£{c.actual_cost || c.estimated_cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming payments */}
      {upcomingRecurring.length > 0 && (
        <div className="bg-sky-500/5 border border-sky-500/15 rounded-lg px-4 py-3">
          <div className="flex items-start gap-3 mb-2">
            <i className="ri-calendar-check-line text-sky-400 text-base w-5 h-5 flex items-center justify-center mt-0.5"></i>
            <div>
              <p className="text-sm text-sky-300 font-medium">Upcoming payments (next 14 days)</p>
              <p className="text-xs text-sky-400/70 mt-0.5">Total: £{upcomingRecurring.reduce((sum, r) => sum + r.monthly_cost, 0).toLocaleString()}/mo</p>
            </div>
          </div>
          <div className="space-y-1 pl-8">
            {upcomingRecurring.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-sky-300/80">
                <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0"></span>
                <span>{r.recurring_name}</span>
                <span className="text-sky-400/50">£{r.monthly_cost} — {r.next_payment_date ? new Date(r.next_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget cards */}
      <div>
        <h3 className="text-sm font-label font-semibold text-foreground-300 uppercase tracking-wide mb-3">Active Budgets</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeBudgets.map((budget) => {
            const health = getBudgetHealth(budget);
            const blockers = getLaunchBlockers(budget);
            const budgetCosts = costItems.filter((c) => c.budget_id === budget.id);
            const budgetRecurring = recurringCosts.filter((r) => r.budget_id === budget.id);
            const monthlyRecurringTotal = budgetRecurring.filter((r) => r.status === 'active').reduce((s, r) => s + r.monthly_cost, 0);
            const spendPercent = budget.approved_budget > 0 ? Math.min((budget.actual_spend / budget.approved_budget) * 100, 100) : 0;

            return (
              <div key={budget.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground-200 truncate">{budget.budget_name}</h4>
                    <p className="text-xs text-foreground-500 mt-0.5">{getProjectName(budget.project_id)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditBudget(budget)}
                      className="text-[11px] bg-background-200/50 hover:bg-background-200/80 text-foreground-300 px-2 py-1 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                      title="Edit budget"
                    >
                      <i className="ri-edit-line text-xs w-3 h-3 flex items-center justify-center"></i>
                    </button>
                    <span className={`text-[10px] font-label px-2 py-0.5 rounded ${BUDGET_STATUS_COLORS[budget.budget_status]} whitespace-nowrap uppercase`}>{budget.budget_status}</span>
                  </div>
                </div>

                {/* Spend bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-foreground-500 mb-1">
                    <span>£{budget.actual_spend.toLocaleString()} of £{budget.approved_budget.toLocaleString()}</span>
                    <span className={health.color}>{Math.round(spendPercent)}%</span>
                  </div>
                  <div className="h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${spendPercent >= 100 ? 'bg-red-400' : spendPercent >= 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.max(spendPercent, 2)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <span className="text-[10px] text-foreground-600">Remaining</span>
                    <p className="text-sm font-semibold text-foreground-200">£{budget.remaining_budget.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-600">Monthly Run</span>
                    <p className="text-sm font-semibold text-foreground-200">£{monthlyRecurringTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-600">Profit/mo</span>
                    <p className="text-sm font-semibold text-emerald-400">£{budget.forecast_profit_monthly.toLocaleString()}</p>
                  </div>
                </div>

                {/* Health badge */}
                <span className={`inline-block text-[10px] font-label px-2 py-0.5 rounded ${health.bg} ${health.color} mb-2`}>{health.label}</span>

                {/* Blockers */}
                {blockers.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-background-200/40">
                    <p className="text-[10px] font-label text-red-400 uppercase tracking-wide mb-1">Launch Blockers</p>
                    <div className="space-y-0.5">
                      {blockers.map((b, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-red-300/80">
                          <span className="w-1 h-1 rounded-full bg-red-400 shrink-0"></span>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expand button */}
                <button
                  onClick={() => setExpandedBudget(expandedBudget === budget.id ? null : budget.id)}
                  className="mt-3 text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {expandedBudget === budget.id ? 'Hide details' : 'View details'}
                </button>

                {expandedBudget === budget.id && (
                  <div className="mt-3 pt-3 border-t border-background-200/40 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-foreground-600">Revenue/mo</span><p className="text-foreground-200">£{budget.forecast_revenue_monthly.toLocaleString()}</p></div>
                      <div><span className="text-foreground-600">Revenue/yr</span><p className="text-foreground-200">£{budget.forecast_revenue_yearly.toLocaleString()}</p></div>
                      <div><span className="text-foreground-600">Profit/yr</span><p className="text-foreground-200">£{budget.forecast_profit_yearly.toLocaleString()}</p></div>
                      <div><span className="text-foreground-600">Launch Date</span><p className="text-foreground-200">{budget.target_launch_date ? new Date(budget.target_launch_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p></div>
                    </div>
                    {budget.notes && <p className="text-xs text-foreground-500 bg-background-50 rounded p-2">{budget.notes}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-label px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-400">{BUDGET_TYPE_LABELS[budget.budget_type] || budget.budget_type}</span>
                      <span className="text-[10px] text-foreground-600">{budget.costItems?.length ?? budgetCosts.length} costs</span>
                      <span className="text-[10px] text-foreground-600">{budgetRecurring.length} recurring</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}