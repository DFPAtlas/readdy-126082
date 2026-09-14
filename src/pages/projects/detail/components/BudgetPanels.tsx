import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CostItem, RecurringCost, BudgetEvent } from '@/pages/project-budget/types';
import type { PaymentRow } from '../budgetTypes';
import { isCostPaid, formatMoney } from '../budgetUtils';
import { formatDate } from '../utils';
import {
  PAYMENT_STATUS_COLORS,
  COST_STATUS_COLORS,
  BILLING_CYCLE_LABELS,
} from '@/pages/project-budget/types';

export function Panel({
  title,
  icon,
  subtitle,
  actions,
  children,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center shrink-0">
            <i className={`${icon} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
            {subtitle && <p className="text-[11px] text-foreground-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ note }: { note: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground-500 py-2">
      <i className="ri-information-line w-4 h-4 flex items-center justify-center text-foreground-600"></i>
      {note}
    </div>
  );
}

type CostFilter =
  | 'all'
  | 'required'
  | 'paid'
  | 'unpaid'
  | 'upcoming'
  | 'overdue'
  | 'one_off'
  | 'recurring';

const COST_FILTERS: { key: CostFilter; label: string }[] = [
  { key: 'all', label: 'All Costs' },
  { key: 'required', label: 'Required for Launch' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'one_off', label: 'One-Off' },
  { key: 'recurring', label: 'Recurring' },
];

function applyCostFilter(items: CostItem[], f: CostFilter): CostItem[] {
  const now = Date.now();
  switch (f) {
    case 'required':
      return items.filter((c) => c.is_required_for_launch);
    case 'paid':
      return items.filter((c) => isCostPaid(c));
    case 'unpaid':
      return items.filter((c) => !isCostPaid(c));
    case 'upcoming':
      return items.filter((c) => !isCostPaid(c) && c.due_date && new Date(c.due_date).getTime() >= now);
    case 'overdue':
      return items.filter((c) => !isCostPaid(c) && c.due_date && new Date(c.due_date).getTime() < now);
    case 'one_off':
      return items.filter((c) => c.cost_type === 'one_off');
    case 'recurring':
      return items.filter((c) => c.cost_type === 'recurring');
    default:
      return items;
  }
}

export function CostItemsPanel({
  costItems,
  unavailable,
  onEdit,
  onMarkPaid,
  saving,
}: {
  costItems: CostItem[];
  unavailable: boolean;
  onEdit: (c: CostItem) => void;
  onMarkPaid: (id: number) => void;
  saving: boolean;
}) {
  const [filter, setFilter] = useState<CostFilter>('all');
  const filtered = applyCostFilter(costItems, filter);

  return (
    <Panel
      title="Cost Items"
      icon="ri-money-pound-circle-line"
      subtitle={`${costItems.length} project cost item${costItems.length === 1 ? '' : 's'}`}
    >
      {unavailable ? (
        <EmptyState note="Cost data unavailable." />
      ) : (
        <>
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {COST_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
                  filter === f.key
                    ? 'bg-accent-500/10 text-accent-400'
                    : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState note={costItems.length === 0 ? 'No cost items recorded.' : 'No cost items match this filter.'} />
          ) : (
            <div className="divide-y divide-background-200/60">
              {filtered.map((c) => {
                const overdue =
                  !isCostPaid(c) && c.due_date && new Date(c.due_date).getTime() < Date.now();
                return (
                  <div key={c.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-heading font-semibold text-foreground-100">{c.cost_name}</span>
                          {c.is_required_for_launch && (
                            <span className="text-[10px] font-label text-accent-400 bg-accent-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">Launch</span>
                          )}
                          {overdue && (
                            <span className="text-[10px] font-label text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">Overdue</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-foreground-500 mb-1.5">
                          {c.cost_category && <span className="text-foreground-400">{c.cost_category}</span>}
                          {c.supplier_name && <span>· {c.supplier_name}</span>}
                          {c.cost_type && <span>· {c.cost_type === 'one_off' ? 'One-off' : 'Recurring'}</span>}
                          {c.due_date && <span>· Due {formatDate(c.due_date)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${PAYMENT_STATUS_COLORS[c.payment_status] || 'bg-foreground-500/10 text-foreground-400'}`}>
                            {c.payment_status.replace('_', ' ')}
                          </span>
                          <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${COST_STATUS_COLORS[c.cost_status] || 'bg-foreground-500/10 text-foreground-400'}`}>
                            {c.cost_status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-heading font-bold text-foreground-100">
                          {formatMoney(c.total_cost || c.actual_cost || c.estimated_cost || 0)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 justify-end">
                          {!isCostPaid(c) && c.cost_status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(c.id)}
                              disabled={saving}
                              className="text-[11px] font-label text-emerald-400 hover:text-emerald-300 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEdit(c)}
                            className="text-[11px] font-label text-foreground-400 hover:text-accent-400 cursor-pointer whitespace-nowrap"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export function RecurringCostsPanel({
  recurringCosts,
  unavailable,
  onEdit,
}: {
  recurringCosts: RecurringCost[];
  unavailable: boolean;
  onEdit: (r: RecurringCost) => void;
}) {
  const active = recurringCosts.filter((r) => r.status === 'active');
  const monthly = active.reduce((s, r) => s + (r.monthly_cost || 0), 0);
  const annual = active.reduce((s, r) => s + (r.yearly_cost || 0), 0);

  return (
    <Panel
      title="Recurring Costs"
      icon="ri-repeat-line"
      subtitle={`${recurringCosts.length} recurring record${recurringCosts.length === 1 ? '' : 's'}`}
    >
      {unavailable ? (
        <EmptyState note="Recurring cost data unavailable." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <StatTile label="Monthly Recurring" value={formatMoney(monthly)} />
            <StatTile label="Annual Recurring" value={formatMoney(annual)} />
            <StatTile label="Projected 12-Month" value={formatMoney(annual)} />
          </div>

          {recurringCosts.length === 0 ? (
            <EmptyState note="No recurring costs recorded." />
          ) : (
            <div className="divide-y divide-background-200/60">
              {recurringCosts.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-heading font-semibold text-foreground-100">{r.recurring_name}</span>
                        {r.is_required_for_live_site && (
                          <span className="text-[10px] font-label text-accent-400 bg-accent-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">Live</span>
                        )}
                        <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${
                          r.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : r.status === 'paused'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-foreground-500/10 text-foreground-400'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-foreground-500">
                        {r.cost_category && <span className="text-foreground-400">{r.cost_category}</span>}
                        {r.supplier_name && <span>· {r.supplier_name}</span>}
                        <span>· {BILLING_CYCLE_LABELS[r.billing_cycle] || r.billing_cycle}</span>
                        {r.next_payment_date && <span>· Next {formatDate(r.next_payment_date)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-heading font-bold text-foreground-100">
                        {formatMoney(r.monthly_cost || 0)}
                        <span className="text-xs font-normal text-foreground-500">/mo</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="text-[11px] font-label text-foreground-400 hover:text-accent-400 cursor-pointer whitespace-nowrap mt-1"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap mb-1">{label}</p>
      <p className="text-base font-heading font-bold text-foreground-100">{value}</p>
    </div>
  );
}

export function PaymentsPanel({
  upcoming,
  overdue,
}: {
  upcoming: PaymentRow[];
  overdue: PaymentRow[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="Upcoming Payments" icon="ri-calendar-line" subtitle={`${upcoming.length} due`}>
        {upcoming.length === 0 ? (
          <EmptyState note="No upcoming payments." />
        ) : (
          <div className="divide-y divide-background-200/60">
            {upcoming.map((p) => (
              <PaymentRowView key={p.id} p={p} />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Overdue Payments" icon="ri-alert-line" subtitle={`${overdue.length} overdue`}>
        {overdue.length === 0 ? (
          <EmptyState note="No overdue payments." />
        ) : (
          <div className="divide-y divide-background-200/60">
            {overdue.map((p) => (
              <PaymentRowView key={p.id} p={p} overdue />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PaymentRowView({ p, overdue }: { p: PaymentRow; overdue?: boolean }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-heading font-semibold text-foreground-100 truncate">{p.label}</span>
          <span className="text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap bg-background-200/60 text-foreground-500">
            {p.type === 'cost' ? 'Cost' : 'Recurring'}
          </span>
          {overdue && (
            <span className="text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap bg-red-500/10 text-red-400">Overdue</span>
          )}
        </div>
        <p className="text-xs text-foreground-500 truncate">
          {p.provider ? `${p.provider} · ` : ''}Due {formatDate(p.due)}
        </p>
      </div>
      <p className={`text-sm font-heading font-bold shrink-0 ${overdue ? 'text-red-400' : 'text-foreground-100'}`}>
        {formatMoney(p.amount)}
      </p>
    </div>
  );
}

export function EventsPanel({ events, unavailable }: { events: BudgetEvent[]; unavailable: boolean }) {
  return (
    <Panel title="Budget Events" icon="ri-history-line" subtitle={`${events.length} event${events.length === 1 ? '' : 's'}`}>
      {unavailable ? (
        <EmptyState note="Budget event data unavailable." />
      ) : events.length === 0 ? (
        <EmptyState note="No budget events recorded." />
      ) : (
        <div className="divide-y divide-background-200/60">
          {events.slice(0, 20).map((e) => (
            <div key={e.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground-100">{e.event_title || e.event_type}</p>
                <p className="text-xs text-foreground-500 truncate">
                  {formatDate(e.created_at)}
                  {e.created_by ? ` · ${e.created_by}` : ''}
                </p>
              </div>
              {e.amount ? (
                <p className="text-sm font-heading font-bold text-foreground-100 shrink-0">{formatMoney(e.amount)}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}