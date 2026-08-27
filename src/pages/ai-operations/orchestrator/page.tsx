import { useMemo, useState } from 'react';
import type { AiOrchestration, RoutingSimulationResult } from '@/pages/ai-operations/types';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import {
  ORCHESTRATION_STATUS_OPTIONS,
  ORCHESTRATION_STATUS,
  ORCHESTRATION_STAGE_OPTIONS,
  ORCHESTRATION_STAGE,
  RUN_PRIORITY_OPTIONS,
  RUN_PRIORITY,
  RISK_LEVEL,
  TASK_TYPE_OPTIONS,
  TASK_TYPE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import { useOrchestrator } from '@/pages/ai-operations/orchestrator/OrchestratorContext';
import OrchestratorKpis from '@/pages/ai-operations/orchestrator/components/OrchestratorKpis';
import RoutingQueue from '@/pages/ai-operations/orchestrator/components/RoutingQueue';
import ActiveWorkflows from '@/pages/ai-operations/orchestrator/components/ActiveWorkflows';
import RoutingSimulatorModal, { type SimulatorForm } from '@/pages/ai-operations/orchestrator/components/RoutingSimulatorModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

const riskOptions = ['low', 'medium', 'high', 'critical'] as const;
const siteOptions = [{ id: 'group', name: 'Group-wide' }, ...demoSites.map((s) => ({ id: s.id, name: s.name }))];

export default function OrchestratorPage() {
  const { orchestrations, addSimulation } = useOrchestrator();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [status, setStatus] = useState('');
  const [stage, setStage] = useState('');
  const [agent, setAgent] = useState('');
  const [taskType, setTaskType] = useState('');
  const [priority, setPriority] = useState('');
  const [risk, setRisk] = useState('');
  const [environment, setEnvironment] = useState('');
  const [simOpen, setSimOpen] = useState(false);

  const hasActiveFilters = Boolean(search || site || status || stage || agent || taskType || priority || risk || environment);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setStatus('');
    setStage('');
    setAgent('');
    setTaskType('');
    setPriority('');
    setRisk('');
    setEnvironment('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orchestrations.filter((o) => {
      const haystack = `${o.id} ${o.title} ${o.description} ${o.detectedIntent} ${o.siteName} ${o.primaryAgentName} ${o.correlationId}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && o.siteId !== 'group') return false;
      if (site && site !== 'group' && o.siteId !== site) return false;
      if (status && o.status !== status) return false;
      if (stage && o.currentStage !== stage) return false;
      if (agent && o.primaryAgentId !== agent && !o.supportingAgentIds.includes(agent)) return false;
      if (taskType && o.taskType !== taskType) return false;
      if (priority && o.priority !== priority) return false;
      if (risk && o.risk !== risk) return false;
      if (environment && o.environment !== environment) return false;
      return true;
    });
  }, [orchestrations, search, site, status, stage, agent, taskType, priority, risk, environment]);

  const activeWorkflows = useMemo(
    () => filtered.filter((o) => ['executing', 'verifying', 'uat', 'routed', 'awaiting_approval', 'blocked'].includes(o.status)),
    [filtered],
  );

  const handleSaveSimulation = (result: RoutingSimulationResult, form: SimulatorForm) => {
    addSimulation(result, {
      title: form.title,
      description: form.description,
      source: form.source,
      environment: form.environment,
      priority: form.priority,
      risk: form.risk,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">DFP Group Master Orchestrator</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              Demo data
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central routing, planning and governance layer coordinating AI work across every Digital Footprint group platform.
          </p>
        </div>

        <button
          onClick={() => setSimOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          <i className="ri-flask-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Simulate Routing
        </button>
      </div>

      {/* KPI cards */}
      <OrchestratorKpis orchestrations={orchestrations} />

      {/* Search + filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, title, description, intent, site, agent or correlation ID…"
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

          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="">Status: All</option>
            {ORCHESTRATION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{ORCHESTRATION_STATUS[s].label}</option>
            ))}
          </select>

          <select value={stage} onChange={(e) => setStage(e.target.value)} className={selectCls}>
            <option value="">Stage: All</option>
            {ORCHESTRATION_STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{ORCHESTRATION_STAGE[s]}</option>
            ))}
          </select>

          <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
            <option value="">Agent: All</option>
            {demoAgents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={selectCls}>
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

      <p className="text-[11px] font-label text-foreground-600">
        Showing {filtered.length} of {orchestrations.length} orchestrations
      </p>

      {/* Routing queue */}
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Routing Queue</h3>
        <RoutingQueue orchestrations={filtered} />
      </section>

      {/* Active workflows */}
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Active Workflows</h3>
        <ActiveWorkflows orchestrations={activeWorkflows} />
      </section>

      <RoutingSimulatorModal open={simOpen} onClose={() => setSimOpen(false)} onSave={handleSaveSimulation} />
    </div>
  );
}