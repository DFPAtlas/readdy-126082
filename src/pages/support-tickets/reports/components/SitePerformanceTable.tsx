import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  SupportSitePerformance,
  SitePerformanceSortKey,
} from '@/types/support-tickets';

type SortDir = 'asc' | 'desc';

interface SortState {
  key: SitePerformanceSortKey;
  dir: SortDir;
}

const SORTABLE_COLUMNS: { key: SitePerformanceSortKey; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'active', label: 'Active' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'unassigned', label: 'Unassigned' },
];

function valueOf(row: SupportSitePerformance, key: SitePerformanceSortKey): number {
  switch (key) {
    case 'received':
      return row.tickets_received;
    case 'active':
      return row.active_tickets;
    case 'overdue':
      return row.overdue_active;
    case 'unassigned':
      return row.unassigned_active;
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

interface SitePerformanceTableProps {
  data: SupportSitePerformance[] | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  onRetry: () => void;
  selectedSiteId: string;
  onSelectSite: (id: string) => void;
}

export default function SitePerformanceTable({
  data,
  loading,
  error,
  lastRefreshed,
  onRetry,
  selectedSiteId,
  onSelectSite,
}: SitePerformanceTableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'received', dir: 'desc' });

  const siteOptions = useMemo(() => data ?? [], [data]);

  const hasActivity = useMemo(() => {
    if (!data) return false;
    return data.some(
      (r) =>
        r.tickets_received > 0 ||
        r.resolved_tickets > 0 ||
        r.active_tickets > 0 ||
        r.overdue_active > 0 ||
        r.unassigned_active > 0,
    );
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const filtered =
      selectedSiteId === 'all'
        ? data
        : data.filter((r) => r.site_id === selectedSiteId);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      if (av !== bv) return (av - bv) * dir;
      return a.site_name.localeCompare(b.site_name);
    });
  }, [data, selectedSiteId, sort]);

  const toggleSort = (key: SitePerformanceSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' },
    );
  };

  const ariaSortFor = (key: SitePerformanceSortKey): 'ascending' | 'descending' | 'none' =>
    sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  const renderState = () => {
    if (loading) {
      return (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-md bg-background-200/40 animate-pulse"
            ></div>
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

    if (!data || data.length === 0) {
      return (
        <div className="mt-3 rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-8 flex flex-col items-center justify-center gap-2">
          <i className="ri-global-line text-foreground-500 text-2xl w-8 h-8 flex items-center justify-center"></i>
          <p className="text-sm text-foreground-400">No registered websites yet.</p>
        </div>
      );
    }

    return (
      <>
        {!hasActivity && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-3">
            <i className="ri-information-line text-foreground-500 text-base w-5 h-5 flex items-center justify-center"></i>
            <p className="text-sm text-foreground-400">No ticket activity in this period.</p>
          </div>
        )}

        {/* Desktop table */}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <caption className="sr-only">Support performance by website</caption>
            <thead>
              <tr className="text-left border-b border-background-200/60">
                <th scope="col" className="py-2 pr-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">
                  Website
                </th>
                {SORTABLE_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={ariaSortFor(c.key)}
                    className="py-2 px-3"
                  >
                    <SortButton
                      label={c.label}
                      active={sort.key === c.key}
                      dir={sort.dir}
                      onClick={() => toggleSort(c.key)}
                    />
                  </th>
                ))}
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium">
                  Resolved
                </th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Avg first response
                </th>
                <th scope="col" className="py-2 px-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Avg resolution
                </th>
                <th scope="col" className="py-2 pl-3 font-label text-[11px] uppercase tracking-wider text-foreground-500 font-medium whitespace-nowrap">
                  Last ticket
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.site_id}
                  className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors"
                >
                  <th scope="row" className="py-3 pr-3">
                    <Link
                      to={`/support-tickets?site=${row.site_id}`}
                      className="block group"
                    >
                      <span className="font-medium text-foreground-100 group-hover:text-accent-300 transition-colors">
                        {row.site_name}
                      </span>
                      <span className="block text-xs text-foreground-500 truncate max-w-[180px]">
                        {row.domain ?? row.site_slug}
                      </span>
                    </Link>
                  </th>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.tickets_received}</td>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.active_tickets}</td>
                  <td className="py-3 px-3 tabular-nums">
                    {row.overdue_active > 0 ? (
                      <span className="inline-flex items-center gap-1 text-orange-400 font-medium">
                        <i className="ri-alarm-warning-line text-sm w-4 h-4 flex items-center justify-center" aria-hidden="true"></i>
                        {row.overdue_active}
                      </span>
                    ) : (
                      <span className="text-foreground-500">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.unassigned_active}</td>
                  <td className="py-3 px-3 text-foreground-200 tabular-nums">{row.resolved_tickets}</td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums whitespace-nowrap">
                    {formatDuration(row.avg_first_response_seconds)}
                  </td>
                  <td className="py-3 px-3 text-foreground-300 tabular-nums whitespace-nowrap">
                    {formatDuration(row.avg_resolution_seconds)}
                  </td>
                  <td className="py-3 pl-3 text-foreground-300 whitespace-nowrap">
                    {formatDate(row.last_ticket_received)}
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
              key={row.site_id}
              className="bg-background-200/40 border border-background-200/60 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/support-tickets?site=${row.site_id}`}
                    className="font-medium text-foreground-100 hover:text-accent-300 transition-colors"
                  >
                    {row.site_name}
                  </Link>
                  <p className="text-xs text-foreground-500 truncate">{row.domain ?? row.site_slug}</p>
                </div>
                <Link
                  to={`/support-tickets?site=${row.site_id}`}
                  aria-label={`View ${row.site_name} tickets in inbox`}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-background-300/60 text-foreground-300 hover:text-foreground-50 transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-right-up-line text-base w-5 h-5 flex items-center justify-center"></i>
                </Link>
              </div>

              <dl className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Received</dt>
                  <dd className="text-lg font-heading font-semibold text-foreground-100 tabular-nums">
                    {row.tickets_received}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Active</dt>
                  <dd className="text-lg font-heading font-semibold text-foreground-100 tabular-nums">
                    {row.active_tickets}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Overdue</dt>
                  <dd
                    className={`text-lg font-heading font-semibold tabular-nums ${
                      row.overdue_active > 0 ? 'text-orange-400' : 'text-foreground-100'
                    }`}
                  >
                    {row.overdue_active}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Unassigned</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">
                    {row.unassigned_active}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Resolved</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">
                    {row.resolved_tickets}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-label uppercase tracking-wider text-foreground-500">Last ticket</dt>
                  <dd className="text-base font-semibold text-foreground-200 tabular-nums">
                    {formatDate(row.last_ticket_received)}
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
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-base font-heading font-semibold text-foreground-100">
            Website performance
          </h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Ticket activity per website in the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastRefreshed && !loading && (
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              Refreshed{' '}
              {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <label className="flex items-center gap-2 text-xs text-foreground-500">
            <span className="whitespace-nowrap">Website</span>
            <select
              value={selectedSiteId}
              onChange={(e) => onSelectSite(e.target.value)}
              aria-label="Filter by website"
              className="bg-background-50 border border-background-300/60 rounded-lg px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer hover:border-foreground-400/40"
            >
              <option value="all">All websites</option>
              {siteOptions.map((s) => (
                <option key={s.site_id} value={s.site_id}>
                  {s.site_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {renderState()}
    </div>
  );
}