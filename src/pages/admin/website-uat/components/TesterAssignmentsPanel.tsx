import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import SubmissionReviewModal from './SubmissionReviewModal';
import type { UatJob, UatAssignment, UatJobApplication, UatReward } from '../types';
import {
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  REWARD_STATUS_COLORS,
  REWARD_STATUS_LABELS,
} from '../types';
import { formatMinorCurrency, formatDateTime } from '../marketplace';

interface Props {
  job: UatJob;
  onChanged: () => void;
}

type PendingAction =
  | { kind: 'approve'; app: UatJobApplication }
  | { kind: 'reject'; app: UatJobApplication }
  | { kind: 'cancel'; asg: UatAssignment }
  | { kind: 'approveReward'; asg: UatAssignment }
  | null;

export default function TesterAssignmentsPanel({ job, onChanged }: Props) {
  const [assignments, setAssignments] = useState<UatAssignment[]>([]);
  const [applications, setApplications] = useState<UatJobApplication[]>([]);
  const [rewards, setRewards] = useState<UatReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reviewAssignment, setReviewAssignment] = useState<UatAssignment | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [{ data: asg }, { data: apps }, { data: pays }] = await Promise.all([
        supabase.from('uat_assignments').select('*').eq('job_id', job.id).order('created_at', { ascending: true }),
        supabase.from('uat_job_applications').select('*').eq('job_id', job.id).order('created_at', { ascending: false }),
        supabase.from('uat_payments').select('*').eq('job_id', job.id),
      ]);

      const testerIds = [...new Set([
        ...(asg || []).map((a: Record<string, unknown>) => a.tester_id),
        ...(apps || []).map((a: Record<string, unknown>) => a.tester_id),
      ])];

      let testerMap: Record<string, Record<string, unknown>> = {};
      if (testerIds.length > 0) {
        const { data: testers } = await supabase
          .from('uat_testers')
          .select('id,full_name,email,experience_level')
          .in('id', testerIds);
        testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t]));
      }

      setAssignments((asg || []).map((a: Record<string, unknown>) => ({
        ...a,
        tester_name: (testerMap[a.tester_id as string]?.full_name as string) || 'Unknown tester',
        tester_email: (testerMap[a.tester_id as string]?.email as string) || '',
      })) as UatAssignment[]);

      setApplications((apps || []).map((a: Record<string, unknown>) => ({
        ...a,
        tester_name: (testerMap[a.tester_id as string]?.full_name as string) || 'Unknown tester',
        tester_email: (testerMap[a.tester_id as string]?.email as string) || '',
        tester_experience_level: (testerMap[a.tester_id as string]?.experience_level as string) || null,
      })) as UatJobApplication[]);

      setRewards((pays || []).map((p: Record<string, unknown>) => ({
        ...p,
        tester_name: (testerMap[p.tester_id as string]?.full_name as string) || 'Unknown tester',
      })) as UatReward[]);
    } catch {
      setError('Failed to load tester assignments.');
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => { load(); }, [load]);

  const total = job.max_testers ?? 0;
  const activeAssignments = assignments.filter((a) => !['rejected', 'expired', 'cancelled'].includes(a.status));
  const filled = activeAssignments.length;
  const reservedCount = assignments.filter((a) => a.status === 'reserved').length;
  const remaining = Math.max(0, total - filled);
  const pendingApps = applications.filter((a) => a.status === 'pending');

  const rewardMap: Record<string, UatReward> = Object.fromEntries(rewards.map((r) => [r.assignment_id, r]));

  // ── Budget summary (reporting only — never reserves/moves funds) ──
  const rewardMinor = job.reward_amount_minor ?? 0;
  const maxBudget = rewardMinor * total;
  const approvedSum = rewards.filter((r) => r.status === 'approved').reduce((s, r) => s + (r.reward_amount_minor || 0), 0);
  const paidSum = rewards.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.reward_amount_minor || 0), 0);
  const pendingAccepted = assignments.filter(
    (a) => a.review_status === 'approved' && a.status === 'completed' && !rewardMap[a.id],
  );
  const pendingSum = pendingAccepted.reduce((s, a) => s + (a.agreed_reward_amount_minor ?? 0), 0);
  const remainingExposure = Math.max(0, maxBudget - approvedSum - paidSum - pendingSum);
  const currency = job.currency ?? 'GBP';

  const runAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    setActionError('');
    try {
      if (pendingAction.kind === 'approve') {
        const { error: err } = await supabase.rpc('approve_uat_application', { p_application_id: pendingAction.app.id });
        if (err) throw err;
      } else if (pendingAction.kind === 'reject') {
        const { error: err } = await supabase.rpc('reject_uat_application', { p_application_id: pendingAction.app.id });
        if (err) throw err;
      } else if (pendingAction.kind === 'cancel') {
        const { error: err } = await supabase.rpc('cancel_uat_assignment', { p_assignment_id: pendingAction.asg.id });
        if (err) throw err;
      } else if (pendingAction.kind === 'approveReward') {
        const { error: err } = await supabase.rpc('approve_uat_reward', { p_assignment_id: pendingAction.asg.id });
        if (err) throw err;
      }
      setPendingAction(null);
      await load();
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div className="rounded-md bg-background-50 border border-background-200/60 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">Tester Assignments</p>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-foreground-500">Places:</span>
          <span className="text-foreground-200 font-medium">{filled} / {total} allocated</span>
          {reservedCount > 0 && <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium">{reservedCount} reserved</span>}
          <span className={remaining > 0 ? 'text-emerald-400' : 'text-orange-400'}>{remaining} remaining</span>
        </div>
      </div>

      {/* Budget summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Max Budget</p>
          <p className="text-sm font-semibold text-foreground-100 mt-0.5">{formatMinorCurrency(maxBudget, currency)}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Approved</p>
          <p className="text-sm font-semibold text-emerald-400 mt-0.5">{formatMinorCurrency(approvedSum, currency)}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Paid</p>
          <p className="text-sm font-semibold text-sky-400 mt-0.5">{formatMinorCurrency(paidSum, currency)}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Pending Review</p>
          <p className="text-sm font-semibold text-yellow-400 mt-0.5">{formatMinorCurrency(pendingSum, currency)}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Remaining Exposure</p>
          <p className="text-sm font-semibold text-foreground-200 mt-0.5">{formatMinorCurrency(remainingExposure, currency)}</p>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-xs text-foreground-500 py-4">Loading assignments...</p>
      ) : (
        <>
          {/* Pending applications (approval mode) */}
          {pendingApps.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-2">Pending Requests ({pendingApps.length})</p>
              <div className="space-y-2">
                {pendingApps.map((app) => (
                  <div key={app.id} className="flex items-center justify-between gap-3 border border-background-300/60 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground-100 truncate">{app.tester_name}</p>
                      <p className="text-xs text-foreground-500 truncate">
                        {app.tester_email}{app.tester_experience_level ? ` · ${app.tester_experience_level}` : ''}
                      </p>
                      {app.application_message && <p className="text-xs text-foreground-400 mt-0.5">{app.application_message}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setActionError(''); setPendingAction({ kind: 'approve', app }); }}
                        className="bg-accent-500 hover:bg-accent-400 text-background-950 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setActionError(''); setPendingAction({ kind: 'reject', app }); }}
                        className="bg-background-50 border border-background-300/60 text-foreground-300 hover:text-red-400 hover:border-red-500/30 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignments table */}
          {assignments.length === 0 ? (
            <p className="text-xs text-foreground-500 py-4">No tester assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-foreground-500 border-b border-background-200/60">
                    <th className="py-2 pr-3 font-label font-medium">Tester</th>
                    <th className="py-2 pr-3 font-label font-medium">Status</th>
                    <th className="py-2 pr-3 font-label font-medium">Assigned / Reserved</th>
                    <th className="py-2 pr-3 font-label font-medium">Progress</th>
                    <th className="py-2 pr-3 font-label font-medium">Agreed Reward</th>
                    <th className="py-2 pr-3 font-label font-medium">Reward Status</th>
                    <th className="py-2 pr-3 font-label font-medium">Submission</th>
                    <th className="py-2 font-label font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const reward = rewardMap[a.id];
                    const canApproveReward = a.review_status === 'approved' && a.status === 'completed' && !reward;
                    return (
                      <tr key={a.id} className="border-b border-background-200/40">
                        <td className="py-2.5 pr-3">
                          <p className="text-foreground-100 font-medium">{a.tester_name}</p>
                          <p className="text-foreground-500 text-[10px]">{a.tester_email}</p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ASSIGNMENT_STATUS_COLORS[a.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                            {ASSIGNMENT_STATUS_LABELS[a.status] || a.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-foreground-300">{formatDateTime(a.offered_at) || formatDateTime(a.created_at) || '—'}</td>
                        <td className="py-2.5 pr-3 text-foreground-300">{a.session_count ?? 0} sessions</td>
                        <td className="py-2.5 pr-3 text-foreground-200 font-medium">{formatMinorCurrency(a.agreed_reward_amount_minor ?? 0, a.currency ?? 'GBP')}</td>
                        <td className="py-2.5 pr-3">
                          {reward ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${REWARD_STATUS_COLORS[reward.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                              {REWARD_STATUS_LABELS[reward.status] || reward.status}
                            </span>
                          ) : (
                            <span className="text-foreground-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {a.completed_at ? (
                            <span className="text-emerald-400">Completed</span>
                          ) : a.submitted_at ? (
                            <span className="text-violet-400">Submitted</span>
                          ) : (
                            <span className="text-foreground-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(a.submitted_at || a.status === 'submitted' || a.status === 'completed') && (
                              <button
                                onClick={() => setReviewAssignment(a)}
                                className="text-accent-400 hover:text-accent-300 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Review
                              </button>
                            )}
                            {canApproveReward && (
                              <button
                                onClick={() => { setActionError(''); setPendingAction({ kind: 'approveReward', asg: a }); }}
                                className="text-emerald-400 hover:text-emerald-300 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Approve Reward
                              </button>
                            )}
                            {['assigned', 'reserved', 'in_progress', 'submitted'].includes(a.status) && (
                              <button
                                onClick={() => { setActionError(''); setPendingAction({ kind: 'cancel', asg: a }); }}
                                className="text-foreground-500 hover:text-red-400 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Cancel
                              </button>
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
        </>
      )}

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
          <p className="text-xs text-red-400">{actionError}</p>
        </div>
      )}

      <Modal
        open={pendingAction !== null}
        onClose={() => { if (!busy) setPendingAction(null); }}
        title={
          pendingAction?.kind === 'approve' ? 'Approve Tester'
          : pendingAction?.kind === 'reject' ? 'Reject Request'
          : pendingAction?.kind === 'cancel' ? 'Cancel Assignment'
          : pendingAction?.kind === 'approveReward' ? 'Approve Reward'
          : 'Confirm'
        }
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          {pendingAction?.kind === 'approve' && (
            <div className="space-y-3">
              <p className="text-sm text-foreground-300">
                Approve <span className="text-foreground-100">{pendingAction.app.tester_name}</span> for this job?
              </p>
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-foreground-500">Agreed reward</span><span className="text-foreground-100">{formatMinorCurrency(job.reward_amount_minor ?? 0, job.currency ?? 'GBP')}</span></div>
                <div className="flex justify-between"><span className="text-foreground-500">Places remaining</span><span className="text-foreground-100">{remaining}</span></div>
              </div>
              <p className="text-xs text-foreground-500">The job reward is snapshotted onto this assignment. Future reward changes will not affect it.</p>
            </div>
          )}
          {pendingAction?.kind === 'reject' && (
            <p className="text-sm text-foreground-300">
              Reject <span className="text-foreground-100">{pendingAction.app.tester_name}</span>&apos;s request? This does not consume a tester place.
            </p>
          )}
          {pendingAction?.kind === 'cancel' && (
            <p className="text-sm text-foreground-300">
              Cancel this assignment for <span className="text-foreground-100">{pendingAction.asg.tester_name}</span>? Their historical sessions, results, evidence and defects are retained, and the tester place will be released.
            </p>
          )}
          {pendingAction?.kind === 'approveReward' && (
            <div className="space-y-3">
              <p className="text-sm text-foreground-300">
                Approve a reward of <span className="text-foreground-100">{formatMinorCurrency(pendingAction.asg.agreed_reward_amount_minor ?? 0, pendingAction.asg.currency ?? 'GBP')}</span> for <span className="text-foreground-100">{pendingAction.asg.tester_name}</span>&apos;s completed UAT?
              </p>
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-foreground-500">UAT job</span><span className="text-foreground-100">{job.title}</span></div>
                <div className="flex justify-between"><span className="text-foreground-500">Agreed reward</span><span className="text-foreground-100">{formatMinorCurrency(pendingAction.asg.agreed_reward_amount_minor ?? 0, pendingAction.asg.currency ?? 'GBP')}</span></div>
                <div className="flex justify-between"><span className="text-foreground-500">Review status</span><span className="text-emerald-400">Approved</span></div>
              </div>
              <p className="text-xs text-foreground-500">This marks the reward as approved (DFP owes it) — no money is transferred. Mark as Paid separately in the rewards view.</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={() => setPendingAction(null)}
              disabled={busy}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={runAction}
              disabled={busy}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                pendingAction?.kind === 'reject' || pendingAction?.kind === 'cancel'
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : pendingAction?.kind === 'approveReward'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-background-950'
                  : 'bg-accent-500 hover:bg-accent-400 text-background-950'
              }`}
            >
              {busy ? 'Saving...'
                : pendingAction?.kind === 'approve' ? 'Approve'
                : pendingAction?.kind === 'reject' ? 'Reject'
                : pendingAction?.kind === 'cancel' ? 'Cancel Assignment'
                : pendingAction?.kind === 'approveReward' ? 'Approve Reward'
                : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>

    {reviewAssignment && (
      <SubmissionReviewModal
        open={reviewAssignment !== null}
        job={job}
        assignment={reviewAssignment}
        onClose={() => setReviewAssignment(null)}
        onChanged={load}
      />
    )}
    </>
  );
}