import { Link } from 'react-router-dom';
import type { CommercialExec, SupportExec } from '../executiveTypes';
import { SectionHeading, Unavailable, EmptyNote, Metric } from './shared';

export default function CommercialSupportPanel({
  commercial,
  support,
}: {
  commercial: CommercialExec;
  support: SupportExec;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Commercial */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-money-pound-circle-line" title="Commercial" action={{ label: 'Open Budget', to: '/project-budget' }} />

        {!commercial.available ? (
          <Unavailable label="Commercial data unavailable" />
        ) : (
          <>
            {commercial.coverageIncomplete && (
              <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2 text-amber-400">
                Configured portfolio values — coverage incomplete
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Monthly Revenue" value={`£${commercial.configuredMonthlyRevenue.toLocaleString()}`} />
              <Metric label="Monthly Operating Cost" value={`£${commercial.monthlyOperatingCost.toLocaleString()}`} />
              <Metric
                label="Monthly Margin"
                value={`£${commercial.monthlyMargin.toLocaleString()}`}
                tone={commercial.monthlyMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}
              />
              <Metric label="Upcoming Required Costs" value={`£${commercial.upcomingRequiredCosts.toLocaleString()}`} />
              <Metric label="Projects Over Budget" value={commercial.projectsOverBudget} tone={commercial.projectsOverBudget > 0 ? 'text-red-400' : 'text-emerald-400'} />
              <Metric label="Commercial Launch Blockers" value={commercial.commercialLaunchBlockers} tone={commercial.commercialLaunchBlockers > 0 ? 'text-red-400' : 'text-emerald-400'} />
            </div>
          </>
        )}
      </section>

      {/* Support / incidents */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-lifebuoy-line" title="Support / Incidents" action={{ label: 'Open Support', to: '/support-tickets' }} />

        {!support.available ? (
          <Unavailable label="Support data unavailable" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Metric label="Open Tickets" value={support.ticketsAvailable ? support.openTickets : '—'} />
              <Metric label="Critical Tickets" value={support.ticketsAvailable ? support.criticalTickets : '—'} tone={support.criticalTickets > 0 ? 'text-red-400' : 'text-foreground-100'} />
              <Metric label="High Priority" value={support.ticketsAvailable ? support.highPriority : '—'} />
              <Metric label="Active Incidents" value={support.incidentsAvailable ? support.activeIncidents : '—'} />
              <Metric label="Critical Incidents" value={support.incidentsAvailable ? support.criticalIncidents : '—'} tone={support.criticalIncidents > 0 ? 'text-red-400' : 'text-foreground-100'} />
              <Metric
                label="Oldest Critical"
                value={support.oldestCritical ? support.oldestCritical.ageLabel : '—'}
                tone={support.oldestCritical ? 'text-red-400' : 'text-foreground-100'}
              />
            </div>

            {support.oldestCritical && (
              <Link
                to={`/support-tickets/${support.oldestCritical.id}`}
                className="flex items-start gap-3 bg-background-50 border border-red-500/20 hover:border-red-500/40 rounded-lg px-3 py-2.5 mb-3 transition-colors cursor-pointer"
              >
                <i className="ri-error-warning-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-label text-red-400 uppercase tracking-wide">Oldest Critical Issue</p>
                  <p className="text-sm text-foreground-100 truncate">{support.oldestCritical.subject}</p>
                </div>
              </Link>
            )}

            {support.recentlyResolved.length > 0 && (
              <>
                <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2">Recently Resolved</p>
                <div className="space-y-1">
                  {support.recentlyResolved.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                      <span className="text-foreground-300 truncate flex-1">{r.title}</span>
                      <span className="text-foreground-600 whitespace-nowrap">
                        {new Date(r.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!support.oldestCritical && support.recentlyResolved.length === 0 && (
              <EmptyNote>No critical issues or recent resolutions.</EmptyNote>
            )}
          </>
        )}
      </section>
    </div>
  );
}