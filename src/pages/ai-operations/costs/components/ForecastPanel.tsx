import { getGroupForecast } from '@/pages/ai-operations/costs/selectors';

export default function ForecastPanel() {
  const f = getGroupForecast();

  const rows = [
    { label: 'Current month spend', value: f.currentMonthSpend },
    { label: 'Average daily spend', value: f.averageDailySpend },
    { label: 'Estimated month-end', value: f.estimatedMonthEnd },
    { label: 'Budget', value: f.budget },
    { label: 'Variance', value: f.variance },
  ];

  return (
    <section aria-label="Forecast" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Forecast</h3>
        <span className="text-[11px] font-label text-foreground-500">Simple estimate</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="p-3 rounded-md bg-background-50 border border-background-200/50">
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{r.label}</p>
            <p className="text-base font-heading font-semibold text-foreground-100 mt-1">{r.value}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">
        This is a simple linear projection of average daily spend to month end — no predictive model is used.
      </p>
    </section>
  );
}