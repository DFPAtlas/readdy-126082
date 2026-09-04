import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import { useInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import {
  getSitesServicesList,
  getPublicServices,
  getSitesServicesSummary,
  SITE_STATE_META,
  type SiteAvailability,
  type SitesServiceTile,
  type PublicServiceTile,
} from '@/pages/ai-operations/wallboard/siteSelectors';

const STATE_BADGE: Record<SiteAvailability, string> = {
  online: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-red-400 bg-red-500/10 border-red-500/30',
  maintenance: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const TONE_TEXT: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

const SOURCE_BADGE: Record<'live' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const INFRA_TEXT: Record<string, string> = {
  healthy: 'text-emerald-400',
  warning: 'text-amber-400',
  degraded: 'text-amber-400',
  offline: 'text-red-400',
  unknown: 'text-secondary-300',
};

const INFRA_LABEL: Record<string, string> = {
  healthy: 'HEALTHY',
  warning: 'WARNING',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  unknown: 'UNKNOWN',
};

function fmtCheck(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function SiteTile({ tile }: { tile: SitesServiceTile }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 flex flex-col min-h-[148px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{tile.name}</p>
          <p className="text-[11px] font-label text-foreground-600 truncate mt-0.5">{tile.domain || 'No domain'}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap shrink-0 ${STATE_BADGE[tile.state]}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          {SITE_STATE_META[tile.state].label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Visitors" value={tile.onlineVisitors != null ? String(tile.onlineVisitors) : '—'} />
        <Metric
          label="Response"
          value={tile.responseTimeMs != null ? `${tile.responseTimeMs} ms` : '—'}
        />
        <Metric
          label="SSL"
          value={tile.sslStatus ? tile.sslStatus.toUpperCase() : '—'}
          tone={tile.sslStatus === 'expired' ? 'text-red-400' : tile.sslStatus === 'warning' ? 'text-amber-400' : tile.sslStatus === 'valid' ? 'text-emerald-400' : 'text-foreground-100'}
        />
      </div>

      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-label text-foreground-600 uppercase truncate">
          {tile.criticality ? `${tile.criticality} · ` : ''}
          {tile.aiStatus}
        </p>
        {tile.monitoring === 'not_monitored' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border border-secondary-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            NOT MONITORED
          </span>
        ) : tile.monitoring === 'stale' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            STALE
          </span>
        ) : (
          <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">
            checked {fmtCheck(tile.lastCheck)}
          </span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'text-foreground-100' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-600 uppercase">{label}</p>
      <p className={`text-sm font-heading font-semibold tabular-nums mt-0.5 whitespace-nowrap ${tone}`}>{value}</p>
    </div>
  );
}

function ServiceRow({ service }: { service: PublicServiceTile }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{service.name}</p>
        <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide truncate">{service.category}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {service.latencyMs != null && (
          <p className="text-[11px] font-label text-foreground-500 tabular-nums whitespace-nowrap">{service.latencyMs} ms</p>
        )}
        <span className={`w-2 h-2 rounded-full ${INFRA_TEXT[service.status].replace('text-', 'bg-')}`}></span>
        <p className={`text-[11px] font-label font-semibold whitespace-nowrap ${INFRA_TEXT[service.status]}`}>
          {INFRA_LABEL[service.status]}
        </p>
      </div>
    </div>
  );
}

export default function SitesServicesView() {
  useGroupLiveData();
  useSiteMonitorData();
  useInfrastructureData();

  const summary = getSitesServicesSummary();
  const tiles = getSitesServicesList();
  const services = getPublicServices();
  const monitor = useSiteMonitorData();

  const monitoredCount = tiles.filter((t) => t.monitoring === 'monitored').length;
  const staleCount = tiles.filter((t) => t.monitoring === 'stale').length;
  const notMonitoredCount = tiles.filter((t) => t.monitoring === 'not_monitored').length;

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Sites &amp; Services
          </h3>
          {!monitor.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · Group Site Registry · last refresh {monitor.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip — readable from across the room */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Sites" value={summary.total} tone="text-foreground-100" icon="ri-global-line" />
        <SummaryStat label="Online" value={summary.online} tone="text-emerald-400" icon="ri-check-double-line" />
        <SummaryStat label="Degraded" value={summary.degraded} tone={summary.degraded > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-time-line" />
        <SummaryStat label="Offline" value={summary.offline} tone={summary.offline > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Maintenance" value={summary.maintenance} tone={summary.maintenance > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-tools-line" />
        <SummaryStat label="Unknown" value={summary.unknown} tone="text-secondary-300" icon="ri-question-line" />
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-global-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Sites" value={summary.total} />
          <SummaryCount label="Online" value={summary.online} />
          <SummaryCount label="Degraded" value={summary.degraded} />
          <SummaryCount label="Offline" value={summary.offline} />
        </div>
      </div>

      {monitor.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading site availability…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Site grid */}
          <div className="col-span-8 min-h-0 flex flex-col overflow-y-auto pr-1">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                <i className="ri-global-line text-base w-4 h-4 flex items-center justify-center"></i>
              </span>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                Registered Sites
              </h4>
            </div>
            {tiles.length === 0 ? (
              <p className="text-sm font-label text-foreground-500">No sites registered.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {tiles.map((t) => (
                  <SiteTile key={t.key} tile={t} />
                ))}
              </div>
            )}
          </div>

          {/* Public services + monitoring gap */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-plug-2-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Public Services
                </h4>
              </div>
              <div className="p-4 space-y-2">
                {services.map((s) => (
                  <ServiceRow key={s.key} service={s} />
                ))}
                <p className="text-[11px] font-label text-foreground-500 leading-tight pt-1">
                  Public-facing dependencies reused from the existing service-health registry.
                </p>
              </div>
            </section>

            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-radar-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Reachability &amp; SSL
                </h4>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <GapStat label="Monitored" value={monitoredCount} tone={monitoredCount > 0 ? 'text-emerald-400' : 'text-foreground-200'} />
                  <GapStat label="Stale" value={staleCount} tone={staleCount > 0 ? 'text-amber-400' : 'text-foreground-200'} />
                  <GapStat label="Not Monitored" value={notMonitoredCount} tone={notMonitoredCount > 0 ? 'text-secondary-300' : 'text-foreground-200'} />
                </div>
                <p className="text-[11px] font-label text-foreground-500 leading-tight">
                  Response time &amp; certificate state come only from the existing uptime monitor. The monitor's
                  domains do not currently match the Group Site Registry, and its readings are stale — so reachability
                  is shown as &quot;not monitored&quot; rather than fabricated.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryStat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[84px]">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${tone}`}>
          <i className={`${icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      </div>
      <p className={`text-3xl font-heading font-bold ${tone} leading-none tabular-nums mt-2`}>{value}</p>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-2xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}

function GapStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-xl font-heading font-bold tabular-nums mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}