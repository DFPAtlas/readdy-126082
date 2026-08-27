import type { NotificationRule } from '@/pages/ai-operations/types';
import { SEVERITY, RISK_CLASS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Trigger({ rule }: { rule: NotificationRule }) {
  const sev = SEVERITY[rule.severityThreshold];
  const risk = RISK_CLASS[rule.riskThreshold];

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Source System', value: rule.eventSource },
    { label: 'Event Type', value: rule.eventType },
    { label: 'Site', value: rule.siteName },
    { label: 'Agent', value: rule.agentId || 'Any' },
    { label: 'Environment', value: ENVIRONMENT_LABELS[rule.environment] },
    { label: 'Severity Threshold', value: <StatusPill tone={sev.tone} label={sev.label} /> },
    { label: 'Risk Threshold', value: <StatusPill tone={risk.tone} label={risk.label} /> },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Trigger</h3>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{r.label}</span>
            <span className="text-sm text-foreground-100">{r.value}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Matching Conditions</span>
          <span className="text-sm text-foreground-300">
            Events from {rule.eventSource} of type “{rule.eventType}” at or above {sev.label} severity (risk {risk.label}) in {ENVIRONMENT_LABELS[rule.environment]}.
          </span>
        </div>
      </div>
    </section>
  );
}