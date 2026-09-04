import { Link } from 'react-router-dom';
import { getWallboardAgents, getWallboardStatus } from '@/pages/ai-operations/wallboard/selectors';
import UnavailableState from '@/pages/ai-operations/wallboard/components/UnavailableState';
import { AGENT_STATUS, AGENT_HEALTH } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentsWorking() {
  const agents = getWallboardAgents(6);
  const status = getWallboardStatus().agents;

  return (
    <section className="h-full bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agents Working Now</h3>
        <span className="text-xs font-label text-foreground-600">{agents.length} shown</span>
      </div>

      {status === 'live' ? (
      <div className="divide-y divide-background-200/40 overflow-y-auto">
        {agents.map((a) => {
          const status = AGENT_STATUS[a.status];
          const health = AGENT_HEALTH[a.health];
          return (
            <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/ai-operations/agents/${a.id}`} className="text-sm font-medium text-foreground-100 hover:text-foreground-50 transition-colors cursor-pointer whitespace-nowrap">
                    {a.name}
                  </Link>
                  <span className="text-xs text-foreground-500 whitespace-nowrap">{a.scope}</span>
                </div>
                <p className="text-xs text-foreground-400 mt-0.5 line-clamp-1">{a.currentTask}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <StatusPill tone={status.tone} label={status.label} />
                <StatusPill tone={health.tone} label={health.label} />
              </div>
            </div>
          );
        })}
      </div>
      ) : (
        <UnavailableState label="Agent registry unavailable." />
      )}
    </section>
  );
}