import { Link } from 'react-router-dom';
import { getAgentsWorkingNow } from '@/pages/ai-operations/live/selectors';
import { AGENT_STATUS, AGENT_HEALTH, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentsWorkingNow() {
  const agents = getAgentsWorkingNow();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agents Registered (Active)</h3>
        <span className="text-xs font-label text-foreground-600">{agents.length} agents</span>
      </div>

      <div className="divide-y divide-background-200/40">
        {agents.map((a) => {
          const status = AGENT_STATUS[a.status];
          const health = AGENT_HEALTH[a.health];
          const risk = RISK_LEVEL[a.risk];
          return (
            <div key={a.id} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/ai-operations/agents/${a.id}`} className="text-sm font-medium text-foreground-200 hover:text-foreground-50 transition-colors cursor-pointer whitespace-nowrap">
                      {a.name}
                    </Link>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-400 whitespace-nowrap">{a.scope}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5 line-clamp-1">{a.currentTask}</p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <StatusPill tone={status.tone} label={status.label} />
                    <StatusPill tone={health.tone} label={health.label} />
                    <StatusPill tone={risk.tone} label={risk.label} />
                    <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Run {a.currentRunId}</span>
                    <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Queue {a.queueCount}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  <Link
                    to={`/ai-operations/agents/${a.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    Open Agent
                  </Link>
                  <Link
                    to={`/ai-operations/runs/${a.currentRunId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    Open Run
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}