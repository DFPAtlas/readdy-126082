import type { NotificationRule } from '@/pages/ai-operations/types';

export default function SuppressionDedup({ rule }: { rule: NotificationRule }) {
  const s = rule.suppression;

  const rows: { label: string; value: string }[] = [
    { label: 'Duplicate Window', value: s.duplicateWindow },
    { label: 'Suppression Condition', value: s.suppressionCondition },
    { label: 'Quiet-hours Rule', value: s.quietHours },
    { label: 'Maintenance-mode Handling', value: s.maintenanceHandling },
    { label: 'Repeat-event Handling', value: s.repeatHandling },
    { label: 'Deduplication Enabled', value: rule.deduplicationEnabled ? 'Yes' : 'No' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Suppression &amp; Deduplication</h3>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{r.label}</span>
            <span className="text-sm text-foreground-300">{r.value}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Quiet-hours Behaviour</span>
          <span className="text-sm text-foreground-300">{rule.quietHoursBehaviour}</span>
        </div>
      </div>
    </section>
  );
}