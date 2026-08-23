import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  SupportSummary,
  SupportVolumePoint,
  VolumeGranularity,
  SupportSitePerformance,
  SupportSlaSummary,
  SupportSlaBreach,
  SupportStaffWorkload,
  SupportUnassignedSummary,
} from '@/types/support-tickets';

/**
 * Single focused data-access hook for the Support Reports page.
 * Responsible for loading the selected range, calling the secure summary RPC,
 * and returning typed results with loading / error / retry / refresh state.
 * No SQL lives in the page component.
 */
export function useSupportSummary(startIso: string, endIso: string) {
  const [summary, setSummary] = useState<SupportSummary | null>(null);
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

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_summary', {
        p_start: startIso,
        p_end: endIso,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setSummary(data as SupportSummary);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { summary, loading, error, lastRefreshed, refresh };
}

/**
 * Data-access hook for the ticket-volume chart. Calls internal_support_volume()
 * with the selected range and returns typed, server-aggregated series data.
 * Also derives the grouping granularity (day/week/month) from the range length
 * so the UI can label the chart correctly.
 */
export function useSupportVolume(startIso: string, endIso: string) {
  const [volume, setVolume] = useState<SupportVolumePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const granularity = useMemo<VolumeGranularity>(() => {
    if (!startIso || !endIso) return 'day';
    const days = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400000;
    if (days <= 31) return 'day';
    if (days <= 180) return 'week';
    return 'month';
  }, [startIso, endIso]);

  const load = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_volume', {
        p_start: startIso,
        p_end: endIso,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setVolume((data ?? []) as SupportVolumePoint[]);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load volume data');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { volume, loading, error, lastRefreshed, refresh, granularity };
}

/**
 * Data-access hook for the website-performance table. Calls
 * internal_support_site_performance() with the selected range and returns one
 * typed, server-aggregated row per registered website.
 */
export function useSupportSitePerformance(startIso: string, endIso: string) {
  const [rows, setRows] = useState<SupportSitePerformance[] | null>(null);
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

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_site_performance', {
        p_start: startIso,
        p_end: endIso,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setRows((data ?? []) as SupportSitePerformance[]);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load website performance');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { rows, loading, error, lastRefreshed, refresh };
}

/**
 * Data-access hook for the SLA performance summary. Calls
 * internal_support_sla_summary() with the selected range + optional site
 * filter and returns typed summary values.
 */
export function useSupportSlaSummary(
  startIso: string,
  endIso: string,
  siteId: string | null,
) {
  const [summary, setSummary] = useState<SupportSlaSummary | null>(null);
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

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_sla_summary', {
        p_start: startIso,
        p_end: endIso,
        p_site_id: siteId ?? null,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setSummary(data as SupportSlaSummary);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load SLA summary');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, siteId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { summary, loading, error, lastRefreshed, refresh };
}

/**
 * Data-access hook for the active SLA-breach table. Calls
 * internal_support_sla_breaches() with the selected range + optional site
 * filter and returns typed, paginated breach rows.
 */
export function useSupportSlaBreaches(
  startIso: string,
  endIso: string,
  siteId: string | null,
) {
  const [rows, setRows] = useState<SupportSlaBreach[] | null>(null);
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

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_sla_breaches', {
        p_start: startIso,
        p_end: endIso,
        p_site_id: siteId ?? null,
        p_limit: 50,
        p_offset: 0,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setRows((data ?? []) as SupportSlaBreach[]);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load SLA breaches');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, siteId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { rows, loading, error, lastRefreshed, refresh };
}

/**
 * Data-access hook for the staff-workload table. Calls
 * internal_support_staff_workload() with the selected range + optional site
 * filter and returns one typed row per eligible (owner/admin) staff member.
 * `enabled` is false for viewers (owner/admin only), skipping the request.
 */
export function useSupportStaffWorkload(
  startIso: string,
  endIso: string,
  siteId: string | null,
  enabled: boolean,
) {
  const [rows, setRows] = useState<SupportStaffWorkload[] | null>(null);
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
      setRows(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_staff_workload', {
        p_start: startIso,
        p_end: endIso,
        p_site_id: siteId ?? null,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setRows((data ?? []) as SupportStaffWorkload[]);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load staff workload');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, siteId, configured, enabled]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { rows, loading, error, lastRefreshed, refresh };
}

/**
 * Data-access hook for the unassigned-ticket summary. Calls
 * internal_support_unassigned_summary() with the selected range + optional
 * site filter and returns a typed snapshot payload. `enabled` is false for
 * viewers (owner/admin only).
 */
export function useSupportUnassignedSummary(
  startIso: string,
  endIso: string,
  siteId: string | null,
  enabled: boolean,
) {
  const [summary, setSummary] = useState<SupportUnassignedSummary | null>(null);
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
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('internal_support_unassigned_summary', {
        p_start: startIso,
        p_end: endIso,
        p_site_id: siteId ?? null,
      });
      if (id !== requestIdRef.current) return;
      if (rpcError) throw rpcError;
      setSummary(data as SupportUnassignedSummary);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load unassigned summary');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [startIso, endIso, siteId, configured, enabled]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { summary, loading, error, lastRefreshed, refresh };
}