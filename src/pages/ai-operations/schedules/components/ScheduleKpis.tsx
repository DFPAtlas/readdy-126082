import type { AiSchedule } from '@/pages/ai-operations/types';

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

export default function ScheduleKpis({ schedules, eventRuleCount }: { schedules: AiSchedule[]; eventRuleCount: number }) {
  const active = schedules.filter((s) => s.status === 'active').length;
  const dueToday = schedules.filter((s) => s.nextRun.startsWith('2026-08-26')).length;
  const running = schedules.filter((s) => s.status === 'running').length;
  const failedLast = schedules.filter((s) => s.lastRunStatus === 'failed').length;
  const paused = schedules.filter((s) => s.status === 'paused').length;
  const awaiting = schedules.filter((s) => s.approvalRequired && s.status !== 'draft' && s.status !== 'disabled' && s.status !== 'expired').length;
  const review = schedules.filter((s) => s.status === 'review_required' || s.status === 'draft').length;

  const cards = [
    { label: 'Active Schedules', value: active, icon: 'ri-calendar-check-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Due Today', value: dueToday, icon: 'ri-time-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Running Now', value: running, icon: 'ri-loader-4-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Failed Last Run', value: failedLast, icon: 'ri-close-circle-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Paused', value: paused, icon: 'ri-pause-circle-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Awaiting Approval', value: awaiting, icon: 'ri-shield-check-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Event-Triggered Rules', value: eventRuleCount, icon: 'ri-flashlight-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Reviews Required', value: review, icon: 'ri-file-list-3-line', accent: 'bg-amber-500/10 text-amber-400' },
  ];

  return (
    <section aria-label="Schedule KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}