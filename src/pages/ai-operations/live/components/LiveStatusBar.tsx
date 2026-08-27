import { getStatusBarMetrics } from '@/pages/ai-operations/live/selectors';

export default function LiveStatusBar({ paused }: { paused: boolean }) {
  const m = getStatusBarMetrics();

  const items = [
    { label: 'Sites Healthy', value: `${m.sitesHealthy} / ${m.sitesTotal}`, tone: 'text-emerald-400' },
    { label: 'Agents Working', value: m.agentsWorking, tone: 'text-accent-400' },
    { label: 'Active Runs', value: m.activeRuns, tone: 'text-accent-400' },
    { label: 'Queued Runs', value: m.queuedRuns, tone: 'text-foreground-200' },
    { label: 'Pending Approvals', value: m.pendingApprovals, tone: 'text-amber-400' },
    { label: 'Failed Runs', value: m.failedRuns, tone: m.failedRuns > 0 ? 'text-red-400' : 'text-foreground-200' },
    { label: 'Critical Alerts', value: m.criticalAlerts, tone: m.criticalAlerts > 0 ? 'text-red-400' : 'text-foreground-200' },
    { label: 'AI Cost Today', value: m.aiCostToday, tone: 'text-foreground-200' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-1.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="bg-background-50 border border-background-200/40 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{item.label}</p>
            <p className="text-lg font-heading font-bold mt-0.5">
              <span className={`${item.tone} ${!paused && item.tone === 'text-accent-400' ? 'tabular-nums' : ''}`}>{item.value}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}