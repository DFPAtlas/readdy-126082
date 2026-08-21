import { useState, useEffect } from 'react';
import type { CostItem, ProjectBudget, Project } from '../types';
import { COST_CATEGORIES, PAYMENT_STATUS_OPTIONS, COST_STATUS_OPTIONS } from '../types';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item: CostItem | null;
  budgets: ProjectBudget[];
  projects: Project[];
  defaultBudgetId?: number | null;
  defaultProjectId?: number | null;
}

export default function CostItemModal({ open, onClose, onSaved, item, budgets, projects, defaultBudgetId, defaultProjectId }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    budget_id: '',
    project_id: '',
    cost_name: '',
    cost_category: 'Development',
    cost_type: 'one_off',
    supplier_name: '',
    description: '',
    estimated_cost: '0',
    actual_cost: '0',
    vat_amount: '0',
    total_cost: '0',
    payment_status: 'unpaid',
    cost_status: 'planned',
    is_required_for_launch: false,
    is_client_billable: false,
    invoice_reference: '',
    receipt_url: '',
    due_date: '',
    paid_date: '',
    owner: '',
    notes: '',
  });

  useEffect(() => {
    if (item) {
      setForm({
        budget_id: item.budget_id ? String(item.budget_id) : '',
        project_id: item.project_id ? String(item.project_id) : '',
        cost_name: item.cost_name,
        cost_category: item.cost_category,
        cost_type: item.cost_type,
        supplier_name: item.supplier_name || '',
        description: item.description || '',
        estimated_cost: String(item.estimated_cost),
        actual_cost: String(item.actual_cost),
        vat_amount: String(item.vat_amount),
        total_cost: String(item.total_cost),
        payment_status: item.payment_status,
        cost_status: item.cost_status,
        is_required_for_launch: item.is_required_for_launch,
        is_client_billable: item.is_client_billable,
        invoice_reference: item.invoice_reference || '',
        receipt_url: item.receipt_url || '',
        due_date: item.due_date || '',
        paid_date: item.paid_date || '',
        owner: item.owner || '',
        notes: item.notes || '',
      });
    } else {
      const budget = defaultBudgetId ? budgets.find((b) => b.id === defaultBudgetId) : null;
      setForm({
        budget_id: defaultBudgetId ? String(defaultBudgetId) : '',
        project_id: budget?.project_id ? String(budget.project_id) : (defaultProjectId ? String(defaultProjectId) : ''),
        cost_name: '',
        cost_category: 'Development',
        cost_type: 'one_off',
        supplier_name: '',
        description: '',
        estimated_cost: '0',
        actual_cost: '0',
        vat_amount: '0',
        total_cost: '0',
        payment_status: 'unpaid',
        cost_status: 'planned',
        is_required_for_launch: false,
        is_client_billable: false,
        invoice_reference: '',
        receipt_url: '',
        due_date: '',
        paid_date: '',
        owner: '',
        notes: '',
      });
    }
  }, [item, defaultBudgetId, defaultProjectId, budgets, open]);

  if (!open) return null;

  const pid = form.project_id ? Number(form.project_id) : null;

  const handleSave = async () => {
    if (!form.cost_name.trim()) return;
    setSaving(true);
    const data = {
      budget_id: form.budget_id ? Number(form.budget_id) : null,
      project_id: pid,
      cost_name: form.cost_name.trim(),
      cost_category: form.cost_category,
      cost_type: form.cost_type,
      supplier_name: form.supplier_name.trim() || null,
      description: form.description.trim() || null,
      estimated_cost: Number(form.estimated_cost) || 0,
      actual_cost: Number(form.actual_cost) || 0,
      vat_amount: Number(form.vat_amount) || 0,
      total_cost: Number(form.total_cost) || 0,
      payment_status: form.payment_status,
      cost_status: form.cost_status,
      is_required_for_launch: form.is_required_for_launch,
      is_client_billable: form.is_client_billable,
      invoice_reference: form.invoice_reference.trim() || null,
      receipt_url: form.receipt_url.trim() || null,
      due_date: form.due_date || null,
      paid_date: form.paid_date || null,
      owner: form.owner.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (item) {
        const { error } = await supabase.from('internal_project_cost_items').update(data).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('internal_project_cost_items').insert(data);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save cost item:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-background-200 border-b border-background-400/60 px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="text-sm font-semibold text-foreground-50">{item ? 'Edit Cost Item' : 'Add Cost'}</h3>
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
            <label className="block text-xs text-foreground-500 mb-1">Cost Name</label>
            <input type="text" value={form.cost_name} onChange={(e) => setForm({ ...form, cost_name: e.target.value })} placeholder="e.g. Dashboard UI Design" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Category</label>
              <select value={form.cost_category} onChange={(e) => setForm({ ...form, cost_category: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {COST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Type</label>
              <select value={form.cost_type} onChange={(e) => setForm({ ...form, cost_type: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                <option value="one_off">One-Off</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Supplier Name</label>
            <input type="text" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="e.g. DesignStudio" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600 resize-none" placeholder="Brief description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Est. Cost (£)</label>
              <input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Actual Cost (£)</label>
              <input type="number" value={form.actual_cost} onChange={(e) => setForm({ ...form, actual_cost: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">VAT (£)</label>
              <input type="number" value={form.vat_amount} onChange={(e) => setForm({ ...form, vat_amount: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Total Cost (£)</label>
              <input type="number" value={form.total_cost} onChange={(e) => setForm({ ...form, total_cost: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Payment Status</label>
              <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Cost Status</label>
              <select value={form.cost_status} onChange={(e) => setForm({ ...form, cost_status: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {COST_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Paid Date</label>
              <input type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Invoice Reference</label>
            <input type="text" value={form.invoice_reference} onChange={(e) => setForm({ ...form, invoice_reference: e.target.value })} placeholder="e.g. INV-2026-001" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer">
              <input type="checkbox" checked={form.is_required_for_launch} onChange={(e) => setForm({ ...form, is_required_for_launch: e.target.checked })} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
              Required for launch
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground-400 cursor-pointer">
              <input type="checkbox" checked={form.is_client_billable} onChange={(e) => setForm({ ...form, is_client_billable: e.target.checked })} className="w-3.5 h-3.5 rounded accent-accent-500 cursor-pointer" />
              Client billable
            </label>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600 resize-none" placeholder="Any notes..." />
          </div>
        </div>

        <div className="sticky bottom-0 bg-background-200 border-t border-background-400/60 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="bg-background-400/50 text-foreground-200 text-sm font-medium px-4 py-2 rounded-full hover:bg-background-400/80 transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.cost_name.trim()} className="bg-accent-500 text-background-950 text-sm font-semibold px-4 py-2 rounded-full hover:bg-accent-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Cost'}
          </button>
        </div>
      </div>
    </div>
  );
}