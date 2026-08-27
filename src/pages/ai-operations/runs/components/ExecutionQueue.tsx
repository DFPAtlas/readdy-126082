import { Link } from 'react-router-dom';
import type { AiTaskRun, RunStatus } from '@/pages/ai-operations/types';
import { RUN_STATUS, RUN_PRIORITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const QUEUE_STATUSES: RunStatus[] = ['queued', 'waiting', 'retry_scheduled', 'awaiting_approval', 'paused', 'blocked'];

function blockingReason(run: AiTaskRun): string {
  switch (run.status) {
    case 'awaiting_approval':
      return run.approvalId ? `Awaiting human approval ${run.approvalId}` : 'Awaiting human approval';
    case 'blocked':
      return run.errorSummary || 'Blocked — dependency not ready';
    case 'retry_scheduled':
      return run.retry.retryReason || 'Retry scheduled';
    case 'paused':
      return 'Paused by operator';
    default:
      return 'Waiting for queue slot';
  }
}

export default function ExecutionQueue({ runs }: { runs: AiTaskRun[] }) {
  const queued = runs.filter((r) => QUEUE_STATUSES.includes(r.status));

  if (queued.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
        <p className="text-sm text-foreground-500">Queue is clear.</p>
      </div>
    );
  }

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Pos</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Blocking Reason</th>
              <th className="px-4 py-3 font-medium">Next Action</th>
              <th className="px-4 py-3 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {queued.map((run) => {
              const status = RUN_STATUS[run.status];
              const priority = RUN_PRIORITY[run.priority];
              return (
                <tr key={run.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono text-xs text-foreground-500 whitespace-nowrap">{run.queuePosition ?? '—'}</td>
                  <td className="px-4 py-3"><StatusPill tone={priority.tone} label={priority.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3 text-foreground-300 max-w-[200px] truncate" title={run.taskName}>{run.taskName}</td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{run.siteName}</td>
                  <td className="px-4 py-3 text-foreground-400 max-w-[150px] truncate" title={run.agentName}>{run.agentName}</td>
                  <td className="px-4 py-3 text-foreground-500 max-w-[180px] truncate" title={blockingReason(run)}>{blockingReason(run)}</td>
                  <td className="px-4 py-3 text-foreground-500 max-w-[160px] truncate" title={run.result.nextAction}>{run.result.nextAction}</td>
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
  );
}