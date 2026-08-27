import { useMemo, useState } from 'react';
import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import {
  POLICY_CATEGORY_OPTIONS,
  POLICY_CATEGORY_LABELS,
  POLICY_STATUS_OPTIONS,
  POLICY_STATUS,
  POLICY_EFFECT_OPTIONS,
  POLICY_EFFECT,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  RISK_CLASS,
} from '@/pages/ai-operations/constants';
import { useSecurity } from '@/pages/ai-operations/security/SecurityContext';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import SecurityKpis from '@/pages/ai-operations/security/components/SecurityKpis';
import SecurityLayers from '@/pages/ai-operations/security/components/SecurityLayers';
import PolicyRegistry from '@/pages/ai-operations/security/components/PolicyRegistry';
import ViolationsPanel from '@/pages/ai-operations/security/components/ViolationsPanel';
import ActiveExceptions from '@/pages/ai-operations/security/components/ActiveExceptions';
import PolicyFormModal from '@/pages/ai-operations/security/components/PolicyFormModal';
import EvaluatorModal from '@/pages/ai-operations/security/components/EvaluatorModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const SITES = [
  { id: 'group', label: 'Group-wide' },
  { id: 'digital-footprint', label: 'Digital Footprint' },
  { id: 'quickguard', label: 'QuickGuard' },
  { id: 'guardianhub', label: 'GuardianHub' },
  { id: 'lethub', label: 'LetHub' },
  { id: 'wedora', label: 'Wedora' },
  { id: 'the-forge', label: 'The Forge' },
];

function reviewState(p: AiSecurityPolicy): 'overdue' | 'due_soon' | 'current' {
  if (p.reviewDate < '2026-08-25') return 'overdue';
  if (p.reviewDate <= '2026-09-01') return 'due_soon';
  return 'current';
}

export default function SecurityPage() {
  const { policies, mode, loading, error, refresh, loadDemo, createPolicy, sites, agents, simulate, saveEvaluation } = useSecurity();
  const { user, role } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [effect, setEffect] = useState('');
  const [site, setSite] = useState('');
  const [environment, setEnvironment] = useState('');
  const [risk, setRisk] = useState('');
  const [review, setReview] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [evaluatorOpen, setEvaluatorOpen] = useState(false);

  // Actor for audit events = authenticated staff identity (never invented).
  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const hasActiveFilters = Boolean(search || category || status || effect || site || environment || risk || review);

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStatus('');
    setEffect('');
    setSite('');
    setEnvironment('');
    setRisk('');
    setReview('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies.filter((p) => {
      const haystack = `${p.id} ${p.name} ${POLICY_CATEGORY_LABELS[p.category]} ${p.actionType} ${p.notes}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (category && p.category !== category) return false;
      if (status && p.status !== status) return false;
      if (effect && p.effect !== effect) return false;
      if (site) {
        if (site === 'group' && p.siteId !== null) return false;
        if (site !== 'group' && p.siteId !== site) return false;
      }
      if (environment && p.environment !== environment) return false;
      if (risk && p.riskClass !== risk) return false;
      if (review && reviewState(p) !== review) return false;
      return true;
    });
  }, [policies, search, category, status, effect, site, environment, risk, review]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">AI Security &amp; Policy</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central governance, permission and risk controls for AI agents operating across the Digital Footprint group.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setEvaluatorOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-scales-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Evaluate Request
          </button>
          {mode !== 'error' && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Add Policy
            </button>
          )}
        </div>
      </div>

      {mode !== 'error' && !loading && (
        <p className="text-[11px] font-label text-foreground-600 -mt-3">
          {filtered.length} of {policies.length} policies
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
          <p className="text-xs font-label text-foreground-600 pt-2">Loading live policy registry…</p>
        </div>
      )}

      {/* Error state — never auto-switch to demo */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-shield-flash-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live Security &amp; Policy unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2 max-w-lg mx-auto">
            {error ?? 'The live policy registry could not be reached. You can retry, or view the demo registry instead.'}
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
            Demo policy registry — base metadata and all supporting sections are demo data; nothing is written to Supabase.
          </p>
        </div>
      )}

      {/* KPI cards */}
      {!loading && mode !== 'error' && <SecurityKpis policies={policies} />}

      {/* Security layers */}
      {!loading && mode !== 'error' && <SecurityLayers />}

      {/* Search + filters */}
      {!loading && mode !== 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by policy ID, name, category, action or notes…"
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              <option value="">Category: All</option>
              {POLICY_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{POLICY_CATEGORY_LABELS[c]}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Status: All</option>
              {POLICY_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{POLICY_STATUS[s].label}</option>
              ))}
            </select>

            <select value={effect} onChange={(e) => setEffect(e.target.value)} className={selectCls}>
              <option value="">Effect: All</option>
              {POLICY_EFFECT_OPTIONS.map((ef) => (
                <option key={ef} value={ef}>{POLICY_EFFECT[ef].label}</option>
              ))}
            </select>

            <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
              <option value="">Site: All</option>
              {SITES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
              <option value="">Environment: All</option>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>

            <select value={risk} onChange={(e) => setRisk(e.target.value)} className={selectCls}>
              <option value="">Risk: All</option>
              {(['green', 'amber', 'red'] as const).map((r) => (
                <option key={r} value={r}>{RISK_CLASS[r].label}</option>
              ))}
            </select>

            <select value={review} onChange={(e) => setReview(e.target.value)} className={selectCls}>
              <option value="">Review state: All</option>
              <option value="overdue">Overdue</option>
              <option value="due_soon">Due Soon</option>
              <option value="current">Current</option>
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
      {!loading && mode !== 'error' && <PolicyRegistry policies={filtered} />}

      {/* Violations */}
      {!loading && mode !== 'error' && <ViolationsPanel />}

      {/* Active exceptions */}
      {!loading && mode !== 'error' && <ActiveExceptions />}

      {/* Modals */}
      <PolicyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        policy={null}
        mode={mode}
        sites={sites}
        onSave={(record) => createPolicy(record, actor)}
      />

      <EvaluatorModal
        open={evaluatorOpen}
        onClose={() => setEvaluatorOpen(false)}
        mode={mode}
        sites={sites}
        agents={agents}
        simulate={simulate}
        saveEvaluation={saveEvaluation}
        actor={actor}
      />
    </div>
  );
}