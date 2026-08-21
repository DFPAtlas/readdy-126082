import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import BugFormModal from './components/BugFormModal';

interface Bug {
  id: number;
  title: string;
  project_id: number;
  severity: string;
  status: string;
  type: string | null;
  description: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  steps_to_reproduce: string | null;
  environment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  project_name: string;
}

const severityColors: Record<string, string> = {
  low: 'bg-foreground-500/10 text-foreground-400',
  medium: 'bg-secondary-500/10 text-secondary-300',
  high: 'bg-primary-500/10 text-primary-400',
  critical: 'bg-red-500/10 text-red-400',
};

const statusColors: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-yellow-500/10 text-yellow-400',
  in_progress: 'bg-sky-500/10 text-sky-400',
  fixed: 'bg-emerald-500/10 text-emerald-400',
  wont_fix: 'bg-foreground-500/10 text-foreground-500',
  duplicate: 'bg-foreground-500/10 text-foreground-500',
};

const severities = ['all', 'low', 'medium', 'high', 'critical'];
const statuses = ['all', 'open', 'investigating', 'in_progress', 'fixed', 'wont_fix', 'duplicate'];

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);

  const loadBugs = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_bugs')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setBugs(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bugs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBugs();
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, [loadBugs]);

  const handleStatusChange = async (bug: Bug, newStatus: string) => {
    await supabase.from('internal_bugs').update({ status: newStatus }).eq('id', bug.id);
    await supabase.from('internal_activity_log').insert({
      user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
      action: 'updated',
      entity_type: 'bug',
      entity_id: bug.id,
      project_id: bug.project_id,
      description: `Changed bug "${bug.title}" status to ${newStatus.replace('_', ' ')}`,
    });
    loadBugs();
  };

  const handleOpenCreate = () => {
    setEditingBug(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (bug: Bug) => {
    setEditingBug(bug);
    setModalOpen(true);
  };

  const getProjectName = (projectId: number) => {
    return projects.find((p) => p.id === projectId)?.project_name ?? '';
  };

  const hasActiveFilters = search || filterSeverity !== 'all' || filterStatus !== 'all' || filterProject !== 'all';

  const filteredBugs = bugs.filter((b) => {
    if (search && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSeverity !== 'all' && b.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterProject !== 'all' && String(b.project_id) !== filterProject) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Bugs</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Bugs</h1>
          <p className="text-sm text-foreground-500 mt-1">{filteredBugs.length} of {bugs.length} bugs</p>
        </div>
        <button onClick={handleOpenCreate} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
          + Report Bug
        </button>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bugs..."
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
          >
            <option value="all">All Severities</option>
            {severities.filter(s => s !== 'all').map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
          >
            <option value="all">All Statuses</option>
            {statuses.filter(s => s !== 'all').map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.project_name}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setFilterSeverity('all'); setFilterStatus('all'); setFilterProject('all'); }}
              className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadBugs} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {!error && filteredBugs.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-bug-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {bugs.length === 0 ? 'No bugs reported yet' : 'No bugs match your filters'}
          </h3>
          <p className="text-sm text-foreground-500 mb-4">
            {bugs.length === 0 ? 'Everything is running smoothly — for now.' : 'Try adjusting your filters to see more.'}
          </p>
          {bugs.length === 0 && (
            <button onClick={handleOpenCreate} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
              Report Your First Bug
            </button>
          )}
        </div>
      )}

      {filteredBugs.length > 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-background-200/60">
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Bug</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Project</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Severity</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Affected</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Reported</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.map((bug) => (
                  <tr key={bug.id} className="border-b border-background-200/40 hover:bg-background-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <button onClick={() => handleOpenEdit(bug)} className="text-left cursor-pointer w-full">
                        <span className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors line-clamp-1">{bug.title}</span>
                        {bug.description && (
                          <p className="text-xs text-foreground-600 font-mono mt-0.5 line-clamp-1">{bug.description || ''}</p>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground-400 whitespace-nowrap">{getProjectName(bug.project_id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${severityColors[bug.severity] ?? ''}`}>
                        {bug.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={bug.status}
                        onChange={(e) => handleStatusChange(bug, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-[10px] font-label px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer capitalize whitespace-nowrap ${statusColors[bug.status] ?? ''}`}
                      >
                        {statuses.filter(s => s !== 'all').map((s) => (
                          <option key={s} value={s} className="bg-background-100 text-foreground-100">{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-foreground-500 font-mono whitespace-nowrap">
                        {bug.environment || bug.steps_to_reproduce || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-foreground-500 whitespace-nowrap">{formatDate(bug.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenEdit(bug)}
                        className="w-7 h-7 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BugFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadBugs}
        bug={editingBug}
      />
    </div>
  );
}