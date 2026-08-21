import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildRun, BuildTemplate, Project, BuildRunItem, SummaryStats } from './types';
import { APP_TYPE_LABELS } from './types';
import BuildProcessOverviewTab from './components/BuildProcessOverviewTab';
import BuildProcessChecklistTab from './components/BuildProcessChecklistTab';
import BuildProcessTemplatesTab from './components/BuildProcessTemplatesTab';
import BuildProcessReportsTab from './components/BuildProcessReportsTab';
import BuildProcessLaunchReadinessTab from './components/BuildProcessLaunchReadinessTab';
import BuildProcessRunModal from './components/BuildProcessRunModal';

type TabKey = 'overview' | 'checklists' | 'template' | 'reports' | 'readiness';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ri-dashboard-3-line' },
  { key: 'checklists', label: 'Active Checklists', icon: 'ri-list-check-2' },
  { key: 'template', label: 'Master Template', icon: 'ri-file-list-3-line' },
  { key: 'reports', label: 'Reports', icon: 'ri-bar-chart-2-line' },
  { key: 'readiness', label: 'Launch Readiness', icon: 'ri-rocket-line' },
];

function SkeletonCard() {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
      <div className="h-3 w-16 bg-background-300/40 rounded mb-3"></div>
      <div className="h-7 w-12 bg-background-300/40 rounded"></div>
    </div>
  );
}

export default function BuildProcess() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [runs, setRuns] = useState<BuildRun[]>([]);
  const [templates, setTemplates] = useState<BuildTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<BuildRun | null>(null);
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [runsRes, templatesRes, projectsRes] = await Promise.all([
        supabase.from('internal_build_process_runs').select('*').order('created_at', { ascending: false }),
        supabase.from('internal_build_process_templates').select('*').order('created_at'),
        supabase.from('internal_projects').select('id,project_name,slug').order('project_name'),
      ]);
      if (runsRes.error) throw runsRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      setRuns(runsRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      setProjects(projectsRes.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load build process data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getProjectName = (projectId: number | null) => {
    if (!projectId) return '—';
    return projects.find((p) => p.id === projectId)?.project_name ?? '—';
  };

  const computeStats = (): SummaryStats => {
    const active = runs.filter((r) => r.run_status === 'active');
    let totalTasks = 0;
    let completed = 0;
    let totalBlockers = 0;
    let totalReadiness = 0;
    let readyCount = 0;
    let overdue = 0;

    active.forEach((r) => {
      totalTasks += r.total_items || 0;
      completed += r.completed_items || 0;
      totalBlockers += r.launch_blockers_remaining || 0;
      const readiness = r.total_items > 0 ? Math.round((r.completed_items / r.total_items) * 100) : 0;
      totalReadiness += readiness;
      if (readiness >= 90) readyCount++;
    });

    return {
      activeChecklists: active.length,
      totalTasks,
      completedTasks: completed,
      blockedTasks: 0,
      launchBlockers: totalBlockers,
      averageReadiness: active.length > 0 ? Math.round(totalReadiness / active.length) : 0,
      readyForLaunch: readyCount,
      overdueItems: overdue,
    };
  };

  const handleGenerateNextPrompt = async () => {
    const activeRuns = runs.filter((r) => r.run_status === 'active');
    if (activeRuns.length === 0) {
      setToast('No active checklists found.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    const runId = activeRuns[0].id;
    const { data: items } = await supabase
      .from('internal_build_process_run_items')
      .select('*')
      .eq('run_id', runId)
      .eq('is_required', true)
      .eq('checked', false)
      .order('item_order');

    if (!items || items.length === 0) {
      setToast('All required items are complete!');
      setTimeout(() => setToast(''), 3000);
      return;
    }

    const item = items[0];
    const run = activeRuns[0];
    const projectName = getProjectName(run.project_id);
    const prompt = `Update the Digital Footprint project for ${projectName}. Work on build process item: ${item.item_title}. This belongs to phase ${item.phase}, stage ${item.stage_number} ${item.stage_title}. Current notes: ${item.notes || 'None'}. Blockers: ${item.blocker_notes || 'None'}. Make the required UI/database/code changes and keep the existing style consistent.`;
    await navigator.clipboard.writeText(prompt);
    setToast('Next work prompt copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Web App Build Process</h1>
            <p className="text-sm text-foreground-500 mt-1">Track every Digital Footprint build from idea to launch using the CDD process.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const stats = computeStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Web App Build Process</h1>
          <p className="text-sm text-foreground-500 mt-1">Track every Digital Footprint build from idea to launch using the CDD process.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateNextPrompt}
            className="bg-background-100 border border-background-200/60 hover:border-accent-500/30 text-foreground-200 text-sm font-medium px-4 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-robot-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Generate Next Prompt
          </button>
          <button
            onClick={() => { setEditingRun(null); setModalOpen(true); }}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold px-4 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            New Checklist
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadData} className="text-sm text-red-300 underline mt-1 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      {!error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Active Checklists</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-500/10 text-accent-400">
                <i className="ri-list-check-2 text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">{stats.activeChecklists}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Completed Tasks</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <i className="ri-check-double-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-emerald-400">{stats.completedTasks}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Blocked Tasks</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400">
                <i className="ri-forbid-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-red-400">{stats.blockedTasks}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Launch Blockers</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400">
                <i className="ri-alert-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-red-400">{stats.launchBlockers}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Avg Readiness</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-yellow-500/10 text-yellow-400">
                <i className="ri-speed-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">{stats.averageReadiness}%</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Ready for Launch</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <i className="ri-rocket-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-emerald-400">{stats.readyForLaunch}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Overdue Items</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
                <i className="ri-time-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-amber-400">{stats.overdueItems}</p>
          </div>
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">Total Tasks</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-500/10 text-primary-400">
                <i className="ri-list-check-3 text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">{stats.totalTasks}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-1 flex flex-wrap gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'bg-accent-500/10 text-accent-400'
                : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/50'
            }`}
          >
            <i className={`${tab.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {!error && (
        <>
          {activeTab === 'overview' && (
            <BuildProcessOverviewTab runs={runs} projects={projects} onRefresh={loadData} getProjectName={getProjectName} />
          )}
          {activeTab === 'checklists' && (
            <BuildProcessChecklistTab runs={runs} projects={projects} templates={templates} onRefresh={loadData} getProjectName={getProjectName} />
          )}
          {activeTab === 'template' && (
            <BuildProcessTemplatesTab templates={templates} projects={projects} onRefresh={loadData} getProjectName={getProjectName} />
          )}
          {activeTab === 'reports' && (
            <BuildProcessReportsTab runs={runs} projects={projects} getProjectName={getProjectName} />
          )}
          {activeTab === 'readiness' && (
            <BuildProcessLaunchReadinessTab runs={runs} projects={projects} onRefresh={loadData} getProjectName={getProjectName} />
          )}
        </>
      )}

      <BuildProcessRunModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
        run={editingRun}
        projects={projects}
        templates={templates}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-lg px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.75)] animate-fade-in-up">
          <p className="text-sm text-foreground-100">{toast}</p>
        </div>
      )}
    </div>
  );
}