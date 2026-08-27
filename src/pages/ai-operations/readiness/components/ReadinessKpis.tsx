import { readinessModules } from '@/mocks/ai-operations-readiness';
import { databasePlan } from '@/mocks/ai-operations-readiness';
import { integrationPlan } from '@/mocks/ai-operations-readiness';
import { securityGates } from '@/mocks/ai-operations-readiness-2';

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

export default function ReadinessKpis() {
  const modulesAudited = readinessModules.length;
  const readyForData = readinessModules.filter((m) => m.overall === 'ready' || m.dataContract === 'complete').length;
  const integrationRequired = integrationPlan.filter((i) => i.status !== 'complete').length;
  const databaseRequired = databasePlan.filter((d) => d.state === 'not_started').length;
  const securityReview = securityGates.filter((g) => g.state !== 'pass').length;
  const blocked = securityGates.filter((g) => g.state === 'blocked').length;
  const productionEnabled = 0;
  const overallCompletion = 0;

  const cards = [
    { label: 'Modules Audited', value: modulesAudited, icon: 'ri-stack-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Ready for Data Connection', value: readyForData, icon: 'ri-database-2-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Integration Required', value: integrationRequired, icon: 'ri-plug-2-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Database Required', value: databaseRequired, icon: 'ri-table-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Security Review Required', value: securityReview, icon: 'ri-shield-keyhole-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Blocked', value: blocked, icon: 'ri-forbid-2-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Production Enabled', value: productionEnabled, icon: 'ri-toggle-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Overall Completion', value: `${overallCompletion}%`, icon: 'ri-percent-line', accent: 'bg-accent-500/10 text-accent-400' },
  ];

  return (
    <section aria-label="Readiness KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}