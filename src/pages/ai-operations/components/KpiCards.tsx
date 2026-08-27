import type { KpiMetric } from '@/pages/ai-operations/types';

function KpiCard({ metric }: { metric: KpiMetric }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{metric.label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${metric.accent}`}>
          <i className={`${metric.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100">{metric.value}</p>
    </div>
  );
}

export default function KpiCards({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <section aria-label="Key performance indicators">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {metrics.map((m) => (
          <KpiCard key={m.key} metric={m} />
        ))}
      </div>
    </section>
  );
}