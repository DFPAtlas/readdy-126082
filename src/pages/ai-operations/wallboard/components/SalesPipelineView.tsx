import { useBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import {
  getSalesPipeline,
  getConversionDefinition,
  type SourceState,
  type SalesKpi,
  type SalesStage,
  type LeadSourceBucket,
  type SalesTrend,
} from '@/pages/ai-operations/wallboard/salesSelectors';

const SOURCE_BADGE: Record<SourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STAGE_META: Record<SalesStage, { label: string; cls: string }> = {
  NEW: { label: 'NEW', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
  CONTACTED: { label: 'CONTACTED', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25' },
  QUALIFIED: { label: 'QUALIFIED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  PROPOSAL: { label: 'PROPOSAL', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  WON: { label: 'WON', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  LOST: { label: 'LOST', cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
  UNKNOWN: { label: 'UNKNOWN', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const SOURCE_ICON: Record<LeadSourceBucket, string> = {
  Website: 'ri-global-line',
  Campaign: 'ri-megaphone-line',
  Referral: 'ri-share-forward-line',
  Direct: 'ri-user-star-line',
  Other: 'ri-more-line',
};

function TrendArrow({ trend }: { trend: SalesTrend }) {
  if (!trend.meaningful || trend.direction == null) return null;
  const meta =
    trend.direction === 'up'
      ? { icon: 'ri-arrow-up-line', cls: 'text-emerald-400' }
      : trend.direction === 'down'
        ? { icon: 'ri-arrow-down-line', cls: 'text-red-400' }
        : { icon: 'ri-subtract-line', cls: 'text-foreground-500' };
  const abs = Math.abs(trend.delta);
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-label font-semibold ${meta.cls}`} title="vs previous period">
      <i className={`${meta.icon} w-3 h-3 flex items-center justify-center`}></i>
      {abs}
    </span>
  );
}

function KpiCard({ kpi }: { kpi: SalesKpi }) {
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

export default function SalesPipelineView() {
  const data = useBusinessData();
  const pipeline = getSalesPipeline();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Sales Pipeline
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[pipeline.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[pipeline.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600 whitespace-nowrap">
          read-only · Lead Engine · {getConversionDefinition()} · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Open Leads" value={pipeline.groups[0].kpis[2].value} status={pipeline.groups[0].kpis[2].status} tone="text-foreground-100" icon="ri-user-search-line" />
        <SummaryStat label="New This Week" value={pipeline.groups[0].kpis[1].value} status={pipeline.groups[0].kpis[1].status} tone="text-accent-400" icon="ri-calendar-event-line" trend={pipeline.newBusinessTrend} />
        <SummaryStat label="Won This Month" value={pipeline.groups[2].kpis[0].value} status={pipeline.groups[2].kpis[0].status} tone="text-emerald-400" icon="ri-trophy-line" trend={pipeline.wonTrend} />
        <SummaryStat label="Lost This Month" value={pipeline.groups[2].kpis[1].value} status={pipeline.groups[2].kpis[1].status} tone="text-red-400" icon="ri-close-circle-line" />
        <SummaryStat label="Open Pipeline Value" value={pipeline.groups[1].kpis[2].value} status={pipeline.groups[1].kpis[2].status} tone="text-secondary-300" icon="ri-money-pound-circle-line" />
        <SummaryStat label="Overdue Follow-ups" value={pipeline.groups[3].kpis[1].value} status={pipeline.groups[3].kpis[1].status} tone="text-red-400" icon="ri-time-line" />
      </div>

      {/* Distance-readable banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className="ri-hand-coin-line text-xl w-5 h-5 flex items-center justify-center text-emerald-400"></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-100">
            {pipeline.hasAnyData
              ? `${pipeline.groups[0].kpis[2].value} open lead${pipeline.groups[0].kpis[2].value === 1 ? '' : 's'} in pipeline`
              : 'No lead data recorded'}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {pipeline.sourceState === 'unavailable'
              ? 'Lead Engine unavailable — no commercial data is fabricated.'
              : `Conversion ${pipeline.conversionRate == null ? 'n/a (no closed opportunities)' : `${Math.round(pipeline.conversionRate * 100)}%`} · ${getConversionDefinition()}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Qualified" value={pipeline.groups[1].kpis[0].value} status={pipeline.groups[1].kpis[0].status} />
          <SummaryCount label="Proposals" value={pipeline.groups[1].kpis[1].value} status={pipeline.groups[1].kpis[1].status} />
          <SummaryCount label="Due Today" value={pipeline.groups[3].kpis[0].value} status={pipeline.groups[3].kpis[0].status} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading sales pipeline…</p>
        </div>
      ) : !pipeline.hasAnyData && pipeline.sourceState !== 'unavailable' ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
            <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
              <i className="ri-user-add-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </span>
            <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">No lead data</p>
            <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">
              The Lead Engine has no records yet. Missing data is shown as unavailable — no leads are fabricated.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* KPI groups */}
          <div className="col-span-8 min-h-0 grid grid-cols-2 gap-3 overflow-y-auto pr-1">
            {pipeline.groups.map((group) => (
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

          {/* Right rail — sources + stages */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-radar-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Lead Sources</h4>
              </div>
              {pipeline.sourceBreakdown.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500">No lead sources recorded.</p>
              ) : (
                <div className="space-y-2">
                  {pipeline.sourceBreakdown.map((s) => (
                    <div key={s.bucket} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[12px] font-label text-foreground-200 whitespace-nowrap">
                        <i className={`${SOURCE_ICON[s.bucket]} w-4 h-4 flex items-center justify-center text-accent-400`}></i>
                        {s.bucket}
                      </span>
                      <span className="text-lg font-heading font-bold text-foreground-100 tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] font-label text-foreground-500 mt-3 leading-tight">
                Aggregate source only — no individual lead names are shown.
              </p>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-flow-chart text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Pipeline Stages</h4>
              </div>
              {pipeline.stageBreakdown.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500">No staged leads recorded.</p>
              ) : (
                <div className="space-y-2">
                  {pipeline.stageBreakdown.map((s) => (
                    <div key={s.stage} className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STAGE_META[s.stage].cls}`}>
                        {STAGE_META[s.stage].label}
                      </span>
                      <span className="text-lg font-heading font-bold text-foreground-100 tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg p-4">
              <p className="text-[10px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">Conversion Definition</p>
              <p className="text-[11px] font-label text-foreground-300 leading-tight">{getConversionDefinition()}</p>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                Pipeline value is estimated opportunity value and remains separate from earned revenue.
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
  trend,
}: {
  label: string;
  value: string | number;
  status: 'live' | 'unavailable';
  tone: string;
  icon: string;
  trend?: SalesTrend;
}) {
  const unavailable = status !== 'live';
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[84px]">
      <div className="flex items-center justify-between gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${tone}`}>
          <i className={`${icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        {trend && <TrendArrow trend={trend} />}
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
}: {
  label: string;
  value: string | number;
  status: 'live' | 'unavailable';
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      {status !== 'live' ? (
        <p className="text-sm font-heading font-semibold text-foreground-500 leading-none mt-1">{value}</p>
      ) : (
        <p className="text-2xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">{value}</p>
      )}
    </div>
  );
}