import type { SupportAnalyticsOverview } from '@/types/support-tickets';
import { useAnalyticsJsonb } from '../analytics-hooks';
import { SectionCard, StatCard, StatGrid, ErrorState } from './AnalyticsShared';

interface Props {
  siteId: string | null;
}

export default function AnalyticsOverview({ siteId }: Props) {
  const { data, loading, error, refresh } = useAnalyticsJsonb<SupportAnalyticsOverview>(
    'support_analytics_overview',
    { p_site_id: siteId ?? null },
  );

  return (
    <SectionCard
      title="Operational overview"
      subtitle="Current snapshot of the support workload — not affected by the date range."
    >
      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <StatGrid>
          <StatCard label="Open tickets" value={data?.open_tickets ?? 0} icon="ri-inbox-line" accent="text-accent-400" to="/support-tickets" loading={loading} />
          <StatCard label="New today" value={data?.new_today ?? 0} icon="ri-mail-add-line" accent="text-primary-400" to="/support-tickets" loading={loading} />
          <StatCard label="Resolved today" value={data?.resolved_today ?? 0} icon="ri-check-double-line" accent="text-emerald-400" to="/support-tickets?resolvedToday=1" loading={loading} />
          <StatCard label="Urgent tickets" value={data?.urgent_tickets ?? 0} icon="ri-error-warning-line" accent="text-red-400" to="/support-tickets?priority=urgent" loading={loading} />
          <StatCard label="SLA at risk" value={data?.sla_at_risk ?? 0} icon="ri-alarm-line" accent="text-amber-400" to="/support-tickets" loading={loading} />
          <StatCard label="SLA breached" value={data?.sla_breached ?? 0} icon="ri-timer-flash-line" accent="text-red-400" to="/support-tickets?overdue=1" loading={loading} />
          <StatCard label="Unassigned" value={data?.unassigned ?? 0} icon="ri-user-line" accent="text-foreground-400" to="/support-tickets?assigned=unassigned" loading={loading} />
          <StatCard label="Needs review" value={data?.needs_review ?? 0} icon="ri-question-line" accent="text-secondary-300" to="/support-tickets?routing=needs_review" loading={loading} />
          <StatCard label="Pending repairs" value={data?.pending_repairs ?? 0} icon="ri-tools-line" accent="text-amber-400" to="/support-repairs" loading={loading} />
          <StatCard label="Active sessions" value={data?.active_sessions ?? 0} icon="ri-eye-line" accent="text-emerald-400" loading={loading} />
        </StatGrid>
      )}
    </SectionCard>
  );
}