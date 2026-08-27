import { Link } from 'react-router-dom';
import type { AiApproval } from '@/pages/ai-operations/types';
import { APPROVAL_STATUS, RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

// Surfaces approvals that need attention first: critical severity, high-risk
// class, near expiry, or a critical task/run context.
function reasonOf(a: AiApproval): string {
  const reasons: string[] = [];
  if (a.severity === 'critical') reasons.push('Critical severity');
  if (a.riskClass === 'red') reasons.push('High-risk action');
  if (a.expiryState === 'expiring_soon') reasons.push('Near expiry');
  if (a.requestType === 'deployment') reasons.push('Blocking production run');
  if (a.requestType === 'repair') reasons.push('Blocking support repair');
  if (a.requestType === 'uat' || a.uatRequired) reasons.push('Blocking UAT completion');
  return reasons.length ? reasons.join(' · ') : 'Pending review';
}

export default function PriorityReviews({ approvals }: { approvals: AiApproval[] }) {
  const priority = approvals
    .filter((a) => ['pending', 'under_review', 'more_info_required'].includes(a.status))
    .filter((a) => a.severity === 'critical' || a.riskClass === 'red' || a.expiryState === 'expiring_soon')
    .slice(0, 6);

  if (priority.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
        <p className="text-sm text-foreground-500">No priority reviews pending.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {priority.map((a) => {
        const status = APPROVAL_STATUS[a.status];
        const riskClass = RISK_CLASS[a.riskClass];
        return (
          <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-accent-400">{a.id}</span>
                <StatusPill tone={riskClass.tone} label={riskClass.label} />
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <p className="text-sm font-medium text-foreground-100 mt-2">{a.title}</p>
              <p className="text-xs text-foreground-500 mt-1">{a.siteName} · {a.agentName}</p>
              <p className="text-[11px] font-label text-amber-400 mt-1.5">{reasonOf(a)}</p>
            </div>
            <Link
              to={`/ai-operations/approvals/${a.id}`}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 hover:text-foreground-50 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Review
            </Link>
          </div>
        );
      })}
    </div>
  );
}