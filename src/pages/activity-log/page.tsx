import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ActivityEntry {
  id: number;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  project_id: number | null;
  description: string;
  created_at: string;
}

interface Project {
  id: number;
  project_name: string;
  slug: string;
}

const actionColors: Record<string, string> = {
  created: 'bg-emerald-500/15 text-emerald-400',
  updated: 'bg-sky-500/15 text-sky-400',
  deleted: 'bg-red-500/15 text-red-400',
  archived: 'bg-foreground-500/15 text-foreground-500',
  restored: 'bg-secondary-500/15 text-secondary-300',
  login: 'bg-accent-500/15 text-accent-400',
  other: 'bg-foreground-500/15 text-foreground-500',
};

const entityIcons: Record<string, string> = {
  project: 'ri-folder-3-line',
  idea: 'ri-lightbulb-line',
  bug: 'ri-bug-line',
  change_request: 'ri-git-pull-request-line',
  note: 'ri-sticky-note-line',
  file: 'ri-links-line',
  user: 'ri-user-line',
};

const entityLabels: Record<string, string> = {
  project: 'Project',
  idea: 'Idea',
  bug: 'Bug',
  change_request: 'Change Req',
  note: 'Note',
  file: 'File/Link',
  user: 'User',
};

const actionTypes = ['all', 'created', 'updated', 'deleted', 'archived', 'restored', 'login', 'other'];
const entityTypes = ['all', 'project', 'idea', 'bug', 'change_request', 'note', 'file', 'user'];

export default function ActivityLog() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const loadActivities = useCallback(async () => {
    try {
      setError('');
      const { data, error: dbError } = await supabase
        .from('internal_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (dbError) throw dbError;
      setActivities(data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
    supabase
      .from('internal_projects')
      .select('id,project_name,slug')
      .order('project_name')
      .then(({ data }) => setProjects(data ?? []));
  }, [loadActivities]);

  const getProject = (projectId: number | null) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) ?? null;
  };

  const hasActiveFilters = search || filterAction !== 'all' || filterEntity !== 'all' || filterProject !== 'all';

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (search && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterAction !== 'all' && a.action !== filterAction) return false;
      if (filterEntity !== 'all' && a.entity_type !== filterEntity) return false;
      if (filterProject !== 'all' && String(a.project_id ?? 'none') !== filterProject) return false;
      return true;
    });
  }, [activities, search, filterAction, filterEntity, filterProject]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    filtered.forEach((a) => {
      const date = new Date(a.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return groups;
  }, [filtered]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatRelative = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return null;
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Activity Log</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Activity Log</h1>
          <p className="text-sm text-foreground-500 mt-1">
            {filtered.length} of {activities.length} events
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
          >
            <option value="all">All Actions</option>
            {actionTypes.filter((t) => t !== 'all').map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Entities</option>
            {entityTypes.filter((t) => t !== 'all').map((t) => (
              <option key={t} value={t}>{entityLabels[t] ?? t}</option>
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
            <option value="none">No Project</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setFilterAction('all'); setFilterEntity('all'); setFilterProject('all'); }}
              className="text-sm text-foreground-500 hover:text-foreground-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadActivities} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!error && filtered.length === 0 && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-history-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
            {activities.length === 0 ? 'No activity recorded yet' : 'No events match your filters'}
          </h3>
          <p className="text-sm text-foreground-500">
            {activities.length === 0 ? 'Activity will appear here as you create and modify items.' : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {/* Timeline */}
      {filtered.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateLabel, entries]) => (
            <div key={dateLabel}>
              {/* Date Header */}
              <button
                onClick={() => toggleGroup(dateLabel)}
                className="flex items-center gap-2 mb-3 cursor-pointer group"
              >
                <i
                  className={`ri-arrow-down-s-line text-sm text-foreground-400 transition-transform duration-200 w-4 h-4 flex items-center justify-center ${
                    collapsedGroups.has(dateLabel) ? '-rotate-90' : ''
                  }`}
                ></i>
                <span className="text-sm font-heading font-semibold text-foreground-300">{dateLabel}</span>
                <span className="text-xs text-foreground-500">({entries.length})</span>
              </button>

              {!collapsedGroups.has(dateLabel) && (
                <div className="relative pl-8">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-background-200"></div>

                  <div className="space-y-1">
                    {entries.map((entry, i) => {
                      const project = getProject(entry.project_id);
                      const entityIcon = entityIcons[entry.entity_type] ?? 'ri-record-circle-line';
                      const relativeTime = formatRelative(entry.created_at);

                      return (
                        <div key={entry.id} className="relative pb-3 last:pb-0">
                          {/* Timeline dot */}
                          <div className={`absolute left-[-32px] top-1.5 w-[7px] h-[7px] rounded-full border-2 ${
                            entry.action === 'deleted'
                              ? 'border-red-400 bg-red-500/20'
                              : entry.action === 'created'
                              ? 'border-emerald-400 bg-emerald-500/20'
                              : entry.action === 'updated'
                              ? 'border-sky-400 bg-sky-500/20'
                              : 'border-secondary-400 bg-secondary-500/20'
                          }`}></div>

                          <div className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5 hover:border-background-300/60 transition-colors duration-150 group/timeline">
                            <div className="flex items-start gap-2.5">
                              {/* Entity icon */}
                              <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center shrink-0 mt-0.5">
                                <i className={`${entityIcon} text-xs text-foreground-400 w-3.5 h-3.5 flex items-center justify-center`}></i>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className="text-sm text-foreground-200 leading-snug">{entry.description}</span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  {/* Action badge */}
                                  <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${actionColors[entry.action] ?? ''}`}>
                                    {entry.action}
                                  </span>

                                  {/* Entity badge */}
                                  <span className="text-[10px] font-label text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                                    {entityLabels[entry.entity_type] ?? entry.entity_type}
                                  </span>

                                  {/* Project link */}
                                  {project && (
                                    <Link
                                      to={`/projects/${project.slug}`}
                                      className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap"
                                    >
                                      {project.project_name}
                                    </Link>
                                  )}

                                  {/* Time */}
                                  <span className="text-[10px] text-foreground-600 whitespace-nowrap ml-auto" title={formatTime(entry.created_at)}>
                                    {relativeTime ?? formatTime(entry.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}