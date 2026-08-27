import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { APPROVAL_STATUS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function HumanApprovalGate({ orchestration }: { orchestration: AiOrchestration }) {
  const g = orchestration.approvalGate;

  if (!orchestration.approvalRequired && !g.approvalId) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Human Approval Gate</h3>
        <div className="flex items-center gap-2">
          <StatusPill tone="secondary" label="Not Required" />
          <p className="text-sm text-foreground-500">This orchestration does not require human approval.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Human Approval Gate</h3>
        {g.approvalId && (
          <Link
            to={`/ai-operations/approvals/${g.approvalId}`}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Approval
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        )}
      </div>

      {g.blocking && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <i className="ri-pause-circle-line text-amber-400 w-5 h-5 flex items-center justify-center"></i>
          <p className="text-sm text-amber-300">Workflow stopped — awaiting human approval before execution.</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Approval ID</p>
          <p className="text-sm text-foreground-300 mt-0.5">{g.approvalId ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Status</p>
          <div className="mt-1"><StatusPill tone={APPROVAL_STATUS[g.status].tone} label={APPROVAL_STATUS[g.status].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Risk</p>
          <div className="mt-1"><StatusPill tone={RISK_LEVEL[g.risk].tone} label={RISK_LEVEL[g.risk].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Required team</p>
          <p className="text-sm text-foreground-300 mt-0.5">{g.requiredTeam || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Approvers</p>
          <p className="text-sm text-foreground-300 mt-0.5">
            Required {g.minApprovers} · Current {g.currentApprovals}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Expiry</p>
          <p className="text-sm text-foreground-300 mt-0.5">{g.expiry}</p>
        </div>
      </div>
    </section>
  );
}