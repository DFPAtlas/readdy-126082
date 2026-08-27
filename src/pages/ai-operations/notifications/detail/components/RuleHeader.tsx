import { Link } from 'react-router-dom';
import type { NotificationRule } from '@/pages/ai-operations/types';
import { SEVERITY, NOTIFICATION_PRIORITY, NOTIFICATION_RULE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RuleHeader({ rule }: { rule: NotificationRule }) {
  const sev = SEVERITY[rule.severityThreshold];
  const prio = NOTIFICATION_PRIORITY[rule.priority];
  const status = NOTIFICATION_RULE_STATUS[rule.status];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/notifications" className="hover:text-foreground-200 transition-colors cursor-pointer">Notifications &amp; Escalations</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{rule.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{rule.name}</h1>
            <StatusPill tone={sev.tone} label={sev.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={status.tone} label={status.label} />
            <StatusPill tone={prio.tone} label={prio.label} />
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            <span className="font-mono">{rule.id}</span> · {rule.eventSource} · {rule.siteName}
          </p>
          <p className="text-sm text-foreground-400 mt-2 max-w-2xl">{rule.description}</p>
        </div>
      </div>
    </div>
  );
}