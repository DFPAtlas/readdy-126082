import type { SupportDiagnosticAnalytics, SupportRepairAnalytics } from '@/types/support-tickets';
import { useAnalyticsJsonb } from '../analytics-hooks';
import {
  SectionCard,
  StatCard,
  StatGrid,
  EmptyState,
  ErrorState,
  formatDuration,
  formatPct,
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

function BreakdownList({
  title,
  rows,
  valueKey,
}: {
  title: string;
  rows: { count: number }[];
  valueKey: 'action_type' | 'risk_level' | 'site_name';
}) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-label uppercase tracking-wider text-foreground-500 mb-2">{title}</h4>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={`${title}-${i}`} className="flex items-center justify-between text-sm">
            <span className="text-foreground-300">{humanize((r as Record<string, string>)[valueKey] ?? 'Unknown')}</span>
            <span className="text-foreground-200 font-medium tabular-nums">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DiagnosticRepairAnalytics({ start, end, siteId }: Props) {
  const params = { p_start: start, p_end: end, p_site_id: siteId ?? null };
  const enabled = Boolean(start && end);
  const { data: diag, loading, error, refresh } = useAnalyticsJsonb<SupportDiagnosticAnalytics>(
    'support_analytics_diagnostics',
    params,
    enabled,
  );
  const { data: repair, loading: repLoading, error: repError, refresh: repRefresh } =
    useAnalyticsJsonb<SupportRepairAnalytics>('support_analytics_repairs', params, enabled);

  return (
    <>
      {/* Diagnostics */}
      <SectionCard
        title="Diagnostic analytics"
        subtitle="Automated account diagnostics run through the n8n workflow."
      >
        {error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : loading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !diag || diag.runs === 0 ? (
          <EmptyState icon="ri-stethoscope-line" message="No diagnostics run in this period." />
        ) : (
          <>
            <StatGrid>
              <StatCard label="Runs" value={diag.runs} icon="ri-stethoscope-line" accent="text-primary-400" loading={loading} />
              <StatCard label="Completed" value={diag.completed} icon="ri-check-line" accent="text-emerald-400" loading={loading} />
              <StatCard label="Failed" value={diag.failed} icon="ri-close-circle-line" accent="text-red-400" loading={loading} />
              <StatCard label="Avg duration" value={formatDuration(diag.avg_duration_seconds)} icon="ri-time-line" accent="text-foreground-400" loading={loading} />
              <StatCard label="Led to repair" value={diag.leading_to_repair} icon="ri-tools-line" accent="text-amber-400" loading={loading} />
            </StatGrid>
            {diag.scopes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <caption className="sr-only">Diagnostics by scope</caption>
                  <thead>
                    <tr className="text-left border-b border-background-200/60">
                      <th scope="col" className="py-2 pr-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Check</th>
                      <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Runs</th>
                      <th scope="col" className="py-2 pl-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Failures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.scopes.map((s) => (
                      <tr key={s.scope} className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors">
                        <th scope="row" className="py-2.5 pr-3 font-medium text-foreground-100">{humanize(s.scope)}</th>
                        <td className="py-2.5 px-3 text-foreground-200 tabular-nums">{s.count}</td>
                        <td className="py-2.5 pl-3 tabular-nums">
                          {s.failures > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                              <i className="ri-error-warning-line text-sm w-4 h-4 flex items-center justify-center"></i>
                              {s.failures}
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
          </>
        )}
      </SectionCard>

      {/* Repairs */}
      <SectionCard
        title="Repair analytics"
        subtitle="Human-approved account repairs — only verified completions count as success."
        right={
          !repLoading && !repError && repair?.success_rate != null ? (
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              Success rate <span className="text-foreground-100 font-semibold">{formatPct(repair.success_rate)}</span>
            </span>
          ) : undefined
        }
      >
        {repError ? (
          <ErrorState message={repError} onRetry={repRefresh} />
        ) : repLoading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !repair || repair.requested === 0 ? (
          <EmptyState icon="ri-tools-line" message="No repairs requested in this period." />
        ) : (
          <>
            <StatGrid>
              <StatCard label="Requested" value={repair.requested} icon="ri-add-line" accent="text-primary-400" loading={repLoading} />
              <StatCard label="Approved" value={repair.approved} icon="ri-shield-check-line" accent="text-emerald-400" loading={repLoading} />
              <StatCard label="Rejected" value={repair.rejected} icon="ri-close-line" accent="text-foreground-400" loading={repLoading} />
              <StatCard label="Completed" value={repair.completed} icon="ri-check-double-line" accent="text-emerald-400" loading={repLoading} />
              <StatCard label="Failed" value={repair.failed} icon="ri-error-warning-line" accent="text-red-400" to="/support-repairs" loading={repLoading} />
              <StatCard label="Verification failed" value={repair.verification_failed} icon="ri-shield-flash-line" accent="text-red-400" loading={repLoading} />
              <StatCard label="Pending approval" value={repair.pending_approval} icon="ri-hourglass-line" accent="text-amber-400" to="/support-repairs" loading={repLoading} />
            </StatGrid>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <BreakdownList title="By action type" rows={repair.by_action_type} valueKey="action_type" />
              <BreakdownList title="By risk" rows={repair.by_risk} valueKey="risk_level" />
              <BreakdownList title="By site" rows={repair.by_site} valueKey="site_name" />
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}