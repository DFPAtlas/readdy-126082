import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';
import { RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Flag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30 last:border-0">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-label ${value ? 'text-amber-400' : 'text-foreground-600'}`}>{value ? 'Required' : 'Not required'}</span>
    </div>
  );
}

export default function Governance({ alert }: { alert: AiAlert }) {
  const g = alert.governance;
  const risk = RISK_CLASS[g.risk];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Governance</h4>
        {g.policyId && (
          <Link
            to={`/ai-operations/security/policies/${g.policyId}`}
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Policy
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        )}
      </div>
      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Policy matched</span>
          <span className="text-sm text-foreground-100 text-right">{g.policyName}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Risk</span>
          <StatusPill tone={risk.tone} label={risk.label} />
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Minimum approvers</span>
          <span className="text-sm text-foreground-100">{g.minApprovers}</span>
        </div>
        <Flag label="Approval required" value={g.approvalRequired} />
        <Flag label="Verification required" value={g.verificationRequired} />
        <Flag label="UAT required" value={g.uatRequired} />
        <Flag label="Audit required" value={g.auditRequired} />
      </div>
    </section>
  );
}