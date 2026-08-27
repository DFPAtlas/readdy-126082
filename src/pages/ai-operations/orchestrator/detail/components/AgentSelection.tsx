import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import {
  AGENT_CATEGORY_LABELS,
  AGENT_STATUS,
  AGENT_HEALTH,
  AGENT_AUTONOMY_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { resolveModelId } from '@/pages/ai-operations/models/modelRefs';

export default function AgentSelection({ orchestration }: { orchestration: AiOrchestration }) {
  const a = orchestration.agentSelection;

  const agent = demoAgents.find((ag) => ag.id === orchestration.primaryAgentId);
  const primaryModelId = agent ? resolveModelId(agent.model.primaryModel) : null;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Selection</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {primaryModelId && (
            <Link
              to={`/ai-operations/models/${primaryModelId}`}
              className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              Open Model
              <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
            </Link>
          )}
          <Link
            to={`/ai-operations/agents/${orchestration.primaryAgentId}`}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Agent
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-heading font-semibold text-foreground-50">{a.name}</span>
            <span className="text-xs font-label text-foreground-500">{a.scope}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusPill tone={AGENT_STATUS[a.status].tone} label={AGENT_STATUS[a.status].label} />
            <StatusPill tone={AGENT_HEALTH[a.health].tone} label={AGENT_HEALTH[a.health].label} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Category</p>
            <p className="text-sm text-foreground-300 mt-0.5">{AGENT_CATEGORY_LABELS[a.category]}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Autonomy</p>
            <p className="text-sm text-foreground-300 mt-0.5">{AGENT_AUTONOMY_LABELS[a.autonomy]}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Workload</p>
            <p className="text-sm text-foreground-300 mt-0.5">{a.workload}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Queue</p>
            <p className="text-sm text-foreground-300 mt-0.5">{a.queue}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Capability match</p>
            <p className="text-sm text-foreground-300 mt-0.5">{a.capabilityMatch}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Permission match</p>
            <p className="text-sm text-foreground-300 mt-0.5">{a.permissionMatch}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Selection score</p>
            <p className="text-sm text-foreground-100 mt-0.5">{a.selectionScore}</p>
          </div>
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Selection reason</p>
            <p className="text-sm text-foreground-300 mt-0.5">{a.selectionReason}</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {a.tools.map((t) => (
              <span key={t} className="text-xs text-foreground-500 bg-background-50 border border-background-200/60 rounded-md px-2 py-1">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}