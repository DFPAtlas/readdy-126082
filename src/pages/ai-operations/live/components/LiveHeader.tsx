import { getStatusBarMetrics } from '@/pages/ai-operations/live/selectors';

const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

interface LiveHeaderProps {
  autoRefresh: number;
  onAutoRefreshChange: (seconds: number) => void;
  paused: boolean;
  onPauseToggle: () => void;
  focusMode: boolean;
  onFocusToggle: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  lastRefreshed: Date;
}

export default function LiveHeader({
  autoRefresh,
  onAutoRefreshChange,
  paused,
  onPauseToggle,
  focusMode,
  onFocusToggle,
  refreshing,
  onRefresh,
  lastRefreshed,
}: LiveHeaderProps) {
  const metrics = getStatusBarMetrics();

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Live AI Operations</h1>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
            Partial Live
          </span>
          {paused && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
              <i className="ri-pause-circle-line w-3.5 h-3.5 flex items-center justify-center"></i>
              View paused
            </span>
          )}
        </div>
        <p className="text-sm text-foreground-500 mt-1 max-w-3xl">
          Real-time operational view of AI agents, tasks, approvals, alerts and site activity across the Digital Footprint group.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-label text-foreground-500">
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-foreground-600' : 'bg-amber-400 animate-pulse'}`}></span>
            <span className="text-foreground-300">Source:</span>
            <span className="text-amber-400 font-medium">Partial Live</span>
          </span>
          <span className="whitespace-nowrap">Agents registered · <span className="text-foreground-200">{metrics.agentsWorking}</span></span>
          <span className="whitespace-nowrap">Active runs · <span className="text-foreground-200">{metrics.activeRuns}</span></span>
          <span className="whitespace-nowrap">Queue depth · <span className="text-foreground-200">{metrics.queuedRuns}</span></span>
          <span className="whitespace-nowrap">Pending approvals · <span className="text-foreground-200">{metrics.pendingApprovals}</span></span>
          <span className="whitespace-nowrap">
            Critical issues · <span className={metrics.criticalAlerts > 0 ? 'text-red-400 font-medium' : 'text-foreground-200'}>{metrics.criticalAlerts}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          title="Refresh live registry data"
        >
          <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}></i>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>

        <label className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 cursor-pointer whitespace-nowrap">
          <span className="text-foreground-500">Auto</span>
          <select
            value={autoRefresh}
            onChange={(e) => onAutoRefreshChange(Number(e.target.value))}
            className="bg-transparent text-foreground-200 outline-none cursor-pointer"
            aria-label="Auto refresh interval"
          >
            {AUTO_REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-background-100 text-foreground-100">{o.label}</option>
            ))}
          </select>
        </label>

        <button
          onClick={onPauseToggle}
          className={`inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-2 border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
            paused
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
              : 'text-foreground-200 bg-background-100 border-background-200/60 hover:border-background-300/60'
          }`}
          title={paused ? 'Resume view' : 'Pause view'}
        >
          <i className={`${paused ? 'ri-play-circle-line' : 'ri-pause-circle-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
          {paused ? 'Resume View' : 'Pause View'}
        </button>

        <button
          onClick={onFocusToggle}
          className={`inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-2 border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
            focusMode
              ? 'text-accent-400 bg-accent-500/10 border-accent-500/25'
              : 'text-foreground-200 bg-background-100 border-background-200/60 hover:border-background-300/60'
          }`}
          title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        >
          <i className="ri-fullscreen-line text-sm w-4 h-4 flex items-center justify-center"></i>
          {focusMode ? 'Exit Focus' : 'Focus Mode'}
        </button>
      </div>
    </div>
  );
}