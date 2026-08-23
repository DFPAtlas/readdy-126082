import { useEffect, useRef, useState } from 'react';
import type { InboxFilters, StaffOption } from '../hooks';
import type { SupportSite, TicketStatus } from '@/types/support-tickets';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  SOURCE_OPTIONS,
  statusLabels,
  priorityLabels,
  categoryLabels,
  sourceLabels,
} from '../constants';

interface FilterBarProps {
  filters: InboxFilters;
  searchInput: string;
  onSearchInput: (v: string) => void;
  onChange: (patch: Partial<InboxFilters>) => void;
  onClear: () => void;
  sites: SupportSite[];
  staff: StaffOption[];
  projects: { id: number; project_name: string }[];
  appliedCount: number;
}

type FilterControlsProps = Omit<FilterBarProps, 'searchInput' | 'onSearchInput'>;

function MultiStatusSelect({
  selected,
  onChange,
}: {
  selected: TicketStatus[];
  onChange: (v: TicketStatus[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = (s: TicketStatus) => {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-100 hover:border-foreground-400/40 transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-filter-3-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
        Status
        {selected.length > 0 && (
          <span className="text-[10px] font-label bg-accent-500 text-background-950 rounded-full px-1.5 py-0.5">
            {selected.length}
          </span>
        )}
        <i className="ri-arrow-down-s-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-56 bg-background-200 border border-background-300/70 rounded-lg shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] p-1 max-h-72 overflow-y-auto">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={selected.includes(s)}
              onClick={() => toggle(s)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground-100 hover:bg-background-100 transition-colors cursor-pointer text-left"
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  selected.includes(s)
                    ? 'bg-accent-500 border-accent-500 text-background-950'
                    : 'border-background-300/60'
                }`}
              >
                {selected.includes(s) && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
              </span>
              {statusLabels[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const selectCls =
  'bg-background-50 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer hover:border-foreground-400/40';

const dateCls =
  'bg-background-50 border border-background-300/60 rounded-lg px-2 py-1.5 text-sm text-foreground-100 outline-none transition-colors';

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
        active
          ? 'bg-accent-500 text-background-950'
          : 'bg-background-100 border border-background-300/60 text-foreground-400 hover:text-foreground-200'
      }`}
    >
      {label}
    </button>
  );
}

function FilterControls({
  filters,
  onChange,
  sites,
  staff,
  projects,
}: FilterControlsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Website</label>
          <select
            value={filters.site}
            onChange={(e) => onChange({ site: e.target.value })}
            className={`${selectCls} w-full`}
          >
            <option value="all">All websites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.site_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Project</label>
          <select
            value={filters.project}
            onChange={(e) => onChange({ project: e.target.value })}
            className={`${selectCls} w-full`}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.project_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Assigned to</label>
          <select
            value={filters.assigned}
            onChange={(e) => onChange({ assigned: e.target.value })}
            className={`${selectCls} w-full`}
          >
            <option value="all">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.full_name || s.email || s.user_id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Category</label>
          <select
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value as InboxFilters['category'] })}
            className={`${selectCls} w-full`}
          >
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{categoryLabels[c]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Priority</label>
          <select
            value={filters.priority}
            onChange={(e) => onChange({ priority: e.target.value as InboxFilters['priority'] })}
            className={`${selectCls} w-full`}
          >
            <option value="all">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{priorityLabels[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Source</label>
          <select
            value={filters.source}
            onChange={(e) => onChange({ source: e.target.value as InboxFilters['source'] })}
            className={`${selectCls} w-full`}
          >
            <option value="all">All sources</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{sourceLabels[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Created from</label>
          <input
            type="date"
            value={filters.createdFrom}
            onChange={(e) => onChange({ createdFrom: e.target.value })}
            className={`${dateCls} w-full`}
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Created to</label>
          <input
            type="date"
            value={filters.createdTo}
            min={filters.createdFrom || undefined}
            onChange={(e) => onChange({ createdTo: e.target.value })}
            className={`${dateCls} w-full`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ToggleChip label="Unread" active={filters.unread} onClick={() => onChange({ unread: !filters.unread })} />
        <ToggleChip label="Overdue" active={filters.overdue} onClick={() => onChange({ overdue: !filters.overdue })} />
        <ToggleChip
          label="Resolved today"
          active={filters.resolvedToday}
          onClick={() => onChange({ resolvedToday: !filters.resolvedToday })}
        />
      </div>
    </div>
  );
}

export default function FilterBar(props: FilterBarProps) {
  const { filters, searchInput, onSearchInput, onClear, appliedCount } = props;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        {/* Search + primary controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="search"
              aria-label="Search tickets"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder="Search ticket #, subject, customer, email, reference or site..."
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-9 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <MultiStatusSelect
              selected={filters.statuses}
              onChange={(statuses) => props.onChange({ statuses })}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-100 hover:border-foreground-400/40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-filter-3-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
              Filters
              {appliedCount > 0 && (
                <span className="text-[10px] font-label bg-accent-500 text-background-950 rounded-full px-1.5 py-0.5">
                  {appliedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop inline filters */}
        <div className="hidden lg:block mt-4">
          <FilterControls {...props} />
        </div>

        {/* Active chips + clear */}
        {appliedCount > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              {appliedCount} filter{appliedCount === 1 ? '' : 's'} applied
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1"
            >
              <i className="ri-close-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)}></div>
          <div className="absolute right-0 top-0 bottom-0 w-[min(90vw,360px)] bg-background-200 border-l border-background-300/60 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-background-300/60 shrink-0">
              <h2 className="text-base font-heading font-semibold text-foreground-50">Filters</h2>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-foreground-300 hover:text-foreground-50 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterControls {...props} />
            </div>
            <div className="p-4 border-t border-background-300/60 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}