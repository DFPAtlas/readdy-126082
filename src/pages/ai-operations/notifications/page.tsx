import { useMemo, useState } from 'react';
import type { NotificationRule } from '@/pages/ai-operations/types';
import {
  NOTIFICATION_PRIORITY_OPTIONS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RULE_STATUS_OPTIONS,
  NOTIFICATION_RULE_STATUS,
  NOTIFICATION_CHANNEL_OPTIONS,
  NOTIFICATION_CHANNEL_LABELS,
  SEVERITY,
} from '@/pages/ai-operations/constants';
import { useNotifications } from '@/pages/ai-operations/notifications/NotificationsContext';
import { demoSites } from '@/mocks/ai-operations-sites';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import NotificationKpis from '@/pages/ai-operations/notifications/components/NotificationKpis';
import RuleRegistry from '@/pages/ai-operations/notifications/components/RuleRegistry';
import NotificationActivity from '@/pages/ai-operations/notifications/components/NotificationActivity';
import TestRule from '@/pages/ai-operations/notifications/components/TestRule';
import RuleFormModal from '@/pages/ai-operations/notifications/components/RuleFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'info'] as const;

export default function NotificationsPage() {
  const { rules, events, mode, loading, error, refresh, loadDemo } = useNotifications();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [site, setSite] = useState('');
  const [severity, setSeverity] = useState('');
  const [priority, setPriority] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [environment, setEnvironment] = useState('');

  const sources = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => set.add(r.eventSource));
    return Array.from(set).sort();
  }, [rules]);

  const environments = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => set.add(r.environment));
    return Array.from(set).sort();
  }, [rules]);

  const hasActiveFilters = Boolean(search || source || site || severity || priority || channel || status || environment);

  const clearFilters = () => {
    setSearch('');
    setSource('');
    setSite('');
    setSeverity('');
    setPriority('');
    setChannel('');
    setStatus('');
    setEnvironment('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      const haystack = `${r.id} ${r.name} ${r.description} ${r.eventType} ${r.initialTeam} ${r.escalationTeam} ${r.notes}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (source && r.eventSource !== source) return false;
      if (site === 'group' && r.siteId !== 'group') return false;
      if (site && site !== 'group' && r.siteId !== site) return false;
      if (severity && r.severityThreshold !== severity) return false;
      if (priority && r.priority !== priority) return false;
      if (channel && !r.channels.includes(channel as NotificationRule['channels'][number])) return false;
      if (status && r.status !== status) return false;
      if (environment && r.environment !== environment) return false;
      return true;
    });
  }, [rules, search, source, site, severity, priority, channel, status, environment]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Notifications &amp; Escalations</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central routing rules for operational notifications, response ownership and escalation across the Digital Footprint group.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
          New Rule
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
          <i className="ri-loader-4-line text-2xl text-accent-400 w-8 h-8 flex items-center justify-center mx-auto animate-spin"></i>
          <p className="text-sm text-foreground-500 mt-3">Loading notification rules…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto">
          <i className="ri-error-warning-line text-3xl text-red-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Notifications unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error}</p>
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            <button
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-4 py-2 hover:text-foreground-100 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Use Demo Data
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          <p className="text-[11px] font-label text-foreground-600 -mt-3">
            {filtered.length} of {rules.length} rules
          </p>

          <NotificationKpis rules={rules} events={events} />

          <TestRule />

          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by rule ID, name, description, team or notes…"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
                <option value="">Source: All</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
                <option value="">Site: All</option>
                <option value="group">Group-wide</option>
                {demoSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectCls}>
                <option value="">Severity: All</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{SEVERITY[s].label}</option>
                ))}
              </select>

              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
                <option value="">Priority: All</option>
                {NOTIFICATION_PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{NOTIFICATION_PRIORITY[p].label}</option>
                ))}
              </select>

              <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls}>
                <option value="">Channel: All</option>
                {NOTIFICATION_CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>{NOTIFICATION_CHANNEL_LABELS[c]}</option>
                ))}
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="">Status: All</option>
                {NOTIFICATION_RULE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{NOTIFICATION_RULE_STATUS[s].label}</option>
                ))}
              </select>

              <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
                <option value="">Environment: All</option>
                {environments.map((env) => (
                  <option key={env} value={env}>{env}</option>
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

          <RuleRegistry rules={filtered} />

          <NotificationActivity events={events} />
        </>
      )}

      <RuleFormModal open={showForm} onClose={() => setShowForm(false)} rule={null} />
    </div>
  );
}