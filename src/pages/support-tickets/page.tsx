import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/feature/AuthGuard';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import {
  type InboxFilters,
  type TicketWithMeta,
  useSupportInbox,
  useSupportLookups,
  useSupportCounts,
} from './hooks';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  SOURCE_OPTIONS,
  SORT_OPTIONS,
  PAGE_SIZES,
  statusLabels,
  priorityLabels,
  type SortValue,
} from './constants';
import type { TicketPriority, TicketStatus } from '@/types/support-tickets';
import SummaryCards, { type SummaryCardKey } from './components/SummaryCards';
import FilterBar from './components/FilterBar';
import TicketList from './components/TicketList';
import CreateTicketModal from './components/CreateTicketModal';
import Skeletons from './components/Skeletons';

const SORT_VALUES = SORT_OPTIONS.map((s) => s.value);

function parseStatuses(raw: string | null): TicketStatus[] {
  if (!raw) return [];
  return raw.split(',').filter((s): s is TicketStatus =>
    (STATUS_OPTIONS as string[]).includes(s),
  );
}

function parseEnum<T extends string>(raw: string | null, valid: readonly T[]): T | 'all' {
  if (raw && (valid as string[]).includes(raw)) return raw as T;
  return 'all';
}

function parseFilters(params: URLSearchParams): InboxFilters {
  return {
    q: params.get('q') ?? '',
    statuses: parseStatuses(params.get('status')),
    priority: parseEnum(params.get('priority'), PRIORITY_OPTIONS),
    category: parseEnum(params.get('category'), CATEGORY_OPTIONS),
    source: parseEnum(params.get('source'), SOURCE_OPTIONS),
    site: params.get('site') ?? 'all',
    project: params.get('project') ?? 'all',
    assigned: params.get('assigned') ?? 'all',
    unread: params.get('unread') === '1',
    overdue: params.get('overdue') === '1',
    resolvedToday: params.get('resolvedToday') === '1',
    createdFrom: '',
    createdTo: '',
    activityFrom: '',
    activityTo: '',
  };
}

function parseSort(params: URLSearchParams): SortValue {
  const s = params.get('sort');
  return s && (SORT_VALUES as string[]).includes(s) ? (s as SortValue) : 'default';
}

function parsePage(params: URLSearchParams): number {
  const p = Number(params.get('page'));
  return Number.isInteger(p) && p > 0 ? p : 1;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function SupportTickets() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = auth.role;
  const canModify = role === 'owner' || role === 'admin';

  // Date-range filters are local-only (not bookmarked); the rest live in URL.
  const [dateFilters, setDateFilters] = useState({
    createdFrom: '',
    createdTo: '',
    activityFrom: '',
    activityTo: '',
  });

  const filters = useMemo<InboxFilters>(
    () => ({ ...parseFilters(searchParams), ...dateFilters }),
    [searchParams, dateFilters],
  );
  const sort = useMemo(() => parseSort(searchParams), [searchParams]);
  const page = useMemo(() => parsePage(searchParams), [searchParams]);

  const [searchInput, setSearchInput] = useState(filters.q);
  const debounceRef = useRef<number | undefined>(undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<{ action: () => void; message: string } | null>(null);

  const [pageSize, setPageSize] = useState<number>(() => {
    const s = Number(searchParams.get('size'));
    return PAGE_SIZES.includes(s) ? s : 25;
  });

  const { sites, staff, projects } = useSupportLookups();
  const { counts, refresh: refreshCounts } = useSupportCounts();
  const { tickets, total, loading, error, lastRefreshed, refresh } = useSupportInbox(
    filters,
    page,
    pageSize,
    sort,
  );

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  // Debounced search → filter patch.
  const handleSearchInput = (v: string) => {
    setSearchInput(v);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      applyPatch({ q: v });
    }, 300);
  };

  const applyPatch = useCallback(
    (patch: Partial<InboxFilters>) => {
      const next = { ...filters, ...patch };
      const params = new URLSearchParams();
      if (next.q) params.set('q', next.q);
      if (next.statuses.length) params.set('status', next.statuses.join(','));
      if (next.priority !== 'all') params.set('priority', next.priority);
      if (next.category !== 'all') params.set('category', next.category);
      if (next.source !== 'all') params.set('source', next.source);
      if (next.site !== 'all') params.set('site', next.site);
      if (next.project !== 'all') params.set('project', next.project);
      if (next.assigned !== 'all') params.set('assigned', next.assigned);
      if (next.unread) params.set('unread', '1');
      if (next.overdue) params.set('overdue', '1');
      if (next.resolvedToday) params.set('resolvedToday', '1');
      params.set('sort', sort);
      params.set('size', String(pageSize));
      setSearchParams(params, { replace: false });

      // date-only fields stay local
      setDateFilters((prev) => ({
        ...prev,
        createdFrom: patch.createdFrom ?? prev.createdFrom,
        createdTo: patch.createdTo ?? prev.createdTo,
        activityFrom: patch.activityFrom ?? prev.activityFrom,
        activityTo: patch.activityTo ?? prev.activityTo,
      }));
    },
    [filters, sort, pageSize, setSearchParams],
  );

  const applySort = (s: SortValue) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', s);
    params.delete('page');
    setSearchParams(params, { replace: false });
  };

  const applyPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    if (p <= 1) params.delete('page');
    else params.set('page', String(p));
    setSearchParams(params, { replace: false });
  };

  const applyPageSize = (s: number) => {
    setPageSize(s);
    const params = new URLSearchParams(searchParams);
    params.set('size', String(s));
    params.delete('page');
    setSearchParams(params, { replace: false });
  };

  const clearAll = () => {
    setSearchInput('');
    setDateFilters({ createdFrom: '', createdTo: '', activityFrom: '', activityTo: '' });
    setSearchParams({ sort: sort, size: String(pageSize) }, { replace: false });
  };

  // Summary card selection
  const selectedCard = useMemo<SummaryCardKey | null>(() => {
    if (filters.statuses.length === 1 && filters.statuses[0] === 'new') return 'new';
    if (filters.statuses.includes('open') && filters.statuses.includes('in_progress')) return 'active';
    if (filters.statuses.length === 1 && filters.statuses[0] === 'waiting_on_customer') return 'waiting';
    if (filters.overdue) return 'overdue';
    if (filters.resolvedToday) return 'resolvedToday';
    if (filters.assigned === 'unassigned') return 'unassigned';
    return null;
  }, [filters]);

  const handleCardSelect = (key: SummaryCardKey | null) => {
    if (key === null) {
      if (!selectedCard) return;
      switch (selectedCard) {
        case 'new':
        case 'active':
        case 'waiting':
          applyPatch({ statuses: [] });
          break;
        case 'overdue':
          applyPatch({ overdue: false });
          break;
        case 'resolvedToday':
          applyPatch({ resolvedToday: false });
          break;
        case 'unassigned':
          applyPatch({ assigned: 'all' });
          break;
      }
      return;
    }
    switch (key) {
      case 'new':
        applyPatch({ statuses: ['new'] });
        break;
      case 'active':
        applyPatch({ statuses: ['open', 'in_progress'] });
        break;
      case 'waiting':
        applyPatch({ statuses: ['waiting_on_customer'] });
        break;
      case 'overdue':
        applyPatch({ overdue: !filters.overdue });
        break;
      case 'resolvedToday':
        applyPatch({ resolvedToday: !filters.resolvedToday });
        break;
      case 'unassigned':
        applyPatch({ assigned: filters.assigned === 'unassigned' ? 'all' : 'unassigned' });
        break;
    }
  };

  const openTicket = (t: TicketWithMeta) => navigate(`/support-tickets/${t.id}`);

  const refreshAll = () => {
    refresh();
    refreshCounts();
  };

  const runUpdate = async (ticketId: string, patch: Record<string, unknown>, successMsg: string) => {
    const { error } = await supabase
      .from('internal_support_tickets')
      .update(patch)
      .eq('id', ticketId);
    if (error) {
      showToast(error.message || 'Update failed', 'error');
      return;
    }
    showToast(successMsg, 'success');
    refreshAll();
  };

  const handleAssignToMe = (t: TicketWithMeta) => {
    const me = auth.user?.email ?? auth.user?.id ?? 'me';
    runUpdate(t.id, { assigned_to: auth.user?.id, assigned_agent: me }, 'Assigned to you');
  };

  const handleToggleRead = (t: TicketWithMeta) => {
    runUpdate(t.id, { is_unread: !t.is_unread }, t.is_unread ? 'Marked as read' : 'Marked as unread');
  };

  const handleChangePriority = (t: TicketWithMeta, p: TicketPriority) => {
    runUpdate(t.id, { priority: p }, `Priority set to ${priorityLabels[p]}`);
  };

  const requestStatusChange = (t: TicketWithMeta, s: TicketStatus) => {
    if (s === 'spam' || s === 'closed') {
      setConfirm({
        action: () => runUpdate(t.id, { status: s }, s === 'spam' ? 'Marked as spam' : 'Closed'),
        message: `Set ticket ${t.ticket_number} to "${statusLabels[s]}"? This is reversible but will be recorded in the audit trail.`,
      });
      return;
    }
    runUpdate(t.id, { status: s }, `Status set to ${statusLabels[s]}`);
  };

  const handleCopyNumber = async (t: TicketWithMeta) => {
    try {
      await navigator.clipboard.writeText(t.ticket_number);
      showToast('Ticket number copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  };

  const appliedCount = useMemo(() => {
    let n = 0;
    if (filters.q) n++;
    n += filters.statuses.length;
    if (filters.priority !== 'all') n++;
    if (filters.category !== 'all') n++;
    if (filters.source !== 'all') n++;
    if (filters.site !== 'all') n++;
    if (filters.project !== 'all') n++;
    if (filters.assigned !== 'all') n++;
    if (filters.unread) n++;
    if (filters.overdue) n++;
    if (filters.resolvedToday) n++;
    if (filters.createdFrom || filters.createdTo) n++;
    if (filters.activityFrom || filters.activityTo) n++;
    return n;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Support Tickets</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Manage customer support requests from every Digital Footprint website in one place.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-foreground-500 whitespace-nowrap hidden sm:inline">
            {total} total · {lastRefreshed ? `refreshed ${lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
          </span>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors px-3 py-2 rounded-lg border border-background-200/60 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
            Refresh
          </button>
          <Link
            to="/support-tickets/reports"
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors px-3 py-2 rounded-lg border border-background-200/60 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-bar-chart-line text-base w-4 h-4 flex items-center justify-center"></i>
            Reports
          </Link>
          {canModify && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              + Create Ticket
            </button>
          )}
        </div>
      </div>

      {loading && tickets.length === 0 ? (
        <Skeletons />
      ) : (
        <>
          <SummaryCards
            counts={counts}
            selected={selectedCard}
            onSelect={handleCardSelect}
          />

          <FilterBar
            filters={filters}
            searchInput={searchInput}
            onSearchInput={handleSearchInput}
            onChange={applyPatch}
            onClear={clearAll}
            sites={sites}
            staff={staff}
            projects={projects}
            appliedCount={appliedCount}
          />

          {/* Error state */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={refreshAll}
                className="text-sm text-red-300 underline mt-1 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty states */}
          {!error && !loading && tickets.length === 0 && (
            <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
                <i className="ri-ticket-2-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
              </div>
              <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
                {appliedCount > 0 ? 'No tickets match your filters' : 'No support tickets yet'}
              </h3>
              <p className="text-sm text-foreground-500 mb-5 max-w-md mx-auto">
                {appliedCount > 0
                  ? 'Try adjusting or clearing your filters to see more.'
                  : 'Tickets will appear here as they are received from your websites.'}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {appliedCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-4 py-2 rounded-full text-sm font-semibold border border-background-300/60 text-foreground-200 hover:text-foreground-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                )}
                {canModify && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Create ticket
                  </button>
                )}
              </div>
            </div>
          )}

          {tickets.length > 0 && (
            <>
              <TicketList
                tickets={tickets}
                staff={staff}
                canModify={canModify}
                currentUserId={auth.user?.id}
                onOpen={openTicket}
                onAssignToMe={handleAssignToMe}
                onToggleRead={handleToggleRead}
                onChangePriority={handleChangePriority}
                onChangeStatus={requestStatusChange}
                onCopyNumber={handleCopyNumber}
              />

              {/* Pagination + sort */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-foreground-500 flex-wrap">
                  <span className="whitespace-nowrap">
                    {rangeStart}–{rangeEnd} of {total}
                  </span>
                  <label className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-xs text-foreground-600">Sort</span>
                    <select
                      value={sort}
                      onChange={(e) => applySort(e.target.value as SortValue)}
                      aria-label="Sort tickets"
                      className="bg-background-100 border border-background-300/60 rounded-lg px-2 py-1.5 text-xs text-foreground-100 outline-none cursor-pointer"
                    >
                      {SORT_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-xs text-foreground-600">Per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => applyPageSize(Number(e.target.value))}
                      aria-label="Page size"
                      className="bg-background-100 border border-background-300/60 rounded-lg px-2 py-1.5 text-xs text-foreground-100 outline-none cursor-pointer"
                    >
                      {PAGE_SIZES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => applyPage(page - 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-background-300/60 text-foreground-200 hover:text-foreground-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <i className="ri-arrow-left-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
                    Previous
                  </button>
                  <span className="text-sm text-foreground-500 whitespace-nowrap">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => applyPage(page + 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-background-300/60 text-foreground-200 hover:text-foreground-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Next
                    <i className="ri-arrow-right-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sites={sites}
        onCreated={(num) => {
          showToast(`Ticket ${num} created`, 'success');
          refreshAll();
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Confirm change"
        message={confirm?.message ?? ''}
        confirmLabel="Confirm"
        confirmVariant="accent"
        onConfirm={() => {
          confirm?.action();
          setConfirm(null);
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.4)] ${
              toast.type === 'success'
                ? 'bg-background-200 border-emerald-500/40 text-emerald-300'
                : 'bg-background-200 border-red-500/40 text-red-300'
            }`}
          >
            <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

