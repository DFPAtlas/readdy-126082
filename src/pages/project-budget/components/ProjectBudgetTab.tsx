import { useState } from 'react';
import type { ProjectBudget, CostItem, RecurringCost, Project } from '../types';
import { BUDGET_STATUS_COLORS, BUDGET_TYPE_LABELS } from '../types';

interface Props {
  budgets: ProjectBudget[];
  costItems: CostItem[];
  recurringCosts: RecurringCost[];
  projects: Project[];
  getProjectName: (id: number | null) => string;
  onAddCost: (budget: ProjectBudget) => void;
  onAddRecurring: (budget: ProjectBudget) => void;
  onEditBudget: (budget: ProjectBudget) => void;
  onRefresh: () => void;
}

export default function ProjectBudgetTab({ budgets, costItems, recurringCosts, projects, getProjectName, onAddCost, onAddRecurring, onEditBudget, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');

  const owners = [...new Set(budgets.map((b) => b.owner).filter(Boolean))] as string[];

  const filtered = budgets.filter((b) => {
    const projectName = getProjectName(b.project_id).toLowerCase();
    const budgetName = b.budget_name.toLowerCase();
    const q = search.toLowerCase();
    if (q && !projectName.includes(q) && !budgetName.includes(q)) return false;
    if (statusFilter !== 'all' && b.budget_status !== statusFilter) return false;
    if (typeFilter !== 'all' && b.budget_type !== typeFilter) return false;
    if (ownerFilter !== 'all' && b.owner !== ownerFilter) return false;
    return true;
  });

  const getSpendPercent = (b: ProjectBudget) => {
    if (b.approved_budget <= 0) return 0;
    return Math.min((b.actual_spend / b.approved_budget) * 100, 100);
  };

  const getSpendColor = (pct: number) => {
    if (pct >= 100) return 'bg-red-400';
    if (pct >= 75) return 'bg-amber-400';
    return 'bg-emerald-400';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects or budgets..."
            className="w-full pl-9 pr-3 py-2 bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Types</option>
          <option value="internal_project">Internal</option>
          <option value="client_project">Client</option>
          <option value="saas_platform">SaaS</option>
          <option value="ai_agent">AI Agent</option>
          <option value="marketing_campaign">Marketing</option>
          <option value="infrastructure">Infra</option>
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-400">No budgets match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((budget) => {
            const budgetRecurring = recurringCosts.filter((r) => r.budget_id === budget.id && r.status === 'active');
            const monthlyTotal = budgetRecurring.reduce((s, r) => s + r.monthly_cost, 0);
            const spendPct = getSpendPercent(budget);

            return (
              <div key={budget.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground-200 truncate">{budget.budget_name}</h4>
                    <p className="text-xs text-foreground-500 mt-0.5">{getProjectName(budget.project_id)}</p>
                  </div>
                  <span className={`text-[10px] font-label px-2 py-0.5 rounded ${BUDGET_STATUS_COLORS[budget.budget_status]} whitespace-nowrap uppercase`}>{budget.budget_status}</span>
                </div>

                {/* Spend progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] text-foreground-500 mb-1">
                    <span>£{budget.actual_spend.toLocaleString()} / £{budget.approved_budget.toLocaleString()}</span>
                    <span>{Math.round(spendPct)}%</span>
                  </div>
                  <div className="h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getSpendColor(spendPct)}`} style={{ width: `${Math.max(spendPct, 2)}%` }}></div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-xs">
                  <div><span className="text-foreground-600">Remaining</span><p className="text-foreground-200 font-medium">£{budget.remaining_budget.toLocaleString()}</p></div>
                  <div><span className="text-foreground-600">Monthly Run</span><p className="text-foreground-200 font-medium">£{monthlyTotal.toLocaleString()}</p></div>
                  <div><span className="text-foreground-600">Profit/mo</span><p className="text-emerald-400 font-medium">£{budget.forecast_profit_monthly.toLocaleString()}</p></div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[10px] font-label px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-400">{BUDGET_TYPE_LABELS[budget.budget_type] || budget.budget_type}</span>
                  {budget.target_launch_date && (
                    <span className="text-[10px] text-foreground-600">Launch: {new Date(budget.target_launch_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-background-200/40">
                  <button onClick={() => onAddCost(budget)} className="text-[11px] bg-background-200/50 hover:bg-background-200/80 text-foreground-300 px-2.5 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-add-line text-xs w-3 h-3 flex items-center justify-center mr-1"></i>Add Cost
                  </button>
                  <button onClick={() => onAddRecurring(budget)} className="text-[11px] bg-background-200/50 hover:bg-background-200/80 text-foreground-300 px-2.5 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-repeat-line text-xs w-3 h-3 flex items-center justify-center mr-1"></i>Add Recurring
                  </button>
                  <button onClick={() => onEditBudget(budget)} className="text-[11px] bg-background-200/50 hover:bg-background-200/80 text-foreground-300 px-2.5 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-edit-line text-xs w-3 h-3 flex items-center justify-center mr-1"></i>Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}