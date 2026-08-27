import { Link } from 'react-router-dom';
import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import { RISK_CLASS, SEVERITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ReviewQueue() {
  const { reviewQueue, getEvent } = useAudit();
  const items = reviewQueue;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Audit Review Queue</h3>
        <span className="text-[11px] font-label text-foreground-600">{items.length} records</span>
      </div>

      <div className="divide-y divide-background-200/40">
        {items.map((item) => {
          const event = getEvent(item.auditId);
          const risk = RISK_CLASS[item.risk];
          const severity = SEVERITY[item.severity];
          return (
            <div key={item.auditId} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {event && (
                    <Link to={`/ai-operations/audit/${item.auditId}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {event.action}
                    </Link>
                  )}
                  <span className="font-mono text-xs text-accent-400">{item.auditId}</span>
                </div>
                <p className="text-xs font-label text-foreground-500 mt-1">{item.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <StatusPill tone={severity.tone} label={severity.label} />
                <StatusPill tone={risk.tone} label={risk.label} />
                <Link
                  to={`/ai-operations/audit/${item.auditId}`}
                  className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Review
                  <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}