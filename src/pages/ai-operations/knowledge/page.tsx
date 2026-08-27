import { useMemo, useState } from 'react';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import {
  KNOWLEDGE_SOURCE_TYPE_OPTIONS,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_SCOPE_OPTIONS,
  KNOWLEDGE_SCOPE_LABELS,
  KNOWLEDGE_STATUS_OPTIONS,
  KNOWLEDGE_STATUS,
  INFORMATION_CLASSIFICATION_OPTIONS,
  INFORMATION_CLASSIFICATION,
  REVIEW_STATE_OPTIONS,
  REVIEW_STATE,
} from '@/pages/ai-operations/constants';
import { useKnowledge } from '@/pages/ai-operations/knowledge/KnowledgeContext';
import { demoSites } from '@/mocks/ai-operations-sites';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import KnowledgeKpis from '@/pages/ai-operations/knowledge/components/KnowledgeKpis';
import MemoryTypes from '@/pages/ai-operations/knowledge/components/MemoryTypes';
import KnowledgeRegistry from '@/pages/ai-operations/knowledge/components/KnowledgeRegistry';
import KnowledgeFormModal from '@/pages/ai-operations/knowledge/components/KnowledgeFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

export default function KnowledgePage() {
  const { sources, mode, loading, error, refresh, loadDemo, createSource } = useKnowledge();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [type, setType] = useState('');
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState('');
  const [classification, setClassification] = useState('');
  const [reviewState, setReviewState] = useState('');
  const [aiUsage, setAiUsage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setLastUpdated(new Date());
    await refresh();
    setRefreshing(false);
  };

  const handleSave = async (record: KnowledgeSource) => {
    setSaveError(null);
    const res = await createSource(record);
    if (res.error) setSaveError(res.error);
  };

  const hasActiveFilters = Boolean(search || site || type || scope || status || classification || reviewState || aiUsage);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setType('');
    setScope('');
    setStatus('');
    setClassification('');
    setReviewState('');
    setAiUsage('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => {
      const haystack = `${s.id} ${s.title} ${s.description} ${s.siteName} ${s.ownerTeam} ${KNOWLEDGE_SOURCE_TYPE_LABELS[s.type]} ${s.keywords.join(' ')} ${s.tags.join(' ')} ${s.topics.join(' ')}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && s.siteId !== null) return false;
      if (site && site !== 'group' && s.siteId !== site) return false;
      if (type && s.type !== type) return false;
      if (scope && s.scope !== scope) return false;
      if (status && s.status !== status) return false;
      if (classification && s.classification !== classification) return false;
      if (reviewState && s.reviewState !== reviewState) return false;
      if (aiUsage === 'yes' && !s.aiUsageAllowed) return false;
      if (aiUsage === 'no' && s.aiUsageAllowed) return false;
      return true;
    });
  }, [sources, search, site, type, scope, status, classification, reviewState, aiUsage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Knowledge &amp; Memory</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central governance and source registry for the information AI agents are permitted to use across the Digital Footprint group.
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
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Add Knowledge Source
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 text-sm text-red-400">
          {saveError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-foreground-500">
          <i className="ri-loader-4-line text-2xl animate-spin w-6 h-6 flex items-center justify-center"></i>
          <span className="ml-3 text-sm">Loading knowledge registry…</span>
        </div>
      )}

      {/* Error */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto">
          <i className="ri-error-warning-line text-4xl text-red-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Knowledge registry unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error ?? 'Unable to load live knowledge data.'}</p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-4 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flask-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Use Demo Data
            </button>
          </div>
        </div>
      )}

      {!loading && mode !== 'error' && (
        <>
          <p className="text-[11px] font-label text-foreground-600 -mt-3">
            Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {sources.length} sources
          </p>

          {/* KPI cards */}
          <KnowledgeKpis sources={sources} />

          {/* Memory architecture */}
          <MemoryTypes />

          {/* Search + filters */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by source ID, title, description, keywords, tags or topics…"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
                <option value="">Site: All</option>
                <option value="group">Group-wide</option>
                {demoSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                <option value="">Source type: All</option>
                {KNOWLEDGE_SOURCE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{KNOWLEDGE_SOURCE_TYPE_LABELS[t]}</option>
                ))}
              </select>

              <select value={scope} onChange={(e) => setScope(e.target.value)} className={selectCls}>
                <option value="">Scope: All</option>
                {KNOWLEDGE_SCOPE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{KNOWLEDGE_SCOPE_LABELS[s]}</option>
                ))}
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="">Status: All</option>
                {KNOWLEDGE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{KNOWLEDGE_STATUS[s].label}</option>
                ))}
              </select>

              <select value={classification} onChange={(e) => setClassification(e.target.value)} className={selectCls}>
                <option value="">Classification: All</option>
                {INFORMATION_CLASSIFICATION_OPTIONS.map((c) => (
                  <option key={c} value={c}>{INFORMATION_CLASSIFICATION[c].label}</option>
                ))}
              </select>

              <select value={reviewState} onChange={(e) => setReviewState(e.target.value)} className={selectCls}>
                <option value="">Review state: All</option>
                {REVIEW_STATE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{REVIEW_STATE[r].label}</option>
                ))}
              </select>

              <select value={aiUsage} onChange={(e) => setAiUsage(e.target.value)} className={selectCls}>
                <option value="">AI usage: All</option>
                <option value="yes">Allowed</option>
                <option value="no">Not allowed</option>
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

          {/* Registry */}
          <KnowledgeRegistry sources={filtered} />
        </>
      )}

      {/* Add/Edit modal */}
      <KnowledgeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        source={null}
        onSave={handleSave}
      />
    </div>
  );
}