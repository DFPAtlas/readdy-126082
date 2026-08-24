import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { SupportRoutingRule, SupportTeam } from '@/types/support-tickets';
import type { SiteOption } from '@/pages/support-teams/hooks';
import { friendlyRpcError } from '@/pages/support-teams/hooks';
import {
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  categoryLabels,
  priorityLabels,
} from '@/pages/support-tickets/constants';

interface RoutingRuleFormModalProps {
  open: boolean;
  onClose: () => void;
  rule: SupportRoutingRule | null; // null = create
  teams: SupportTeam[];
  sites: SiteOption[];
  onSaved: () => void;
}

interface FormState {
  name: string;
  rule_order: string;
  is_active: boolean;
  site_id: string;
  category: string;
  priority: string;
  keywords: string;
  match_security: boolean;
  match_billing: boolean;
  team_id: string;
  suggested_priority: string;
  requires_escalation: boolean;
}

const empty: FormState = {
  name: '',
  rule_order: '100',
  is_active: true,
  site_id: '',
  category: '',
  priority: '',
  keywords: '',
  match_security: false,
  match_billing: false,
  team_id: '',
  suggested_priority: '',
  requires_escalation: false,
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="flex items-center gap-2 text-sm text-foreground-300 hover:text-foreground-100 transition-colors cursor-pointer"
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          checked ? 'bg-accent-500 border-accent-500 text-background-950' : 'border-background-300/60'
        }`}
      >
        {checked && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
      </span>
      {label}
    </button>
  );
}

export default function RoutingRuleFormModal({
  open,
  onClose,
  rule,
  teams,
  sites,
  onSaved,
}: RoutingRuleFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(
        rule
          ? {
              name: rule.name,
              rule_order: String(rule.rule_order),
              is_active: rule.is_active,
              site_id: rule.site_id ?? '',
              category: rule.category ?? '',
              priority: rule.priority ?? '',
              keywords: rule.keywords ?? '',
              match_security: rule.match_security,
              match_billing: rule.match_billing,
              team_id: rule.team_id,
              suggested_priority: rule.suggested_priority ?? '',
              requires_escalation: rule.requires_escalation,
            }
          : empty,
      );
      setError('');
    }
  }, [open, rule]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Rule name is required.');
      return;
    }
    if (!form.team_id) {
      setError('Select a team to route to.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: e } = await supabase.rpc('internal_upsert_routing_rule', {
      p_rule_id: rule?.id ?? null,
      p_name: form.name.trim(),
      p_rule_order: Number(form.rule_order) || 100,
      p_is_active: form.is_active,
      p_site_id: form.site_id || null,
      p_category: form.category || null,
      p_priority: form.priority || null,
      p_keywords: form.keywords.trim() || null,
      p_match_security: form.match_security,
      p_match_billing: form.match_billing,
      p_team_id: form.team_id,
      p_suggested_priority: form.suggested_priority || null,
      p_requires_escalation: form.requires_escalation,
    });
    setSaving(false);
    if (e) {
      setError(friendlyRpcError(e));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={rule ? 'Edit Routing Rule' : 'New Routing Rule'} className="max-w-lg">
      <div className="p-5 space-y-4">
        <p className="text-xs font-label text-foreground-500 uppercase tracking-wider">When</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-label text-foreground-500 mb-1">Rule name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Forge Technical Support"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site</label>
            <select
              value={form.site_id}
              onChange={(e) => set({ site_id: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Any site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.site_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Any category</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set({ priority: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Any priority</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{priorityLabels[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Order</label>
            <input
              type="number"
              value={form.rule_order}
              onChange={(e) => set({ rule_order: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-label text-foreground-500 mb-1">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={form.keywords}
              onChange={(e) => set({ keywords: e.target.value })}
              placeholder="login, api, error"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-5 flex-wrap">
            <CheckRow label="Security issue" checked={form.match_security} onChange={(v) => set({ match_security: v })} />
            <CheckRow label="Billing issue" checked={form.match_billing} onChange={(v) => set({ match_billing: v })} />
          </div>
        </div>

        <p className="text-xs font-label text-foreground-500 uppercase tracking-wider pt-1">Then</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Route to team *</label>
            <select
              value={form.team_id}
              onChange={(e) => set({ team_id: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="" disabled>Select a team</option>
              {teams
                .filter((t) => t.status === 'active')
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Suggested priority</label>
            <select
              value={form.suggested_priority}
              onChange={(e) => set({ suggested_priority: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Keep existing</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{priorityLabels[p]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-5 flex-wrap">
          <CheckRow
            label="Requires escalation"
            checked={form.requires_escalation}
            onChange={(v) => set({ requires_escalation: v })}
          />
          <CheckRow label="Enabled" checked={form.is_active} onChange={(v) => set({ is_active: v })} />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {saving ? 'Saving...' : rule ? 'Save rule' : 'Create rule'}
          </button>
        </div>
      </div>
    </Modal>
  );
}