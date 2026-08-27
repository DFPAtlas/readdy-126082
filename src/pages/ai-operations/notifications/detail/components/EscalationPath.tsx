import type { NotificationRule } from '@/pages/ai-operations/types';
import { NOTIFICATION_CHANNEL_LABELS } from '@/pages/ai-operations/constants';

const LEVEL_LABELS: Record<number, string> = {
  0: 'Initial Notification',
  1: 'Team Escalation',
  2: 'Technical / Security Escalation',
  3: 'Management Escalation',
  4: 'Critical Incident',
};

export default function EscalationPath({ rule }: { rule: NotificationRule }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Escalation Path</h3>
      </div>
      <div className="p-4 space-y-3">
        {rule.escalationPath.map((step) => (
          <div key={step.level} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-label font-semibold ${step.level >= rule.maxEscalationLevel ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'bg-accent-500/10 text-accent-400 border border-accent-500/25'}`}>
                {step.level}
              </div>
              {step.level < rule.escalationPath.length - 1 && <div className="w-px flex-1 bg-background-300/40 my-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-label font-semibold text-foreground-100">{step.team}</span>
                <span className="text-[10px] font-label text-foreground-500 bg-background-50 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
                  {LEVEL_LABELS[step.level]}
                </span>
              </div>
              <p className="text-xs text-foreground-400 mt-1">Trigger: {step.trigger}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-label text-foreground-500 flex-wrap">
                <span>Delay: {step.delay}</span>
                <span>·</span>
                <span>Channel: {NOTIFICATION_CHANNEL_LABELS[step.channel]}</span>
                <span>·</span>
                <span>Ack: {step.acknowledgementRequired ? 'Required' : 'Not required'}</span>
              </div>
            </div>
          </div>
        ))}

        <div className="pt-3 border-t border-background-200/60">
          <p className="text-[11px] font-label text-foreground-600">
            Maximum escalation level: {rule.maxEscalationLevel} ({LEVEL_LABELS[rule.maxEscalationLevel] || '—'}). Escalation delay base: {rule.escalationDelay}.
          </p>
          <p className="text-[11px] font-label text-foreground-600 mt-1">
            No notification is sent — this path is metadata only.
          </p>
        </div>
      </div>
    </section>
  );
}