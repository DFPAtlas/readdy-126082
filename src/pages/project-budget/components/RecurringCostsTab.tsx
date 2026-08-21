import { useState } from 'react';
import type { RecurringCost, Project } from '../types';
import { COST_CATEGORIES, BILLING_CYCLE_LABELS } from '../types';

interface Props {
  recurringCosts: RecurringCost[];
  projects: Project[];
  getProjectName: (id: number | null) => string;
  onEdit: (item: RecurringCost) => void;
}

export default function RecurringCostsTab({ recurringCosts, projects, getProjectName, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = recurringCosts.filter((r) => {
    const q = search.toLowerCase();
    if (q && !r.recurring_name.toLowerCase().includes(q) && !(r.supplier_name || '').toLowerCase().includes(q)) return false;
    if (projectFilter !== 'all' && String(r.project_id) !== projectFilter) return false;
    if (categoryFilter !== 'all' && r.cost_category !== categoryFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const activeRecurring = filtered.filter((r) => r.status === 'active');
  const monthlyTotal = activeRecurring.reduce((s, r) => s + r.monthly_cost, 0);
  const yearlyTotal = activeRecurring.reduce((s, r) => s + r.yearly_cost, 0);
  const now = new Date();
  const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingPayments = activeRecurring.filter((r) => r.next_payment_date && new Date(r.next_payment_date) <= fourteenDays);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Monthly Total</span>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">£{monthlyTotal.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Yearly Total</span>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">£{yearlyTotal.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Active Subs</span>
          <p className="text-lg font-heading font-bold text-accent-400 mt-1">{activeRecurring.length}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Due in 14d</span>
          <p className="text-lg font-heading font-bold text-amber-400 mt-1">{upcomingPayments.length}</p>
        </div>
      </div>

      {/* Upcoming payments */}
      {upcomingPayments.length > 0 && (
        <div className="bg-sky-500/5 border border-sky-500/15 rounded-lg px-4 py-3">
          <p className="text-sm text-sky-300 font-medium mb-2">Upcoming payments (next 14 days)</p>
          <div className="space-y-1.5">
            {upcomingPayments.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0"></span>
                  <span className="text-sky-200">{r.recurring_name}</span>
                  <span className="text-sky-400/50">{getProjectName(r.project_id)}</span>
                </div>
                <span className="text-sky-300 font-medium whitespace-nowrap">£{r.monthly_cost} — {new Date(r.next_payment_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recurring costs..." className="w-full pl-9 pr-3 py-2 bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40" />
        </div>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Categories</option>
          {COST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-400">No recurring costs match your filters.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/60">
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Project</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Category</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Supplier</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Cycle</th>
                <th className="text-right px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Monthly</th>
                <th className="text-right px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Yearly</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Next Payment</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="text-center px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-foreground-200 font-medium truncate max-w-[160px]">{r.recurring_name}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{getProjectName(r.project_id)}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{r.cost_category}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{r.supplier_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{BILLING_CYCLE_LABELS[r.billing_cycle] || r.billing_cycle}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-200 text-right whitespace-nowrap font-medium">£{r.monthly_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-300 text-right whitespace-nowrap">£{r.yearly_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{r.next_payment_date ? new Date(r.next_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${
                        r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        r.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-foreground-500/10 text-foreground-400'
                      }`}>{r.status}</span>
                      {r.auto_renew && <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 whitespace-nowrap">AUTO</span>}
                      {r.is_required_for_live_site && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 whitespace-nowrap">LIVE</span>}
                      {r.is_client_billable && <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 whitespace-nowrap">BILL</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => onEdit(r)} className="text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer">
                      <i className="ri-edit-line text-xs w-3 h-3 flex items-center justify-center"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}