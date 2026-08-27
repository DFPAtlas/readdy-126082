import { Link } from 'react-router-dom';

const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

const ROTATION_OPTIONS = [
  { label: 'Rotation Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

interface WallboardHeaderProps {
  now: Date;
  lastRefreshed: Date;
  autoRefresh: number;
  onAutoRefreshChange: (seconds: number) => void;
  focusMode: boolean;
  onFocusToggle: () => void;
  fullscreen: boolean;
  onFullscreenToggle: () => void;
  rotation: number;
  onRotationChange: (seconds: number) => void;
}

export default function WallboardHeader({
  now,
  lastRefreshed,
  autoRefresh,
  onAutoRefreshChange,
  focusMode,
  onFocusToggle,
  fullscreen,
  onFullscreenToggle,
  rotation,
  onRotationChange,
}: WallboardHeaderProps) {
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-US', { hour12: false });

  return (
    <header className="shrink-0 flex items-center justify-between gap-4 px-5 h-16 border-b border-background-200/60 bg-background-100/60">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center shrink-0">
          <i className="ri-radar-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-heading font-bold text-foreground-50 leading-none whitespace-nowrap">
            DFP AI OPERATIONS
          </h1>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-widest mt-0.5 whitespace-nowrap">
            Group Wallboard
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Group AI Operational
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
        <div className="text-right leading-tight mr-1">
          <p className="text-base font-heading font-semibold text-foreground-50 tabular-nums whitespace-nowrap">{timeLabel}</p>
          <p className="text-[11px] font-label text-foreground-600 whitespace-nowrap">
            {dateLabel} · Refresh {lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-2.5 py-1.5 cursor-pointer whitespace-nowrap">
          <span className="text-foreground-600">Auto</span>
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

        <label className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-2.5 py-1.5 cursor-pointer whitespace-nowrap">
          <select
            value={rotation}
            onChange={(e) => onRotationChange(Number(e.target.value))}
            className="bg-transparent text-foreground-200 outline-none cursor-pointer"
            aria-label="Auto rotation interval"
          >
            {ROTATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-background-100 text-foreground-100">{o.label}</option>
            ))}
          </select>
        </label>

        <button
          onClick={onFocusToggle}
          className={`inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
            focusMode
              ? 'text-accent-400 bg-accent-500/15 border-accent-500/30'
              : 'text-foreground-300 bg-background-100 border-background-200/60 hover:border-background-300/60'
          }`}
        >
          <i className="ri-focus-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
          {focusMode ? 'Standard' : 'Focus'}
        </button>

        <button
          onClick={onFullscreenToggle}
          className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-foreground-300 bg-background-100 border-background-200/60 hover:border-background-300/60"
        >
          <i className={`${fullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
          {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>

        <Link
          to="/ai-operations/live"
          className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-accent-400 bg-accent-500/10 border-accent-500/25 hover:bg-accent-500/20"
        >
          <i className="ri-logout-box-r-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Exit Wallboard
        </Link>
      </div>
    </header>
  );
}