import { Link } from 'react-router-dom';
import type { AiOrchestration, ActivityStatus } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentWorkflow({ orchestration }: { orchestration: AiOrchestration }) {
  const { workflow } = orchestration;

  if (workflow.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Agent Workflow</h3>
        <p className="text-sm text-foreground-500">No multi-agent workflow for this orchestration.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Agent Workflow</h3>
      <div className="flex flex-col gap-1.5">
        {workflow.map((node, i) => (
          <div key={`${node.agent}-${i}`} className="flex flex-col items-start">
            <div className="w-full bg-background-50 border border-background-200/40 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm text-foreground-100 font-medium truncate">{node.agent}</span>
                </div>
                <StatusPill tone={ACTIVITY_STATUS[node.status as ActivityStatus].tone} label={ACTIVITY_STATUS[node.status as ActivityStatus].label} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500">
                {node.runId && (
                  <Link
                    to={`/ai-operations/runs/${node.runId}`}
                    className="inline-flex items-center gap-1 text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {node.runId}
                    <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  </Link>
                )}
                <span>Duration: {node.duration}</span>
              </div>
              <p className="text-xs text-foreground-500 mt-1.5">{node.outcome}</p>
            </div>
            {i < workflow.length - 1 && (
              <i className="ri-arrow-down-line text-foreground-600 w-4 h-4 flex items-center justify-center my-0.5 ml-4"></i>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}