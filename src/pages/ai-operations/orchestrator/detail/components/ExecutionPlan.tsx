import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { RUN_STEP_STATUS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ExecutionPlan({ orchestration }: { orchestration: AiOrchestration }) {
  const { plan } = orchestration;

  if (plan.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Execution Plan</h3>
        <p className="text-sm text-foreground-500">No execution plan was generated for this orchestration.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Execution Plan</h3>
      <ol className="space-y-2.5">
        {plan.map((step) => (
          <li key={step.number} className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent-500/15 text-accent-400 text-xs font-label flex items-center justify-center shrink-0 mt-0.5">
                {step.number}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-foreground-100 font-medium">{step.action}</p>
                  <StatusPill tone={RUN_STEP_STATUS[step.status].tone} label={RUN_STEP_STATUS[step.status].label} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500">
                  <span>{step.agentName}</span>
                  {step.tool && step.tool !== '—' && <span>Tool: {step.tool}</span>}
                  <span className="inline-flex items-center gap-1"><StatusPill tone={RISK_LEVEL[step.risk].tone} label={RISK_LEVEL[step.risk].label} /></span>
                  {step.approvalRequired && <span className="text-amber-400">Approval required</span>}
                </div>
                {step.runId && (
                  <Link
                    to={`/ai-operations/runs/${step.runId}`}
                    className="inline-flex items-center gap-1 mt-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {step.runId}
                    <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}