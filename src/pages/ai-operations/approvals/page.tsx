import { useMemo, useState } from 'react';
import type { AiApproval } from '@/pages/ai-operations/types';
import {
  APPROVAL_STATUS_OPTIONS,
  APPROVAL_STATUS,
  REQUEST_TYPE_OPTIONS,
  REQUEST_TYPE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  EXPIRY_STATE_OPTIONS,
  EXPIRY_STATE,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import { useApprovals } from '@/pages/ai-operations/approvals/ApprovalsContext';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import SummaryKpis from '@/pages/ai-operations/approvals/components/SummaryKpis';
import PriorityReviews from '@/pages/ai-operations/approvals/components/PriorityReviews';
import ApprovalsTable from '@/pages/ai-operations/approvals/components/ApprovalsTable';
import ApprovalFormModal from '@/pages/ai-operations/approvals/components/ApprovalFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const riskClassOptions = ['green', 'amber', 'red'] as const;
const severityOptions = ['low', 'medium', 'high', 'critical'] as const;

export default function ApprovalsPage() {
  const { approvals, mode, loading, error, sites, agents, runs, refresh, loadDemo, createApproval } = useApprovals();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [agent, setAgent] = useState('');
  const [status, setStatus] = useState('');
  const [riskClass, setRiskClass] = useState('');
  const [severity, setSeverity] = useState('');
  const [environment, setEnvironment] = useState('');
  const [requestType, setRequestType] = useState('');
  const [expiryState, setExpiryState] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const siteOptions = [{ id: 'group', name: 'Group-wide' }, ...sites.map((s) => ({ id: s.key, name: s.name }))];

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const hasActiveFilters = Boolean(search || site || agent || status || riskClass || severity || environment || requestType || expiryState);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setAgent('');
    setStatus('');
    setRiskClass('');
    setSeverity('');
    setEnvironment('');
    setRequestType('');
    setExpiryState('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvals.filter((a) => {
      const haystack = `${a.id} ${a.title} ${a.requestedAction} ${a.siteName} ${a.agentName} ${a.runId ?? ''} ${a.requestedBy}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && a.siteId !== 'group') return false;
      if (site && site !== 'group' && a.siteId !== site) return false;
      if (agent && a.agentId !== agent) return false;
      if (status && a.status !== status) return false;
      if (riskClass && a.riskClass !== riskClass) return false;
      if (severity && a.severity !== severity) return false;
      if (environment && a.environment !== environment) return false;
      if (requestType && a.requestType !== requestType) return false;
      if (expiryState && a.expiryState !== expiryState) return false;
      return true;
    });
  }, [approvals, search, site, agent, status, riskClass, severity, environment, requestType, expiryState]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">AI Approvals</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Human review, authorisation and governance for controlled AI actions across the Digital Footprint group.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
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
            Create Approval Request
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-background-200/60 rounded w-16 mb-3"></div>
                <div className="h-6 bg-background-200/60 rounded w-10"></div>
              </div>
            ))}
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3 animate-pulse">
            <div className="h-4 bg-background-200/60 rounded w-1/3"></div>
            <div className="h-4 bg-background-200/60 rounded w-1/2"></div>
            <div className="h-4 bg-background-200/60 rounded w-2/3"></div>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-xl mx-auto">
          <i className="ri-error-warning-line text-4xl text-red-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Live Approvals unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error ?? 'The live approval registry could not be reached.'}</p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 text-sm font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-4 py-2 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flask-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Use Demo Data
            </button>
          </div>
        </div>
      )}

      {/* Live / demo content */}
      {!loading && mode !== 'error' && (
        <>
          <p className="text-[11px] font-label text-foreground-600 -mt-3">
            {mode === 'live' ? 'Live registry' : 'Demo registry'} · {filtered.length} of {approvals.length} approvals
          </p>

          {/* KPI cards */}
          <SummaryKpis approvals={approvals} />

          {/* Priority reviews */}
          <section className="space-y-4">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Priority Reviews</h3>
            <PriorityReviews approvals={approvals} />
          </section>

          {/* Search + filters */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by approval ID, title, action, site, agent, run ID or requester…"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
                <option value="">Site: All</option>
                {siteOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
                <option value="">Agent: All</option>
                {agents.map((a) => (
                  <option key={a.key} value={a.key}>{a.name}</option>
                ))}
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="">Status: All</option>
                {APPROVAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{APPROVAL_STATUS[s].label}</option>
                ))}
              </select>

              <select value={riskClass} onChange={(e) => setRiskClass(e.target.value)} className={selectCls}>
                <option value="">Risk class: All</option>
                {riskClassOptions.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>

              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectCls}>
                <option value="">Severity: All</option>
                {severityOptions.map((r) => (
                  <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
                ))}
              </select>

              <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
                <option value="">Environment: All</option>
                {ENVIRONMENT_OPTIONS.map((e) => (
                  <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
                ))}
              </select>

              <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className={selectCls}>
                <option value="">Type: All</option>
                {REQUEST_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
                ))}
              </select>

              <select value={expiryState} onChange={(e) => setExpiryState(e.target.value)} className={selectCls}>
                <option value="">Expiry: All</option>
                {EXPIRY_STATE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{EXPIRY_STATE[s].label}</option>
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

          {/* Approvals table */}
          <ApprovalsTable approvals={filtered} />
        </>
      )}

      {/* Create approval modal */}
      <ApprovalFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        approval={null}
        mode={mode}
        sites={sites}
        agents={agents}
        runs={runs}
        onSave={(record) => createApproval(record as AiApproval)}
      />
    </div>
  );
}