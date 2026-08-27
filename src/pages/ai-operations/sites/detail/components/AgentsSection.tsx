import { Link } from 'react-router-dom';
import type { SiteAgentSummary } from '@/pages/ai-operations/types';
import { AGENT_STATUS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface AgentsSectionProps {
  agents: SiteAgentSummary[];
}

export default function AgentsSection({ agents }: AgentsSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Site Agents</h3>
        <span className="text-xs font-label text-foreground-600">{agents.length} agents</span>
      </div>

      {agents.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No agents assigned yet.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Current Task</th>
                  <th className="px-4 py-3 font-medium">Last Run</th>
                  <th className="px-4 py-3 font-medium text-center">Success</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const status = AGENT_STATUS[agent.status];
                  const risk = RISK_LEVEL[agent.risk];
                  return (
                    <tr key={agent.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{agent.name}</td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{agent.category}</td>
                      <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                      <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                      <td className="px-4 py-3 text-foreground-400 max-w-[260px] truncate" title={agent.currentTask}>{agent.currentTask}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{agent.lastRun}</td>
                      <td className="px-4 py-3 text-center text-foreground-300 font-label whitespace-nowrap">{agent.successRate}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/ai-operations/agents/${agent.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}