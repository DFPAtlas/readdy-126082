import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface FileLink {
  id: number;
  name: string;
  project_id: number | null;
  type: string;
  url: string;
  description: string | null;
  category: string | null;
  created_at: string;
}

interface Project {
  id: number;
  project_name: string;
  slug: string;
}

const typeIcons: Record<string, string> = {
  link: 'ri-link',
  dashboard: 'ri-dashboard-3-line',
  repo: 'ri-github-line',
  file: 'ri-file-3-line',
  document: 'ri-file-text-line',
  image: 'ri-image-2-line',
  zip: 'ri-file-zip-line',
  database: 'ri-database-2-line',
  payment: 'ri-bank-card-line',
  automation: 'ri-flow-chart',
  other: 'ri-links-line',
};

const typeLabels: Record<string, string> = {
  link: 'Link',
  dashboard: 'Dashboard',
  repo: 'Repository',
  file: 'File',
  document: 'Document',
  image: 'Image',
  zip: 'Archive',
  database: 'Database',
  payment: 'Payment',
  automation: 'Automation',
  other: 'Other',
};

const typeColors: Record<string, string> = {
  link: 'bg-sky-500/10 text-sky-400',
  dashboard: 'bg-emerald-500/10 text-emerald-400',
  repo: 'bg-foreground-500/10 text-foreground-400',
  file: 'bg-secondary-500/10 text-secondary-300',
  document: 'bg-accent-500/10 text-accent-400',
  image: 'bg-yellow-500/10 text-yellow-400',
  zip: 'bg-primary-500/10 text-primary-400',
  database: 'bg-emerald-500/10 text-emerald-400',
  payment: 'bg-primary-500/10 text-primary-400',
  automation: 'bg-red-500/10 text-red-400',
  other: 'bg-foreground-500/10 text-foreground-400',
};

const types = ['all', 'link', 'dashboard', 'repo', 'file', 'document', 'image', 'zip', 'database', 'payment', 'automation', 'other'];

export default function FilesLinks() {
  const [items, setItems] = useState<FileLink[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadItems = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_files_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setItems(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load files and links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    supabase.from('internal_projects').select('id,project_name,slug').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, [loadItems]);

  const getProject = (projectId: number | null) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) ?? null;
  };

  // Simple URL validation — checks protocol
  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const hasActiveFilters = search || filterType !== 'all' || filterProject !== 'all';

  const filtered = items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !(item.category && item.category.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterProject !== 'all' && String(item.project_id ?? 'none') !== filterProject) return false;
    return true;
  });

  // Group by type
  const grouped = filtered.reduce<Record<string, FileLink[]>>((acc, item) => {
    const key = item.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Sort groups alphabetically
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Files & Links</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Files & Links</h1>
          <p className="text-sm text-foreground-500 mt-1">{filtered.length} of {items.length} items</p>
        </div>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files, links, or tags..." className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Types</option>
            {types.filter(t => t !== 'all').map((t) => <option key={t} value={t}>{typeLabels[t] ?? t}</option>)}
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
          <button onClick={loadItems} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-links-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {items.length === 0 ? 'No files or links yet' : 'No items match your filters'}
          </h3>
          <p className="text-sm text-foreground-500">
            {items.length === 0 ? 'Add important links, files, and dashboards here for quick access.' : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-4">
          {sortedGroups.map(([type, groupItems]) => {
            const isExpanded = !expandedGroups.has(type);
            return (
              <div key={type} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-background-50/50 transition-colors cursor-pointer"
                >
                  <i
                    className={`ri-arrow-down-s-line text-sm text-foreground-400 transition-transform duration-200 w-4 h-4 flex items-center justify-center ${isExpanded ? '' : '-rotate-90'}`}
                  ></i>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${typeColors[type] ?? ''}`}>
                    <i className={`${typeIcons[type] ?? 'ri-links-line'} text-xs w-3.5 h-3.5 flex items-center justify-center`}></i>
                  </div>
                  <span className="text-sm font-heading font-semibold text-foreground-200">{typeLabels[type] ?? type}</span>
                  <span className="text-xs text-foreground-500">({groupItems.length})</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-background-200/60">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-background-200/60">
                            <th className="px-4 py-2.5 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Name</th>
                            <th className="px-4 py-2.5 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">URL</th>
                            <th className="px-4 py-2.5 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Project</th>
                            <th className="px-4 py-2.5 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Tags</th>
                            <th className="px-4 py-2.5 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupItems.map((item) => {
                            const project = getProject(item.project_id);
                            const urlValid = isValidUrl(item.url);
                            return (
                              <tr key={item.id} className="border-b border-background-200/40 hover:bg-background-50/50 transition-colors group">
                                <td className="px-4 py-2.5">
                                  <div>
                                    <a
                                      href={urlValid ? item.url : undefined}
                                      target={urlValid ? '_blank' : undefined}
                                      rel={urlValid ? 'noopener noreferrer' : undefined}
                                      className={`text-sm font-medium transition-colors line-clamp-1 ${urlValid ? 'text-foreground-100 hover:text-accent-400 cursor-pointer' : 'text-foreground-400 line-through cursor-not-allowed'}`}
                                      title={!urlValid ? 'Invalid URL' : undefined}
                                      onClick={!urlValid ? (e) => e.preventDefault() : undefined}
                                    >
                                      {item.name}
                                    </a>
                                    {item.description && (
                                      <p className="text-xs text-foreground-600 mt-0.5 line-clamp-1">{item.description}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1.5 max-w-[200px]">
                                    {urlValid ? (
                                      <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                        <span className="text-xs text-foreground-500 font-mono truncate">{new URL(item.url).hostname}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></span>
                                        <span className="text-xs text-red-400 truncate">Invalid URL</span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 hidden md:table-cell">
                                  {project ? (
                                    <Link to={`/projects/${project.slug}`} className="text-xs text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap">
                                      {project.project_name}
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-foreground-500 whitespace-nowrap">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 hidden md:table-cell">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {item.category ? item.category.split(',').map((tag) => (
                                      <span key={tag} className="text-[10px] text-foreground-600 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{tag.trim()}</span>
                                    )) : <span className="text-xs text-foreground-600">—</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 hidden lg:table-cell">
                                  <span className="text-xs text-foreground-500 whitespace-nowrap">{formatDate(item.created_at)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}