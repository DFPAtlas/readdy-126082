import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import usePermissions from '@/hooks/usePermissions';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import InviteUserModal from './components/InviteUserModal';
import ChangeRoleModal from './components/ChangeRoleModal';
import SiteAccessModal, { type SupportSite } from './components/SiteAccessModal';
import {
  ROLE_BADGE_COLORS,
  ROLE_LABELS,
  type Role,
} from '@/lib/permissions';

interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  status: 'active' | 'disabled';
  created_at: string;
  last_sign_in_at: string | null;
  site_ids: string[] | null;
  site_names: string[] | null;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  invited_at: string;
  accepted_at: string | null;
  updated_at: string;
}

const statusBadge: Record<string, string> = {
  pending: 'bg-secondary-500/15 text-secondary-300',
  accepted: 'bg-emerald-500/15 text-emerald-400',
  revoked: 'bg-red-500/15 text-red-400',
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function friendlyRpcError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = raw.replace(/^[^:]*:\s*/, '').trim();
  const map: Record<string, string> = {
    FORBIDDEN: 'You do not have permission to perform this action.',
    LAST_OWNER: 'At least one active owner is required.',
    CANNOT_CHANGE_OWN_ROLE: 'You cannot change your own role.',
    CANNOT_DISABLE_SELF: 'You cannot disable your own account.',
    STAFF_NOT_FOUND: 'Staff member not found.',
    INVALID_ROLE: 'That role is not valid.',
  };
  return map[code] ?? code;
}

export default function TeamPage() {
  const auth = useAuth();
  const { canManageStaff, role: actorRole } = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [sites, setSites] = useState<SupportSite[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [siteTarget, setSiteTarget] = useState<Member | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Member | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const loadAll = useCallback(async () => {
    try {
      setError('');
      const [membersRes, sitesRes, invitesRes] = await Promise.all([
        supabase.rpc('internal_list_staff_full'),
        supabase.rpc('internal_list_support_sites'),
        supabase.from('internal_invitations').select('*').order('invited_at', { ascending: false }),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (sitesRes.error) throw sitesRes.error;
      if (invitesRes.error) throw invitesRes.error;

      setMembers((membersRes.data as Member[]) ?? []);
      setSites((sitesRes.data as SupportSite[]) ?? []);
      setInvitations((invitesRes.data as Invitation[]) ?? []);
    } catch (err: unknown) {
      setError(friendlyRpcError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const inviteUser = async (email: string, role: Role) => {
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

  const changeRole = async (newRole: Role) => {
    if (!roleTarget) return;
    const { error: fnError } = await supabase.rpc('internal_change_staff_role', {
      p_target_user_id: roleTarget.user_id,
      p_new_role: newRole,
    });
    if (fnError) {
      showToast(friendlyRpcError(fnError), 'error');
      throw new Error(friendlyRpcError(fnError));
    }
    showToast(`Role changed to ${ROLE_LABELS[newRole]}`, 'success');
    await loadAll();
  };

  const saveSiteAccess = async (siteIds: string[]) => {
    if (!siteTarget) return;
    const { error: fnError } = await supabase.rpc('internal_set_staff_site_access', {
      p_target_user_id: siteTarget.user_id,
      p_site_ids: siteIds,
    });
    if (fnError) {
      showToast(friendlyRpcError(fnError), 'error');
      throw new Error(friendlyRpcError(fnError));
    }
    showToast('Site access updated', 'success');
    await loadAll();
  };

  const toggleStatus = async () => {
    if (!toggleTarget) return;
    const newStatus = toggleTarget.status === 'disabled' ? 'active' : 'disabled';
    setActionLoading(true);
    const { error: fnError } = await supabase.rpc('internal_set_staff_status', {
      p_target_user_id: toggleTarget.user_id,
      p_status: newStatus,
    });
    setActionLoading(false);
    setToggleTarget(null);
    if (fnError) {
      showToast(friendlyRpcError(fnError), 'error');
      return;
    }
    showToast(newStatus === 'disabled' ? 'Account disabled' : 'Account enabled', 'success');
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

  if (!canManageStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Team &amp; Access</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-lock-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Restricted</h3>
          <p className="text-sm text-foreground-500">Only owners and admins can manage staff and roles.</p>
        </div>
      </div>
    );
  }

  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const activeOwnerCount = members.filter((m) => m.role === 'owner' && m.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Team &amp; Access</h1>
          <p className="text-sm text-foreground-500 mt-1">Manage staff roles, site access and invitations.</p>
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
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadAll} className="text-sm text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      )}

      {/* Members */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-background-200/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-heading font-semibold text-foreground-50">Members</h2>
            <p className="text-xs text-foreground-500 mt-0.5">{members.length} total</p>
          </div>
          <span className="text-xs text-foreground-500">{activeOwnerCount} active owner(s)</span>
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
                  <th className="px-5 py-3 font-label">Site Access</th>
                  <th className="px-5 py-3 font-label">Last login</th>
                  <th className="px-5 py-3 font-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-200/60">
                {members.map((m) => {
                  const isSelf = m.user_id === auth.user?.id;
                  const isLastOwner = m.role === 'owner' && activeOwnerCount <= 1;
                  return (
                    <tr key={m.user_id} className="hover:bg-background-200/30 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        {m.full_name && (
                          <span className="text-foreground-200 font-medium">{m.full_name}</span>
                        )}
                        <span className="block text-xs text-foreground-500">{m.email ?? 'Unknown'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${ROLE_BADGE_COLORS[m.role] ?? ''}`}>
                          {ROLE_LABELS[m.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${
                          m.status === 'disabled' ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-foreground-400 max-w-[220px]">
                        {m.role === 'owner' || m.role === 'admin' || m.role === 'support_manager'
                          ? <span className="text-foreground-600 whitespace-nowrap">All sites</span>
                          : (m.site_names && m.site_names.length > 0
                              ? <span className="truncate block">{m.site_names.join(', ')}</span>
                              : <span className="text-foreground-600">None assigned</span>)}
                      </td>
                      <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                        {m.last_sign_in_at ? formatDate(m.last_sign_in_at) : 'Never'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setRoleTarget(m)}
                            disabled={isSelf || isLastOwner}
                            title={isLastOwner ? 'At least one active owner is required' : 'Change role'}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <i className="ri-user-star-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            onClick={() => setSiteTarget(m)}
                            disabled={isSelf}
                            title="Edit site access"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <i className="ri-earth-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            onClick={() => setToggleTarget(m)}
                            disabled={isSelf || isLastOwner}
                            title={m.status === 'disabled' ? 'Enable account' : 'Disable account'}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                              m.status === 'disabled'
                                ? 'text-emerald-400 hover:bg-background-200/60'
                                : 'text-foreground-400 hover:text-red-400 hover:bg-background-200/60'
                            }`}
                          >
                            <i className={`${m.status === 'disabled' ? 'ri-play-circle-line' : 'ri-stop-circle-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
                          </button>
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
                      <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${ROLE_BADGE_COLORS[inv.role] ?? ''}`}>
                        {ROLE_LABELS[inv.role]}
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

      <ChangeRoleModal
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        member={roleTarget}
        actorRole={actorRole ?? 'viewer'}
        onChangeRole={changeRole}
      />

      <SiteAccessModal
        open={siteTarget !== null}
        onClose={() => setSiteTarget(null)}
        member={siteTarget}
        sites={sites}
        onSave={saveSiteAccess}
      />

      <ConfirmDialog
        open={toggleTarget !== null}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.status === 'disabled' ? 'Enable account' : 'Disable account'}
        message={
          toggleTarget?.status === 'disabled'
            ? `Re-enable access for ${toggleTarget?.email ?? 'this member'}?`
            : `Disable access for ${toggleTarget?.email ?? 'this member'}? They will immediately lose access.`
        }
        confirmLabel={toggleTarget?.status === 'disabled' ? 'Enable' : 'Disable'}
        onConfirm={toggleStatus}
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

      {toast && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.4)] ${
              toast.type === 'success'
                ? 'bg-background-200 border-emerald-500/40 text-emerald-300'
                : 'bg-background-200 border-red-500/40 text-red-300'
            }`}
          >
            <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}