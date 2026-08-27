import { Link } from 'react-router-dom';
import type { AgentRegistryRecord } from '@/pages/ai-operations/types';
import {
  AGENT_STATUS,
  AGENT_HEALTH,
  RISK_LEVEL,
  AGENT_TYPE_LABELS,
  AGENT_CATEGORY_LABELS,
  AGENT_AUTONOMY_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function MobileCard({ agent }: { agent: AgentRegistryRecord }) {
  const status = AGENT_STATUS[agent.status];
  const health = AGENT_HEALTH[agent.health];
  const risk = RISK_LEVEL[agent.risk];
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground-200">{agent.name}</p>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5">
            {agent.scope} &middot; {AGENT_CATEGORY_LABELS[agent.category]}
          </p>
        </div>
        <StatusPill tone={status.tone} label={status.label} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusPill tone={health.tone} label={health.label} />
        <StatusPill tone={risk.tone} label={risk.label} />
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-400 whitespace-nowrap">
          {AGENT_AUTONOMY_LABELS[agent.autonomy]}
        </span>
      </div>

      <p className="text-xs text-foreground-400 line-clamp-2">{agent.currentTask}</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-background-50 border border-background-200/40 rounded-md py-2">
          <p className="text-[10px] font-label text-foreground-600 uppercase">Jobs</p>
          <p className="text-sm font-heading font-bold text-foreground-200 mt-0.5">{agent.jobsToday}</p>
        </div>
        <div className="bg-background-50 border border-background-200/40 rounded-md py-2">
          <p className="text-[10px] font-label text-foreground-600 uppercase">Success</p>
          <p className="text-sm font-heading font-bold text-foreground-200 mt-0.5">{agent.successRate}</p>
        </div>
        <div className="bg-background-50 border border-background-200/40 rounded-md py-2">
          <p className="text-[10px] font-label text-foreground-600 uppercase">Last Run</p>
          <p className="text-sm font-heading font-bold text-foreground-200 mt-0.5">{agent.lastRun}</p>
        </div>
      </div>

      <Link
        to={`/ai-operations/agents/${agent.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
      >
        <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
        Open
      </Link>
    </div>
  );
}

export default function AgentsTable({ agents }: { agents: AgentRegistryRecord[] }) {
  return (
    <>
      {/* Desktop / laptop table */}
      <div className="hidden md:block bg-background-100 border border-background-200/60 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Site / Scope</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Autonomy</th>
                <th className="px-4 py-3 font-medium">Current Task</th>
                <th className="px-4 py-3 font-medium text-center">Jobs</th>
                <th className="px-4 py-3 font-medium text-center">Success</th>
                <th className="px-4 py-3 font-medium">Last Run</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const status = AGENT_STATUS[agent.status];
                const health = AGENT_HEALTH[agent.health];
                const risk = RISK_LEVEL[agent.risk];
                return (
                  <tr key={agent.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{agent.name}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{agent.scope}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{AGENT_TYPE_LABELS[agent.type]}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{AGENT_CATEGORY_LABELS[agent.category]}</td>
                    <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} pulse={agent.status === 'working'} /></td>
                    <td className="px-4 py-3"><StatusPill tone={health.tone} label={health.label} /></td>
                    <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                    <td className="px-4 py-3 text-foreground-400 font-label whitespace-nowrap max-w-[140px] truncate" title={AGENT_AUTONOMY_LABELS[agent.autonomy]}>
                      {AGENT_AUTONOMY_LABELS[agent.autonomy]}
                    </td>
                    <td className="px-4 py-3 text-foreground-400 max-w-[220px] truncate" title={agent.currentTask}>{agent.currentTask}</td>
                    <td className="px-4 py-3 text-center text-foreground-300 font-label whitespace-nowrap">{agent.jobsToday}</td>
                    <td className="px-4 py-3 text-center text-foreground-300 font-label whitespace-nowrap">{agent.successRate}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{agent.lastRun}</td>
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

      {/* Mobile stacked cards */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {agents.map((agent) => (
          <MobileCard key={agent.id} agent={agent} />
        ))}
      </div>
    </>
  );
}