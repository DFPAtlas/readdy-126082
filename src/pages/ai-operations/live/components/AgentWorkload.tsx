import { Link } from 'react-router-dom';
import { getAgentWorkload } from '@/pages/ai-operations/live/selectors';
import { AGENT_STATUS, CAPACITY_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentWorkload() {
  const workloads = getAgentWorkload();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Workload</h3>
        <span className="text-xs font-label text-foreground-600">{workloads.length} agents</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium text-center">Active</th>
              <th className="px-4 py-2.5 font-medium text-center">Queue</th>
              <th className="px-4 py-2.5 font-medium text-center">Jobs Today</th>
              <th className="px-4 py-2.5 font-medium text-center">Success</th>
              <th className="px-4 py-2.5 font-medium text-center">Avg</th>
              <th className="px-4 py-2.5 font-medium text-right">Capacity</th>
            </tr>
          </thead>
          <tbody>
            {workloads.map((w) => {
              const status = AGENT_STATUS[w.status];
              const capacity = CAPACITY_STATE[w.capacity];
              return (
                <tr key={w.agentId} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link to={`/ai-operations/agents/${w.agentId}`} className="text-foreground-200 hover:text-foreground-50 transition-colors cursor-pointer whitespace-nowrap font-medium">
                        {w.agentName}
                      </Link>
                      <span className="text-foreground-600">&middot;</span>
                      <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">{w.site}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.activeTasks}</td>
                  <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.queueSize}</td>
                  <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.jobsToday}</td>
                  <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.successRate}</td>
                  <td className="px-4 py-2.5 text-center text-foreground-300 font-label">{w.avgDuration}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <StatusPill tone={status.tone} label={status.label} />
                      <StatusPill tone={capacity.tone} label={capacity.label} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}