import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import NoteFormModal from './components/NoteFormModal';

interface Note {
  id: number;
  title: string;
  project_id: number | null;
  category: string;
  content: string | null;
  tags: string[] | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  project_name: string;
  slug: string;
}

const typeLabels: Record<string, string> = {
  general: 'General',
  meeting: 'Meeting',
  decision: 'Decision',
  legal: 'Legal',
  pricing: 'Pricing',
  client_feedback: 'Client Feedback',
  supplier: 'Supplier',
  research: 'Research',
  other: 'Other',
};

const typeIcons: Record<string, string> = {
  general: 'ri-sticky-note-line',
  meeting: 'ri-group-line',
  decision: 'ri-scales-3-line',
  legal: 'ri-file-text-line',
  pricing: 'ri-money-dollar-circle-line',
  client_feedback: 'ri-chat-smile-2-line',
  supplier: 'ri-truck-line',
  research: 'ri-search-eye-line',
  other: 'ri-more-line',
};

const typeColors: Record<string, string> = {
  general: 'bg-foreground-500/10 text-foreground-400',
  meeting: 'bg-sky-500/10 text-sky-400',
  decision: 'bg-accent-500/10 text-accent-400',
  legal: 'bg-yellow-500/10 text-yellow-400',
  pricing: 'bg-emerald-500/10 text-emerald-400',
  client_feedback: 'bg-primary-500/10 text-primary-400',
  supplier: 'bg-secondary-500/10 text-secondary-300',
  research: 'bg-red-500/10 text-red-400',
  other: 'bg-foreground-500/10 text-foreground-400',
};

const noteTypes = ['all', 'general', 'meeting', 'decision', 'legal', 'pricing', 'client_feedback', 'supplier', 'research', 'other'];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterProject, setFilterProject] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setNotes(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    supabase.from('internal_projects').select('id,project_name,slug').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, [loadNotes]);

  const handlePinToggle = async (note: Note) => {
    await supabase.from('internal_notes').update({ pinned: !note.pinned }).eq('id', note.id);
    loadNotes();
  };

  const getProject = (projectId: number | null) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) ?? null;
  };

  const hasActiveFilters = search || filterType !== 'all' || filterProject !== 'all';

  const filtered = notes.filter((n) => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !((n.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))) && !(n.content && n.content.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterType !== 'all' && n.category !== filterType) return false;
    if (filterProject !== 'all' && String(n.project_id ?? 'none') !== filterProject) return false;
    return true;
  });

  // Pinned first, then by created_at desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Notes</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Notes</h1>
          <p className="text-sm text-foreground-500 mt-1">{filtered.length} of {notes.length} notes</p>
        </div>
        <button onClick={() => { setEditingNote(null); setModalOpen(true); }} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
          + New Note
        </button>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, tags, or content..." className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Types</option>
            {noteTypes.filter(t => t !== 'all').map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
          </select>

          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
            <option value="none">No Project</option>
          </select>

          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setFilterType('all'); setFilterProject('all'); }} className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadNotes} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {!error && sorted.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-sticky-note-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {notes.length === 0 ? 'No notes yet' : 'No notes match your filters'}
          </h3>
          <p className="text-sm text-foreground-500 mb-4">
            {notes.length === 0 ? 'Jot down meeting notes, decisions, research, and more.' : 'Try adjusting your filters.'}
          </p>
          {notes.length === 0 && (
            <button onClick={() => { setEditingNote(null); setModalOpen(true); }} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
              Write First Note
            </button>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
          {sorted.map((note) => {
            const project = getProject(note.project_id);
            return (
              <div key={note.id} className="break-inside-avoid mb-4">
                <div className="bg-background-100 border border-background-200/60 rounded-lg hover:border-accent-500/20 transition-colors duration-150">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${typeColors[note.category] ?? ''}`}>
                          <i className={`${typeIcons[note.category] ?? 'ri-sticky-note-line'} text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
                        </div>
                        <h3 className="text-sm font-heading font-semibold text-foreground-100 leading-snug">{note.title}</h3>
                      </div>
                      <button
                        onClick={() => handlePinToggle(note)}
                        className={`shrink-0 transition-colors cursor-pointer ${note.pinned ? 'text-accent-400' : 'text-foreground-500 hover:text-foreground-300 opacity-0 group-hover:opacity-100'}`}
                      >
                        <i className={`${note.pinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
                      </button>
                    </div>

                    {note.content && (
                      <p className="text-xs text-foreground-600 leading-relaxed line-clamp-4 mb-3 whitespace-pre-line">{note.content}</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-label text-foreground-400 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                        {typeLabels[note.category] ?? note.category}
                      </span>
                      {project && (
                        <Link to={`/projects/${project.slug}`} className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap">
                          {project.project_name}
                        </Link>
                      )}
                      {!project && note.project_id && (
                        <span className="text-[10px] text-foreground-500 whitespace-nowrap">Unknown project</span>
                      )}
                    </div>

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {note.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-foreground-600 whitespace-nowrap">#{tag.trim()}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-background-200/40">
                      <span className="text-[10px] text-foreground-500 whitespace-nowrap">{formatDate(note.created_at)}</span>
                      <button
                        onClick={() => { setEditingNote(note); setModalOpen(true); }}
                        className="text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <i className="ri-edit-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NoteFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={loadNotes} note={editingNote} />
    </div>
  );
}