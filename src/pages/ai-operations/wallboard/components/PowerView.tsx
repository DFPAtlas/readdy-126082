import { usePowerData } from '@/pages/ai-operations/wallboard/powerStore';
import {
  getPowerSummary,
  getUpsDevices,
  UPS_STATUS_META,
  type UpsStatus,
  type PowerDeviceView,
} from '@/pages/ai-operations/wallboard/powerSelectors';

const STATUS_TEXT: Record<UpsStatus, string> = {
  online: 'text-emerald-400',
  on_battery: 'text-amber-400',
  low_battery: 'text-red-400',
  overload: 'text-red-400',
  replace_battery: 'text-amber-400',
  communication_lost: 'text-red-400',
  unknown: 'text-secondary-300',
};

const STATUS_BADGE: Record<UpsStatus, string> = {
  online: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  on_battery: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  low_battery: 'text-red-400 bg-red-500/10 border-red-500/30',
  overload: 'text-red-400 bg-red-500/10 border-red-500/30',
  replace_battery: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  communication_lost: 'text-red-400 bg-red-500/10 border-red-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const TONE_TEXT: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

function fmtSeen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtNumber(v: number | null | undefined, suffix = ''): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v}${suffix}`;
}

function StatusBadge({ status }: { status: UpsStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATUS_BADGE[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {UPS_STATUS_META[status].label}
    </span>
  );
}

function UpsTile({ device }: { device: PowerDeviceView }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 flex flex-col min-h-[150px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{device.name}</p>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mt-0.5 whitespace-nowrap">
            {[device.manufacturer, device.model].filter(Boolean).join(' · ') || 'UPS'}
          </p>
        </div>
        <StatusBadge status={device.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Battery" value={fmtNumber(device.batteryCharge, '%')} />
        <Metric label="Runtime" value={device.runtimeLabel} />
        <Metric label="Load" value={fmtNumber(device.loadPercent, '%')} />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Metric label="Input V" value={fmtNumber(device.inputVoltage)} />
        <Metric label="Output V" value={fmtNumber(device.outputVoltage)} />
        <Metric label="Mains" value={device.mains === 'online' ? 'Online' : device.mains === 'on_battery' ? 'Battery' : '—'} />
      </div>

      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-label text-foreground-600 uppercase">Last seen {fmtSeen(device.lastSeen)}</p>
        {device.stale && (
          <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            STALE
          </span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-600 uppercase">{label}</p>
      <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5 whitespace-nowrap">{value}</p>
    </div>
  );
}

export default function PowerView() {
  const power = usePowerData();
  const summary = getPowerSummary();
  const devices = getUpsDevices();

  const hasSource = summary.sourceStatus === 'live';

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Power &amp; Comm Room
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${
              summary.sourceStatus === 'live'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                : summary.sourceStatus === 'unavailable'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                  : 'text-foreground-500 bg-background-200/60 border-background-300/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {summary.sourceStatus === 'live' ? 'Live' : summary.sourceStatus === 'unavailable' ? 'Unavailable' : 'Not Connected'}
          </span>
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only monitoring · last refresh {power.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary — readable from across the room */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-flashlight-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="UPS Devices" value={summary.upsCount} />
          <SummaryCount label="On Battery" value={summary.onBatteryCount} />
          <SummaryCount label="Sensors" value={summary.environmentCount} />
        </div>
      </div>

      {power.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading power telemetry…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* UPS devices */}
          <div className="col-span-8 min-h-0 flex flex-col overflow-y-auto pr-1">
            <section className="min-h-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-battery-2-charge-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  UPS Devices
                </h4>
              </div>

              {devices.length === 0 ? (
                <EmptyPanel
                  icon="ri-battery-2-line"
                  title="No UPS devices registered"
                  note="No NUT / PeaNUT / TrueNAS UPS / Home Assistant telemetry is wired. Once a source is connected, battery charge, runtime, load and voltage will appear here."
                />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {devices.map((d) => (
                    <UpsTile key={d.key} device={d} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Environment */}
          <div className="col-span-4 min-h-0 flex flex-col overflow-y-auto">
            <section className="bg-background-100 border border-background-200/60 rounded-lg flex-1 min-h-0 flex flex-col">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-thermometer-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Comm Room Environment
                </h4>
              </div>
              <div className="p-4 flex-1 min-h-0 overflow-y-auto">
                {power.environment.length === 0 ? (
                  <EmptyPanel
                    icon="ri-temp-cold-line"
                    title="No environmental sensors"
                    note="Room / inlet / rack temperature, humidity and fan state are not monitored. Unavailable sensors are omitted rather than fabricated."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {power.environment.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{s.label}</p>
                          <p className="text-[11px] font-label text-foreground-600 capitalize">{s.kind}</p>
                        </div>
                        <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums whitespace-nowrap">
                          {s.value != null ? `${s.value}${s.unit}` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {hasSource && (
                  <p className="text-[11px] font-label text-foreground-500 leading-tight mt-3">
                    Temperature, fan and humidity limits are inherited from the underlying monitoring system where defined.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
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

function EmptyPanel({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 h-full min-h-[120px]">
      <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
        <i className={`${icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
      </span>
      <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">{title}</p>
      <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">{note}</p>
    </div>
  );
}