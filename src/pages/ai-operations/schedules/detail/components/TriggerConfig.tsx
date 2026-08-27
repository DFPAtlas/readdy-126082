import type { AiSchedule } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function TriggerConfig({ schedule }: { schedule: AiSchedule }) {
  const t = schedule.trigger;
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Trigger Configuration</h3>
      </div>
      <div className="p-4">
        <Row label="Trigger type" value={schedule.triggerType} />
        <Row label="Time schedule" value={t.expressionSummary} />
        <Row label="Recurrence" value={t.recurrence} />
        <Row label="Event source" value={t.eventSource} />
        <Row label="Condition" value={t.condition} />
        <Row label="Manual trigger" value={t.manual} />
        <Row label="Timezone" value={schedule.timezone} />
        <div className="pt-3">
          <p className="text-[11px] font-label text-foreground-600">
            Trigger metadata is display-only — raw cron editing and live scheduling are not connected.
          </p>
        </div>
      </div>
    </section>
  );
}