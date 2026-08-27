import type { AiOrchestration, OrchestrationStage } from '@/pages/ai-operations/types';
import { ORCHESTRATION_STAGE, ORCHESTRATION_STAGE_STATE } from '@/pages/ai-operations/constants';

const STAGE_ORDER: OrchestrationStage[] = [
  'receive', 'classify', 'identify_site', 'assess_risk', 'select_agent', 'plan',
  'check_permissions', 'approval_gate', 'execute', 'verify', 'uat', 'audit', 'complete',
];

export default function LifecycleStepper({ orchestration }: { orchestration: AiOrchestration }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Orchestration Lifecycle</h3>
      <div className="flex flex-wrap gap-1.5">
        {STAGE_ORDER.map((stage, i) => {
          const entry = orchestration.stages.find((s) => s.stage === stage);
          const state = entry?.state ?? 'pending';
          const display = ORCHESTRATION_STAGE_STATE[state];
          const label = ORCHESTRATION_STAGE[stage];

          const toneCls =
            state === 'completed'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
              : state === 'current'
                ? 'bg-accent-500/15 text-accent-400 border-accent-500/25'
                : state === 'blocked'
                  ? 'bg-red-500/15 text-red-400 border-red-500/25'
                  : state === 'not_required'
                    ? 'bg-secondary-500/10 text-secondary-300 border-secondary-500/20'
                    : 'bg-background-50 text-foreground-600 border-background-300/40';

          return (
            <span key={stage} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-label border whitespace-nowrap ${toneCls}`}
                title={`${label} — ${display.label}`}
              >
                {state === 'current' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse"></span>
                )}
                {label}
              </span>
              {i < STAGE_ORDER.length - 1 && (
                <i className="ri-arrow-right-line text-foreground-600 w-3 h-3 flex items-center justify-center"></i>
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}