import { getCostSummary } from '@/pages/ai-operations/costs/selectors';

function KpiCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-xl font-heading font-bold text-foreground-100 truncate">{value}</p>
    </div>
  );
}

export default function CostKpis() {
  const s = getCostSummary();

  const cards = [
    { label: 'Cost Today', value: s.costToday, icon: 'ri-timer-flash-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Cost This Month', value: s.costThisMonth, icon: 'ri-calendar-2-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Estimated Month End', value: s.estimatedMonthEnd, icon: 'ri-line-chart-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Budget Remaining', value: s.budgetRemaining, icon: 'ri-wallet-3-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Highest Cost Site', value: s.highestCostSite, icon: 'ri-global-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Highest Cost Agent', value: s.highestCostAgent, icon: 'ri-robot-2-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Highest Cost Model', value: s.highestCostModel, icon: 'ri-cpu-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Budget Alerts', value: s.budgetAlerts, icon: 'ri-alert-line', accent: 'bg-red-500/10 text-red-400' },
  ];

  return (
    <section aria-label="Cost KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}