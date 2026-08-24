import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupportAnalyticsSite } from '@/types/support-tickets';

/**
 * Generic data-access hook for the Prompt 18 analytics RPCs. Each RPC is a
 * STABLE SECURITY DEFINER function returning a single jsonb payload computed
 * entirely server-side (no raw tickets reach the browser). `enabled` lets a
 * section skip the request until its filters are valid.
 */
export function useAnalyticsJsonb<T>(fnName: string, params: Record<string, unknown>, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }

    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      const { data: result, error: rpcError } = await supabase.rpc(fnName, params);
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setData(result as T);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [fnName, JSON.stringify(params), configured, enabled]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, lastRefreshed, refresh };
}

/**
 * Loads the list of sites the current user is allowed to see for the analytics
 * site filter (respects role + site access server-side).
 */
export function useAnalyticsSites() {
  const [sites, setSites] = useState<SupportAnalyticsSite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('support_analytics_sites');
      if (rpcError) throw rpcError;
      setSites((data ?? []) as SupportAnalyticsSite[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { sites, loading, error, refresh };
}