import { Link } from 'react-router-dom';
import type { AiAuditEvent } from '@/pages/ai-operations/types';
import { AUDIT_OUTCOME, RISK_CLASS, AUDIT_EVENT_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

// Shared compact "Recent Audit Events" panel used by Runs, Approvals,
// Orchestrator, Tools, Models and Knowledge detail pages. Reads derived audit
// events — no audit data duplicated.
export default function RecentAuditEvents({
  title,
  events,
  emptyMessage,
}: {
  title: string;
  events: AiAuditEvent[];
  emptyMessage: string;
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
        <Link
          to="/ai-operations/audit"
          className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          Audit Registry
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {events.map((e) => {
            const outcome = AUDIT_OUTCOME[e.outcome];
            const risk = RISK_CLASS[e.risk];
            return (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className="min-w-0">
                  <Link to={`/ai-operations/audit/${e.id}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                    {e.action}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">{e.timestamp}</span>
                    <span className="text-[10px] font-label text-foreground-600">{AUDIT_EVENT_TYPE_LABELS[e.eventType]}</span>
                    <span className="font-mono text-[10px] text-accent-400">{e.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill tone={outcome.tone} label={outcome.label} />
                  <StatusPill tone={risk.tone} label={risk.label} />
                  <Link
                    to={`/ai-operations/audit/${e.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Open
                    <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}