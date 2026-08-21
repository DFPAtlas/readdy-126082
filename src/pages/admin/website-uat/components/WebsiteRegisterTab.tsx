import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatProject, UatEnvironment, PROJECT_STATUS_COLORS } from '../types';
import UatProjectFormModal from './UatProjectFormModal';
import UatEnvironmentFormModal from './UatEnvironmentFormModal';

const STATUSES = ['planning', 'active', 'completed', 'draft', 'archived', 'paused'] as const;
const ENV_TYPES = ['staging', 'uat', 'development', 'production', 'qa', 'demo', 'preview'] as const;

interface ProjectEditForm {
  name: string;
  client_company: string;
  description: string;
  live_url: string;
  product_website: string;
  status: string;
  reference: string;
  objective: string;
  start_date: string;
  completion_date: string;
  required_testers: string;
  coverage_target: string;
}

interface EnvEditForm {
  environment_name: string;
  type: string;
  base_url: string;
  login_url: string;
  admin_login_url: string;
  tester_login_url: string;
  current_build: string;
  release_candidate: string;
  version: string;
  git_branch: string;
  environment_notes: string;
  is_active: boolean;
}

function projectToEditForm(p: UatProject): ProjectEditForm {
  return {
    name: p.name || '',
    client_company: p.client_company || '',
    description: p.description || '',
    live_url: p.live_url || '',
    product_website: p.product_website || '',
    status: p.status || 'planning',
    reference: p.reference || '',
    objective: p.objective || '',
    start_date: p.start_date || '',
    completion_date: p.completion_date || '',
    required_testers: p.required_testers != null ? String(p.required_testers) : '',
    coverage_target: p.coverage_target || '',
  };
}

function envToEditForm(e: UatEnvironment): EnvEditForm {
  return {
    environment_name: e.environment_name || '',
    type: e.type || 'staging',
    base_url: e.base_url || '',
    login_url: e.login_url || '',
    admin_login_url: e.admin_login_url || '',
    tester_login_url: e.tester_login_url || '',
    current_build: e.current_build || '',
    release_candidate: e.release_candidate || '',
    version: e.version || '',
    git_branch: e.git_branch || '',
    environment_notes: e.environment_notes || '',
    is_active: e.is_active,
  };
}

export default function WebsiteRegisterTab() {
  const [projects, setProjects] = useState<(UatProject & { environments: UatEnvironment[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [envModalProjectId, setEnvModalProjectId] = useState<string | null>(null);

  // Inline edit states
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectEditForm | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [projectEditError, setProjectEditError] = useState('');

  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [envForm, setEnvForm] = useState<EnvEditForm | null>(null);
  const [savingEnv, setSavingEnv] = useState(false);
  const [envEditError, setEnvEditError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      let q = supabase.from('uat_projects').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data: projData, error: projErr } = await q;
      if (projErr) throw projErr;

      const { data: envData } = await supabase.from('uat_environments').select('*').order('created_at', { ascending: false });

      const projectsWithEnvs = (projData || []).map((p: Record<string, unknown>) => ({
        ...p,
        environments: (envData || []).filter((e: Record<string, unknown>) => e.project_id === p.id),
      })) as (UatProject & { environments: UatEnvironment[] })[];

      setProjects(projectsWithEnvs);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreated = () => {
    setFilter('all');
    loadData();
  };

  // ── Project inline edit ──────────────────────────────────────────────
  const startEditProject = (p: UatProject & { environments: UatEnvironment[] }) => {
    setEditingProjectId(p.id);
    setEditingEnvId(null);
    setProjectForm(projectToEditForm(p));
    setProjectEditError('');
    setExpandedId(p.id);
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setProjectForm(null);
    setProjectEditError('');
  };

  const updateProjectField = <K extends keyof ProjectEditForm>(key: K, value: ProjectEditForm[K]) => {
    setProjectForm((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const saveProject = async () => {
    if (!projectForm || !editingProjectId) return;
    if (!projectForm.name.trim()) {
      setProjectEditError('Project name is required.');
      return;
    }
    setProjectEditError('');
    setSavingProject(true);

    const payload = {
      name: projectForm.name.trim(),
      client_company: projectForm.client_company.trim() || null,
      description: projectForm.description.trim() || null,
      live_url: projectForm.live_url.trim() || null,
      product_website: projectForm.product_website.trim() || null,
      status: projectForm.status,
      reference: projectForm.reference.trim() || null,
      objective: projectForm.objective.trim() || null,
      start_date: projectForm.start_date || null,
      completion_date: projectForm.completion_date || null,
      required_testers: projectForm.required_testers ? Number(projectForm.required_testers) : 0,
      coverage_target: projectForm.coverage_target.trim() || null,
    };

    const { error: updateErr } = await supabase.from('uat_projects').update(payload).eq('id', editingProjectId);

    if (updateErr) {
      setProjectEditError(updateErr.message);
      setSavingProject(false);
      return;
    }

    setSavingProject(false);
    cancelEditProject();
    loadData();
  };

  // ── Environment inline edit ──────────────────────────────────────────
  const startEditEnv = (e: UatEnvironment) => {
    setEditingEnvId(e.id);
    setEditingProjectId(null);
    setEnvForm(envToEditForm(e));
    setEnvEditError('');
  };

  const cancelEditEnv = () => {
    setEditingEnvId(null);
    setEnvForm(null);
    setEnvEditError('');
  };

  const updateEnvField = <K extends keyof EnvEditForm>(key: K, value: EnvEditForm[K]) => {
    setEnvForm((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const saveEnv = async () => {
    if (!envForm || !editingEnvId) return;
    if (!envForm.environment_name.trim()) {
      setEnvEditError('Environment name is required.');
      return;
    }
    setEnvEditError('');
    setSavingEnv(true);

    const payload = {
      environment_name: envForm.environment_name.trim(),
      type: envForm.type,
      base_url: envForm.base_url.trim() || null,
      login_url: envForm.login_url.trim() || null,
      admin_login_url: envForm.admin_login_url.trim() || null,
      tester_login_url: envForm.tester_login_url.trim() || null,
      current_build: envForm.current_build.trim() || null,
      release_candidate: envForm.release_candidate.trim() || null,
      version: envForm.version.trim() || null,
      git_branch: envForm.git_branch.trim() || null,
      environment_notes: envForm.environment_notes.trim() || null,
      is_active: envForm.is_active,
    };

    const { error: updateErr } = await supabase.from('uat_environments').update(payload).eq('id', editingEnvId);

    if (updateErr) {
      setEnvEditError(updateErr.message);
      setSavingEnv(false);
      return;
    }

    setSavingEnv(false);
    cancelEditEnv();
    loadData();
  };

  // ── Environment delete ───────────────────────────────────────────────
  const deleteEnv = async (envId: string) => {
    if (!confirm('Delete this environment? This cannot be undone.')) return;
    await supabase.from('uat_environments').delete().eq('id', envId);
    loadData();
  };

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading projects...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filter === f ? 'bg-accent-500/10 text-accent-400' : 'text-foreground-400 hover:text-foreground-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-background-950 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line w-3.5 h-3.5 flex items-center justify-center"></i>
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-foreground-500 py-8">No UAT projects found.</p>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => {
            const isExpanded = expandedId === p.id;
            const isEditing = editingProjectId === p.id;

            return (
              <div key={p.id} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
                {/* ── Header row ── */}
                <div
                  onClick={() => {
                    if (!isEditing) setExpandedId(isExpanded ? null : p.id);
                  }}
                  className={`p-4 flex items-center justify-between transition-colors ${
                    isEditing ? '' : 'cursor-pointer hover:bg-background-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground-50">{p.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLORS[p.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-500 mt-0.5 truncate max-w-md">{p.objective || p.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-foreground-500">{p.environments?.length || 0} env(s)</span>
                    {!isEditing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditProject(p); }}
                        className="p-1 rounded-md hover:bg-background-200/60 text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
                        title="Edit project"
                      >
                        <i className="ri-pencil-line w-3.5 h-3.5 flex items-center justify-center"></i>
                      </button>
                    )}
                    <i className={`${isExpanded ? 'ri-arrow-up-s-fill' : 'ri-arrow-down-s-fill'} text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
                  </div>
                </div>

                {/* ── Expanded section ── */}
                {isExpanded && (
                  <div className="border-t border-background-200/60 p-4 space-y-3">
                    {/* ── Inline edit mode ── */}
                    {isEditing && projectForm ? (
                      <div className="space-y-4">
                        {projectEditError && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <p className="text-sm text-red-400">{projectEditError}</p>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">
                            Project Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            value={projectForm.name}
                            onChange={(e) => updateProjectField('name', e.target.value)}
                            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
                            <select
                              value={projectForm.status}
                              onChange={(e) => updateProjectField('status', e.target.value)}
                              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Required Testers</label>
                            <input
                              type="number"
                              value={projectForm.required_testers}
                              onChange={(e) => updateProjectField('required_testers', e.target.value)}
                              min="0"
                              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Client / Company</label>
                          <input
                            value={projectForm.client_company}
                            onChange={(e) => updateProjectField('client_company', e.target.value)}
                            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Live URL</label>
                            <input
                              value={projectForm.live_url}
                              onChange={(e) => updateProjectField('live_url', e.target.value)}
                              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Product Website</label>
                            <input
                              value={projectForm.product_website}
                              onChange={(e) => updateProjectField('product_website', e.target.value)}
                              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
                          <textarea
                            value={projectForm.description}
                            onChange={(e) => updateProjectField('description', e.target.value)}
                            rows={3}
                            maxLength={500}
                            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors resize-none"
                          />
                          <p className="text-[10px] text-foreground-600 mt-1 text-right">{projectForm.description.length}/500</p>
                        </div>

                        <div>
                          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Objective</label>
                          <input
                            value={projectForm.objective}
                            onChange={(e) => updateProjectField('objective', e.target.value)}
                            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Reference</label>
                          <input
                            value={projectForm.reference}
                            onChange={(e) => updateProjectField('reference', e.target.value)}
                            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Coverage Target</label>
                          <input
                            value={projectForm.coverage_target}
                            onChange={(e) => updateProjectField('coverage_target', e.target.value)}
                            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Start Date</label>
                            <input
                              type="date"
                              value={projectForm.start_date}
                              onChange={(e) => updateProjectField('start_date', e.target.value)}
                              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Completion Date</label>
                            <input
                              type="date"
                              value={projectForm.completion_date}
                              onChange={(e) => updateProjectField('completion_date', e.target.value)}
                              className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-1">
                          <button
                            onClick={cancelEditProject}
                            className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveProject}
                            disabled={savingProject}
                            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                          >
                            {savingProject ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read-only expanded content ── */
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div><span className="text-foreground-500">Reference:</span> <span className="text-foreground-200 ml-1">{p.reference || '—'}</span></div>
                          <div><span className="text-foreground-500">Client:</span> <span className="text-foreground-200 ml-1">{p.client_company || '—'}</span></div>
                          <div><span className="text-foreground-500">Testers needed:</span> <span className="text-foreground-200 ml-1">{p.required_testers || '—'}</span></div>
                          {p.product_website && <div className="col-span-2"><span className="text-foreground-500">Website:</span> <span className="text-foreground-200 ml-1">{p.product_website}</span></div>}
                        </div>

                        {/* ── Environments list ── */}
                        {p.environments && p.environments.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-foreground-400 mb-2">Environments</p>
                            <div className="grid gap-2">
                              {p.environments.map((env) => {
                                const isEditingEnv = editingEnvId === env.id;

                                if (isEditingEnv && envForm) {
                                  return (
                                    <div key={env.id} className="bg-background-50 rounded-md p-3 space-y-3 border border-accent-500/20">
                                      {envEditError && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                          <p className="text-xs text-red-400">{envEditError}</p>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">
                                            Environment Name <span className="text-red-400">*</span>
                                          </label>
                                          <input
                                            value={envForm.environment_name}
                                            onChange={(e) => updateEnvField('environment_name', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Type</label>
                                          <select
                                            value={envForm.type}
                                            onChange={(e) => updateEnvField('type', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
                                          >
                                            {ENV_TYPES.map((t) => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Base URL</label>
                                        <input
                                          value={envForm.base_url}
                                          onChange={(e) => updateEnvField('base_url', e.target.value)}
                                          className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                        />
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Login URL</label>
                                          <input
                                            value={envForm.login_url}
                                            onChange={(e) => updateEnvField('login_url', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Admin Login URL</label>
                                          <input
                                            value={envForm.admin_login_url}
                                            onChange={(e) => updateEnvField('admin_login_url', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Tester Login URL</label>
                                        <input
                                          value={envForm.tester_login_url}
                                          onChange={(e) => updateEnvField('tester_login_url', e.target.value)}
                                          className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                        />
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Version</label>
                                          <input
                                            value={envForm.version}
                                            onChange={(e) => updateEnvField('version', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Git Branch</label>
                                          <input
                                            value={envForm.git_branch}
                                            onChange={(e) => updateEnvField('git_branch', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Current Build</label>
                                          <input
                                            value={envForm.current_build}
                                            onChange={(e) => updateEnvField('current_build', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Release Candidate</label>
                                          <input
                                            value={envForm.release_candidate}
                                            onChange={(e) => updateEnvField('release_candidate', e.target.value)}
                                            className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors"
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1">Notes</label>
                                        <textarea
                                          value={envForm.environment_notes}
                                          onChange={(e) => updateEnvField('environment_notes', e.target.value)}
                                          rows={2}
                                          maxLength={500}
                                          className="w-full bg-background-100 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-xs text-foreground-100 outline-none transition-colors resize-none"
                                        />
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => updateEnvField('is_active', !envForm.is_active)}
                                          className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${
                                            envForm.is_active ? 'bg-emerald-500' : 'bg-foreground-600'
                                          }`}
                                        >
                                          <span
                                            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                                              envForm.is_active ? 'left-[15px]' : 'left-0.5'
                                            }`}
                                          ></span>
                                        </button>
                                        <span className="text-xs text-foreground-300">{envForm.is_active ? 'Active' : 'Inactive'}</span>
                                      </div>

                                      <div className="flex items-center justify-end gap-3 pt-1">
                                        <button
                                          onClick={cancelEditEnv}
                                          className="text-xs text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={saveEnv}
                                          disabled={savingEnv}
                                          className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                                        >
                                          {savingEnv ? 'Saving...' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={env.id} className="flex items-center justify-between bg-background-50 rounded-md px-3 py-2 group">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${env.is_active ? 'bg-emerald-400' : 'bg-foreground-500'}`}></span>
                                      <span className="text-xs font-medium text-foreground-200 truncate">{env.environment_name}</span>
                                      <span className="text-[10px] text-foreground-500 bg-background-200/50 px-1.5 py-0.5 rounded">{env.type}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[10px] text-foreground-500 hidden sm:inline mr-2">
                                        {env.version ? `v${env.version}` : ''}{env.version && env.current_build ? ' · ' : ''}{env.current_build || ''}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); startEditEnv(env); }}
                                        className="p-1 rounded-md hover:bg-background-200/60 text-foreground-600 hover:text-foreground-300 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                        title="Edit environment"
                                      >
                                        <i className="ri-pencil-line w-3 h-3 flex items-center justify-center"></i>
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteEnv(env.id); }}
                                        className="p-1 rounded-md hover:bg-red-500/10 text-foreground-600 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                        title="Delete environment"
                                      >
                                        <i className="ri-delete-bin-line w-3 h-3 flex items-center justify-center"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnvModalProjectId(p.id);
                          }}
                          className="flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-add-line w-3.5 h-3.5 flex items-center justify-center"></i>
                          Add Environment
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <UatProjectFormModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />

      {envModalProjectId && (
        <UatEnvironmentFormModal
          open={true}
          onClose={() => setEnvModalProjectId(null)}
          onCreated={handleCreated}
          projectId={envModalProjectId}
          projectName={projects.find((p) => p.id === envModalProjectId)?.name || ''}
        />
      )}
    </div>
  );
}