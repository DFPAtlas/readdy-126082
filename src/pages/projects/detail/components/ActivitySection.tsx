import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';
import {
  ActivityEvent,
  LifecycleMilestone,
  ActivitySource,
  SOURCE_LABELS,
  SOURCE_STYLES,
  CATEGORY_LABELS,
  IMPORTANCE_LABELS,
  IMPORTANCE_STYLES,
  SOURCE_FILTER_OPTIONS,
  TIME_RANGE_OPTIONS,
  SourceFilter,
  TimeRange,
  applyActivityFilters,
  activityToCsv,
} from '../activityTypes';

const PAGE_SIZE = 50;

function fullTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeTime(dateStr: string): string | null {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return null;
}

interface ActivitySectionProps {
  project: Project;
  events: ActivityEvent[];
  milestones: LifecycleMilestone[];
  loading: boolean;
  error: string | null;
  lifecycleStatusLabel: string;
  operationalHealthLabel: string;
  onRefresh: () => void;
}

export default function ActivitySection({
  project,
  events,
  milestones,
  loading,
  error,
  lifecycleStatusLabel,
  operationalHealthLabel,
  onRefresh,
}: ActivitySectionProps) {
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () => applyActivityFilters(events, { source, timeRange, search }),
    [events, source, timeRange, search],
  );

  const shown = filtered.slice(0, visible);
  const lastEvent = events[0] ?? null;
  const lastCritical = events.find((e) => e.importance === 'CRITICAL') ?? null;

  const exportCsv = () => {
    const csv = activityToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.project_slug}-activity.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-6 py-8 animate-pulse space-y-3">
        <div className="h-20 bg-background-50 border border-background-200/60 rounded-lg"></div>
        <div className="h-12 bg-background-50 border border-background-200/60 rounded-lg"></div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-background-50 border border-background-200/60 rounded-lg"></div>
        ))}
      </div>
    );
  }

  // ─── Error (primary source unavailable, nothing else to show) ─────────
  if (error && events.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <i className="ri-error-warning-line text-2xl text-red-400 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Activity could not be loaded.</h3>
        <p className="text-sm text-foreground-500 mb-5">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            <i className="ri-history-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Project Activity
          </h3>
          <div className="flex items-center gap-2 flex-wrap mt-3 text-xs">
            <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Lifecycle</span>
            <span className="text-[11px] font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 whitespace-nowrap capitalize">
              {lifecycleStatusLabel}
            </span>
            <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide ml-2">Operational Health</span>
            <span className="text-[11px] font-label text-foreground-200 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 whitespace-nowrap">
              {operationalHealthLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Export Activity
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Refresh
          </button>
          <Link
            to="/activity-log"
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open Global Activity Log
          </Link>
        </div>
      </div>

      {/* Lifecycle milestones */}
      {milestones.length > 0 && (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-4">
          <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-4">Lifecycle Milestones</p>
          <div className="flex items-start gap-0 overflow-x-auto no-scrollbar">
            {milestones.map((m, i) => (
              <div key={m.key} className="flex items-start min-w-0 flex-1">
                <div className="flex flex-col items-center text-center px-1 min-w-[80px]">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                      m.reached
                        ? 'bg-accent-500/15 border-accent-500/30 text-accent-400'
                        : 'bg-background-100 border-background-300/60 text-foreground-600'
                    }`}
                  >
                    <i className={`${m.reached ? 'ri-check-line' : 'ri-more-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
                  </div>
                  <span className={`text-[10px] font-label mt-2 whitespace-nowrap ${m.reached ? 'text-foreground-200' : 'text-foreground-600'}`}>
                    {m.label}
                  </span>
                  {m.reached && m.timestamp && (
                    <span className="text-[9px] text-foreground-600 whitespace-nowrap mt-0.5">
                      {new Date(m.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                {i < milestones.length - 1 && (
                  <div className={`flex-1 h-px mt-3.5 ${milestones[i + 1].reached ? 'bg-accent-500/30' : 'bg-background-300/40'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, actor, source, reference…"
              className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            className="bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
          >
            {SOURCE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
          >
            {TIME_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-foreground-500 mt-2">
          {filtered.length} of {events.length} significant events
        </p>
      </div>

      {/* Supplemental-source warning (primary source unavailable) */}
      {error && events.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
          <i className="ri-alert-line text-amber-400 w-4 h-4 flex items-center justify-center"></i>
          <p className="text-xs text-amber-400">Project activity log unavailable — showing cross-system events only.</p>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !error && (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-history-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {events.length === 0 ? 'No project activity recorded yet.' : 'No events match your filters.'}
          </h3>
          <p className="text-sm text-foreground-500">
            {events.length === 0
              ? 'Significant project events will appear here as they occur.'
              : 'Try adjusting your filters or time range.'}
          </p>
        </div>
      )}

      {/* Timeline */}
      {shown.length > 0 && (
        <div className="relative pl-8">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-background-200"></div>
          <div className="space-y-1">
            {shown.map((event) => (
              <TimelineRow key={event.key} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Load more */}
      {visible < filtered.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="text-sm font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-4 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            Load more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}

      {/* Last critical / last activity summary strip */}
      {(lastEvent || lastCritical) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-background-200/60 pt-4">
          {lastEvent && (
            <div className="flex items-center gap-3 bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
              <i className="ri-time-line text-foreground-400 w-5 h-5 flex items-center justify-center"></i>
              <div className="min-w-0">
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">Last Significant Activity</p>
                <p className="text-sm text-foreground-200 truncate">{lastEvent.title}</p>
                <p className="text-[10px] text-foreground-500">{relativeTime(lastEvent.timestamp) ?? fullTimestamp(lastEvent.timestamp)}</p>
              </div>
            </div>
          )}
          {lastCritical && (
            <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">
              <i className="ri-alert-fill text-red-400 w-5 h-5 flex items-center justify-center"></i>
              <div className="min-w-0">
                <p className="text-[10px] font-label text-red-400 uppercase tracking-wide">Last Critical Event</p>
                <p className="text-sm text-foreground-200 truncate">{lastCritical.title}</p>
                <p className="text-[10px] text-foreground-500">{relativeTime(lastCritical.timestamp) ?? fullTimestamp(lastCritical.timestamp)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Timeline row ──────────────────────────────────────────────────────────

function TimelineRow({ event }: { event: ActivityEvent }) {
  const importanceDot: Record<string, string> = {
    NORMAL: 'border-foreground-400 bg-foreground-500/20',
    IMPORTANT: 'border-sky-400 bg-sky-500/20',
    WARNING: 'border-amber-400 bg-amber-500/20',
    CRITICAL: 'border-red-400 bg-red-500/20',
  };

  return (
    <div className="relative pb-3 last:pb-0">
      <div className={`absolute left-[-32px] top-1.5 w-[7px] h-[7px] rounded-full border-2 ${importanceDot[event.importance]}`}></div>

      <div className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5 hover:border-background-300/60 transition-colors duration-150">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center shrink-0 mt-0.5">
            <i className={`${sourceIcon(event.source)} text-xs text-foreground-400 w-3.5 h-3.5 flex items-center justify-center`}></i>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-foreground-200 leading-snug">{event.title}</p>
              <span className="text-[10px] text-foreground-600 whitespace-nowrap shrink-0" title={fullTimestamp(event.timestamp)}>
                {relativeTime(event.timestamp) ?? fullTimestamp(event.timestamp)}
              </span>
            </div>

            {event.description && (
              <p className="text-xs text-foreground-500 leading-relaxed mt-1 whitespace-pre-wrap">{event.description}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${SOURCE_STYLES[event.source]}`}>
                {SOURCE_LABELS[event.source]}
              </span>
              <span className="text-[10px] font-label text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                {CATEGORY_LABELS[event.category]}
              </span>
              {event.importance !== 'NORMAL' && (
                <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${IMPORTANCE_STYLES[event.importance]}`}>
                  {IMPORTANCE_LABELS[event.importance]}
                </span>
              )}
              {event.actor && (
                <span className="flex items-center gap-1 text-[10px] text-foreground-500 whitespace-nowrap">
                  <i className="ri-user-line w-3 h-3 flex items-center justify-center"></i>
                  {event.actor}
                </span>
              )}
              {event.relatedObjectType && (
                <span className="text-[10px] text-foreground-600 whitespace-nowrap">
                  {event.relatedObjectType}
                  {event.relatedObjectId ? ` · ${event.relatedObjectId}` : ''}
                </span>
              )}
              {event.deepLink && (
                <Link
                  to={event.deepLink.to}
                  className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap cursor-pointer ml-auto"
                >
                  {event.deepLink.label} <i className="ri-arrow-right-up-line w-3 h-3 flex items-center justify-center"></i>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function sourceIcon(source: ActivitySource): string {
  switch (source) {
    case 'BUILD':
      return 'ri-hammer-line';
    case 'GITHUB':
      return 'ri-github-line';
    case 'READDY':
      return 'ri-cloud-line';
    case 'INFRASTRUCTURE':
      return 'ri-server-line';
    case 'AI OPS':
      return 'ri-robot-2-line';
    case 'UAT':
      return 'ri-clipboard-line';
    case 'BUGS':
      return 'ri-bug-line';
    case 'CHANGES':
      return 'ri-git-pull-request-line';
    case 'BUDGET':
      return 'ri-money-pound-circle-line';
    case 'SUPPORT':
      return 'ri-lifebuoy-line';
    case 'MONITORING':
      return 'ri-pulse-line';
    case 'DEPLOYMENT':
      return 'ri-rocket-line';
    default:
      return 'ri-record-circle-line';
  }
}