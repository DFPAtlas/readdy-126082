import type { AiTaskRun, RiskClass } from '@/pages/ai-operations/types';
import { getPoliciesForApproval } from '@/pages/ai-operations/security/selectors';
import PolicyLinkList from '@/pages/ai-operations/security/components/PolicyLinkList';
import { EVALUATION_RESULT } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const TASK_TO_REQUEST: Record<string, string> = {
  deployment: 'deployment',
  billing: 'billing',
  security: 'security',
  compliance: 'compliance',
  repair_recommendation: 'repair',
  diagnostics: 'diagnostics',
  support: 'support',
  uat: 'uat',
};

function riskLevelToClass(risk: string): RiskClass {
  if (risk === 'critical' || risk === 'high') return 'red';
  if (risk === 'medium') return 'amber';
  return 'green';
}

export default function SecurityDecision({ run }: { run: AiTaskRun }) {
  const requestType = TASK_TO_REQUEST[run.taskType] ?? 'manual';
  const riskClass = riskLevelToClass(run.risk);
  const policies = getPoliciesForApproval(requestType, riskClass);

  const result = run.approval.approvalRequired || riskClass === 'red' ? 'require_approval' : 'allow';
  const evalResult = EVALUATION_RESULT[result];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Security Decision</h3>
        <StatusPill tone={evalResult.tone} label={evalResult.label} />
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Policies evaluated</p>
            <p className="text-sm text-foreground-200 mt-1">{policies.length}</p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Approval required</p>
            <p className="text-sm text-foreground-200 mt-1">{run.approval.approvalRequired ? 'Yes' : 'No'}</p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Result</p>
            <p className="text-sm text-foreground-200 mt-1">{result === 'allow' ? 'Allowed' : 'Approval gated'}</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-2">Policies evaluated ({policies.length})</p>
          <PolicyLinkList policies={policies} emptyMessage="No policies evaluated for this run." />
        </div>
      </div>
    </section>
  );
}