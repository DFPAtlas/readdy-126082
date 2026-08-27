import { Link } from 'react-router-dom';
import type { AiAuditEvent } from '@/pages/ai-operations/types';
import { RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Flag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30 last:border-0">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-label ${value ? 'text-amber-400' : 'text-foreground-600'}`}>{value ? 'Yes' : 'No'}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30 last:border-0">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function DecisionGovernance({ event }: { event: AiAuditEvent }) {
  const g = event.governance;
  const risk = RISK_CLASS[g.riskClassification];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Decision &amp; Governance</h4>
        {event.policyId && (
          <Link
            to={`/ai-operations/security/policies/${event.policyId}`}
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Policy
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        )}
      </div>
      <div className="px-4 py-2">
        <Row label="Policy evaluated" value={g.policyEvaluated} />
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Risk classification</span>
          <StatusPill tone={risk.tone} label={risk.label} />
        </div>
        <Flag label="Approval required" value={g.approvalRequired} />
        <Row label="Approval decision" value={g.approvalDecision} />
        <Row label="Decision actor / team" value={g.decisionActor} />
        <Flag label="Separation of duties" value={g.separationOfDuties} />
        <Flag label="Override used" value={g.overrideUsed} />
        <Row label="Reason" value={g.reason} />
      </div>
    </section>
  );
}