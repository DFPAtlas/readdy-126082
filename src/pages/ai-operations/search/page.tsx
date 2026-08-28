import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AiGlobalSearchResult } from '@/pages/ai-operations/search/searchIndex';
import { buildLiveSearchIndex, demoSearchIndex } from '@/pages/ai-operations/search/searchIndex';
import {
  queryResults,
  applyFilters,
  RECORD_TYPE_OPTIONS,
  CATEGORY_ORDER,
} from '@/pages/ai-operations/search/searchUtils';
import { useSearch } from '@/pages/ai-operations/search/SearchContext';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import ResultRow from '@/pages/ai-operations/search/components/ResultRow';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addRecent, toggleFavourite, isFavourite } = useSearch();
  const data = useGroupLiveData();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [recordType, setRecordType] = useState('');
  const [site, setSite] = useState('');
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');

  // Build the live index once per snapshot change (demo fallback is surfaced
  // explicitly as Demo mode when live data is unavailable).
  const index = useMemo(() => {
    if (data.mode === 'unavailable') return demoSearchIndex;
    return buildLiveSearchIndex(data);
  }, [data]);
  const sourceLabel = data.mode === 'unavailable' ? 'Demo' : 'Partial Live';

  const statusOptions = useMemo(
    () => Array.from(new Set(index.map((r) => r.statusLabel))).sort(),
    [index],
  );

  const results = useMemo(() => {
    return applyFilters(queryResults(query, index), { recordType, site, module, status });
  }, [query, index, recordType, site, module, status]);

  const grouped = useMemo(() => {
    const map = new Map<string, AiGlobalSearchResult[]>();
    for (const r of results) {
      const l = map.get(r.category) ?? [];
      l.push(r);
      map.set(r.category, l);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [results]);

  const hasActiveFilters = Boolean(recordType || site || module || status);

  const clearFilters = () => {
    setRecordType('');
    setSite('');
    setModule('');
    setStatus('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Search AI Operations</h1>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-label rounded-full px-2 py-0.5 whitespace-nowrap ${sourceLabel === 'Demo' ? 'text-foreground-500 bg-background-100 border border-background-200/60' : 'text-amber-400 bg-amber-500/10 border border-amber-500/25'}`}>
              {sourceLabel}
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Search every AI Operations registry — sites, agents, runs, approvals, orchestrations, tools, models, knowledge, policies, alerts, audit, budgets, notifications and schedules.
          </p>
        </div>
      </div>

      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        {results.length} result{results.length === 1 ? '' : 's'}
      </p>

      {/* Search + filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, name, site, agent, model, provider, policy or schedule…"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className={selectCls}>
            <option value="">Record type: All</option>
            {RECORD_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
            <option value="">Site: All</option>
            <option value="group">Group-wide</option>
            {data.sites.map((s) => (
              <option key={s.site_key} value={s.site_key}>{s.name}</option>
            ))}
          </select>

          <select value={module} onChange={(e) => setModule(e.target.value)} className={selectCls}>
            <option value="">Module: All</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="">Status: All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 hover:text-foreground-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-close-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-16 text-center">
          <i className="ri-search-eye-line text-2xl text-foreground-600 w-6 h-6 mx-auto flex items-center justify-center"></i>
          <p className="text-sm text-foreground-500 mt-2">No matching records</p>
          <p className="text-[11px] font-label text-foreground-600 mt-1">Try a broader query or clear the filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.category} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
                <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{group.category}</h3>
                <span className="text-[11px] font-label text-foreground-600">{group.items.length}</span>
              </div>
              <div className="divide-y divide-background-200/30">
                {group.items.map((r) => (
                  <ResultRow
                    key={r.id}
                    result={r}
                    isFavourite={isFavourite(r.referenceId)}
                    onOpen={(res) => {
                      addRecent(res.referenceId);
                      navigate(res.route);
                    }}
                    onToggleFavourite={(res) => toggleFavourite(res.referenceId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}