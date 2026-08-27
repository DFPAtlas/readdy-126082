import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentRegistryRecord, AgentStatus } from '@/pages/ai-operations/types';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoSites } from '@/mocks/ai-operations-sites';
import { getAiAgents, getAiSites, createAiAgent, updateAiAgent } from '@/lib/ai-operations';
import { mapAgentRowToRecord, mapRecordToAgentInput } from '@/pages/ai-operations/agents/agentMapper';
import type { DataSourceMode } from '@/pages/ai-operations/sites/components/DataSourceBadge';

// Data-source state for the Central Agent Registry. Mirrors the proven Sites
// pattern so the page never pretends demo data is live:
//   * live  — Supabase `ai_operations_agents` rows loaded successfully.
//   * demo  — the existing mock registry (explicit fallback only).
//   * error — a live request failed; the UI shows a recovery prompt and never
//             auto-switches to demo.
export type AgentDataSourceMode = DataSourceMode;

type SaveResult = { error: string | null };

// A lightweight site option for the Add/Edit site dropdown (stable site key +
// display name). Never exposes the database UUID to the form.
export interface AgentSiteOption {
  key: string;
  name: string;
}

interface AgentsContextValue {
  agents: AgentRegistryRecord[];
  mode: AgentDataSourceMode;
  loading: boolean;
  error: string | null;
  /** Live site options for the Add/Edit dropdown (resolved from ai_sites). */
  sites: AgentSiteOption[];
  /** False if live sites could not be loaded while agents are live — blocks
      unsafe site assignment (no invented UUID mappings). */
  sitesAvailable: boolean;
  refresh: () => Promise<void>;
  loadDemo: () => void;
  createAgent: (record: AgentRegistryRecord) => Promise<SaveResult>;
  updateAgent: (id: string, record: AgentRegistryRecord) => Promise<SaveResult>;
  /** Metadata-only pause/disable — updates registry status, not a runtime. */
  setAgentStatus: (id: string, status: AgentStatus) => Promise<SaveResult>;
}

const AgentsContext = createContext<AgentsContextValue | null>(null);

// Demo lookup keyed by stable id (= agent_key) so live rows can merge their
// nested "Demo Supporting Metadata" (tools, permissions, approval policy,
// dependencies, runs, events, KPI values) where no production table exists yet.
const demoAgentById = new Map((demoAgents as AgentRegistryRecord[]).map((a) => [a.id, a]));

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<AgentRegistryRecord[]>([]);
  const [mode, setMode] = useState<AgentDataSourceMode>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<AgentSiteOption[]>([]);
  const [sitesAvailable, setSitesAvailable] = useState(true);

  // Mutable site-key ↔ UUID maps, rebuilt on each refresh. Kept in a ref so
  // they do not trigger re-renders; the `sites` list (for the dropdown) is the
  // renderable projection.
  const siteMapsRef = useRef({
    uuidByKey: new Map<string, string>(),
    keyByUuid: new Map<string, string>(),
    nameByKey: new Map<string, string>(),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sitesRes, agentsRes] = await Promise.all([getAiSites(), getAiAgents()]);

    // Build site resolution maps from live ai_sites (TEST/SANDBOX excluded).
    const siteRows = (sitesRes.data ?? []).filter((r) => r.is_active !== false);
    const uuidByKey = new Map<string, string>();
    const keyByUuid = new Map<string, string>();
    const nameByKey = new Map<string, string>();
    for (const row of siteRows) {
      uuidByKey.set(row.site_key, row.id);
      keyByUuid.set(row.id, row.site_key);
      nameByKey.set(row.site_key, row.name);
    }
    siteMapsRef.current = { uuidByKey, keyByUuid, nameByKey };

    setSites(siteRows.map((r) => ({ key: r.site_key, name: r.name })));
    // Sites failing to load is non-fatal to the agent list, but blocks safe
    // site assignment (no invented UUID mappings).
    setSitesAvailable(!sitesRes.error);

    if (agentsRes.error) {
      setMode('error');
      setError(agentsRes.error);
      setAgents([]);
      setLoading(false);
      return;
    }

    // Hide the Prompt-01 TEST/SANDBOX verification record (is_active = false).
    const rows = (agentsRes.data ?? []).filter((r) => r.is_active !== false);
    const { keyByUuid: keyByUuidMap, nameByKey: nameByKeyMap } = siteMapsRef.current;
    const mapped = rows.map((r) =>
      mapAgentRowToRecord(
        r,
        demoAgentById.get(r.agent_key),
        r.site_id ? keyByUuidMap.get(r.site_id) ?? null : null,
        r.site_id ? nameByKeyMap.get(r.site_id) ?? '' : '',
      ),
    );
    setAgents(mapped);
    setMode('live');
    setError(null);
    setLoading(false);
  }, []);

  const loadDemo = useCallback(() => {
    setAgents(demoAgents as AgentRegistryRecord[]);
    setSites((demoSites as { id: string; name: string }[]).map((s) => ({ key: s.id, name: s.name })));
    setSitesAvailable(true);
    setMode('demo');
    setError(null);
    setLoading(false);
  }, []);

  const createAgent = useCallback(
    async (record: AgentRegistryRecord): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: never write demo records to Supabase.
        setAgents((prev) => [...prev, record]);
        return { error: null };
      }
      const siteUuid = record.assignedSite
        ? siteMapsRef.current.uuidByKey.get(record.assignedSite) ?? null
        : null;
      const { error: writeError } = await createAiAgent(mapRecordToAgentInput(record, siteUuid));
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const updateAgent = useCallback(
    async (id: string, record: AgentRegistryRecord): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only edit.
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...record, updatedAt: 'Just now' } : a)),
        );
        return { error: null };
      }
      const siteUuid = record.assignedSite
        ? siteMapsRef.current.uuidByKey.get(record.assignedSite) ?? null
        : null;
      const { error: writeError } = await updateAiAgent(id, mapRecordToAgentInput(record, siteUuid));
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  const setAgentStatus = useCallback(
    async (id: string, status: AgentStatus): Promise<SaveResult> => {
      if (mode !== 'live') {
        // Demo/local-only: update registry state in memory only.
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status, updatedAt: 'Just now' } : a)),
        );
        return { error: null };
      }
      // Registry metadata only — NOT a runtime execution control.
      const { error: writeError } = await updateAiAgent(id, { status, is_active: true });
      if (writeError) return { error: writeError };
      await refresh();
      return { error: null };
    },
    [mode, refresh],
  );

  // Load live agents (and the site map) on first mount. A failure surfaces as
  // `error` mode and never silently falls back to demo.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AgentsContextValue>(
    () => ({
      agents,
      mode,
      loading,
      error,
      sites,
      sitesAvailable,
      refresh,
      loadDemo,
      createAgent,
      updateAgent,
      setAgentStatus,
    }),
    [agents, mode, loading, error, sites, sitesAvailable, refresh, loadDemo, createAgent, updateAgent, setAgentStatus],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgents() {
  const ctx = useContext(AgentsContext);
  if (!ctx) throw new Error('useAgents must be used within an AgentsProvider');
  return ctx;
}