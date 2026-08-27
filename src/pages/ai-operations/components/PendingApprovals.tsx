import { Link } from 'react-router-dom';
import type { ApprovalRequest } from '@/pages/ai-operations/types';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PendingApprovals({ approvals }: { approvals: ApprovalRequest[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Pending AI Approvals</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          {approvals.length} awaiting review
        </span>
      </div>

      <div className="divide-y divide-background-200/40">
        {approvals.map((a) => {
          const risk = RISK_LEVEL[a.risk];
          return (
            <div key={a.id} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground-200">{a.site}</span>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-400">{a.agent}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5">{a.action}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-1">{a.dateTime} &middot; {a.id}</p>
                </div>
                <StatusPill tone={risk.tone} label={risk.label} />
              </div>
              <div className="mt-2.5">
                <Link
                  to={`/ai-operations/approvals/${a.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-200/50 border border-background-300/40 rounded-md px-2.5 py-1.5 hover:text-foreground-50 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line w-4 h-4 flex items-center justify-center"></i>
                  View Review
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}