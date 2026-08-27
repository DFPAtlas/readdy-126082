import { Link } from 'react-router-dom';
import type { AiAuditEvent } from '@/pages/ai-operations/types';
import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_OUTCOME,
  SEVERITY,
  RISK_CLASS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AuditHeader({ event }: { event: AiAuditEvent }) {
  const outcome = AUDIT_OUTCOME[event.outcome];
  const severity = SEVERITY[event.severity];
  const risk = RISK_CLASS[event.risk];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/audit" className="hover:text-foreground-200 transition-colors cursor-pointer">Audit &amp; Evidence</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{event.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{event.action}</h1>
            <StatusPill tone={outcome.tone} label={outcome.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={severity.tone} label={severity.label} />
            <StatusPill tone={risk.tone} label={`${risk.label} risk`} />
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            {AUDIT_EVENT_TYPE_LABELS[event.eventType]} · {event.siteName} · {event.agentName || event.actorTeam} · <span className="font-mono">{event.id}</span>
          </p>
          <p className="text-xs font-label text-foreground-600 mt-1">Recorded {event.timestamp}</p>
        </div>
      </div>
    </div>
  );
}