import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatReward } from '../types';
import { REWARD_STATUS_COLORS, REWARD_STATUS_LABELS } from '../types';
import { formatMinorCurrency, formatDateTime } from '../marketplace';

type Filter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

type PendingAction = { kind: 'paid' | 'reject' | 'cancel'; reward: UatReward } | null;

export default function UatRewardsTab() {
  const [rewards, setRewards] = useState<UatReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const { data: pays, error: err } = await supabase.from('uat_payments').select('*').order('created_at', { ascending: false });
      if (err) throw err;

      const testerIds = [...new Set((pays || []).map((p: Record<string, unknown>) => p.tester_id))];
      const jobIds = [...new Set((pays || []).map((p: Record<string, unknown>) => p.job_id))];
      const assignmentIds = [...new Set((pays || []).map((p: Record<string, unknown>) => p.assignment_id))];

      const [{ data: testers }, { data: jobs }, { data: assignments }] = await Promise.all([
        testerIds.length > 0 ? supabase.from('uat_testers').select('id,full_name').in('id', testerIds) : Promise.resolve({ data: [] }),
        jobIds.length > 0 ? supabase.from('uat_jobs').select('id,title').in('id', jobIds) : Promise.resolve({ data: [] }),
        assignmentIds.length > 0 ? supabase.from('uat_assignments').select('id,status').in('id', assignmentIds) : Promise.resolve({ data: [] }),
      ]);

      const testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t.full_name]));
      const jobMap = Object.fromEntries((jobs || []).map((j: Record<string, unknown>) => [j.id, j.title]));
      const assignmentMap = Object.fromEntries((assignments || []).map((a: Record<string, unknown>) => [a.id, a.status]));

      setRewards((pays || []).map((p: Record<string, unknown>) => ({
        ...p,
        tester_name: (testerMap[p.tester_id as string] as string) || 'Unknown tester',
        job_title: (jobMap[p.job_id as string] as string) || 'Unknown job',
        assignment_status: (assignmentMap[p.assignment_id as string] as string) || '',
      })) as UatReward[]);
    } catch {
      setError('Failed to load the reward ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rewards.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending_review' || r.status === 'pending';
    return r.status === filter;
  });

  const approvedTotal = rewards.filter((r) => r.status === 'approved').reduce((s, r) => s + (r.reward_amount_minor || 0), 0);
  const paidTotal = rewards.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.reward_amount_minor || 0), 0);
  const pendingTotal = rewards.filter((r) => r.status === 'pending_review' || r.status === 'pending').reduce((s, r) => s + (r.reward_amount_minor || 0), 0);

  const openAction = (kind: 'paid' | 'reject' | 'cancel', reward: UatReward) => {
    setActionError('');
    setReason('');
    setPendingAction({ kind, reward });
  };

  const runAction = async () => {
    if (!pendingAction) return;
    if ((pendingAction.kind === 'reject' || pendingAction.kind === 'cancel') && !reason.trim()) {
      setActionError('A reason is required.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      let err: { message: string } | null = null;
      if (pendingAction.kind === 'paid') {
        ({ error: err } = await supabase.rpc('mark_uat_reward_paid', { p_payment_id: pendingAction.reward.id }));
      } else if (pendingAction.kind === 'reject') {
        ({ error: err } = await supabase.rpc('reject_uat_reward', { p_payment_id: pendingAction.reward.id, p_reason: reason.trim() }));
      } else if (pendingAction.kind === 'cancel') {
        ({ error: err } = await supabase.rpc('cancel_uat_reward', { p_payment_id: pendingAction.reward.id, p_reason: reason.trim() }));
      }
      if (err) throw err;
      setPendingAction(null);
      setReason('');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Pending Review</p>
          <p className="text-sm font-semibold text-yellow-400 mt-0.5">{formatMinorCurrency(pendingTotal, 'GBP')}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Approved (Unpaid)</p>
          <p className="text-sm font-semibold text-emerald-400 mt-0.5">{formatMinorCurrency(approvedTotal, 'GBP')}</p>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Paid</p>
          <p className="text-sm font-semibold text-sky-400 mt-0.5">{formatMinorCurrency(paidTotal, 'GBP')}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              filter === f.key
                ? 'bg-accent-500/10 text-accent-400'
                : 'text-foreground-400 hover:text-foreground-200 hover:bg-background-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-foreground-500 py-8">Loading reward ledger...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-foreground-500 py-8">No reward records match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-foreground-500 border-b border-background-200/60">
                <th className="py-2 pr-3 font-label font-medium">Tester</th>
                <th className="py-2 pr-3 font-label font-medium">UAT Job</th>
                <th className="py-2 pr-3 font-label font-medium">Reward</th>
                <th className="py-2 pr-3 font-label font-medium">Status</th>
                <th className="py-2 pr-3 font-label font-medium">Approved Date</th>
                <th className="py-2 pr-3 font-label font-medium">Paid Date</th>
                <th className="py-2 font-label font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-background-200/40">
                  <td className="py-2.5 pr-3">
                    <p className="text-foreground-100 font-medium">{r.tester_name}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-300">{r.job_title}</td>
                  <td className="py-2.5 pr-3 text-foreground-200 font-medium">{formatMinorCurrency(r.reward_amount_minor || 0, r.currency || 'GBP')}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${REWARD_STATUS_COLORS[r.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                      {REWARD_STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-300">{formatDateTime(r.approved_at) || '—'}</td>
                  <td className="py-2.5 pr-3 text-foreground-300">{formatDateTime(r.paid_at) || '—'}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'approved' && (
                        <button
                          onClick={() => openAction('paid', r)}
                          className="text-sky-400 hover:text-sky-300 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Mark as Paid
                        </button>
                      )}
                      {(r.status === 'pending_review' || r.status === 'approved') && (
                        <button
                          onClick={() => openAction('reject', r)}
                          className="text-red-400 hover:text-red-300 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Reject
                        </button>
                      )}
                      {r.status !== 'paid' && r.status !== 'cancelled' && (
                        <button
                          onClick={() => openAction('cancel', r)}
                          className="text-foreground-500 hover:text-foreground-300 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Cancel
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

      {/* Confirmation modal */}
      <Modal
        open={pendingAction !== null}
        onClose={() => { if (!busy) setPendingAction(null); }}
        title={
          pendingAction?.kind === 'paid' ? 'Mark Reward as Paid'
          : pendingAction?.kind === 'reject' ? 'Reject Reward'
          : pendingAction?.kind === 'cancel' ? 'Cancel Reward'
          : 'Confirm'
        }
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          {pendingAction && (
            <div className="space-y-3">
              <p className="text-sm text-foreground-300">
                {pendingAction.kind === 'paid' && (
                  <>Mark <span className="text-foreground-100">{formatMinorCurrency(pendingAction.reward.reward_amount_minor || 0, pendingAction.reward.currency || 'GBP')}</span> for <span className="text-foreground-100">{pendingAction.reward.tester_name}</span> as paid? This is an administrative status only — no payment is sent.</>
                )}
                {pendingAction.kind === 'reject' && (
                  <>Reject this reward for <span className="text-foreground-100">{pendingAction.reward.tester_name}</span>? A reason is required. The ledger entry is retained.</>
                )}
                {pendingAction.kind === 'cancel' && (
                  <>Cancel this reward for <span className="text-foreground-100">{pendingAction.reward.tester_name}</span>? A reason is required. The ledger entry is retained.</>
                )}
              </p>
              {(pendingAction.kind === 'reject' || pendingAction.kind === 'cancel') && (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Reason"
                  className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
                />
              )}
              {actionError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{actionError}</p>
                </div>
              )}
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
                pendingAction?.kind === 'paid'
                  ? 'bg-sky-500 hover:bg-sky-400 text-white'
                  : 'bg-red-500 hover:bg-red-400 text-white'
              }`}
            >
              {busy ? 'Saving...' : pendingAction?.kind === 'paid' ? 'Mark as Paid' : pendingAction?.kind === 'reject' ? 'Reject' : 'Cancel Reward'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}