import { Link } from 'react-router-dom';
import type { AiApproval, ApprovalDecisionType } from '@/pages/ai-operations/types';
import { APPROVAL_STATUS, RISK_CLASS, RISK_LEVEL, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface ApprovalHeaderProps {
  approval: AiApproval;
  onDecision: (type: ApprovalDecisionType) => void;
  onEdit: () => void;
}

export default function ApprovalHeader({ approval, onDecision, onEdit }: ApprovalHeaderProps) {
  const status = APPROVAL_STATUS[approval.status];
  const riskClass = RISK_CLASS[approval.riskClass];
  const severity = RISK_LEVEL[approval.severity];

  const decisionable = ['pending', 'under_review', 'more_info_required'].includes(approval.status);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/approvals" className="hover:text-foreground-200 transition-colors cursor-pointer">Approvals</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{approval.id}</span>
      </nav>

      {/* Title + badges */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{approval.title}</h1>
            <StatusPill tone={status.tone} label={status.label} pulse={approval.status === 'under_review'} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={riskClass.tone} label={`${riskClass.label} risk`} />
            <StatusPill tone={severity.tone} label={`${severity.label} severity`} />
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center"></i>
              {ENVIRONMENT_LABELS[approval.environment]}
            </span>
            <span className="text-xs font-mono text-foreground-500">{approval.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {approval.siteId !== 'group' && (
            <Link
              to={`/ai-operations/sites/${approval.siteId}`}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Open Site
            </Link>
          )}
          {approval.agentId && (
            <Link
              to={`/ai-operations/agents/${approval.agentId}`}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-robot-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Open Agent
            </Link>
          )}
          {approval.runId && (
            <Link
              to={`/ai-operations/runs/${approval.runId}`}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-list-check-3 text-sm w-4 h-4 flex items-center justify-center"></i>
              Open Run
            </Link>
          )}
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Edit
          </button>
        </div>
      </div>

      {/* Decision actions */}
      {decisionable && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onDecision('approve')}
                className="inline-flex items-center gap-1.5 text-xs font-label bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-md px-3 py-2 hover:bg-emerald-500/25 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Approve
              </button>
              <button
                onClick={() => onDecision('approve_with_conditions')}
                className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500/15 text-accent-400 border border-accent-500/25 rounded-md px-3 py-2 hover:bg-accent-500/25 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-check-double-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Approve With Conditions
              </button>
              <button
                onClick={() => onDecision('reject')}
                className="inline-flex items-center gap-1.5 text-xs font-label bg-red-500/15 text-red-400 border border-red-500/25 rounded-md px-3 py-2 hover:bg-red-500/25 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Reject
              </button>
              <button
                onClick={() => onDecision('request_changes')}
                className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-200/50 border border-background-300/40 rounded-md px-3 py-2 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Request Changes
              </button>
              <button
                onClick={() => onDecision('request_more_information')}
                className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-200/50 border border-background-300/40 rounded-md px-3 py-2 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-question-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Request More Information
              </button>
            </div>
          </div>
          <p className="text-[11px] font-label text-foreground-600 mt-2.5">
            Approval decisions update registry state only — execution runtime is not connected.
          </p>
        </div>
      )}
    </div>
  );
}