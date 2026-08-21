import type { ProjectBudget, CostItem, RecurringCost, Project } from '../types';

interface Props {
  budgets: ProjectBudget[];
  costItems: CostItem[];
  recurringCosts: RecurringCost[];
  projects: Project[];
  getProjectName: (id: number | null) => string;
}

export default function BudgetReportsTab({ budgets, costItems, recurringCosts, projects, getProjectName }: Props) {
  const activeBudgets = budgets.filter((b) => b.budget_status === 'active');

  // Over budget projects
  const overBudget = activeBudgets.filter((b) => b.approved_budget > 0 && b.actual_spend > b.approved_budget);

  // Unpaid costs
  const unpaidCosts = costItems.filter((c) => c.payment_status === 'unpaid' && c.cost_status !== 'cancelled');
  const unpaidLaunchCosts = unpaidCosts.filter((c) => c.is_required_for_launch);

  // Recurring by supplier
  const supplierMap: Record<string, { count: number; monthly: number; yearly: number }> = {};
  recurringCosts.filter((r) => r.status === 'active').forEach((r) => {
    const key = r.supplier_name || r.recurring_name;
    if (!supplierMap[key]) supplierMap[key] = { count: 0, monthly: 0, yearly: 0 };
    supplierMap[key].count++;
    supplierMap[key].monthly += r.monthly_cost;
    supplierMap[key].yearly += r.yearly_cost;
  });
  const supplierEntries = Object.entries(supplierMap).sort((a, b) => b[1].monthly - a[1].monthly);

  // Monthly forecast
  const totalMonthlyRecurring = recurringCosts.filter((r) => r.status === 'active').reduce((s, r) => s + r.monthly_cost, 0);
  const totalYearlyRecurring = recurringCosts.filter((r) => r.status === 'active').reduce((s, r) => s + r.yearly_cost, 0);

  const handleCopySummary = async () => {
    let text = '=== DIGITAL FOOTPRINT BUDGET REPORT ===\n\n';
    text += `Active Budgets: ${activeBudgets.length}\n`;
    text += `Total Budgeted: £${activeBudgets.reduce((s, b) => s + b.approved_budget, 0).toLocaleString()}\n`;
    text += `Total Spend: £${activeBudgets.reduce((s, b) => s + b.actual_spend, 0).toLocaleString()}\n`;
    text += `Monthly Recurring: £${totalMonthlyRecurring.toLocaleString()}\n`;
    text += `Yearly Recurring: £${totalYearlyRecurring.toLocaleString()}\n\n`;

    text += '--- PER PROJECT ---\n\n';
    activeBudgets.forEach((b) => {
      const budgetCosts = costItems.filter((c) => c.budget_id === b.id);
      const budgetRecurring = recurringCosts.filter((r) => r.budget_id === b.id && r.status === 'active');
      text += `${getProjectName(b.project_id)}\n`;
      text += `  Budget: £${b.approved_budget.toLocaleString()} | Spend: £${b.actual_spend.toLocaleString()} | Remaining: £${b.remaining_budget.toLocaleString()}\n`;
      text += `  Costs: ${budgetCosts.length} | Recurring: £${budgetRecurring.reduce((s, r) => s + r.monthly_cost, 0).toLocaleString()}/mo\n\n`;
    });

    text += '--- OVER BUDGET ---\n';
    if (overBudget.length === 0) text += 'None — all projects within budget.\n';
    else overBudget.forEach((b) => text += `  ${getProjectName(b.project_id)}: £${(b.actual_spend - b.approved_budget).toLocaleString()} over\n`);

    text += '\n--- UNPAID LAUNCH COSTS ---\n';
    if (unpaidLaunchCosts.length === 0) text += 'None.\n';
    else unpaidLaunchCosts.forEach((c) => text += `  ${getProjectName(c.project_id)} — ${c.cost_name}: £${c.actual_cost || c.estimated_cost}\n`);

    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div>
        <button
          onClick={handleCopySummary}
          className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-sm font-medium px-4 py-2 rounded-full transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
        >
          <i className="ri-file-copy-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Copy Budget Summary
        </button>
      </div>

      {/* Budget Health by project */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-300 uppercase tracking-wide mb-3">Budget Health by Project</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/60">
                <th className="text-left px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Project</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Approved</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Spend</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Remaining</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Spend %</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Cost Items</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Recurring/mo</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Health</th>
              </tr>
            </thead>
            <tbody>
              {activeBudgets.sort((a, b) => {
                const aRatio = a.approved_budget > 0 ? a.actual_spend / a.approved_budget : 0;
                const bRatio = b.approved_budget > 0 ? b.actual_spend / b.approved_budget : 0;
                return bRatio - aRatio;
              }).map((b) => {
                const budgetCosts = costItems.filter((c) => c.budget_id === b.id);
                const budgetRecurring = recurringCosts.filter((r) => r.budget_id === b.id && r.status === 'active');
                const monthlyRun = budgetRecurring.reduce((s, r) => s + r.monthly_cost, 0);
                const pct = b.approved_budget > 0 ? Math.round((b.actual_spend / b.approved_budget) * 100) : 0;

                return (
                  <tr key={b.id} className="border-b border-background-200/40 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-foreground-200 font-medium whitespace-nowrap">{getProjectName(b.project_id)}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground-300 text-right whitespace-nowrap">£{b.approved_budget.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground-200 text-right whitespace-nowrap">£{b.actual_spend.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground-200 text-right whitespace-nowrap">£{b.remaining_budget.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-right whitespace-nowrap">
                      <span className={pct >= 100 ? 'text-red-400 font-medium' : pct >= 75 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>{pct}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground-400 text-right whitespace-nowrap">{budgetCosts.length}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground-400 text-right whitespace-nowrap">£{monthlyRun.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${
                        b.approved_budget <= 0 ? 'bg-sky-500/10 text-sky-400' :
                        pct >= 100 ? 'bg-red-500/10 text-red-400' :
                        pct >= 75 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {b.approved_budget <= 0 ? 'No Budget' : pct >= 100 ? 'Over Budget' : pct >= 75 ? 'Warning' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Over budget */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-300 uppercase tracking-wide mb-3">
          Over Budget Projects
          {overBudget.length > 0 && <span className="ml-2 text-red-400">{overBudget.length}</span>}
        </h3>
        {overBudget.length === 0 ? (
          <p className="text-sm text-emerald-400">All projects within budget!</p>
        ) : (
          overBudget.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2 border-b border-background-200/40 last:border-0 text-sm">
              <span className="text-foreground-200">{getProjectName(b.project_id)}</span>
              <span className="text-red-400 font-medium">£{(b.actual_spend - b.approved_budget).toLocaleString()} over</span>
            </div>
          ))
        )}
      </div>

      {/* Unpaid costs */}
      {unpaidCosts.length > 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-label font-semibold text-foreground-300 uppercase tracking-wide mb-3">
            Unpaid Costs <span className="ml-2 text-amber-400">{unpaidCosts.length}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/60">
                  <th className="text-left px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Cost</th>
                  <th className="text-left px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Project</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Amount</th>
                  <th className="text-left px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Due</th>
                  <th className="text-left px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Launch</th>
                </tr>
              </thead>
              <tbody>
                {unpaidCosts.map((c) => (
                  <tr key={c.id} className="border-b border-background-200/40 last:border-0">
                    <td className="px-3 py-2 text-xs text-foreground-200">{c.cost_name}</td>
                    <td className="px-3 py-2 text-xs text-foreground-400 whitespace-nowrap">{getProjectName(c.project_id)}</td>
                    <td className="px-3 py-2 text-xs text-amber-400 text-right font-medium whitespace-nowrap">£{(c.actual_cost || c.estimated_cost).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-foreground-400 whitespace-nowrap">{c.due_date ? new Date(c.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                    <td className="px-3 py-2">{c.is_required_for_launch ? <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 whitespace-nowrap">YES</span> : <span className="text-[10px] text-foreground-600">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recurring by supplier */}
      {supplierEntries.length > 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-label font-semibold text-foreground-300 uppercase tracking-wide mb-3">Monthly Recurring by Supplier</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/60">
                  <th className="text-left px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Supplier</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Count</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Monthly</th>
                  <th className="text-right px-3 py-2 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Yearly</th>
                </tr>
              </thead>
              <tbody>
                {supplierEntries.map(([name, data]) => (
                  <tr key={name} className="border-b border-background-200/40 last:border-0">
                    <td className="px-3 py-2 text-xs text-foreground-200">{name}</td>
                    <td className="px-3 py-2 text-xs text-foreground-400 text-right whitespace-nowrap">{data.count}</td>
                    <td className="px-3 py-2 text-xs text-foreground-200 text-right font-medium whitespace-nowrap">£{data.monthly.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-foreground-300 text-right whitespace-nowrap">£{data.yearly.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-background-200/60">
                  <td className="px-3 py-2 text-xs text-foreground-200 font-semibold">Total</td>
                  <td className="px-3 py-2 text-xs text-foreground-400 text-right font-semibold whitespace-nowrap">{recurringCosts.filter((r) => r.status === 'active').length}</td>
                  <td className="px-3 py-2 text-xs text-accent-400 text-right font-semibold whitespace-nowrap">£{totalMonthlyRecurring.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-accent-400 text-right font-semibold whitespace-nowrap">£{totalYearlyRecurring.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}