import { useMemo, useState } from 'react';
import type { ToolConnection } from '@/pages/ai-operations/types';
import {
  TOOL_CATEGORY_OPTIONS,
  TOOL_CATEGORY_LABELS,
  TOOL_CONNECTION_STATUS_OPTIONS,
  TOOL_CONNECTION_STATUS,
  CONNECTION_HEALTH_OPTIONS,
  CONNECTION_HEALTH,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import { demoSites } from '@/mocks/ai-operations-sites';
import { useTools } from '@/pages/ai-operations/tools/ToolsContext';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import ToolKpis from '@/pages/ai-operations/tools/components/ToolKpis';
import RegistryTable from '@/pages/ai-operations/tools/components/RegistryTable';
import ConnectionFormModal from '@/pages/ai-operations/tools/components/ConnectionFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const criticalityOptions = ['low', 'medium', 'high', 'critical'] as const;

export default function ToolsPage() {
  const { connections, mode, loading, error, refresh, loadDemo, createConnection } = useTools();
  const { user, role } = useAuth();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [health, setHealth] = useState('');
  const [environment, setEnvironment] = useState('');
  const [criticality, setCriticality] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);

  // Actor for audit events = authenticated staff identity (never invented).
  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');

  const providerOptions = useMemo(() => {
    return [...new Set(connections.map((c) => c.provider))].sort();
  }, [connections]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const hasActiveFilters = Boolean(search || site || category || provider || status || health || environment || criticality);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setCategory('');
    setProvider('');
    setStatus('');
    setHealth('');
    setEnvironment('');
    setCriticality('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connections.filter((c) => {
      const haystack = `${c.id} ${c.name} ${c.provider} ${TOOL_CATEGORY_LABELS[c.category]} ${c.scope} ${c.reference} ${c.ownerTeam}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && c.siteId !== null) return false;
      if (site && site !== 'group' && !c.siteUsage.some((u) => u.siteId === site)) return false;
      if (category && c.category !== category) return false;
      if (provider && c.provider !== provider) return false;
      if (status && c.status !== status) return false;
      if (health && c.health.state !== health) return false;
      if (environment && c.environment !== environment) return false;
      if (criticality && c.criticality !== criticality) return false;
      return true;
    });
  }, [connections, search, site, category, provider, status, health, environment, criticality]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Tools &amp; Connections</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central inventory and access-control view for the services and tools available to AI agents across the Digital Footprint group.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            title="Refresh"
          >
            <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}></i>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {mode !== 'error' && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Add Connection
            </button>
          )}
        </div>
      </div>

      {mode !== 'error' && !loading && (
        <p className="text-[11px] font-label text-foreground-600 -mt-3">
          Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {connections.length} connections
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-full h-8 bg-background-200/60 rounded-md"></div>
            </div>
          ))}
          <p className="text-xs font-label text-foreground-600 pt-2">Loading live connections…</p>
        </div>
      )}

      {/* Error state — never auto-switch to demo */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-plug-2-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live Tools &amp; Connections unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2 max-w-lg mx-auto">
            {error ?? 'The live registry could not be reached. You can retry, or view the demo registry instead.'}
          </p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-300/60 rounded-md px-4 py-2 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flask-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Use Demo Data
            </button>
          </div>
        </div>
      )}

      {/* Data-source notice (demo mode) */}
      {!loading && mode === 'demo' && (
        <div className="bg-background-100 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <i className="ri-flask-line text-sm text-amber-400 w-4 h-4 flex items-center justify-center"></i>
          <p className="text-xs text-foreground-500">
            Demo registry — base metadata and all supporting sections are demo data; nothing is written to Supabase.
          </p>
        </div>
      )}

      {/* KPI cards */}
      {!loading && mode !== 'error' && <ToolKpis connections={connections} />}

      {/* Search + filters */}
      {!loading && mode !== 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by connection ID, name, provider, category, scope or reference…"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
              <option value="">Site: All</option>
              <option value="group">Group-wide (Core)</option>
              {demoSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              <option value="">Category: All</option>
              {TOOL_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{TOOL_CATEGORY_LABELS[c]}</option>
              ))}
            </select>

            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectCls}>
              <option value="">Provider: All</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Status: All</option>
              {TOOL_CONNECTION_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{TOOL_CONNECTION_STATUS[s].label}</option>
              ))}
            </select>

            <select value={health} onChange={(e) => setHealth(e.target.value)} className={selectCls}>
              <option value="">Health: All</option>
              {CONNECTION_HEALTH_OPTIONS.map((h) => (
                <option key={h} value={h}>{CONNECTION_HEALTH[h].label}</option>
              ))}
            </select>

            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
              <option value="">Environment: All</option>
              {ENVIRONMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>

            <select value={criticality} onChange={(e) => setCriticality(e.target.value)} className={selectCls}>
              <option value="">Criticality: All</option>
              {criticalityOptions.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
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
      )}

      {/* Registry table */}
      {!loading && mode !== 'error' && <RegistryTable connections={filtered} />}

      {/* Add/Edit connection modal */}
      <ConnectionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        connection={null}
        onSave={(record) => createConnection(record as ToolConnection, actor)}
      />
    </div>
  );
}