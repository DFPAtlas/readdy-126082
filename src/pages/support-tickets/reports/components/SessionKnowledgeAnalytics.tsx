import type { SupportSessionAnalytics, SupportKnowledgeAnalytics } from '@/types/support-tickets';
import { useAnalyticsJsonb } from '../analytics-hooks';
import {
  SectionCard,
  StatCard,
  StatGrid,
  EmptyState,
  ErrorState,
  formatDuration,
} from './AnalyticsShared';

interface Props {
  start: string;
  end: string;
  siteId: string | null;
}

export default function SessionKnowledgeAnalytics({ start, end, siteId }: Props) {
  const params = { p_start: start, p_end: end, p_site_id: siteId ?? null };
  const enabled = Boolean(start && end);
  const { data: session, loading, error, refresh } = useAnalyticsJsonb<SupportSessionAnalytics>(
    'support_analytics_sessions',
    params,
    enabled,
  );
  const { data: kb, loading: kbLoading, error: kbError, refresh: kbRefresh } =
    useAnalyticsJsonb<SupportKnowledgeAnalytics>('support_analytics_knowledge', params, enabled);

  return (
    <>
      {/* Support sessions */}
      <SectionCard
        title="Support session analytics"
        subtitle="Read-only view-as-customer sessions (safe operational metrics only)."
      >
        {error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : loading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !session || session.started === 0 ? (
          <EmptyState icon="ri-eye-line" message="No support sessions started in this period." />
        ) : (
          <StatGrid>
            <StatCard label="Started" value={session.started} icon="ri-play-line" accent="text-primary-400" loading={loading} />
            <StatCard label="Completed" value={session.completed} icon="ri-check-line" accent="text-emerald-400" loading={loading} />
            <StatCard label="Expired" value={session.expired} icon="ri-timer-line" accent="text-amber-400" loading={loading} />
            <StatCard label="Revoked" value={session.revoked} icon="ri-close-circle-line" accent="text-red-400" loading={loading} />
            <StatCard label="Avg duration" value={formatDuration(session.avg_duration_seconds)} icon="ri-time-line" accent="text-foreground-400" loading={loading} />
            <StatCard label="View-as-customer sites" value={session.sites_using_view_as_customer} icon="ri-global-line" accent="text-secondary-300" loading={loading} />
          </StatGrid>
        )}
      </SectionCard>

      {/* Knowledge base value */}
      <SectionCard
        title="Knowledge base value"
        subtitle="Approved articles and resolution memory coverage."
      >
        {kbError ? (
          <ErrorState message={kbError} onRetry={kbRefresh} />
        ) : kbLoading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !kb || (kb.total_articles === 0 && kb.resolution_memories === 0) ? (
          <EmptyState icon="ri-book-open-line" message="No knowledge articles or resolution memory yet." />
        ) : (
          <StatGrid>
            <StatCard label="Total articles" value={kb.total_articles} icon="ri-book-open-line" accent="text-primary-400" loading={kbLoading} />
            <StatCard label="Approved" value={kb.approved_articles} icon="ri-shield-check-line" accent="text-emerald-400" loading={kbLoading} />
            <StatCard label="Stale articles" value={kb.stale_articles} icon="ri-time-line" accent="text-amber-400" loading={kbLoading} />
            <StatCard label="Due for review" value={kb.articles_due_review} icon="ri-calendar-check-line" accent="text-amber-400" loading={kbLoading} />
            <StatCard label="Resolution memories" value={kb.resolution_memories} icon="ri-archive-line" accent="text-secondary-300" loading={kbLoading} />
            <StatCard label="Approved memories" value={kb.approved_resolution_memories} icon="ri-check-double-line" accent="text-emerald-400" loading={kbLoading} />
          </StatGrid>
        )}
      </SectionCard>
    </>
  );
}