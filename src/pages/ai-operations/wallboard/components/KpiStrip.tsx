import { getWallboardKpis } from '@/pages/ai-operations/wallboard/selectors';

interface KpiItem {
  label: string;
  value: string | number;
  tone: string;
  icon: string;
}

export default function KpiStrip({ large = false }: { large?: boolean }) {
  const k = getWallboardKpis();

  const items: KpiItem[] = [
    { label: 'Sites Healthy', value: k.sitesHealthy, tone: 'text-emerald-400', icon: 'ri-global-line' },
    { label: 'Agents Active', value: k.agentsOnline, tone: 'text-foreground-100', icon: 'ri-robot-2-line' },
    { label: 'Agents Working', value: k.agentsWorking, tone: 'text-accent-400', icon: 'ri-flashlight-line' },
    { label: 'Active Runs', value: k.activeRuns, tone: 'text-accent-400', icon: 'ri-play-circle-line' },
    { label: 'Queued Runs', value: k.queuedRuns, tone: 'text-foreground-200', icon: 'ri-stack-line' },
    { label: 'Pending Approvals', value: k.pendingApprovals, tone: 'text-amber-400', icon: 'ri-user-star-line' },
    { label: 'Critical Alerts', value: k.criticalAlerts, tone: k.criticalAlerts > 0 ? 'text-red-400' : 'text-foreground-200', icon: 'ri-alarm-warning-line' },
    { label: 'Failed Runs', value: k.failedRuns, tone: k.failedRuns > 0 ? 'text-red-400' : 'text-foreground-200', icon: 'ri-close-circle-line' },
    { label: 'AI Cost Today', value: k.aiCostToday, tone: 'text-foreground-100', icon: 'ri-money-pound-circle-line' },
  ];

  return (
    <section className="shrink-0 px-4 pt-4">
      <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[96px]"
          >
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 ${item.tone}`}>
                <i className={`${item.icon} text-base w-4 h-4 flex items-center justify-center`}></i>
              </span>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide leading-tight">
                {item.label}
              </p>
            </div>
            <p className={`${large ? 'text-5xl' : 'text-4xl'} font-heading font-bold ${item.tone} leading-none tabular-nums mt-2`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}