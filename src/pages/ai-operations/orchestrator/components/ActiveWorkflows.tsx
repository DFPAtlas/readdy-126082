import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { ORCHESTRATION_STAGE, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const TOTAL_STAGES = 13;

export default function ActiveWorkflows({ orchestrations }: { orchestrations: AiOrchestration[] }) {
  if (orchestrations.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
        <i className="ri-flow-chart text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <p className="text-sm text-foreground-500 mt-4">No active workflows.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {orchestrations.map((o) => {
        const completedStages = o.stages.filter((s) => s.state === 'completed').length;
        const progress = Math.round((completedStages / TOTAL_STAGES) * 100);
        const blocker = o.status === 'blocked' ? (o.failureSummary ?? 'Blocked') : o.status === 'awaiting_approval' ? 'Awaiting approval' : null;

        return (
          <Link
            key={o.id}
            to={`/ai-operations/orchestrator/${o.id}`}
            className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-label text-foreground-500">{o.id} · {o.siteName}</p>
                <p className="text-sm text-foreground-100 font-medium mt-0.5 truncate">{o.title}</p>
              </div>
              <StatusPill tone={RISK_LEVEL[o.risk].tone} label={RISK_LEVEL[o.risk].label} />
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-500">Current stage</span>
                <span className="text-foreground-300 font-label">{ORCHESTRATION_STAGE[o.currentStage]}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-500">Primary agent</span>
                <span className="text-foreground-300">{o.primaryAgentName}</span>
              </div>
              {o.supportingAgentIds.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground-500">Supporting</span>
                  <span className="text-foreground-300 truncate max-w-[180px]">{o.supportingAgentIds.length} agents</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-500">Root run</span>
                <span className="text-foreground-300 font-label">{o.rootRunId ?? '—'}</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-label text-foreground-600 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-background-50 overflow-hidden">
                <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            {blocker && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center"></i>
                {blocker}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}