import type { AgentRegistryRecord } from '@/pages/ai-operations/types';
import { AGENT_CATEGORY_LABELS, AGENT_TYPE_LABELS } from '@/pages/ai-operations/constants';

interface AgentOverviewProps {
  agent: AgentRegistryRecord;
}

export default function AgentOverview({ agent }: AgentOverviewProps) {
  const successful = Math.max(0, agent.jobsToday - agent.failedJobsToday);
  // Demo placeholder — pending approval count is not yet a persisted agent field.
  const pendingApprovals = agent.risk === 'critical' ? 2 : agent.risk === 'high' ? 1 : 0;

  const kpis = [
    { label: 'Jobs Today', value: agent.jobsToday, icon: 'ri-stack-line' },
    { label: 'Successful', value: successful, icon: 'ri-check-double-line' },
    { label: 'Failed', value: agent.failedJobsToday, icon: 'ri-error-warning-line' },
    { label: 'Success Rate', value: agent.successRate, icon: 'ri-line-chart-line' },
    { label: 'Average Duration', value: agent.avgRunDuration, icon: 'ri-timer-line' },
    { label: 'Est. Cost Today', value: agent.avgEstimatedCost, icon: 'ri-money-pound-circle-line' },
    { label: 'Queue', value: agent.queueCount, icon: 'ri-stack-line' },
    { label: 'Pending Approvals', value: pendingApprovals, icon: 'ri-shield-check-line' },
  ];

  const meta = [
    { label: 'Owner / team', value: agent.ownerTeam || '—' },
    { label: 'Escalation team', value: agent.escalationTeam || '—' },
    { label: 'Assigned site', value: agent.scope },
    { label: 'Category', value: AGENT_CATEGORY_LABELS[agent.category] },
    { label: 'Agent type', value: AGENT_TYPE_LABELS[agent.type] },
    { label: 'Created', value: agent.createdAt },
    { label: 'Updated', value: agent.updatedAt },
  ];

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Overview</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{k.label}</span>
              <i className={`${k.icon} text-sm text-accent-400 w-4 h-4 flex items-center justify-center shrink-0`}></i>
            </div>
            <p className="text-lg font-heading font-bold text-foreground-100">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <p className="text-sm text-foreground-300 leading-relaxed">{agent.description}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          {meta.map((m) => (
            <div key={m.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
              <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{m.label}</span>
              <span className="text-sm text-foreground-200 text-right">{m.value}</span>
            </div>
          ))}
        </div>
        {agent.notes && (
          <div className="mt-4 bg-background-50 border border-background-200/40 rounded-lg px-3 py-2.5">
            <p className="text-xs text-foreground-500">
              <span className="font-label text-foreground-400">Notes:</span> {agent.notes}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}