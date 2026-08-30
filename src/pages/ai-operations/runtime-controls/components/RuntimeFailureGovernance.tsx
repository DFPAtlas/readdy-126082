import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  finalizeTimedOutDiagnosticRun,
  getRuntimeFailureStatus,
  deriveFailureCategory,
  FAILURE_CATEGORY_META,
  RUNTIME_WAIT_WINDOW_LABEL,
  type RuntimeFailureStatusResult,
} from '@/lib/ai-operations/runtimeFailureGovernance';

const NON_TERMINAL = new Set(['queued', 'working', 'waiting']);

export default function RuntimeFailureGovernance() {
  const { role } = useAuth();
  const isPrivileged = role === 'owner' || role === 'admin';

  const [status, setStatus] = useState<RuntimeFailureStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    const res = await getRuntimeFailureStatus();
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }

  async function handleFinalize() {
    if (!isPrivileged || !status?.runKey) return;
    setFinalizing(true);
    setError(null);
    const res = await finalizeTimedOutDiagnosticRun(status.runKey);
    if (res.error) {
      setError(res.error);
    }
    setFinalizing(false);
    await refreshStatus();
  }

  const failureCategory = deriveFailureCategory(status);
  const categoryMeta = failureCategory ? FAILURE_CATEGORY_META[failureCategory] : null;
  const runStatus = status?.runStatus ?? null;
  const runNonTerminal = !!runStatus && NON_TERMINAL.has(runStatus);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <i className="ri-close-circle-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Failure Governance</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Prove runtime failures close safely without retry or duplicate execution</p>
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

      {/* Governance invariants — always visible */}
      <div className="px-4 py-3">
        <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">Fixed Failure Governance Invariants</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-background-200/60 rounded-md overflow-hidden">
          <InvariantStat
            label="Auto Retry"
            value="DISABLED"
            icon="ri-forbid-line"
            tone="red"
            detail="max_attempts is fixed at 1 — no silent retry, no redispatch"
          />
          <InvariantStat
            label="Maximum Attempts"
            value="1"
            icon="ri-list-check-3"
            tone="amber"
            detail={`fixed ${RUNTIME_WAIT_WINDOW_LABEL} signed-result wait window (server-enforced)`}
          />
          <InvariantStat
            label="Normal Execution"
            value="BLOCKED"
            icon="ri-lock-line"
            tone="red"
            detail="Master Kill Switch ON · Production Enabled 0"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          {status?.found && runNonTerminal && (
            <button
              onClick={() => void handleFinalize()}
              disabled={finalizing || loading || !isPrivileged}
              title={isPrivileged ? 'Finalize a run that has already exceeded its timeout' : 'Owner or admin role required'}
              className="inline-flex items-center gap-1.5 text-xs font-label font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-md px-3.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className={`${finalizing ? 'ri-loader-4-line animate-spin' : 'ri-stop-circle-line'} w-4 h-4 flex items-center justify-center`}></i>
              {finalizing ? 'Finalizing…' : 'Finalize Timed-Out Run'}
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
              Read-only — owner/admin required to finalize
            </span>
          )}
        </div>

        {error && (
          <div className="mt-2 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
            <p className="text-xs text-red-300/90">{error}</p>
          </div>
        )}

        {status && status.found && (
          <div className="mt-3 space-y-2">
            {failureCategory && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5">
                <i className="ri-shield-cross-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
                <div className="min-w-0">
                  <p className="text-xs text-red-300/90 font-semibold">Runtime Diagnostic Failed Safely</p>
                  <p className="text-[11px] text-red-400/70 mt-0.5">
                    Category: {categoryMeta?.label ?? failureCategory} · Retry count {status.retryCount} · Max attempts {status.maxAttempts} · Normal execution BLOCKED
                  </p>
                </div>
              </div>
            )}

            {!failureCategory && runNonTerminal && (
              <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5">
                <i className="ri-time-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0"></i>
                <p className="text-xs text-amber-300/90">Run dispatched — awaiting a valid signed result. If it exceeds the fixed {RUNTIME_WAIT_WINDOW_LABEL} window, finalize it here to close it as failed (no retry).</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <DetailStat label="Run" value={status.runKey || '—'} mono />
              <DetailStat label="Task" value={status.taskKey || '—'} mono />
              <DetailStat label="Correlation ID" value={status.correlationId || '—'} mono />
              <DetailStat
                label="Failure Category"
                value={categoryMeta?.label ?? (failureCategory ?? 'None')}
                tone={failureCategory ? 'red' : undefined}
              />
              <DetailStat label="Failed Step" value={status.failedStep || '—'} tone={status.failedStep ? 'red' : undefined} />
              <DetailStat
                label="Outbound Message"
                value={status.outboundMessageStatus || '—'}
                tone={status.outboundMessageStatus === 'expired' ? 'red' : status.outboundMessageStatus ? 'amber' : undefined}
              />
              <DetailStat
                label="Signed Result"
                value={!status.resultReceived ? 'Awaiting' : status.resultVerified ? 'Verified' : 'Not verified'}
                tone={status.resultReceived && !status.resultVerified ? 'red' : status.resultReceived ? 'emerald' : 'amber'}
              />
              <DetailStat
                label="Bridge State"
                value={status.bridgeReachable === true ? 'Reachable' : status.bridgeReachable === false ? 'Unreachable' : '—'}
                tone={status.bridgeReachable === false ? 'red' : status.bridgeReachable === true ? 'emerald' : undefined}
              />
              <DetailStat
                label="Timeout State"
                value={status.timedOut ? 'TIMED OUT' : 'Within window'}
                tone={status.timedOut ? 'red' : undefined}
              />
              <DetailStat label="Late Result Seen" value={status.lateResultReceived ? 'Yes' : 'No'} tone={status.lateResultReceived ? 'amber' : undefined} />
              <DetailStat label="Duplicate Result" value={status.duplicateResultBlocked ? 'Blocked' : 'None'} tone={status.duplicateResultBlocked ? 'amber' : undefined} />
              <DetailStat label="Retry Count" value={String(status.retryCount)} />
              <DetailStat label="Incident" value={status.incidentKey || '—'} mono tone={status.incidentKey ? 'amber' : undefined} />
              <DetailStat label="Execution State" value="BLOCKED" tone="red" />
            </div>
          </div>
        )}

        {status && !status.found && (
          <div className="mt-3 flex items-center gap-2.5 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
            <i className="ri-information-line text-foreground-500 w-4 h-4 flex items-center justify-center shrink-0"></i>
            <p className="text-xs text-foreground-500">No controlled diagnostic failure run has been recorded yet. Dispatch a diagnostic or approval-gated run, let it exceed the fixed window, then finalize it here.</p>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-xs text-foreground-500">
          <strong className="text-foreground-300">Failures close deterministically.</strong>{' '}
          The timeout finaliser reads persisted state only and never dispatches. No silent retry, no automatic redispatch, no duplicate HAL call, no fake success, and no production execution — ever.
        </p>
      </div>
    </section>
  );
}

function InvariantStat({ label, value, icon, tone, detail }: { label: string; value: string; icon: string; tone: 'red' | 'amber'; detail: string }) {
  return (
    <div className="bg-background-100 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <i className={`${icon} ${tone === 'red' ? 'text-red-400' : 'text-amber-400'} w-3.5 h-3.5 flex items-center justify-center shrink-0`}></i>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      </div>
      <p className={`text-sm font-heading font-semibold mt-0.5 ${tone === 'red' ? 'text-red-400' : 'text-amber-400'}`}>{value}</p>
      <p className="text-[10px] text-foreground-600 mt-0.5">{detail}</p>
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