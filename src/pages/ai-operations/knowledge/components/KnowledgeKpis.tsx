import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { countAgentsWithKnowledgeAccess } from '@/pages/ai-operations/knowledge/selectors';

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

export default function KnowledgeKpis({ sources }: { sources: KnowledgeSource[] }) {
  const active = sources.filter((s) => s.status === 'active').length;
  const group = sources.filter((s) => s.scope === 'group').length;
  const site = sources.filter((s) => s.scope === 'site').length;
  const reviewRequired = sources.filter((s) => s.status === 'review_required' || s.reviewState === 'due_soon' || s.reviewState === 'overdue').length;
  const stale = sources.filter((s) => s.status === 'stale').length;
  const restricted = sources.filter((s) => s.classification === 'restricted' || s.status === 'restricted').length;
  const agentsWithAccess = countAgentsWithKnowledgeAccess();

  const cards = [
    { label: 'Knowledge Sources', value: sources.length, icon: 'ri-book-2-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Active Sources', value: active, icon: 'ri-checkbox-circle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Group Sources', value: group, icon: 'ri-global-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Site Sources', value: site, icon: 'ri-building-2-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Agents With Access', value: agentsWithAccess, icon: 'ri-robot-2-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Review Required', value: reviewRequired, icon: 'ri-calendar-check-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Stale Sources', value: stale, icon: 'ri-time-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Restricted Sources', value: restricted, icon: 'ri-lock-line', accent: 'bg-red-500/10 text-red-400' },
  ];

  return (
    <section aria-label="Knowledge KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}