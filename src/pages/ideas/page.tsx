import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import KanbanColumn from './components/KanbanColumn';
import IdeaFormModal from './components/IdeaFormModal';
import type { Idea } from './components/types';

interface Project { id: number; project_name: string; }

const allStatuses = ['new', 'reviewing', 'approved', 'building', 'done', 'rejected'];
const priorityOptions = ['all', 'low', 'medium', 'high', 'critical'];

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterProject, setFilterProject] = useState<number | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  const [categories, setCategories] = useState<string[]>([]);

  const loadIdeas = useCallback(async () => {
    try {
      let query = supabase.from('internal_ideas').select('*').order('created_at', { ascending: false });

      if (filterProject !== 'all') query = query.eq('related_project_id', filterProject);
      if (filterPriority !== 'all') query = query.eq('priority', filterPriority);
      if (filterCategory) query = query.eq('category', filterCategory);
      if (searchQuery) query = query.ilike('idea_name', `%${searchQuery}%`);

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      // Fetch project names separately
      const projectIds = [...new Set((data ?? []).map((i: any) => i.related_project_id).filter(Boolean))] as number[];
      const projectMap: Record<number, string> = {};
      if (projectIds.length > 0) {
        const { data: projData } = await supabase.from('internal_projects').select('id,project_name').in('id', projectIds);
        projData?.forEach((p) => { projectMap[p.id] = p.project_name; });
      }

      const mapped: Idea[] = (data ?? []).map((item: any) => ({
        id: item.id,
        idea_name: item.idea_name,
        related_project_id: item.related_project_id,
        category: item.category,
        priority: item.priority,
        status: item.status,
        description: item.description,
        owner: item.owner,
        ai_generated: item.ai_generated,
        notes: item.notes,
        project_name: projectMap[item.related_project_id] ?? '',
      }));

      setIdeas(mapped);

      const uniqueCategories = [...new Set(mapped.map(i => i.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
    } catch {
      setError('Failed to load ideas.');
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterPriority, filterCategory, searchQuery]);

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  const openCreate = () => { setEditingIdea(null); setModalOpen(true); };
  const openEdit = (idea: Idea) => { setEditingIdea(idea); setModalOpen(true); };

  const getIdeasByStatus = (status: string) => ideas.filter(i => i.status === status);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Ideas</h1>
            <p className="text-sm text-foreground-500 mt-1">Loading...</p>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {allStatuses.map(s => (
            <div key={s} className="flex-shrink-0 w-[280px] h-[400px] rounded-xl border border-background-200/60 animate-pulse bg-background-100"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-foreground-400 mb-4">{error}</p>
        <button onClick={loadIdeas} className="bg-accent-500 text-background-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Ideas</h1>
          <p className="text-sm text-foreground-500 mt-1">{ideas.length} idea{ideas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5">
          <i className="ri-add-line text-base w-4 h-4 flex items-center justify-center"></i>
          New Idea
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-500 w-4 h-4 flex items-center justify-center"></i>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ideas..."
            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="bg-background-100 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-200 outline-none cursor-pointer hover:border-background-300 transition-colors">
          <option value="all">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>

        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="bg-background-100 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-200 outline-none cursor-pointer hover:border-background-300 transition-colors capitalize">
          {priorityOptions.map(p => <option key={p} value={p}>{p === 'all' ? 'All priorities' : p}</option>)}
        </select>

        {categories.length > 0 && (
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-background-100 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-200 outline-none cursor-pointer hover:border-background-300 transition-colors">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {(filterProject !== 'all' || filterPriority !== 'all' || filterCategory || searchQuery) && (
          <button
            onClick={() => { setFilterProject('all'); setFilterPriority('all'); setFilterCategory(''); setSearchQuery(''); }}
            className="text-xs text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {allStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            ideas={getIdeasByStatus(status)}
            onEdit={openEdit}
            onStatusChange={loadIdeas}
          />
        ))}
      </div>

      <IdeaFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadIdeas}
        idea={editingIdea}
      />
    </div>
  );
}