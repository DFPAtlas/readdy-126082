import { Link } from 'react-router-dom';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentUsage({ source }: { source: KnowledgeSource }) {
  const { usageEvents } = source;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Usage</h3>
        <span className="text-[11px] font-label text-foreground-600">{usageEvents.length} events</span>
      </div>

      {usageEvents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No recent usage events.</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {usageEvents.map((u) => {
            const result = ACTIVITY_STATUS[u.result];
            return (
              <div key={`${u.time}-${u.agentId}`} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-label text-foreground-500">{u.time}</span>
                      <Link to={`/ai-operations/agents/${u.agentId}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                        {u.agentName}
                      </Link>
                    </div>
                    <p className="text-[11px] font-label text-foreground-600 mt-0.5">{u.site} · {u.purpose} · {u.reference}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill tone={result.tone} label={result.label} />
                    {u.runId && (
                      <Link
                        to={`/ai-operations/runs/${u.runId}`}
                        className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {u.runId}
                        <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}