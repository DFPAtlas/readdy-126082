// ============================================================================
// AI Operations — Operations Wall auto-advancing page state.
//
// A single shared hook for paginated wall content (the central site network and
// the autonomous mission list). It advances the current page on a gentle cadence
// ONLY when there is more than one page, and resets to the first page whenever
// the number of pages changes (e.g. a widget is added/hidden/reordered).
//
// This is the wall's ONE pagination clock — it never competes with the existing
// operational-data refresh (30s) or the per-second header clock. Components that
// render more content than fits call this to rotate through pages instead of
// clipping or shrinking.
// ============================================================================

import { useEffect, useState } from 'react';

/** Advance cadence for overflow pages (seconds). Distinct from the 30s data
 *  refresh so page rotation never collides with a snapshot load. */
export const WALL_PAGE_INTERVAL_SECONDS = 12;

/** Returns the current zero-based page index (clamped to `pageCount - 1`) plus
 *  a manual setter. Auto-advances only when `pageCount > 1`. */
export function useAutoPage(
  pageCount: number,
  intervalSeconds: number = WALL_PAGE_INTERVAL_SECONDS,
): [number, (page: number) => void] {
  const count = Math.max(1, Math.floor(pageCount));
  const [page, setPage] = useState(0);

  // Reset to the first page whenever the number of pages changes.
  useEffect(() => {
    setPage(0);
  }, [count]);

  // Rotate pages on a slow cadence, but only when there is overflow.
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % count);
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [count, intervalSeconds]);

  const safePage = Math.min(page, count - 1);
  return [safePage, setPage];
}