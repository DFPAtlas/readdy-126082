import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';
import { SEVERITY, ALERT_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

// Reusable banner linking a related record (run, orchestration, etc.) to its
// matching central incident. Reads derived alert data — no duplication.
export default function OpenIncident({ alert }: { alert: AiAlert }) {
  const sev = SEVERITY[alert.severity];
  const status = ALERT_STATUS[alert.status];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-label text-foreground-500 uppercase tracking-wide">Related Incident</span>
            <StatusPill tone={sev.tone} label={sev.label} />
            <StatusPill tone={status.tone} label={status.label} />
          </div>
          <p className="text-sm font-medium text-foreground-100 mt-1.5">{alert.title}</p>
          <p className="text-xs font-label text-foreground-500 mt-1">
            {alert.siteName} · <span className="font-mono">{alert.id}</span>
          </p>
        </div>
        <Link
          to={`/ai-operations/alerts/${alert.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-2 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          Open Incident
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </Link>
      </div>
    </section>
  );
}