import { useState } from 'react';
import { useDiagnosticRuns, useDiagnosticDetail } from '@/pages/support-customers/hooks';
import { diagnosticStatusLabels, diagnosticStatusColors } from '@/pages/support-customers/constants';
import { formatRelative } from '@/pages/support-tickets/constants';
import DiagnosticResultView from '@/pages/support-customers/components/DiagnosticResultView';
import type { RecommendedRepair } from '@/types/support-customers';

interface DiagnosticsPanelProps {
  ticketId: string;
  canRun: boolean;
  canRetry: boolean;
  hasCustomer: boolean;
  organisationOnly: boolean;
  onRun: () => void;
  onRetry: () => void;
  onReviewRepair: (rec: RecommendedRepair, runId: string | null) => void;
}

export default function DiagnosticsPanel({
  ticketId,
  canRun,
  canRetry,
  hasCustomer,
  organisationOnly,
  onRun,
  onRetry,
  onReviewRepair,
}: DiagnosticsPanelProps) {
  const { runs, loading, error } = useDiagnosticRuns({ ticketId });
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeRun = runs.find((r) => r.id === activeId) ?? runs[0] ?? null;
  const { detail, loading: detailLoading } = useDiagnosticDetail(activeRun?.id ?? null);

  const runButton = canRun && hasCustomer;
  const showRunAgain = canRun && hasCustomer && activeRun?.status === 'completed';

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
          <i className="ri-stethoscope-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Diagnostics
        </h2>
        {runButton && (
          <button
            type="button"
            onClick={onRun}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
            Run Diagnostics
          </button>
        )}
      </div>

      {organisationOnly && hasCustomer && (
        <div className="mb-3 bg-accent-500/10 border border-accent-500/30 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <i className="ri-information-line text-sm text-accent-400 w-4 h-4 flex items-center justify-center mt-0.5"></i>
          <div className="text-xs text-accent-300 leading-relaxed space-y-0.5">
            <p className="font-semibold">Organisation-only diagnostics</p>
            <p>No portal account linked — authentication checks unavailable.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 bg-background-200/50 rounded-lg animate-pulse"></div>
          <div className="h-10 bg-background-200/50 rounded-lg animate-pulse"></div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 py-1">{error}</p>
      ) : !hasCustomer ? (
        <div className="py-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-user-search-line text-xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
          </div>
          <p className="text-sm text-foreground-500 max-w-[220px] mx-auto">
            Customer must be resolved before diagnostics can run.
          </p>
        </div>
      ) : runs.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-stethoscope-line text-xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
          </div>
          <p className="text-sm text-foreground-500">No diagnostics have been run yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active result */}
          <div className="bg-background-50 border border-background-200/50 rounded-lg p-4">
            {detailLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-2/3 bg-background-200/50 rounded animate-pulse"></div>
                <div className="h-4 w-1/2 bg-background-200/50 rounded animate-pulse"></div>
              </div>
            ) : detail ? (
              <DiagnosticResultView detail={detail} onReviewRepair={(rec) => onReviewRepair(rec, activeRun?.id ?? null)} />
            ) : (
              <p className="text-sm text-foreground-500">Unable to load diagnostic result.</p>
            )}
          </div>

          {/* Run again after a completed run */}
          {showRunAgain && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onRun}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                Run Diagnostics Again
              </button>
            </div>
          )}

          {/* History */}
          {runs.length > 1 && (
            <div>
              <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wider mb-1.5">
                Previous runs
              </p>
              <div className="space-y-1">
                {runs.slice(1).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      activeId === r.id
                        ? 'border-accent-500/40 bg-accent-500/5'
                        : 'border-background-200/50 bg-background-50 hover:border-background-300/60'
                    }`}
                  >
                    <span className="text-xs font-mono text-foreground-500">{r.id.slice(0, 8)}…</span>
                    <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${diagnosticStatusColors[r.status] ?? ''}`}>
                      {diagnosticStatusLabels[r.status] ?? r.status}
                    </span>
                    <span className="text-xs text-foreground-500 whitespace-nowrap">
                      {formatRelative(r.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Retry for the active (failed) run */}
          {canRetry && activeRun && activeRun.status === 'failed' && (
            <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <span className="text-xs text-red-300">This diagnostic failed.</span>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                Retry Diagnostics
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}