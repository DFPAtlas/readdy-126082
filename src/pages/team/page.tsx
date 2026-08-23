import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import InviteUserModal from './components/InviteUserModal';

interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: 'owner' | 'admin' | 'viewer';
  created_at: string;
  updated_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  invited_at: string;
  accepted_at: string | null;
  updated_at: string;
}

const roleBadge: Record<string, string> = {
  owner: 'bg-primary-500/15 text-primary-400',
  admin: 'bg-accent-500/15 text-accent-400',
  viewer: 'bg-secondary-500/15 text-secondary-300',
};

const statusBadge: Record<string, string> = {
  pending: 'bg-secondary-500/15 text-secondary-300',
  accepted: 'bg-emerald-500/15 text-emerald-400',
  revoked: 'bg-red-500/15 text-red-400',
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function TeamPage() {
  const auth = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setError('');
      const [membersRes, invitesRes] = await Promise.all([
        supabase.rpc('list_team_members'),
        supabase.from('internal_invitations').select('*').order('invited_at', { ascending: false }),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;

      setMembers((membersRes.data as Member[]) ?? []);
      setInvitations((invitesRes.data as Invitation[]) ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const inviteUser = async (email: string, role: 'admin' | 'viewer') => {
    const { data, error: fnError } = await supabase.functions.invoke('command-centre-invite-user', {
      body: { email, role },
    });

    if (fnError) {
      const context = (fnError as { context?: { status?: number } }).context;
      let message = 'Failed to send invitation';
      if (context?.status === 403) message = 'Only the owner can invite users';
      else if (context?.status === 400) message = 'Invalid email or role';
      throw new Error(message);
    }

    if (!data || data.code !== 'OK') {
      throw new Error(data?.message || 'Failed to send invitation');
    }

    await loadAll();
  };

  const changeRole = async (member: Member) => {
    const newRole: 'admin' | 'viewer' = member.role === 'admin' ? 'viewer' : 'admin';
    const { error: updateError } = await supabase
      .from('internal_user_roles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('user_id', member.user_id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadAll();
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    const { error: deleteError } = await supabase
      .from('internal_user_roles')
      .delete()
      .eq('user_id', removeTarget.user_id);
    setActionLoading(false);
    setRemoveTarget(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await loadAll();
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(true);
    const { error: updateError } = await supabase
      .from('internal_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', revokeTarget.id);
    setActionLoading(false);
    setRevokeTarget(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadAll();
  };

  if (auth.role !== 'owner') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Team &amp; Access</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-lock-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Owner only</h3>
          <p className="text-sm text-foreground-500">Only the owner can manage team members and invitations.</p>
        </div>
      </div>
    );
  }

  const pendingInvites = invitations.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Team &amp; Access</h1>
          <p className="text-sm text-foreground-500 mt-1">Manage members and invite people to the Command Centre.</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-user-add-line text-base w-4 h-4 flex items-center justify-center"></i>
          Invite User
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadAll} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Members */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-background-200/60">
          <h2 className="text-base font-heading font-semibold text-foreground-50">Members</h2>
          <p className="text-xs text-foreground-500 mt-0.5">{members.length} active</p>
        </div>

        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-10 bg-background-200/50 rounded-lg"></div>
            <div className="h-10 bg-background-200/50 rounded-lg"></div>
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-foreground-500">No members yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-label">Email</th>
                  <th className="px-5 py-3 font-label">Role</th>
                  <th className="px-5 py-3 font-label">Status</th>
                  <th className="px-5 py-3 font-label">Invited</th>
                  <th className="px-5 py-3 font-label">Last updated</th>
                  <th className="px-5 py-3 font-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-200/60">
                {members.map((m) => {
                  const isSelf = m.user_id === auth.user?.id;
                  return (
                    <tr key={m.user_id} className="hover:bg-background-200/30 transition-colors">
                      <td className="px-5 py-3 text-foreground-100 whitespace-nowrap">
                        {m.full_name && (
                          <span className="text-foreground-200 font-medium">{m.full_name}</span>
                        )}
                        <span className="block text-xs text-foreground-500">{m.email ?? 'Unknown'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${roleBadge[m.role] ?? ''}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-foreground-300 whitespace-nowrap">Active</span>
                      </td>
                      <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">{formatDate(m.created_at)}</td>
                      <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">{formatDate(m.updated_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {m.role === 'owner' ? (
                            <span className="text-xs text-foreground-600 whitespace-nowrap">Owner</span>
                          ) : (
                            <>
                              <button
                                onClick={() => changeRole(m)}
                                disabled={isSelf}
                                title={m.role === 'admin' ? 'Change to viewer' : 'Change to admin'}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 disabled:opacity-30 transition-colors cursor-pointer"
                              >
                                <i className={`${m.role === 'admin' ? 'ri-eye-off-line' : 'ri-admin-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
                              </button>
                              <button
                                onClick={() => setRemoveTarget(m)}
                                disabled={isSelf}
                                title="Remove access"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-red-400 hover:bg-background-200/60 disabled:opacity-30 transition-colors cursor-pointer"
                              >
                                <i className="ri-user-unfollow-line text-base w-4 h-4 flex items-center justify-center"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invitations */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-background-200/60">
          <h2 className="text-base font-heading font-semibold text-foreground-50">Invitations</h2>
          <p className="text-xs text-foreground-500 mt-0.5">{pendingInvites.length} pending</p>
        </div>

        {loading ? (
          <div className="p-6 animate-pulse">
            <div className="h-10 bg-background-200/50 rounded-lg"></div>
          </div>
        ) : invitations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-foreground-500">No invitations sent yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-label">Email</th>
                  <th className="px-5 py-3 font-label">Role</th>
                  <th className="px-5 py-3 font-label">Status</th>
                  <th className="px-5 py-3 font-label">Invited</th>
                  <th className="px-5 py-3 font-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-200/60">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-background-200/30 transition-colors">
                    <td className="px-5 py-3 text-foreground-100 whitespace-nowrap">{inv.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${roleBadge[inv.role] ?? ''}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${statusBadge[inv.status] ?? ''}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">{formatDate(inv.invited_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end">
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => setRevokeTarget(inv)}
                            title="Revoke invitation"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-red-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                          >
                            <i className="ri-close-circle-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={inviteUser} />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove access"
        message={`Remove ${removeTarget?.email ?? 'this member'} from the Command Centre? They will immediately lose access.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke invitation"
        message={`Revoke the pending invitation for ${revokeTarget?.email ?? 'this email'}?`}
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
        loading={actionLoading}
      />
    </div>
  );
}