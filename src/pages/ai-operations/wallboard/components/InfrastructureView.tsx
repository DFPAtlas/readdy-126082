import {
  useInfrastructureData,
} from '@/pages/ai-operations/wallboard/infrastructureStore';
import {
  getInfrastructureSummary,
  getInfrastructureHosts,
  getInfrastructureServices,
  getInfrastructureNetwork,
  getInfrastructureStorage,
  INFRA_STATUS_META,
  type InfraStatus,
  type InfraTile,
} from '@/pages/ai-operations/wallboard/infrastructureSelectors';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';

const STATUS_TEXT: Record<InfraStatus, string> = {
  healthy: 'text-emerald-400',
  warning: 'text-amber-400',
  degraded: 'text-amber-400',
  offline: 'text-red-400',
  unknown: 'text-secondary-300',
};

const STATUS_BADGE: Record<InfraStatus, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-red-400 bg-red-500/10 border-red-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

function fmtSeen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function StatusBadge({ status }: { status: InfraStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATUS_BADGE[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {INFRA_STATUS_META[status].label}
    </span>
  );
}

function HostTile({ tile }: { tile: InfraTile }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 flex flex-col min-h-[132px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{tile.name}</p>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mt-0.5 whitespace-nowrap">
            {tile.role}
          </p>
        </div>
        <StatusBadge status={tile.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase">Latency</p>
          <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">
            {tile.latencyMs != null ? `${tile.latencyMs}ms` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase">Last Seen</p>
          <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">
            {fmtSeen(tile.lastSeen)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase">CPU · RAM · Disk</p>
          <p className="text-sm font-heading font-semibold text-secondary-300 mt-0.5">Not monitored</p>
        </div>
      </div>

      {tile.message && (
        <p className="text-[11px] font-label text-foreground-500 mt-2 leading-tight line-clamp-2">{tile.message}</p>
      )}
    </div>
  );
}

function ServiceTile({ tile }: { tile: InfraTile }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col min-h-[96px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{tile.name}</p>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mt-0.5 whitespace-nowrap">
            {tile.role}
          </p>
        </div>
        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${STATUS_TEXT[tile.status].replace('text-', 'bg-')}`}></span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={`text-[11px] font-label font-semibold ${STATUS_TEXT[tile.status]} whitespace-nowrap`}>
          {INFRA_STATUS_META[tile.status].label}
        </p>
        {tile.latencyMs != null && (
          <p className="text-[11px] font-label text-foreground-500 tabular-nums whitespace-nowrap">
            {tile.latencyMs}ms
          </p>
        )}
      </div>
    </div>
  );
}

export default function InfrastructureView() {
  const infra = useInfrastructureData();
  useRuntimeHealth();

  const summary = getInfrastructureSummary();
  const hosts = getInfrastructureHosts();
  const services = getInfrastructureServices();
  const network = getInfrastructureNetwork();
  const storage = getInfrastructureStorage();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Infrastructure
          </h3>
          {!infra.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          {summary.total} systems · last refresh {infra.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip — readable from across the room */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Systems" value={summary.total} tone="text-foreground-100" icon="ri-stack-line" />
        <SummaryStat label="Healthy" value={summary.healthy} tone="text-emerald-400" icon="ri-check-double-line" />
        <SummaryStat label="Warning" value={summary.warning} tone="text-amber-400" icon="ri-alert-line" />
        <SummaryStat label="Degraded" value={summary.degraded} tone="text-amber-400" icon="ri-arrow-down-circle-line" />
        <SummaryStat label="Offline" value={summary.offline} tone={summary.offline > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Unknown" value={summary.unknown} tone="text-secondary-300" icon="ri-question-line" />
      </div>

      {infra.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading infrastructure…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Host grid (HAL) + service grid */}
          <div className="col-span-8 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            {hosts.length > 0 && (
              <section className="shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                    <i className="ri-server-line text-base w-4 h-4 flex items-center justify-center"></i>
                  </span>
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                    Hosts
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {hosts.map((h) => (
                    <HostTile key={h.key} tile={h} />
                  ))}
                </div>
              </section>
            )}

            <section className="min-h-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-apps-2-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Registered Services
                </h4>
              </div>
              {services.length === 0 ? (
                <p className="text-sm font-label text-foreground-500">No services registered.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {services.map((s) => (
                    <ServiceTile key={s.key} tile={s} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Network + Storage panels */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-signal-tower-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Network
                </h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-heading font-semibold text-foreground-100">HAL Runtime Bridge</p>
                    <p className="text-[11px] font-label text-foreground-600">Outbound HTTPS · Tailscale/remote</p>
                  </div>
                  <StatusBadge status={network.bridgeStatus} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                    <p className="text-[10px] font-label text-foreground-600 uppercase">Status</p>
                    <p className="text-sm font-heading font-semibold text-foreground-100 mt-0.5">{network.bridgeLabel}</p>
                  </div>
                  <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                    <p className="text-[10px] font-label text-foreground-600 uppercase">Latency</p>
                    <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">
                      {network.latencyMs != null ? `${network.latencyMs}ms` : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] font-label text-foreground-500 leading-tight">{network.note}</p>
              </div>
            </section>

            <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-database-2-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Storage
                </h4>
              </div>
              <div className="p-4 space-y-2.5">
                {storage.items.length === 0 ? (
                  <p className="text-sm font-label text-foreground-500">No storage service registered.</p>
                ) : (
                  storage.items.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{s.name}</p>
                        {s.message && (
                          <p className="text-[11px] font-label text-foreground-500 truncate">{s.message}</p>
                        )}
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  ))
                )}
                <p className="text-[11px] font-label text-foreground-500 leading-tight">{storage.note}</p>
              </div>
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
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: string;
}) {
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