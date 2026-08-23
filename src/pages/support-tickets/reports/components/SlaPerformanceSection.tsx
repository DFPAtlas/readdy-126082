import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  SupportSlaSummary,
  SupportSlaBreach,
  SlaBreachSortKey,
} from '@/types/support-tickets';
import { priorityLabels, statusLabels } from '@/pages/support-tickets/constants';

type SortDir = 'asc' | 'desc';

interface SortState {
  key: SlaBreachSortKey;
  dir: SortDir;
}

const PRIORITY_RANK: Record<string, number> = {
  critical: 5,
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const SORTABLE_COLUMNS: { key: SlaBreachSortKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'breach_type', label: 'Breach type' },
  { key: 'due_time', label: 'Due time' },
  { key: 'breached_duration', label: 'Breached' },
  { key: 'website', label: 'Website' },
];

function formatDuration(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr === 0 ? `${d}d` : `${d}d ${hr}h`;
}

function formatDueTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function valueOf(row: SupportSlaBreach, key: SlaBreachSortKey): string | number {
  switch (key) {
    case 'priority':
      return PRIORITY_RANK[row.priority] ?? 0;
    case 'breach_type':
      return row.breach_type;
    case 'due_time':
      return row.due_time ?? '';
    case 'breached_duration':
      return row.breached_seconds ?? -1;
    case 'website':
      return row.site_name;
  }
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-label font-medium uppercase tracking-wider text-[11px] text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
    >
      {label}
      <i
        className={`${
          active ? (dir === 'asc' ? 'ri-arrow-up-line' : 'ri-arrow-down-line') : 'ri-expand-up-down-line'
        } text-xs w-3 h-3 flex items-center justify-center ${active ? 'text-accent-400' : 'opacity-50'}`}
        aria-hidden="true"
      ></i>
    </button>
  );
}

function SlaSummaryPanel({
  summary,
  loading,
}: {
  summary: SupportSlaSummary | null;
  loading: boolean;
}) {
  const compliance = summary?.compliance_percent;
  const complianceLabel =
    compliance == null ? '—' : `${compliance}%`;

  const items: {
    label: string;
    value: string;
    icon: string;
    accent: string;
    description: string;
  }[] = [
    {
      label: 'Compliance',
      value: complianceLabel,
      icon: 'ri-shield-check-line',
      accent: compliance == null ? 'text-foreground-400' : compliance >= 90 ? 'text-emerald-400' : compliance >= 70 ? 'text-amber-400' : 'text-red-400',
      description: 'Resolved within the resolution SLA target.',
    },
    {
      label: 'Total breaches',
      value: summary ? String(summary.total_breaches) : '—',
      icon: 'ri-timer-flash-line',
      accent: 'text-red-400',
      description: 'First-response + resolution breaches in period.',
    },
    {
      label: 'Active overdue',
      value: summary ? String(summary.active_overdue) : '—',
      icon: 'ri-alarm-warning-line',
      accent: 'text-orange-400',
      description: 'Active tickets past their due time.',
    },
    {
      label: 'First response',
      value: summary ? String(summary.first_response_breaches) : '—',
      icon: 'ri-chat-1-line',
      accent: 'text-amber-400',
      description: 'Breaches where no reply was sent in time.',
    },
    {
      label: 'Resolution',
      value: summary ? String(summary.resolution_breaches) : '—',
      icon: 'ri-check-double-line',
      accent: 'text-red-400',
      description: 'Breaches where resolution missed its target.',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-background-50 border border-background-200/60 rounded-lg p-3 md:p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wider whitespace-nowrap">
              {item.label}
            </span>
            <i className={`${item.icon} ${item.accent} text-base w-5 h-5 flex items-center justify-center`}></i>
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-14 rounded-md bg-background-200/60 animate-pulse" aria-hidden="true"></div>
          ) : (
            <p
              className="text-xl font-heading font-bold text-foreground-50 mt-1 tabular-nums"
              aria-label={`${item.label}: ${item.value}`}
            >
              {item.value}
            </p>
          )}
          <p className="text-[11px] text-foreground-500 mt-1 leading-snug">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

interface SlaPerformanceSectionProps {
  summary: SupportSlaSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  rows: SupportSlaBreach[] | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  onRetry: () => void;
}

export default function SlaPerformanceSection({
  summary,
  summaryLoading,
  summaryError,
  rows,
  loading,
  error,
  lastRefreshed,
  onRetry,
}: SlaPerformanceSectionProps) {
  const [sort, setSort] = useState<SortState>({ key: 'priority', dir: 'desc' });

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      if (av === bv) {
        // Secondary: longest breach duration first.
        return ((b.breached_seconds ?? -1) - (a.breached_seconds ?? -1));
      }
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort]);

  const toggleSort = (key: SlaBreachSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' },
    );
  };

  const ariaSortFor = (key: SlaBreachSortKey): 'ascending' | 'descending' | 'none' =>
    sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  const renderTable = () => {
    if (loading) {
      return (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-background-200/40 animate-pulse"></div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-6 flex flex-col items-center justify-center gap-3">
          <i className="ri-error-warning-line text-red-400 text-2xl w-8 h-8 flex items-center justify-center"></i>
          <p className="text-sm text-red-400 text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-sm text-red-300 hover:text-red-200 px-3 py-2 rounded-lg border border-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
        </div>
      );
    }

    if (!rows || rows.length === 0) {
      return (
        <div className="mt-3 rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-8 flex flex-col items-center justify-center gap-2">
          <i className="ri-shield-check-line text-foreground-500 text-2xl w-8 h-8 flex items-center justify-center"></i>
          <p className="text-sm text-foreground-400">No active SLA breaches in this period.</p>
        </div>
      );
    }

    return (
      <>
        {/* Desktop table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <caption className="sr-only">Active SLA-breach tickets</caption>
            <thead>
              <tr className="text-left border-b border-background-200/60">
                <th scope="col" className="py-2 pr-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Ticket
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Website"
                    active={sort.key === 'website'}
                    dir={sort.dir}
                    onClick={() => toggleSort('website')}
                  />
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Priority"
                    active={sort.key === 'priority'}
                    dir={sort.dir}
                    onClick={() => toggleSort('priority')}
                  />
                </th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Assigned
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Breach type"
                    active={sort.key === 'breach_type'}
                    dir={sort.dir}
                    onClick={() => toggleSort('breach_type')}
                  />
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Due time"
                    active={sort.key === 'due_time'}
                    dir={sort.dir}
                    onClick={() => toggleSort('due_time')}
                  />
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Breached"
                    active={sort.key === 'breached_duration'}
                    dir={sort.dir}
                    onClick={() => toggleSort('breached_duration')}
                  />
                </th>
                <th scope="col" className="py-2 pl-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Last activity
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.ticket_id}
                  className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors"
                >
                  <th scope="row" className="py-3 pr-3">
                    <Link
                      to={`/support-tickets/${row.ticket_id}`}
                      className="block group"
                    >
                      <span className="font-medium text-foreground-100 group-hover:text-accent-300 transition-colors whitespace-nowrap">
                        {row.ticket_number}
                      </span>
                      <span className="block text-xs text-foreground-500 truncate max-w-[200px]">
                        {row.subject}
                      </span>
                    </Link>
                  </th>
                  <td className="py-3 px-3 text-foreground-300 whitespace-nowrap">{row.site_name}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 text-foreground-200 whitespace-nowrap">
                      {PRIORITY_RANK[row.priority] >= 4 && (
                        <i className="ri-alarm-warning-line text-orange-400 text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                      )}
                      {priorityLabels[row.priority] ?? row.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-foreground-300 whitespace-nowrap">
                    {statusLabels[row.status] ?? row.status}
                  </td>
                  <td className="py-3 px-3 text-foreground-300 whitespace-nowrap">
                    {row.assigned_name ?? '—'}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {row.breach_type === 'first_response' ? (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <i className="ri-chat-1-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                        First response
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <i className="ri-check-double-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                        Resolution
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums whitespace-nowrap">
                    {formatDueTime(row.due_time)}
                  </td>
                  <td className="py-3 px-3 text-red-400 font-medium tabular-nums whitespace-nowrap">
                    {formatDuration(row.breached_seconds)}
                  </td>
                  <td className="py-3 pl-3 text-foreground-300 whitespace-nowrap">
                    {formatLastActivity(row.last_activity_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="mt-3 md:hidden space-y-3">
          {visibleRows.map((row) => (
            <div
              key={row.ticket_id}
              className="bg-background-200/40 border border-background-200/60 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/support-tickets/${row.ticket_id}`}
                    className="font-medium text-foreground-100 hover:text-accent-300 transition-colors"
                  >
                    {row.ticket_number}
                  </Link>
                  <p className="text-xs text-foreground-500 truncate">{row.subject}</p>
                </div>
                <Link
                  to={`/support-tickets/${row.ticket_id}`}
                  aria-label={`Open ticket ${row.ticket_number}`}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-background-300/60 text-foreground-300 hover:text-foreground-50 transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-right-up-line text-base w-5 h-5 flex items-center justify-center"></i>
                </Link>
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-foreground-300 whitespace-nowrap">
                  {PRIORITY_RANK[row.priority] >= 4 && (
                    <i className="ri-alarm-warning-line text-orange-400 text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                  )}
                  {priorityLabels[row.priority] ?? row.priority}
                </span>
                <span className="text-xs text-foreground-500">·</span>
                {row.breach_type === 'first_response' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <i className="ri-chat-1-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                    First response
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-red-400">
                    <i className="ri-check-double-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                    Resolution
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Due time</dt>
                  <dd className="text-sm font-semibold text-foreground-200 tabular-nums">
                    {formatDueTime(row.due_time)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Breached</dt>
                  <dd className="text-sm font-semibold text-red-400 tabular-nums">
                    {formatDuration(row.breached_seconds)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Website</dt>
                  <dd className="text-sm font-semibold text-foreground-200">{row.site_name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Status</dt>
                  <dd className="text-sm font-semibold text-foreground-200">
                    {statusLabels[row.status] ?? row.status}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-heading font-semibold text-foreground-100">
            SLA performance
          </h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Service-level agreement compliance and active breach tickets.
          </p>
        </div>
        {lastRefreshed && !loading && (
          <span className="text-xs text-foreground-500 whitespace-nowrap">
            Refreshed{' '}
            {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div aria-live="polite">
        <SlaSummaryPanel summary={summary} loading={summaryLoading} />
        {summaryError && !summaryLoading && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
            <i className="ri-error-warning-line text-red-400 text-base w-5 h-5 flex items-center justify-center"></i>
            <p className="text-sm text-red-400 flex-1">{summaryError}</p>
          </div>
        )}
      </div>

      <div className="border-t border-background-200/60 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-heading font-semibold text-foreground-200">
            Active breach tickets
          </h3>
          <span className="text-xs text-foreground-500">
            Showing up to 50 breaches
          </span>
        </div>
        {renderTable()}
      </div>
    </div>
  );
}