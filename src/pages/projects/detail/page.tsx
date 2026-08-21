import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import ProjectWizardModal from '@/pages/projects/components/ProjectWizardModal';
import ConfirmDialog from '@/components/base/ConfirmDialog';

interface Project {
  id: number;
  project_name: string;
  project_slug: string;
  description: string | null;
  status: string;
  priority: string;
  owner: string | null;
  tech_stack: string | null;
  domain_live: string | null;
  domain_staging: string | null;
  target_launch_date: string | null;
  launched_at: string | null;
  is_ai_powered: boolean;
  is_saas: boolean;
  is_client_build: boolean;
  is_internal_tool: boolean;
  monthly_revenue: number;
  monthly_costs: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Idea {
  id: number;
  idea_name: string;
  category: string | null;
  priority: string;
  status: string;
  description: string | null;
  owner: string | null;
  ai_generated: boolean;
}

interface Bug {
  id: number;
  title: string;
  severity: string;
  status: string;
  type: string | null;
  description: string | null;
  environment: string | null;
  assigned_to: string | null;
  steps_to_reproduce: string | null;
  created_at: string;
}

interface ChangeRequest {
  id: number;
  title: string;
  priority: string;
  status: string;
  type: string | null;
  description: string | null;
  requested_by: string | null;
  estimated_hours: number | null;
}

interface Note {
  id: number;
  title: string;
  category: string;
  content: string | null;
  tags: string[] | null;
  pinned: boolean;
  created_at: string;
}

interface FileLink {
  id: number;
  name: string;
  type: string;
  url: string;
  description: string | null;
  category: string | null;
}

const statusColors: Record<string, string> = {
  idea: 'bg-secondary-500/10 text-secondary-300',
  planning: 'bg-sky-500/10 text-sky-400',
  building: 'bg-accent-500/10 text-accent-400',
  testing: 'bg-yellow-500/10 text-yellow-400',
  live: 'bg-emerald-500/10 text-emerald-400',
  on_hold: 'bg-foreground-500/10 text-foreground-400',
  archived: 'bg-foreground-500/10 text-foreground-600',
  new: 'bg-secondary-500/10 text-secondary-300',
  approved: 'bg-sky-500/10 text-sky-400',
  in_progress: 'bg-accent-500/10 text-accent-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-foreground-500/10 text-foreground-500',
  building_idea: 'bg-accent-500/10 text-accent-400',
  reviewing: 'bg-yellow-500/10 text-yellow-400',
  done: 'bg-emerald-500/10 text-emerald-400',
};

const priorityColors: Record<string, string> = {
  low: 'text-foreground-500',
  medium: 'text-foreground-300',
  high: 'text-primary-400',
  critical: 'text-red-400',
};

const severityColors: Record<string, string> = {
  low: 'bg-foreground-500/10 text-foreground-400',
  medium: 'bg-secondary-500/10 text-secondary-300',
  high: 'bg-primary-500/10 text-primary-400',
  critical: 'bg-red-500/10 text-red-400',
};

const bugStatusColors: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-yellow-500/10 text-yellow-400',
  in_progress: 'bg-sky-500/10 text-sky-400',
  fixed: 'bg-emerald-500/10 text-emerald-400',
  wont_fix: 'bg-foreground-500/10 text-foreground-500',
  duplicate: 'bg-foreground-500/10 text-foreground-500',
  resolved: 'bg-emerald-500/10 text-emerald-400',
};

const noteCategoryIcons: Record<string, string> = {
  decision: 'ri-scales-3-line',
  research: 'ri-search-eye-line',
  meeting: 'ri-chat-3-line',
  general: 'ri-sticky-note-line',
  legal: 'ri-scales-line',
  pricing: 'ri-money-pound-circle-line',
  client_feedback: 'ri-feedback-line',
  supplier: 'ri-truck-line',
  other: 'ri-more-line',
};

const fileTypeIcons: Record<string, string> = {
  link: 'ri-link',
  dashboard: 'ri-dashboard-3-line',
  repo: 'ri-github-line',
  file: 'ri-file-3-line',
  document: 'ri-file-text-line',
  figma: 'ri-pen-nib-line',
};

type TabKey = 'overview' | 'ideas' | 'bugs' | 'change-requests' | 'notes' | 'files-links';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-eye-line' },
  { key: 'ideas', label: 'Ideas', icon: 'ri-lightbulb-line' },
  { key: 'bugs', label: 'Bugs', icon: 'ri-bug-line' },
  { key: 'change-requests', label: 'Change Requests', icon: 'ri-git-pull-request-line' },
  { key: 'notes', label: 'Notes', icon: 'ri-sticky-note-line' },
  { key: 'files-links', label: 'Files & Links', icon: 'ri-links-line' },
];

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [fileLinks, setFileLinks] = useState<FileLink[]>([]);

  const [tabLoading, setTabLoading] = useState(false);
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const loadProject = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('internal_projects')
        .select('*')
        .eq('project_slug', slug)
        .maybeSingle();

      if (dbError) throw dbError;
      if (!data) throw new Error('Project not found');
      setProject(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const loadRelated = useCallback(async (projectId: number) => {
    setTabLoading(true);
    try {
      const [
        { data: ideasData },
        { data: bugsData },
        { data: crData },
        { data: notesData },
        { data: flData },
      ] = await Promise.all([
        supabase.from('internal_ideas').select('id,idea_name,category,priority,status,description,owner,ai_generated').eq('related_project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('internal_bugs').select('id,title,severity,status,type,description,environment,assigned_to,steps_to_reproduce,created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('internal_change_requests').select('id,title,priority,status,type,description,requested_by,estimated_hours').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('internal_notes').select('id,title,category,content,tags,pinned,created_at').eq('project_id', projectId).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('internal_files_links').select('id,name,type,url,description,category').eq('project_id', projectId).order('created_at', { ascending: false }),
      ]);
      setIdeas(ideasData ?? []);
      setBugs(bugsData ?? []);
      setChangeRequests(crData ?? []);
      setNotes(notesData ?? []);
      setFileLinks(flData ?? []);
    } catch {
      // silently fail — tab data is non-critical
    } finally {
      setTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (project?.id) {
      loadRelated(project.id);
    }
  }, [project?.id, loadRelated]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const logActivity = async (action: string) => {
    if (!project) return;
    try {
      await supabase.from('internal_activity_log').insert({
        entity_type: 'project',
        entity_id: project.id,
        action,
        description: `${action} project: ${project.project_name}`,
      });
    } catch {
      // non-critical
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    setActionLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('internal_projects')
        .update({ status: 'archived' })
        .eq('id', project.id);
      if (dbError) throw dbError;
      await logActivity('archived');
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Failed to archive project');
    } finally {
      setActionLoading(false);
      setShowArchiveDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    setActionLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('internal_projects')
        .delete()
        .eq('id', project.id);
      if (dbError) throw dbError;
      await logActivity('deleted');
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  // --- LOADING ---
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-background-100 rounded w-64"></div>
        <div className="h-28 bg-background-100 rounded-lg"></div>
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 bg-background-100 rounded-full w-24"></div>
          ))}
        </div>
        <div className="h-64 bg-background-100 rounded-lg"></div>
      </div>
    );
  }

  // --- ERROR ---
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
          <i className="ri-error-warning-line text-2xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
        </div>
        <h2 className="text-lg font-heading font-semibold text-foreground-200 mb-2">
          {error || 'Project not found'}
        </h2>
        <p className="text-sm text-foreground-500 mb-4">The project you're looking for doesn't exist or was removed.</p>
        <Link
          to="/projects"
          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  const typeBadges: string[] = [];
  if (project.is_saas) typeBadges.push('SaaS');
  if (project.is_client_build) typeBadges.push('Client Build');
  if (project.is_internal_tool) typeBadges.push('Internal Tool');
  if (project.is_ai_powered) typeBadges.push('AI-Powered');

  const totalItems = ideas.length + bugs.length + changeRequests.length + notes.length + fileLinks.length;

  const monthlyProfit = (project.monthly_revenue || 0) - (project.monthly_costs || 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-foreground-500">
        <Link to="/projects" className="hover:text-foreground-300 transition-colors whitespace-nowrap">Projects</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <span className="text-foreground-200 font-medium truncate">{project.project_name}</span>
      </div>

      {/* Project Header */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-heading font-bold text-foreground-50">{project.project_name}</h1>
                <button
                  type="button"
                  onClick={() => setShowEditWizard(true)}
                  className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-pencil-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  Edit
                </button>

                {/* More Actions Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen(!moreOpen)}
                    className="flex items-center justify-center w-8 h-8 text-foreground-400 hover:text-foreground-200 bg-background-50 border border-background-200/60 hover:border-background-300/60 rounded-full transition-colors cursor-pointer"
                  >
                    <i className="ri-more-2-fill w-4 h-4 flex items-center justify-center"></i>
                  </button>
                  {moreOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-background-50 border border-background-200/60 rounded-lg shadow-lg z-40 py-1.5 overflow-hidden">
                        {project.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => { setMoreOpen(false); setShowArchiveDialog(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground-300 hover:bg-background-100 hover:text-foreground-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-archive-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setMoreOpen(false); setShowDeleteDialog(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-delete-bin-line w-4 h-4 flex items-center justify-center"></i>
                          Delete Project
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${statusColors[project.status] ?? 'text-foreground-500'}`}>
                {project.status.replace('_', ' ')}
              </span>
              <span className={`text-xs font-label ${priorityColors[project.priority] ?? ''} uppercase whitespace-nowrap`}>
                {project.priority}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-foreground-400 leading-relaxed max-w-3xl">{project.description}</p>
            )}
          </div>

          {/* Financial Summary */}
          {(project.monthly_revenue > 0 || project.monthly_costs > 0) && (
            <div className="shrink-0 bg-background-50 border border-background-200/60 rounded-lg p-4 min-w-[200px]">
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-2">Monthly Financials</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-foreground-500">Revenue</span>
                <span className="text-emerald-400 text-right font-semibold">&pound;{project.monthly_revenue.toLocaleString()}</span>
                <span className="text-foreground-500">Costs</span>
                <span className="text-red-400 text-right font-semibold">&pound;{project.monthly_costs.toLocaleString()}</span>
                <span className="text-foreground-500 pt-1 border-t border-background-200/60">Profit</span>
                <span className={`text-right font-semibold pt-1 border-t border-background-200/60 ${monthlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  &pound;{monthlyProfit.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Type Badges */}
        {typeBadges.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-background-200/60 flex-wrap">
            {typeBadges.map((badge) => (
              <span key={badge} className="text-[10px] font-label text-foreground-400 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 whitespace-nowrap">
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { count: ideas.length, label: 'Ideas', icon: 'ri-lightbulb-line', color: 'text-amber-400' },
          { count: bugs.length, label: 'Bugs', icon: 'ri-bug-line', color: 'text-red-400' },
          { count: changeRequests.length, label: 'Change Reqs', icon: 'ri-git-pull-request-line', color: 'text-sky-400' },
          { count: notes.length, label: 'Notes', icon: 'ri-sticky-note-line', color: 'text-emerald-400' },
          { count: fileLinks.length, label: 'Files/Links', icon: 'ri-links-line', color: 'text-primary-400' },
          { count: totalItems, label: 'Total', icon: 'ri-stack-line', color: 'text-foreground-200' },
        ].map((stat) => (
          <div key={stat.label} className="bg-background-100 border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <i className={`${stat.icon} ${stat.color} w-4 h-4 flex items-center justify-center`}></i>
              <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">{stat.label}</span>
            </div>
            <span className="text-xl font-heading font-bold text-foreground-50">{stat.count}</span>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-1 flex gap-0.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'bg-accent-500/10 text-accent-400 font-semibold'
                : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/40'
            }`}
          >
            <i className={`${tab.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
            {tab.label}
            {tab.key !== 'overview' && (
              <span className="text-[10px] opacity-60">
                ({tab.key === 'ideas' ? ideas.length : tab.key === 'bugs' ? bugs.length : tab.key === 'change-requests' ? changeRequests.length : tab.key === 'notes' ? notes.length : fileLinks.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tabLoading ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse h-48"></div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          {activeTab === 'overview' && <OverviewTab project={project} />}
          {activeTab === 'ideas' && <IdeasTab ideas={ideas} />}
          {activeTab === 'bugs' && <BugsTab bugs={bugs} formatDate={formatDate} />}
          {activeTab === 'change-requests' && <ChangeRequestsTab changeRequests={changeRequests} />}
          {activeTab === 'notes' && <NotesTab notes={notes} formatDate={formatDate} />}
          {activeTab === 'files-links' && <FilesLinksTab fileLinks={fileLinks} />}
        </div>
      )}

      {/* Edit Wizard */}
      <ProjectWizardModal
        open={showEditWizard}
        onClose={() => setShowEditWizard(false)}
        onCreated={loadProject}
        project={project}
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        open={showArchiveDialog}
        onClose={() => setShowArchiveDialog(false)}
        title="Archive Project"
        message={`Archive "${project.project_name}"? It'll be hidden from the active projects list but can be restored later by changing its status back.`}
        confirmLabel={actionLoading ? 'Archiving...' : 'Archive'}
        confirmVariant="accent"
        onConfirm={handleArchive}
        loading={actionLoading}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Project"
        message={`Permanently delete "${project.project_name}"? This action cannot be undone. All related ideas, bugs, change requests, notes, and file links will also be removed.`}
        confirmLabel={actionLoading ? 'Deleting...' : 'Delete Permanently'}
        confirmVariant="danger"
        onConfirm={handleDelete}
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────

function OverviewTab({ project }: { project: Project }) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">About</h3>
          <p className="text-sm text-foreground-400 leading-relaxed">
            {project.description || 'No description provided.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Status</p>
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase ${statusColors[project.status] ?? ''}`}>
                {project.status.replace('_', ' ')}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Priority</p>
              <span className={`text-sm font-heading font-semibold capitalize ${priorityColors[project.priority] ?? ''}`}>
                {project.priority}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Created</p>
              <p className="text-sm text-foreground-300">{new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Last Updated</p>
              <p className="text-sm text-foreground-300">{new Date(project.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            {project.owner && (
              <div>
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Owner</p>
                <p className="text-sm text-foreground-300">{project.owner}</p>
              </div>
            )}
            {project.target_launch_date && (
              <div>
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Target Launch</p>
                <p className="text-sm text-foreground-300">{new Date(project.target_launch_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            )}
            {project.launched_at && (
              <div>
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Launched</p>
                <p className="text-sm text-foreground-300">{new Date(project.launched_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Domains */}
          {(project.domain_live || project.domain_staging) && (
            <div>
              <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Domains</h3>
              <div className="space-y-2">
                {project.domain_live && (
                  <div className="flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                    <span className="text-xs text-foreground-400 mr-1">Live:</span>
                    <a href={`https://${project.domain_live}`} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground-100 font-mono hover:text-accent-400 transition-colors truncate cursor-pointer">{project.domain_live}</a>
                  </div>
                )}
                {project.domain_staging && (
                  <div className="flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>
                    <span className="text-xs text-foreground-400 mr-1">Staging:</span>
                    <span className="text-sm text-foreground-300 font-mono truncate">{project.domain_staging}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tech Stack */}
          {project.tech_stack && (
            <div>
              <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Tech Stack</h3>
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
                <p className="text-sm text-foreground-300 font-mono leading-relaxed">{project.tech_stack}</p>
              </div>
            </div>
          )}

          {/* Financials */}
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Financials</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 text-center">
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Revenue/mo</p>
                <p className="text-base font-heading font-bold text-emerald-400">&pound;{project.monthly_revenue.toLocaleString()}</p>
              </div>
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 text-center">
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Costs/mo</p>
                <p className="text-base font-heading font-bold text-red-400">&pound;{project.monthly_costs.toLocaleString()}</p>
              </div>
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 text-center">
                <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Profit/mo</p>
                <p className={`text-base font-heading font-bold ${((project.monthly_revenue || 0) - (project.monthly_costs || 0)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  &pound;{((project.monthly_revenue || 0) - (project.monthly_costs || 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Project Notes */}
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Project Notes</h3>
            {project.notes ? (
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
                <p className="text-sm text-foreground-400 leading-relaxed whitespace-pre-wrap">{project.notes}</p>
              </div>
            ) : (
              <p className="text-sm text-foreground-500 italic">No project notes yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ideas Tab ───────────────────────────────────────────

function IdeasTab({ ideas }: { ideas: Idea[] }) {
  if (ideas.length === 0) {
    return <EmptyTab icon="ri-lightbulb-line" label="ideas" />;
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ideas.map((idea) => (
          <Link
            key={idea.id}
            to="/ideas"
            className="bg-background-50 border border-background-200/60 rounded-lg p-4 hover:border-accent-500/30 transition-colors duration-150 group cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h4 className="text-sm font-heading font-semibold text-foreground-100 group-hover:text-accent-400 transition-colors line-clamp-1">{idea.idea_name}</h4>
              {idea.ai_generated && (
                <span className="text-[10px] font-label text-accent-400 bg-accent-500/10 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">AI</span>
              )}
            </div>
            {idea.description && (
              <p className="text-xs text-foreground-500 line-clamp-2 mb-3">{idea.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${statusColors[idea.status] ?? ''}`}>
                {idea.status.replace('_', ' ')}
              </span>
              <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[idea.priority] ?? ''}`}>
                {idea.priority}
              </span>
              {idea.category && (
                <span className="text-[10px] text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{idea.category}</span>
              )}
              {idea.owner && (
                <span className="text-[10px] text-foreground-600 whitespace-nowrap">{idea.owner}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Bugs Tab ────────────────────────────────────────────

function BugsTab({ bugs, formatDate }: { bugs: Bug[]; formatDate: (d: string) => string }) {
  if (bugs.length === 0) {
    return <EmptyTab icon="ri-bug-line" label="bugs" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-background-200/60">
            <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Bug</th>
            <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Severity</th>
            <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Type</th>
            <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Reported</th>
          </tr>
        </thead>
        <tbody>
          {bugs.map((bug) => (
            <tr key={bug.id} className="border-b border-background-200/40 hover:bg-background-50/50 transition-colors">
              <td className="px-4 py-3">
                <Link to="/bugs" className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors line-clamp-1 cursor-pointer">{bug.title}</Link>
                {bug.description && (
                  <p className="text-xs text-foreground-600 mt-0.5 line-clamp-1">{bug.description}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${severityColors[bug.severity] ?? ''}`}>
                  {bug.severity}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${bugStatusColors[bug.status] ?? ''}`}>
                  {bug.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs text-foreground-500 whitespace-nowrap">{bug.type || '—'}</span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-foreground-500 whitespace-nowrap">{formatDate(bug.created_at)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Change Requests Tab ─────────────────────────────────

function ChangeRequestsTab({ changeRequests }: { changeRequests: ChangeRequest[] }) {
  if (changeRequests.length === 0) {
    return <EmptyTab icon="ri-git-pull-request-line" label="change requests" />;
  }

  return (
    <div className="divide-y divide-background-200/60">
      {changeRequests.map((cr) => (
        <Link key={cr.id} to="/change-requests" className="block px-4 py-3 hover:bg-background-50/50 transition-colors group cursor-pointer">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h4 className="text-sm font-heading font-semibold text-foreground-100 group-hover:text-accent-400 transition-colors">{cr.title}</h4>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${statusColors[cr.status] ?? ''}`}>
                {cr.status.replace('_', ' ')}
              </span>
              <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[cr.priority] ?? ''}`}>
                {cr.priority}
              </span>
            </div>
          </div>
          {cr.description && (
            <p className="text-xs text-foreground-500 line-clamp-1 mt-1">{cr.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {cr.type && (
              <span className="text-[10px] text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{cr.type}</span>
            )}
            {cr.requested_by && (
              <span className="text-[10px] text-foreground-600 whitespace-nowrap">Requested by {cr.requested_by}</span>
            )}
            {cr.estimated_hours != null && (
              <span className="text-[10px] text-foreground-600 whitespace-nowrap">{cr.estimated_hours}h est.</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Notes Tab ───────────────────────────────────────────

function NotesTab({ notes, formatDate }: { notes: Note[]; formatDate: (d: string) => string }) {
  if (notes.length === 0) {
    return <EmptyTab icon="ri-sticky-note-line" label="notes" />;
  }

  const pinnedNotes = notes.filter((n) => n.pinned);
  const unpinnedNotes = notes.filter((n) => !n.pinned);

  return (
    <div className="divide-y divide-background-200/60">
      {pinnedNotes.length > 0 && pinnedNotes.map((note) => (
        <NoteRow key={note.id} note={note} formatDate={formatDate} />
      ))}
      {unpinnedNotes.map((note) => (
        <NoteRow key={note.id} note={note} formatDate={formatDate} />
      ))}
    </div>
  );
}

function NoteRow({ note, formatDate }: { note: Note; formatDate: (d: string) => string }) {
  const icon = noteCategoryIcons[note.category] ?? noteCategoryIcons.general;
  return (
    <div className={`px-4 py-4 ${note.pinned ? 'bg-accent-500/[0.03]' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-background-200/60 flex items-center justify-center shrink-0 mt-0.5">
          <i className={`${icon} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-heading font-semibold text-foreground-100">{note.title}</h4>
            {note.pinned && (
              <i className="ri-pushpin-2-fill text-accent-400 w-3 h-3 flex items-center justify-center"></i>
            )}
            <span className="text-[10px] font-label text-foreground-500 capitalize bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{note.category}</span>
            {note.tags && note.tags.map((tag) => (
              <span key={tag} className="text-[10px] text-foreground-600 whitespace-nowrap">#{tag}</span>
            ))}
          </div>
          {note.content && (
            <p className="text-xs text-foreground-500 leading-relaxed line-clamp-3 whitespace-pre-wrap">{note.content}</p>
          )}
          <p className="text-[10px] text-foreground-600 mt-2">{formatDate(note.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Files & Links Tab ───────────────────────────────────

function FilesLinksTab({ fileLinks }: { fileLinks: FileLink[] }) {
  if (fileLinks.length === 0) {
    return <EmptyTab icon="ri-links-line" label="files or links" />;
  }

  const grouped = fileLinks.reduce<Record<string, FileLink[]>>((acc, fl) => {
    const key = fl.type || 'link';
    if (!acc[key]) acc[key] = [];
    acc[key].push(fl);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-2">
            <i className={`${fileTypeIcons[type] ?? 'ri-link'} w-3.5 h-3.5 flex items-center justify-center text-foreground-400`}></i>
            <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">{type}</span>
            <span className="text-[10px] text-foreground-600">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((fl) => (
              <a
                key={fl.id}
                href={fl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-background-50 border border-background-200/60 rounded-lg p-3 hover:border-accent-500/30 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <i className={`${fileTypeIcons[fl.type] ?? 'ri-link'} text-accent-400 w-3.5 h-3.5 flex items-center justify-center`}></i>
                  <h4 className="text-sm font-medium text-foreground-100 group-hover:text-accent-400 transition-colors line-clamp-1">{fl.name}</h4>
                </div>
                {fl.description && (
                  <p className="text-xs text-foreground-500 line-clamp-2 ml-5">{fl.description}</p>
                )}
                {fl.category && (
                  <div className="mt-2 ml-5">
                    <span className="text-[10px] text-foreground-600 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{fl.category}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty Tab ───────────────────────────────────────────

function EmptyTab({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
        <i className={`${icon} text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center`}></i>
      </div>
      <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No {label} yet</h3>
      <p className="text-sm text-foreground-500">Nothing has been linked to this project.</p>
    </div>
  );
}