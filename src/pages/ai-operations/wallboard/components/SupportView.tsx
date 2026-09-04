import { useSupportData } from '@/pages/ai-operations/wallboard/supportStore';
import {
  getSupport,
  getSlaDefinition,
  type SourceState,
  type SupportKpi,
  type TicketStateStat,
} from '@/pages/ai-operations/wallboard/supportSelectors';

const SOURCE_BADGE: Record<SourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_META: Record<TicketStateStat['state'], { label: string; cls: string }> = {
  NEW: { label: 'NEW', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25' },
  ACTIVE: { label: 'ACTIVE', cls: 'text-primary-400 bg-primary-500/10 border-primary-500/25' },
  WAITING: { label: 'WAITING', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  RESOLVED: { label: 'RESOLVED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  CLOSED: { label: 'CLOSED', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

function KpiCard({ kpi }: { kpi: SupportKpi }) {
  const unavailable = kpi.status !== 'live';
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col justify-between min-h-[92px]">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${kpi.accent}`}>
          <i className={`${kpi.icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide leading-tight whitespace-nowrap">
          {kpi.label}
        </p>
      </div>
      {unavailable ? (
        <p className="text-sm font-heading font-semibold text-foreground-500 mt-2 leading-tight">{kpi.value}</p>
      ) : (
        <p className={`text-3xl font-heading font-bold ${kpi.accent} leading-none tabular-nums mt-2 truncate`}>
          {kpi.value}
        </p>
      )}
      {kpi.note && (
        <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide mt-1">{kpi.note}</p>
      )}
    </div>
  );
}

export default function SupportView() {
  const data = useSupportData();
  const support = getSupport();

  const openCount = support.groups[0].kpis[0];
  const breachedCount = support.groups[1].kpis[1];

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Support &amp; SLA
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[support.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[support.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600 whitespace-nowrap">
          read-only · central support · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Open" value={openCount.value} status={openCount.status} tone="text-foreground-100" icon="ri-inbox-line" />
        <SummaryStat label="Urgent" value={support.groups[0].kpis[1].value} status={support.groups[0].kpis[1].status} tone={support.groups[0].kpis[1].value !== 0 && support.groups[0].kpis[1].status === 'live' ? 'text-red-400' : 'text-foreground-200'} icon="ri-error-warning-line" />
        <SummaryStat label="Unassigned" value={support.groups[0].kpis[2].value} status={support.groups[0].kpis[2].status} tone="text-amber-400" icon="ri-user-unfollow-line" />
        <SummaryStat label="SLA Breached" value={breachedCount.value} status={breachedCount.status} tone={breachedCount.value !== 0 && breachedCount.status === 'live' ? 'text-red-400' : 'text-foreground-200'} icon="ri-timer-flash-line" />
        <SummaryStat label="Active Sessions" value={support.groups[3].kpis[0].value} status={support.groups[3].kpis[0].status} tone="text-emerald-400" icon="ri-eye-line" />
        <SummaryStat label="Repairs Awaiting" value={support.groups[3].kpis[2].value} status={support.groups[3].kpis[2].status} tone="text-amber-400" icon="ri-tools-line" />
      </div>

      {/* Distance-readable banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className="ri-customer-service-2-line text-xl w-5 h-5 flex items-center justify-center text-accent-400"></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-100">
            {support.sourceState === 'unavailable'
              ? 'Support data unavailable'
              : `${openCount.value} open ticket${openCount.value === 1 ? '' : 's'} · ${breachedCount.value} SLA breach${breachedCount.value === 1 ? '' : 'es'}`}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {support.sourceState === 'unavailable'
              ? 'Central support unavailable — no support data is fabricated.'
              : `${support.oldestOpenAvailable && support.oldestOpenAge ? `Oldest open ${support.oldestOpenAge}` : 'No open tickets'} · ${getSlaDefinition()}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Escalations" value={support.escalationsAvailable ? support.activeEscalations : '—'} status={support.escalationsAvailable ? 'live' : 'unavailable'} />
          <SummaryCount label="Critical" value={support.escalationsAvailable ? support.criticalEscalations : '—'} status={support.escalationsAvailable ? 'live' : 'unavailable'} tone={support.criticalEscalations > 0 ? 'text-red-400' : undefined} />
          <SummaryCount label="SLA At Risk" value={support.groups[1].kpis[0].value} status={support.groups[1].kpis[0].status} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading support data…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* KPI groups */}
          <div className="col-span-7 min-h-0 grid grid-cols-2 gap-3 overflow-y-auto pr-1">
            {support.groups.map((group) => (
              <section key={group.title} className="bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                    <i className={`${group.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
                  </span>
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{group.title}</h4>
                </div>
                <div className="grid grid-cols-1 gap-2.5 p-4 flex-1 content-start">
                  {group.kpis.map((kpi) => (
                    <KpiCard key={kpi.label} kpi={kpi} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Right rail — team load, site load, escalations + ticket states */}
          <div className="col-span-5 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-team-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Team Load</h4>
              </div>
              {support.teamLoad.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500">{data.availability.teamWorkload ? 'No team workload recorded.' : 'Team workload unavailable.'}</p>
              ) : (
                <div className="space-y-2">
                  {support.teamLoad.map((t) => (
                    <div key={t.name} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[12px] font-label text-foreground-200 whitespace-nowrap">
                        <i className="ri-group-line w-4 h-4 flex items-center justify-center text-accent-400"></i>
                        {t.name}
                      </span>
                      <span className="flex items-center gap-3">
                        {t.urgent > 0 && <span className="text-[10px] font-label font-semibold text-red-400 whitespace-nowrap">{t.urgent} urgent</span>}
                        <span className="text-lg font-heading font-bold text-foreground-100 tabular-nums">{t.open}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-global-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Site Support Load</h4>
              </div>
              {support.siteLoad.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500">{data.availability.tickets ? 'No open tickets mapped to a site.' : 'Site load unavailable.'}</p>
              ) : (
                <div className="space-y-2">
                  {support.siteLoad.map((s) => (
                    <div key={s.site} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[12px] font-label text-foreground-200 whitespace-nowrap">
                        <i className="ri-link-m w-4 h-4 flex items-center justify-center text-accent-400"></i>
                        {s.site}
                      </span>
                      <span className="text-lg font-heading font-bold text-foreground-100 tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-flow-chart text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Ticket States</h4>
              </div>
              {support.ticketStates.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500">{data.availability.tickets ? 'No tickets recorded.' : 'Ticket state unavailable.'}</p>
              ) : (
                <div className="flex items-center flex-wrap gap-2">
                  {support.ticketStates.map((s) => (
                    <div key={s.state} className="inline-flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_META[s.state].cls}`}>
                        {STATE_META[s.state].label}
                      </span>
                      <span className="text-base font-heading font-bold text-foreground-100 tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-background-200/60">
                <div className="text-center">
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">Expired Sessions</p>
                  <p className="text-xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">
                    {support.sessionsAvailable ? support.expiredSessions : '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">Revoked</p>
                  <p className="text-xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">
                    {support.sessionsAvailable ? support.revokedSessions : '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">Repairs Failed</p>
                  <p className={`text-xl font-heading font-bold tabular-nums leading-none mt-1 ${support.repairsAvailable && (support.repairs?.failed ?? 0) > 0 ? 'text-red-400' : 'text-foreground-100'}`}>
                    {support.repairsAvailable ? (support.repairs?.failed ?? 0) : '—'}
                  </p>
                </div>
              </div>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <p className="text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">SLA Definition</p>
              <p className="text-[11px] font-label text-foreground-300 leading-tight">{getSlaDefinition()}</p>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                Aggregate only — no customer names, subjects or session details are shown.
              </p>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryStat({
  label,
  value,
  status,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  status: 'live' | 'unavailable';
  tone: string;
  icon: string;
}) {
  const unavailable = status !== 'live';
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[84px]">
      <div className="flex items-center justify-between gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${tone}`}>
          <i className={`${icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
      </div>
      {unavailable ? (
        <p className="text-sm font-heading font-semibold text-foreground-500 mt-2 leading-tight">{value}</p>
      ) : (
        <p className={`text-3xl font-heading font-bold ${tone} leading-none tabular-nums mt-2 truncate`}>{value}</p>
      )}
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mt-1.5 whitespace-nowrap">{label}</p>
    </div>
  );
}

function SummaryCount({
  label,
  value,
  status,
  tone,
}: {
  label: string;
  value: string | number;
  status: 'live' | 'unavailable';
  tone?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      {status !== 'live' ? (
        <p className="text-sm font-heading font-semibold text-foreground-500 leading-none mt-1">{value}</p>
      ) : (
        <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
      )}
    </div>
  );
}