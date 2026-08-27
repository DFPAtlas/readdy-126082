import type { NotificationRule } from '@/pages/ai-operations/types';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_PRIORITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function NotificationRouting({ rule }: { rule: NotificationRule }) {
  const prio = NOTIFICATION_PRIORITY[rule.priority];

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Initial Team', value: rule.initialTeam },
    {
      label: 'Channels',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {rule.channels.map((c) => (
            <span key={c} className="text-[11px] font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded px-2 py-0.5 whitespace-nowrap">
              {NOTIFICATION_CHANNEL_LABELS[c]}
            </span>
          ))}
        </div>
      ),
    },
    { label: 'Priority', value: <StatusPill tone={prio.tone} label={prio.label} /> },
    { label: 'Acknowledgement Required', value: rule.acknowledgementRequired ? 'Yes' : 'No' },
    { label: 'Acknowledgement Deadline', value: rule.acknowledgementDeadline },
    { label: 'Repeat Interval', value: rule.repeatInterval },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Notification Routing</h3>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{r.label}</span>
            <span className="text-sm text-foreground-100">{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}