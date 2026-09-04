import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getWallboardOverallState, type WallboardOverallState } from '@/pages/ai-operations/wallboard/selectors';
import type { WallboardClockFormat } from '@/pages/ai-operations/wallboard/wallboardSettings';

const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

const ROTATION_OPTIONS = [
  { label: 'Rotation Off', value: 0 },
  { label: '20s', value: 20 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

const OVERALL_STATE_META: Record<WallboardOverallState, { badge: string; dot: string; icon: string }> = {
  normal: {
    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-400',
    icon: 'ri-check-double-line',
  },
  degraded: {
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: 'ri-alert-line',
  },
  action_required: {
    badge: 'text-red-400 bg-red-500/10 border-red-500/30',
    dot: 'bg-red-400',
    icon: 'ri-flag-2-line',
  },
  critical: {
    badge: 'text-red-400 bg-red-500/15 border-red-500/40',
    dot: 'bg-red-400',
    icon: 'ri-error-warning-line',
  },
  unknown: {
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: 'ri-question-line',
  },
};

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
  onRotationPrevious: () => void;
  onRotationNext: () => void;
  clockFormat: WallboardClockFormat;
  onSettingsOpen: () => void;
  canDiagnostics: boolean;
  onDiagnosticsOpen: () => void;
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
  onRotationPrevious,
  onRotationNext,
  clockFormat,
  onSettingsOpen,
  canDiagnostics,
  onDiagnosticsOpen,
}: WallboardHeaderProps) {
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-US', { hour12: clockFormat === '12h' });

  const overall = getWallboardOverallState();
  const stateMeta = OVERALL_STATE_META[overall.state];

  // The Settings panel allows arbitrary bounded intervals (e.g. rotation 25s,
  // refresh 45s). Ensure the current value is always present among the quick
  // options so a fine-grained value never desyncs the select (which would emit
  // a React "value does not match any option" warning and blank the control).
  const autoRefreshOptions = useMemo(() => {
    if (autoRefresh !== 0 && !AUTO_REFRESH_OPTIONS.some((o) => o.value === autoRefresh)) {
      return [...AUTO_REFRESH_OPTIONS, { label: `${autoRefresh}s`, value: autoRefresh }].sort(
        (a, b) => a.value - b.value,
      );
    }
    return AUTO_REFRESH_OPTIONS;
  }, [autoRefresh]);

  const rotationOptions = useMemo(() => {
    if (rotation !== 0 && !ROTATION_OPTIONS.some((o) => o.value === rotation)) {
      return [...ROTATION_OPTIONS, { label: `${rotation}s`, value: rotation }].sort(
        (a, b) => a.value - b.value,
      );
    }
    return ROTATION_OPTIONS;
  }, [rotation]);

  return (
    <header className="shrink-0 flex items-center gap-4 px-5 py-3 border-b border-background-200/60 bg-background-100/60">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center shrink-0">
          <i className="ri-radar-line text-background-950 text-xl w-6 h-6 flex items-center justify-center"></i>
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground-50 leading-none whitespace-nowrap">
            DFP COMMAND
          </h1>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-widest mt-0.5 whitespace-nowrap">
            Wallboard
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2.5 rounded-lg px-4 py-2 border ${stateMeta.badge}`}>
            <span className={`w-3 h-3 rounded-full ${stateMeta.dot}`}></span>
            <span className="text-lg font-heading font-bold tracking-wide whitespace-nowrap">{overall.label}</span>
          </span>
          <span className="text-xs font-label text-foreground-600 hidden xl:block whitespace-nowrap">{overall.detail}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
        <div className="text-right leading-tight mr-1">
          <p className="text-2xl font-heading font-semibold text-foreground-50 tabular-nums whitespace-nowrap">{timeLabel}</p>
          <p className="text-[11px] font-label text-foreground-600 whitespace-nowrap">
            {dateLabel} · Refresh {lastRefreshed.toLocaleTimeString('en-US', { hour12: clockFormat === '12h' })}
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
            {autoRefreshOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-background-100 text-foreground-100">{o.label}</option>
            ))}
          </select>
        </label>

        <div className="inline-flex items-center gap-1 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-1.5 py-1 whitespace-nowrap">
          <button
            onClick={onRotationPrevious}
            className="w-7 h-7 flex items-center justify-center rounded text-foreground-300 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer"
            aria-label="Previous view"
            title="Previous view"
          >
            <i className="ri-arrow-left-s-line w-4 h-4 flex items-center justify-center"></i>
          </button>
          <select
            value={rotation}
            onChange={(e) => onRotationChange(Number(e.target.value))}
            className="bg-transparent text-foreground-200 outline-none cursor-pointer"
            aria-label="Auto rotation interval"
          >
            {rotationOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-background-100 text-foreground-100">{o.label}</option>
            ))}
          </select>
          <button
            onClick={onRotationNext}
            className="w-7 h-7 flex items-center justify-center rounded text-foreground-300 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer"
            aria-label="Next view"
            title="Next view"
          >
            <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
          </button>
        </div>

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

        {canDiagnostics && (
          <button
            onClick={onDiagnosticsOpen}
            className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-primary-400 bg-primary-500/10 border-primary-500/25 hover:bg-primary-500/20"
          >
            <i className="ri-stethoscope-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Diagnostics
          </button>
        )}

        <button
          onClick={onSettingsOpen}
          className="inline-flex items-center gap-2 text-xs font-label rounded-md px-3 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-foreground-300 bg-background-100 border-background-200/60 hover:border-background-300/60"
        >
          <i className="ri-settings-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Settings
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