import { useState, useEffect } from 'react';
import Modal from '@/components/base/Modal';

export interface SupportSite {
  id: string;
  site_name: string;
  site_slug: string | null;
  is_active: boolean;
}

interface SiteAccessModalProps {
  open: boolean;
  onClose: () => void;
  member: { full_name: string | null; email: string | null; site_ids: string[] | null } | null;
  sites: SupportSite[];
  onSave: (siteIds: string[]) => Promise<void>;
}

export default function SiteAccessModal({
  open,
  onClose,
  member,
  sites,
  onSave,
}: SiteAccessModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && member) {
      setSelected(member.site_ids ?? []);
      setError('');
    }
  }, [open, member]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave(selected);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save site access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Edit site access">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div>
          <p className="text-sm text-foreground-200 font-medium">
            {member.full_name ?? member.email ?? 'Unknown member'}
          </p>
          <p className="text-xs text-foreground-500 mt-0.5">
            Select which sites this staff member can access. Owners, admins and
            support managers have unrestricted access.
          </p>
        </div>

        {sites.length === 0 ? (
          <p className="text-sm text-foreground-500">No support sites registered yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sites.map((site) => {
              const checked = selected.includes(site.id);
              return (
                <label
                  key={site.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'border-accent-500/40 bg-accent-500/5'
                      : 'border-background-200/60 hover:bg-background-200/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(site.id)}
                    className="mt-0.5 accent-accent-500 cursor-pointer"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground-100 truncate">{site.site_name}</span>
                    {!site.is_active && (
                      <span className="text-[10px] font-label text-foreground-500 uppercase">Inactive</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-full text-sm font-semibold bg-accent-500 hover:bg-accent-400 disabled:opacity-40 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
          >
            {loading ? 'Saving…' : 'Save site access'}
          </button>
        </div>
      </form>
    </Modal>
  );
}