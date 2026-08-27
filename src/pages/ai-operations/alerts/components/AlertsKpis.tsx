import type { AiAlert } from '@/pages/ai-operations/types';

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

export default function AlertsKpis({ alerts }: { alerts: AiAlert[] }) {
  const open = alerts.filter((a) => !['resolved', 'closed', 'suppressed'].includes(a.status));
  const critical = alerts.filter((a) => a.severity === 'critical' && !['resolved', 'closed'].includes(a.status)).length;
  const high = alerts.filter((a) => a.severity === 'high' && !['resolved', 'closed'].includes(a.status)).length;
  const investigating = alerts.filter((a) => a.status === 'investigating').length;
  const awaitingApproval = alerts.filter((a) => a.status === 'awaiting_approval').length;
  const repeating = alerts.filter((a) => a.repeating).length;
  const resolved = alerts.filter((a) => ['resolved', 'closed'].includes(a.status)).length;
  const escalated = alerts.filter((a) => a.status === 'escalated').length;

  const cards = [
    { label: 'Open Alerts', value: open.length, icon: 'ri-alert-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Critical', value: critical, icon: 'ri-alert-fill', accent: 'bg-red-500/10 text-red-400' },
    { label: 'High Priority', value: high, icon: 'ri-arrow-up-circle-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Investigating', value: investigating, icon: 'ri-search-eye-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Awaiting Approval', value: awaitingApproval, icon: 'ri-user-star-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Repeating Issues', value: repeating, icon: 'ri-loop-right-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Resolved Today', value: resolved, icon: 'ri-check-double-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Escalated', value: escalated, icon: 'ri-arrow-up-line', accent: 'bg-red-500/10 text-red-400' },
  ];

  return (
    <section aria-label="Alerts KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}