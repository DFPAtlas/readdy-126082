import { useSearch } from '@/pages/ai-operations/search/SearchContext';

// Compact header affordance to open the global command palette.
export default function SearchTrigger() {
  const { openSearch } = useSearch();

  return (
    <>
      {/* Desktop: full-width search pill */}
      <button
        onClick={openSearch}
        title="Search AI Operations (Ctrl+K)"
        className="hidden md:flex items-center gap-2 h-9 px-3 text-sm text-foreground-400 bg-background-100 border border-background-300/60 rounded-lg hover:text-foreground-200 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
      >
        <i className="ri-search-line text-base w-4 h-4 flex items-center justify-center"></i>
        <span>Search AI Operations…</span>
        <span className="ml-1 text-[10px] font-label text-foreground-600 border border-background-300/60 rounded px-1 py-0.5 whitespace-nowrap">⌘K</span>
      </button>

      {/* Mobile: icon-only */}
      <button
        onClick={openSearch}
        title="Search AI Operations"
        aria-label="Search AI Operations"
        className="md:hidden w-9 h-9 flex items-center justify-center text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer rounded-lg hover:bg-background-100"
      >
        <i className="ri-search-line text-lg w-5 h-5 flex items-center justify-center"></i>
      </button>
    </>
  );
}