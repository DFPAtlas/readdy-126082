import type { DiagnosticDetail, RecommendedRepair } from '@/types/support-customers';
import {
  checkStatusLabels,
  checkStatusTones,
  checkStatusIcons,
  overallStatusLabels,
  overallStatusTones,
  severityLabels,
  checkTypeLabel,
  formatDuration,
  repairTypeLabel,
  repairRiskLabels,
  repairRiskColors,
  normalizeCheckStatus,
  normalizeOverallStatus,
} from '@/pages/support-customers/constants';
import { formatFullDateTime } from '@/pages/support-tickets/constants';

interface DiagnosticResultViewProps {
  detail: DiagnosticDetail;
  onReviewRepair?: (rec: RecommendedRepair) => void;
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-foreground-600 shrink-0">{label}</span>
      <span className="text-foreground-300 text-right min-w-0">{children}</span>
    </div>
  );
}

function resolveDurationMs(detail: DiagnosticDetail): number | null {
  if (detail.duration_ms != null) return detail.duration_ms;
  if (detail.started_at && detail.completed_at) {
    const ms = new Date(detail.completed_at).getTime() - new Date(detail.started_at).getTime();
    if (!Number.isNaN(ms) && ms >= 0) return ms;
  }
  return null;
}

export default function DiagnosticResultView({ detail, onReviewRepair }: DiagnosticResultViewProps) {
  const result = detail.result_data
    ? {
        ...detail.result_data,
        overall_status: normalizeOverallStatus(detail.result_data.overall_status),
        checks: (detail.result_data.checks ?? []).map((c) => ({
          ...c,
          status: normalizeCheckStatus(c.status),
        })),
      }
    : null;
  const isPending = detail.status === 'queued' || detail.status === 'running';
  const isFailedWithoutResult = detail.status === 'failed' && !result;
  const recommendation = result?.recommended_repair ?? null;

  return (
    <div className="space-y-4">
      {/* Meta header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border-b border-background-200/40 pb-3">
        <Meta label="Started">{detail.started_at ? formatFullDateTime(detail.started_at) : '—'}</Meta>
        <Meta label="Completed">{detail.completed_at ? formatFullDateTime(detail.completed_at) : '—'}</Meta>
        <Meta label="Duration">{formatDuration(resolveDurationMs(detail))}</Meta>
        <Meta label="Requested By">{detail.requested_by_name ?? 'Not available'}</Meta>
        <Meta label="Site">{detail.site_name ?? 'Not available'}</Meta>
      </div>

      {isPending && (
        <div className="flex items-center gap-3 bg-accent-500/10 border border-accent-500/20 rounded-lg px-4 py-3">
          <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <p className="text-sm text-foreground-200">
            {detail.status === 'queued' ? 'Diagnostics queued…' : 'Running account diagnostics…'}
          </p>
        </div>
      )}

      {isFailedWithoutResult && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <i className="ri-error-warning-line text-red-400 text-lg w-5 h-5 flex items-center justify-center shrink-0"></i>
          <div>
            <p className="text-sm font-semibold text-red-300">Diagnostic failed</p>
            <p className="text-sm text-red-400/90 mt-0.5">{detail.error_message ?? 'An unknown error occurred.'}</p>
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Overall + summary */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-label px-2.5 py-1 rounded-full ${overallStatusTones[result.overall_status]}`}>
              <i className={`${checkStatusIcons[result.overall_status] as string} w-3.5 h-3.5 flex items-center justify-center`}></i>
              {overallStatusLabels[result.overall_status]}
            </span>
            {detail.summary && <p className="text-sm text-foreground-300">{detail.summary}</p>}
          </div>

          {/* Checks */}
          <div className="space-y-2">
            {result.checks.map((check, i) => (
              <div
                key={`${check.name}-${i}`}
                className="flex items-start gap-3 bg-background-50 border border-background-200/50 rounded-lg px-3 py-2.5"
              >
                <i
                  className={`${checkStatusIcons[check.status]} ${checkStatusTones[check.status]} text-lg w-5 h-5 flex items-center justify-center shrink-0 mt-0.5`}
                ></i>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground-100">{checkTypeLabel(check.name)}</span>
                    <span className={`text-[11px] font-label uppercase ${checkStatusTones[check.status]}`}>
                      {checkStatusLabels[check.status]}
                    </span>
                    {check.severity && check.severity !== 'info' && (
                      <span className="text-[10px] font-label px-1.5 py-0.5 rounded bg-foreground-500/15 text-foreground-400 uppercase">
                        {severityLabels[check.severity]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground-400 mt-0.5 break-words">{check.message}</p>
                  {(check.source || check.timestamp) && (
                    <p className="text-[11px] text-foreground-600 mt-1">
                      {check.source ? `Source: ${check.source}` : ''}
                      {check.source && check.timestamp ? ' · ' : ''}
                      {check.timestamp ? formatFullDateTime(check.timestamp) : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {result.checks.length === 0 && (
              <p className="text-sm text-foreground-500">No individual check results returned.</p>
            )}
          </div>

          {/* AI / automated summary */}
          {result.ai_summary && (
            <div className="bg-background-50 border border-background-200/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <i className="ri-sparkling-2-line text-accent-400 w-4 h-4 flex items-center justify-center"></i>
                <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wider">
                  Automated summary
                </h4>
              </div>

              {result.ai_summary.likely_cause && (
                <div>
                  <p className="text-[11px] font-label uppercase tracking-wider text-foreground-600">Likely cause</p>
                  <p className="text-sm text-foreground-200 mt-0.5">{result.ai_summary.likely_cause}</p>
                </div>
              )}

              {result.ai_summary.evidence && result.ai_summary.evidence.length > 0 && (
                <div>
                  <p className="text-[11px] font-label uppercase tracking-wider text-foreground-600">Evidence</p>
                  <ul className="mt-1 space-y-1">
                    {result.ai_summary.evidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground-400">
                        <span className="text-foreground-600 mt-1">•</span>
                        <span className="min-w-0">{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ai_summary.suggested_action && (
                <div>
                  <p className="text-[11px] font-label uppercase tracking-wider text-foreground-600">Suggested action</p>
                  <p className="text-sm text-foreground-200 mt-0.5">{result.ai_summary.suggested_action}</p>
                </div>
              )}

              {result.ai_summary.confidence && (
                <p className="text-xs text-foreground-600">
                  Confidence:{' '}
                  <span className="text-foreground-400 capitalize">{result.ai_summary.confidence}</span>
                </p>
              )}
            </div>
          )}

          {/* Recommended repair action (Prompt 12) */}
          {recommendation && (
            <div className="bg-background-50 border border-accent-500/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <i className="ri-tools-line text-accent-400 w-4 h-4 flex items-center justify-center"></i>
                <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wider">
                  Recommended action
                </h4>
                {recommendation.security_related && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-label px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 uppercase">
                    <i className="ri-shield-flash-line w-3 h-3 flex items-center justify-center"></i>
                    Security related
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {recommendation.problem_detected && (
                  <div>
                    <p className="text-[11px] font-label uppercase tracking-wider text-foreground-600">Problem</p>
                    <p className="text-sm text-foreground-200 mt-0.5">{recommendation.problem_detected}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground-100">
                    {repairTypeLabel(recommendation.action_type)}
                  </span>
                  <span className={`inline-flex text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${repairRiskColors[recommendation.risk_level]}`}>
                    {repairRiskLabels[recommendation.risk_level]} risk
                  </span>
                </div>
                {recommendation.reason && (
                  <p className="text-sm text-foreground-400">{recommendation.reason}</p>
                )}
              </div>

              {onReviewRepair && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onReviewRepair(recommendation)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-500 hover:bg-accent-400 text-background-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center"></i>
                    Review Repair
                  </button>
                  {(recommendation.risk_level === 'high' || recommendation.risk_level === 'critical') && (
                    <span className="text-[11px] text-foreground-600">Manual administrative process required.</span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}