import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { NOTIFICATION_CHANNEL_LABELS } from '@/pages/ai-operations/constants';
import { getRuleById } from '@/pages/ai-operations/notifications/selectors';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function NotificationEscalation({ schedule }: { schedule: AiSchedule }) {
  const rule = schedule.notificationRuleId ? getRuleById(schedule.notificationRuleId) : undefined;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Notification &amp; Escalation</h3>
        {rule && (
          <Link
            to={`/ai-operations/notifications/rules/${rule.id}`}
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Rule
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        )}
      </div>
      <div className="p-4">
        {!rule ? (
          <p className="text-sm text-foreground-500">No notification rule is linked to this schedule.</p>
        ) : (
          <>
            <Row label="Rule ID" value={rule.id} />
            <Row label="Rule name" value={rule.name} />
            <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40">
              <span className="text-xs font-label text-foreground-500 whitespace-nowrap">Channels</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {rule.channels.map((c) => (
                  <span key={c} className="text-[10px] font-label text-foreground-400 bg-background-50 border border-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                    {NOTIFICATION_CHANNEL_LABELS[c]}
                  </span>
                ))}
              </div>
            </div>
            <Row label="Recipient team" value={rule.initialTeam} />
            <Row label="Acknowledgement" value={rule.acknowledgementRequired ? `Required (${rule.acknowledgementDeadline})` : 'Not required'} />
            <div className="pt-3">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5">Escalation path</p>
              <div className="space-y-1.5">
                {rule.escalationPath.map((step) => (
                  <div key={step.level} className="flex items-center gap-2 text-xs text-foreground-300">
                    <span className="font-mono text-foreground-500">L{step.level}</span>
                    <span className="text-foreground-600">→</span>
                    <span>{step.team}</span>
                    <span className="text-foreground-600">({step.delay})</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}