import { useMemo, useState } from 'react';
import type { AiTaskRun } from '@/pages/ai-operations/types';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import {
  RUN_STATUS_OPTIONS,
  RUN_STATUS,
  RUN_PRIORITY_OPTIONS,
  RUN_PRIORITY,
  TASK_TYPE_OPTIONS,
  TASK_TYPE_LABELS,
  TRIGGER_SOURCE_OPTIONS,
  TRIGGER_SOURCE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import { useRuns } from '@/pages/ai-operations/runs/RunsContext';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import SummaryKpis from '@/pages/ai-operations/runs/components/SummaryKpis';
import ActiveRuns from '@/pages/ai-operations/runs/components/ActiveRuns';
import ExecutionQueue from '@/pages/ai-operations/runs/components/ExecutionQueue';
import RunsTable from '@/pages/ai-operations/runs/components/RunsTable';
import RunFormModal from '@/pages/ai-operations/runs/components/RunFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const riskOptions = ['low', 'medium', 'high', 'critical'] as const;

export default function RunsPage() {
  const { runs, mode, loading, error, refresh, loadDemo, createTask, sites, agents } = useRuns();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [agent, setAgent] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [risk, setRisk] = useState('');
  const [environment, setEnvironment] = useState('');
  const [trigger, setTrigger] = useState('');
  const [started, setStarted] = useState('');
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

  // Site/agent filter options: live registries when live, demo otherwise.
  const siteOptions = mode === 'live' ? sites : demoSites.map((s) => ({ key: s.id, name: s.name }));
  const agentOptions =
    mode === 'live'
      ? agents.map((a) => ({ id: a.key, name: a.name }))
      : demoAgents.map((a) => ({ id: a.id, name: a.name }));

  const hasActiveFilters = Boolean(search || site || agent || status || type || priority || risk || environment || trigger || started);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setAgent('');
    setStatus('');
    setType('');
    setPriority('');
    setRisk('');
    setEnvironment('');
    setTrigger('');
    setStarted('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return runs.filter((r) => {
      const haystack = `${r.id} ${r.taskName} ${r.taskDescription} ${r.agentName} ${r.siteName} ${r.correlationId} ${r.tags.join(' ')}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && r.siteId !== 'group') return false;
      if (site && site !== 'group' && r.siteId !== site) return false;
      if (agent && r.agentId !== agent) return false;
      if (status && r.status !== status) return false;
      if (type && r.taskType !== type) return false;
      if (priority && r.priority !== priority) return false;
      if (risk && r.risk !== risk) return false;
      if (environment && r.environment !== environment) return false;
      if (trigger && r.triggerSource !== trigger) return false;
      if (started === 'today' && r.startedTime === '—') return false;
      if (started === 'notstarted' && r.startedTime !== '—') return false;
      return true;
    });
  }, [runs, search, site, agent, status, type, priority, risk, environment, trigger, started]);

  // Loading skeleton — never show an empty registry while a request is pending.
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 bg-background-100 rounded-md animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-3.5 h-24 animate-pulse"></div>
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

  // Error state — never auto-switch to demo without acknowledgement.
  if (mode === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Tasks &amp; Runs</h1>
          <DataSourceBadge mode="error" />
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-xl mx-auto">
          <i className="ri-error-warning-line text-4xl text-amber-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Live Tasks &amp; Runs unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error}</p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={handleRefresh}
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
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Tasks &amp; Runs</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Group-wide execution queue and operational history for AI agents, workflows and multi-agent tasks.
          </p>
          {mode === 'demo' && (
            <p className="text-[11px] font-label text-amber-400 mt-1">Demo data is shown — no records are written to Supabase.</p>
          )}
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
            Create Task
          </button>
        </div>
      </div>

      <p className="text-[11px] font-label text-foreground-600 -mt-3">
        Last updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} · {filtered.length} of {runs.length} runs
      </p>

      {/* KPI cards */}
      <SummaryKpis runs={runs} />

      {/* Active runs */}
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Active Runs</h3>
        <ActiveRuns runs={runs} />
      </section>

      {/* Execution queue */}
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Queue</h3>
        <ExecutionQueue runs={runs} />
      </section>

      {/* Search + filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by run ID, task, agent, site, correlation ID or tag…"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <select value={site} onChange={(e) => setSite(e.target.value)} className={selectCls}>
            <option value="">Site: All</option>
            <option value="group">Group-wide (Core)</option>
            {siteOptions.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>

          <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
            <option value="">Agent: All</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="">Status: All</option>
            {RUN_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{RUN_STATUS[s].label}</option>
            ))}
          </select>

          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="">Type: All</option>
            {TASK_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
            <option value="">Priority: All</option>
            {RUN_PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{RUN_PRIORITY[p].label}</option>
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

          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={selectCls}>
            <option value="">Trigger: All</option>
            {TRIGGER_SOURCE_OPTIONS.map((t) => (
              <option key={t} value={t}>{TRIGGER_SOURCE_LABELS[t]}</option>
            ))}
          </select>

          <select value={started} onChange={(e) => setStarted(e.target.value)} className={selectCls}>
            <option value="">Started: Any</option>
            <option value="today">Started today</option>
            <option value="notstarted">Not started</option>
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

      {/* Runs table */}
      <RunsTable runs={filtered} />

      {/* Create task modal */}
      <RunFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sites={mode === 'live' ? sites : demoSites.map((s) => ({ key: s.id, name: s.name }))}
        agents={mode === 'live' ? agents : demoAgents.map((a) => ({ key: a.id, name: a.name, assignedSite: a.assignedSite }))}
        liveMode={mode === 'live'}
        onSave={createTask}
      />
    </div>
  );
}