import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import { demoSites } from '@/mocks/ai-operations-sites';
import { getAiSites, createAiSite, updateAiSite } from '@/lib/ai-operations';
import { mapSiteRowToRecord, mapRecordToSiteInput } from '@/pages/ai-operations/sites/siteMapper';

// Data-source state for the Group Site Registry. The page must never pretend
// demo data is live, so the mode is surfaced explicitly to the UI:
//   * live  — Supabase `ai_sites` rows loaded successfully.
//   * demo  — the existing six-site mock registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt (Retry /
//             Use Demo Data) and does NOT auto-switch to demo.
export type SiteDataSourceMode = 'live' | 'demo' | 'error';

type SaveResult = { error: string | null };

interface SitesContextValue {
  sites: SiteRegistryRecord[];
  mode: SiteDataSourceMode;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  createSite: (record: SiteRegistryRecord) => Promise<SaveResult>;
  updateSite: (id: string, record: SiteRegistryRecord) => Promise<SaveResult>;
}

const SitesContext = createContext<SitesContextValue | null>(null);

// Demo lookup keyed by stable id (= site_key) so live rows can merge their
// nested "Demo Supporting Metadata" (connections, capabilities, ownership,
// agent previews and KPI values) where no production table exists yet.
const demoSiteById = new Map((demoSites as SiteRegistryRecord[]).map((s) => [s.id, s]));

export function SitesProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteRegistryRecord[]>([]);
  const [mode, setMode] = useState<SiteDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await getAiSites();
    if (loadError) {
      setMode('error');
      setError(loadError);
      setSites([]);
      setLoading(false);
      return;
    }
    // Hide the Prompt-01 TEST/SANDBOX verification record from the normal
    // registry view (it is `is_active = false`).
    const rows = (data ?? []).filter((r) => r.is_active !== false);
    const mapped = rows.map((r) => mapSiteRowToRecord(r, demoSiteById.get(r.site_key)));
    setSites(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setSites(demoSites as SiteRegistryRecord[]);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createSite = useCallback(
    async (record: SiteRegistryRecord): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: never write demo records to Supabase.
        setSites((prev) => [...prev, record]);
        return { error: null };
      }
      const { error: writeError } = await createAiSite(mapRecordToSiteInput(record));
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateSite = useCallback(
    async (id: string, record: SiteRegistryRecord): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only edit.
        setSites((prev) =>
          prev.map((s) => (s.id === id ? { ...record, updatedAt: 'Just now' } : s)),
        );
        return { error: null };
      }
      const { error: writeError } = await updateAiSite(record.id, mapRecordToSiteInput(record));
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Load live sites on first mount. A failure surfaces as `error` mode and
  // never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SitesContextValue>(
    () => ({ sites, mode, loading, error, refresh, loadDemo, createSite, updateSite }),
    [sites, mode, loading, error, refresh, loadDemo, createSite, updateSite],
  );

  return <SitesContext.Provider value={value}>{children}</SitesContext.Provider>;
}

export function useSites() {
  const ctx = useContext(SitesContext);
  if (!ctx) throw new Error('useSites must be used within a SitesProvider');
  return ctx;
}