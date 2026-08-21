import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import PromptFormModal from './components/PromptFormModal';

interface Prompt {
  id: number;
  prompt_name: string;
  project_id: number;
  category: string;
  prompt_text: string | null;
  ai_model: string | null;
  result_summary: string | null;
  status: string;
  worked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  project_name: string;
}

const typeLabels: Record<string, string> = {
  readdy: 'Readdy',
  supabase: 'Supabase',
  stripe: 'Stripe',
  n8n: 'n8n',
  image_ai: 'Image AI',
  logo: 'Logo',
  email: 'Email',
  audit: 'Audit',
  bug_fix: 'Bug Fix',
  other: 'Other',
};

const typeIcons: Record<string, string> = {
  readdy: 'ri-robot-2-line',
  supabase: 'ri-database-2-line',
  stripe: 'ri-bank-card-line',
  n8n: 'ri-flow-chart',
  image_ai: 'ri-image-2-line',
  logo: 'ri-palette-line',
  email: 'ri-mail-line',
  audit: 'ri-search-eye-line',
  bug_fix: 'ri-bug-line',
  other: 'ri-terminal-box-line',
};

const statusColors: Record<string, string> = {
  draft: 'bg-foreground-500/10 text-foreground-400',
  used: 'bg-sky-500/10 text-sky-400',
  worked: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  archived: 'bg-foreground-500/10 text-foreground-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  used: 'Used',
  worked: 'Worked',
  failed: 'Failed',
  archived: 'Archived',
};

const types = ['all', 'readdy', 'supabase', 'stripe', 'n8n', 'image_ai', 'logo', 'email', 'audit', 'bug_fix', 'other'];
const statuses = ['all', 'draft', 'used', 'worked', 'failed', 'archived'];

export default function Prompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const loadPrompts = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setPrompts(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, [loadPrompts]);

  const getProjectName = (projectId: number) => {
    return projects.find((p) => p.id === projectId)?.project_name ?? '';
  };

  const hasActiveFilters = search || filterType !== 'all' || filterStatus !== 'all' || filterProject !== 'all';

  const filtered = prompts.filter((p) => {
    if (search && !p.prompt_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'all' && p.category !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterProject !== 'all' && String(p.project_id) !== filterProject) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Prompts</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Prompts</h1>
          <p className="text-sm text-foreground-500 mt-1">{filtered.length} of {prompts.length} prompts</p>
        </div>
        <button
          onClick={() => { setEditingPrompt(null); setModalOpen(true); }}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold px-4 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
        >
          <i className="ri-add-line text-sm w-3.5 h-3.5 flex items-center justify-center"></i>
          Add Prompt
        </button>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts or tags..." className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Types</option>
            {types.filter(t => t !== 'all').map((t) => <option key={t} value={t}>{typeLabels[t] ?? t}</option>)}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
            <option value="all">All Statuses</option>
            {statuses.filter(s => s !== 'all').map((s) => <option key={s} value={s}>{statusLabels[s] ?? s}</option>)}
          </select>

          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
          </select>

          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); setFilterProject('all'); }} className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer">
              Clear filters
            </button>
          )}

          <div className="flex items-center ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 flex items-center justify-center rounded-l-lg border border-background-300/60 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-accent-500/10 text-accent-400 border-accent-500/30' : 'bg-background-50 text-foreground-500 hover:text-foreground-300'}`}
            >
              <i className="ri-layout-grid-line text-sm w-4 h-4 flex items-center justify-center"></i>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 flex items-center justify-center rounded-r-lg border border-background-300/60 border-l-0 transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-accent-500/10 text-accent-400 border-accent-500/30' : 'bg-background-50 text-foreground-500 hover:text-foreground-300'}`}
            >
              <i className="ri-list-check text-sm w-4 h-4 flex items-center justify-center"></i>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadPrompts} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-terminal-box-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {prompts.length === 0 ? 'No prompts saved yet' : 'No prompts match your filters'}
          </h3>
          <p className="text-sm text-foreground-500">
            {prompts.length === 0 ? 'Save your best Readdy prompts here for reuse across projects.' : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((prompt) => (
                <div
                  key={prompt.id}
                  onClick={() => { setEditingPrompt(prompt); setModalOpen(true); }}
                  className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-accent-500/20 transition-colors duration-150 flex flex-col cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-accent-500/10 flex items-center justify-center shrink-0">
                        <i className={`${typeIcons[prompt.category] ?? 'ri-terminal-box-line'} text-accent-400 text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
                      </div>
                      <h3 className="text-sm font-heading font-semibold text-foreground-100 line-clamp-1">{prompt.prompt_name}</h3>
                    </div>
                    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize shrink-0 whitespace-nowrap ${statusColors[prompt.status] ?? ''}`}>
                      {statusLabels[prompt.status] ?? prompt.status}
                    </span>
                  </div>

                  {prompt.prompt_text && (
                    <p className="text-xs text-foreground-500 line-clamp-3 mb-3 leading-relaxed flex-1">{prompt.prompt_text}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mt-auto pt-3 border-t border-background-200/60">
                    <span className="text-[10px] font-label text-foreground-400 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {typeLabels[prompt.category] ?? prompt.category}
                    </span>
                    {prompt.ai_model && (
                      <span className="text-[10px] text-foreground-500 font-mono whitespace-nowrap">{prompt.ai_model}</span>
                    )}
                    <span className="text-[10px] text-foreground-500 whitespace-nowrap">{getProjectName(prompt.project_id)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-background-200/60">
                      <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Prompt</th>
                      <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Type</th>
                      <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Version</th>
                      <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Project</th>
                      <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((prompt) => (
                      <tr
                        key={prompt.id}
                        onClick={() => { setEditingPrompt(prompt); setModalOpen(true); }}
                        className="border-b border-background-200/40 hover:bg-background-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-foreground-100 line-clamp-1">{prompt.prompt_name}</span>
                            {prompt.prompt_text && (
                              <p className="text-xs text-foreground-600 mt-0.5 line-clamp-1">{prompt.prompt_text}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-label text-foreground-400 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                            {typeLabels[prompt.category] ?? prompt.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-foreground-500 font-mono whitespace-nowrap">{prompt.ai_model || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${statusColors[prompt.status] ?? ''}`}>
                            {statusLabels[prompt.status] ?? prompt.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-foreground-400 whitespace-nowrap">{getProjectName(prompt.project_id)}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-foreground-500 whitespace-nowrap">{formatDate(prompt.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <PromptFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPrompt(null); }}
        onSaved={loadPrompts}
        prompt={editingPrompt}
      />
    </div>
  );
}