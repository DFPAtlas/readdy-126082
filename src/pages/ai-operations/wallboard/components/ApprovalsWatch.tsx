import { Link } from 'react-router-dom';
import { getWallboardApprovals } from '@/pages/ai-operations/wallboard/selectors';
import { RISK_CLASS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ApprovalsWatch() {
  const approvals = getWallboardApprovals(5);

  return (
    <section className="h-full bg-background-100 border border-amber-500/20 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Awaiting Human Approval</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          {approvals.length}
        </span>
      </div>

      <div className="divide-y divide-background-200/40 overflow-y-auto">
        {approvals.map((a) => {
          const riskClass = RISK_CLASS[a.riskClass];
          const severity = RISK_LEVEL[a.severity];
          return (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{a.siteName}</span>
                  <span className="text-foreground-600">&middot;</span>
                  <span className="text-xs text-foreground-400 whitespace-nowrap">{a.agentName}</span>
                </div>
                <p className="text-sm text-foreground-200 mt-0.5 line-clamp-1">{a.requestedAction}</p>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <StatusPill tone={riskClass.tone} label={riskClass.label} />
                  <StatusPill tone={severity.tone} label={severity.label} />
                </div>
              </div>
              <Link
                to={`/ai-operations/approvals/${a.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
              >
                Review
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}