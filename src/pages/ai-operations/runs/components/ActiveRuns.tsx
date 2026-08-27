import { Link } from 'react-router-dom';
import type { AiTaskRun } from '@/pages/ai-operations/types';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function currentStepName(run: AiTaskRun): string {
  const active = run.steps.find((s) => s.status === 'working');
  if (active) return active.name;
  return `Step ${run.currentStep} of ${run.totalSteps}`;
}

export default function ActiveRuns({ runs }: { runs: AiTaskRun[] }) {
  const active = runs.filter((r) => r.status === 'working');

  if (active.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
        <p className="text-sm text-foreground-500">No active runs right now.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {active.map((run) => {
        const risk = RISK_LEVEL[run.risk];
        const progress = run.totalSteps > 0 ? Math.round((run.currentStep / run.totalSteps) * 100) : 0;
        return (
          <div key={run.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-accent-400">{run.id}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse"></span>
                    Working
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground-100 mt-1.5">{run.taskName}</p>
                <p className="text-xs text-foreground-500 mt-0.5">{run.siteName} · {run.agentName}</p>
              </div>
              <StatusPill tone={risk.tone} label={risk.label} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-500">Current step</span>
              <span className="text-foreground-300">{currentStepName(run)}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                <div className="h-full rounded-full bg-accent-400" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="text-[11px] font-label text-foreground-600">{progress}%</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-600">Elapsed · Started {run.startedTime}</span>
              <span className="text-foreground-500 font-label">{run.duration}</span>
            </div>

            <Link
              to={`/ai-operations/runs/${run.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-md px-3 py-1.5 hover:text-foreground-50 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Open Run
            </Link>
          </div>
        );
      })}
    </div>
  );
}