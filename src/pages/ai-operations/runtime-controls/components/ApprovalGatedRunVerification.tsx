import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import { useRuntimeBridge } from '@/pages/ai-operations/runtime-controls/runtimeBridgeStore';
import {
  createApprovalGatedRun,
  approveApprovalGatedRun,
  rejectApprovalGatedRun,
  dispatchApprovedDiagnosticRun,
  getApprovalGatedRunStatus,
  deriveApprovalGatedState,
  isApprovalGatedTerminal,
  formatApprovalGatedMs,
  formatHalDispatch,
  APPROVAL_GATED_STATE_META,
  APPROVAL_GATED_NODE_KEY,
  APPROVAL_GATED_PROBE_ID,
  APPROVAL_GATED_MODE,
  APPROVAL_GATED_TASK_KEY_PREFIX,
  APPROVAL_GATED_TASK_NAME,
  APPROVAL_GATED_APPROVAL_TYPE,
  APPROVAL_GATED_AGENT_KEY,
  APPROVAL_GATED_AGENT_NAME,
  APPROVAL_GATED_TOOL_KEY,
  APPROVAL_GATED_TOOL_NAME,
  APPROVAL_GATED_TOOL_OPERATION,
  APPROVAL_GATED_PERMISSION,
  APPROVAL_GATED_STEPS,
  type ApprovalGatedRunStatusResult,
  type ApprovalGatedState,
} from '@/lib/ai-operations/runtimeApprovalGatedRun';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTimeRemaining(expiresAt: string | null, isExpired: boolean, nowMs: number): string {
  if (!expiresAt) return '—';
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (isExpired || ms <= 0) return 'Expired';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function ApprovalGatedRunVerification() {
  const { role } = useAuth();
  const { nodes } = useRuntimeBridge();

  const isPrivileged = role === 'owner' || role === 'admin';

  const [status, setStatus] = useState<ApprovalGatedRunStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<'create' | 'approve' | 'reject' | 'dispatch' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollActiveRef = useRef(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    void refreshStatus();
    return () => {
      pollActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!status?.run) return;
    if (isApprovalGatedTerminal(deriveApprovalGatedState(status))) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    const res = await getApprovalGatedRunStatus();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }

  async function pollUntilTerminal() {
    pollActiveRef.current = true;
    let attempts = 0;
    while (pollActiveRef.current && attempts < 16) {
      await new Promise((r) => setTimeout(r, 2500));
      if (!pollActiveRef.current) break;
      const res = await getApprovalGatedRunStatus();
      if (res.error) {
        setError(res.error);
        break;
      }
      if (res.data) {
        setStatus(res.data);
        if (isApprovalGatedTerminal(deriveApprovalGatedState(res.data))) break;
      }
      attempts += 1;
    }
    pollActiveRef.current = false;
  }

  const approvalKey = status?.approval?.approvalKey ?? '';

  async function handleCreate() {
    if (!isPrivileged) return;
    setSending('create');
    setError(null);
    const res = await createApprovalGatedRun(APPROVAL_GATED_NODE_KEY);
    if (res.error) {
      setError(res.error);
      setSending(null);
      return;
    }
    await refreshStatus();
    setSending(null);
  }

  async function handleApprove() {
    if (!isPrivileged || !approvalKey) return;
    setSending('approve');
    setError(null);
    const res = await approveApprovalGatedRun(approvalKey);
    if (res.error) {
      setError(res.error);
      setSending(null);
      return;
    }
    await refreshStatus();
    setSending(null);
  }

  async function handleReject() {
    if (!isPrivileged || !approvalKey) return;
    setSending('reject');
    setError(null);
    const res = await rejectApprovalGatedRun(approvalKey);
    if (res.error) {
      setError(res.error);
      setSending(null);
      return;
    }
    await refreshStatus();
    setSending(null);
  }

  async function handleDispatch() {
    if (!isPrivileged || !approvalKey) return;
    setSending('dispatch');
    setError(null);
    const res = await dispatchApprovedDiagnosticRun(approvalKey, APPROVAL_GATED_NODE_KEY);
    if (res.error) {
      setError(res.error);
      setSending(null);
      return;
    }
    await refreshStatus();
    setSending(null);
    void pollUntilTerminal();
  }

  const nodeName = nodes.length > 0 ? (nodes[0].name ?? nodes[0].node_key) : 'HAL Runtime Bridge';

  const state: ApprovalGatedState = status ? deriveApprovalGatedState(status) : 'not_started';
  const meta = APPROVAL_GATED_STATE_META[state];
  const completedSteps = (status?.steps ?? []).filter((s) => s.status === 'completed').length;
  const totalSteps = status?.run?.totalSteps ?? APPROVAL_GATED_STEPS.length;
  const approvalStatus = status?.approval?.status ?? null;
  const expiresAt = status?.approval?.expiresAt ?? null;
  const isExpired = status?.approval?.isExpired ?? false;
  const contextBound = status?.approval?.approvalContextBound ?? false;
  const contextMatched = status?.approval?.approvalContextMatched ?? false;
  const contextFingerprint = status?.approval?.contextFingerprint ?? null;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-verified-badge-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Human Approval-Gated Run</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Prove runtime dispatch cannot occur without explicit human approval</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-vip-diamond-line w-3 h-3 flex items-center justify-center"></i>
            Sandbox diagnostic only
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Normal execution BLOCKED
          </span>
        </div>
      </div>

      {/* Fixed approval-gated configuration */}
      <div className="px-4 py-3">
        <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Fixed Approval-Gated Configuration</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60 rounded-md overflow-hidden">
          <ConfigStat label="Task" value={APPROVAL_GATED_TASK_NAME} />
          <ConfigStat label="Task key" value={APPROVAL_GATED_TASK_KEY_PREFIX} mono />
          <ConfigStat label="Agent" value={APPROVAL_GATED_AGENT_NAME} />
          <ConfigStat label="Agent key" value={APPROVAL_GATED_AGENT_KEY} mono />
          <ConfigStat label="Tool" value={APPROVAL_GATED_TOOL_NAME} />
          <ConfigStat label="Tool key" value={APPROVAL_GATED_TOOL_KEY} mono />
          <ConfigStat label="Operation" value={APPROVAL_GATED_TOOL_OPERATION} mono />
          <ConfigStat label="Permission" value={APPROVAL_GATED_PERMISSION} tone="emerald" />
          <ConfigStat label="Probe ID" value={APPROVAL_GATED_PROBE_ID} mono />
          <ConfigStat label="Mode" value={APPROVAL_GATED_MODE} mono />
          <ConfigStat label="Approval type" value={APPROVAL_GATED_APPROVAL_TYPE} mono />
          <ConfigStat label="Approver gate" value="Human · 1 required" tone="amber" />
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-background-200/60">
        <SummaryStat label="Task" value={APPROVAL_GATED_TASK_NAME} />
        <SummaryStat label="Agent" value={APPROVAL_GATED_AGENT_NAME} />
        <SummaryStat label="Tool" value={APPROVAL_GATED_TOOL_NAME} />
        <SummaryStat label="HAL node" value={nodeName} />
        <SummaryStat
          label="Run State"
          value={status && status.run ? meta.label : 'Not run'}
          tone={meta.tone === 'emerald' ? 'emerald' : meta.tone === 'red' ? 'red' : meta.tone === 'amber' ? 'amber' : undefined}
        />
        <SummaryStat label="Mutation" value="NONE" tone="red" />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => void handleCreate()}
            disabled={sending !== null || loading || !isPrivileged}
            title={isPrivileged ? undefined : 'Owner or admin role required to create the approval-gated run'}
            className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-primary-500 hover:bg-primary-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${sending === 'create' ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'} w-4 h-4 flex items-center justify-center`}></i>
            {sending === 'create' ? 'Creating…' : 'Create Approval-Gated Run'}
          </button>

          {approvalStatus === 'pending' && (
            <>
              <button
                onClick={() => void handleApprove()}
                disabled={sending !== null || loading || !isPrivileged}
                title={isPrivileged ? undefined : 'Owner or admin role required to approve'}
                className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-emerald-500 hover:bg-emerald-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <i className={`${sending === 'approve' ? 'ri-loader-4-line animate-spin' : 'ri-check-line'} w-4 h-4 flex items-center justify-center`}></i>
                {sending === 'approve' ? 'Approving…' : 'Approve'}
              </button>
              <button
                onClick={() => void handleReject()}
                disabled={sending !== null || loading || !isPrivileged}
                title={isPrivileged ? undefined : 'Owner or admin role required to reject'}
                className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-red-500/80 hover:bg-red-500 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <i className={`${sending === 'reject' ? 'ri-loader-4-line animate-spin' : 'ri-close-line'} w-4 h-4 flex items-center justify-center`}></i>
                {sending === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          )}

          {approvalStatus === 'approved' && (
            <button
              onClick={() => void handleDispatch()}
              disabled={sending !== null || loading || !isPrivileged}
              title={isPrivileged ? undefined : 'Owner or admin role required to dispatch'}
              className="inline-flex items-center gap-1.5 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className={`${sending === 'dispatch' ? 'ri-loader-4-line animate-spin' : 'ri-send-plane-line'} w-4 h-4 flex items-center justify-center`}></i>
              {sending === 'dispatch' ? 'Dispatching…' : 'Dispatch Approved Run'}
            </button>
          )}

          <button
            onClick={() => void refreshStatus()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <i className={`${loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
            Refresh
          </button>

          {!isPrivileged && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-600 whitespace-nowrap">
              <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Read-only — owner/admin required
            </span>
          )}
        </div>

        {error && (
          <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
            <p className="text-xs text-red-300/90">{error}</p>
          </div>
        )}

        {status && status.run && (
          <div className="mt-3 space-y-2">
            <ResultBanner status={status} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <DetailStat label="Task" value={status.task?.taskKey || APPROVAL_GATED_TASK_KEY_PREFIX} mono />
              <DetailStat label="Run ID" value={status.run.runKey || '—'} mono />
              <DetailStat label="Approval ID" value={approvalKey || '—'} mono />
              <DetailStat
                label="Approval status"
                value={approvalStatus || '—'}
                tone={approvalStatus === 'approved' || approvalStatus === 'completed' ? 'emerald' : approvalStatus === 'rejected' ? 'red' : undefined}
              />
              <DetailStat label="Approver" value={status.approval?.decisionActor || '—'} />
              <DetailStat label="Approval time" value={formatTime(status.approval?.decisionAt)} />
              <DetailStat
                label="Approval expires"
                value={formatTime(expiresAt)}
                tone={isExpired ? 'red' : undefined}
              />
              <DetailStat
                label="Time remaining"
                value={formatTimeRemaining(expiresAt, isExpired, nowMs)}
                tone={isExpired ? 'red' : 'amber'}
              />
              <DetailStat
                label="Context binding"
                value={contextBound ? 'BOUND' : 'NOT BOUND'}
                tone={contextBound ? 'emerald' : 'amber'}
              />
              <DetailStat
                label="Context status"
                value={!contextBound ? 'N/A' : contextMatched ? 'MATCHED' : 'CHANGED'}
                tone={!contextBound ? undefined : contextMatched ? 'emerald' : 'red'}
              />
              <DetailStat label="Context fingerprint" value={contextFingerprint || '—'} mono />
              <DetailStat label="Run status" value={status.run.status || '—'} tone={state === 'completed' ? 'emerald' : state === 'failed' || state === 'rejected' ? 'red' : undefined} />
              <DetailStat label="Task status" value={status.task?.status || '—'} />
              <DetailStat label="Current step" value={`${status.run.currentStep ?? 0} / ${totalSteps}`} />
              <DetailStat label="Completed steps" value={`${completedSteps} / ${totalSteps}`} />
              <DetailStat
                label="HAL dispatch"
                value={formatHalDispatch(status.halDispatch)}
                tone={status.halDispatch === 'BLOCKED' || status.halDispatch === 'NOT_YET_SENT' ? 'red' : status.halDispatch === 'SENT' ? 'amber' : 'emerald'}
              />
              <DetailStat
                label="n8n status"
                value={status.signedResult?.n8nStatus || '—'}
                tone={status.signedResult?.n8nStatus === 'healthy' ? 'emerald' : status.signedResult?.n8nStatus === 'degraded' ? 'amber' : undefined}
              />
              <DetailStat
                label="Ollama status"
                value={status.signedResult?.ollamaStatus || '—'}
                tone={status.signedResult?.ollamaStatus === 'healthy' ? 'emerald' : status.signedResult?.ollamaStatus === 'degraded' ? 'amber' : undefined}
              />
              <DetailStat
                label="Model count"
                value={status.signedResult?.ollamaModelCount === null || status.signedResult?.ollamaModelCount === undefined ? '—' : String(status.signedResult.ollamaModelCount)}
              />
              <DetailStat label="Tool latency" value={formatApprovalGatedMs(status.signedResult?.latencyMs)} />
              <DetailStat
                label="Signed evidence"
                value={status.signedResult?.verified ? 'Verified' : status.signedResult ? 'Not verified' : 'Awaiting'}
                tone={status.signedResult?.verified ? 'emerald' : status.signedResult ? 'red' : 'amber'}
              />
              <DetailStat label="Business data" value="NONE" tone="red" />
              <DetailStat label="Mutation" value="NONE" tone="red" />
              <DetailStat label="Normal execution" value="BLOCKED" tone="red" />
            </div>

            {status.steps.length > 0 && (
              <div className="mt-2">
                <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Run Lifecycle Steps</h4>
                <div className="space-y-1">
                  {status.steps.map((s) => (
                    <div key={s.stepNumber} className="flex items-center gap-2.5 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${s.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'failed' ? 'bg-red-500/20 text-red-400' : s.status === 'awaiting_approval' ? 'bg-amber-500/20 text-amber-400' : 'bg-background-200/60 text-foreground-500'}`}>
                        {s.status === 'completed' ? (
                          <i className="ri-check-line w-3 h-3 flex items-center justify-center"></i>
                        ) : s.status === 'failed' ? (
                          <i className="ri-close-line w-3 h-3 flex items-center justify-center"></i>
                        ) : s.status === 'awaiting_approval' ? (
                          <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
                        ) : (
                          <i className="ri-time-line w-3 h-3 flex items-center justify-center"></i>
                        )}
                      </span>
                      <span className="text-xs text-foreground-200 font-mono">{s.stepNumber}.</span>
                      <span className="text-xs text-foreground-100 font-mono flex-1 truncate">{s.name}</span>
                      <span className={`text-[10px] font-label uppercase tracking-wide ${s.status === 'completed' ? 'text-emerald-400' : s.status === 'failed' ? 'text-red-400' : s.status === 'awaiting_approval' ? 'text-amber-400' : 'text-foreground-500'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">Human approval is a real execution gate.</strong>{' '}
          Creating the run queues <strong className="text-amber-400">zero</strong> HAL messages. Only after an explicit human approval and a separate manual dispatch does the fixed read-only tool execute once. No business data is accessed, no mutation occurs, no model inference runs, and normal runtime execution remains <strong className="text-red-400">BLOCKED</strong>.
        </p>
      </div>
    </section>
  );
}

function ResultBanner({ status }: { status: ApprovalGatedRunStatusResult }) {
  const state = deriveApprovalGatedState(status);

  if (state === 'completed' && status.signedResult?.verified) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-3">
        <div className="flex items-center gap-2.5 mb-1.5">
          <i className="ri-shield-check-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-emerald-300/90 font-semibold">Approval-Gated Diagnostic Run Verified</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Approval</span>
            <span className="text-xs text-emerald-100 font-mono">{status.approval?.approvalKey || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Approver</span>
            <span className="text-xs text-emerald-100 font-semibold">{status.approval?.decisionActor || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Steps</span>
            <span className="text-xs text-emerald-100 font-semibold">{status.steps.filter((s) => s.status === 'completed').length} / {status.run?.totalSteps ?? APPROVAL_GATED_STEPS.length}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-400/70">Mutation</span>
            <span className="text-xs text-emerald-100 font-semibold">NONE</span>
          </div>
        </div>
        <p className="text-[11px] text-emerald-400/70 mt-2">A human explicitly approved this fixed sandbox diagnostic run before HAL dispatch. The approved read-only tool executed once, signed evidence was verified, and the task/run/approval lifecycle was closed without accessing business data or enabling normal execution.</p>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">The approval was rejected — the run was cancelled with no HAL dispatch, no retry, and no replacement approval.</p>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-close-circle-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-red-300/90">The approved run did not verify — the signed evidence or cloud-side revalidation failed. No normal execution occurred.</p>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
        <i className="ri-time-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <div className="min-w-0">
          <p className="text-xs text-red-300/90 font-semibold">Approval Expired</p>
          <p className="text-[11px] text-red-400/70 mt-0.5">The 5-minute approval window elapsed — this approval can no longer be approved or dispatched. A fresh human approval is required.</p>
        </div>
      </div>
    );
  }

  if (status.approval?.approvalContextBound === true && status.approval?.approvalContextMatched === false) {
    return (
      <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
        <i className="ri-alert-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <div className="min-w-0">
          <p className="text-xs text-amber-300/90 font-semibold">Approval Context Changed — New Approval Required</p>
          <p className="text-[11px] text-amber-400/70 mt-0.5">The authorized agent/tool/permission changed after approval. Dispatch is blocked and a fresh human approval is required. HAL dispatch remains BLOCKED.</p>
        </div>
      </div>
    );
  }

  if (state === 'awaiting_approval') {
    return (
      <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
        <i className="ri-lock-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <div className="min-w-0">
          <p className="text-xs text-amber-300/90 font-semibold">Awaiting Human Approval</p>
          <p className="text-[11px] text-amber-400/70 mt-0.5">HAL Dispatch: <strong>BLOCKED</strong> — no runtime dispatch exists until an explicit human approval and a separate manual dispatch.</p>
        </div>
      </div>
    );
  }

  if (state === 'approved') {
    return (
      <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-3 py-2.5">
        <i className="ri-check-double-line text-emerald-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
        <div className="min-w-0">
          <p className="text-xs text-emerald-300/90 font-semibold">Approved — Awaiting Manual Dispatch</p>
          <p className="text-[11px] text-emerald-400/70 mt-0.5">HAL Dispatch: <strong>NOT YET SENT</strong> — approval alone does not dispatch. Use “Dispatch Approved Run” to send the single fixed probe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
      <i className="ri-send-plane-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
      <p className="text-xs text-amber-300/90">Approved diagnostic dispatched — awaiting signed verified evidence from HAL. Only the fixed read-only health snapshot is queried.</p>
    </div>
  );
}

function ConfigStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'emerald' | 'amber'; mono?: boolean }) {
  return (
    <div className="bg-background-100 px-3 py-2">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-xs font-heading font-semibold mt-0.5 truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryStat({ label, value, tone, mono }: { label: string; value: number | string; tone?: 'emerald' | 'amber' | 'red'; mono?: boolean }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold mt-0.5 truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function DetailStat({ label, value, tone, mono }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'red'; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5">
      <span className="text-xs text-foreground-500 whitespace-nowrap">{label}</span>
      <span className={`text-xs truncate ${tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : tone === 'red' ? 'text-red-400' : 'text-foreground-100'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}