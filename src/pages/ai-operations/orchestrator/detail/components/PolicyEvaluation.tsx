import type { AiOrchestration } from '@/pages/ai-operations/types';
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

export default function PolicyEvaluation({ orchestration }: { orchestration: AiOrchestration }) {
  const requestType = TASK_TO_REQUEST[orchestration.taskType] ?? 'manual';
  const policies = getPoliciesForApproval(requestType, orchestration.riskClass);

  const result = orchestration.approvalRequired || orchestration.riskClass === 'red' ? 'require_approval' : 'allow';
  const evalResult = EVALUATION_RESULT[result];
  const blocking = policies.find((p) => p.effect === 'deny' || p.effect === 'require_approval');

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Policy Evaluation</h3>
        <StatusPill tone={evalResult.tone} label={evalResult.label} />
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Approval requirement</p>
            <p className="text-sm text-foreground-200 mt-1">{orchestration.approvalRequired ? 'Required' : 'Not required'}</p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Audit requirement</p>
            <p className="text-sm text-foreground-200 mt-1">{orchestration.auditRequired ? 'Required' : 'Not required'}</p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-md p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Blocking policy</p>
            <p className="text-sm text-foreground-200 mt-1">{blocking ? blocking.name : 'None'}</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-2">Matched policies ({policies.length})</p>
          <PolicyLinkList policies={policies} emptyMessage="No policies matched for this orchestration." />
        </div>

        <p className="text-[11px] font-label text-foreground-600">
          Policy evaluation is a simulation — no enforcement occurs against production systems.
        </p>
      </div>
    </section>
  );
}