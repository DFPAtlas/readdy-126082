import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import ProjectWizardModal from './components/ProjectWizardModal';

interface Project {
  id: number;
  project_name: string;
  project_slug: string;
  status: string;
  priority: string;
}

const statusColors: Record<string, string> = {
  idea: 'bg-secondary-500/10 text-secondary-300',
  planning: 'bg-sky-500/10 text-sky-400',
  building: 'bg-accent-500/10 text-accent-400',
  testing: 'bg-yellow-500/10 text-yellow-400',
  live: 'bg-emerald-500/10 text-emerald-400',
  on_hold: 'bg-foreground-500/10 text-foreground-400',
  archived: 'bg-foreground-500/10 text-foreground-600',
};

const priorityColors: Record<string, string> = {
  low: 'text-foreground-500',
  medium: 'text-foreground-300',
  high: 'text-primary-400',
  critical: 'text-red-400',
};

type ViewMode = 'active' | 'archived';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [restoring, setRestoring] = useState<number | null>(null);
  const [restoreAllLoading, setRestoreAllLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('internal_projects')
      .select('id,project_name,project_slug,status,priority')
      .order('updated_at', { ascending: false });
    setProjects(data ?? []);
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadProjects();
      setLoading(false);
    };
    init();
  }, [loadProjects]);

  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const archivedProjects = projects.filter((p) => p.status === 'archived');

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
      await loadProjects();
    } catch {
      // silently handle
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreAll = async () => {
    setRestoreAllLoading(true);
    try {
      const ids = archivedProjects.map((p) => p.id);
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
      await loadProjects();
    } catch {
      // silently handle
    } finally {
      setRestoreAllLoading(false);
    }
  };

  const displayedProjects = viewMode === 'active' ? activeProjects : archivedProjects;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-heading font-bold text-foreground-50">Projects</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-5 animate-pulse h-36"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Projects</h1>
          <p className="text-sm text-foreground-500 mt-1">
            {viewMode === 'active'
              ? `${activeProjects.length} active`
              : `${archivedProjects.length} archived`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWizardOpen(true)}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-background-100 border border-background-200/60 rounded-full p-1 inline-flex gap-0.5">
        <button
          onClick={() => setViewMode('active')}
          className={`px-4 py-2 rounded-full text-sm font-label transition-colors whitespace-nowrap cursor-pointer ${
            viewMode === 'active'
              ? 'bg-accent-500/10 text-accent-400 font-semibold'
              : 'text-foreground-500 hover:text-foreground-300'
          }`}
        >
          Active
          <span className="ml-1.5 text-[11px] opacity-60">{activeProjects.length}</span>
        </button>
        <button
          onClick={() => setViewMode('archived')}
          className={`px-4 py-2 rounded-full text-sm font-label transition-colors whitespace-nowrap cursor-pointer ${
            viewMode === 'archived'
              ? 'bg-accent-500/10 text-accent-400 font-semibold'
              : 'text-foreground-500 hover:text-foreground-300'
          }`}
        >
          Archived
          <span className="ml-1.5 text-[11px] opacity-60">{archivedProjects.length}</span>
        </button>
      </div>

      {/* Bulk Restore All — only in archived view when there are archived projects */}
      {viewMode === 'archived' && archivedProjects.length > 1 && (
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

      {/* Empty state for active view */}
      {viewMode === 'active' && activeProjects.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-foreground-500/10 flex items-center justify-center">
            <i className="ri-stack-line text-2xl text-foreground-400 w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h3 className="text-lg font-heading font-semibold text-foreground-200 mb-1">No active projects</h3>
          <p className="text-sm text-foreground-500 mb-4">Create your first project to get started.</p>
          <button
            onClick={() => setWizardOpen(true)}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            + New Project
          </button>
        </div>
      )}

      {/* Empty state for archived view */}
      {viewMode === 'archived' && archivedProjects.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-foreground-500/10 flex items-center justify-center">
            <i className="ri-archive-line text-2xl text-foreground-400 w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h3 className="text-lg font-heading font-semibold text-foreground-200 mb-1">No archived projects</h3>
          <p className="text-sm text-foreground-500">Archived projects will appear here for restoration.</p>
        </div>
      )}

      {/* Project Cards */}
      {displayedProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedProjects.map((p) => (
            <div
              key={p.id}
              className="bg-background-100 border border-background-200/60 rounded-lg p-5 group relative"
            >
              <Link
                to={`/projects/${p.project_slug}`}
                className="absolute inset-0 z-0 cursor-pointer"
                aria-label={p.project_name}
              />
              <div className="relative z-10 pointer-events-none">
                <div className="flex items-center justify-between mb-3">
                  <div className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${statusColors[p.status] ?? 'text-foreground-500'}`}>
                    {p.status.replace('_', ' ')}
                  </div>
                  <span className={`text-xs font-label ${priorityColors[p.priority] ?? ''} whitespace-nowrap`}>
                    {p.priority}
                  </span>
                </div>
                <h3 className="text-base font-heading font-semibold text-foreground-100 group-hover:text-accent-400 transition-colors">
                  {p.project_name}
                </h3>
              </div>

              {/* Unarchive button — only on archived cards, sits above the link */}
              {viewMode === 'archived' && (
                <div className="relative z-20 mt-3 pt-3 border-t border-background-200/60">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleUnarchive(p.id); }}
                    disabled={restoring === p.id}
                    className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
                  >
                    <i className={`${restoring === p.id ? 'ri-loader-4-line animate-spin' : 'ri-arrow-go-back-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
                    {restoring === p.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ProjectWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={loadProjects}
      />
    </div>
  );
}