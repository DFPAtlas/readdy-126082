import { useState, useEffect } from 'react';
import type { ProjectBudget, Project } from '../types';
import { BUDGET_STATUS_OPTIONS, BUDGET_TYPE_OPTIONS } from '../types';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  budget: ProjectBudget | null;
  projects: Project[];
}

export default function BudgetModal({ open, onClose, onSaved, budget, projects }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_id: '',
    budget_name: '',
    budget_status: 'active',
    budget_type: 'internal_project',
    initial_budget: '0',
    approved_budget: '0',
    forecast_revenue_monthly: '0',
    forecast_revenue_yearly: '0',
    target_launch_date: '',
    owner: '',
    notes: '',
  });

  useEffect(() => {
    if (budget) {
      setForm({
        project_id: budget.project_id ? String(budget.project_id) : '',
        budget_name: budget.budget_name,
        budget_status: budget.budget_status,
        budget_type: budget.budget_type,
        initial_budget: String(budget.initial_budget),
        approved_budget: String(budget.approved_budget),
        forecast_revenue_monthly: String(budget.forecast_revenue_monthly),
        forecast_revenue_yearly: String(budget.forecast_revenue_yearly),
        target_launch_date: budget.target_launch_date || '',
        owner: budget.owner || '',
        notes: budget.notes || '',
      });
    } else {
      setForm({
        project_id: '',
        budget_name: '',
        budget_status: 'active',
        budget_type: 'internal_project',
        initial_budget: '0',
        approved_budget: '0',
        forecast_revenue_monthly: '0',
        forecast_revenue_yearly: '0',
        target_launch_date: '',
        owner: '',
        notes: '',
      });
    }
  }, [budget, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.budget_name.trim()) return;
    setSaving(true);
    try {
      const data = {
        project_id: form.project_id ? Number(form.project_id) : null,
        budget_name: form.budget_name.trim(),
        budget_status: form.budget_status,
        budget_type: form.budget_type,
        initial_budget: Number(form.initial_budget) || 0,
        approved_budget: Number(form.approved_budget) || 0,
        forecast_revenue_monthly: Number(form.forecast_revenue_monthly) || 0,
        forecast_revenue_yearly: Number(form.forecast_revenue_yearly) || 0,
        target_launch_date: form.target_launch_date || null,
        owner: form.owner.trim() || null,
        notes: form.notes.trim() || null,
        created_by: budget?.created_by || null,
      };

      if (budget) {
        const { error } = await supabase.from('internal_project_budgets').update(data).eq('id', budget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('internal_project_budgets').insert(data);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save budget:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-background-200 border-b border-background-400/60 px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="text-sm font-semibold text-foreground-50">{budget ? 'Edit Budget' : 'New Budget'}</h3>
          <button onClick={onClose} className="text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer">
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Project</label>
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
              <option value="">Select a project...</option>
              {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Budget Name</label>
            <input type="text" value={form.budget_name} onChange={(e) => setForm({ ...form, budget_name: e.target.value })} placeholder="e.g. Digital Footprint CC Build" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Status</label>
              <select value={form.budget_status} onChange={(e) => setForm({ ...form, budget_status: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {BUDGET_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Type</label>
              <select value={form.budget_type} onChange={(e) => setForm({ ...form, budget_type: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 cursor-pointer">
                {BUDGET_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Initial Budget (£)</label>
              <input type="number" value={form.initial_budget} onChange={(e) => setForm({ ...form, initial_budget: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Approved Budget (£)</label>
              <input type="number" value={form.approved_budget} onChange={(e) => setForm({ ...form, approved_budget: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Forecast Revenue/mo (£)</label>
              <input type="number" value={form.forecast_revenue_monthly} onChange={(e) => setForm({ ...form, forecast_revenue_monthly: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Forecast Revenue/yr (£)</label>
              <input type="number" value={form.forecast_revenue_yearly} onChange={(e) => setForm({ ...form, forecast_revenue_yearly: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Target Launch Date</label>
              <input type="date" value={form.target_launch_date} onChange={(e) => setForm({ ...form, target_launch_date: e.target.value })} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40" />
            </div>
            <div>
              <label className="block text-xs text-foreground-500 mb-1">Owner</label>
              <input type="text" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="e.g. Alex" className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-foreground-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-background-50 border border-background-200/60 rounded-lg text-sm text-foreground-200 px-3 py-2 focus:outline-none focus:border-accent-500/40 placeholder:text-foreground-600 resize-none" placeholder="Any notes..." />
          </div>
        </div>

        <div className="sticky bottom-0 bg-background-200 border-t border-background-400/60 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="bg-background-400/50 text-foreground-200 text-sm font-medium px-4 py-2 rounded-full hover:bg-background-400/80 transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.budget_name.trim()} className="bg-accent-500 text-background-950 text-sm font-semibold px-4 py-2 rounded-full hover:bg-accent-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : budget ? 'Save Changes' : 'Create Budget'}
          </button>
        </div>
      </div>
    </div>
  );
}