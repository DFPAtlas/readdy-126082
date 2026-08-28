import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatJob } from '../types';
import MarketplacePreviewModal from './MarketplacePreviewModal';
import {
  MARKETPLACE_STATUS_LABELS,
  MARKETPLACE_STATUS_COLORS,
  CLAIM_MODE_LABELS,
  formatMinorCurrency,
  maxRewardBudget,
  formatDateTime,
  allocatedSlots,
  remainingSlots,
  buildReadinessChecks,
  isReadyToPublish,
  marketplaceVisibilityLabel,
} from '../marketplace';

interface Props {
  job: UatJob;
  testCaseCount: number;
  onChanged: () => void;
  onConfigure: () => void;
}

type ConfirmAction = 'publish' | 'pause' | 'resume' | 'close' | 'cancel';

const PRIMARY_BTN =
  'bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40';
const SECONDARY_BTN =
  'bg-background-50 border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-accent-500/40 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap';
const DANGER_BTN =
  'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap';

export default function TesterMarketplacePanel({ job, testCaseCount, onChanged, onConfigure }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const status = job.marketplace_status ?? 'draft';
  const checks = buildReadinessChecks(job, testCaseCount);
  const ready = checks.every((c) => c.passed);
  const total = job.max_testers ?? 0;
  const allocated = allocatedSlots(job);
  const remaining = remainingSlots(job);
  const isFull = total > 0 && remaining <= 0;
  const budget = maxRewardBudget(job.reward_amount_minor ?? 0, total);
  const vis = marketplaceVisibilityLabel(job);

  const canPublish = (status === 'draft' || status === 'ready') && ready && !isFull;
  const canPause = status === 'published';
  const canResume = status === 'paused';
  const canClose = status === 'published' || status === 'paused';
  const canCancel = !['closed', 'cancelled'].includes(status);

  const applyStatus = async (newStatus: string, action: string) => {
    setBusy(true);
    setActionError('');
    try {
      const payload: Record<string, unknown> = { marketplace_status: newStatus };
      if (newStatus === 'published' && !job.published_at) payload.published_at = new Date().toISOString();
      if (newStatus === 'cancelled') {
        payload.cancelled_at = new Date().toISOString();
        if (cancelReason.trim()) payload.cancellation_reason = cancelReason.trim();
      }

      const { error } = await supabase.from('uat_jobs').update(payload).eq('id', job.id);
      if (error) throw error;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('uat_audit_log').insert({
          actor_id: session?.user?.id ?? null,
          action,
          entity_type: 'uat_job',
          entity_id: job.id,
          previous_value: { marketplace_status: job.marketplace_status },
          new_value: { marketplace_status: newStatus },
        });
      } catch {
        /* audit is best-effort, never block the status change on it */
      }

      setConfirmAction(null);
      setCancelReason('');
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = () => {
    if (!ready || isFull) return;
    setActionError('');
    setConfirmAction('publish');
  };
  const handlePause = () => { setActionError(''); setConfirmAction('pause'); };
  const handleResume = () => {
    if (!isReadyToPublish(job, testCaseCount)) {
      setActionError('This job no longer passes publication checks — reconfigure it before resuming.');
      return;
    }
    if (remaining <= 0) {
      setActionError('No tester places remaining — cannot resume.');
      return;
    }
    setActionError('');
    setConfirmAction('resume');
  };
  const handleClose = () => { setActionError(''); setConfirmAction('close'); };
  const handleCancel = () => { setCancelReason(''); setActionError(''); setConfirmAction('cancel'); };

  const submitConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction === 'publish') await applyStatus('published', 'marketplace_publish');
    else if (confirmAction === 'pause') await applyStatus('paused', 'marketplace_pause');
    else if (confirmAction === 'resume') await applyStatus('published', 'marketplace_resume');
    else if (confirmAction === 'close') await applyStatus('closed', 'marketplace_close');
    else if (confirmAction === 'cancel') await applyStatus('cancelled', 'marketplace_cancel');
  };

  const confirmConfig: Record<ConfirmAction, { title: string; confirmLabel: string; danger: boolean }> = {
    publish: { title: 'Publish UAT', confirmLabel: 'Publish UAT', danger: false },
    pause: { title: 'Pause Listing', confirmLabel: 'Pause Listing', danger: false },
    resume: { title: 'Resume Listing', confirmLabel: 'Resume Listing', danger: false },
    close: { title: 'Close UAT Listing', confirmLabel: 'Close Listing', danger: false },
    cancel: { title: 'Cancel UAT Opportunity', confirmLabel: 'Cancel Opportunity', danger: true },
  };

  return (
    <div className="rounded-md bg-background-50 border border-background-200/60 p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">Tester Marketplace</p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${MARKETPLACE_STATUS_COLORS[status] ?? 'bg-foreground-500/10 text-foreground-500'}`}>
            {MARKETPLACE_STATUS_LABELS[status] ?? status}
          </span>
          <button
            onClick={onConfigure}
            className="flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-settings-3-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Configure Tester Job
          </button>
        </div>
      </div>

      {/* ── Status card ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
        <div><span className="text-foreground-500">Marketplace Visibility:</span> <span className="text-foreground-200 ml-1">{vis.label}</span></div>
        <div><span className="text-foreground-500">Reward:</span> <span className="text-foreground-200 ml-1">{formatMinorCurrency(job.reward_amount_minor ?? 0, job.currency ?? 'GBP')}</span></div>
        <div><span className="text-foreground-500">Tester Places:</span> <span className="text-foreground-200 ml-1">{allocated} / {total} allocated</span></div>
        <div><span className="text-foreground-500">Places Remaining:</span> <span className="text-foreground-200 ml-1">{remaining}</span></div>
        <div><span className="text-foreground-500">Maximum Reward Budget:</span> <span className="text-foreground-200 ml-1">{formatMinorCurrency(budget, job.currency ?? 'GBP')}</span></div>
        <div><span className="text-foreground-500">Claim Mode:</span> <span className="text-foreground-200 ml-1">{CLAIM_MODE_LABELS[job.claim_mode] ?? 'Approval Required'}</span></div>
        <div><span className="text-foreground-500">Opening:</span> <span className="text-foreground-200 ml-1">{formatDateTime(job.application_opens_at) || '—'}</span></div>
        <div><span className="text-foreground-500">Closing:</span> <span className="text-foreground-200 ml-1">{formatDateTime(job.application_closes_at) || '—'}</span></div>
        {job.published_at && <div><span className="text-foreground-500">Published:</span> <span className="text-foreground-200 ml-1">{formatDateTime(job.published_at)}</span></div>}
      </div>

      {/* ── Full banner ── */}
      {isFull && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-orange-400">FULL — {allocated} of {total} tester places allocated. No new tester claims available.</p>
        </div>
      )}

      {/* ── Readiness ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">Marketplace Readiness</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ready ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {ready ? 'Ready to Publish' : 'Not Ready'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {checks.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-xs">
              <i className={`${c.passed ? 'ri-check-line text-emerald-400' : 'ri-close-line text-red-400'} text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
              <span className={c.passed ? 'text-foreground-300' : 'text-foreground-400'}>{c.label}</span>
              {c.hint && <span className="text-foreground-600 text-[10px]">{c.hint}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-red-400">{actionError}</p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setPreviewOpen(true)} className={SECONDARY_BTN}>
          <i className="ri-eye-line w-3.5 h-3.5 flex items-center justify-center mr-1"></i>
          Preview
        </button>
        {canPublish && <button onClick={handlePublish} className={PRIMARY_BTN}>Publish UAT</button>}
        {canPause && <button onClick={handlePause} className={SECONDARY_BTN}>Pause Listing</button>}
        {canResume && <button onClick={handleResume} className={PRIMARY_BTN}>Resume Listing</button>}
        {canClose && <button onClick={handleClose} className={SECONDARY_BTN}>Close Listing</button>}
        {canCancel && <button onClick={handleCancel} className={DANGER_BTN}>Cancel Opportunity</button>}
        {!ready && status !== 'published' && <button onClick={onConfigure} className={PRIMARY_BTN}>Fix Configuration</button>}
      </div>

      {/* ── Preview modal ── */}
      <MarketplacePreviewModal open={previewOpen} job={job} onClose={() => setPreviewOpen(false)} />

      {/* ── Confirm modal ── */}
      <Modal
        open={confirmAction !== null}
        onClose={() => { if (!busy) setConfirmAction(null); }}
        title={confirmAction ? confirmConfig[confirmAction].title : 'Confirm'}
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          {confirmAction === 'publish' && (
            <div className="space-y-3">
              <p className="text-sm text-foreground-300">Publish this paid UAT opportunity?</p>
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-foreground-500">Reward per accepted tester</span><span className="text-foreground-100">{formatMinorCurrency(job.reward_amount_minor ?? 0, job.currency ?? 'GBP')}</span></div>
                <div className="flex justify-between"><span className="text-foreground-500">Tester places</span><span className="text-foreground-100">{total}</span></div>
                <div className="flex justify-between"><span className="text-foreground-500">Maximum tester reward budget</span><span className="text-foreground-100">{formatMinorCurrency(budget, job.currency ?? 'GBP')}</span></div>
              </div>
              <p className="text-xs text-foreground-500">Once published, eligible approved testers will be able to see this job when the DFP marketplace integration is enabled.</p>
            </div>
          )}
          {confirmAction === 'pause' && (
            <p className="text-sm text-foreground-300">Pause this listing? Existing assigned testers are unaffected and can continue their assigned work. New discovery and claims will be blocked.</p>
          )}
          {confirmAction === 'resume' && (
            <p className="text-sm text-foreground-300">Resume this listing? It will return to published and become eligible for marketplace discovery again.</p>
          )}
          {confirmAction === 'close' && (
            <p className="text-sm text-foreground-300">Close this UAT listing? Recruitment stops and no new testers may join. All existing UAT data — test cases, assignments, sessions, results, evidence, defects and approvals — is retained.</p>
          )}
          {confirmAction === 'cancel' && (
            <div className="space-y-3">
              <p className="text-sm text-foreground-300">Cancel this UAT opportunity? No new testers may claim it. Existing records are retained, and already-assigned testers may require manual review.</p>
              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Cancellation reason</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this opportunity is being cancelled (recommended)."
                  className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={() => setConfirmAction(null)}
              disabled={busy}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={submitConfirm}
              disabled={busy}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                confirmAction && confirmConfig[confirmAction].danger
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : 'bg-accent-500 hover:bg-accent-400 text-background-950'
              }`}
            >
              {busy ? 'Saving...' : confirmAction ? confirmConfig[confirmAction].confirmLabel : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}