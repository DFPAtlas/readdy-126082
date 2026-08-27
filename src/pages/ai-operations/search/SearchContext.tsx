import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ============================================================================
// AI Operations — Global Search — in-memory session state.
//
// Holds the command palette open state, and frontend-only "recently opened"
// and "favourite" record IDs. Nothing is persisted to production — this is
// local session state only and resets on reload.
// ============================================================================

interface SearchContextValue {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  /** Most-recent-first reference IDs (max 8). */
  recent: string[];
  addRecent: (referenceId: string) => void;
  favourites: string[];
  toggleFavourite: (referenceId: string) => void;
  isFavourite: (referenceId: string) => boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);

  const addRecent = useCallback((referenceId: string) => {
    setRecent((prev) => [referenceId, ...prev.filter((r) => r !== referenceId)].slice(0, 8));
  }, []);

  const toggleFavourite = useCallback((referenceId: string) => {
    setFavourites((prev) =>
      prev.includes(referenceId) ? prev.filter((r) => r !== referenceId) : [referenceId, ...prev],
    );
  }, []);

  const isFavourite = useCallback((referenceId: string) => favourites.includes(referenceId), [favourites]);

  // Global keyboard shortcut: Ctrl/Cmd + K toggles the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      isOpen,
      openSearch,
      closeSearch,
      recent,
      addRecent,
      favourites,
      toggleFavourite,
      isFavourite,
    }),
    [isOpen, openSearch, closeSearch, recent, addRecent, favourites, toggleFavourite, isFavourite],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within a SearchProvider');
  return ctx;
}