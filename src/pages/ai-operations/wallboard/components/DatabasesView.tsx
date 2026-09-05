import { useDatabaseData } from '@/pages/ai-operations/wallboard/databaseStore';
import {
  getDatabaseSummary,
  getDatabaseCards,
  getUnconfiguredDatabases,
  getCoreServicesSummary,
  getEdgeFunctionSummary,
  getBackupRisk,
  getDatabaseGaps,
  DATABASE_STATE_META,
  type DatabaseState,
  type DatabaseCard,
  type CoreService,
} from '@/pages/ai-operations/wallboard/databaseSelectors';

const STATE_TEXT: Record<DatabaseState, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  offline: 'text-red-400',
  stale: 'text-amber-400',
  check_error: 'text-secondary-300',
  unknown: 'text-secondary-300',
  not_configured: 'text-secondary-300',
};

const STATE_BADGE: Record<DatabaseState, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-red-400 bg-red-500/10 border-red-500/30',
  stale: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  check_error: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  not_configured: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
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
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function StateBadge({ state }: { state: DatabaseState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[state]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {DATABASE_STATE_META[state].label}
    </span>
  );
}

function ServiceDot({ service }: { service: CoreService }) {
  const tone =
    service.status === 'healthy'
      ? 'bg-emerald-400'
      : service.status === 'degraded' || service.status === 'stale'
        ? 'bg-amber-400'
        : service.status === 'offline'
          ? 'bg-red-400'
          : 'bg-secondary-300';
  return <span className={`w-2 h-2 rounded-full shrink-0 ${tone}`}></span>;
}

function DatabaseCardView({ card }: { card: DatabaseCard }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 flex flex-col min-h-[180px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{card.name}</p>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mt-0.5 whitespace-nowrap">
            {card.site || 'Unassigned'}
          </p>
        </div>
        <StateBadge state={card.state} />
      </div>

      <div className="mt-3 space-y-1.5">
        {card.services.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ServiceDot service={s} />
              <p className="text-[11px] font-label text-foreground-500 whitespace-nowrap">{s.label}</p>
            </div>
            <p className={`text-[11px] font-label font-semibold whitespace-nowrap ${STATE_TEXT[s.status]}`}>
              {DATABASE_STATE_META[s.status].label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-background-200/40">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-500 whitespace-nowrap">
            <i className={`${card.serviceRoleConfigured ? 'ri-check-line text-emerald-400' : 'ri-close-line text-amber-400'} w-3 h-3 flex items-center justify-center`}></i>
            Service role
          </span>
          <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">Checked {fmtSeen(card.lastChecked)}</span>
        </div>
      </div>
    </div>
  );
}

function CoreServicePanel() {
  const core = getCoreServicesSummary();
  const rows: { key: string; label: string; status: DatabaseState }[] = [
    { key: 'database', label: 'Database', status: core.database },
    { key: 'auth', label: 'Auth', status: core.auth },
    { key: 'realtime', label: 'Realtime', status: core.realtime },
    { key: 'storage', label: 'Storage', status: core.storage },
    { key: 'functions', label: 'Edge Functions', status: core.functions },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-apps-2-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Core Services
        </h4>
      </div>
      <div className="p-4 space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  r.status === 'healthy'
                    ? 'bg-emerald-400'
                    : r.status === 'degraded'
                      ? 'bg-amber-400'
                      : r.status === 'offline'
                        ? 'bg-red-400'
                        : 'bg-secondary-300'
                }`}
              ></span>
              <p className="text-sm font-heading font-semibold text-foreground-100 whitespace-nowrap">{r.label}</p>
            </div>
            <p className={`text-[11px] font-label font-semibold whitespace-nowrap ${STATE_TEXT[r.status]}`}>
              {DATABASE_STATE_META[r.status].label}
            </p>
          </div>
        ))}
        <div className="pt-1">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">
            Live probe latency
          </p>
          {core.liveProbeAvailable ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                <p className="text-[10px] font-label text-foreground-600 uppercase">DB</p>
                <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">
                  {core.liveLatency.database != null ? `${core.liveLatency.database}ms` : '—'}
                </p>
              </div>
              <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                <p className="text-[10px] font-label text-foreground-600 uppercase">Auth</p>
                <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">
                  {core.liveLatency.auth != null ? `${core.liveLatency.auth}ms` : '—'}
                </p>
              </div>
              <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                <p className="text-[10px] font-label text-foreground-600 uppercase">Storage</p>
                <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">
                  {core.liveLatency.storage != null ? `${core.liveLatency.storage}ms` : '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] font-label text-foreground-500">Live probe not available.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function EdgeFunctionsPanel() {
  const fn = getEdgeFunctionSummary();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-function-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Edge Functions
        </h4>
      </div>
      <div className="p-4">
        {fn.sourceState === 'unavailable' ? (
          <p className="text-sm font-label text-foreground-500">Edge function monitor source unavailable.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-background-50 border border-background-200/60 rounded-md py-2.5">
              <p className="text-[10px] font-label text-foreground-600 uppercase">Total</p>
              <p className="text-xl font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{fn.total}</p>
            </div>
            <div className="bg-background-50 border border-background-200/60 rounded-md py-2.5">
              <p className="text-[10px] font-label text-foreground-600 uppercase">Healthy</p>
              <p className="text-xl font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{fn.healthy}</p>
            </div>
            <div className="bg-background-50 border border-background-200/60 rounded-md py-2.5">
              <p className="text-[10px] font-label text-foreground-600 uppercase">Errors</p>
              <p className={`text-xl font-heading font-bold tabular-nums mt-0.5 ${fn.errored > 0 ? 'text-red-400' : 'text-foreground-100'}`}>
                {fn.errored}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BackupRiskPanel() {
  const risk = getBackupRisk();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-safe-2-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Backup Relationship
        </h4>
      </div>
      <div className="p-4 flex items-center gap-3">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            risk.hasRisk ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
        ></span>
        <p className="text-sm font-label text-foreground-100">{risk.label}</p>
      </div>
    </section>
  );
}

function GapsPanel() {
  const gaps = getDatabaseGaps();
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-alert-line text-base w-4 h-4 flex items-center justify-center"></i>
        </span>
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          Monitoring Gaps
        </h4>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2.5">
        <p className="text-[11px] font-label text-foreground-600 leading-tight">
          Metrics with no authoritative source. These are not monitored — never assumed healthy.
        </p>
        {gaps.map((g) => (
          <div
            key={g.area}
            className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{g.area}</p>
              <p className="text-[11px] font-label text-foreground-500 truncate">{g.note}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border border-secondary-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
              NOT MONITORED
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DatabasesView() {
  const db = useDatabaseData();
  const summary = getDatabaseSummary();
  const cards = getDatabaseCards();
  const unconfigured = getUnconfiguredDatabases();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Databases &amp; Supabase
          </h3>
          {!db.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only monitoring · last refresh {db.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip — readable from across the room */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Backends" value={summary.total} tone="text-foreground-100" icon="ri-database-2-line" />
        <SummaryStat label="Healthy" value={summary.healthy} tone="text-emerald-400" icon="ri-check-double-line" />
        <SummaryStat label="Degraded" value={summary.degraded} tone={summary.degraded > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-arrow-down-circle-line" />
        <SummaryStat label="Offline" value={summary.offline} tone={summary.offline > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Unknown" value={summary.unknown} tone="text-secondary-300" icon="ri-question-line" />
        <SummaryStat label="Not Configured" value={summary.notConfigured} tone="text-secondary-300" icon="ri-forbid-2-line" />
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-database-2-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Backends" value={summary.total} />
          <SummaryCount label="Healthy" value={summary.healthy} />
          <SummaryCount label="Degraded + Offline" value={summary.degraded + summary.offline} />
        </div>
      </div>

      {db.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading database status…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Per-database cards + not-configured */}
          <div className="col-span-8 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-database-2-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Monitored Backends
                </h4>
              </div>
              {cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
                  <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
                    <i className="ri-database-2-line text-xl w-5 h-5 flex items-center justify-center"></i>
                  </span>
                  <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">No backends registered</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">
                    No authoritative database monitor is reporting. Monitoring-unavailable is never shown as healthy.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {cards.map((c) => (
                    <DatabaseCardView key={c.key} card={c} />
                  ))}
                </div>
              )}
            </section>

            {unconfigured.length > 0 && (
              <section className="shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                    <i className="ri-forbid-2-line text-base w-4 h-4 flex items-center justify-center"></i>
                  </span>
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                    Not Configured
                  </h4>
                </div>
                <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                  <p className="text-[11px] font-label text-foreground-600 mb-2.5 leading-tight">
                    Registered projects with no Supabase monitor. These have no backend health source.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unconfigured.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 text-[11px] font-label text-secondary-300 bg-secondary-500/10 border border-secondary-500/25 rounded-full px-2.5 py-1 whitespace-nowrap"
                      >
                        <i className="ri-database-2-line w-3 h-3 flex items-center justify-center"></i>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Core services + edge functions + backup + gaps */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <CoreServicePanel />
            <EdgeFunctionsPanel />
            <BackupRiskPanel />
            <GapsPanel />
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

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-2xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}