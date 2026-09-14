import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { APP_TYPE_LABELS } from '@/pages/build-process/types';
import type { BuildTemplate } from '@/pages/build-process/types';
import BuildProcessRunModal from '@/pages/build-process/components/BuildProcessRunModal';
import type { Project } from '../types';
import { formatDate } from '../utils';
import type { ProjectBuildData } from '../useProjectBuild';
import BuildChecklist from './BuildChecklist';
import {
  READINESS_STATE_COLORS,
  buildNextWorkPrompt,
  computeReadiness,
  countOpenBlockers,
  currentWorkItem,
  overdueItems,
  phaseLabel,
  progressPercent,
  runTargetOverdue,
} from '../buildUtils';

interface BuildSectionProps {
  project: Project;
  build: ProjectBuildData;
}

export default function BuildSection({ project, build }: BuildSectionProps) {
  const [viewingRunId, setViewingRunId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<BuildTemplate[]>([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [toast, setToast] = useState('');

  const activeRun = build.activeRun;
  const viewingRun = viewingRunId != null ? build.runs.find((r) => r.id === viewingRunId) ?? activeRun : activeRun;
  const viewingItems = viewingRun ? (build.itemsByRun[viewingRun.id] ?? []) : [];
  const viewingReadiness = viewingRun ? computeReadiness(viewingItems) : null;

  const activeItems = activeRun ? (build.itemsByRun[activeRun.id] ?? []) : [];
  const activeReadiness = activeRun ? computeReadiness(activeItems) : null;
  const activeWorkItem = activeRun ? currentWorkItem(activeItems) : null;

  const historyRuns = build.runs.filter((r) => r.id !== activeRun?.id);
  const isViewingHistory = viewingRun != null && activeRun != null && viewingRun.id !== activeRun.id;

  useEffect(() => {
    const loadTemplates = async () => {
      const { data } = await supabase
        .from('internal_build_process_templates')
        .select('*')
        .order('created_at');
      setTemplates((data ?? []) as BuildTemplate[]);
    };
    loadTemplates();
  }, []);

  const handleCopyNextPrompt = async () => {
    if (!activeRun || !activeWorkItem) return;
    const prompt = buildNextWorkPrompt(project.project_name, activeWorkItem);
    await navigator.clipboard.writeText(prompt);
    setToast('Next work prompt copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  const hasItemDeadlines = activeItems.some((i) => i.due_date);
  const overdue = overdueItems(activeItems);

  // ─── Summary cards (always reflect the ACTIVE run) ────────────────────────
  const summaryCards: { label: string; value: string; icon: string; tone: string }[] = [
    {
      label: 'Build Status',
      value: activeRun
        ? activeRun.run_status === 'active'
          ? 'In Progress'
          : activeRun.run_status === 'completed'
          ? 'Completed'
          : activeRun.run_status
        : 'Not Started',
      icon: 'ri-hammer-line',
      tone: activeRun ? 'bg-accent-500/10 text-accent-400' : 'bg-foreground-500/10 text-foreground-500',
    },
    {
      label: 'Current Phase',
      value: activeWorkItem ? phaseLabel(activeWorkItem.phase) : activeRun?.current_phase ? phaseLabel(activeRun.current_phase) : '—',
      icon: 'ri-stack-line',
      tone: 'bg-secondary-500/10 text-secondary-300',
    },
    {
      label: 'Current Stage',
      value: activeWorkItem ? `Stage ${activeWorkItem.stage_number}` : '—',
      icon: 'ri-flow-chart',
      tone: 'bg-secondary-500/10 text-secondary-300',
    },
    {
      label: 'Checklist Progress',
      value: activeRun ? `${progressPercent(activeRun, activeItems)}%` : '—',
      icon: 'ri-percent-line',
      tone: 'bg-accent-500/10 text-accent-400',
    },
    {
      label: 'Launch Readiness',
      value: activeReadiness ? `${activeReadiness.reqPct}% · ${activeReadiness.state}` : 'No Checklist',
      icon: 'ri-rocket-line',
      tone: activeReadiness ? 'bg-emerald-500/10 text-emerald-400' : 'bg-foreground-500/10 text-foreground-500',
    },
    {
      label: 'Open Blockers',
      value: activeRun ? String(countOpenBlockers(activeItems)) : '—',
      icon: 'ri-forbid-line',
      tone: 'bg-red-500/10 text-red-400',
    },
    {
      label: 'Required Remaining',
      value: activeReadiness ? String(activeReadiness.reqRemaining) : '—',
      icon: 'ri-list-check-3',
      tone: 'bg-primary-500/10 text-primary-400',
    },
    {
      label: 'Overdue Items',
      value: activeRun ? (hasItemDeadlines ? String(overdue.length) : 'No deadline set') : '—',
      icon: 'ri-time-line',
      tone: 'bg-amber-500/10 text-amber-400',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Project Build</h3>
          <p className="text-sm text-foreground-500 mt-1">Build Process status and checklist for {project.project_name}.</p>
        </div>
        <Link
          to="/build-process"
          className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
          Open Global Build Process
        </Link>
      </div>

      {/* Error state — data could not be loaded */}
      {build.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-6 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-red-400 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-100 mb-1">Build data unavailable.</h4>
          <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">The Build Process data could not be loaded for this project.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={build.refresh}
              className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 text-foreground-200 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
            <Link
              to="/build-process"
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              Open Global Build Process
            </Link>
          </div>
        </div>
      )}

      {/* Loading */}
      {!build.error && build.loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-background-50 border border-background-200/60 rounded-lg"></div>
            ))}
          </div>
          <div className="h-40 bg-background-50 border border-background-200/60 rounded-lg"></div>
        </div>
      )}

      {!build.error && !build.loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.tone}`}>
                    <i className={`${card.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                  </div>
                </div>
                <p className="text-lg font-heading font-bold text-foreground-100 truncate">{card.value}</p>
              </div>
            ))}
          </div>

          {/* No active run — empty state */}
          {!activeRun && (
            <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-14 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
                <i className="ri-hammer-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
              </div>
              <h4 className="text-sm font-heading font-semibold text-foreground-200 mb-1">No active build checklist for this project.</h4>
              <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">Start a build checklist to begin tracking phases, stages, blockers and launch readiness.</p>
              <button
                type="button"
                onClick={() => setShowStartModal(true)}
                className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
                Start Build Checklist
              </button>
            </div>
          )}

          {/* Active run + details */}
          {activeRun && (
            <>
              {/* Active build run */}
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-heading font-semibold text-foreground-100">Active Build Run</h4>
                    <span className="text-[10px] font-label px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 whitespace-nowrap">ACTIVE</span>
                  </div>
                  {activeRun.due_date && runTargetOverdue(activeRun) && (
                    <span className="text-[10px] font-label px-2 py-1 rounded bg-red-500/10 text-red-400 whitespace-nowrap flex items-center gap-1">
                      <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
                      Build Target Overdue
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                  <RunField label="Checklist" value={activeRun.run_name} />
                  <RunField label="Application Type" value={APP_TYPE_LABELS[activeRun.app_type ?? ''] ?? activeRun.app_type ?? '—'} />
                  <RunField label="Run Status" value={activeRun.run_status} />
                  <RunField label="Created" value={formatDate(activeRun.created_at)} />
                  <RunField label="Started" value={activeRun.started_at ? formatDate(activeRun.started_at) : '—'} />
                  <RunField label="Target Completion" value={activeRun.due_date ? formatDate(activeRun.due_date) : 'No deadline set'} />
                  <RunField label="Completed / Total" value={`${activeRun.completed_items ?? 0} / ${activeRun.total_items ?? 0}`} />
                  <RunField label="Launch Blockers Remaining" value={String(activeRun.launch_blockers_remaining ?? 0)} />
                  <RunField label="Readiness" value={`${progressPercent(activeRun, activeItems)}%`} />
                </div>

                {/* progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-foreground-500">Checklist Progress</span>
                    <span className="text-foreground-200 font-medium">{progressPercent(activeRun, activeItems)}%</span>
                  </div>
                  <div className="h-2 bg-background-200/60 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent(activeRun, activeItems)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Current Work + Launch Readiness */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Current work */}
                <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Current Work</h4>
                    {activeWorkItem && (
                      <button
                        type="button"
                        onClick={handleCopyNextPrompt}
                        className="flex items-center gap-1.5 text-xs text-foreground-500 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-file-copy-line w-3.5 h-3.5 flex items-center justify-center"></i>
                        Copy Next Work Prompt
                      </button>
                    )}
                  </div>

                  {!activeWorkItem ? (
                    <p className="text-sm text-emerald-400">All required items are complete!</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-label px-2 py-0.5 rounded bg-secondary-500/10 text-secondary-300 whitespace-nowrap">
                          {phaseLabel(activeWorkItem.phase)}
                        </span>
                        <span className="text-[10px] font-label px-2 py-0.5 rounded bg-foreground-500/10 text-foreground-400 whitespace-nowrap">
                          Stage {activeWorkItem.stage_number}: {activeWorkItem.stage_title}
                        </span>
                      </div>
                      <p className="text-sm font-heading font-semibold text-foreground-100">{activeWorkItem.item_title}</p>
                      {activeWorkItem.notes && <p className="text-xs text-foreground-500 leading-relaxed">{activeWorkItem.notes}</p>}
                      {activeWorkItem.blocker_notes && (
                        <div className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                          <p className="text-xs text-red-400 leading-relaxed">
                            <span className="font-semibold">Blocker: </span>
                            {activeWorkItem.blocker_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Launch readiness */}
                <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Launch Readiness</h4>
                  {activeReadiness ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full border-4 border-background-200/60 flex items-center justify-center shrink-0">
                          <span className="text-2xl font-heading font-bold text-foreground-100">{activeReadiness.reqPct}%</span>
                        </div>
                        <div className="min-w-0">
                          <span className={`inline-block text-[11px] font-label px-2.5 py-1 rounded-full border whitespace-nowrap ${READINESS_STATE_COLORS[activeReadiness.state]}`}>
                            {activeReadiness.state}
                          </span>
                          <p className="text-xs text-foreground-500 mt-2">Required items completion</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <ReadinessStat label="Required Complete" value={`${activeReadiness.reqDone} / ${activeReadiness.reqTotal}`} tone="text-emerald-400" />
                        <ReadinessStat label="Required Remaining" value={String(activeReadiness.reqRemaining)} tone="text-foreground-100" />
                        <ReadinessStat label="Launch Blockers" value={String(activeReadiness.launchBlockers)} tone={activeReadiness.launchBlockers > 0 ? 'text-red-400' : 'text-emerald-400'} />
                        <ReadinessStat label="Open Blockers" value={String(countOpenBlockers(activeItems))} tone={countOpenBlockers(activeItems) > 0 ? 'text-red-400' : 'text-emerald-400'} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-500">No checklist.</p>
                  )}
                </div>
              </div>

              {/* Viewing history banner */}
              {isViewingHistory && viewingRun && (
                <div className="flex items-center justify-between gap-3 bg-secondary-500/10 border border-secondary-500/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-foreground-200">
                    Viewing historical run: <span className="font-semibold">{viewingRun.run_name}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewingRunId(null)}
                    className="text-sm text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
                  >
                    Back to active run
                  </button>
                </div>
              )}

              {/* Checklist view */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Checklist</h4>
                  <span className="text-xs text-foreground-500">{viewingRun?.run_name}</span>
                </div>
                <BuildChecklist items={viewingItems} />
              </div>
            </>
          )}

          {/* Build history */}
          {historyRuns.length > 0 && (
            <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Build History</h4>
              <div className="divide-y divide-background-200/40">
                {historyRuns.map((run) => {
                  const runItems = build.itemsByRun[run.id] ?? [];
                  const isSelected = viewingRunId === run.id;
                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setViewingRunId(run.id)}
                      className={`w-full flex items-center gap-4 py-3 text-left transition-colors cursor-pointer ${isSelected ? 'bg-background-100/60' : 'hover:bg-background-100/40'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-accent-500/10 text-accent-400' : 'bg-background-200/60 text-foreground-500'}`}>
                        <i className="ri-history-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground-200 truncate">{run.run_name}</p>
                        <p className="text-xs text-foreground-500">
                          {run.run_status} &middot; Started {run.started_at ? formatDate(run.started_at) : '—'}
                          {run.completed_at ? ` &middot; Completed ${formatDate(run.completed_at)}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground-100">{progressPercent(run, runItems)}%</p>
                        <p className="text-[10px] text-foreground-500">{(run.launch_blockers_remaining ?? 0)} launch blockers</p>
                      </div>
                      <i className="ri-arrow-right-s-line text-foreground-500 w-4 h-4 flex items-center justify-center shrink-0"></i>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Start checklist modal (reuses global run creation) */}
      <BuildProcessRunModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSaved={() => {
          setShowStartModal(false);
          setViewingRunId(null);
          build.refresh();
        }}
        run={null}
        projects={[{ id: project.id, project_name: project.project_name, project_slug: project.project_slug }]}
        templates={templates}
        defaultProjectId={project.id}
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

function RunField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-sm text-foreground-200 truncate">{value}</p>
    </div>
  );
}

function ReadinessStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-2.5">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-bold ${tone}`}>{value}</p>
    </div>
  );
}