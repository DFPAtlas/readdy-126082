import { useMemo, useState } from 'react';
import type { AgentRegistryRecord } from '@/pages/ai-operations/types';
import {
  AGENT_STATUS_OPTIONS,
  AGENT_STATUS,
  AGENT_HEALTH_OPTIONS,
  AGENT_HEALTH,
  AGENT_TYPE_OPTIONS,
  AGENT_TYPE_LABELS,
  AGENT_CATEGORY_OPTIONS,
  AGENT_CATEGORY_LABELS,
  AGENT_AUTONOMY_OPTIONS,
  AGENT_AUTONOMY_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import { useAgents } from '@/pages/ai-operations/agents/AgentsContext';
import AgentsTable from '@/pages/ai-operations/agents/components/AgentsTable';
import AgentFormModal from '@/pages/ai-operations/agents/components/AgentFormModal';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const riskOptions = ['low', 'medium', 'high', 'critical'] as const;

export default function AgentsPage() {
  const { agents, mode, loading, error, refresh, loadDemo, createAgent, sites, sitesAvailable } = useAgents();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [health, setHealth] = useState('');
  const [risk, setRisk] = useState('');
  const [environment, setEnvironment] = useState('');
  const [autonomy, setAutonomy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const hasActiveFilters = Boolean(search || site || type || category || status || health || risk || environment || autonomy);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setType('');
    setCategory('');
    setStatus('');
    setHealth('');
    setRisk('');
    setEnvironment('');
    setAutonomy('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      const haystack = `${a.name} ${a.id} ${a.scope} ${a.description} ${AGENT_CATEGORY_LABELS[a.category]}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && a.assignedSite !== null) return false;
      if (site && site !== 'group' && a.assignedSite !== site) return false;
      if (type && a.type !== type) return false;
      if (category && a.category !== category) return false;
      if (status && a.status !== status) return false;
      if (health && a.health !== health) return false;
      if (risk && a.risk !== risk) return false;
      if (environment && a.environment !== environment) return false;
      if (autonomy && a.autonomy !== autonomy) return false;
      return true;
    });
  }, [agents, search, site, type, category, status, health, risk, environment, autonomy]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Agent Registry</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central inventory, governance and operational status for every AI agent across the Digital Footprint group.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            title="Refresh registry"
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
              Add Agent
            </button>
          )}
        </div>
      </div>

      {mode !== 'error' && !loading && (
        <p className="text-[11px] font-label text-foreground-600 -mt-2">
          Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {agents.length} agents
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
          <p className="text-xs font-label text-foreground-600 pt-2">Loading live agent registry…</p>
        </div>
      )}

      {/* Error state — never auto-switch to demo */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-cloud-off-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live Agent Registry unavailable</h2>
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

      {/* Toolbar: search + filters */}
      {!loading && mode !== 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, site, description or category…"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
              <option value="">Site: All</option>
              <option value="group">Group-wide (Core)</option>
              {sites.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>

            <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
              <option value="">Type: All</option>
              {AGENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{AGENT_TYPE_LABELS[t]}</option>
              ))}
            </select>

            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              <option value="">Category: All</option>
              {AGENT_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{AGENT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Status: All</option>
              {AGENT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{AGENT_STATUS[s].label}</option>
              ))}
            </select>

            <select value={health} onChange={(e) => setHealth(e.target.value)} className={selectCls}>
              <option value="">Health: All</option>
              {AGENT_HEALTH_OPTIONS.map((h) => (
                <option key={h} value={h}>{AGENT_HEALTH[h].label}</option>
              ))}
            </select>

            <select value={risk} onChange={(e) => setRisk(e.target.value)} className={selectCls}>
              <option value="">Risk: All</option>
              {riskOptions.map((r) => (
                <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
              ))}
            </select>

            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
              <option value="">Environment: All</option>
              {ENVIRONMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>

            <select value={autonomy} onChange={(e) => setAutonomy(e.target.value)} className={selectCls}>
              <option value="">Autonomy: All</option>
              {AGENT_AUTONOMY_OPTIONS.map((a) => (
                <option key={a} value={a}>{AGENT_AUTONOMY_LABELS[a]}</option>
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

      {/* Registry */}
      {!loading && mode !== 'error' && <AgentsTable agents={filtered} />}

      {/* Add modal */}
      <AgentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agent={null}
        mode={mode}
        sites={sites}
        sitesAvailable={sitesAvailable}
        onSave={(record) => createAgent(record as AgentRegistryRecord)}
      />
    </div>
  );
}