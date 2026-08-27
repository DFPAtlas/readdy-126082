import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';
import { SEVERITY, ALERT_STATUS, ALERT_TYPE_LABELS } from '@/pages/ai-operations/constants';
import { priorityReason } from '@/pages/ai-operations/alerts/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PriorityIncidents({ alerts }: { alerts: AiAlert[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Priority Incidents</h3>
        <span className="text-[11px] font-label text-red-400">{alerts.length} prioritised</span>
      </div>

      <div className="divide-y divide-background-200/40">
        {alerts.map((a) => {
          const sev = SEVERITY[a.severity];
          const status = ALERT_STATUS[a.status];
          return (
            <Link
              key={a.id}
              to={`/ai-operations/alerts/${a.id}`}
              className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill tone={sev.tone} label={sev.label} />
                  <span className="text-sm font-medium text-foreground-100">{a.title}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] font-label text-foreground-500">
                  <span>{a.siteName}</span>
                  <span className="text-foreground-600">&middot;</span>
                  <span>{ALERT_TYPE_LABELS[a.type]}</span>
                  <span className="text-foreground-600">&middot;</span>
                  <span className="text-amber-400">{priorityReason(a)}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <StatusPill tone={status.tone} label={status.label} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}