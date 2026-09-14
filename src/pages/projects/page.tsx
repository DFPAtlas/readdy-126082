import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import ProjectWizardModal from './components/ProjectWizardModal';
import { usePortfolio } from './usePortfolio';
import type { PortfolioProject } from './portfolioTypes';
import {
  computePortfolioSummary,
  computeLiveSummary,
  computeCommercialSummary,
  computeLaunchPipeline,
} from './portfolioDerive';
import PortfolioSummaryCards from './components/PortfolioSummaryCards';
import NeedsAttentionPanel from './components/NeedsAttentionPanel';
import PortfolioFiltersBar, {
  type FilterKey,
  type SortKey,
  type ViewMode,
} from './components/PortfolioFiltersBar';
import PortfolioProjectCard from './components/PortfolioProjectCard';
import PortfolioSidePanels from './components/PortfolioSidePanels';
import { formatRelative, formatDate } from './detail/utils';
import { statusColors, priorityColors } from './detail/types';
import { HEALTH_STATE_LABELS } from './portfolioTypes';

const PRIORITY_WEIGHT: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const LIFECYCLE_ORDER: Record<string, number> = {
  idea: 0,
  planning: 1,
  building: 2,
  testing: 3,
  live: 4,
  on_hold: 5,
  archived: 6,
};
const HEALTH_ORDER: Record<string, number> = {
  CRITICAL: 0,
  OFFLINE: 0,
  DEGRADED: 1,
  UNKNOWN: 2,
  NOT_CONFIGURED: 3,
  PRE_LAUNCH: 4,
  HEALTHY: 5,
};
const BUDGET_ORDER: Record<string, number> = {
  OVER_BUDGET: 0,
  AT_RISK: 1,
  WATCH: 2,
  UNKNOWN: 3,
  NO_BUDGET: 4,
  ON_TRACK: 5,
};

function matchesFilter(pp: PortfolioProject, filter: FilterKey): boolean {
  const p = pp.project;
  switch (filter) {
    case 'all': return true;
    case 'idea': return p.status === 'idea';
    case 'planning': return p.status === 'planning';
    case 'building': return p.status === 'building';
    case 'testing': return p.status === 'testing';
    case 'live': return p.status === 'live' || p.launched_at != null;
    case 'on_hold': return p.status === 'on_hold';
    case 'critical': return pp.health.state === 'CRITICAL' || pp.health.state === 'OFFLINE';
    case 'attention': return pp.attention.length > 0;
    case 'launch_ready': return pp.launch.state === 'AWAITING_DEPLOYMENT' || pp.deployment.state === 'VERIFIED';
    case 'over_budget': return pp.budget.state === 'OVER_BUDGET' || pp.budget.state === 'AT_RISK';
    case 'ai': return p.is_ai_powered;
    case 'saas': return p.is_saas;
    case 'client': return p.is_client_build;
    case 'internal': return p.is_internal_tool;
    default: return true;
  }
}

function matchesSearch(pp: PortfolioProject, q: string): boolean {
  if (!q) return true;
  const p = pp.project;
  const hay = [
    p.project_name,
    p.project_slug,
    p.description,
    p.domain_live,
    p.owner,
    pp.integration?.github_repository,
    pp.integration?.readdy_project_id,
    String(p.id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function minAttentionRank(pp: PortfolioProject): number {
  return pp.attention.length > 0 ? pp.attention[0].rank : 99;
}

function sortProjects(list: PortfolioProject[], sort: SortKey): PortfolioProject[] {
  const arr = [...list];
  switch (sort) {
    case 'name':
      return arr.sort((a, b) => a.project.project_name.localeCompare(b.project.project_name));
    case 'priority':
      return arr.sort(
        (a, b) =>
          (PRIORITY_WEIGHT[a.project.priority] ?? 4) - (PRIORITY_WEIGHT[b.project.priority] ?? 4) ||
          a.project.project_name.localeCompare(b.project.project_name),
      );
    case 'lifecycle':
      return arr.sort(
        (a, b) =>
          (LIFECYCLE_ORDER[a.project.status] ?? 9) - (LIFECYCLE_ORDER[b.project.status] ?? 9) ||
          a.project.project_name.localeCompare(b.project.project_name),
      );
    case 'target_launch':
      return arr.sort((a, b) => {
        const ta = a.project.target_launch_date ?? '9999';
        const tb = b.project.target_launch_date ?? '9999';
        return ta.localeCompare(tb) || a.project.project_name.localeCompare(b.project.project_name);
      });
    case 'health':
      return arr.sort(
        (a, b) =>
          (HEALTH_ORDER[a.health.state] ?? 9) - (HEALTH_ORDER[b.health.state] ?? 9) ||
          a.project.project_name.localeCompare(b.project.project_name),
      );
    case 'budget_risk':
      return arr.sort(
        (a, b) =>
          (BUDGET_ORDER[a.budget.state] ?? 9) - (BUDGET_ORDER[b.budget.state] ?? 9) ||
          a.project.project_name.localeCompare(b.project.project_name),
      );
    case 'last_activity':
      return arr.sort(
        (a, b) =>
          (b.lastActivity?.timestamp ?? b.project.updated_at).localeCompare(
            a.lastActivity?.timestamp ?? a.project.updated_at,
          ),
      );
    case 'default':
    default:
      return arr.sort(
        (a, b) =>
          minAttentionRank(a) - minAttentionRank(b) ||
          (PRIORITY_WEIGHT[a.project.priority] ?? 4) - (PRIORITY_WEIGHT[b.project.priority] ?? 4) ||
          a.project.project_name.localeCompare(b.project.project_name),
      );
  }
}

export default function Projects() {
  const { projects, loading, configured, refresh } = usePortfolio();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [displayMode, setDisplayMode] = useState<ViewMode>('cards');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState<SortKey>('default');
  const [restoring, setRestoring] = useState<number | null>(null);
  const [restoreAllLoading, setRestoreAllLoading] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.project.status !== 'archived'),
    [projects],
  );
  const archivedProjects = useMemo(
    () => projects.filter((p) => p.project.status === 'archived'),
    [projects],
  );

  const owners = useMemo(() => {
    const s = new Set<string>();
    for (const p of activeProjects) if (p.project.owner) s.add(p.project.owner);
    return Array.from(s).sort();
  }, [activeProjects]);

  const summary = useMemo(() => computePortfolioSummary(projects), [projects]);
  const liveSummary = useMemo(() => computeLiveSummary(activeProjects), [activeProjects]);
  const commercial = useMemo(() => computeCommercialSummary(activeProjects), [activeProjects]);
  const pipeline = useMemo(() => computeLaunchPipeline(activeProjects), [activeProjects]);

  const needsAttention = useMemo(
    () => activeProjects.filter((p) => p.attention.length > 0).sort((a, b) => minAttentionRank(a) - minAttentionRank(b)),
    [activeProjects],
  );

  const displayedProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = activeProjects.filter(
      (p) =>
        matchesFilter(p, filter) &&
        matchesSearch(p, q) &&
        (owner === 'all' || p.project.owner === owner) &&
        (priority === 'all' || p.project.priority === priority),
    );
    return sortProjects(filtered, sort);
  }, [activeProjects, filter, search, owner, priority, sort]);

  const handleUnarchive = async (projectId: number) => {
    setRestoring(projectId);
    try {
      const { error } = await supabase
        .from('internal_projects')
        .update({ status: 'planning' })
        .eq('id', projectId);
      if (error) throw error;
      await supabase.from('internal_activity_log').insert({
        entity_type: 'project',
        entity_id: projectId,
        action: 'unarchived',
        description: 'Project restored from archive',
      });
      refresh();
    } catch {
      // silently handle
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreAll = async () => {
    setRestoreAllLoading(true);
    try {
      const ids = archivedProjects.map((p) => p.project.id);
      const { error } = await supabase
        .from('internal_projects')
        .update({ status: 'planning' })
        .in('id', ids);
      if (error) throw error;
      for (const id of ids) {
        await supabase.from('internal_activity_log').insert({
          entity_type: 'project',
          entity_id: id,
          action: 'unarchived',
          description: 'Bulk restore from archive',
        });
      }
      refresh();
    } catch {
      // silently handle
    } finally {
      setRestoreAllLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-background-100 rounded w-72 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-5 animate-pulse h-48"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">
            Digital Footprint Project Portfolio
          </h1>
          <p className="text-sm text-foreground-500 mt-1">
            {viewMode === 'active'
              ? `${activeProjects.length} active · ${needsAttention.length} need attention`
              : `${archivedProjects.length} archived`}
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          + New Project
        </button>
      </div>

      {/* Backend unavailable banner */}
      {!configured && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <i className="ri-plug-line text-amber-400 w-5 h-5 flex items-center justify-center"></i>
          <p className="text-sm text-amber-300">
            Backend is not connected — portfolio data will appear here once you link a backend.
          </p>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-background-100 border border-background-200/60 rounded-full p-1 inline-flex gap-0.5">
          <button
            onClick={() => setViewMode('active')}
            className={`px-4 py-2 rounded-full text-sm font-label transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'active' ? 'bg-accent-500/10 text-accent-400 font-semibold' : 'text-foreground-500 hover:text-foreground-300'
            }`}
          >
            Active
            <span className="ml-1.5 text-[11px] opacity-60">{activeProjects.length}</span>
          </button>
          <button
            onClick={() => setViewMode('archived')}
            className={`px-4 py-2 rounded-full text-sm font-label transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'archived' ? 'bg-accent-500/10 text-accent-400 font-semibold' : 'text-foreground-500 hover:text-foreground-300'
            }`}
          >
            Archived
            <span className="ml-1.5 text-[11px] opacity-60">{archivedProjects.length}</span>
          </button>
        </div>
      </div>

      {/* ── Active portfolio view ── */}
      {viewMode === 'active' && (
        <>
          <PortfolioSummaryCards summary={summary} />

          <NeedsAttentionPanel items={needsAttention} />

          <PortfolioFiltersBar
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
            owners={owners}
            owner={owner}
            onOwner={setOwner}
            priority={priority}
            onPriority={setPriority}
            sort={sort}
            onSort={setSort}
            viewMode={displayMode}
            onViewMode={setDisplayMode}
            resultCount={displayedProjects.length}
          />

          {displayedProjects.length === 0 ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-foreground-500/10 flex items-center justify-center">
                <i className="ri-stack-line text-2xl text-foreground-400 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <h3 className="text-lg font-heading font-semibold text-foreground-200 mb-1">No matching projects</h3>
              <p className="text-sm text-foreground-500 mb-4">
                {activeProjects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your filters or search.'}
              </p>
              {activeProjects.length === 0 && (
                <button
                  onClick={() => setWizardOpen(true)}
                  className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  + New Project
                </button>
              )}
            </div>
          ) : displayMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProjects.map((pp) => (
                <PortfolioProjectCard key={pp.project.id} pp={pp} />
              ))}
            </div>
          ) : (
            <ProjectTable projects={displayedProjects} />
          )}

          <PortfolioSidePanels live={liveSummary} commercial={commercial} pipeline={pipeline} />
        </>
      )}

      {/* ── Archived view ── */}
      {viewMode === 'archived' && (
        <>
          {archivedProjects.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestoreAll}
                disabled={restoreAllLoading}
                className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
              >
                <i className={`${restoreAllLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
                {restoreAllLoading ? 'Restoring...' : `Restore All (${archivedProjects.length})`}
              </button>
            </div>
          )}

          {archivedProjects.length === 0 ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-foreground-500/10 flex items-center justify-center">
                <i className="ri-archive-line text-2xl text-foreground-400 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <h3 className="text-lg font-heading font-semibold text-foreground-200 mb-1">No archived projects</h3>
              <p className="text-sm text-foreground-500">Archived projects will appear here for restoration.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {archivedProjects.map((pp) => (
                <div key={pp.project.id} className="bg-background-100 border border-background-200/60 rounded-lg p-5 relative">
                  <Link
                    to={`/projects/${pp.project.project_slug}`}
                    className="absolute inset-0 z-0 cursor-pointer"
                    aria-label={pp.project.project_name}
                  />
                  <div className="relative z-10 pointer-events-none">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${statusColors[pp.project.status] ?? ''}`}>
                        {pp.project.status.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-label capitalize ${priorityColors[pp.project.priority] ?? ''} whitespace-nowrap`}>
                        {pp.project.priority}
                      </span>
                    </div>
                    <h3 className="text-base font-heading font-semibold text-foreground-100">{pp.project.project_name}</h3>
                    {pp.project.description && (
                      <p className="text-xs text-foreground-500 line-clamp-2 mt-1">{pp.project.description}</p>
                    )}
                  </div>
                  <div className="relative z-20 mt-3 pt-3 border-t border-background-200/60">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleUnarchive(pp.project.id); }}
                      disabled={restoring === pp.project.id}
                      className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
                    >
                      <i className={`${restoring === pp.project.id ? 'ri-loader-4-line animate-spin' : 'ri-arrow-go-back-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
                      {restoring === pp.project.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ProjectWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={refresh}
      />
    </div>
  );
}

// ─── Compact table view ─────────────────────────────────────────────────────

function ProjectTable({ projects }: { projects: PortfolioProject[] }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-background-200/60 text-left">
            <th className="px-4 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Project</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Lifecycle</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Build</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">UAT</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Launch</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Ops</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Budget</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Critical</th>
            <th className="px-3 py-3 text-[10px] font-label text-foreground-500 uppercase tracking-wide">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((pp) => {
            const p = pp.project;
            return (
              <tr key={p.id} className="border-b border-background-200/60 last:border-0 hover:bg-background-50/60">
                <td className="px-4 py-3">
                  <Link to={`/projects/${p.project_slug}`} className="font-heading font-semibold text-foreground-100 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer">
                    {p.project_name}
                  </Link>
                  {pp.attention.length > 0 && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-red-400 align-middle" title={pp.attention[0].reason}></span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${statusColors[p.status] ?? ''}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <CellTone label={pp.build.detail} />
                </td>
                <td className="px-3 py-3">
                  <CellTone label={pp.uat.detail} />
                </td>
                <td className="px-3 py-3">
                  <CellTone label={pp.launch.detail} />
                </td>
                <td className="px-3 py-3">
                  <span className="text-foreground-400 whitespace-nowrap">{HEALTH_STATE_LABELS[pp.health.state]}</span>
                </td>
                <td className="px-3 py-3">
                  <CellTone label={pp.budget.detail} />
                </td>
                <td className="px-3 py-3">
                  <span className={`whitespace-nowrap ${pp.criticalIssues > 0 ? 'text-red-400 font-semibold' : 'text-foreground-600'}`}>
                    {pp.criticalIssues > 0 ? pp.criticalIssues : '—'}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {pp.lastActivity ? (
                    <span className="text-foreground-500 whitespace-nowrap">
                      {formatRelative(pp.lastActivity.timestamp) ?? formatDate(pp.lastActivity.timestamp)}
                    </span>
                  ) : (
                    <span className="text-foreground-600">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CellTone({ label }: { label: string }) {
  return <span className="text-foreground-500 whitespace-nowrap">{label}</span>;
}