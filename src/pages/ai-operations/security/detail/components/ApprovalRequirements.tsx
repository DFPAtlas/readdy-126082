import type { AiSecurityPolicy } from '@/pages/ai-operations/types';

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

export default function ApprovalRequirements({ policy }: { policy: AiSecurityPolicy }) {
  const separationOfDuties = policy.riskClass === 'red';
  const verificationRequired = policy.riskClass !== 'green';
  const uatRequired = policy.category === 'deployment';

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Approval Requirements</h3>

      <div className="mt-3">
        <Row label="Approval required" value={policy.approvalRequired ? 'Yes' : 'No'} icon="ri-shield-check-line" />
        <Row label="Minimum approvers" value={String(policy.minApprovers)} icon="ri-group-line" />
        <Row label="Required team" value={policy.ownerTeam} icon="ri-team-line" />
        <Row label="Separation of duties" value={separationOfDuties ? 'Required' : 'Not required'} icon="ri-lock-line" />
        <Row label="Expiry" value={policy.approvalRequired ? '24h' : '—'} icon="ri-timer-line" />
        <Row label="Verification required" value={verificationRequired ? 'Yes' : 'No'} icon="ri-eye-line" />
        <Row label="UAT required" value={uatRequired ? 'Yes' : 'No'} icon="ri-test-tube-line" />
        <Row label="Audit required" value={policy.auditRequired ? 'Yes' : 'No'} icon="ri-file-list-3-line" />
      </div>
    </section>
  );
}