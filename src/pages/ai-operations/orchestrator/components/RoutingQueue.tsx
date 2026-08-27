import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import {
  ORCHESTRATION_STATUS,
  ORCHESTRATION_STAGE,
  RUN_PRIORITY,
  RISK_LEVEL,
  TASK_TYPE_LABELS,
  TRIGGER_SOURCE_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RoutingQueue({ orchestrations }: { orchestrations: AiOrchestration[] }) {
  if (orchestrations.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
        <i className="ri-inbox-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <p className="text-sm text-foreground-500 mt-4">No orchestrations match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden lg:block bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-label uppercase tracking-wide text-foreground-600 border-b border-background-200/60">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Selected Agent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {orchestrations.map((o) => (
                <tr key={o.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                  <td className="px-4 py-3 font-label text-foreground-200 whitespace-nowrap">{o.id}</td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <p className="text-foreground-100 truncate" title={o.title}>{o.title}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{TRIGGER_SOURCE_LABELS[o.triggerSource]}</td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{o.siteName}</td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{TASK_TYPE_LABELS[o.taskType]}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusPill tone={RUN_PRIORITY[o.priority].tone} label={RUN_PRIORITY[o.priority].label} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusPill tone={RISK_LEVEL[o.risk].tone} label={RISK_LEVEL[o.risk].label} /></td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{ORCHESTRATION_STAGE[o.currentStage]}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{o.primaryAgentName}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusPill tone={ORCHESTRATION_STATUS[o.status].tone} label={ORCHESTRATION_STATUS[o.status].label} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/orchestrator/${o.id}`}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {orchestrations.map((o) => (
          <Link
            key={o.id}
            to={`/ai-operations/orchestrator/${o.id}`}
            className="block bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-label text-foreground-500">{o.id} · {TRIGGER_SOURCE_LABELS[o.triggerSource]}</p>
                <p className="text-sm text-foreground-100 font-medium mt-0.5 truncate">{o.title}</p>
                <p className="text-xs text-foreground-500 mt-1">{o.siteName} · {TASK_TYPE_LABELS[o.taskType]} · {o.primaryAgentName}</p>
              </div>
              <StatusPill tone={ORCHESTRATION_STATUS[o.status].tone} label={ORCHESTRATION_STATUS[o.status].label} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <StatusPill tone={RUN_PRIORITY[o.priority].tone} label={RUN_PRIORITY[o.priority].label} />
              <StatusPill tone={RISK_LEVEL[o.risk].tone} label={RISK_LEVEL[o.risk].label} />
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-label border border-background-300/50 text-foreground-500">
                {ORCHESTRATION_STAGE[o.currentStage]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}