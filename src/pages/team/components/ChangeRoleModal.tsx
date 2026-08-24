import { useState } from 'react';
import Modal from '@/components/base/Modal';
import {
  ROLE_BADGE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SUPPORT_ROLES,
  type Role,
} from '@/lib/permissions';

interface ChangeRoleModalProps {
  open: boolean;
  onClose: () => void;
  member: { full_name: string | null; email: string | null; role: Role } | null;
  actorRole: Role;
  onChangeRole: (newRole: Role) => Promise<void>;
}

export default function ChangeRoleModal({
  open,
  onClose,
  member,
  actorRole,
  onChangeRole,
}: ChangeRoleModalProps) {
  const [newRole, setNewRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setNewRole(null);
    setError('');
    onClose();
  };

  if (!member) return null;

  // Selectable roles: cannot pick the member's current role, and a non-owner
  // actor can never grant (or touch) the owner role.
  const selectable = SUPPORT_ROLES.filter((r) => {
    if (r === member.role) return false;
    if (r === 'owner' && actorRole !== 'owner') return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole) return;
    setError('');
    setLoading(true);
    try {
      await onChangeRole(newRole);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change role">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
          <p className="text-sm text-foreground-200 font-medium">
            {member.full_name ?? member.email ?? 'Unknown member'}
          </p>
          <p className="text-xs text-foreground-500 mt-0.5">
            Current role:{' '}
            <span className={`inline-flex text-[10px] font-label px-2 py-0.5 rounded uppercase ${ROLE_BADGE_COLORS[member.role]}`}>
              {ROLE_LABELS[member.role]}
            </span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-200 mb-2">New role</label>
          <select
            value={newRole ?? ''}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-2.5 text-sm text-foreground-100 outline-none transition-colors duration-200 cursor-pointer"
          >
            <option value="" disabled>
              Select a role…
            </option>
            {selectable.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {newRole && (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
            <p className="text-xs font-label text-foreground-500 uppercase tracking-wider mb-1">
              Permission summary
            </p>
            <p className="text-sm text-foreground-300">{ROLE_DESCRIPTIONS[newRole]}</p>
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
            disabled={!newRole || loading}
            className="px-5 py-2 rounded-full text-sm font-semibold bg-accent-500 hover:bg-accent-400 disabled:opacity-40 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
          >
            {loading ? 'Saving…' : 'Confirm role change'}
          </button>
        </div>
      </form>
    </Modal>
  );
}