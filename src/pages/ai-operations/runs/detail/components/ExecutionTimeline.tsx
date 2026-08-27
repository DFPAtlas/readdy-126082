import type { RunStep } from '@/pages/ai-operations/types';
import { RUN_STEP_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ExecutionTimeline({ steps }: { steps: RunStep[] }) {
  if (steps.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Timeline</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No execution steps recorded for this run.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Timeline</h3>
        <span className="text-xs font-label text-foreground-600">{steps.length} steps</span>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <ol className="space-y-0">
          {steps.map((step, i) => {
            const st = RUN_STEP_STATUS[step.status];
            const isLast = i === steps.length - 1;
            return (
              <li key={step.stepNumber} className="relative flex gap-4 pb-4 last:pb-0">
                {/* connector */}
                {!isLast && <span className="absolute left-[11px] top-7 bottom-0 w-px bg-background-300/50"></span>}

                <span className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${step.status === 'completed' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : step.status === 'failed' ? 'bg-red-500/15 border-red-500/30 text-red-400' : step.status === 'working' ? 'bg-accent-500/15 border-accent-500/30 text-accent-400' : 'bg-background-200/40 border-background-300/40 text-foreground-600'}`}>
                  <span className="text-[11px] font-label leading-none">{step.stepNumber}</span>
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-medium text-foreground-100">{step.name}</span>
                      <StatusPill tone={st.tone} label={st.label} pulse={step.status === 'working'} />
                      {step.approvalRequired && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-label text-amber-400 whitespace-nowrap">
                          <i className="ri-shield-check-line w-3.5 h-3.5 flex items-center justify-center"></i>Approval
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{step.agent} · {step.duration}</span>
                  </div>
                  <p className="text-xs text-foreground-500 mt-1">In: {step.inputSummary}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">Out: {step.outputSummary}</p>
                  {step.errorSummary && <p className="text-xs text-red-400 mt-0.5">Error: {step.errorSummary}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}