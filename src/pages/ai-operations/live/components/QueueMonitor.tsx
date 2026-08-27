import { Link } from 'react-router-dom';
import { getQueueMetrics, getQueueItems } from '@/pages/ai-operations/live/selectors';
import { RUN_PRIORITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function QueueMonitor() {
  const metrics = getQueueMetrics();
  const items = getQueueItems();

  const metricCells = [
    { label: 'Total Queued', value: metrics.totalQueued, tone: 'text-foreground-200' },
    { label: 'High Priority', value: metrics.highPriority, tone: 'text-amber-400' },
    { label: 'Urgent', value: metrics.urgent, tone: 'text-red-400' },
    { label: 'Critical', value: metrics.critical, tone: 'text-red-400' },
    { label: 'Retry Scheduled', value: metrics.retryScheduled, tone: 'text-amber-400' },
    { label: 'Awaiting Approval', value: metrics.awaitingApproval, tone: 'text-amber-400' },
    { label: 'Blocked', value: metrics.blocked, tone: metrics.blocked > 0 ? 'text-red-400' : 'text-foreground-200' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Queue</h3>
      </div>

      <div className="p-3 grid grid-cols-3 sm:grid-cols-7 gap-2 border-b border-background-200/40">
        {metricCells.map((cell) => (
          <div key={cell.label} className="bg-background-50 border border-background-200/40 rounded-md px-2 py-2 text-center">
            <p className={`text-base font-heading font-bold ${cell.tone}`}>{cell.value}</p>
            <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide mt-0.5">{cell.label}</p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-background-200/40">
        {items.map((item) => {
          const priority = RUN_PRIORITY[item.priority];
          return (
            <div key={item.runId} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 rounded-full bg-background-200/50 text-foreground-400 text-xs font-label flex items-center justify-center shrink-0">
                  {item.queuePosition}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-label text-foreground-200 whitespace-nowrap">{item.runId}</span>
                    <span className="text-xs text-foreground-400 whitespace-nowrap">{item.site} · {item.agent}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5 line-clamp-1">{item.task}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-1">Waiting {item.waitingTime} · {item.blockingState}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill tone={priority.tone} label={priority.label} />
                <Link
                  to={`/ai-operations/runs/${item.runId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  Open
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}