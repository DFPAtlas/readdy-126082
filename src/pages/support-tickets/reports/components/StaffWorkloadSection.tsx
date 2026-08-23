import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  SupportStaffWorkload,
  SupportUnassignedSummary,
  StaffWorkloadSortKey,
} from '@/types/support-tickets';

type SortDir = 'asc' | 'desc';

interface SortState {
  key: StaffWorkloadSortKey;
  dir: SortDir;
}

const SORTABLE_COLUMNS: { key: StaffWorkloadSortKey; label: string }[] = [
  { key: 'staff', label: 'Staff member' },
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'response', label: 'Avg first response' },
  { key: 'resolution', label: 'Avg resolution' },
];

function valueOf(row: SupportStaffWorkload, key: StaffWorkloadSortKey): string | number {
  switch (key) {
    case 'staff':
      return (row.staff_name ?? row.staff_email ?? row.user_id).toLowerCase();
    case 'open':
      return row.open_assigned;
    case 'overdue':
      return row.overdue_assigned;
    case 'resolved':
      return row.resolved;
    case 'response':
      return row.avg_first_response_seconds ?? -1;
    case 'resolution':
      return row.avg_resolution_seconds ?? -1;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

function ageLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
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

function UnassignedSummary({
  summary,
  loading,
  siteParam,
}: {
  summary: SupportUnassignedSummary | null;
  loading: boolean;
  siteParam: string;
}) {
  const items: {
    label: string;
    value: string;
    icon: string;
    accent: string;
    to: string;
    description: string;
  }[] = [
    {
      label: 'Active unassigned',
      value: summary ? String(summary.active_unassigned) : '—',
      icon: 'ri-inbox-unarchive-line',
      accent: 'text-foreground-300',
      to: `/support-tickets?assigned=unassigned${siteParam}`,
      description: 'Open tickets with no assignee.',
    },
    {
      label: 'Overdue',
      value: summary ? String(summary.overdue_unassigned) : '—',
      icon: 'ri-alarm-warning-line',
      accent: 'text-orange-400',
      to: `/support-tickets?assigned=unassigned&overdue=1${siteParam}`,
      description: 'Unassigned tickets past due.',
    },
    {
      label: 'Urgent',
      value: summary ? String(summary.urgent_unassigned) : '—',
      icon: 'ri-alarm-line',
      accent: 'text-amber-400',
      to: `/support-tickets?assigned=unassigned&priority=urgent${siteParam}`,
      description: 'Unassigned urgent tickets.',
    },
    {
      label: 'Critical',
      value: summary ? String(summary.critical_unassigned) : '—',
      icon: 'ri-error-warning-line',
      accent: 'text-red-400',
      to: `/support-tickets?assigned=unassigned&priority=critical${siteParam}`,
      description: 'Unassigned critical tickets.',
    },
    {
      label: 'Oldest unassigned',
      value: summary?.oldest_ticket_number ?? '—',
      icon: 'ri-history-line',
      accent: 'text-secondary-300',
      to: summary?.oldest_ticket_id
        ? `/support-tickets/${summary.oldest_ticket_id}`
        : `/support-tickets?assigned=unassigned${siteParam}`,
      description: summary?.oldest_created_at
        ? `Waiting ${ageLabel(summary.oldest_created_at)}.`
        : 'No unassigned tickets.',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="bg-background-50 border border-background-200/60 rounded-lg p-3 md:p-4 transition-colors hover:border-foreground-400/40 group"
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
            <p className="text-xl font-heading font-bold text-foreground-50 mt-1 tabular-nums group-hover:text-accent-300 transition-colors">
              {item.value}
            </p>
          )}
          <p className="text-[11px] text-foreground-500 mt-1 leading-snug">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}

interface StaffWorkloadSectionProps {
  summary: SupportUnassignedSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  rows: SupportStaffWorkload[] | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  onRetry: () => void;
  siteId: string | null;
  canView: boolean;
}

export default function StaffWorkloadSection({
  summary,
  summaryLoading,
  summaryError,
  rows,
  loading,
  error,
  lastRefreshed,
  onRetry,
  siteId,
  canView,
}: StaffWorkloadSectionProps) {
  const [sort, setSort] = useState<SortState>({ key: 'overdue', dir: 'desc' });

  const siteParam = siteId ? `&site=${encodeURIComponent(siteId)}` : '';

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      if (typeof av === 'number' && typeof bv === 'number') {
        if (av !== bv) return (av - bv) * dir;
      } else {
        const cmp = String(av).localeCompare(String(bv));
        if (cmp !== 0) return cmp * dir;
      }
      return (a.staff_name ?? '').localeCompare(b.staff_name ?? '');
    });
  }, [rows, sort]);

  const hasAnyActivity = useMemo(() => {
    if (!rows) return false;
    return rows.some(
      (r) =>
        r.open_assigned > 0 ||
        r.overdue_assigned > 0 ||
        r.received > 0 ||
        r.resolved > 0 ||
        r.critical_urgent_assigned > 0,
    );
  }, [rows]);

  const toggleSort = (key: StaffWorkloadSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' },
    );
  };

  const ariaSortFor = (key: StaffWorkloadSortKey): 'ascending' | 'descending' | 'none' =>
    sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  const renderRestricted = () => (
    <div className="rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-8 flex flex-col items-center justify-center gap-2">
      <i className="ri-lock-line text-foreground-500 text-2xl w-8 h-8 flex items-center justify-center"></i>
      <p className="text-sm text-foreground-400 text-center max-w-md">
        Staff workload is visible to owner and admin users only.
      </p>
    </div>
  );

  const renderError = (message: string) => (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-6 flex flex-col items-center justify-center gap-3">
      <i className="ri-error-warning-line text-red-400 text-2xl w-8 h-8 flex items-center justify-center"></i>
      <p className="text-sm text-red-400 text-center max-w-md">{message}</p>
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

    if (error) return renderError(error);

    if (!rows || rows.length === 0) {
      return (
        <div className="mt-3 rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-8 flex flex-col items-center justify-center gap-2">
          <i className="ri-user-star-line text-foreground-500 text-2xl w-8 h-8 flex items-center justify-center"></i>
          <p className="text-sm text-foreground-400">No assignment data available yet.</p>
        </div>
      );
    }

    return (
      <>
        {!hasAnyActivity && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-3">
            <i className="ri-information-line text-foreground-500 text-base w-5 h-5 flex items-center justify-center"></i>
            <p className="text-sm text-foreground-400">No active or received tickets in this period.</p>
          </div>
        )}

        {/* Desktop table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <caption className="sr-only">Staff workload by support team member</caption>
            <thead>
              <tr className="text-left border-b border-background-200/60">
                <th scope="col" className="py-2 pr-3">
                  <SortButton
                    label="Staff member"
                    active={sort.key === 'staff'}
                    dir={sort.dir}
                    onClick={() => toggleSort('staff')}
                  />
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Open"
                    active={sort.key === 'open'}
                    dir={sort.dir}
                    onClick={() => toggleSort('open')}
                  />
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Overdue"
                    active={sort.key === 'overdue'}
                    dir={sort.dir}
                    onClick={() => toggleSort('overdue')}
                  />
                </th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">
                  Received
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Resolved"
                    active={sort.key === 'resolved'}
                    dir={sort.dir}
                    onClick={() => toggleSort('resolved')}
                  />
                </th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Critical/urgent
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Avg first response"
                    active={sort.key === 'response'}
                    dir={sort.dir}
                    onClick={() => toggleSort('response')}
                  />
                </th>
                <th scope="col" className="py-2 px-3">
                  <SortButton
                    label="Avg resolution"
                    active={sort.key === 'resolution'}
                    dir={sort.dir}
                    onClick={() => toggleSort('resolution')}
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
                  key={row.user_id}
                  className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors"
                >
                  <th scope="row" className="py-3 pr-3">
                    <Link
                      to={`/support-tickets?assigned=${row.user_id}${siteParam}`}
                      className="block group"
                    >
                      <span className="font-medium text-foreground-100 group-hover:text-accent-300 transition-colors">
                        {row.staff_name ?? 'Unknown'}
                      </span>
                      <span className="block text-xs text-foreground-500 truncate max-w-[180px]">
                        {row.staff_email ?? ''}
                      </span>
                    </Link>
                  </th>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.open_assigned}</td>
                  <td className="py-3 px-3 tabular-nums">
                    {row.overdue_assigned > 0 ? (
                      <span className="inline-flex items-center gap-1 text-orange-400 font-medium">
                        <i className="ri-alarm-warning-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                        {row.overdue_assigned}
                      </span>
                    ) : (
                      <span className="text-foreground-500">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.received}</td>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.resolved}</td>
                  <td className="py-3 px-3 tabular-nums">
                    {row.critical_urgent_assigned > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                        <i className="ri-error-warning-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                        {row.critical_urgent_assigned}
                      </span>
                    ) : (
                      <span className="text-foreground-500">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums whitespace-nowrap">
                    {formatDuration(row.avg_first_response_seconds)}
                  </td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums whitespace-nowrap">
                    {formatDuration(row.avg_resolution_seconds)}
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
              key={row.user_id}
              className="bg-background-200/40 border border-background-200/60 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/support-tickets?assigned=${row.user_id}${siteParam}`}
                    className="font-medium text-foreground-100 hover:text-accent-300 transition-colors"
                  >
                    {row.staff_name ?? 'Unknown'}
                  </Link>
                  <p className="text-xs text-foreground-500 truncate">{row.staff_email ?? ''}</p>
                </div>
                <Link
                  to={`/support-tickets?assigned=${row.user_id}${siteParam}`}
                  aria-label={`View ${row.staff_name ?? 'staff'} tickets in inbox`}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-background-300/60 text-foreground-300 hover:text-foreground-50 transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-right-up-line text-base w-5 h-5 flex items-center justify-center"></i>
                </Link>
              </div>

              <dl className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Open</dt>
                  <dd className="text-lg font-heading font-semibold text-foreground-100 tabular-nums">
                    {row.open_assigned}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Overdue</dt>
                  <dd
                    className={`text-lg font-heading font-semibold tabular-nums ${
                      row.overdue_assigned > 0 ? 'text-orange-400' : 'text-foreground-100'
                    }`}
                  >
                    {row.overdue_assigned}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Crit/urgent</dt>
                  <dd
                    className={`text-lg font-heading font-semibold tabular-nums ${
                      row.critical_urgent_assigned > 0 ? 'text-red-400' : 'text-foreground-100'
                    }`}
                  >
                    {row.critical_urgent_assigned}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Received</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">{row.received}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Resolved</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">{row.resolved}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">First resp.</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">
                    {formatDuration(row.avg_first_response_seconds)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Resolution</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">
                    {formatDuration(row.avg_resolution_seconds)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Last activity</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">
                    {formatLastActivity(row.last_activity_at)}
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
            Staff workload
          </h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Assigned tickets per team member and unassigned queue.
          </p>
        </div>
        {canView && lastRefreshed && !loading && (
          <span className="text-xs text-foreground-500 whitespace-nowrap">
            Refreshed{' '}
            {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {!canView ? (
        renderRestricted()
      ) : (
        <>
          {/* Unassigned summary */}
          <div aria-live="polite">
            <h3 className="text-sm font-heading font-semibold text-foreground-200 mb-2">
              Unassigned tickets
            </h3>
            <UnassignedSummary summary={summary} loading={summaryLoading} siteParam={siteParam} />
            {summaryError && !summaryLoading && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
                <i className="ri-error-warning-line text-red-400 text-base w-5 h-5 flex items-center justify-center"></i>
                <p className="text-sm text-red-400 flex-1">{summaryError}</p>
              </div>
            )}
          </div>

          {/* Staff table */}
          <div className="border-t border-background-200/60 pt-4">
            <h3 className="text-sm font-heading font-semibold text-foreground-200">
              Team workload
            </h3>
            {renderTable()}
          </div>
        </>
      )}
    </div>
  );
}