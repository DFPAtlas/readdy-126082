import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { SupportTeam } from '@/types/support-tickets';
import type { TeamStaffOption } from '../hooks';
import { friendlyRpcError } from '../hooks';
import { ROLE_BADGE_COLORS, ROLE_LABELS, type Role } from '@/lib/permissions';

interface TeamMembersModalProps {
  open: boolean;
  onClose: () => void;
  team: SupportTeam | null;
  staff: TeamStaffOption[];
  onSaved: () => void;
}

export default function TeamMembersModal({ open, onClose, team, staff, onSaved }: TeamMembersModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load current members on open (table is readable by any internal role).
  useEffect(() => {
    let cancelled = false;
    if (open && team) {
      setSelected([]);
      setSearch('');
      setError('');
      supabase
        .from('internal_support_team_members')
        .select('staff_id')
        .eq('team_id', team.id)
        .then(({ data }) => {
          if (!cancelled && data) {
            setSelected(data.map((m) => m.staff_id));
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, team]);

  // Exclude viewers — they cannot work tickets and should not be team members.
  const selectable = useMemo(() => staff.filter((s) => s.role !== 'viewer'), [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter(
      (s) =>
        (s.full_name ?? '').toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q),
    );
  }, [selectable, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!team) return;
    setSaving(true);
    setError('');
    const { error: e } = await supabase.rpc('internal_set_team_members', {
      p_team_id: team.id,
      p_staff_ids: selected,
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
    <Modal open={open} onClose={onClose} title={`Manage Members — ${team?.name ?? ''}`} className="max-w-lg">
      <div className="p-5 flex flex-col max-h-[60vh]">
        <div className="relative mb-3 shrink-0">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff..."
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-xs text-foreground-500">{selected.length} selected</span>
          <button
            type="button"
            onClick={() => setSelected(filtered.map((s) => s.user_id))}
            className="text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Select all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border border-background-200/60 rounded-lg">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-foreground-500 text-center">No staff match.</p>
          ) : (
            filtered.map((s) => {
              const isSelected = selected.includes(s.user_id);
              const role = (s.role ?? 'viewer') as Role;
              return (
                <button
                  key={s.user_id}
                  type="button"
                  onClick={() => toggle(s.user_id)}
                  aria-pressed={isSelected}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background-100 transition-colors cursor-pointer border-b border-background-200/40 last:border-b-0"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-accent-500 border-accent-500 text-background-950' : 'border-background-300/60'
                    }`}
                  >
                    {isSelected && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-100 truncate">{s.full_name || s.email || s.user_id}</p>
                    {s.full_name && <p className="text-xs text-foreground-500 truncate">{s.email}</p>}
                  </div>
                  <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${ROLE_BADGE_COLORS[role] ?? ''}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3 shrink-0">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 shrink-0">
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
            {saving ? 'Saving...' : 'Save members'}
          </button>
        </div>
      </div>
    </Modal>
  );
}