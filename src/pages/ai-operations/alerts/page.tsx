import { useMemo, useState } from 'react';
import type { AiAlert } from '@/pages/ai-operations/types';
import {
  ALERT_TYPE_OPTIONS,
  ALERT_TYPE_LABELS,
  ALERT_STATUS_OPTIONS,
  ALERT_STATUS,
  SEVERITY,
} from '@/pages/ai-operations/constants';
import { useAlerts } from '@/pages/ai-operations/alerts/AlertsContext';
import { demoSites } from '@/mocks/ai-operations-sites';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import AlertsKpis from '@/pages/ai-operations/alerts/components/AlertsKpis';
import PriorityIncidents from '@/pages/ai-operations/alerts/components/PriorityIncidents';
import IncidentQueue from '@/pages/ai-operations/alerts/components/IncidentQueue';
import AlertSources from '@/pages/ai-operations/alerts/components/AlertSources';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const SEVERITY_OPTIONS: { value: AiAlert['severity']; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

export default function AlertsPage() {
  const { alerts, mode, loading, error, refresh, loadDemo } = useAlerts();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [agent, setAgent] = useState('');
  const [team, setTeam] = useState('');
  const [repeating, setRepeating] = useState('');
  const [date, setDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const agents = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => {
      if (a.agentName && a.agentName !== '—') set.add(a.agentName);
    });
    return Array.from(set).sort();
  }, [alerts]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => set.add(a.assignedTeam));
    return Array.from(set).sort();
  }, [alerts]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => {
      if (a.detectedAt) set.add(a.detectedAt.slice(0, 10));
    });
    return Array.from(set).filter(Boolean).sort().reverse();
  }, [alerts]);

  const hasActiveFilters = Boolean(search || site || type || severity || status || agent || team || repeating || date);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setType('');
    setSeverity('');
    setStatus('');
    setAgent('');
    setTeam('');
    setRepeating('');
    setDate('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      const haystack = `${a.id} ${a.incidentId} ${a.title} ${a.description} ${a.siteName} ${a.affectedService} ${a.tags.join(' ')}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && a.siteId !== 'group') return false;
      if (site && site !== 'group' && a.siteId !== site) return false;
      if (type && a.type !== type) return false;
      if (severity && a.severity !== severity) return false;
      if (status && a.status !== status) return false;
      if (agent && a.agentName !== agent) return false;
      if (team && a.assignedTeam !== team) return false;
      if (repeating === 'yes' && !a.repeating) return false;
      if (repeating === 'no' && a.repeating) return false;
      if (date && a.detectedAt.slice(0, 10) !== date) return false;
      return true;
    });
  }, [alerts, search, site, type, severity, status, agent, team, repeating, date]);

  const priority = useMemo(() => {
    const open = (a: AiAlert) => !['resolved', 'closed', 'suppressed'].includes(a.status);
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return alerts
      .filter(open)
      .filter((a) => a.severity === 'critical' || a.severity === 'high' || a.repeating || a.type === 'policy_violation' || a.type === 'security')
      .sort((a, b) => (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5));
  }, [alerts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Alerts &amp; Incidents</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central operational queue for AI, platform, security and site incidents across the Digital Footprint group.
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
        </div>
      </div>

      {mode !== 'error' && !loading && (
        <p className="text-[11px] font-label text-foreground-600 -mt-3">
          Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {alerts.length} alerts
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
          <p className="text-xs font-label text-foreground-600 pt-2">Loading live alerts…</p>
        </div>
      )}

      {/* Error state — never auto-switch to demo */}
      {!loading && mode === 'error' && (
        <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center">
          <i className="ri-alert-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <h2 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live Alerts &amp; Incidents unavailable</h2>
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
      {!loading && mode !== 'error' && <AlertsKpis alerts={alerts} />}

      {/* Priority incidents */}
      {!loading && mode !== 'error' && <PriorityIncidents alerts={priority} />}

      {/* Search + filters */}
      {!loading && mode !== 'error' && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by alert ID, title, description, service or tags…"
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
              <option value="">Type: All</option>
              {ALERT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
              ))}
            </select>

            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectCls}>
              <option value="">Severity: All</option>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Status: All</option>
              {ALERT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{ALERT_STATUS[s].label}</option>
              ))}
            </select>

            <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
              <option value="">Agent: All</option>
              {agents.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select value={team} onChange={(e) => setTeam(e.target.value)} className={selectCls}>
              <option value="">Team: All</option>
              {teams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select value={repeating} onChange={(e) => setRepeating(e.target.value)} className={selectCls}>
              <option value="">Repeating: All</option>
              <option value="yes">Repeating</option>
              <option value="no">Not repeating</option>
            </select>

            <select value={date} onChange={(e) => setDate(e.target.value)} className={selectCls}>
              <option value="">Date: All</option>
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
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

      {/* Incident queue */}
      {!loading && mode !== 'error' && <IncidentQueue alerts={filtered} />}

      {/* Alert sources (demo monitoring source health — no live monitoring) */}
      {!loading && mode !== 'error' && <AlertSources />}
    </div>
  );
}