import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCosts } from '@/pages/ai-operations/costs/CostsContext';
import type { AiBudget, BudgetScope, BudgetStatus } from '@/pages/ai-operations/types';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import BudgetFormModal from '@/pages/ai-operations/costs/components/BudgetFormModal';
import {
  BUDGET_STATUS,
  BUDGET_STATUS_OPTIONS,
  BUDGET_SCOPE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';

const SITES = [
  { id: 'digital-footprint', label: 'Digital Footprint' },
  { id: 'quickguard', label: 'QuickGuard' },
  { id: 'guardianhub', label: 'GuardianHub' },
  { id: 'lethub', label: 'LetHub' },
  { id: 'wedora', label: 'Wedora' },
  { id: 'the-forge', label: 'The Forge' },
];

const selectCls =
  'bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-xs font-label text-foreground-200 outline-none focus:border-accent-500/40 transition-colors cursor-pointer';

export default function BudgetsPage() {
  const { budgets, addBudget, updateBudget } = useCosts();
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiBudget | null>(null);

  const filtered = useMemo(() => {
    return budgets.filter((b) => {
      if (scopeFilter !== 'all' && b.scope !== scopeFilter) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (environmentFilter !== 'all' && b.environment !== environmentFilter) return false;
      if (siteFilter !== 'all' && b.scope === 'site' && b.scopeId !== siteFilter) return false;
      return true;
    });
  }, [budgets, scopeFilter, siteFilter, statusFilter, environmentFilter]);

  const hasFilters = scopeFilter !== 'all' || siteFilter !== 'all' || statusFilter !== 'all' || environmentFilter !== 'all';

  const clearFilters = () => {
    setScopeFilter('all');
    setSiteFilter('all');
    setStatusFilter('all');
    setEnvironmentFilter('all');
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (b: AiBudget) => {
    setEditing(b);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Budgets</h1>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Demo budget governance for sites, agents, models, providers and environments. No spend limits are enforced.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/ai-operations/costs"
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
            Cost Overview
          </Link>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
            Add Budget
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} className={selectCls}>
          <option value="all">All scopes</option>
          {(Object.keys(BUDGET_SCOPE_LABELS) as BudgetScope[]).map((s) => (
            <option key={s} value={s}>{BUDGET_SCOPE_LABELS[s]}</option>
          ))}
        </select>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className={selectCls}>
          <option value="all">All sites</option>
          {SITES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="all">All statuses</option>
          {BUDGET_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{BUDGET_STATUS[s].label}</option>
          ))}
        </select>
        <select value={environmentFilter} onChange={(e) => setEnvironmentFilter(e.target.value)} className={selectCls}>
          <option value="all">All environments</option>
          {ENVIRONMENT_OPTIONS.map((env) => (
            <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-label text-foreground-300 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-close-circle-line w-4 h-4 flex items-center justify-center"></i>
            Clear Filters
          </button>
        )}
      </div>

      <section aria-label="Budget registry" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
                <th className="py-2 pr-4 font-medium">Budget</th>
                <th className="py-2 px-4 font-medium">Scope</th>
                <th className="py-2 px-4 font-medium">Limit</th>
                <th className="py-2 px-4 font-medium">Current</th>
                <th className="py-2 px-4 font-medium">Remaining</th>
                <th className="py-2 px-4 font-medium">Forecast</th>
                <th className="py-2 px-4 font-medium">Threshold</th>
                <th className="py-2 px-4 font-medium">Status</th>
                <th className="py-2 pl-4 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="py-2.5 pr-4">
                    <p className="text-foreground-100 font-label whitespace-nowrap">{b.name}</p>
                    <p className="text-[11px] text-foreground-500">{b.ownerTeam}</p>
                  </td>
                  <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{b.scopeLabel}</td>
                  <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{b.monthlyLimit}</td>
                  <td className="py-2.5 px-4 text-foreground-100">{b.currentSpend}</td>
                  <td className="py-2.5 px-4 text-foreground-300">{b.remaining}</td>
                  <td className="py-2.5 px-4 text-foreground-300">{b.forecast}</td>
                  <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{b.warningThreshold}% / {b.criticalThreshold}%</td>
                  <td className="py-2.5 px-4">
                    <StatusPill tone={BUDGET_STATUS[b.status].tone} label={BUDGET_STATUS[b.status].label} />
                  </td>
                  <td className="py-2.5 pl-4 text-right">
                    <button
                      onClick={() => openEdit(b)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-foreground-400 hover:text-foreground-100 hover:bg-background-200/60 transition-colors duration-150 cursor-pointer"
                      title="Edit budget"
                    >
                      <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="border border-background-200/60 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-label font-semibold text-foreground-100">{b.name}</p>
                  <p className="text-[11px] text-foreground-500">{b.scopeLabel} · {b.ownerTeam}</p>
                </div>
                <button
                  onClick={() => openEdit(b)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-foreground-400 hover:text-foreground-100 cursor-pointer"
                >
                  <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                <span className="text-foreground-500">Limit</span><span className="text-foreground-300 text-right">{b.monthlyLimit}</span>
                <span className="text-foreground-500">Current</span><span className="text-foreground-300 text-right">{b.currentSpend}</span>
                <span className="text-foreground-500">Remaining</span><span className="text-foreground-300 text-right">{b.remaining}</span>
                <span className="text-foreground-500">Forecast</span><span className="text-foreground-300 text-right">{b.forecast}</span>
              </div>
              <StatusPill tone={BUDGET_STATUS[b.status].tone} label={BUDGET_STATUS[b.status].label} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-foreground-500 text-center py-8">No budgets match the current filters.</p>
        )}
      </section>

      <BudgetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        budget={editing}
        onSave={(record) => {
          if (editing) updateBudget(editing.id, record);
          else addBudget(record);
        }}
      />
    </div>
  );
}