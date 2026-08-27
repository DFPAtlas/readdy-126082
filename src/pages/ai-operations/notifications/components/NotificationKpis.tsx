import type { NotificationRule, NotificationEvent } from '@/pages/ai-operations/types';

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

export default function NotificationKpis({ rules, events }: { rules: NotificationRule[]; events: NotificationEvent[] }) {
  const active = rules.filter((r) => r.status === 'active').length;
  const today = events.filter((e) => e.time.startsWith('2026-08-25')).length;
  const critical = events.filter((e) => e.priority === 'critical').length;
  const awaiting = events.filter((e) => e.acknowledgement === 'awaiting').length;
  const escalated = events.filter((e) => e.status === 'escalated').length;
  const failed = events.filter((e) => e.status === 'failed').length;
  const suppressed = events.filter((e) => e.status === 'suppressed').length;
  const review = rules.filter((r) => r.status === 'review_required' || r.status === 'draft').length;

  const cards = [
    { label: 'Active Rules', value: active, icon: 'ri-notification-3-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Notifications Today', value: today, icon: 'ri-message-3-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Critical Notifications', value: critical, icon: 'ri-alert-fill', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Awaiting Acknowledgement', value: awaiting, icon: 'ri-time-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Escalated', value: escalated, icon: 'ri-arrow-up-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Failed Deliveries', value: failed, icon: 'ri-close-circle-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Suppressed', value: suppressed, icon: 'ri-forbid-2-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Rules Requiring Review', value: review, icon: 'ri-file-list-3-line', accent: 'bg-amber-500/10 text-amber-400' },
  ];

  return (
    <section aria-label="Notification KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}