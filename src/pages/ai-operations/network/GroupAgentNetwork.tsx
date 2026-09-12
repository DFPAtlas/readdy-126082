// ============================================================================
// DFP AI Operations — Group Agent Network (main control-centre feature).
//
// The interactive agent network: a radial diagram (large screens) with an
// expandable site/agent list (small screens), site/host/status filters, agent
// search, a Diagram/List toggle, expand/collapse, and a read-only selection
// details panel. All data is derived from the shared group live-data store +
// saved widget config + runtime health — no new registry, no polling.
// ============================================================================

import { useMemo, useState, useEffect } from 'react';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useWidgetConfigData } from '@/pages/ai-operations/wallboard/widgetConfigStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import NetworkDiagram, { type SelectTarget } from '@/pages/ai-operations/network/NetworkDiagram';
import NetworkListView from '@/pages/ai-operations/network/NetworkListView';
import AgentDetailPanel from '@/pages/ai-operations/network/AgentDetailPanel';
import AgentDetailDrawer from '@/pages/ai-operations/network/AgentDetailDrawer';
import ActivityTabs from '@/pages/ai-operations/network/ActivityTabs';
import { useSiteManagerReportsData } from '@/pages/ai-operations/network/siteManagerReportsStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { useRuntimeControls } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import {
  getGroupNetworkModel,
  NETWORK_AGENT_STATE_META,
  type GroupNetworkModel,
  type NetworkAgent,
  type NetworkSite,
} from '@/pages/ai-operations/network/networkSelectors';

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary' }) {
  const color: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    accent: 'text-accent-500',
    secondary: 'text-foreground-400',
  };
  return (
    <div className="gn-stat">
      <span className={`gn-stat-value ${color[tone]}`}>{value}</span>
      <span className="gn-stat-label">{label}</span>
    </div>
  );
}

export default function GroupAgentNetwork() {
  const live = useGroupLiveData();
  const config = useWidgetConfigData();
  const runtime = useRuntimeHealth();
  // Subscribe so the drawer + tabs re-render when these sources refresh.
  useSiteManagerReportsData();
  useN8nData();
  useRuntimeControls();

  const model = useMemo(() => getGroupNetworkModel(), [live, config, runtime]);

  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('diagram');
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [hostFilter, setHostFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedShared, setExpandedShared] = useState(false);
  const [selected, setSelected] = useState<SelectTarget | null>(null);

  // Distinct hosting providers for the host filter (never fabricated).
  const hosts = useMemo(() => {
    const set = new Set<string>();
    for (const s of model.sites) if (s.hostingProvider) set.add(s.hostingProvider);
    return Array.from(set).sort();
  }, [model]);

  const filteredModel: GroupNetworkModel = useMemo(() => {
    const q = search.trim().toLowerCase();
    const agentVisible = (a: NetworkAgent) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.name} ${a.categoryLabel} ${a.currentTask ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };

    const shared = model.center.sharedAgents.filter(agentVisible);

    let sites: NetworkSite[] = model.sites.filter((s) => {
      if (siteFilter && s.siteKey !== siteFilter) return false;
      if (hostFilter && s.hostingProvider !== hostFilter) return false;
      return true;
    });

    // Narrow agents when a status/search filter is active.
    if (statusFilter || q) {
      sites = sites
        .map((s) => ({ ...s, managers: s.managers.filter(agentVisible), workers: s.workers.filter(agentVisible) }))
        .filter((s) => {
          if (q && s.name.toLowerCase().includes(q)) return true;
          return s.managers.length > 0 || s.workers.length > 0;
        });
    }

    return { ...model, sites, center: { ...model.center, sharedAgents: shared } };
  }, [model, search, siteFilter, hostFilter, statusFilter]);

  // Clear selection when the selected node is filtered out.
  useEffect(() => {
    if (!selected) return;
    if (selected.kind === 'center') return;
    if (selected.kind === 'site' && !filteredModel.sites.some((s) => s.siteKey === selected.siteKey)) {
      setSelected(null);
    }
    if (selected.kind === 'agent') {
      const exists =
        filteredModel.center.sharedAgents.some((a) => a.id === selected.agentId) ||
        filteredModel.sites.some((s) =>
          [...s.managers, ...s.workers].some((a) => a.id === selected.agentId),
        );
      if (!exists) setSelected(null);
    }
  }, [filteredModel, selected]);

  const toggleSite = (siteKey: string) => {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteKey)) next.delete(siteKey);
      else next.add(siteKey);
      return next;
    });
    setSelected({ kind: 'site', siteKey });
  };

  const expandAll = () => {
    setExpandedSites(new Set(model.sites.map((s) => s.siteKey)));
    setExpandedShared(true);
  };
  const collapseAll = () => {
    setExpandedSites(new Set());
    setExpandedShared(false);
  };

  const hasFilters = Boolean(search || siteFilter || hostFilter || statusFilter);
  const clearFilters = () => {
    setSearch('');
    setSiteFilter('');
    setHostFilter('');
    setStatusFilter('');
  };

  const sourceLabel = model.sourceState === 'unavailable' ? 'Source unavailable' : 'Partial live';

  return (
    <section className="gn-root">
      {/* Header row */}
      <div className="gn-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="gn-title">Group Agent Network</h2>
            <span className="gn-source-pill">{sourceLabel}</span>
          </div>
          <p className="gn-subtitle">Every Digital Footprint site, its manager and sub-agents — one live control surface.</p>
        </div>

        <div className="gn-toolbar-actions">
          <button type="button" onClick={expandAll} className="gn-btn-ghost">
            <i className="ri-fullscreen-line"></i> Expand all
          </button>
          <button type="button" onClick={collapseAll} className="gn-btn-ghost">
            <i className="ri-contract-up-down-line"></i> Collapse all
          </button>
          <div className="gn-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode('diagram')}
              className={viewMode === 'diagram' ? 'gn-view-active' : ''}
              title="Diagram view"
            >
              <i className="ri-node-tree"></i>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'gn-view-active' : ''}
              title="List view"
            >
              <i className="ri-list-check-3"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Estate-wide stats (never affected by hiding a widget) */}
      <div className="gn-stats">
        <Stat label="Sites" value={model.siteCount} tone="accent" />
        <Stat label="Registered agents" value={model.registeredAgentCount} tone="secondary" />
        <Stat label="Running (evidence)" value={model.activelyRunningCount} tone="emerald" />
        <Stat label="Managers unassigned" value={model.unassignedCount} tone={model.unassignedCount > 0 ? 'amber' : 'secondary'} />
        <Stat label="Duplicate managers" value={model.duplicateCount} tone={model.duplicateCount > 0 ? 'red' : 'secondary'} />
      </div>

      {/* Filters + search */}
      <div className="gn-filters">
        <div className="gn-search">
          <i className="ri-search-line"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, sites, categories or tasks…"
            className="gn-search-input"
          />
        </div>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className={selectCls}>
          <option value="">Site: all</option>
          {model.sites.map((s) => (
            <option key={s.siteKey} value={s.siteKey}>{s.name}</option>
          ))}
        </select>
        <select value={hostFilter} onChange={(e) => setHostFilter(e.target.value)} className={selectCls}>
          <option value="">Host: all</option>
          {hosts.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">Status: all</option>
          {(Object.keys(NETWORK_AGENT_STATE_META) as (keyof typeof NETWORK_AGENT_STATE_META)[]).map((s) => (
            <option key={s} value={s}>{NETWORK_AGENT_STATE_META[s].label}</option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="gn-btn-ghost gn-btn-clear">
            <i className="ri-close-circle-line"></i> Clear
          </button>
        )}
        <span className="gn-filter-count">
          {filteredModel.sites.length} site{filteredModel.sites.length === 1 ? '' : 's'} · {filteredModel.center.sharedAgents.length} shared
        </span>
      </div>

      {/* Stale config warning */}
      {model.configStale && (
        <div className="gn-stale">
          <i className="ri-error-warning-line"></i>
          <span>Widget configuration is stale — showing last saved layout.</span>
        </div>
      )}

      {/* Main viewport */}
      <div className="gn-body">
        <div className={viewMode === 'diagram' ? 'hidden lg:block' : 'hidden'}>
          <NetworkDiagram
            model={filteredModel}
            expandedSites={expandedSites}
            expandedShared={expandedShared}
            selected={selected}
            onSelect={setSelected}
            onToggleSite={toggleSite}
            onToggleShared={() => setExpandedShared((v) => !v)}
          />
        </div>

        <div className={viewMode === 'list' ? 'block' : 'lg:hidden'}>
          <NetworkListView model={filteredModel} onSelect={setSelected} />
        </div>
      </div>

      {/* Selection details — agents open a right-side drawer; centre/site use the inline panel */}
      {selected && selected.kind !== 'agent' && (
        <AgentDetailPanel model={filteredModel} selected={selected} onClose={() => setSelected(null)} />
      )}
      {selected && selected.kind === 'agent' && (
        <AgentDetailDrawer agentId={selected.agentId} onClose={() => setSelected(null)} />
      )}

      {/* Operational activity tabs below the network */}
      <ActivityTabs />
    </section>
  );
}