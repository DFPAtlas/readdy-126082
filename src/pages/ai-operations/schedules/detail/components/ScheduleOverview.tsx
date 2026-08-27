import type { AiSchedule } from '@/pages/ai-operations/types';
import { AUTOMATION_TYPE_LABELS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function ScheduleOverview({ schedule }: { schedule: AiSchedule }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Schedule Overview</h3>
      </div>
      <div className="p-4">
        <Row label="Description" value={schedule.description} />
        <Row label="Automation type" value={AUTOMATION_TYPE_LABELS[schedule.automationType]} />
        <Row label="Environment" value={ENVIRONMENT_LABELS[schedule.environment]} />
        <Row label="Owner / team" value={schedule.ownerTeam} />
        <Row label="Start date" value={schedule.startDate} />
        <Row label="End date" value={schedule.endDate} />
        <Row label="Review date" value={schedule.reviewDate} />
        <Row label="Last run" value={schedule.lastRun} />
        <Row label="Next run" value={schedule.nextRun} />
      </div>
    </section>
  );
}