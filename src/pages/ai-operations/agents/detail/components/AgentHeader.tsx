import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AgentRegistryRecord } from '@/pages/ai-operations/types';
import {
  AGENT_STATUS,
  AGENT_HEALTH,
  RISK_LEVEL,
  AGENT_TYPE_LABELS,
  AGENT_AUTONOMY_LABELS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface AgentHeaderProps {
  agent: AgentRegistryRecord;
  onEdit: () => void;
  onPause: () => void;
  onDisable: () => void;
}

export default function AgentHeader({ agent, onEdit, onPause, onDisable }: AgentHeaderProps) {
  const [notice, setNotice] = useState('');

  const status = AGENT_STATUS[agent.status];
  const health = AGENT_HEALTH[agent.health];
  const risk = RISK_LEVEL[agent.risk];

  const pause = () => {
    onPause();
    setNotice('Agent runtime is not connected yet — this updates registry state only.');
  };

  const disable = () => {
    onDisable();
    setNotice('Agent runtime is not connected yet — this updates registry state only.');
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-label text-foreground-500 flex-wrap" aria-label="Breadcrumb">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">AI Operations</Link>
        <span className="text-foreground-700">&rsaquo;</span>
        <Link to="/ai-operations/agents" className="hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">Agents</Link>
        <span className="text-foreground-700">&rsaquo;</span>
        <span className="text-foreground-300 whitespace-nowrap">{agent.name}</span>
      </nav>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-accent-500/15 flex items-center justify-center shrink-0">
              <i className="ri-robot-2-line text-xl text-accent-400 w-6 h-6 flex items-center justify-center"></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-heading font-bold text-foreground-50">{agent.name}</h1>
              </div>
              <p className="text-xs font-label text-foreground-600 mt-0.5">
                {agent.id} &middot; {agent.scope} &middot; {AGENT_TYPE_LABELS[agent.type]}
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <StatusPill tone={status.tone} label={status.label} pulse={agent.status === 'working'} />
                <StatusPill tone={health.tone} label={health.label} />
                <StatusPill tone={risk.tone} label={`${risk.label} risk`} />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-400 whitespace-nowrap">
                  {ENVIRONMENT_LABELS[agent.environment]}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-400 whitespace-nowrap">
                  {AGENT_AUTONOMY_LABELS[agent.autonomy]}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap self-start lg:self-center">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:border-background-400/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-pencil-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Edit Agent
            </button>
            <button
              onClick={pause}
              disabled={agent.status === 'paused'}
              className="inline-flex items-center gap-1.5 text-xs font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className="ri-pause-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Pause Agent
            </button>
            <button
              onClick={disable}
              disabled={agent.status === 'disabled'}
              className="inline-flex items-center gap-1.5 text-xs font-label text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className="ri-stop-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Disable Agent
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <i className="ri-information-line text-amber-400 text-base w-5 h-5 flex items-center justify-center shrink-0"></i>
            <p className="text-sm text-amber-300">{notice}</p>
          </div>
          <button onClick={() => setNotice('')} className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer shrink-0">
            <i className="ri-close-line text-base w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>
      )}
    </div>
  );
}