import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { SupportTeam } from '@/types/support-tickets';
import type { SiteOption } from '../hooks';
import { friendlyRpcError } from '../hooks';

interface TeamSitesModalProps {
  open: boolean;
  onClose: () => void;
  team: SupportTeam | null;
  sites: SiteOption[];
  onSaved: () => void;
}

export default function TeamSitesModal({ open, onClose, team, sites, onSaved }: TeamSitesModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (open && team) {
      setSelected([]);
      setSearch('');
      setError('');
      supabase
        .from('internal_support_team_sites')
        .select('site_id')
        .eq('team_id', team.id)
        .then(({ data }) => {
          if (!cancelled && data) {
            setSelected(data.map((m) => m.site_id));
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, team]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => s.site_name.toLowerCase().includes(q));
  }, [sites, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!team) return;
    setSaving(true);
    setError('');
    const { error: e } = await supabase.rpc('internal_set_team_sites', {
      p_team_id: team.id,
      p_site_ids: selected,
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
    <Modal open={open} onClose={onClose} title={`Manage Sites — ${team?.name ?? ''}`} className="max-w-lg">
      <div className="p-5 flex flex-col max-h-[60vh]">
        <div className="relative mb-3 shrink-0">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites..."
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <p className="text-xs text-foreground-500 mb-2 shrink-0">
          This team will only receive tickets for the selected sites.
        </p>

        <div className="flex-1 overflow-y-auto border border-background-200/60 rounded-lg">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-foreground-500 text-center">No sites available.</p>
          ) : (
            filtered.map((s) => {
              const isSelected = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
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
                  <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                  <span className="text-sm text-foreground-100 truncate">{s.site_name}</span>
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
            {saving ? 'Saving...' : 'Save sites'}
          </button>
        </div>
      </div>
    </Modal>
  );
}