import { useState, useEffect } from 'react';
import type { RecurringCost, ProjectBudget, Project } from '../types';
import { COST_CATEGORIES, BILLING_CYCLE_OPTIONS } from '../types';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item: RecurringCost | null;
  budgets: ProjectBudget[];
  projects: Project[];
  defaultBudgetId?: number | null;
  defaultProjectId?: number | null;
}

export default function RecurringCostModal({ open, onClose, onSaved, item, budgets, projects, defaultBudgetId, defaultProjectId }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    budget_id: '',
    project_id: '',
    recurring_name: '',
    cost_category: 'Hosting',
    supplier_name: '',
    billing_cycle: 'monthly',
    monthly_cost: '0',
    yearly_cost: '0',
    next_payment_date: '',
    start_date: '',
    end_date: '',
    status: 'active',
    is_required_for_live_site: false,
    is_client_billable: false,
    auto_renew: true,
    notes: '',
  });

  useEffect(() => {
    if (item) {
      setForm({
        budget_id: item.budget_id ? String(item.budget_id) : '',
        project_id: item.project_id ? String(item.project_id) : '',
        recurring_name: item.recurring_name,
        cost_category: item.cost_category,
        supplier_name: item.supplier_name || '',
        billing_cycle: item.billing_cycle,
        monthly_cost: String(item.monthly_cost),
        yearly_cost: String(item.yearly_cost),
        next_payment_date: item.next_payment_date || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
        status: item.status,
        is_required_for_live_site: item.is_required_for_live_site,
        is_client_billable: item.is_client_billable,
        auto_renew: item.auto_renew,
        notes: item.notes || '',
      });
    } else {
      const budget = defaultBudgetId ? budgets.find((b) => b.id === defaultBudgetId) : null;
      setForm({
        budget_id: defaultBudgetId ? String(defaultBudgetId) : '',
        project_id: budget?.project_id ? String(budget.project_id) : (defaultProjectId ? String(defaultProjectId) : ''),
        recurring_name: '',
        cost_category: 'Hosting',
        supplier_name: '',
        billing_cycle: 'monthly',
        monthly_cost: '0',
        yearly_cost: '0',
        next_payment_date: '',
        start_date: '',
        end_date: '',
        status: 'active',
        is_required_for_live_site: false,
        is_client_billable: false,
        auto_renew: true,
        notes: '',
      });
    }
  }, [item, defaultBudgetId, defaultProjectId, budgets, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.recurring_name.trim()) return;
    setSaving(true);
    const data = {
      budget_id: form.budget_id ? Number(form.budget_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      recurring_name: form.recurring_name.trim(),
      cost_category: form.cost_category,
      supplier_name: form.supplier_name.trim() || null,
      billing_cycle: form.billing_cycle,
      monthly_cost: Number(form.monthly_cost) || 0,
      yearly_cost: Number(form.yearly_cost) || 0,
      next_payment_date: form.next_payment_date || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      is_required_for_live_site: form.is_required_for_live_site,
      is_client_billable: form.is_client_billable,
      auto_renew: form.auto_renew,
      notes: form.notes.trim() || null,
    };

    try {
      if (item) {
        const { error } = await supabase.from('internal_project_recurring_costs').update(data).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('internal_project_recurring_costs').insert(data);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save recurring cost:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-background-200 border-b border-background-400/60 px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="text-sm font-semibold text-foreground-50">{item ? 'Edit Recurring Cost' : 'Add Recurring Cost'}</h3>
          <button onClick={onClose} className="text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer">
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Budget</label>
              <select value={form.budget_id} onChange={(e) => { const b = budgets.find((x) => x.id === Number(e.target.value)); setForm({ ...form, budget_id: e.target.value, project_id: b?.project_id ? String(b.project_id) : form.project_id }); }} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                <option value="">No budget</option>
                {budgets.map((b) => <option key={b.id} value={String(b.id)}>{b.budget_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Project</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                <option value="">Select...</option>
                {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Name</label>
            <input type="text" value={form.recurring_name} onChange={(e) => setForm({ ...form, recurring_name: e.target.value })} placeholder="e.g. Vercel Hosting" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Category</label>
              <select value={form.cost_category} onChange={(e) => setForm({ ...form, cost_category: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {COST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Supplier</label>
              <input type="text" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="e.g. Vercel" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Billing Cycle</label>
              <select value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {BILLING_CYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Monthly Cost (£)</label>
              <input type="number" value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Yearly Cost (£)</label>
              <input type="number" value={form.yearly_cost} onChange={(e) => setForm({ ...form, yearly_cost: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Next Payment Date</label>
              <input type="date" value={form.next_payment_date} onChange={(e) => setForm({ ...form, next_payment_date: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer">
              <input type="checkbox" checked={form.is_required_for_live_site} onChange={(e) => setForm({ ...form, is_required_for_live_site: e.target.checked })} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
              Required for live site
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer">
              <input type="checkbox" checked={form.is_client_billable} onChange={(e) => setForm({ ...form, is_client_billable: e.target.checked })} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
              Client billable
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer">
              <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
              Auto-renew
            </label>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600 resize-none" placeholder="Any notes..." />
          </div>
        </div>

        <div className="sticky bottom-0 bg-background-200 border-t border-background-400/60 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="bg-background-400/50 text-foreground-200 text-sm font-medium px-4 py-2 rounded-full hover:bg-background-400/80 transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.recurring_name.trim()} className="bg-accent-500 text-background-950 text-sm font-semibold px-4 py-2 rounded-full hover:bg-accent-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Recurring'}
          </button>
        </div>
      </div>
    </div>
  );
}