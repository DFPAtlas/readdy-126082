import { useState } from 'react';
import type { CostItem, Project } from '../types';
import { COST_CATEGORIES, PAYMENT_STATUS_COLORS, COST_STATUS_COLORS, PAYMENT_STATUS_OPTIONS, COST_STATUS_OPTIONS } from '../types';

interface Props {
  costItems: CostItem[];
  projects: Project[];
  getProjectName: (id: number | null) => string;
  onEdit: (item: CostItem) => void;
}

export default function CostItemsTab({ costItems, projects, getProjectName, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [costStatusFilter, setCostStatusFilter] = useState('all');
  const [launchOnly, setLaunchOnly] = useState(false);
  const [billableOnly, setBillableOnly] = useState(false);

  const filtered = costItems.filter((c) => {
    const q = search.toLowerCase();
    if (q && !c.cost_name.toLowerCase().includes(q) && !(c.supplier_name || '').toLowerCase().includes(q) && !(c.invoice_reference || '').toLowerCase().includes(q)) return false;
    if (projectFilter !== 'all' && String(c.project_id) !== projectFilter) return false;
    if (categoryFilter !== 'all' && c.cost_category !== categoryFilter) return false;
    if (paymentFilter !== 'all' && c.payment_status !== paymentFilter) return false;
    if (costStatusFilter !== 'all' && c.cost_status !== costStatusFilter) return false;
    if (launchOnly && !c.is_required_for_launch) return false;
    if (billableOnly && !c.is_client_billable) return false;
    return true;
  });

  const totals = filtered.reduce((acc, c) => ({
    estimated: acc.estimated + c.estimated_cost,
    actual: acc.actual + c.actual_cost,
    vat: acc.vat + c.vat_amount,
    total: acc.total + c.total_cost,
  }), { estimated: 0, actual: 0, vat: 0, total: 0 });

  return (
    <div className="space-y-4">
      {/* Totals row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase">Est. Total</span>
          <p className="text-lg font-heading font-bold text-foreground-100">£{totals.estimated.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase">Actual Total</span>
          <p className="text-lg font-heading font-bold text-foreground-100">£{totals.actual.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase">VAT</span>
          <p className="text-lg font-heading font-bold text-foreground-100">£{totals.vat.toLocaleString()}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase">Full Total</span>
          <p className="text-lg font-heading font-bold text-foreground-100">£{totals.total.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search costs..." className="w-full pl-9 pr-3 py-2 bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 placeholder:text-foreground-600 focus:outline-none focus:border-accent-500/40" />
        </div>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Categories</option>
          {COST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Payments</option>
          {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={costStatusFilter} onChange={(e) => setCostStatusFilter(e.target.value)} className="bg-background-100 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
          <option value="all">All Cost Status</option>
          {COST_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={launchOnly} onChange={(e) => setLaunchOnly(e.target.checked)} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
          Launch only
        </label>
        <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={billableOnly} onChange={(e) => setBillableOnly(e.target.checked)} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
          Billable only
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-400">No cost items match your filters.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/60">
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Cost Name</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Project</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Category</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Supplier</th>
                <th className="text-right px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Est.</th>
                <th className="text-right px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Actual</th>
                <th className="text-right px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">VAT</th>
                <th className="text-right px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Total</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Payment</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Due</th>
                <th className="text-center px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-foreground-200 font-medium truncate max-w-[180px]">{c.cost_name}</p>
                    {c.description && <p className="text-[10px] text-foreground-600 truncate max-w-[180px]">{c.description}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{getProjectName(c.project_id)}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{c.cost_category}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{c.supplier_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-300 text-right whitespace-nowrap">£{c.estimated_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-200 text-right whitespace-nowrap font-medium">£{c.actual_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 text-right whitespace-nowrap">£{c.vat_amount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground-200 text-right whitespace-nowrap font-medium">£{c.total_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-label px-1.5 py-0.5 rounded ${PAYMENT_STATUS_COLORS[c.payment_status] || ''} whitespace-nowrap`}>{c.payment_status}</span></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-label px-1.5 py-0.5 rounded ${COST_STATUS_COLORS[c.cost_status] || ''} whitespace-nowrap`}>{c.cost_status}</span></td>
                  <td className="px-4 py-2.5 text-xs text-foreground-400 whitespace-nowrap">{c.due_date ? new Date(c.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {c.is_required_for_launch && <span className="text-[9px] font-label px-1 py-0.5 rounded bg-red-500/10 text-red-400 whitespace-nowrap">LAUNCH</span>}
                      {c.is_client_billable && <span className="text-[9px] font-label px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 whitespace-nowrap">BILL</span>}
                      <button onClick={() => onEdit(c)} className="text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer">
                        <i className="ri-edit-line text-xs w-3 h-3 flex items-center justify-center"></i>
                      </button>
                    </div>
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