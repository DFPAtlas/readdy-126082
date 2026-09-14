import type {
  ProjectBudget,
  CostItem,
  RecurringCost,
} from '@/pages/project-budget/types';
import type {
  BudgetSummary,
  BudgetStatus,
  PaymentRow,
} from './budgetTypes';

const PAID_PAYMENT_STATUSES = new Set(['paid', 'not_required', 'refunded']);

export function isCostPaid(c: CostItem): boolean {
  return PAID_PAYMENT_STATUSES.has(c.payment_status);
}

function isActiveRecurring(r: RecurringCost): boolean {
  return r.status === 'active';
}

function itemAmount(c: CostItem): number {
  return c.total_cost || c.actual_cost || c.estimated_cost || 0;
}

/**
 * Derived, honest budget status. CONFIGURED/VERIFIED semantics don't apply here —
 * this is pure commercial position:
 *   NO BUDGET    — no approved budget exists
 *   OVER BUDGET  — actual spend exceeds approved
 *   AT RISK      — remaining is low AND required/unpaid launch costs remain
 *   WATCH        — usage is high, or required launch costs are unpaid
 *   ON TRACK     — within acceptable range
 */
function deriveStatus(
  approved: number,
  actual: number,
  hasUnpaidRequiredLaunch: boolean,
): BudgetStatus {
  if (approved <= 0) return 'NO BUDGET';
  if (actual > approved) return 'OVER BUDGET';
  const pct = actual / approved;
  if (pct >= 0.85 && hasUnpaidRequiredLaunch) return 'AT RISK';
  if (pct >= 0.85) return 'WATCH';
  if (pct >= 0.7) return 'WATCH';
  if (hasUnpaidRequiredLaunch) return 'WATCH';
  return 'ON TRACK';
}

export function computeBudgetSummary(
  budgets: ProjectBudget[],
  costItems: CostItem[],
  recurringCosts: RecurringCost[],
): BudgetSummary {
  const active = budgets.filter((b) => b.budget_status === 'active');
  const approvedBudget = active.reduce((s, b) => s + (b.approved_budget || 0), 0);
  const actualSpend = active.reduce((s, b) => s + (b.actual_spend || 0), 0);
  // Remaining is derived (approved − actual) so it can go negative when over budget,
  // which keeps it consistent with the budget-used percentage.
  const remainingBudget = approvedBudget - actualSpend;

  const activeRecurring = recurringCosts.filter(isActiveRecurring);
  const monthlyRecurring = activeRecurring.reduce((s, r) => s + (r.monthly_cost || 0), 0);
  const annualRecurring = activeRecurring.reduce((s, r) => s + (r.yearly_cost || 0), 0);

  const launchItems = costItems.filter(
    (c) => c.is_required_for_launch && c.cost_status !== 'cancelled',
  );
  const launchTotal = launchItems.reduce((s, c) => s + itemAmount(c), 0);
  const launchPaid = launchItems.filter(isCostPaid).reduce((s, c) => s + itemAmount(c), 0);
  const launchOutstanding = launchTotal - launchPaid;
  const nowMs = Date.now();
  const launchOverdue = launchItems
    .filter((c) => !isCostPaid(c) && c.due_date && new Date(c.due_date).getTime() < nowMs)
    .reduce((s, c) => s + itemAmount(c), 0);

  const hasUnpaidRequiredLaunch = launchItems.some((c) => !isCostPaid(c));
  const status = deriveStatus(approvedBudget, actualSpend, hasUnpaidRequiredLaunch);

  const now = new Date();
  const upcoming: PaymentRow[] = [];
  const overdue: PaymentRow[] = [];

  costItems.forEach((c) => {
    if (c.cost_status === 'cancelled' || !c.due_date || isCostPaid(c)) return;
    const row: PaymentRow = {
      id: `cost-${c.id}`,
      type: 'cost',
      label: c.cost_name,
      provider: c.supplier_name,
      amount: itemAmount(c),
      due: c.due_date,
      status: c.payment_status,
    };
    (new Date(c.due_date).getTime() < now.getTime() ? overdue : upcoming).push(row);
  });

  activeRecurring.forEach((r) => {
    if (!r.next_payment_date) return;
    const row: PaymentRow = {
      id: `recurring-${r.id}`,
      type: 'recurring',
      label: r.recurring_name,
      provider: r.supplier_name,
      amount: r.monthly_cost || 0,
      due: r.next_payment_date,
      status: r.status,
    };
    (new Date(r.next_payment_date).getTime() < now.getTime() ? overdue : upcoming).push(row);
  });

  upcoming.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  overdue.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return {
    hasAnyBudget: budgets.length > 0,
    hasApprovedBudget: approvedBudget > 0,
    approvedBudget,
    actualSpend,
    remainingBudget,
    budgetUsedPct: approvedBudget > 0 ? (actualSpend / approvedBudget) * 100 : null,
    monthlyRecurring,
    annualRecurring,
    status,
    launchCosts: {
      total: launchTotal,
      paid: launchPaid,
      outstanding: launchOutstanding,
      overdue: launchOverdue,
      items: launchItems,
      blocked: hasUnpaidRequiredLaunch,
    },
    upcomingPayments: upcoming,
    overduePayments: overdue,
  };
}

export function formatMoney(value: number): string {
  return `£${value.toLocaleString()}`;
}

export function formatMoneySigned(value: number): string {
  if (value > 0) return `+£${value.toLocaleString()}`;
  return `£${value.toLocaleString()}`;
}

export function statusLabel(status: BudgetStatus): string {
  return status
    .split(' ')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export interface RevenueInfo {
  value: number;
  label: string;
  configured: boolean;
}

export function describeRevenue(project: {
  monthly_revenue: number;
  is_internal_tool: boolean;
}): RevenueInfo {
  if (project.monthly_revenue > 0) {
    return { value: project.monthly_revenue, label: formatMoney(project.monthly_revenue), configured: true };
  }
  if (project.is_internal_tool) {
    return { value: 0, label: 'Not Applicable', configured: false };
  }
  return { value: 0, label: 'Not Configured', configured: false };
}