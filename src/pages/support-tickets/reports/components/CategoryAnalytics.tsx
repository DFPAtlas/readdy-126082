import type { SupportCategoryStat, SupportRecurringIssue } from '@/types/support-tickets';
import { useAnalyticsJsonb } from '../analytics-hooks';
import {
  SectionCard,
  EmptyState,
  ErrorState,
  TrendBadge,
  formatDuration,
} from './AnalyticsShared';

interface Props {
  start: string;
  end: string;
  siteId: string | null;
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function CategoryAnalytics({ start, end, siteId }: Props) {
  const params = { p_start: start, p_end: end, p_site_id: siteId ?? null };
  const { data: categories, loading, error, refresh } = useAnalyticsJsonb<SupportCategoryStat[]>(
    'support_analytics_categories',
    params,
    Boolean(start && end),
  );
  const { data: recurring, loading: recLoading, error: recError, refresh: recRefresh } =
    useAnalyticsJsonb<SupportRecurringIssue[]>('support_analytics_recurring', params, Boolean(start && end));

  const categoryRows = categories ?? [];

  return (
    <SectionCard
      title="Category analytics"
      subtitle="Top support categories with trend, resolution time and repeat count."
    >
      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-md bg-background-200/40 animate-pulse"></div>
          ))}
        </div>
      ) : categoryRows.length === 0 ? (
        <EmptyState icon="ri-price-tag-3-line" message="No ticket data for this period." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <caption className="sr-only">Support tickets by category</caption>
            <thead>
              <tr className="text-left border-b border-background-200/60">
                <th scope="col" className="py-2 pr-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Category</th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Tickets</th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Share</th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Trend</th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">Avg resolution</th>
                <th scope="col" className="py-2 pl-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">Repeat issues</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.category} className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors">
                  <th scope="row" className="py-3 pr-3 font-medium text-foreground-100">{humanize(row.category)}</th>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.count}</td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums">{row.percent}%</td>
                  <td className="py-3 px-3"><TrendBadge trend={row.trend} /></td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums whitespace-nowrap">{formatDuration(row.avg_resolution_seconds)}</td>
                  <td className="py-3 pl-3 tabular-nums">
                    {row.repeat_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                        <i className="ri-loop-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                        {row.repeat_count}
                      </span>
                    ) : (
                      <span className="text-foreground-500">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recurring issues */}
      <div className="border-t border-background-200/60 pt-4">
        <h3 className="text-sm font-heading font-semibold text-foreground-200">Recurring issues</h3>
        <p className="text-xs text-foreground-500 mt-0.5">
          Categories occurring 2+ times at the same product, with a typical approved resolution.
        </p>
        {recError ? (
          <div className="mt-3"><ErrorState message={recError} onRetry={recRefresh} /></div>
        ) : recLoading ? (
          <div className="mt-3 space-y-2" aria-hidden="true">
            <div className="h-12 rounded-md bg-background-200/40 animate-pulse"></div>
          </div>
        ) : !recurring || recurring.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon="ri-loop-left-line" message="No recurring issues detected in this period." />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {recurring.map((issue, i) => (
              <div key={`${issue.site_name}-${issue.category}-${i}`} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground-100">{issue.site_name}</p>
                    <p className="text-xs text-foreground-500">{humanize(issue.category)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-foreground-200 tabular-nums">
                      {issue.occurrences} occurrences
                    </span>
                    <TrendBadge trend={issue.trend} />
                  </div>
                </div>
                {issue.typical_resolution && (
                  <p className="text-xs text-foreground-400 mt-2">
                    <span className="text-foreground-600 font-medium">Typical resolution: </span>
                    {issue.typical_resolution}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}