import { Link } from 'react-router-dom';
import type { RunApprovalLink, RunUatLink } from '@/pages/ai-operations/types';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function ApprovalUat({ approval, uat }: { approval: RunApprovalLink; uat: RunUatLink }) {
  const risk = RISK_LEVEL[approval.risk];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Approval Linkage</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <Field label="Approval required" value={approval.approvalRequired ? 'Yes' : 'No'} />
          <Field label="Approval ID" value={approval.approvalId ?? '—'} />
          <Field label="Approval state" value={approval.approvalState} />
          <Field label="Requested time" value={approval.requestedTime} />
          <Field label="Risk" value={risk.label} />
          <Field label="Approver / team" value={approval.approverTeam} />
          {approval.approvalRequired && (
            <div className="pt-3">
              {approval.approvalId ? (
                <Link
                  to={`/ai-operations/approvals/${approval.approvalId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-200/50 border border-background-300/40 rounded-md px-3 py-1.5 hover:text-foreground-50 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-shield-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
                  Open Approval
                </Link>
              ) : (
                <button
                  disabled
                  title="No matching approval record"
                  className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-200/50 border border-background-300/40 rounded-md px-3 py-1.5 opacity-60 cursor-not-allowed whitespace-nowrap"
                >
                  <i className="ri-shield-check-line text-sm w-4 h-4 flex items-center justify-center"></i>
                  Open Approval
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">UAT Linkage</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <Field label="UAT required" value={uat.uatRequired ? 'Yes' : 'No'} />
          <Field label="UAT status" value={uat.uatStatus} />
          <Field label="Test plan reference" value={uat.testPlanRef} />
          <Field label="Tests passed" value={String(uat.testsPassed)} />
          <Field label="Tests failed" value={String(uat.testsFailed)} />
          {uat.uatRequired && (
            <div className="pt-3">
              <button
                disabled
                title="Coming soon"
                className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-200/50 border border-background-300/40 rounded-md px-3 py-1.5 opacity-60 cursor-not-allowed whitespace-nowrap"
              >
                <i className="ri-test-tube-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Open UAT
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}