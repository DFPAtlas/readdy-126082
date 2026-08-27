import type { ApprovalRequirement, ApprovalSeparationOfDuties } from '@/pages/ai-operations/types';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';

function Row({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="inline-flex items-center gap-2 text-xs font-label text-foreground-600 whitespace-nowrap">
        <i className={`${icon} text-sm text-accent-400 w-4 h-4 flex items-center justify-center`}></i>
        {label}
      </span>
      <span className="text-sm text-foreground-200 text-right">{value}</span>
    </div>
  );
}

function DutyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-200 text-right">{value || '—'}</span>
    </div>
  );
}

export default function ApprovalRequirements({ requirement, separation }: { requirement: ApprovalRequirement; separation: ApprovalSeparationOfDuties }) {
  const remaining = Math.max(0, requirement.minApprovers - requirement.currentApprovals);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Approval Requirements</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
          <Row label="Required team" value={requirement.requiredTeam} icon="ri-team-line" />
          <Row label="Required role" value={requirement.requiredRole} icon="ri-user-star-line" />
          <Row label="Minimum approvers" value={String(requirement.minApprovers)} icon="ri-group-line" />
          <Row label="Current approvals" value={String(requirement.currentApprovals)} icon="ri-checkbox-circle-line" />
          {requirement.minApprovers > 1 && (
            <div className="mt-3 bg-background-200/40 border border-background-300/40 rounded-md p-3">
              <div className="flex items-center justify-between text-xs font-label text-foreground-400">
                <span>Required: {requirement.minApprovers}</span>
                <span>Approved: {requirement.currentApprovals}</span>
                <span>Remaining: {remaining}</span>
              </div>
            </div>
          )}
          <Row label="Maximum allowed risk" value={RISK_LEVEL[requirement.maxPermittedRisk].label} icon="ri-error-warning-line" />
          <Row label="Separation of duties required" value={requirement.separationOfDutiesRequired ? 'Yes' : 'No'} icon="ri-lock-line" />
          <Row label="Expiry time" value={requirement.expiry} icon="ri-timer-line" />
          <Row label="UAT required" value={requirement.uatRequired ? 'Yes' : 'No'} icon="ri-test-tube-line" />
          <Row label="Verification required" value={requirement.verificationRequired ? 'Yes' : 'No'} icon="ri-eye-line" />
          <Row label="Audit required" value={requirement.auditRequired ? 'Yes' : 'No'} icon="ri-file-list-3-line" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Separation of Duties</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
          <DutyRow label="Requesting agent" value={separation.requestingAgent} />
          <DutyRow label="Recommending agent" value={separation.recommendingAgent} />
          <DutyRow label="Approving human / team" value={separation.approverTeam} />
          <DutyRow label="Executing agent" value={separation.executingAgent} />
          <DutyRow label="Verifying agent" value={separation.verifyingAgent} />
          <DutyRow label="UAT agent" value={separation.uatAgent} />
          <p className="text-[11px] font-label text-foreground-600 mt-3">
            The recommending agent is never automatically treated as its own approver — no automatic self-approval.
          </p>
        </div>
      </section>
    </div>
  );
}