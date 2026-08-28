// ============================================================================
// AI Operations — Cost, Usage & Budgets — database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase rows (ai_budgets,
// ai_usage_costs, ai_budget_events) and the existing frontend contracts
// (AiBudget, BudgetAlert). All DB→frontend field differences are handled here
// so no mapping logic leaks into JSX.
//
// ID strategy:
//   * `budget_key` / `usage_key` / `event_key` (text, unique) are the stable
//     application identifiers — the database `id` (UUID) is internal and never
//     exposed as the frontend `id`.
//
// Live vs demo:
//   * Authoritative budget configuration (identity, scope, amount, thresholds,
//     currency, environment, period, owner, active state, notes) comes from the
//     live rows.
//   * Current usage / forecast are persisted reporting metadata (seeded as an
//     honest migrated-demo baseline; provider billing is NOT connected).
//
// Credentials: none are stored or displayed. Amounts/currency are safe
// reporting values only.
// ============================================================================

import type {
  AiBudget,
  BudgetAlert,
  BudgetScope,
  BudgetStatus,
  Environment,
  Severity,
} from '@/pages/ai-operations/types';
import type {
  AiBudgetRow,
  AiBudgetEventRow,
  AiBudgetUpsertInput,
} from '@/lib/ai-operations';

// Resolved reference lookups, built by the Costs context from the live
// site/agent/model/provider rows. No UUIDs leak into the UI.
export interface CostResolutionContext {
  siteKeyById: Map<string, string>;
  siteNameById: Map<string, string>;
  siteIdByKey: Map<string, string>;
  agentKeyById: Map<string, string>;
  agentNameById: Map<string, string>;
  agentIdByKey: Map<string, string>;
  modelKeyById: Map<string, string>;
  modelNameById: Map<string, string>;
  modelIdByKey: Map<string, string>;
  providerKeyById: Map<string, string>;
  providerNameById: Map<string, string>;
  providerIdByKey: Map<string, string>;
}

export const emptyResolutionContext = (): CostResolutionContext => ({
  siteKeyById: new Map(),
  siteNameById: new Map(),
  siteIdByKey: new Map(),
  agentKeyById: new Map(),
  agentNameById: new Map(),
  agentIdByKey: new Map(),
  modelKeyById: new Map(),
  modelNameById: new Map(),
  modelIdByKey: new Map(),
  providerKeyById: new Map(),
  providerNameById: new Map(),
  providerIdByKey: new Map(),
});

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '£0.00';
  return `£${n.toFixed(2)}`;
}

export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const BUDGET_SCOPES: BudgetScope[] = ['group', 'site', 'agent', 'model', 'provider', 'environment'];

function toBudgetScope(scopeType: string | null): BudgetScope {
  if (scopeType && BUDGET_SCOPES.includes(scopeType as BudgetScope)) {
    return scopeType as BudgetScope;
  }
  return 'group';
}

const BUDGET_STATUSES: BudgetStatus[] = ['healthy', 'warning', 'critical', 'exceeded', 'disabled', 'not_configured'];

function toBudgetStatus(status: string | null): BudgetStatus {
  if (status && BUDGET_STATUSES.includes(status as BudgetStatus)) {
    return status as BudgetStatus;
  }
  return 'not_configured';
}

// Resolve the stable scope key + label for a budget row.
function resolveScope(
  row: AiBudgetRow,
  ctx: CostResolutionContext,
): { scopeId: string | null; scopeLabel: string } {
  switch (toBudgetScope(row.scope_type)) {
    case 'site':
      return {
        scopeId: row.site_id ? ctx.siteKeyById.get(row.site_id) ?? null : null,
        scopeLabel: row.site_id ? ctx.siteNameById.get(row.site_id) ?? 'Site' : 'Site',
      };
    case 'agent':
      return {
        scopeId: row.agent_id ? ctx.agentKeyById.get(row.agent_id) ?? null : null,
        scopeLabel: row.agent_id ? ctx.agentNameById.get(row.agent_id) ?? 'Agent' : 'Agent',
      };
    case 'model':
      return {
        scopeId: row.model_id ? ctx.modelKeyById.get(row.model_id) ?? null : null,
        scopeLabel: row.model_id ? ctx.modelNameById.get(row.model_id) ?? 'Model' : 'Model',
      };
    case 'provider':
      return {
        scopeId: row.provider_id ? ctx.providerKeyById.get(row.provider_id) ?? null : null,
        scopeLabel: row.provider_id ? ctx.providerNameById.get(row.provider_id) ?? 'Provider' : 'Provider',
      };
    default:
      return { scopeId: null, scopeLabel: 'Group-wide' };
  }
}

/**
 * Map a live `ai_budgets` row to an `AiBudget`.
 */
export function mapBudgetRowToRecord(
  row: AiBudgetRow,
  ctx: CostResolutionContext,
): AiBudget {
  const scope = toBudgetScope(row.scope_type);
  const { scopeId, scopeLabel } = resolveScope(row, ctx);
  const budgetAmount = row.budget_amount ?? 0;
  const current = row.current_usage_amount ?? 0;
  const status: BudgetStatus = row.is_active === false ? 'disabled' : toBudgetStatus(row.status);

  return {
    // Stable application identifier — equals the DB `budget_key`.
    id: row.budget_key,
    name: row.name,
    scope,
    scopeId,
    scopeLabel,
    monthlyLimit: formatCurrency(budgetAmount),
    dailyLimit: '—',
    warningThreshold: row.warning_threshold_percent ?? 0,
    criticalThreshold: row.critical_threshold_percent ?? 0,
    currentSpend: formatCurrency(current),
    forecast: formatCurrency(row.forecast_amount),
    remaining: formatCurrency(budgetAmount - current),
    status,
    ownerTeam: row.owner_team ?? '',
    environment: (row.environment as Environment) ?? 'production',
    startDate: row.starts_at ? row.starts_at.slice(0, 10) : '',
    reviewDate: row.ends_at ? row.ends_at.slice(0, 10) : '',
    notes: row.notes ?? '',
  };
}

/**
 * Map an `AiBudget` record to the database input for create/update.
 * Only safe configuration metadata is persisted. `current_usage_amount`,
 * `forecast_amount` and `status` are reporting/derived values and are
 * intentionally excluded — they are never user-edited. Scope references are
 * resolved to UUIDs here (or null for group scope).
 */
export function mapBudgetRecordToInput(
  record: AiBudget,
  ctx: CostResolutionContext,
): AiBudgetUpsertInput {
  const scope = record.scope;
  let siteId: string | null = null;
  let agentId: string | null = null;
  let modelId: string | null = null;
  let providerId: string | null = null;

  if (scope === 'site' && record.scopeId) siteId = ctx.siteIdByKey.get(record.scopeId) ?? null;
  if (scope === 'agent' && record.scopeId) agentId = ctx.agentIdByKey.get(record.scopeId) ?? null;
  if (scope === 'model' && record.scopeId) modelId = ctx.modelIdByKey.get(record.scopeId) ?? null;
  if (scope === 'provider' && record.scopeId) providerId = ctx.providerIdByKey.get(record.scopeId) ?? null;

  return {
    budget_key: record.id,
    name: record.name,
    scope_type: scope,
    scope_reference: scope === 'group' ? null : record.scopeId,
    site_id: siteId,
    agent_id: agentId,
    model_id: modelId,
    provider_id: providerId,
    environment: record.environment,
    period_type: 'monthly',
    currency: 'GBP',
    budget_amount: parseCurrency(record.monthlyLimit),
    warning_threshold_percent: record.warningThreshold,
    critical_threshold_percent: record.criticalThreshold,
    starts_at: record.startDate ? `${record.startDate}T00:00:00.000Z` : null,
    ends_at: record.reviewDate ? `${record.reviewDate}T00:00:00.000Z` : null,
    owner_team: record.ownerTeam || null,
    approval_required: false,
    is_active: true,
    notes: record.notes || null,
  };
}

const VALID_SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

function toSeverity(severity: string | null): Severity {
  if (severity && VALID_SEVERITIES.includes(severity as Severity)) {
    return severity as Severity;
  }
  return 'info';
}

// A budget event rendered for the UI, carrying its acknowledgement state so the
// caller can offer an acknowledge action (live mode only).
export type BudgetEventDisplay = BudgetAlert & {
  acknowledged?: boolean;
  acknowledgedBy?: string | null;
};

/**
 * Map a live `ai_budget_events` row to a `BudgetAlert`. The owning budget row
 * is used to derive the scope/linkage; `acknowledged` events are still shown
 * (labelled by the caller) so governance history is preserved.
 */
export function mapBudgetEventRowToAlert(
  row: AiBudgetEventRow,
  budget: AiBudgetRow | undefined,
  ctx: CostResolutionContext,
): BudgetEventDisplay {
  const scope = budget ? toBudgetScope(budget.scope_type) : 'group';
  const { scopeId, scopeLabel } = budget
    ? resolveScope(budget, ctx)
    : { scopeId: null, scopeLabel: 'Group-wide' };

  const relatedRecordType =
    scope === 'site' ? 'site'
      : scope === 'agent' ? 'agent'
        : scope === 'model' ? 'model'
          : scope === 'provider' ? 'provider'
            : null;

  return {
    id: row.event_key,
    scope,
    scopeId,
    scopeLabel,
    title: row.summary ?? row.event_type,
    severity: toSeverity(row.severity),
    currentSpend: formatCurrency(row.observed_amount),
    threshold: row.threshold_percent != null ? `${row.threshold_percent}%` : '—',
    forecast: formatCurrency(row.forecast_amount),
    suggestedAction: '',
    relatedRecordId: scopeId,
    relatedRecordType,
    acknowledged: row.acknowledged,
    acknowledgedBy: row.acknowledged_by,
  };
}