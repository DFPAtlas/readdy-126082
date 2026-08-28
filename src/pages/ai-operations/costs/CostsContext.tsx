import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiBudget } from '@/pages/ai-operations/types';
import { demoBudgets, demoBudgetAlerts } from '@/mocks/ai-operations-costs';
import {
  getAiSites,
  getAiAgents,
  getAiOperationsModels,
  getAiModelProviders,
  getAiBudgets,
  getAiUsageCosts,
  getAiBudgetEvents,
  createAiBudget,
  updateAiBudget,
  acknowledgeAiBudgetEvent,
  createAiAuditEvent,
  type AiUsageCostRow,
  type AiBudgetRow,
} from '@/lib/ai-operations';
import {
  mapBudgetRowToRecord,
  mapBudgetRecordToInput,
  mapBudgetEventRowToAlert,
  emptyResolutionContext,
  type CostResolutionContext,
  type BudgetEventDisplay,
} from '@/pages/ai-operations/costs/costMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Cost, Usage & Budgets module. Mirrors the proven
// Sites/Agents/Models pattern so the page never pretends demo data is live:
//   * live  — Supabase ai_budgets / ai_usage_costs / ai_budget_events loaded.
//   * demo  — the existing mock cost dataset (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type CostsDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

export interface ScopeOptions {
  sites: { id: string; label: string }[];
  agents: { id: string; label: string }[];
  models: { id: string; label: string }[];
  providers: { id: string; label: string }[];
}

interface CostsContextValue {
  budgets: AiBudget[];
  budgetEvents: BudgetEventDisplay[];
  usageCosts: AiUsageCostRow[];
  mode: CostsDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  scopeOptions: ScopeOptions;
  createBudget: (record: AiBudget, actor: string) => Promise<SaveResult>;
  updateBudget: (id: string, record: AiBudget, actor: string) => Promise<SaveResult>;
  setBudgetActive: (id: string, isActive: boolean, actor: string) => Promise<SaveResult>;
  acknowledgeEvent: (eventKey: string, actor: string) => Promise<SaveResult>;
}

const CostsContext = createContext<CostsContextValue | null>(null);

const EMPTY_SCOPE_OPTIONS: ScopeOptions = { sites: [], agents: [], models: [], providers: [] };

function auditBudgetChange(params: {
  eventType: string;
  action: string;
  afterSummary: string;
  beforeSummary: string;
  actor: string;
  siteId?: string | null;
  agentId?: string | null;
  notes: string;
}): Promise<SaveResult> {
  return createAiAuditEvent({
    audit_key: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    occurred_at: new Date().toISOString(),
    event_type: params.eventType,
    action: params.action,
    outcome: 'success',
    severity: 'low',
    site_id: params.siteId ?? null,
    agent_id: params.agentId ?? null,
    run_id: null,
    approval_id: null,
    actor_type: 'human',
    actor_reference: params.actor,
    trigger_source: 'costs',
    risk_level: 'green',
    environment: 'production',
    before_summary: params.beforeSummary,
    after_summary: params.afterSummary,
    decision_reason: null,
    verification_state: 'not_required',
    uat_state: 'not_required',
    integrity_state: 'complete',
    review_required: false,
    notes: params.notes,
  }).then((res) => ({ error: res.error }));
}

export function CostsProvider({ children }: { children: ReactNode }) {
  const [budgets, setBudgets] = useState<AiBudget[]>([]);
  const [budgetEvents, setBudgetEvents] = useState<BudgetEventDisplay[]>([]);
  const [usageCosts, setUsageCosts] = useState<AiUsageCostRow[]>([]);
  const [scopeOptions, setScopeOptions] = useState<ScopeOptions>(EMPTY_SCOPE_OPTIONS);
  const [mode, setMode] = useState<CostsDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutable resolution context + budget-by-uuid map, rebuilt on each refresh.
  const mapsRef = useRef<{
    ctx: CostResolutionContext;
    budgetByUuid: Map<string, AiBudgetRow>;
  }>({ ctx: emptyResolutionContext(), budgetByUuid: new Map() });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes, modelsRes, providersRes, budgetsRes, usageRes, eventsRes] =
      await Promise.all([
        getAiSites(),
        getAiAgents(),
        getAiOperationsModels(),
        getAiModelProviders(),
        getAiBudgets(),
        getAiUsageCosts(),
        getAiBudgetEvents(),
      ]);

    // Reference resolution maps (no UUID leaks to the UI).
    const ctx = emptyResolutionContext();
    const siteRows = (sitesRes.data ?? []).filter((r) => r.is_active !== false);
    for (const r of siteRows) {
      ctx.siteKeyById.set(r.id, r.site_key);
      ctx.siteNameById.set(r.id, r.name);
      ctx.siteIdByKey.set(r.site_key, r.id);
    }
    const agentRows = (agentsRes.data ?? []).filter((r) => r.is_active !== false);
    for (const r of agentRows) {
      ctx.agentKeyById.set(r.id, r.agent_key);
      ctx.agentNameById.set(r.id, r.name);
      ctx.agentIdByKey.set(r.agent_key, r.id);
    }
    const modelRows = (modelsRes.data ?? []).filter((r) => r.is_active !== false);
    for (const r of modelRows) {
      ctx.modelKeyById.set(r.id, r.model_key);
      ctx.modelNameById.set(r.id, r.name);
      ctx.modelIdByKey.set(r.model_key, r.id);
    }
    const providerRows = (providersRes.data ?? []).filter((r) => r.is_active !== false);
    for (const r of providerRows) {
      ctx.providerKeyById.set(r.id, r.provider_key);
      ctx.providerNameById.set(r.id, r.name);
      ctx.providerIdByKey.set(r.provider_key, r.id);
    }

    setScopeOptions({
      sites: siteRows.map((r) => ({ id: r.site_key, label: r.name })),
      agents: agentRows.map((r) => ({ id: r.agent_key, label: r.name })),
      models: modelRows.map((r) => ({ id: r.model_key, label: r.name })),
      providers: providerRows.map((r) => ({ id: r.provider_key, label: r.name })),
    });

    // Budgets are the authoritative core — a failure here is a hard error.
    if (budgetsRes.error) {
      setMode('error');
      setError(budgetsRes.error);
      setBudgets([]);
      setBudgetEvents([]);
      setUsageCosts([]);
      setLoading(false);
      return;
    }

    const budgetRows = budgetsRes.data ?? [];
    const budgetByUuid = new Map<string, AiBudgetRow>();
    for (const r of budgetRows) budgetByUuid.set(r.id, r);

    mapsRef.current = { ctx, budgetByUuid };

    const mappedBudgets = budgetRows.map((r) => mapBudgetRowToRecord(r, ctx));
    const mappedEvents = (eventsRes.data ?? []).map((r) =>
      mapBudgetEventRowToAlert(r, budgetByUuid.get(r.budget_id ?? ''), ctx),
    );

    setBudgets(mappedBudgets);
    setBudgetEvents(mappedEvents);
    setUsageCosts(usageRes.data ?? []);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setBudgets(demoBudgets as AiBudget[]);
    setBudgetEvents(demoBudgetAlerts as BudgetEventDisplay[]);
    setUsageCosts([]);
    setScopeOptions(EMPTY_SCOPE_OPTIONS);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createBudget = useCallback(
    async (record: AiBudget, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        setBudgets((prev) => [record, ...prev]);
        return { error: null };
      }
      const input = mapBudgetRecordToInput(record, mapsRef.current.ctx);
      const { error: writeError } = await createAiBudget(input);
      if (writeError) return { error: writeError };

      const auditRes = await auditBudgetChange({
        eventType: 'budget_created',
        action: 'Create budget',
        afterSummary: `Budget created: ${record.name} (${record.id}).`,
        beforeSummary: 'Budget did not exist.',
        actor,
        siteId: input.site_id,
        agentId: input.agent_id,
        notes: 'Budget configuration created — no spend limit enforced; no billing system touched.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateBudget = useCallback(
    async (id: string, record: AiBudget, actor: string): Promise<SaveResult> => {
      const previous = budgets.find((b) => b.id === id);
      if (mode !== 'live') {
        setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...record } : b)));
        return { error: null };
      }
      const input = mapBudgetRecordToInput(record, mapsRef.current.ctx);
      const { error: writeError } = await updateAiBudget(id, input);
      if (writeError) return { error: writeError };

      const auditRes = await auditBudgetChange({
        eventType: 'budget_updated',
        action: 'Update budget',
        afterSummary: `Budget updated: ${record.name} (${id}).`,
        beforeSummary: previous ? `Budget was: ${previous.name} (limit ${previous.monthlyLimit}).` : 'Unknown prior state.',
        actor,
        siteId: input.site_id,
        agentId: input.agent_id,
        notes: 'Budget configuration updated — no spend limit enforced; no billing system touched.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, budgets, refresh],
  );

  const setBudgetActive = useCallback(
    async (id: string, isActive: boolean, actor: string): Promise<SaveResult> => {
      const previous = budgets.find((b) => b.id === id);
      if (mode !== 'live') {
        setBudgets((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: isActive ? b.status : 'disabled' } : b)),
        );
        return { error: null };
      }
      const { error: writeError } = await updateAiBudget(id, { is_active: isActive });
      if (writeError) return { error: writeError };

      const auditRes = await auditBudgetChange({
        eventType: 'budget_status_changed',
        action: isActive ? 'Activate budget' : 'Disable budget',
        afterSummary: `Budget ${isActive ? 'activated' : 'disabled'}: ${previous?.name ?? id}.`,
        beforeSummary: previous ? `Budget was ${isActive ? 'inactive' : 'active'}.` : 'Unknown prior state.',
        actor,
        notes: 'Budget active-state metadata changed — no enforcement occurs.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, budgets, refresh],
  );

  const acknowledgeEvent = useCallback(
    async (eventKey: string, actor: string): Promise<SaveResult> => {
      if (mode !== 'live') {
        setBudgetEvents((prev) => prev.map((e) => (e.id === eventKey ? { ...e } : e)));
        return { error: null };
      }
      const { error: writeError } = await acknowledgeAiBudgetEvent(eventKey, actor);
      if (writeError) return { error: writeError };

      const auditRes = await auditBudgetChange({
        eventType: 'budget_event_acknowledged',
        action: 'Acknowledge budget event',
        afterSummary: `Budget event acknowledged: ${eventKey}.`,
        beforeSummary: 'Event was unacknowledged.',
        actor,
        notes: 'Acknowledgement metadata persisted — no external action or notification occurred.',
      });
      if (auditRes.error) return { error: auditRes.error };

      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Load live cost data on first mount. A failure surfaces as `error` mode and
  // never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CostsContextValue>(
    () => ({
      budgets,
      budgetEvents,
      usageCosts,
      mode,
      loading,
      error,
      refresh,
      loadDemo,
      scopeOptions,
      createBudget,
      updateBudget,
      setBudgetActive,
      acknowledgeEvent,
    }),
    [budgets, budgetEvents, usageCosts, mode, loading, error, refresh, loadDemo, scopeOptions, createBudget, updateBudget, setBudgetActive, acknowledgeEvent],
  );

  return <CostsContext.Provider value={value}>{children}</CostsContext.Provider>;
}

export function useCosts(): CostsContextValue {
  const ctx = useContext(CostsContext);
  if (!ctx) throw new Error('useCosts must be used within a CostsProvider');
  return ctx;
}