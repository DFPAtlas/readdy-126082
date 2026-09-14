import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';
import type { ProjectBudgetData } from '../useProjectBudget';
import type { BuildStatusSummary } from '../buildUtils';
import type { UatSummary } from '../uatTypes';
import { BUDGET_STATUS_COLORS } from '../budgetTypes';
import {
  formatMoney,
  formatMoneySigned,
  describeRevenue,
  statusLabel,
} from '../budgetUtils';
import { formatDate } from '../utils';
import type { ProjectBudget, CostItem, RecurringCost } from '@/pages/project-budget/types';
import BudgetModal from '@/pages/project-budget/components/BudgetModal';
import CostItemModal from '@/pages/project-budget/components/CostItemModal';
import RecurringCostModal from '@/pages/project-budget/components/RecurringCostModal';
import {
  Panel,
  CostItemsPanel,
  RecurringCostsPanel,
  PaymentsPanel,
  EventsPanel,
} from './BudgetPanels';

interface BudgetSectionProps {
  project: Project;
  budget: ProjectBudgetData;
  buildSummary: BuildStatusSummary;
  uatSummary: UatSummary;
}

export default function BudgetSection({ project, budget, buildSummary, uatSummary }: BudgetSectionProps) {
  const [toast, setToast] = useState('');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringCost | null>(null);

  const summary = budget.summary;
  const revenue = describeRevenue(project);
  const monthlyProfit = revenue.value - summary.monthlyRecurring;
  const annualProfit = revenue.value * 12 - summary.annualRecurring;

  const projectList = [
    { id: project.id, project_name: project.project_name, project_slug: project.project_slug },
  ];
  const activeBudget: ProjectBudget | null =
    budget.budgets.find((b) => b.budget_status === 'active') ?? budget.budgets[0] ?? null;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleCopyBudgetFixPrompt = async () => {
    if (!summary.hasApprovedBudget) {
      flash('No approved budget to review.');
      return;
    }
    const prompt = `Update the Digital Footprint project budget for ${project.project_name}. Budget status: ${summary.status}. Approved budget: ${formatMoney(summary.approvedBudget)}. Actual spend: ${formatMoney(summary.actualSpend)}. Remaining: ${formatMoney(summary.remainingBudget)}. Unpaid required launch costs: ${formatMoney(summary.launchCosts.outstanding)}. Monthly recurring: ${formatMoney(summary.monthlyRecurring)}. Review budget health, fix missing cost data, and update required launch cost items.`;
    await navigator.clipboard.writeText(prompt);
    flash('Budget fix prompt copied to clipboard!');
  };

  const handleCopyCostReviewPrompt = async () => {
    const prompt = `Review all cost items for ${project.project_name}. Check one-off costs, recurring costs, unpaid items, required launch costs, supplier names, payment status, and forecast profit. Identify budget blockers and suggest the next actions before launch.`;
    await navigator.clipboard.writeText(prompt);
    flash('Cost review prompt copied to clipboard!');
  };

  const handleOpenCostModal = (item: CostItem | null) => {
    setEditingCost(item);
    setShowCostModal(true);
  };

  const handleOpenRecurringModal = (item: RecurringCost | null) => {
    setEditingRecurring(item);
    setShowRecurringModal(true);
  };

  const handleMarkPaid = async (id: number) => {
    const err = await budget.markCostPaid(id);
    flash(err || 'Cost marked as paid.');
  };

  // ── Loading ──
  if (budget.loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-5 bg-background-200/60 rounded w-40"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-background-200/40 rounded-lg"></div>
          ))}
        </div>
        <div className="h-40 bg-background-200/40 rounded-lg"></div>
      </div>
    );
  }

  // ── Error (budgets failed) ──
  if (budget.error) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <i className="ri-error-warning-line text-2xl text-red-400 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Budget data unavailable</h3>
        <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">{budget.error}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={budget.refresh}
            className="bg-background-200/60 border border-background-300/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
          <Link
            to="/project-budget"
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Open Global Project Budget
          </Link>
        </div>
      </div>
    );
  }

  // ── No budget at all ──
  if (!summary.hasAnyBudget) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
          <i className="ri-money-pound-circle-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No Budget</h3>
        <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">
          No budget has been created for {project.project_name} yet. Create one to track approved budget, costs,
          recurring spend and commercial position here.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowBudgetModal(true)}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line w-4 h-4 flex items-center justify-center inline-block mr-1.5"></i>
            Create Budget
          </button>
          <Link
            to="/project-budget"
            className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer no-underline"
          >
            Open Global Project Budget
          </Link>
        </div>
      </div>
    );
  }

  const pct = summary.budgetUsedPct;
  const overBudget = pct != null && pct > 100;
  const barWidth = pct == null ? 0 : Math.min(pct, 100);
  const barColor = overBudget ? 'bg-red-400' : pct != null && pct >= 85 ? 'bg-amber-400' : 'bg-emerald-400';

  const combinedLaunchPosition = summary.launchCosts.blocked
    ? 'NOT READY'
    : uatSummary.linked && uatSummary.approvalStatus !== 'approved'
      ? uatSummary.approvalStatus === 'pending'
        ? 'PENDING'
        : 'NOT READY'
      : 'READY';

  const summaryCards: { label: string; value: string; tone?: string; icon: string }[] = [
    { label: 'Approved Budget', value: formatMoney(summary.approvedBudget), icon: 'ri-funds-line' },
    { label: 'Actual Spend', value: formatMoney(summary.actualSpend), icon: 'ri-bank-card-line' },
    {
      label: 'Remaining Budget',
      value: formatMoney(summary.remainingBudget),
      tone: summary.remainingBudget < 0 ? 'text-red-400' : 'text-emerald-400',
      icon: 'ri-wallet-3-line',
    },
    {
      label: 'Budget Used',
      value: pct == null ? '—' : `${Math.round(pct)}%`,
      tone: overBudget ? 'text-red-400' : pct != null && pct >= 85 ? 'text-amber-400' : undefined,
      icon: 'ri-percent-line',
    },
    { label: 'Monthly Recurring', value: formatMoney(summary.monthlyRecurring), icon: 'ri-repeat-line' },
    { label: 'Annual Recurring', value: formatMoney(summary.annualRecurring), icon: 'ri-calendar-line' },
    { label: 'Monthly Revenue', value: revenue.label, tone: revenue.configured ? 'text-emerald-400' : 'text-foreground-500', icon: 'ri-line-chart-line' },
    {
      label: 'Monthly Profit / Loss',
      value: revenue.configured ? formatMoneySigned(monthlyProfit) : '—',
      tone: revenue.configured ? (monthlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-foreground-500',
      icon: 'ri-bar-chart-2-line',
    },
    {
      label: 'Launch Costs Remaining',
      value: formatMoney(summary.launchCosts.outstanding),
      tone: summary.launchCosts.outstanding > 0 ? 'text-red-400' : 'text-emerald-400',
      icon: 'ri-rocket-line',
    },
    { label: 'Upcoming Payments', value: String(summary.upcomingPayments.length), icon: 'ri-calendar-check-line' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header + actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-heading font-semibold text-foreground-100">Budget</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BUDGET_STATUS_COLORS[summary.status]}`}>
              {statusLabel(summary.status)}
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1">
            Commercial position for {project.project_name} — approved budget, costs, recurring spend and revenue.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyBudgetFixPrompt}
            className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-xs font-label px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-file-copy-line w-3.5 h-3.5 flex items-center justify-center inline-block mr-1.5"></i>
            Budget Fix Prompt
          </button>
          <button
            type="button"
            onClick={handleCopyCostReviewPrompt}
            className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-xs font-label px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-search-eye-line w-3.5 h-3.5 flex items-center justify-center inline-block mr-1.5"></i>
            Cost Review Prompt
          </button>
          <button
            type="button"
            onClick={() => handleOpenCostModal(null)}
            className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-xs font-label px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line w-3.5 h-3.5 flex items-center justify-center inline-block mr-1.5"></i>
            Add Cost
          </button>
          <button
            type="button"
            onClick={() => handleOpenRecurringModal(null)}
            className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-300 text-xs font-label px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-repeat-line w-3.5 h-3.5 flex items-center justify-center inline-block mr-1.5"></i>
            Add Recurring
          </button>
          <button
            type="button"
            onClick={() => setShowBudgetModal(true)}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-3 py-1.5 rounded-full text-xs font-label font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Edit Budget
          </button>
          <Link
            to="/project-budget"
            className="text-xs text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer no-underline"
          >
            Open Global Project Budget
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-background-50 border border-background-200/60 rounded-lg p-3 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <i className={`${card.icon} text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
              <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap truncate">{card.label}</span>
            </div>
            <p className={`text-lg font-heading font-bold truncate ${card.tone || 'text-foreground-50'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Budget consumption + commercial position */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Budget Consumption" icon="ri-dashboard-line">
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-heading font-bold text-foreground-50">
              {pct == null ? '—' : `${pct.toFixed(1)}%`}
            </span>
            <span className="text-xs text-foreground-500 mb-1.5">
              {formatMoney(summary.actualSpend)} / {formatMoney(summary.approvedBudget)}
            </span>
          </div>
          <div className="h-3 bg-background-200/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all duration-300`}
              style={{ width: `${barWidth}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-foreground-500 flex-wrap gap-2">
            <span>
              {overBudget
                ? `${formatMoney(summary.remainingBudget)} over budget`
                : `${formatMoney(summary.remainingBudget)} remaining`}
            </span>
            <span className="font-label uppercase tracking-wide">{statusLabel(summary.status)}</span>
          </div>
        </Panel>

        <Panel title="Commercial Position" icon="ri-money-pound-circle-line">
          <div className="grid gap-y-2">
            <CommercialRow label="Monthly Revenue" value={revenue.label} tone={revenue.configured ? 'text-emerald-400' : 'text-foreground-500'} />
            <CommercialRow label="Monthly Running Cost" value={formatMoney(summary.monthlyRecurring)} tone="text-red-400" />
            <CommercialRow
              label="Monthly Profit / Loss"
              value={revenue.configured ? formatMoneySigned(monthlyProfit) : '—'}
              tone={revenue.configured ? (monthlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-foreground-500'}
            />
            <CommercialRow label="Annualised Revenue" value={revenue.configured ? formatMoney(revenue.value * 12) : revenue.label} />
            <CommercialRow label="Annualised Operating Cost" value={formatMoney(summary.annualRecurring)} />
            <CommercialRow
              label="Annualised Profit / Loss"
              value={revenue.configured ? formatMoneySigned(annualProfit) : '—'}
              tone={revenue.configured ? (annualProfit >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-foreground-500'}
            />
            <CommercialRow
              label="Budget Status"
              value={statusLabel(summary.status)}
              tone={summary.status === 'ON TRACK' ? 'text-emerald-400' : summary.status === 'OVER BUDGET' || summary.status === 'AT RISK' ? 'text-red-400' : 'text-amber-400'}
            />
            <CommercialRow
              label="Launch Cost Status"
              value={summary.launchCosts.blocked ? 'Blocked' : 'Clear'}
              tone={summary.launchCosts.blocked ? 'text-red-400' : 'text-emerald-400'}
            />
          </div>
        </Panel>
      </div>

      {/* Launch costs */}
      <Panel
        title="Launch Costs"
        icon="ri-rocket-line"
        subtitle={`Required-for-launch cost items`}
      >
        {summary.launchCosts.blocked && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <i className="ri-alert-fill text-xl text-red-400 w-6 h-6 flex items-center justify-center"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-300">COMMERCIAL LAUNCH BLOCKER</p>
              <p className="text-xs text-red-400/80">
                {formatMoney(summary.launchCosts.outstanding)} of required launch costs remain unpaid.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatLabel label="Total" value={formatMoney(summary.launchCosts.total)} />
          <StatLabel label="Paid" value={formatMoney(summary.launchCosts.paid)} tone="text-emerald-400" />
          <StatLabel label="Outstanding" value={formatMoney(summary.launchCosts.outstanding)} tone={summary.launchCosts.outstanding > 0 ? 'text-red-400' : 'text-emerald-400'} />
          <StatLabel label="Overdue" value={formatMoney(summary.launchCosts.overdue)} tone={summary.launchCosts.overdue > 0 ? 'text-red-400' : undefined} />
        </div>

        {summary.launchCosts.items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-foreground-500">
            <i className="ri-information-line w-4 h-4 flex items-center justify-center text-foreground-600"></i>
            No required-for-launch cost items recorded.
          </div>
        ) : (
          <div className="divide-y divide-background-200/60">
            {summary.launchCosts.items.map((c) => {
              const paid = c.payment_status === 'paid' || c.payment_status === 'not_required' || c.payment_status === 'refunded';
              return (
                <div key={c.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground-100 truncate">{c.cost_name}</p>
                    {c.due_date && <p className="text-xs text-foreground-500">Due {formatDate(c.due_date)}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${paid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {paid ? 'Paid' : 'Unpaid'}
                    </span>
                    <span className="text-sm font-heading font-bold text-foreground-100">
                      {formatMoney(c.total_cost || c.actual_cost || c.estimated_cost || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Cross-system */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Build / Commercial" icon="ri-git-branch-line">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <CrossItem label="Build Readiness" value={`${buildSummary.progressPercent}%`} />
            <CrossItem label="Budget" value={statusLabel(summary.status)} />
            <CrossItem label="Outstanding Launch Costs" value={formatMoney(summary.launchCosts.outstanding)} />
            <CrossItem label="Overdue Required Costs" value={formatMoney(summary.launchCosts.overdue)} />
          </div>
        </Panel>

        <Panel title="UAT / Launch" icon="ri-rocket-2-line">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <CrossItem label="UAT Approval" value={uatSummary.approvalStatus ?? 'Not requested'} />
            <CrossItem
              label="Commercial Launch Blocker"
              value={summary.launchCosts.blocked ? 'Blocked' : 'None'}
            />
            <CrossItem label="Overall" value={combinedLaunchPosition} />
          </div>
          {summary.launchCosts.blocked && (
            <p className="text-xs text-red-400/80 mt-3">
              {formatMoney(summary.launchCosts.outstanding)} required launch cost unpaid — this is a display state only.
            </p>
          )}
        </Panel>
      </div>

      {/* Cost items */}
      <CostItemsPanel
        costItems={budget.costItems}
        unavailable={!!budget.sourceErrors.costs}
        onEdit={handleOpenCostModal}
        onMarkPaid={handleMarkPaid}
        saving={budget.saving}
      />

      {/* Recurring */}
      <RecurringCostsPanel
        recurringCosts={budget.recurringCosts}
        unavailable={!!budget.sourceErrors.recurring}
        onEdit={handleOpenRecurringModal}
      />

      {/* Payments */}
      <PaymentsPanel upcoming={summary.upcomingPayments} overdue={summary.overduePayments} />

      {/* Events */}
      <EventsPanel events={budget.events} unavailable={!!budget.sourceErrors.events} />

      {/* Modals */}
      <BudgetModal
        open={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        onSaved={budget.refresh}
        budget={activeBudget}
        projects={projectList}
        defaultProjectId={project.id}
      />
      <CostItemModal
        open={showCostModal}
        onClose={() => setShowCostModal(false)}
        onSaved={budget.refresh}
        item={editingCost}
        budgets={budget.budgets}
        projects={projectList}
        defaultProjectId={project.id}
      />
      <RecurringCostModal
        open={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSaved={budget.refresh}
        item={editingRecurring}
        budgets={budget.budgets}
        projects={projectList}
        defaultProjectId={project.id}
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

// ─── Small building blocks ──────────────────────────────────────

function CommercialRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b border-background-200/60 last:border-0">
      <span className="text-xs text-foreground-400">{label}</span>
      <span className={`text-sm font-heading font-semibold ${tone || 'text-foreground-100'}`}>{value}</span>
    </div>
  );
}

function StatLabel({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap mb-1">{label}</p>
      <p className={`text-base font-heading font-bold ${tone || 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}

function CrossItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-foreground-100">{value}</p>
    </div>
  );
}