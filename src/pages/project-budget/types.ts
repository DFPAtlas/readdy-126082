export interface ProjectBudget {
  id: number;
  project_id: number | null;
  budget_name: string;
  budget_status: 'draft' | 'active' | 'on_hold' | 'completed' | 'archived';
  budget_type: 'internal_project' | 'client_project' | 'saas_platform' | 'uat_project' | 'ai_agent' | 'marketing_campaign' | 'infrastructure';
  currency: string;
  initial_budget: number;
  approved_budget: number;
  actual_spend: number;
  remaining_budget: number;
  forecast_revenue_monthly: number;
  forecast_revenue_yearly: number;
  forecast_profit_monthly: number;
  forecast_profit_yearly: number;
  target_launch_date: string | null;
  owner: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostItem {
  id: number;
  budget_id: number | null;
  project_id: number | null;
  cost_name: string;
  cost_category: string;
  cost_type: 'one_off' | 'recurring';
  supplier_name: string | null;
  description: string | null;
  estimated_cost: number;
  actual_cost: number;
  vat_amount: number;
  total_cost: number;
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'disputed' | 'not_required';
  cost_status: 'planned' | 'approved' | 'ordered' | 'in_progress' | 'complete' | 'cancelled';
  is_required_for_launch: boolean;
  is_client_billable: boolean;
  invoice_reference: string | null;
  receipt_url: string | null;
  due_date: string | null;
  paid_date: string | null;
  owner: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringCost {
  id: number;
  budget_id: number | null;
  project_id: number | null;
  recurring_name: string;
  cost_category: string;
  supplier_name: string | null;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_off';
  monthly_cost: number;
  yearly_cost: number;
  next_payment_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  is_required_for_live_site: boolean;
  is_client_billable: boolean;
  auto_renew: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetEvent {
  id: number;
  budget_id: number | null;
  project_id: number | null;
  event_type: string;
  event_title: string;
  event_description: string | null;
  amount: number;
  created_by: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  project_name: string;
  slug: string;
}

export interface SummaryStats {
  totalBudgets: number;
  totalBudgetedCost: number;
  totalActualCost: number;
  totalRemainingBudget: number;
  monthlyRunningCosts: number;
  overBudgetProjects: number;
  forecastMonthlyProfit: number;
  forecastYearlyProfit: number;
  unpaidLaunchCosts: number;
  upcomingPayments: number;
}

export const COST_CATEGORIES = [
  'Development', 'UI Design', 'UX Planning', 'Database', 'Supabase',
  'Hosting', 'AWS', 'Domain', 'Email', 'Stripe / Payment Fees',
  'AI Tokens', 'n8n / Agent Runtime', 'API Services', 'Storage',
  'Security', 'Monitoring', 'Testing', 'UAT', 'Legal', 'Marketing',
  'Content', 'Logo / Branding', 'Staff / Contractor', 'Hardware',
  'Software Licence', 'Client Expenses', 'Other',
] as const;

export const COST_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'not_required', label: 'Not Required' },
] as const;

export const BUDGET_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

export const BUDGET_TYPE_OPTIONS = [
  { value: 'internal_project', label: 'Internal Project' },
  { value: 'client_project', label: 'Client Project' },
  { value: 'saas_platform', label: 'SaaS Platform' },
  { value: 'uat_project', label: 'UAT Project' },
  { value: 'ai_agent', label: 'AI Agent' },
  { value: 'marketing_campaign', label: 'Marketing Campaign' },
  { value: 'infrastructure', label: 'Infrastructure' },
] as const;

export const BILLING_CYCLE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_off', label: 'One-Off' },
] as const;

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-500/10 text-red-400',
  pending: 'bg-amber-500/10 text-amber-400',
  paid: 'bg-emerald-500/10 text-emerald-400',
  refunded: 'bg-sky-500/10 text-sky-400',
  disputed: 'bg-red-500/10 text-red-400',
  not_required: 'bg-foreground-500/10 text-foreground-400',
};

export const COST_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-foreground-500/10 text-foreground-400',
  approved: 'bg-sky-500/10 text-sky-400',
  ordered: 'bg-accent-500/10 text-accent-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  complete: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
};

export const BUDGET_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-foreground-500/10 text-foreground-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  on_hold: 'bg-amber-500/10 text-amber-400',
  completed: 'bg-sky-500/10 text-sky-400',
  archived: 'bg-foreground-500/10 text-foreground-400',
};

export const BUDGET_TYPE_COLORS: Record<string, string> = {
  internal_project: 'bg-accent-500/10 text-accent-400',
  client_project: 'bg-sky-500/10 text-sky-400',
  saas_platform: 'bg-emerald-500/10 text-emerald-400',
  uat_project: 'bg-amber-500/10 text-amber-400',
  ai_agent: 'bg-violet-500/10 text-violet-400',
  marketing_campaign: 'bg-rose-500/10 text-rose-400',
  infrastructure: 'bg-foreground-500/10 text-foreground-400',
};

export const BUDGET_TYPE_LABELS: Record<string, string> = {
  internal_project: 'Internal Project',
  client_project: 'Client Project',
  saas_platform: 'SaaS Platform',
  uat_project: 'UAT Project',
  ai_agent: 'AI Agent',
  marketing_campaign: 'Marketing Campaign',
  infrastructure: 'Infrastructure',
};

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_off: 'One-Off',
};