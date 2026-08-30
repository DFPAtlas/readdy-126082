import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  getDiagnosticRuntimeFreezeStatus,
  engageDiagnosticRuntimeFreeze,
  releaseDiagnosticRuntimeFreeze,
  type DiagnosticRuntimeFreezeStatus,
} from '@/lib/ai-operations/runtimeEmergencyFreeze';

// ============================================================================
// Emergency Runtime Freeze — operator-facing governance panel (Phase 3 Prompt 24C).
//
// Reflects backend truth only. The frontend is never authoritative: engage is
// owner/admin, release is owner only, and every action is server-enforced by
// `runtime-bridge-control` (verify_jwt=true + internal_role()).
// ============================================================================

const EMPTY_STATUS: DiagnosticRuntimeFreezeStatus = {
  engaged: false,
  engagedAt: null,
  engagedBy: null,
  releasedAt: null,
  releasedBy: null,
  pendingMessagesInvalidated: 0,
  inflightMessagesDetected: 0,
  latestAffectedRunKey: null,
  latestAffectedCorrelationId: null,
  normalExecutionBlocked: true,
  masterKillSwitchOn: true,
  productionEnabled: false,
};

export default function EmergencyRuntimeFreeze() {
  const { role } = useAuth();
  const [status, setStatus] = useState<DiagnosticRuntimeFreezeStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<'engage' | 'release' | null>(null);
  const [confirmEngage, setConfirmEngage] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const canEngage = isOwner || isAdmin;
  const canRelease = isOwner;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getDiagnosticRuntimeFreezeStatus();
    if (res.data) {
      setStatus(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleEngage = async () => {
    setActing('engage');
    setError(null);
    const res = await engageDiagnosticRuntimeFreeze();
    if (res.data) {
      // Reflect the authoritative server state, never an optimistic fake.
      setStatus({
        engaged: true,
        engagedAt: res.data.engagedAt ?? new Date().toISOString(),
        engagedBy: res.data.engagedBy,
        releasedAt: status.releasedAt,
        releasedBy: status.releasedBy,
        pendingMessagesInvalidated: res.data.pendingMessagesInvalidated,
        inflightMessagesDetected: res.data.inflightMessagesDetected,
        latestAffectedRunKey: res.data.latestAffectedRunKey,
        latestAffectedCorrelationId: null,
        normalExecutionBlocked: res.data.normalExecutionBlocked,
        masterKillSwitchOn: res.data.masterKillSwitchOn,
        productionEnabled: res.data.productionEnabled,
      });
      setConfirmEngage(false);
      await refresh();
    } else {
      setError(res.error);
    }
    setActing(null);
  };

  const handleRelease = async () => {
    setActing('release');
    setError(null);
    const res = await releaseDiagnosticRuntimeFreeze();
    if (res.data) {
      setStatus((prev) => ({
        ...prev,
        engaged: false,
        releasedAt: res.data.releasedAt ?? new Date().toISOString(),
        releasedBy: res.data.releasedBy,
      }));
      setConfirmRelease(false);
      await refresh();
    } else {
      setError(res.error);
    }
    setActing(null);
  };

  if (loading) {
    return (
      <section className="rounded-lg border border-background-200/60 bg-background-100 overflow-hidden">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-foreground-400">Loading emergency runtime freeze status…</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-lg border overflow-hidden ${
        status.engaged ? 'border-red-500/40 bg-red-500/5' : 'border-background-200/60 bg-background-100'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  status.engaged ? 'bg-red-500/15 text-red-400' : 'bg-secondary-500/15 text-secondary-300'
                }`}
              >
                <i className="ri-snowy-line text-lg w-5 h-5 flex items-center justify-center"></i>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">EMERGENCY RUNTIME FREEZE</p>
                <h2 className={`text-xl font-heading font-bold ${status.engaged ? 'text-red-400' : 'text-foreground-50'}`}>
                  {status.engaged ? 'EMERGENCY FREEZE ENGAGED' : 'READY / DISENGAGED'}
                </h2>
              </div>
            </div>

            <p className="text-sm text-foreground-500 mt-3 max-w-3xl leading-relaxed">
              Immediately block new diagnostic runtime dispatch while preserving in-flight evidence. This control blocks only execution-bearing sandbox diagnostic dispatches — monitoring and transport stay available.
            </p>

            {/* State chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              <StateChip
                label="New Diagnostic Dispatch"
                value={status.engaged ? 'BLOCKED' : 'AVAILABLE SUBJECT TO ALL OTHER GATES'}
                tone={status.engaged ? 'red' : 'secondary'}
              />
              {status.engaged ? (
                <>
                  <StateChip label="HAL Health / Heartbeat" value="MONITORING AVAILABLE" tone="secondary" />
                  <StateChip label="Auto Retry" value="DISABLED" tone="red" />
                  <StateChip label="Old Work Replay" value="DISABLED" tone="red" />
                </>
              ) : (
                <StateChip label="New Diagnostic Dispatch" value="AVAILABLE" tone="secondary" />
              )}
              <StateChip label="Normal Execution" value="BLOCKED" tone="red" />
              <StateChip label="Master Kill Switch" value="ON" tone="red" />
              <StateChip label="Production" value="DISABLED" tone="red" />
            </div>
          </div>

          {/* Action + refresh */}
          <div className="shrink-0 flex flex-col items-start lg:items-end gap-3">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
              Refresh
            </button>

            {status.engaged ? (
              canRelease ? (
                <button
                  onClick={() => setConfirmRelease(true)}
                  disabled={acting !== null}
                  className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-red-500/15 text-red-300 border border-red-500/30 rounded-md px-4 py-2.5 hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <i className="ri-lock-unlock-line w-4 h-4 flex items-center justify-center"></i>
                  Release Emergency Freeze
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-600 px-4 py-2.5 bg-background-50 border border-background-300/60 rounded-md whitespace-nowrap opacity-70">
                  <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Release requires owner
                </span>
              )
            ) : canEngage ? (
              <button
                onClick={() => setConfirmEngage(true)}
                disabled={acting !== null}
                className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-red-500/15 text-red-300 border border-red-500/30 rounded-md px-4 py-2.5 hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <i className="ri-lock-2-line w-4 h-4 flex items-center justify-center"></i>
                Engage Emergency Freeze
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-600 px-4 py-2.5 bg-background-50 border border-background-300/60 rounded-md whitespace-nowrap">
                <i className="ri-eye-line w-3.5 h-3.5 flex items-center justify-center"></i>
                Read-only
              </span>
            )}
          </div>
        </div>

        {/* Engaged red notice */}
        {status.engaged && (
          <div className="mt-4 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2.5 flex items-start gap-2.5">
            <i className="ri-alert-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
            <p className="text-xs text-red-300">
              Emergency Runtime Freeze is engaged — new runtime dispatches will be blocked.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2 flex items-start gap-2">
            <i className="ri-error-warning-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* Affected work + control history summary */}
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryBlock title="Affected Work Summary">
          <SummaryRow label="Pending Messages Invalidated" value={status.pendingMessagesInvalidated > 0 ? String(status.pendingMessagesInvalidated) : '—'} />
          <SummaryRow label="In-Flight Messages Detected" value={status.inflightMessagesDetected > 0 ? String(status.inflightMessagesDetected) : '—'} />
          <SummaryRow label="Latest Affected Run" value={status.latestAffectedRunKey ?? '—'} />
          <SummaryRow label="Latest Correlation ID" value={status.latestAffectedCorrelationId ?? '—'} />
        </SummaryBlock>

        <SummaryBlock title="Control History Summary">
          <SummaryRow label="Engaged At" value={status.engagedAt ? new Date(status.engagedAt).toLocaleString() : '—'} />
          <SummaryRow label="Engaged By" value={status.engagedBy ?? '—'} />
          <SummaryRow label="Released At" value={status.releasedAt ? new Date(status.releasedAt).toLocaleString() : '—'} />
          <SummaryRow label="Released By" value={status.releasedBy ?? '—'} />
        </SummaryBlock>
      </div>

      {/* Permanent warning */}
      <div className="px-5 pb-5">
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2.5 flex items-start gap-2.5">
          <i className="ri-information-line text-amber-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
          <p className="text-xs text-amber-300/90">
            Emergency Freeze blocks new runtime dispatch. Already-delivered local work cannot be assumed cancelled. No automatic retry or replay occurs.
          </p>
        </div>
      </div>

      {/* Engage confirmation */}
      {confirmEngage && (
        <ConfirmationModal
          title="Engage Emergency Runtime Freeze"
          description="Emergency Runtime Freeze will block new diagnostic runtime dispatches and contain pending/in-flight sandbox runtime work. Monitoring remains available."
          confirmLabel="Engage Freeze"
          busy={acting === 'engage'}
          onCancel={() => setConfirmEngage(false)}
          onConfirm={handleEngage}
        />
      )}

      {/* Release confirmation */}
      {confirmRelease && (
        <ConfirmationModal
          title="Release Emergency Runtime Freeze"
          description="Release allows FUTURE diagnostic requests to pass the freeze gate again. Previously rejected, cancelled or failed work will not replay."
          confirmLabel="Release Freeze"
          busy={acting === 'release'}
          onCancel={() => setConfirmRelease(false)}
          onConfirm={handleRelease}
        />
      )}
    </section>
  );
}

function StateChip({ label, value, tone }: { label: string; value: string; tone: 'red' | 'secondary' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 whitespace-nowrap">
      <span className="text-foreground-600">{label}:</span>
      <span className={tone === 'red' ? 'text-red-400 font-semibold' : 'text-secondary-300 font-semibold'}>{value}</span>
    </span>
  );
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <p className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-foreground-600 whitespace-nowrap">{label}</span>
      <span className="text-xs text-foreground-100 text-right break-all">{value}</span>
    </div>
  );
}

function ConfirmationModal({
  title,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel}></div>
      <div className="relative bg-background-100 border border-background-200/60 rounded-lg w-full max-w-lg p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-heading font-semibold text-foreground-50">{title}</h3>
            <p className="text-xs text-foreground-500 mt-1.5 leading-relaxed">{description}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-100 hover:bg-background-50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3.5 py-2 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-red-500/15 text-red-300 border border-red-500/30 rounded-md px-3.5 py-2 hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <i className="ri-lock-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
            {busy ? 'Applying…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}