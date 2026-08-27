import { Link } from 'react-router-dom';
import type { AiApproval } from '@/pages/ai-operations/types';
import { APPROVAL_STATUS, RISK_CLASS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function approversLabel(a: AiApproval): string {
  return `${a.approvalCount} / ${a.minApprovers}`;
}

export default function ApprovalsTable({ approvals }: { approvals: AiApproval[] }) {
  if (approvals.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
        <i className="ri-shield-check-line text-3xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
        <p className="text-sm text-foreground-500 mt-3">No approvals match the current filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block bg-background-100 border border-background-200/60 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Approval ID</th>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Approvers</th>
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => {
                const status = APPROVAL_STATUS[a.status];
                const riskClass = RISK_CLASS[a.riskClass];
                const severity = RISK_LEVEL[a.severity];
                return (
                  <tr key={a.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-mono text-xs text-accent-400 whitespace-nowrap">{a.id}</td>
                    <td className="px-4 py-3 text-foreground-300 max-w-[220px] truncate" title={a.title}>{a.title}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{a.siteName}</td>
                    <td className="px-4 py-3 text-foreground-400 max-w-[170px] truncate" title={a.agentName}>{a.agentName}</td>
                    <td className="px-4 py-3"><StatusPill tone={riskClass.tone} label={riskClass.label} /></td>
                    <td className="px-4 py-3"><StatusPill tone={severity.tone} label={severity.label} /></td>
                    <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} pulse={a.status === 'under_review'} /></td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{a.requestedAt.replace('2026-08-25 · ', '')}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{a.expiryState === 'no_expiry' ? '—' : a.expiryTime.replace('2026-08-26 · ', '')}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{approversLabel(a)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground-500 whitespace-nowrap">{a.runId ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/ai-operations/approvals/${a.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 hover:text-foreground-50 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden grid grid-cols-1 gap-3">
        {approvals.map((a) => {
          const status = APPROVAL_STATUS[a.status];
          const riskClass = RISK_CLASS[a.riskClass];
          const severity = RISK_LEVEL[a.severity];
          return (
            <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-accent-400">{a.id}</span>
                    <StatusPill tone={status.tone} label={status.label} pulse={a.status === 'under_review'} />
                  </div>
                  <p className="text-sm font-medium text-foreground-100 mt-1.5">{a.title}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{a.siteName} · {a.agentName}</p>
                </div>
                <Link
                  to={`/ai-operations/approvals/${a.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 hover:text-foreground-50 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  Open
                </Link>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill tone={riskClass.tone} label={riskClass.label} />
                <StatusPill tone={severity.tone} label={severity.label} />
                <span className="text-xs text-foreground-500">Approvers {approversLabel(a)}</span>
              </div>
              <p className="text-xs text-foreground-600">Run {a.runId ?? '—'} · {a.expiryState === 'no_expiry' ? 'No expiry' : `Expires ${a.expiryTime}`}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}