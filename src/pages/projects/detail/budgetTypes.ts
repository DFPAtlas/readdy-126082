import type {
  ProjectBudget,
  CostItem,
  RecurringCost,
  BudgetEvent,
} from '@/pages/project-budget/types';

export type {
  ProjectBudget,
  CostItem,
  RecurringCost,
  BudgetEvent,
};

export type BudgetStatus =
  | 'NO BUDGET'
  | 'ON TRACK'
  | 'WATCH'
  | 'AT RISK'
  | 'OVER BUDGET'
  | 'UNKNOWN';

export const BUDGET_STATUS_COLORS: Record<BudgetStatus, string> = {
  'NO BUDGET': 'bg-foreground-500/10 text-foreground-400',
  'ON TRACK': 'bg-emerald-500/10 text-emerald-400',
  'WATCH': 'bg-amber-500/10 text-amber-400',
  'AT RISK': 'bg-red-500/10 text-red-400',
  'OVER BUDGET': 'bg-red-500/10 text-red-400',
  'UNKNOWN': 'bg-foreground-500/10 text-foreground-400',
};

export interface PaymentRow {
  id: string;
  type: 'cost' | 'recurring';
  label: string;
  provider: string | null;
  amount: number;
  due: string;
  status: string;
}

export interface LaunchCostSummary {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  items: CostItem[];
  blocked: boolean;
}

export interface BudgetSummary {
  hasAnyBudget: boolean;
  hasApprovedBudget: boolean;
  approvedBudget: number;
  actualSpend: number;
  remainingBudget: number;
  budgetUsedPct: number | null;
  monthlyRecurring: number;
  annualRecurring: number;
  status: BudgetStatus;
  launchCosts: LaunchCostSummary;
  upcomingPayments: PaymentRow[];
  overduePayments: PaymentRow[];
}

export interface SourceErrors {
  budgets: string;
  costs: string;
  recurring: string;
  events: string;
}