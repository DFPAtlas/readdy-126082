import { useState } from 'react';
import Modal from '@/components/base/Modal';
import {
  INVITABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Role,
} from '@/lib/permissions';

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: Role) => Promise<void>;
}

export default function InviteUserModal({ open, onClose, onInvite }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setEmail('');
    setRole('viewer');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onInvite(email, role);
      reset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invite user">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground-200 mb-2">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@email.com"
            required
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-200 mb-2">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-4 py-2.5 text-sm text-foreground-100 outline-none transition-colors duration-200 cursor-pointer"
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="text-xs text-foreground-500 mt-2">{ROLE_DESCRIPTIONS[role]}</p>
          <p className="text-xs text-foreground-600 mt-1">
            The owner role cannot be granted through invitations.
          </p>
        </div>

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
            {loading ? 'Sending...' : 'Send invitation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}