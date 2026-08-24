import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { SupportTeam, RoutingStrategy } from '@/types/support-tickets';
import type { TeamStaffOption } from '../hooks';
import { friendlyRpcError } from '../hooks';
import {
  ROUTING_STRATEGY_OPTIONS,
  routingStrategyLabels,
  routingStrategyDescriptions,
} from '../constants';

interface TeamFormModalProps {
  open: boolean;
  onClose: () => void;
  team: SupportTeam | null; // null = create
  staff: TeamStaffOption[];
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  manager_id: string;
  routing_strategy: RoutingStrategy;
}

const empty: FormState = { name: '', description: '', manager_id: '', routing_strategy: 'manual' };

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

export default function TeamFormModal({ open, onClose, team, staff, onSaved }: TeamFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(
        team
          ? {
              name: team.name,
              description: team.description ?? '',
              manager_id: team.manager_id ?? '',
              routing_strategy: team.routing_strategy,
            }
          : empty,
      );
      setError('');
    }
  }, [open, team]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Team name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: e } = await supabase.rpc('internal_upsert_support_team', {
      p_team_id: team?.id ?? null,
      p_name: form.name.trim(),
      p_description: form.description.trim() || null,
      p_manager_id: form.manager_id || null,
      p_routing_strategy: form.routing_strategy,
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
    <Modal open={open} onClose={onClose} title={team ? 'Edit Team' : 'New Team'} className="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Team name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Technical Support"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={2}
            maxLength={500}
            placeholder="What this team handles..."
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Manager</label>
            <select
              value={form.manager_id}
              onChange={(e) => set({ manager_id: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">No manager</option>
              {staff.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name || s.email || s.user_id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Routing strategy</label>
            <select
              value={form.routing_strategy}
              onChange={(e) => set({ routing_strategy: e.target.value as RoutingStrategy })}
              className={`${inputCls} cursor-pointer`}
            >
              {ROUTING_STRATEGY_OPTIONS.map((s) => (
                <option key={s} value={s}>{routingStrategyLabels[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-foreground-500 leading-relaxed">
          {routingStrategyDescriptions[form.routing_strategy]}
        </p>

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
            {saving ? 'Saving...' : team ? 'Save changes' : 'Create team'}
          </button>
        </div>
      </div>
    </Modal>
  );
}