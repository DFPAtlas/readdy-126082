import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { useWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import { useBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import {
  getWallboardTrends,
  type TrendMetric,
  type TrendVerdict,
  type SparklineSeries,
} from '@/pages/ai-operations/wallboard/trendsSelectors';

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const DIRECTION_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

const VERDICT_TEXT: Record<TrendVerdict, string> = {
  improving: 'text-emerald-400',
  worsening: 'text-red-400',
  stable: 'text-foreground-300',
  unavailable: 'text-foreground-500',
};

const VERDICT_LABEL: Record<TrendVerdict, string> = {
  improving: 'improving',
  worsening: 'worsening',
  stable: 'stable',
  unavailable: '—',
};

const SPARK_BG: Record<SparklineSeries['tone'], string> = {
  accent: 'bg-accent-400',
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
  red: 'bg-red-400',
};

function MetricCard({ metric }: { metric: TrendMetric }) {
  const live = metric.status === 'live';
  const unavailable = metric.status === 'unavailable';
  const insufficient = metric.status === 'insufficient';

  const arrow = live && metric.direction ? DIRECTION_ARROW[metric.direction] : '—';
  const verdictText = live ? VERDICT_TEXT[metric.verdict] : 'text-foreground-500';

  let subLabel: string;
  if (unavailable) subLabel = 'source unavailable';
  else if (insufficient) subLabel = 'trend unavailable — insufficient history';
  else subLabel = `vs ${metric.previousDisplay} previous`;

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col min-h-[104px]">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className={`${metric.icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        <p className="text-[11px] font-label font-semibold text-foreground-600 uppercase tracking-wide whitespace-nowrap">
          {metric.label}
        </p>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {live ? (
          <p className={`text-2xl font-heading font-bold tabular-nums leading-none ${verdictText}`}>
            {metric.currentDisplay}
          </p>
        ) : (
          <p className="text-2xl font-heading font-bold text-foreground-500 leading-none">—</p>
        )}
        <span className={`text-lg font-heading font-bold leading-none ${verdictText}`}>{arrow}</span>
        {live && (
          <span className="text-[10px] font-label font-semibold text-foreground-500 uppercase tracking-wide whitespace-nowrap">
            {VERDICT_LABEL[metric.verdict]}
          </span>
        )}
      </div>

      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mt-1.5 leading-tight">
        {metric.periodLabel}
      </p>
      <p className={`text-[11px] font-label mt-1 ${live ? 'text-foreground-600' : 'text-foreground-500'}`}>
        {subLabel}
      </p>
    </div>
  );
}

function Sparkline({ item }: { item: SparklineSeries }) {
  const H = 48;
  const max = Math.max(1, ...item.series);
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-label font-semibold text-foreground-600 uppercase tracking-wide whitespace-nowrap">
          {item.label}
        </p>
        <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">
          7 days
        </p>
      </div>
      <div className="flex items-end gap-1 mt-2" style={{ height: `${H}px` }}>
        {item.series.map((v, i) => (
          <div key={i} className="flex-1 h-full flex items-end">
            <div
              className={`w-full ${SPARK_BG[item.tone]} rounded-t-sm`}
              style={{ height: `${Math.max(3, Math.round((v / max) * H))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        {item.dayLabels.map((l, i) => (
          <div key={i} className="flex-1 text-center text-[9px] font-label text-foreground-500 whitespace-nowrap">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrendsView() {
  // Subscribe to every source the trends read so the view re-renders on the
  // shared 30s refresh (no separate polling of its own).
  useGroupLiveData();
  useBusinessData();
  useWorkloadData();
  useBackupData();

  const t = getWallboardTrends();
  const data = useGroupLiveData();

  const inc = t.incidents;
  const mttrLabel =
    inc.mttrHours == null
      ? '—'
      : inc.mttrHours < 1
        ? `${Math.round(inc.mttrHours * 60)}m`
        : `${inc.mttrHours.toFixed(1)}h`;

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Trends &amp; Historical Context
          </h3>
          {!data.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[t.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[t.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">{t.periodNote}</p>
      </div>

      {/* Incident context banner */}
      <div className="shrink-0 flex items-center gap-6 bg-background-100 border border-background-200/60 rounded-lg px-5 py-3.5 mb-3">
        <span className="w-9 h-9 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
          <i className="ri-fire-line text-lg w-5 h-5 flex items-center justify-center"></i>
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-label font-semibold text-foreground-600 uppercase tracking-wide">
            Incident Context
          </p>
          <p className="text-[12px] font-label text-foreground-500 mt-0.5">
            resolved incidents used for recovery-time only · no SLA invented
          </p>
        </div>
        <div className="ml-auto flex items-center gap-8">
          <ContextCount label="Incidents Today" value={inc.today} />
          <ContextCount label="Incidents This Week" value={inc.week} />
          <div className="text-center">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">
              Mean Time to Resolve
            </p>
            <p className="text-2xl font-heading font-bold tabular-nums leading-none mt-1 text-foreground-100">
              {mttrLabel}
            </p>
            <p className="text-[10px] font-label text-foreground-500 mt-0.5">
              {inc.mttrCount > 0 ? `${inc.mttrCount} resolved incident${inc.mttrCount > 1 ? 's' : ''}` : 'no resolved incidents'}
            </p>
          </div>
        </div>
      </div>

      {!t.hasAnyData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-heading font-semibold text-foreground-200">No historical data available</p>
            <p className="text-[11px] font-label text-foreground-600 mt-1">
              Trend sources could not be reached. Live health and Incident Mode remain unaffected.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Business / Operations / Systems */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {t.sections.map((section) => (
              <section
                key={section.title}
                className="bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0"
              >
                <div className="px-4 py-2.5 border-b border-background-200/60 flex items-center gap-2 shrink-0">
                  <span className="w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                    <i className={`${section.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                  </span>
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                    {section.title}
                  </h4>
                </div>
                <div className="p-3 grid grid-cols-1 gap-2">
                  {section.metrics.map((m) => (
                    <MetricCard key={m.key} metric={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Last 7 days mini charts */}
          <section className="mt-3 bg-background-100 border border-background-200/60 rounded-lg shrink-0">
            <div className="px-4 py-2.5 border-b border-background-200/60 flex items-center gap-2">
              <span className="w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                <i className="ri-bar-chart-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </span>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                Last 7 Days
              </h4>
              <p className="text-[11px] font-label text-foreground-500 ml-2">daily activity · oldest → today</p>
            </div>
            <div className="p-3 grid grid-cols-4 gap-2.5">
              {t.sparklines.map((s) => (
                <Sparkline key={s.key} item={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function ContextCount({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-2xl font-heading font-bold tabular-nums leading-none mt-1 text-foreground-100">
        {value == null ? '—' : value}
      </p>
    </div>
  );
}