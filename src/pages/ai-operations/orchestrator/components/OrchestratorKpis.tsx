import type { AiOrchestration } from '@/pages/ai-operations/types';

interface Kpi {
  key: string;
  label: string;
  value: string | number;
  accent: string;
  icon: string;
}

export default function OrchestratorKpis({ orchestrations }: { orchestrations: AiOrchestration[] }) {
  const currentlyRouting = orchestrations.filter((o) =>
    ['received', 'analysing', 'planning', 'selecting_agent', 'awaiting_capacity'].includes(o.status),
  ).length;
  const activeWorkflows = orchestrations.filter((o) => ['executing', 'verifying', 'uat', 'routed'].includes(o.status)).length;
  const queueDepth = orchestrations.filter((o) => ['awaiting_capacity', 'awaiting_approval'].includes(o.status)).length;
  const routingFailures = orchestrations.filter((o) => ['failed', 'blocked'].includes(o.status)).length;
  const awaitingApproval = orchestrations.filter((o) => o.approvalRequired && o.approvalGate.blocking).length;
  const completed = orchestrations.filter((o) => o.status === 'completed').length;
  const successRate = orchestrations.length > 0 ? Math.round((completed / orchestrations.length) * 100) : 0;

  const kpis: Kpi[] = [
    { key: 'received', label: 'Tasks Received Today', value: orchestrations.length, accent: 'bg-accent-500/15 text-accent-400', icon: 'ri-inbox-line' },
    { key: 'routed', label: 'Tasks Routed Today', value: orchestrations.length - currentlyRouting - routingFailures, accent: 'bg-emerald-500/15 text-emerald-400', icon: 'ri-send-plane-line' },
    { key: 'routing', label: 'Currently Routing', value: currentlyRouting, accent: 'bg-accent-500/15 text-accent-400', icon: 'ri-shuffle-line' },
    { key: 'active', label: 'Active Workflows', value: activeWorkflows, accent: 'bg-accent-500/15 text-accent-400', icon: 'ri-flow-chart' },
    { key: 'queue', label: 'Queue Depth', value: queueDepth, accent: 'bg-secondary-500/15 text-secondary-300', icon: 'ri-stack-line' },
    { key: 'failures', label: 'Routing Failures', value: routingFailures, accent: 'bg-red-500/15 text-red-400', icon: 'ri-error-warning-line' },
    { key: 'approval', label: 'Awaiting Approval', value: awaitingApproval, accent: 'bg-amber-500/15 text-amber-400', icon: 'ri-shield-check-line' },
    { key: 'avg', label: 'Avg Routing Time', value: '1.2s', accent: 'bg-secondary-500/15 text-secondary-300', icon: 'ri-timer-line' },
    { key: 'success', label: 'Success Rate', value: `${successRate}%`, accent: 'bg-emerald-500/15 text-emerald-400', icon: 'ri-check-double-line' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{kpi.label}</p>
            <div className={`w-7 h-7 rounded-lg ${kpi.accent} flex items-center justify-center shrink-0`}>
              <i className={`${kpi.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
            </div>
          </div>
          <p className="text-2xl font-heading font-bold text-foreground-50 mt-2">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}