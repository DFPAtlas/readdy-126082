import type { SupportRoutingAnalytics, SupportEscalationAnalytics } from '@/types/support-tickets';
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

export default function RoutingEscalationAnalytics({ start, end, siteId }: Props) {
  const params = { p_start: start, p_end: end, p_site_id: siteId ?? null };
  const enabled = Boolean(start && end);
  const { data: routing, loading, error, refresh } = useAnalyticsJsonb<SupportRoutingAnalytics>(
    'support_analytics_routing',
    params,
    enabled,
  );
  const { data: escalation, loading: escLoading, error: escError, refresh: escRefresh } =
    useAnalyticsJsonb<SupportEscalationAnalytics>('support_analytics_escalations', params, enabled);

  const routingTotal = routing
    ? routing.routed + routing.needs_review + routing.queued + routing.unrouted + routing.escalated
    : 0;
  const overrideRate = routingTotal > 0 ? Math.round((routing.manual_overrides / routingTotal) * 100) : 0;

  return (
    <>
      {/* Routing quality */}
      <SectionCard
        title="Routing quality"
        subtitle="How tickets are routed (Prompt 15) — a high manual-override rate is a signal."
        right={
          !loading && !error && routing && routingTotal > 0 ? (
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              Manual override rate{' '}
              <span className={`font-semibold ${overrideRate >= 30 ? 'text-amber-400' : 'text-foreground-100'}`}>
                {overrideRate}%
              </span>
            </span>
          ) : undefined
        }
      >
        {error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : loading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !routing || routingTotal === 0 ? (
          <EmptyState icon="ri-git-branch-line" message="No routed tickets in this period." />
        ) : (
          <>
            <StatGrid>
              <StatCard label="Routed" value={routing.routed} icon="ri-check-double-line" accent="text-emerald-400" loading={loading} />
              <StatCard label="Needs review" value={routing.needs_review} icon="ri-question-line" accent="text-amber-400" to="/support-tickets?routing=needs_review" loading={loading} />
              <StatCard label="Queued" value={routing.queued} icon="ri-inbox-line" accent="text-foreground-400" loading={loading} />
              <StatCard label="Unrouted" value={routing.unrouted} icon="ri-error-warning-line" accent="text-red-400" loading={loading} />
              <StatCard label="Escalated" value={routing.escalated} icon="ri-arrow-up-circle-line" accent="text-red-400" to="/support-tickets?routing=escalated" loading={loading} />
              <StatCard label="Default team fallbacks" value={routing.default_team_fallbacks} icon="ri-arrow-go-back-line" accent="text-secondary-300" loading={loading} />
              <StatCard label="Manual overrides" value={routing.manual_overrides} icon="ri-edit-line" accent="text-amber-400" loading={loading} />
            </StatGrid>

            {routing.by_team.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <caption className="sr-only">Routing by team</caption>
                  <thead>
                    <tr className="text-left border-b border-background-200/60">
                      <th scope="col" className="py-2 pr-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Team</th>
                      <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Routed</th>
                      <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Needs review</th>
                      <th scope="col" className="py-2 pl-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">Default fallback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routing.by_team.map((row) => (
                      <tr key={row.team_name} className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors">
                        <th scope="row" className="py-2.5 pr-3 font-medium text-foreground-100">{row.team_name}</th>
                        <td className="py-2.5 px-3 text-foreground-200 tabular-nums">{row.routed}</td>
                        <td className="py-2.5 px-3 text-foreground-200 tabular-nums">{row.needs_review}</td>
                        <td className="py-2.5 pl-3 text-foreground-200 tabular-nums">{row.default_fallback}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Escalation analytics */}
      <SectionCard
        title="Escalation analytics"
        subtitle="Escalated tickets and their reasons — a view of operational bottlenecks."
      >
        {escError ? (
          <ErrorState message={escError} onRetry={escRefresh} />
        ) : escLoading ? (
          <div className="h-24 rounded-md bg-background-200/40 animate-pulse" aria-hidden="true"></div>
        ) : !escalation || escalation.escalated_tickets === 0 ? (
          <EmptyState icon="ri-arrow-up-circle-line" message="No escalations in this period." />
        ) : (
          <>
            <StatGrid>
              <StatCard label="Escalated tickets" value={escalation.escalated_tickets} icon="ri-arrow-up-circle-line" accent="text-red-400" to="/support-tickets?routing=escalated" loading={escLoading} />
              <StatCard label="Security" value={escalation.security_escalations} icon="ri-shield-keyhole-line" accent="text-red-400" loading={escLoading} />
              <StatCard label="Technical" value={escalation.technical_escalations} icon="ri-bug-line" accent="text-amber-400" loading={escLoading} />
              <StatCard label="SLA" value={escalation.sla_escalations} icon="ri-timer-flash-line" accent="text-amber-400" to="/support-tickets?overdue=1" loading={escLoading} />
              <StatCard label="Repair failures" value={escalation.repair_failures} icon="ri-tools-line" accent="text-red-400" to="/support-repairs" loading={escLoading} />
            </StatGrid>
            {escalation.by_type.length > 0 && (
              <div>
                <h4 className="text-xs font-label uppercase tracking-wider text-foreground-500 mb-2">Escalation reasons</h4>
                <ul className="space-y-1.5">
                  {escalation.by_type.map((row) => (
                    <li key={row.escalation_type} className="flex items-center justify-between text-sm">
                      <span className="text-foreground-300">{row.escalation_type}</span>
                      <span className="text-foreground-200 font-medium tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </>
  );
}