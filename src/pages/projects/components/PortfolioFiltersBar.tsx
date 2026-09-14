export type FilterKey =
  | 'all'
  | 'idea'
  | 'planning'
  | 'building'
  | 'testing'
  | 'live'
  | 'on_hold'
  | 'critical'
  | 'attention'
  | 'launch_ready'
  | 'over_budget'
  | 'ai'
  | 'saas'
  | 'client'
  | 'internal';

export type SortKey =
  | 'default'
  | 'priority'
  | 'lifecycle'
  | 'target_launch'
  | 'health'
  | 'last_activity'
  | 'budget_risk'
  | 'name';

export type ViewMode = 'cards' | 'table';

export const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Ideas' },
  { value: 'planning', label: 'Planning' },
  { value: 'building', label: 'Building' },
  { value: 'testing', label: 'Testing' },
  { value: 'live', label: 'Live' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'critical', label: 'Critical' },
  { value: 'attention', label: 'Needs Attention' },
  { value: 'launch_ready', label: 'Launch Ready' },
  { value: 'over_budget', label: 'Over Budget' },
  { value: 'ai', label: 'AI Powered' },
  { value: 'saas', label: 'SaaS' },
  { value: 'client', label: 'Client Builds' },
  { value: 'internal', label: 'Internal Tools' },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Needs Attention' },
  { value: 'priority', label: 'Priority' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'target_launch', label: 'Target Launch' },
  { value: 'health', label: 'Operational Health' },
  { value: 'last_activity', label: 'Last Activity' },
  { value: 'budget_risk', label: 'Budget Risk' },
  { value: 'name', label: 'Project Name' },
];

interface Props {
  search: string;
  onSearch: (v: string) => void;
  filter: FilterKey;
  onFilter: (v: FilterKey) => void;
  owners: string[];
  owner: string;
  onOwner: (v: string) => void;
  priority: string;
  onPriority: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  resultCount: number;
}

const PRIORITIES = ['all', 'critical', 'high', 'medium', 'low'];

export default function PortfolioFiltersBar(props: Props) {
  const {
    search,
    onSearch,
    filter,
    onFilter,
    owners,
    owner,
    onOwner,
    priority,
    onPriority,
    sort,
    onSort,
    viewMode,
    onViewMode,
    resultCount,
  } = props;

  return (
    <div className="space-y-3">
      {/* Search + selects row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, slug, description, domain, owner, repo…"
            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-full pl-9 pr-4 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={owner}
            onChange={(e) => onOwner(e.target.value)}
            className="bg-background-100 border border-background-300/60 rounded-full px-3 py-2 text-sm text-foreground-100 outline-none cursor-pointer"
          >
            <option value="all">All Owners</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => onPriority(e.target.value)}
            className="bg-background-100 border border-background-300/60 rounded-full px-3 py-2 text-sm text-foreground-100 outline-none cursor-pointer capitalize"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="bg-background-100 border border-background-300/60 rounded-full px-3 py-2 text-sm text-foreground-100 outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>Sort: {s.label}</option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="bg-background-100 border border-background-200/60 rounded-full p-1 inline-flex gap-0.5 shrink-0">
          <button
            onClick={() => onViewMode('cards')}
            className={`px-3 py-1.5 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'cards' ? 'bg-accent-500/10 text-accent-400 font-semibold' : 'text-foreground-500'
            }`}
          >
            <i className="ri-layout-grid-line w-3.5 h-3.5 inline-flex items-center justify-center mr-1"></i>
            Cards
          </button>
          <button
            onClick={() => onViewMode('table')}
            className={`px-3 py-1.5 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'table' ? 'bg-accent-500/10 text-accent-400 font-semibold' : 'text-foreground-500'
            }`}
          >
            <i className="ri-list-check-3 w-3.5 h-3.5 inline-flex items-center justify-center mr-1"></i>
            Table
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
              filter === f.value
                ? 'bg-accent-500 text-background-950 font-semibold'
                : 'bg-background-100 border border-background-200/60 text-foreground-400 hover:text-foreground-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-foreground-600 ml-auto whitespace-nowrap">
          {resultCount} project{resultCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}