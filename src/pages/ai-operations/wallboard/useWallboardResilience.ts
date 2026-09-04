// ============================================================================
// AI Operations — Wallboard resilience hook.
//
// Tracks browser/session resilience for the dedicated 32-inch wall display:
//   • browser connectivity (navigator.onLine + online/offline events)
//   • last SUCCESSFUL data refresh (never conflated with a failed attempt)
//   • consecutive refresh failures (retry signal)
//   • session start time (diagnostics-only uptime)
//
// On reconnect and on wake-from-background (visibilitychange → visible) it
// triggers an immediate, guarded refresh — without creating or duplicating any
// timer. This keeps the wallboard recovering automatically from transient
// outages, sleep/wake and network reconnection without a manual browser reload.
//
// The hook does NOT reload the page and does NOT touch authentication — it only
// re-fetches data through the existing read-only store refresh path.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

export type WallboardConnectionState = 'live' | 'reconnecting' | 'offline' | 'stale';

export interface WallboardResilience {
  /** True when the browser reports a network connection. */
  online: boolean;
  /** Epoch ms of the last successful refresh, or null before the first success. */
  lastSuccessAt: number | null;
  /** Number of consecutive refresh failures (reset to 0 on success). */
  consecutiveFailures: number;
  /** Epoch ms the wallboard session started (diagnostics-only uptime). */
  startedAt: number;
  /** Guarded refresh — safe to call from timers, events, or on demand. */
  refresh: () => void;
}

/**
 * Derive a single wallboard connection state from the raw signals.
 *
 * Precedence: offline (browser) > reconnecting (recent failures) > stale
 * (data too old) > live. "Reconnecting" is preferred over "stale" because it
 * means we are actively retrying; "stale" only applies when refreshes have
 * silently stopped or auto-refresh is off.
 */
export function deriveConnectionState(
  online: boolean,
  lastSuccessAt: number | null,
  consecutiveFailures: number,
  nowMs: number,
  staleThresholdMs: number,
): WallboardConnectionState {
  if (!online) return 'offline';
  if (consecutiveFailures > 0) return 'reconnecting';
  if (lastSuccessAt != null && nowMs - lastSuccessAt > staleThresholdMs) return 'stale';
  return 'live';
}

/**
 * Stale threshold in milliseconds. Three missed auto-refresh cycles (or a
 * generous fixed floor when auto-refresh is off) before data is flagged stale.
 */
export function staleThresholdMs(refreshIntervalSeconds: number): number {
  if (refreshIntervalSeconds <= 0) return 5 * 60 * 1000; // auto-refresh off → 5 min
  const threeCycles = refreshIntervalSeconds * 1000 * 3;
  return Math.max(60 * 1000, threeCycles);
}

export function useWallboardResilience(
  performRefresh: () => Promise<boolean>,
): WallboardResilience {
  const [online, setOnline] = useState<boolean>(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
  );
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const startedAtRef = useRef<number>(Date.now());
  const refreshingRef = useRef(false);
  const performRefreshRef = useRef(performRefresh);
  performRefreshRef.current = performRefresh;

  // Single guarded refresh path. The in-flight flag prevents overlapping
  // requests (no request storms), and success/failure is reported here so the
  // connection state stays accurate regardless of who triggered the refresh.
  const refresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    void (async () => {
      try {
        const ok = await performRefreshRef.current();
        if (ok) {
          setLastSuccessAt(Date.now());
          setConsecutiveFailures(0);
        } else {
          setConsecutiveFailures((n) => n + 1);
        }
      } catch {
        setConsecutiveFailures((n) => n + 1);
      } finally {
        refreshingRef.current = false;
      }
    })();
  }, []);

  // Browser connectivity. Reconnection triggers an immediate refresh.
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      refresh();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refresh]);

  // Page visibility. When the display wakes or returns to the foreground,
  // refresh promptly. This only invokes the existing refresh path — it never
  // creates new timers, so sleep/wake cannot multiply timers.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  return {
    online,
    lastSuccessAt,
    consecutiveFailures,
    startedAt: startedAtRef.current,
    refresh,
  };
}