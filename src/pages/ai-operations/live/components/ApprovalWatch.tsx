import { Link } from 'react-router-dom';
import { getApprovalWatch } from '@/pages/ai-operations/live/selectors';
import { APPROVAL_STATUS, RISK_CLASS, RISK_LEVEL, EXPIRY_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ApprovalWatch() {
  const approvals = getApprovalWatch();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Approval Watch</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          {approvals.length} awaiting
        </span>
      </div>

      <div className="divide-y divide-background-200/40 max-h-[440px] overflow-y-auto">
        {approvals.map((a) => {
          const status = APPROVAL_STATUS[a.status];
          const riskClass = RISK_CLASS[a.riskClass];
          const severity = RISK_LEVEL[a.severity];
          const expiry = EXPIRY_STATE[a.expiryState];
          return (
            <div key={a.id} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground-200">{a.siteName}</span>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-400">{a.agentName}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5 line-clamp-1">{a.requestedAction}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <StatusPill tone={status.tone} label={status.label} />
                    <StatusPill tone={riskClass.tone} label={riskClass.label} />
                    <StatusPill tone={severity.tone} label={severity.label} />
                    {a.expiryState === 'expiring_soon' && <StatusPill tone={expiry.tone} label={expiry.label} />}
                  </div>
                  <p className="text-[10px] font-label text-foreground-600 mt-1.5">
                    {a.id} · {a.runId ? `Run ${a.runId}` : 'No run'} · Approvers {a.approvalCount}/{a.minApprovers}
                  </p>
                </div>
                <Link
                  to={`/ai-operations/approvals/${a.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Open Review
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}