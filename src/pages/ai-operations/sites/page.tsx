import { useMemo, useState } from 'react';
import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import {
  OPERATIONAL_STATUS_OPTIONS,
  AI_STATUS_OPTIONS,
  ENVIRONMENT_OPTIONS,
  BUSINESS_TYPE_OPTIONS,
  CRITICALITY_OPTIONS,
  SITE_STATUS,
  AI_STATUS,
  ENVIRONMENT_LABELS,
  BUSINESS_TYPE_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import { useSites } from '@/pages/ai-operations/sites/SitesContext';
import RegistryTable from '@/pages/ai-operations/sites/components/RegistryTable';
import SiteFormModal from '@/pages/ai-operations/sites/components/SiteFormModal';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

export default function SitesPage() {
  const { sites, mode, loading, error, refresh, loadDemo, createSite } = useSites();
  const [search, setSearch] = useState('');
  const [opStatus, setOpStatus] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [environment, setEnvironment] = useState('');
  const [criticality, setCriticality] = useState('');
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

  const hasActiveFilters = Boolean(search || opStatus || aiStatus || businessType || environment || criticality);

  const clearFilters = () => {
    setSearch('');
    setOpStatus('');
    setAiStatus('');
    setBusinessType('');
    setEnvironment('');
    setCriticality('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((s) => {
      if (q && !`${s.name} ${s.domain} ${s.productName}`.toLowerCase().includes(q)) return false;
      if (opStatus && s.operationalStatus !== opStatus) return false;
      if (aiStatus && s.aiStatus !== aiStatus) return false;
      if (businessType && s.businessType !== businessType) return false;
      if (environment && s.environment !== environment) return false;
      if (criticality && s.criticality !== criticality) return false;
      return true;
    });
  }, [sites, search, opStatus, aiStatus, businessType, environment, criticality]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Group Site Registry</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central inventory of every Digital Footprint group platform, its AI agents, infrastructure connections, environments and operational status.
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
              Add Site
            </button>
          )}
        </div>
      </div>

      {mode !== 'error' && !loading && (
        <p className="text-[11px] font-label text-foreground-600 -mt-2">
          Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {sites.length} sites
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
          <p className="text-xs font-label text-foreground-600 pt-2">Loading live site registry…</p>
        </div>
      )}

      {/* Error state — never auto-switch to demo */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-cloud-off-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live Site Registry unavailable</h2>
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

      {/* Toolbar: search + filters (hidden while loading/error) */}
      {!loading && mode !== 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by site name, domain or product…"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select value={opStatus} onChange={(e) => setOpStatus(e.target.value)} className={selectCls}>
              <option value="">Operational: All</option>
              {OPERATIONAL_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{SITE_STATUS[s].label}</option>
              ))}
            </select>

            <select value={aiStatus} onChange={(e) => setAiStatus(e.target.value)} className={selectCls}>
              <option value="">AI Status: All</option>
              {AI_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{AI_STATUS[s].label}</option>
              ))}
            </select>

            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={selectCls}>
              <option value="">Type: All</option>
              {BUSINESS_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{BUSINESS_TYPE_LABELS[t]}</option>
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
              {CRITICALITY_OPTIONS.map((c) => (
                <option key={c} value={c}>{RISK_LEVEL[c].label}</option>
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
      {!loading && mode !== 'error' && <RegistryTable sites={filtered} />}

      {/* Add / edit modal */}
      <SiteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        site={null}
        mode={mode}
        onSave={(record) => createSite(record as SiteRegistryRecord)}
      />
    </div>
  );
}