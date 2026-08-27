import { Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RecentUsage({ model }: { model: AiModel }) {
  const events = model.usageEvents;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Recent Model Usage</h3>
      </div>

      {events.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No recent usage recorded.</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {events.map((e, i) => {
            const result = ACTIVITY_STATUS[e.result];
            return (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{e.time}</span>
                    <span className="text-xs text-foreground-300">{e.agentName}</span>
                    <span className="text-[10px] font-label text-foreground-600">{e.site}</span>
                  </div>
                  <p className="text-sm text-foreground-200 mt-0.5">{e.task}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">{e.duration} · {e.estimatedCost}</span>
                  <StatusPill tone={result.tone} label={result.label} />
                  {e.runId ? (
                    <Link to={`/ai-operations/runs/${e.runId}`} className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap">
                      Open
                      <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                    </Link>
                  ) : (
                    <span className="text-[10px] font-label text-foreground-600">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}