import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  ProjectBudget,
  CostItem,
  RecurringCost,
  BudgetEvent,
} from '@/pages/project-budget/types';
import type { BudgetSummary, SourceErrors } from './budgetTypes';
import { computeBudgetSummary } from './budgetUtils';

export interface ProjectBudgetData {
  budgets: ProjectBudget[];
  costItems: CostItem[];
  recurringCosts: RecurringCost[];
  events: BudgetEvent[];
  loading: boolean;
  error: string;
  saving: boolean;
  sourceErrors: SourceErrors;
  summary: BudgetSummary;
  refresh: () => void;
  markCostPaid: (costId: number) => Promise<string | null>;
}

const EMPTY_ERRORS: SourceErrors = { budgets: '', costs: '', recurring: '', events: '' };

/**
 * Loads the selected DFP project's budget records, all scoped by
 * internal_projects.id via the existing project_id columns. Loads each source
 * independently so a single failed query never reads as £0 — it surfaces as
 * "unavailable" instead.
 */
export function useProjectBudget(
  projectId: number | null | undefined,
  projectName: string | null | undefined,
): ProjectBudgetData {
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [recurringCosts, setRecurringCosts] = useState<RecurringCost[]>([]);
  const [events, setEvents] = useState<BudgetEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<SourceErrors>(EMPTY_ERRORS);

  const load = useCallback(async () => {
    if (!projectId) {
      setBudgets([]);
      setCostItems([]);
      setRecurringCosts([]);
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setSourceErrors(EMPTY_ERRORS);

    const query = async (table: string) => {
      const { data, error: e } = await supabase
        .from(table)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      return { data: (data ?? []) as Record<string, unknown>[], err: e ? e.message : '' };
    };

    const [b, c, r, ev] = await Promise.all([
      query('internal_project_budgets'),
      query('internal_project_cost_items'),
      query('internal_project_recurring_costs'),
      query('internal_project_budget_events'),
    ]);

    setBudgets(b.data as ProjectBudget[]);
    setCostItems(c.data as CostItem[]);
    setRecurringCosts(r.data as RecurringCost[]);
    setEvents(ev.data as BudgetEvent[]);

    const errs: SourceErrors = { budgets: b.err, costs: c.err, recurring: r.err, events: ev.err };
    setSourceErrors(errs);
    if (errs.budgets) setError('Budget data unavailable.');

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(
    () => computeBudgetSummary(budgets, costItems, recurringCosts),
    [budgets, costItems, recurringCosts],
  );

  const logActivity = useCallback(
    async (action: string) => {
      if (!projectId) return;
      try {
        await supabase.from('internal_activity_log').insert({
          entity_type: 'project',
          entity_id: projectId,
          action,
          description: `${action}: ${projectName ?? 'project'}`,
        });
      } catch {
        // non-critical
      }
    },
    [projectId, projectName],
  );

  const markCostPaid = useCallback(
    async (costId: number): Promise<string | null> => {
      setSaving(true);
      try {
        const cost = costItems.find((c) => c.id === costId);
        const { error: e } = await supabase
          .from('internal_project_cost_items')
          .update({ payment_status: 'paid', paid_date: new Date().toISOString() })
          .eq('id', costId);
        if (e) throw e;
        await logActivity(cost?.is_required_for_launch ? 'Required launch cost paid' : 'Cost marked paid');
        await load();
        return null;
      } catch (err: any) {
        return err?.message || 'Failed to mark cost paid.';
      } finally {
        setSaving(false);
      }
    },
    [costItems, load, logActivity],
  );

  return {
    budgets,
    costItems,
    recurringCosts,
    events,
    loading,
    error,
    saving,
    sourceErrors,
    summary,
    refresh: load,
    markCostPaid,
  };
}