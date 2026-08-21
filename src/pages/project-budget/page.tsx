import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectBudget, CostItem, RecurringCost, BudgetEvent, Project } from './types';
import BudgetOverviewTab from './components/BudgetOverviewTab';
import ProjectBudgetTab from './components/ProjectBudgetTab';
import CostItemsTab from './components/CostItemsTab';
import RecurringCostsTab from './components/RecurringCostsTab';
import ProfitForecastTab from './components/ProfitForecastTab';
import BudgetReportsTab from './components/BudgetReportsTab';
import BudgetModal from './components/BudgetModal';
import CostItemModal from './components/CostItemModal';
import RecurringCostModal from './components/RecurringCostModal';

type TabKey = 'overview' | 'budgets' | 'costs' | 'recurring' | 'forecast' | 'reports';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-3-line' },
  { key: 'budgets', label: 'Project Budgets', icon: 'ri-funds-line' },
  { key: 'costs', label: 'Cost Items', icon: 'ri-money-pound-circle-line' },
  { key: 'recurring', label: 'Recurring Costs', icon: 'ri-repeat-line' },
  { key: 'forecast', label: 'Profit Forecast', icon: 'ri-line-chart-line' },
  { key: 'reports', label: 'Reports', icon: 'ri-bar-chart-2-line' },
];

function SkeletonCard() {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
      <div className="h-3 w-16 bg-background-300/40 rounded mb-3"></div>
      <div className="h-7 w-12 bg-background-300/40 rounded"></div>
    </div>
  );
}

export default function ProjectBudget() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [recurringCosts, setRecurringCosts] = useState<RecurringCost[]>([]);
  const [events, setEvents] = useState<BudgetEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Modal states
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ProjectBudget | null>(null);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [editingCostItem, setEditingCostItem] = useState<CostItem | null>(null);
  const [defaultBudgetForCost, setDefaultBudgetForCost] = useState<number | null>(null);
  const [defaultProjectForCost, setDefaultProjectForCost] = useState<number | null>(null);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [editingRecurringCost, setEditingRecurringCost] = useState<RecurringCost | null>(null);
  const [defaultBudgetForRecurring, setDefaultBudgetForRecurring] = useState<number | null>(null);
  const [defaultProjectForRecurring, setDefaultProjectForRecurring] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [budgetsRes, costsRes, recurringRes, eventsRes, projectsRes] = await Promise.all([
        supabase.from('internal_project_budgets').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_project_cost_items').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_project_recurring_costs').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_project_budget_events').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_projects').select('id,project_name,slug').order('project_name'),
      ]);
      if (budgetsRes.error) throw budgetsRes.error;
      if (costsRes.error) throw costsRes.error;
      if (recurringRes.error) throw recurringRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      setBudgets(budgetsRes.data ?? []);
      setCostItems(costsRes.data ?? []);
      setRecurringCosts(recurringRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setProjects(projectsRes.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getProjectName = (projectId: number | null) => {
    if (!projectId) return '—';
    return projects.find((p) => p.id === projectId)?.project_name ?? '—';
  };

  const computeSummary = () => {
    const active = budgets.filter((b) => b.budget_status === 'active');
    const totalBudgeted = active.reduce((s, b) => s + b.approved_budget, 0);
    const totalActual = active.reduce((s, b) => s + b.actual_spend, 0);
    const totalRemaining = active.reduce((s, b) => s + b.remaining_budget, 0);
    const monthlyRunning = recurringCosts.filter((r) => r.status === 'active').reduce((s, r) => s + r.monthly_cost, 0);
    const overBudget = active.filter((b) => b.approved_budget > 0 && b.actual_spend > b.approved_budget).length;
    const monthlyProfit = active.reduce((s, b) => s + b.forecast_profit_monthly, 0);
    const yearlyProfit = active.reduce((s, b) => s + b.forecast_profit_yearly, 0);
    const unpaidLaunch = costItems.filter((c) => c.is_required_for_launch && c.payment_status !== 'paid' && c.cost_status !== 'cancelled').length;
    const now = new Date();
    const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const upcoming = recurringCosts.filter((r) => r.status === 'active' && r.next_payment_date && new Date(r.next_payment_date) <= fourteenDays).length;

    return { totalBudgets: active.length, totalBudgetedCost: totalBudgeted, totalActualCost: totalActual, totalRemainingBudget: totalRemaining, monthlyRunningCosts: monthlyRunning, overBudgetProjects: overBudget, forecastMonthlyProfit: monthlyProfit, forecastYearlyProfit: yearlyProfit, unpaidLaunchCosts: unpaidLaunch, upcomingPayments: upcoming };
  };

  const handleCopyBudgetFixPrompt = async () => {
    const active = budgets.filter((b) => b.budget_status === 'active');
    if (active.length === 0) {
      setToast('No active budgets found.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    const budget = active[0];
    const projectName = getProjectName(budget.project_id);
    const monthlyRecurring = recurringCosts.filter((r) => r.budget_id === budget.id && r.status === 'active').reduce((s, r) => s + r.monthly_cost, 0);
    const unpaidLaunch = costItems.filter((c) => c.budget_id === budget.id && c.is_required_for_launch && c.payment_status !== 'paid' && c.cost_status !== 'cancelled').length;
    const prompt = `Update the Digital Footprint project budget for ${projectName}. Budget status: ${budget.budget_status}. Approved budget: £${budget.approved_budget.toLocaleString()}. Actual spend: £${budget.actual_spend.toLocaleString()}. Remaining budget: £${budget.remaining_budget.toLocaleString()}. Open unpaid launch costs: ${unpaidLaunch}. Monthly recurring cost: £${monthlyRecurring.toLocaleString()}. Review the budget health, fix missing cost data, update required launch cost items, and keep the command-centre UI consistent.`;
    await navigator.clipboard.writeText(prompt);
    setToast('Budget fix prompt copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  const handleCopyCostReviewPrompt = async () => {
    const active = budgets.filter((b) => b.budget_status === 'active');
    if (active.length === 0) {
      setToast('No active budgets found.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    const budget = active[0];
    const projectName = getProjectName(budget.project_id);
    const prompt = `Review all cost items for ${projectName}. Check one-off costs, recurring costs, unpaid items, required launch costs, supplier names, payment status, and forecast profit. Identify budget blockers and suggest the next actions before launch.`;
    await navigator.clipboard.writeText(prompt);
    setToast('Cost review prompt copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  const handleAddCost = (budget?: ProjectBudget) => {
    setEditingCostItem(null);
    setDefaultBudgetForCost(budget?.id ?? null);
    setDefaultProjectForCost(budget?.project_id ?? null);
    setCostModalOpen(true);
  };

  const handleAddRecurring = (budget?: ProjectBudget) => {
    setEditingRecurringCost(null);
    setDefaultBudgetForRecurring(budget?.id ?? null);
    setDefaultProjectForRecurring(budget?.project_id ?? null);
    setRecurringModalOpen(true);
  };

  const handleEditBudget = (budget: ProjectBudget) => {
    setEditingBudget(budget);
    setBudgetModalOpen(true);
  };

  const handleEditCostItem = (item: CostItem) => {
    setEditingCostItem(item);
    setDefaultBudgetForCost(null);
    setDefaultProjectForCost(null);
    setCostModalOpen(true);
  };

  const handleEditRecurringCost = (item: RecurringCost) => {
    setEditingRecurringCost(item);
    setDefaultBudgetForRecurring(null);
    setDefaultProjectForRecurring(null);
    setRecurringModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Project Budget</h1>
            <p className="text-sm text-foreground-500 mt-1">Track build costs, monthly costs, forecast profit, and launch spending for every Digital Footprint project.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const summary = computeSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Project Budget</h1>
          <p className="text-sm text-foreground-500 mt-1">Track build costs, monthly costs, forecast profit, and launch spending for every Digital Footprint project.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyBudgetFixPrompt}
            className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-sm font-medium px-3.5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-file-copy-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Budget Fix Prompt
          </button>
          <button
            onClick={handleCopyCostReviewPrompt}
            className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-sm font-medium px-3.5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-search-eye-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Cost Review Prompt
          </button>
          <button
            onClick={() => handleAddCost()}
            className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-sm font-medium px-3.5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Add Cost
          </button>
          <button
            onClick={() => handleAddRecurring()}
            className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-sm font-medium px-3.5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-repeat-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Add Recurring
          </button>
          <button
            onClick={() => { setEditingBudget(null); setBudgetModalOpen(true); }}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold px-4 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            New Budget
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadData} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      {!error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Project Budgets</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-500/10 text-accent-400">
                <i className="ri-funds-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">{summary.totalBudgets}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Budgeted Cost</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-400">
                <i className="ri-money-pound-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">£{summary.totalBudgetedCost.toLocaleString()}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Actual Spend</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
                <i className="ri-bank-card-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">£{summary.totalActualCost.toLocaleString()}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Remaining</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <i className="ri-wallet-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-emerald-400">£{summary.totalRemainingBudget.toLocaleString()}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Monthly Running</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-400">
                <i className="ri-repeat-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">£{summary.monthlyRunningCosts.toLocaleString()}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Over Budget</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400">
                <i className="ri-alert-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-red-400">{summary.overBudgetProjects}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Profit/mo</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <i className="ri-line-chart-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-emerald-400">£{summary.forecastMonthlyProfit.toLocaleString()}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Profit/yr</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <i className="ri-bar-chart-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-emerald-400">£{summary.forecastYearlyProfit.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-1 flex flex-wrap gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'bg-accent-500/10 text-accent-400'
                : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/50'
            }`}
          >
            <i className={`${tab.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {!error && (
        <>
          {activeTab === 'overview' && (
            <BudgetOverviewTab
              budgets={budgets}
              costItems={costItems}
              recurringCosts={recurringCosts}
              events={events}
              projects={projects}
              summary={summary}
              getProjectName={getProjectName}
              onEditBudget={handleEditBudget}
            />
          )}
          {activeTab === 'budgets' && (
            <ProjectBudgetTab
              budgets={budgets}
              costItems={costItems}
              recurringCosts={recurringCosts}
              projects={projects}
              getProjectName={getProjectName}
              onAddCost={handleAddCost}
              onAddRecurring={handleAddRecurring}
              onEditBudget={handleEditBudget}
              onRefresh={loadData}
            />
          )}
          {activeTab === 'costs' && (
            <CostItemsTab
              costItems={costItems}
              projects={projects}
              getProjectName={getProjectName}
              onEdit={handleEditCostItem}
            />
          )}
          {activeTab === 'recurring' && (
            <RecurringCostsTab
              recurringCosts={recurringCosts}
              projects={projects}
              getProjectName={getProjectName}
              onEdit={handleEditRecurringCost}
            />
          )}
          {activeTab === 'forecast' && (
            <ProfitForecastTab
              budgets={budgets}
              recurringCosts={recurringCosts}
              getProjectName={getProjectName}
              onRefresh={loadData}
              onEditBudget={handleEditBudget}
            />
          )}
          {activeTab === 'reports' && (
            <BudgetReportsTab
              budgets={budgets}
              costItems={costItems}
              recurringCosts={recurringCosts}
              projects={projects}
              getProjectName={getProjectName}
            />
          )}
        </>
      )}

      {/* Modals */}
      <BudgetModal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        onSaved={loadData}
        budget={editingBudget}
        projects={projects}
      />
      <CostItemModal
        open={costModalOpen}
        onClose={() => setCostModalOpen(false)}
        onSaved={loadData}
        item={editingCostItem}
        budgets={budgets}
        projects={projects}
        defaultBudgetId={defaultBudgetForCost}
        defaultProjectId={defaultProjectForCost}
      />
      <RecurringCostModal
        open={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        onSaved={loadData}
        item={editingRecurringCost}
        budgets={budgets}
        projects={projects}
        defaultBudgetId={defaultBudgetForRecurring}
        defaultProjectId={defaultProjectForRecurring}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-lg px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.75)]">
          <p className="text-sm text-foreground-100">{toast}</p>
        </div>
      )}
    </div>
  );
}