import { Link } from 'react-router-dom';
import type { AgentActivity } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function LiveActivity({ activities }: { activities: AgentActivity[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg flex flex-col">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Live Agent Activity</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Live
        </span>
      </div>

      <div className="flex-1 divide-y divide-background-200/40">
        {activities.map((a) => {
          const display = ACTIVITY_STATUS[a.status];
          return (
            <div key={a.id} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground-200">{a.site}</span>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-400">{a.agent}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5 line-clamp-1">{a.action}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-1">{a.time} &middot; {a.runId}</p>
                </div>
                <StatusPill tone={display.tone} label={display.label} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-background-200/60">
        <Link
          to="/ai-operations/live"
          className="w-full inline-flex items-center justify-center gap-2 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-2 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-pulse-line w-4 h-4 flex items-center justify-center"></i>
          View Live Operations
        </Link>
      </div>
    </section>
  );
}