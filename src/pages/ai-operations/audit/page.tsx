import { useMemo, useState } from 'react';
import {
  AUDIT_EVENT_TYPE_OPTIONS,
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_OUTCOME_OPTIONS,
  AUDIT_OUTCOME,
  SEVERITY,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import AuditKpis from '@/pages/ai-operations/audit/components/AuditKpis';
import AuditLog from '@/pages/ai-operations/audit/components/AuditLog';
import EvidenceRegistry from '@/pages/ai-operations/audit/components/EvidenceRegistry';
import ReviewQueue from '@/pages/ai-operations/audit/components/ReviewQueue';
import HumanOverrides from '@/pages/ai-operations/audit/components/HumanOverrides';
import ComplianceReadiness from '@/pages/ai-operations/audit/components/ComplianceReadiness';

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

const SEVERITY_OPTIONS = ['info', 'low', 'medium', 'high', 'critical'] as const;

export default function AuditPage() {
  const { events, mode, loading, error, refresh, loadDemo } = useAudit();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [eventType, setEventType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [severity, setSeverity] = useState('');
  const [agent, setAgent] = useState('');
  const [environment, setEnvironment] = useState('');
  const [risk, setRisk] = useState('');
  const [evidenceState, setEvidenceState] = useState('');
  const [review, setReview] = useState('');
  const [date, setDate] = useState('');

  const hasActiveFilters = Boolean(
    search || site || eventType || outcome || severity || agent || environment || risk || evidenceState || review || date,
  );

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setEventType('');
    setOutcome('');
    setSeverity('');
    setAgent('');
    setEnvironment('');
    setRisk('');
    setEvidenceState('');
    setReview('');
    setDate('');
  };

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((e) => {
      if (e.agentId) map.set(e.agentId, e.agentName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const haystack = `${e.id} ${e.action} ${e.agentName} ${e.actorTeam} ${e.correlationId} ${e.notes}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site) {
        if (site === 'group' && e.siteId !== 'group') return false;
        if (site !== 'group' && e.siteId !== site) return false;
      }
      if (eventType && e.eventType !== eventType) return false;
      if (outcome && e.outcome !== outcome) return false;
      if (severity && e.severity !== severity) return false;
      if (agent && e.agentId !== agent) return false;
      if (environment && e.environment !== environment) return false;
      if (risk && e.risk !== risk) return false;
      if (evidenceState === 'present' && e.evidenceIds.length === 0) return false;
      if (evidenceState === 'missing' && e.evidenceIds.length > 0) return false;
      if (review === 'required' && !e.reviewRequired) return false;
      if (review === 'none' && e.reviewRequired) return false;
      if (date === 'today' && !e.timestamp.startsWith('2026-08-25')) return false;
      if (date === 'yesterday' && !e.timestamp.startsWith('2026-08-24')) return false;
      return true;
    });
  }, [events, search, site, eventType, outcome, severity, agent, environment, risk, evidenceState, review, date]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-background-100 rounded-md animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-3.5 h-20 animate-pulse"></div>
          ))}
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-background-200/50 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Audit &amp; Evidence</h1>
          <DataSourceBadge mode="error" />
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-xl mx-auto">
          <i className="ri-error-warning-line text-4xl text-amber-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Live Audit &amp; Evidence unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error}</p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 text-sm font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-4 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flask-line w-4 h-4 flex items-center justify-center"></i>
              Use Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Audit &amp; Evidence</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central evidence trail for AI activity, decisions, approvals, security controls and operational outcomes across the Digital Footprint group.
          </p>
        </div>
      </div>

      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        {filtered.length} of {events.length} audit events
      </p>

      {/* KPI cards */}
      <AuditKpis />

      {/* Search + filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by audit ID, action, agent, actor, correlation ID or notes…"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
            <option value="">Site: All</option>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={selectCls}>
            <option value="">Event type: All</option>
            {AUDIT_EVENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{AUDIT_EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={selectCls}>
            <option value="">Outcome: All</option>
            {AUDIT_OUTCOME_OPTIONS.map((o) => (
              <option key={o} value={o}>{AUDIT_OUTCOME[o].label}</option>
            ))}
          </select>

          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectCls}>
            <option value="">Severity: All</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{SEVERITY[s].label}</option>
            ))}
          </select>

          <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
            <option value="">Agent: All</option>
            {agentOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
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
              <option key={r} value={r}>{r === 'green' ? 'Green' : r === 'amber' ? 'Amber' : 'Red'}</option>
            ))}
          </select>

          <select value={evidenceState} onChange={(e) => setEvidenceState(e.target.value)} className={selectCls}>
            <option value="">Evidence: All</option>
            <option value="present">Present</option>
            <option value="missing">Missing</option>
          </select>

          <select value={review} onChange={(e) => setReview(e.target.value)} className={selectCls}>
            <option value="">Review: All</option>
            <option value="required">Required</option>
            <option value="none">Not required</option>
          </select>

          <select value={date} onChange={(e) => setDate(e.target.value)} className={selectCls}>
            <option value="">Date: All</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
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

      {/* Main audit log */}
      <AuditLog events={filtered} />

      {/* Review queue + compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReviewQueue />
        <ComplianceReadiness />
      </div>

      {/* Evidence registry */}
      <EvidenceRegistry />

      {/* Human override audit */}
      <HumanOverrides />
    </div>
  );
}