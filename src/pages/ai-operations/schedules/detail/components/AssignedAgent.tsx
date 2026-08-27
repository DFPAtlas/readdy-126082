import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { AGENT_STATUS, AGENT_HEALTH, AGENT_AUTONOMY_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import { demoAgents } from '@/mocks/ai-operations-agents';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function AssignedAgent({ schedule }: { schedule: AiSchedule }) {
  const agent = demoAgents.find((a) => a.id === schedule.agentId);
  const model = agent?.model.primaryModel ?? '—';

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Assigned Agent</h3>
        <Link
          to={`/ai-operations/agents/${schedule.agentId}`}
          className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          Open Agent
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </Link>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-sm font-medium text-foreground-100">{schedule.agentName}</span>
          <span className="font-mono text-[10px] text-accent-400">{schedule.agentId}</span>
        </div>
        <Row label="Site / scope" value={schedule.siteName} />
        {agent ? (
          <>
            <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40">
              <span className="text-xs font-label text-foreground-500 whitespace-nowrap">Health</span>
              <StatusPill tone={AGENT_HEALTH[agent.health].tone} label={AGENT_HEALTH[agent.health].label} />
            </div>
            <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40">
              <span className="text-xs font-label text-foreground-500 whitespace-nowrap">Status</span>
              <StatusPill tone={AGENT_STATUS[agent.status].tone} label={AGENT_STATUS[agent.status].label} />
            </div>
            <Row label="Autonomy" value={AGENT_AUTONOMY_LABELS[agent.autonomy]} />
            <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40">
              <span className="text-xs font-label text-foreground-500 whitespace-nowrap">Risk</span>
              <StatusPill tone={RISK_LEVEL[agent.risk].tone} label={RISK_LEVEL[agent.risk].label} />
            </div>
            <Row label="Model" value={model} />
            <Row label="Queue" value={`${agent.queueCount} jobs`} />
          </>
        ) : (
          <p className="text-xs text-foreground-500 py-2">Agent details unavailable in registry.</p>
        )}
      </div>
    </section>
  );
}