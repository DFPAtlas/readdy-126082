import type { AiModel } from '@/pages/ai-operations/types';
import { countAgentsUsingModels } from '@/pages/ai-operations/models/selectors';

function KpiCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100">{value}</p>
    </div>
  );
}

export default function ModelKpis({ models }: { models: AiModel[] }) {
  const available = models.filter((m) => m.status === 'available').length;
  const local = models.filter((m) => m.hostingType === 'local').length;
  const cloud = models.filter((m) => m.hostingType === 'cloud').length;
  const degraded = models.filter((m) => m.status === 'degraded').length;
  const fallbacks = models.filter((m) => m.fallbackModelId !== null).length;
  const agentsUsing = countAgentsUsingModels(models);
  const costToday = models.reduce((sum, m) => {
    const providerCost = m.usage.estimatedProviderCost.startsWith('£') ? parseFloat(m.usage.estimatedProviderCost.slice(1)) : 0;
    const localCost = m.usage.localComputeEstimate.startsWith('£') ? parseFloat(m.usage.localComputeEstimate.slice(1)) : 0;
    return sum + providerCost + localCost;
  }, 0);

  const cards = [
    { label: 'Total Models', value: models.length, icon: 'ri-cpu-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Available', value: available, icon: 'ri-checkbox-circle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Local Models', value: local, icon: 'ri-server-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Cloud Models', value: cloud, icon: 'ri-cloud-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Degraded', value: degraded, icon: 'ri-alert-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Agents Using Models', value: agentsUsing, icon: 'ri-robot-2-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Estimated Cost Today', value: `£${costToday.toFixed(2)}`, icon: 'ri-money-pound-circle-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Fallbacks Configured', value: fallbacks, icon: 'ri-shuffle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
  ];

  return (
    <section aria-label="Model KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}