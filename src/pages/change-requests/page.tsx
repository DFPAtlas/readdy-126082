import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import ChangeRequestFormModal from './components/ChangeRequestFormModal';

interface ChangeRequest {
  id: number;
  title: string;
  project_id: number;
  description: string | null;
  priority: string;
  status: string;
  type: string | null;
  requested_by: string | null;
  approved_by: string | null;
  estimated_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  project_name: string;
}

const priorityColors: Record<string, string> = {
  low: 'text-foreground-500',
  medium: 'text-foreground-300',
  high: 'text-primary-400',
  critical: 'text-red-400',
};

const statusColors: Record<string, string> = {
  requested: 'bg-secondary-500/10 text-secondary-300',
  approved: 'bg-sky-500/10 text-sky-400',
  in_progress: 'bg-accent-500/10 text-accent-400',
  testing: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-foreground-500/10 text-foreground-500',
};

const priorities = ['all', 'low', 'medium', 'high', 'critical'];
const statuses = ['all', 'requested', 'approved', 'in_progress', 'testing', 'completed', 'rejected'];

export default function ChangeRequests() {
  const [crs, setCrs] = useState<ChangeRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCr, setEditingCr] = useState<ChangeRequest | null>(null);

  const loadCrs = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_change_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setCrs(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load change requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrs();
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, [loadCrs]);

  const handleStatusChange = async (cr: ChangeRequest, newStatus: string) => {
    await supabase.from('internal_change_requests').update({ status: newStatus }).eq('id', cr.id);
    await supabase.from('internal_activity_log').insert({
      user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
      action: 'updated',
      entity_type: 'change_request',
      entity_id: cr.id,
      project_id: cr.project_id,
      description: `Changed "${cr.title}" status to ${newStatus.replace('_', ' ')}`,
    });
    loadCrs();
  };

  const getProjectName = (projectId: number) => {
    return projects.find((p) => p.id === projectId)?.project_name ?? '';
  };

  const hasActiveFilters = search || filterPriority !== 'all' || filterStatus !== 'all' || filterProject !== 'all';

  const filtered = crs.filter((cr) => {
    if (search && !cr.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority !== 'all' && cr.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && cr.status !== filterStatus) return false;
    if (filterProject !== 'all' && String(cr.project_id) !== filterProject) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Change Requests</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Change Requests</h1>
          <p className="text-sm text-foreground-500 mt-1">{filtered.length} of {crs.length} requests</p>
        </div>
        <button onClick={() => { setEditingCr(null); setModalOpen(true); }} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
          + New Request
        </button>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search change requests..." className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>

          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
            <option value="all">All Priorities</option>
            {priorities.filter(p => p !== 'all').map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
            <option value="all">All Statuses</option>
            {statuses.filter(s => s !== 'all').map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>

          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
          </select>

          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setFilterPriority('all'); setFilterStatus('all'); setFilterProject('all'); }} className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadCrs} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-git-pull-request-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {crs.length === 0 ? 'No change requests yet' : 'No requests match your filters'}
          </h3>
          <p className="text-sm text-foreground-500 mb-4">
            {crs.length === 0 ? 'Create your first change request to track proposed improvements.' : 'Try adjusting your filters.'}
          </p>
          {crs.length === 0 && (
            <button onClick={() => { setEditingCr(null); setModalOpen(true); }} className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
              Create First Request
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-background-200/60">
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Request</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Project</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Priority</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Area</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Assigned</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Created</th>
                  <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cr) => (
                  <tr key={cr.id} className="border-b border-background-200/40 hover:bg-background-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditingCr(cr); setModalOpen(true); }} className="text-left cursor-pointer w-full">
                        <span className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors line-clamp-1">{cr.title}</span>
                        {cr.description && (
                          <p className="text-xs text-foreground-600 mt-0.5 line-clamp-1">{cr.description || ''}</p>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground-400 whitespace-nowrap">{getProjectName(cr.project_id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-label capitalize whitespace-nowrap ${priorityColors[cr.priority] ?? ''}`}>{cr.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={cr.status}
                        onChange={(e) => handleStatusChange(cr, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-[10px] font-label px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer capitalize whitespace-nowrap ${statusColors[cr.status] ?? ''}`}
                      >
                        {statuses.filter(s => s !== 'all').map((s) => <option key={s} value={s} className="bg-background-100 text-foreground-100">{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-foreground-500 whitespace-nowrap">{cr.type || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-foreground-400 whitespace-nowrap">{cr.requested_by || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-foreground-500 whitespace-nowrap">{formatDate(cr.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditingCr(cr); setModalOpen(true); }} className="w-7 h-7 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
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

      <ChangeRequestFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={loadCrs} cr={editingCr} />
    </div>
  );
}