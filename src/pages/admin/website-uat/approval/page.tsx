import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import Modal from '@/components/base/Modal';
import { UatApproval, APPROVAL_STATUS_COLORS } from '../types';

interface StaffIdentity {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

export default function ApprovalDetailPage() {
  const { approvalId } = useParams<{ approvalId: string }>();
  const { user } = useAuth();
  const [approval, setApproval] = useState<UatApproval | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Revoke dialog state
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revocationReason, setRevocationReason] = useState('');
  const [revokeError, setRevokeError] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState(false);
  const [staff, setStaff] = useState<StaffIdentity[]>([]);

  const loadApproval = useCallback(async () => {
    if (!approvalId) return;
    try {
      setError('');
      const { data, error: err } = await supabase
        .from('uat_approvals')
        .select('*')
        .eq('id', approvalId)
        .single();
      if (err) throw err;
      if (!data) {
        setError('Approval not found.');
        setLoading(false);
        return;
      }

      const record = data as Record<string, unknown>;
      const projId = record.project_id as string;
      let pName = 'Unknown';
      if (projId) {
        const { data: project } = await supabase.from('uat_projects').select('name').eq('id', projId).maybeSingle();
        pName = (project as Record<string, unknown>)?.name as string || 'Unknown';
      }

      setApproval({
        ...record,
        project_name: pName,
      } as UatApproval);
      setProjectName(pName);
    } catch {
      setError('Failed to load approval details.');
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  useEffect(() => {
    loadApproval();
  }, [loadApproval]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: staffErr } = await supabase.rpc('internal_list_staff');
        if (!cancelled && !staffErr && Array.isArray(data)) {
          setStaff(data as StaffIdentity[]);
        }
      } catch {
        // Identity resolution is non-fatal; the approval record loads independently.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = async (newStatus: 'approved' | 'rejected') => {
    if (!approvalId || actionLoading) return;
    try {
      setActionError('');
      setActionLoading(true);
      if (!user?.id) throw new Error('Unable to identify current user.');

      const { error: updateErr } = await supabase
        .from('uat_approvals')
        .update({
          status: newStatus,
          approver_id: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', approvalId);

      if (updateErr) throw updateErr;

      await loadApproval();
    } catch (e) {
      setActionError((e as Error).message || `Failed to ${newStatus} approval.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openRevokeDialog = () => {
    setRevokeError('');
    setRevokeSuccess(false);
    setRevocationReason('');
    setRevokeOpen(true);
  };

  const closeRevokeDialog = () => {
    if (revokeLoading) return;
    setRevokeOpen(false);
    setRevocationReason('');
    setRevokeError('');
  };

  const handleRevoke = async () => {
    if (!approvalId || revokeLoading) return;

    const reason = revocationReason.trim();
    if (!reason) {
      setRevokeError('Please enter a revocation reason.');
      return;
    }
    if (!user?.id) {
      setRevokeError('Unable to identify current user.');
      return;
    }

    try {
      setRevokeError('');
      setRevokeLoading(true);

      const { data: updated, error: updateErr } = await supabase
        .from('uat_approvals')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revocation_reason: reason,
        })
        .eq('id', approvalId)
        .eq('status', 'approved')
        .select();

      if (updateErr) throw updateErr;

      // Guard: if the status changed concurrently, no rows match and we must not report success.
      if (!updated || updated.length === 0) {
        await loadApproval();
        setRevokeError('This approval is no longer in an approved state, so it could not be revoked. The page has been refreshed with the latest status.');
        return;
      }

      setRevokeSuccess(true);
      setRevokeOpen(false);
      setRevocationReason('');
      await loadApproval();
    } catch (e) {
      setRevokeError((e as Error).message || 'Failed to revoke approval.');
    } finally {
      setRevokeLoading(false);
    }
  };

  const renderIdentity = (userId: string | null | undefined) => {
    if (!userId) return null;
    const identity = staff.find((s) => s.user_id === userId);
    const name = identity?.full_name ?? null;
    const email = identity?.email ?? null;

    if (!name && !email) {
      return (
        <span className="text-sm text-foreground-400" title={userId}>
          Unknown administrator
        </span>
      );
    }

    return (
      <span className="inline-flex flex-col">
        {name && <span className="text-sm font-medium text-foreground-100">{name}</span>}
        {email && <span className="text-xs text-foreground-500">{email}</span>}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="space-y-4">
        <Link to="/admin/website-uat?tab=approval" className="text-sm text-accent-400 hover:text-accent-300 no-underline inline-flex items-center gap-1">
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Approvals
        </Link>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <i className="ri-error-warning-line text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto mb-3"></i>
          <p className="text-sm text-foreground-400">{error || 'Approval not found.'}</p>
        </div>
      </div>
    );
  }

  const isPending = approval.status === 'pending';
  const isRevocable = approval.status === 'approved';
  const isRevoked = approval.status === 'revoked';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/admin/website-uat?tab=approval" className="text-sm text-accent-400 hover:text-accent-300 no-underline inline-flex items-center gap-1">
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Approvals
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">{projectName}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APPROVAL_STATUS_COLORS[approval.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
              {approval.status}
            </span>
            {approval.decided_at && (
              <span className="text-xs text-foreground-500">
                Decided {new Date(approval.decided_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {approval.approver_id && (approval.status === 'approved' || approval.status === 'rejected') && (
            <div className="mt-3">
              <span className="block text-xs text-foreground-500 mb-1">
                {approval.status === 'approved' ? 'Approved by' : 'Rejected by'}
              </span>
              {renderIdentity(approval.approver_id)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('approved')}
                className="bg-emerald-500 hover:bg-emerald-400 text-background-950 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-check-line w-4 h-4 flex items-center justify-center inline-block mr-1"></i>
                Approve
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('rejected')}
                className="bg-red-500 hover:bg-red-400 text-background-950 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-close-line w-4 h-4 flex items-center justify-center inline-block mr-1"></i>
                Reject
              </button>
            </>
          )}
          {isRevocable && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={openRevokeDialog}
              className="bg-red-500 hover:bg-red-400 text-background-950 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-close-line w-4 h-4 flex items-center justify-center inline-block mr-1"></i>
              Revoke
            </button>
          )}
        </div>
      </div>

      {revokeSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-400">
          <i className="ri-check-double-line w-4 h-4 flex items-center justify-center inline-block mr-1"></i>
          Approval revoked successfully.
        </div>
      )}

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
          <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center inline-block mr-1"></i>
          {actionError}
        </div>
      )}

      <div className="grid gap-4">
        {isRevoked && (
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground-50 mb-2">Revocation</h3>
            {approval.revoked_at && (
              <p className="text-sm text-foreground-400">
                Revoked {new Date(approval.revoked_at).toLocaleString()}
              </p>
            )}
            {approval.revoked_by && (
              <div className="mt-2">
                <span className="block text-xs text-foreground-500 mb-1">Revoked by</span>
                {renderIdentity(approval.revoked_by)}
              </div>
            )}
            <p className="text-sm text-foreground-400 leading-relaxed mt-2">
              {approval.revocation_reason || 'No revocation reason recorded.'}
            </p>
          </div>
        )}

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground-50 mb-2">Decision Reason</h3>
          <p className="text-sm text-foreground-400 leading-relaxed">
            {approval.decision_reason || 'No decision reason recorded.'}
          </p>
        </div>

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground-50 mb-2">Evidence</h3>
          <p className="text-sm text-foreground-400 leading-relaxed">
            {approval.evidence || 'No evidence attached.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground-50 mb-2">Conditions</h3>
            <p className="text-sm text-foreground-400 leading-relaxed">
              {approval.conditions || 'No conditions recorded.'}
            </p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground-50 mb-2">Exceptions</h3>
            <p className="text-sm text-foreground-400 leading-relaxed">
              {approval.exceptions || 'No exceptions recorded.'}
            </p>
          </div>
        </div>
      </div>

      <Modal open={revokeOpen} onClose={closeRevokeDialog} title="Revoke Approval" variant="dialog">
        <div className="p-5">
          <p className="text-sm text-foreground-300 leading-relaxed">
            Revoking this approval will mark it as revoked while preserving the original decision record. This action requires a reason.
          </p>

          <label htmlFor="revocation-reason" className="block text-sm text-foreground-50 mt-4 mb-1">
            Revocation reason <span className="text-red-400">*</span>
          </label>
          <textarea
            id="revocation-reason"
            value={revocationReason}
            onChange={(e) => setRevocationReason(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Enter the reason for revoking this approval"
            className="w-full bg-background-300 border border-background-400/70 rounded-lg px-3 py-2 text-sm text-foreground-50 placeholder:text-foreground-500 outline-none focus:ring-2 focus:ring-red-400/40 resize-none"
          />

          {revokeError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 mt-3">
              <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center inline-block mr-1"></i>
              {revokeError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={closeRevokeDialog}
              disabled={revokeLoading}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revokeLoading}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap bg-red-500 hover:bg-red-400 text-white disabled:opacity-40"
            >
              {revokeLoading ? 'Revoking...' : 'Confirm Revoke'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}