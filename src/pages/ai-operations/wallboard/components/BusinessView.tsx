import { useBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { getBusinessKpis, type BusinessKpi } from '@/pages/ai-operations/wallboard/businessSelectors';

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

function KpiCard({ kpi }: { kpi: BusinessKpi }) {
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

export default function BusinessView() {
  const data = useBusinessData();
  const { groups, sourceState } = getBusinessKpis();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Business Performance
          </h3>
          {!data.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">GBP · periods use Europe/London</p>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading business data…</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          {groups.map((group) => (
            <section
              key={group.title}
              className="bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0"
            >
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className={`${group.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  {group.title}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-4 flex-1 content-start">
                {group.kpis.map((kpi) => (
                  <KpiCard key={kpi.label} kpi={kpi} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}