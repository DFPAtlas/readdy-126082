import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AiGlobalSearchResult } from '@/pages/ai-operations/search/searchIndex';
import { searchIndexByRef } from '@/pages/ai-operations/search/searchIndex';
import { searchRecords, QUICK_NAV, CATEGORY_ORDER, type QuickNavItem } from '@/pages/ai-operations/search/searchUtils';
import { useSearch } from '@/pages/ai-operations/search/SearchContext';
import ResultRow from '@/pages/ai-operations/search/components/ResultRow';

type FlatItem = { kind: 'result'; result: AiGlobalSearchResult } | { kind: 'nav'; item: QuickNavItem };

export default function CommandPalette() {
  const { isOpen, closeSearch, recent, addRecent, favourites, toggleFavourite, isFavourite } = useSearch();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Reset + focus on open.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const results = useMemo(() => searchRecords(query), [query]);

  const { sections, flat } = useMemo(() => {
    if (query.trim()) {
      const map = new Map<string, AiGlobalSearchResult[]>();
      for (const r of results) {
        const l = map.get(r.category) ?? [];
        l.push(r);
        map.set(r.category, l);
      }
      const sections: { label: string; items: FlatItem[] }[] = [];
      for (const cat of CATEGORY_ORDER) {
        const items = map.get(cat);
        if (items && items.length) {
          sections.push({ label: cat, items: items.map((r) => ({ kind: 'result' as const, result: r })) });
        }
      }
      return { sections, flat: sections.flatMap((s) => s.items) };
    }

    const sections: { label: string; items: FlatItem[] }[] = [];
    sections.push({ label: 'Quick Navigation', items: QUICK_NAV.map((n) => ({ kind: 'nav' as const, item: n })) });

    const favs = favourites
      .map((ref) => searchIndexByRef.get(ref))
      .filter((r): r is AiGlobalSearchResult => Boolean(r));
    if (favs.length) {
      sections.push({ label: 'Favourites', items: favs.map((r) => ({ kind: 'result' as const, result: r })) });
    }

    const recs = recent
      .map((ref) => searchIndexByRef.get(ref))
      .filter((r): r is AiGlobalSearchResult => Boolean(r) && !favourites.includes(r.referenceId));
    if (recs.length) {
      sections.push({ label: 'Recently Opened', items: recs.map((r) => ({ kind: 'result' as const, result: r })) });
    }

    return { sections, flat: sections.flatMap((s) => s.items) };
  }, [query, results, favourites, recent]);

  // Keep the active index in range when the flat list shrinks.
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(Math.max(0, flat.length - 1));
  }, [flat.length, activeIndex]);

  // Keep the active row in view.
  useEffect(() => {
    const el = document.getElementById(`ai-palette-item-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const openFlat = (item: FlatItem) => {
    if (item.kind === 'nav') {
      closeSearch();
      navigate(item.item.route);
      return;
    }
    addRecent(item.result.referenceId);
    closeSearch();
    navigate(item.result.route);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? Math.min(i + 1, flat.length - 1) : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) openFlat(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  };

  if (!isOpen) return null;

  let rowIndex = -1;

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Search AI Operations">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSearch}></div>

      <div className="relative z-10 mx-auto flex h-full sm:h-auto sm:items-start sm:pt-[12vh] sm:px-4">
        <div className="w-full sm:max-w-2xl mx-auto bg-background-200 border border-background-400/70 rounded-none sm:rounded-xl overflow-hidden shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] flex flex-col h-full sm:h-auto sm:max-h-[72vh]">
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-background-400/60 shrink-0">
            <i className="ri-search-line text-foreground-500 text-base w-4 h-4 flex items-center justify-center"></i>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search AI Operations…"
              className="flex-1 bg-transparent text-sm text-foreground-50 placeholder:text-foreground-600 outline-none"
            />
            <span className="hidden sm:inline-flex items-center text-[10px] font-label text-foreground-600 border border-background-400/60 rounded px-1.5 py-0.5 whitespace-nowrap">
              ESC
            </span>
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setActiveIndex(0);
                }}
                aria-label="Clear search"
                className="w-7 h-7 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-base w-4 h-4 flex items-center justify-center"></i>
              </button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto py-1.5">
            {flat.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <i className="ri-search-eye-line text-2xl text-foreground-600 w-6 h-6 mx-auto flex items-center justify-center"></i>
                <p className="text-sm text-foreground-500 mt-2">No matching records</p>
                <p className="text-[11px] font-label text-foreground-600 mt-1">Try an ID, name, site or module.</p>
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.label}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-label text-foreground-600 uppercase tracking-widest">
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    rowIndex += 1;
                    const idx = rowIndex;
                    if (item.kind === 'nav') {
                      return (
                        <button
                          key={`nav-${item.item.route}`}
                          id={`ai-palette-item-${idx}`}
                          onClick={() => openFlat(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors duration-150 ${
                            idx === activeIndex ? 'bg-background-200/60' : 'hover:bg-background-200/40'
                          }`}
                        >
                          <span className="w-8 h-8 shrink-0 rounded-md bg-background-100 border border-background-200/60 flex items-center justify-center text-foreground-500">
                            <i className={`${item.item.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                          </span>
                          <span className="text-sm text-foreground-100 flex-1">{item.item.label}</span>
                          <i className="ri-arrow-right-s-line text-foreground-600 w-4 h-4 flex items-center justify-center"></i>
                        </button>
                      );
                    }
                    return (
                      <ResultRow
                        key={item.result.id}
                        id={`ai-palette-item-${idx}`}
                        result={item.result}
                        active={idx === activeIndex}
                        isFavourite={isFavourite(item.result.referenceId)}
                        onOpen={(r) => openFlat({ kind: 'result', result: r })}
                        onToggleFavourite={(r) => toggleFavourite(r.referenceId)}
                        onMouseEnter={() => setActiveIndex(idx)}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-background-400/60 shrink-0 text-[10px] font-label text-foreground-600">
            <span className="hidden sm:inline-flex items-center gap-2 whitespace-nowrap">
              <span className="inline-flex items-center gap-0.5">
                <span className="border border-background-400/60 rounded px-1">↑</span>
                <span className="border border-background-400/60 rounded px-1">↓</span>
                <span>Navigate</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="border border-background-400/60 rounded px-1">↵</span>
                <span>Open</span>
              </span>
            </span>
            {query.trim() ? (
              <button
                onClick={() => {
                  closeSearch();
                  navigate(`/ai-operations/search?q=${encodeURIComponent(query.trim())}`);
                }}
                className="text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap ml-auto"
              >
                View all results →
              </button>
            ) : (
              <span className="ml-auto whitespace-nowrap">{flat.length} items</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}