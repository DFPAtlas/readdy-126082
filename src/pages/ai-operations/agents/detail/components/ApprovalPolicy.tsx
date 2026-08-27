import type { AgentApprovalPolicy } from '@/pages/ai-operations/types';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';

export default function ApprovalPolicy({ policy }: { policy: AgentApprovalPolicy }) {
  const yesNo = (v: boolean) => (v ? 'Yes' : 'No');

  const rows = [
    { label: 'Approval required', value: yesNo(policy.approvalRequired), icon: 'ri-shield-check-line' },
    { label: 'Minimum approvers', value: policy.minApprovers, icon: 'ri-group-line' },
    { label: 'Approval team', value: policy.approvalTeam, icon: 'ri-team-line' },
    { label: 'Maximum permitted risk', value: RISK_LEVEL[policy.maxPermittedRisk].label, icon: 'ri-error-warning-line' },
    { label: 'Auto-expiry', value: policy.autoExpiry, icon: 'ri-timer-line' },
    { label: 'Verification after execution', value: yesNo(policy.verificationRequired), icon: 'ri-checkbox-circle-line' },
    { label: 'UAT after execution', value: yesNo(policy.uatRequired), icon: 'ri-test-tube-line' },
    { label: 'Audit required', value: yesNo(policy.auditRequired), icon: 'ri-file-list-3-line' },
  ];

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Approval Policy</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 border-b border-background-200/40 pb-2">
              <span className="inline-flex items-center gap-2 text-xs font-label text-foreground-600 whitespace-nowrap">
                <i className={`${r.icon} text-sm text-accent-400 w-4 h-4 flex items-center justify-center`}></i>
                {r.label}
              </span>
              <span className="text-sm text-foreground-200">{r.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-4">
          Integrates with the DFP DIAGNOSE → RECOMMEND → HUMAN APPROVAL → EXECUTE → VERIFY → AUDIT workflow.
        </p>
      </div>
    </section>
  );
}