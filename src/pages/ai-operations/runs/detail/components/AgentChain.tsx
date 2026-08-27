import { Link } from 'react-router-dom';
import type { RunChainNode } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentChain({ chain }: { chain: RunChainNode[] }) {
  if (chain.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Chain</h3>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="space-y-0">
          {chain.map((node, i) => {
            const st = ACTIVITY_STATUS[node.status];
            const isLast = i === chain.length - 1;
            const childExists = node.runId && node.runId !== '—';
            return (
              <div key={`${node.agent}-${i}`}>
                <div className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-background-200/50 border border-background-300/50 flex items-center justify-center shrink-0">
                    <i className="ri-robot-2-line text-foreground-400 w-4 h-4 flex items-center justify-center"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground-100">{node.agent}</span>
                      <StatusPill tone={st.tone} label={st.label} />
                    </div>
                    <p className="text-xs text-foreground-500 mt-0.5">{node.outcome} · {node.duration}</p>
                  </div>
                  {childExists ? (
                    <Link
                      to={`/ai-operations/runs/${node.runId}`}
                      className="shrink-0 font-mono text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {node.runId}
                    </Link>
                  ) : (
                    <span className="shrink-0 font-mono text-xs text-foreground-600 whitespace-nowrap">{node.runId}</span>
                  )}
                </div>
                {!isLast && (
                  <div className="flex items-center gap-3 pl-4">
                    <i className="ri-arrow-down-line text-foreground-600 w-4 h-4 flex items-center justify-center"></i>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}