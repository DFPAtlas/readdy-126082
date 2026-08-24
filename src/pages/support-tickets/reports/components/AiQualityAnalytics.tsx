import type { SupportTriageAnalytics, SupportReplyAnalytics } from '@/types/support-tickets';
import { useAnalyticsJsonb } from '../analytics-hooks';
import {
  SectionCard,
  StatCard,
  StatGrid,
  EmptyState,
  ErrorState,
} from './AnalyticsShared';

interface Props {
  start: string;
  end: string;
  siteId: string | null;
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

const REASON_LABELS: Record<string, string> = {
  incorrect: 'Incorrect',
  too_long: 'Too long',
  too_technical: 'Too technical',
  missing_info: 'Missing information',
  unsafe_claim: 'Unsafe claim',
  other: 'Other',
};

export default function AiQualityAnalytics({ start, end, siteId }: Props) {
  const params = { p_start: start, p_end: end, p_site_id: siteId ?? null };
  const enabled = Boolean(start && end);
  const { data: triage, loading, error, refresh } = useAnalyticsJsonb<SupportTriageAnalytics>(
    'support_analytics_triage',
    params,
    enabled,
  );
  const { data: reply, loading: repLoading, error: repError, refresh: repRefresh } =
    useAnalyticsJsonb<SupportReplyAnalytics>('support_analytics_replies', params, enabled);

  const feedbackTotal = reply ? reply.helpful + reply.not_helpful : 0;

  return (
    <>
      {/* AI triage quality */}
      <SectionCard
        title="AI triage quality"
        subtitle="Prompt 16 triage runs — acceptance is staff feedback, not accuracy."
      >
        {error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : loading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !triage || triage.runs === 0 ? (
          <EmptyState icon="ri-robot-2-line" message="No AI triage runs in this period." />
        ) : (
          <>
            <StatGrid>
              <StatCard label="Triage runs" value={triage.runs} icon="ri-robot-2-line" accent="text-primary-400" loading={loading} />
              <StatCard label="Completed" value={triage.completed} icon="ri-check-line" accent="text-emerald-400" loading={loading} />
              <StatCard label="Failed" value={triage.failed} icon="ri-close-circle-line" accent="text-red-400" loading={loading} />
              <StatCard label="High confidence" value={triage.confidence.high} icon="ri-signal-wifi-3-line" accent="text-emerald-400" loading={loading} />
              <StatCard label="Medium confidence" value={triage.confidence.medium} icon="ri-signal-wifi-2-line" accent="text-amber-400" loading={loading} />
              <StatCard label="Low confidence" value={triage.confidence.low} icon="ri-signal-wifi-1-line" accent="text-red-400" loading={loading} />
              <StatCard label="Manual overrides" value={triage.manual_overrides} icon="ri-edit-line" accent="text-secondary-300" loading={loading} />
              <StatCard label="Helpful" value={triage.helpful} icon="ri-thumb-up-line" accent="text-emerald-400" loading={loading} />
              <StatCard label="Not helpful" value={triage.not_helpful} icon="ri-thumb-down-line" accent="text-red-400" loading={loading} />
            </StatGrid>

            {/* Acceptance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                { label: 'Category accepted', value: pct(triage.category_accepted, triage.feedback_recorded) },
                { label: 'Team accepted', value: pct(triage.team_accepted, triage.feedback_recorded) },
                { label: 'Priority accepted', value: pct(triage.priority_accepted, triage.feedback_recorded) },
              ].map((item) => (
                <div key={item.label} className="bg-background-50 border border-background-200/60 rounded-lg p-3">
                  <p className="text-[11px] font-label uppercase tracking-wider text-foreground-500 whitespace-nowrap">{item.label}</p>
                  <p className="text-lg font-heading font-semibold text-foreground-100 mt-1 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* AI reply quality */}
      <SectionCard
        title="AI reply quality"
        subtitle="Prompt 17 reply drafts — staff always review and send."
        right={
          !repLoading && !repError && reply && feedbackTotal > 0 ? (
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              Helpful <span className="text-foreground-100 font-semibold">{pct(reply.helpful, feedbackTotal)}</span>
            </span>
          ) : undefined
        }
      >
        {repError ? (
          <ErrorState message={repError} onRetry={repRefresh} />
        ) : repLoading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !reply || reply.generated === 0 ? (
          <EmptyState icon="ri-message-2-line" message="No AI replies generated in this period." />
        ) : (
          <>
            <StatGrid>
              <StatCard label="Generated" value={reply.generated} icon="ri-message-2-line" accent="text-primary-400" loading={repLoading} />
              <StatCard label="Used" value={reply.used} icon="ri-send-plane-line" accent="text-emerald-400" loading={repLoading} />
              <StatCard label="Discarded" value={reply.discarded} icon="ri-delete-bin-line" accent="text-foreground-400" loading={repLoading} />
              <StatCard label="Helpful" value={reply.helpful} icon="ri-thumb-up-line" accent="text-emerald-400" loading={repLoading} />
              <StatCard label="Not helpful" value={reply.not_helpful} icon="ri-thumb-down-line" accent="text-red-400" loading={repLoading} />
            </StatGrid>
            {reply.reasons.length > 0 && (
              <div>
                <h4 className="text-xs font-label uppercase tracking-wider text-foreground-500 mb-2">Feedback reasons</h4>
                <div className="flex flex-wrap gap-2">
                  {reply.reasons.map((r) => (
                    <span key={r.reason} className="inline-flex items-center gap-1.5 text-xs bg-background-50 border border-background-200/60 rounded-full px-3 py-1 text-foreground-300 whitespace-nowrap">
                      {REASON_LABELS[r.reason] ?? r.reason}
                      <span className="font-semibold text-foreground-100 tabular-nums">{r.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </>
  );
}