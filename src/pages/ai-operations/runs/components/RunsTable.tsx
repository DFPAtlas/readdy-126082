import { Link } from 'react-router-dom';
import type { AiTaskRun } from '@/pages/ai-operations/types';
import { RUN_STATUS, RUN_PRIORITY, RISK_LEVEL, TASK_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function progressOf(run: AiTaskRun): number {
  if (run.status === 'completed') return 100;
  if (run.status === 'partially_completed') return 75;
  if (run.totalSteps > 0) return Math.round((run.currentStep / run.totalSteps) * 100);
  if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'blocked') return 100;
  return 0;
}

export default function RunsTable({ runs }: { runs: AiTaskRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
        <i className="ri-list-check-3 text-3xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
        <p className="text-sm text-foreground-500 mt-3">No runs match the current filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block bg-background-100 border border-background-200/60 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const status = RUN_STATUS[run.status];
                const priority = RUN_PRIORITY[run.priority];
                const risk = RISK_LEVEL[run.risk];
                const progress = progressOf(run);
                return (
                  <tr key={run.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-mono text-xs text-accent-400 whitespace-nowrap">{run.id}</td>
                    <td className="px-4 py-3 text-foreground-300 max-w-[200px] truncate" title={run.taskName}>{run.taskName}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{run.siteName}</td>
                    <td className="px-4 py-3 text-foreground-400 max-w-[170px] truncate" title={run.agentName}>{run.agentName}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{TASK_TYPE_LABELS[run.taskType]}</td>
                    <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} pulse={run.status === 'working'} /></td>
                    <td className="px-4 py-3"><StatusPill tone={priority.tone} label={priority.label} /></td>
                    <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${run.status === 'failed' || run.status === 'blocked' ? 'bg-red-400' : run.status === 'working' ? 'bg-accent-400' : 'bg-emerald-400'}`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{run.startedTime === '—' ? '—' : run.startedTime}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{run.duration}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{run.actualCost}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/ai-operations/runs/${run.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 hover:text-foreground-50 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
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

      {/* Mobile cards */}
      <div className="lg:hidden grid grid-cols-1 gap-3">
        {runs.map((run) => {
          const status = RUN_STATUS[run.status];
          const priority = RUN_PRIORITY[run.priority];
          const risk = RISK_LEVEL[run.risk];
          const progress = progressOf(run);
          return (
            <div key={run.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-accent-400">{run.id}</span>
                    <StatusPill tone={status.tone} label={status.label} pulse={run.status === 'working'} />
                  </div>
                  <p className="text-sm font-medium text-foreground-100 mt-1.5">{run.taskName}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{run.siteName} · {run.agentName}</p>
                </div>
                <Link
                  to={`/ai-operations/runs/${run.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 hover:text-foreground-50 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  Open
                </Link>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill tone={priority.tone} label={priority.label} />
                <StatusPill tone={risk.tone} label={risk.label} />
                <span className="text-xs text-foreground-500">{TASK_TYPE_LABELS[run.taskType]}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                  <div className={`h-full rounded-full ${run.status === 'failed' || run.status === 'blocked' ? 'bg-red-400' : run.status === 'working' ? 'bg-accent-400' : 'bg-emerald-400'}`} style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-[11px] font-label text-foreground-600">{progress}%</span>
              </div>
              <p className="text-xs text-foreground-600">{run.startedTime === '—' ? 'Not started' : `Started ${run.startedTime}`} · {run.duration} · {run.actualCost}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}