import { useMemo, useState } from 'react';
import type { AiModel, AiProvider } from '@/pages/ai-operations/types';
import {
  MODEL_STATUS_OPTIONS,
  MODEL_STATUS,
  MODEL_PURPOSE_OPTIONS,
  MODEL_PURPOSE_LABELS,
  CONNECTION_HEALTH_OPTIONS,
  CONNECTION_HEALTH,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import { useModels } from '@/pages/ai-operations/models/ModelsContext';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import ModelKpis from '@/pages/ai-operations/models/components/ModelKpis';
import ProviderStatus from '@/pages/ai-operations/models/components/ProviderStatus';
import ModelRegistry from '@/pages/ai-operations/models/components/ModelRegistry';
import RoutingPolicy from '@/pages/ai-operations/models/components/RoutingPolicy';
import ModelFormModal from '@/pages/ai-operations/models/components/ModelFormModal';
import ProviderFormModal from '@/pages/ai-operations/models/components/ProviderFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

export default function ModelsPage() {
  const { models, providers, mode, loading, error, refresh, loadDemo, createModel, createProvider } = useModels();
  const { user, role } = useAuth();
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [hosting, setHosting] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('');
  const [health, setHealth] = useState('');
  const [environment, setEnvironment] = useState('');
  const [enabled, setEnabled] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  // Actor for audit events = authenticated staff identity (never invented).
  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const hasActiveFilters = Boolean(search || provider || hosting || purpose || status || health || environment || enabled);

  const clearFilters = () => {
    setSearch('');
    setProvider('');
    setHosting('');
    setPurpose('');
    setStatus('');
    setHealth('');
    setEnvironment('');
    setEnabled('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((m) => {
      const haystack = `${m.id} ${m.name} ${m.providerName} ${m.family} ${MODEL_PURPOSE_LABELS[m.purpose]} ${m.notes}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (provider && m.providerId !== provider) return false;
      if (hosting && m.hostingType !== hosting) return false;
      if (purpose && m.purpose !== purpose) return false;
      if (status && m.status !== status) return false;
      if (health && m.health !== health) return false;
      if (environment && m.environment !== environment) return false;
      if (enabled === 'yes' && !m.enabled) return false;
      if (enabled === 'no' && m.enabled) return false;
      return true;
    });
  }, [models, search, provider, hosting, purpose, status, health, environment, enabled]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Models &amp; AI Providers</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central governance, health and routing view for the AI models available to agents across the Digital Footprint group.
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
            <>
              <button
                onClick={() => setProviderModalOpen(true)}
                className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Add Provider
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Add Model
              </button>
            </>
          )}
        </div>
      </div>

      {mode !== 'error' && !loading && (
        <p className="text-[11px] font-label text-foreground-600 -mt-3">
          Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {models.length} models
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
          <p className="text-xs font-label text-foreground-600 pt-2">Loading live models…</p>
        </div>
      )}

      {/* Error state — never auto-switch to demo */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-cpu-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live Models &amp; Providers unavailable</h2>
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
            Demo registry — base metadata and runtime sections are demo data; nothing is written to Supabase.
          </p>
        </div>
      )}

      {/* KPI cards */}
      {!loading && mode !== 'error' && <ModelKpis models={models} />}

      {/* Provider status */}
      {!loading && mode !== 'error' && <ProviderStatus providers={providers} />}

      {/* Search + filters */}
      {!loading && mode !== 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by model ID, name, provider, family, purpose or notes…"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectCls}>
              <option value="">Provider: All</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select value={hosting} onChange={(e) => setHosting(e.target.value)} className={selectCls}>
              <option value="">Local / Cloud: All</option>
              <option value="local">Local</option>
              <option value="cloud">Cloud</option>
            </select>

            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={selectCls}>
              <option value="">Purpose: All</option>
              {MODEL_PURPOSE_OPTIONS.map((p) => (
                <option key={p} value={p}>{MODEL_PURPOSE_LABELS[p]}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Status: All</option>
              {MODEL_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{MODEL_STATUS[s].label}</option>
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
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>

            <select value={enabled} onChange={(e) => setEnabled(e.target.value)} className={selectCls}>
              <option value="">Enabled: All</option>
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
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
      {!loading && mode !== 'error' && <ModelRegistry models={filtered} />}

      {/* Routing policy */}
      {!loading && mode !== 'error' && <RoutingPolicy />}

      {/* Add/Edit model modal */}
      <ModelFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        model={null}
        providers={providers}
        onSave={(record) => createModel(record as AiModel, actor)}
      />

      {/* Add/Edit provider modal */}
      <ProviderFormModal
        open={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        provider={null}
        onSave={(record) => createProvider(record as AiProvider, actor)}
      />
    </div>
  );
}