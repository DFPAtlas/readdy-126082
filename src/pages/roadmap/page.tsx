import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import RoadmapFormModal from './components/RoadmapFormModal';

interface RoadmapItem {
  id: number;
  title: string;
  project_id: number;
  phase: string;
  status: string;
  priority: string;
  target_date: string | null;
  description: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  project_name: string;
  slug: string;
}

const phaseLabels: Record<string, string> = {
  phase_1: 'Phase 1',
  phase_2: 'Phase 2',
  phase_3: 'Phase 3',
  future: 'Future',
};

const phaseOrder = ['phase_1', 'phase_2', 'phase_3', 'future'];

const statusColors: Record<string, string> = {
  planned: 'bg-foreground-500/10 text-foreground-400',
  in_progress: 'bg-sky-500/10 text-sky-400',
  blocked: 'bg-red-500/10 text-red-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
};

const priorityColors: Record<string, string> = {
  low: 'border-l-secondary-500/40',
  medium: 'border-l-foreground-400/40',
  high: 'border-l-primary-500/40',
  critical: 'border-l-red-500/40',
};

const priorityDots: Record<string, string> = {
  low: 'bg-secondary-500',
  medium: 'bg-foreground-400',
  high: 'bg-primary-500',
  critical: 'bg-red-500',
};

const projectColors: string[] = [
  'bg-accent-500/10 text-accent-400',
  'bg-sky-500/10 text-sky-400',
  'bg-emerald-500/10 text-emerald-400',
  'bg-yellow-500/10 text-yellow-400',
  'bg-primary-500/10 text-primary-400',
];

const projects = ['all', 'project'];

export default function Roadmap() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterProject, setFilterProject] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_roadmap')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setItems(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    supabase.from('internal_projects').select('id,project_name,slug').order('project_name').then(({ data }) => setProjectsList(data ?? []));
  }, [loadItems]);

  const handleStatusChange = async (item: RoadmapItem, newStatus: string) => {
    await supabase.from('internal_roadmap').update({ status: newStatus }).eq('id', item.id);
    await supabase.from('internal_activity_log').insert({
      user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
      action_type: 'update',
      entity_type: 'roadmap',
      entity_id: item.id,
      project_id: item.project_id,
      description: `Moved "${item.title}" to ${newStatus.replace('_', ' ')}`,
    });
    loadItems();
  };

  const handlePhaseChange = async (item: RoadmapItem, newPhase: string) => {
    await supabase.from('internal_roadmap').update({ phase: newPhase }).eq('id', item.id);
    loadItems();
  };

  const getProject = (projectId: number) => {
    return projectsList.find((p) => p.id === projectId);
  };

  const getProjectColor = (projectId: number) => {
    return projectColors[projectId % projectColors.length];
  };

  const getDateStatus = (dateStr: string | null): 'overdue' | 'soon' | 'normal' | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'soon';
    return 'normal';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const hasActiveFilters = filterProject !== 'all' || filterPriority !== 'all' || filterStatus !== 'all';

  const filtered = items.filter((item) => {
    if (filterProject !== 'all' && String(item.project_id) !== filterProject) return false;
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  // Group by phase
  const columns = phaseOrder.map((phase) => ({
    phase,
    label: phaseLabels[phase],
    items: filtered.filter((i) => i.phase === phase),
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Roadmap</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-96"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Roadmap</h1>
          <p className="text-sm text-foreground-500 mt-1">{filtered.length} of {items.length} items</p>
        </div>
        <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
          + Add Item
        </button>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Projects</option>
            {projectsList.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
            <option value="all">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>

          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {hasActiveFilters && (
            <button onClick={() => { setFilterProject('all'); setFilterPriority('all'); setFilterStatus('all'); }} className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadItems} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-road-map-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {items.length === 0 ? 'Roadmap is empty' : 'No items match your filters'}
          </h3>
          <p className="text-sm text-foreground-500 mb-4">
            {items.length === 0 ? 'Plan your product journey. Add features, milestones, and initiatives.' : 'Try adjusting your filters.'}
          </p>
          {items.length === 0 && (
            <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
              Plan First Item
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => (
            <div key={col.phase} className="bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                  <h3 className="text-sm font-heading font-semibold text-foreground-200">{col.label}</h3>
                </div>
                <span className="text-xs text-foreground-500 bg-background-200/60 rounded-full px-2 py-0.5">{col.items.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {col.items.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-foreground-600">
                    No items
                  </div>
                )}

                {col.items.map((item) => {
                  const project = getProject(item.project_id);
                  const dateStatus = getDateStatus(item.target_date);
                  const dateLabel = formatDate(item.target_date);

                  return (
                    <div
                      key={item.id}
                      className={`bg-background-50 border border-background-300/50 rounded-lg border-l-2 ${priorityColors[item.priority] ?? 'border-l-foreground-300'} hover:border-accent-500/30 transition-colors duration-150 cursor-pointer group`}
                      onClick={() => { setEditingItem(item); setModalOpen(true); }}
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-medium text-foreground-100 leading-snug line-clamp-2">{item.title}</h4>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingItem(item); setModalOpen(true); }}
                            className="shrink-0 text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <i className="ri-edit-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
                          </button>
                        </div>

                        {item.description && (
                          <p className="text-xs text-foreground-600 line-clamp-2 mb-2 leading-relaxed">{item.description}</p>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {project && (
                            <Link
                              to={`/projects/${project.slug}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap transition-colors hover:opacity-80 ${getProjectColor(item.project_id)}`}
                            >
                              {project.project_name}
                            </Link>
                          )}
                          <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap capitalize ${statusColors[item.status] ?? ''}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityDots[item.priority] ?? ''}`}></span>
                            <span className="text-[10px] text-foreground-500 capitalize">{item.priority}</span>
                          </div>

                          {dateLabel && (
                            <span className={`text-[10px] whitespace-nowrap ${dateStatus === 'overdue' ? 'text-red-400' : dateStatus === 'soon' ? 'text-yellow-400' : 'text-foreground-500'}`}>
                              {dateStatus === 'overdue' && <i className="ri-error-warning-line mr-0.5 w-3 h-3 inline-flex items-center justify-center"></i>}
                              {dateLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <RoadmapFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={loadItems} item={editingItem} />
    </div>
  );
}