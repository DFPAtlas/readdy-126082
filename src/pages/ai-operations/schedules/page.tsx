import { useMemo, useState } from 'react';
import type { AiSchedule } from '@/pages/ai-operations/types';
import {
  AUTOMATION_TYPE_OPTIONS,
  AUTOMATION_TYPE_LABELS,
  SCHEDULE_STATUS_OPTIONS,
  SCHEDULE_STATUS,
  RISK_LEVEL,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import { useSchedules } from '@/pages/ai-operations/schedules/SchedulesContext';
import { allQuietHours } from '@/pages/ai-operations/schedules/selectors';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import ScheduleKpis from '@/pages/ai-operations/schedules/components/ScheduleKpis';
import ScheduleRegistry from '@/pages/ai-operations/schedules/components/ScheduleRegistry';
import ScheduleCalendar from '@/pages/ai-operations/schedules/components/ScheduleCalendar';
import ScheduleTimeline from '@/pages/ai-operations/schedules/components/ScheduleTimeline';
import EventAutomation from '@/pages/ai-operations/schedules/components/EventAutomation';
import MaintenanceWindows from '@/pages/ai-operations/schedules/components/MaintenanceWindows';
import QuietHours from '@/pages/ai-operations/schedules/components/QuietHours';
import ScheduleFormModal from '@/pages/ai-operations/schedules/components/ScheduleFormModal';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

type ViewMode = 'list' | 'calendar' | 'timeline';

export default function SchedulesPage() {
  const { schedules, eventRules, maintenanceWindows, mode, loading, error, refresh, loadDemo, createSchedule } = useSchedules();
  const [view, setView] = useState<ViewMode>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [agent, setAgent] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const [environment, setEnvironment] = useState('');
  const [frequency, setFrequency] = useState('');

  const agents = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => set.add(s.agentId));
    return demoAgents.filter((a) => set.has(a.id));
  }, [schedules]);

  const frequencies = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => set.add(s.frequency));
    return Array.from(set).sort();
  }, [schedules]);

  const hasActiveFilters = Boolean(search || site || agent || type || status || risk || environment || frequency);

  const clearFilters = () => {
    setSearch('');
    setSite('');
    setAgent('');
    setType('');
    setStatus('');
    setRisk('');
    setEnvironment('');
    setFrequency('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter((s) => {
      const haystack = `${s.id} ${s.name} ${s.description} ${s.agentName} ${s.ownerTeam} ${s.notes}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (site === 'group' && s.siteId !== 'group') return false;
      if (site && site !== 'group' && s.siteId !== site) return false;
      if (agent && s.agentId !== agent) return false;
      if (type && s.automationType !== type) return false;
      if (status && s.status !== status) return false;
      if (risk && s.risk !== risk) return false;
      if (environment && s.environment !== environment) return false;
      if (frequency && s.frequency !== frequency) return false;
      return true;
    });
  }, [schedules, search, site, agent, type, status, risk, environment, frequency]);

  const viewTabs: { key: ViewMode; label: string; icon: string }[] = [
    { key: 'list', label: 'List', icon: 'ri-list-check-3' },
    { key: 'calendar', label: 'Calendar', icon: 'ri-calendar-2-line' },
    { key: 'timeline', label: 'Timeline', icon: 'ri-timeline-view' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Scheduling &amp; Automation</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Central schedule and automation control for recurring AI Operations tasks across the Digital Footprint group.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
          Add Schedule
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
          <i className="ri-loader-4-line text-2xl text-accent-400 w-8 h-8 flex items-center justify-center mx-auto animate-spin"></i>
          <p className="text-sm text-foreground-500 mt-3">Loading schedules…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto">
          <i className="ri-error-warning-line text-3xl text-red-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Scheduling unavailable</h2>
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
            {filtered.length} of {schedules.length} schedules · Scheduling runtime is not connected.
          </p>

          <ScheduleKpis schedules={schedules} eventRuleCount={eventRules.length} />

          {/* View switch */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-background-100 border border-background-200/60 rounded-full px-1 py-1">
              {viewTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={`inline-flex items-center gap-1.5 text-xs font-label px-3 py-1.5 rounded-full transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    view === t.key ? 'bg-accent-500 text-background-950' : 'text-foreground-300 hover:text-foreground-100'
                  }`}
                >
                  <i className={`${t.icon} w-4 h-4 flex items-center justify-center`}></i>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + filters */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by schedule ID, name, description, agent, owner or notes…"
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

              <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selectCls}>
                <option value="">Agent: All</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                <option value="">Type: All</option>
                {AUTOMATION_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{AUTOMATION_TYPE_LABELS[t]}</option>
                ))}
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="">Status: All</option>
                {SCHEDULE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{SCHEDULE_STATUS[s].label}</option>
                ))}
              </select>

              <select value={risk} onChange={(e) => setRisk(e.target.value)} className={selectCls}>
                <option value="">Risk: All</option>
                {(Object.keys(RISK_LEVEL) as Array<keyof typeof RISK_LEVEL>).map((r) => (
                  <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
                ))}
              </select>

              <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectCls}>
                <option value="">Environment: All</option>
                {(Object.keys(ENVIRONMENT_LABELS) as Array<keyof typeof ENVIRONMENT_LABELS>).map((env) => (
                  <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
                ))}
              </select>

              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={selectCls}>
                <option value="">Frequency: All</option>
                {frequencies.map((f) => (
                  <option key={f} value={f}>{f}</option>
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

          {/* View */}
          {view === 'list' && <ScheduleRegistry schedules={filtered} />}
          {view === 'calendar' && <ScheduleCalendar schedules={filtered} />}
          {view === 'timeline' && <ScheduleTimeline schedules={filtered} />}

          {/* Event automation */}
          <EventAutomation rules={eventRules} />

          {/* Orchestrator future route note */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
              <i className="ri-route-line w-4 h-4 flex items-center justify-center"></i>
            </div>
            <div>
              <p className="text-sm font-label font-semibold text-foreground-100">Future route: Schedule → Orchestrator → Agent</p>
              <p className="text-xs text-foreground-400 mt-1">
                Scheduled work is prepared to create orchestration requests via the Group Master Orchestrator. No live routing occurs — the scheduling runtime is not connected.
              </p>
            </div>
          </div>

          {/* Maintenance + quiet hours */}
          <div className="grid grid-cols-1 gap-5">
            <MaintenanceWindows windows={maintenanceWindows} />
            <QuietHours policies={allQuietHours} />
          </div>
        </>
      )}

      <ScheduleFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={createSchedule} />
    </div>
  );
}