import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/base/Modal';
import { supabase } from '@/lib/supabase';
import type { SupportSite, SupportTeam } from '@/types/support-tickets';

const NO_DEFAULT = '__none__';

interface DefaultTeamModalProps {
  open: boolean;
  onClose: () => void;
  site: SupportSite;
  teams: SupportTeam[];
  onSaved: () => void;
}

export default function DefaultTeamModal({ open, onClose, site, teams, onSaved }: DefaultTeamModalProps) {
  const [selected, setSelected] = useState<string>(NO_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeTeams = useMemo(
    () => teams.filter((t) => t.status === 'active'),
    [teams],
  );

  const currentTeam = useMemo(
    () => teams.find((t) => t.id === site.default_support_team_id) ?? null,
    [teams, site.default_support_team_id],
  );

  const currentTeamLabel = currentTeam
    ? `${currentTeam.name}${currentTeam.status !== 'active' ? ' (inactive)' : ''}`
    : 'Not configured';

  useEffect(() => {
    if (!open) return;
    setSelected(site.default_support_team_id ?? NO_DEFAULT);
    setSaving(false);
    setError('');
  }, [open, site.default_support_team_id]);

  const nextTeam = selected === NO_DEFAULT ? null : activeTeams.find((t) => t.id === selected) ?? null;
  const nextLabel = nextTeam ? nextTeam.name : 'No default team';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const teamId = selected === NO_DEFAULT ? null : selected;
      const { error: rpcError } = await supabase.rpc('internal_set_site_default_team', {
        p_site_id: site.id,
        p_team_id: teamId,
      });
      if (rpcError) throw rpcError;
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update default team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change default team" className="max-w-lg">
      <div className="p-5 space-y-4">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground-500">Site</span>
            <span className="text-foreground-100 font-medium">{site.site_name}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground-500">Current default team</span>
            <span className="text-foreground-100">{currentTeamLabel}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="dt-team">New default team</label>
          <select
            id="dt-team"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40 cursor-pointer"
          >
            <option value="" disabled>Select team</option>
            {activeTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value={NO_DEFAULT}>No default team</option>
          </select>
        </div>

        <p className="text-xs text-foreground-500 leading-relaxed">
          Tickets with no matching routing rule will be sent to this team.
        </p>

        {selected === NO_DEFAULT && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-xs text-foreground-300 leading-relaxed">
            Tickets without a matching routing rule will go to <span className="font-medium text-amber-300">Needs Review</span>.
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-background-400/60">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || selected === ''}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
        >
          {saving ? 'Saving…' : `Confirm — ${nextLabel}`}
        </button>
      </div>
    </Modal>
  );
}