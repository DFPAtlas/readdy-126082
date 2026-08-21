import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildTemplate, BuildTemplateItem, Project, BuildRun } from '../types';
import { PHASE_LABELS, PHASE_COLORS, APP_TYPE_LABELS } from '../types';

interface Props {
  templates: BuildTemplate[];
  projects: Project[];
  onRefresh: () => void;
  getProjectName: (id: number | null) => string;
}

export default function BuildProcessTemplatesTab({ templates, projects, onRefresh, getProjectName }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateItems, setTemplateItems] = useState<BuildTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createProjectId, setCreateProjectId] = useState('');

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateItems(selectedTemplateId);
      setExpandedStages(new Set());
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates]);

  const loadTemplateItems = async (id: number) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('internal_build_process_template_items')
        .select('*')
        .eq('template_id', id)
        .order('item_order');
      setTemplateItems(data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const stageGroups = () => {
    const groups: Record<number, { stage_number: number; stage_title: string; phase: string; items: BuildTemplateItem[] }> = {};
    templateItems.forEach((item) => {
      const key = item.stage_number;
      if (!groups[key]) groups[key] = { stage_number: item.stage_number, stage_title: item.stage_title, phase: item.phase, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.stage_number - b.stage_number);
  };

  const phaseGroups = () => {
    const stages = stageGroups();
    return {
      conception: stages.filter((s) => s.phase === 'conception'),
      development: stages.filter((s) => s.phase === 'development'),
      deployment: stages.filter((s) => s.phase === 'deployment'),
    };
  };

  const toggleStage = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const totalItems = templateItems.length;
  const requiredItems = templateItems.filter((i) => i.is_required).length;
  const launchBlockers = templateItems.filter((i) => i.is_launch_blocker).length;

  const handleCreateChecklist = async () => {
    if (!selectedTemplateId || !createProjectId) return;

    const project = projects.find((p) => String(p.id) === createProjectId);
    if (!project) return;

    // Create run
    const { data: run, error: runError } = await supabase
      .from('internal_build_process_runs')
      .insert({
        project_id: project.id,
        template_id: selectedTemplateId,
        run_name: `${project.project_name} Build`,
        app_type: selectedTemplate?.template_type ?? 'full_saas',
        run_status: 'active',
        progress_percent: 0,
        launch_readiness_score: 0,
      })
      .select('id')
      .single();

    if (runError || !run) {
      setToast('Failed to create checklist.');
      setTimeout(() => setToast(''), 3000);
      return;
    }

    // Clone template items
    const runItems = templateItems.map((item) => ({
      run_id: run.id,
      template_item_id: item.id,
      phase: item.phase,
      stage_number: item.stage_number,
      stage_title: item.stage_title,
      item_order: item.item_order,
      item_title: item.item_title,
      item_description: item.item_description,
      status: 'not_started',
      checked: false,
      is_required: item.is_required,
      is_launch_blocker: item.is_launch_blocker,
    }));

    await supabase.from('internal_build_process_run_items').insert(runItems);

    setShowCreateDialog(false);
    setCreateProjectId('');
    setToast(`Checklist created for ${project.project_name}!`);
    setTimeout(() => setToast(''), 3000);
    onRefresh();
  };

  const handleCopyPhase = (phase: string) => {
    const stages = phaseGroups()[phase as keyof ReturnType<typeof phaseGroups>];
    if (!stages || stages.length === 0) return;
    const text = stages.map((s) =>
      `Stage ${s.stage_number}: ${s.stage_title}\n` +
      s.items.map((i) => `  - [ ] ${i.item_title}${i.is_launch_blocker ? ' (LAUNCH BLOCKER)' : ''}`).join('\n')
    ).join('\n\n');
    navigator.clipboard.writeText(text);
    setToast('Phase copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  const handleCopyAll = () => {
    const stages = stageGroups();
    const text = stages.map((s) =>
      `Stage ${s.stage_number}: ${s.stage_title} [${s.phase}]\n` +
      s.items.map((i) => `  - [ ] ${i.item_title}${i.is_launch_blocker ? ' (LAUNCH BLOCKER)' : ''}${i.is_required ? '' : ' (optional)'}`).join('\n')
    ).join('\n\n');
    navigator.clipboard.writeText(text);
    setToast('Full template copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <select
          value={selectedTemplateId ?? ''}
          onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
          className="flex-1 min-w-[200px] bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.template_name} ({APP_TYPE_LABELS[t.template_type] || t.template_type})</option>
          ))}
        </select>
        <button
          onClick={handleCopyAll}
          className="text-sm text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
        >
          <i className="ri-file-copy-line w-4 h-4 flex items-center justify-center"></i> Copy All
        </button>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold px-4 py-2 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
        >
          <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i> Create Checklist
        </button>
      </div>

      {/* Template Info */}
      {selectedTemplate && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-xs text-foreground-500">Total Items</span>
            <p className="text-sm font-bold text-foreground-100">{totalItems}</p>
          </div>
          <div>
            <span className="text-xs text-foreground-500">Required</span>
            <p className="text-sm font-bold text-primary-400">{requiredItems}</p>
          </div>
          <div>
            <span className="text-xs text-foreground-500">Launch Blockers</span>
            <p className="text-sm font-bold text-red-400">{launchBlockers}</p>
          </div>
          <div>
            <span className="text-xs text-foreground-500">Stages</span>
            <p className="text-sm font-bold text-foreground-100">25</p>
          </div>
          <div>
            <span className="text-xs text-foreground-500">Phases</span>
            <p className="text-sm font-bold text-foreground-100">3 (CDD)</p>
          </div>
        </div>
      )}

      {/* Template Detail */}
      {loading ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse space-y-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-background-200/40 rounded"></div>)}
        </div>
      ) : (
        <div className="space-y-4">
          {(['conception', 'development', 'deployment'] as const).map((phase) => {
            const pStages = phaseGroups()[phase];
            if (pStages.length === 0) return null;

            return (
              <div key={phase} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PHASE_COLORS[phase]}`}>
                    <i className={`${phase === 'conception' ? 'ri-lightbulb-line' : phase === 'development' ? 'ri-code-s-slash-line' : 'ri-rocket-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-heading font-semibold text-foreground-100">{PHASE_LABELS[phase]}</h4>
                    <p className="text-xs text-foreground-500">{pStages.length} stages</p>
                  </div>
                  <button
                    onClick={() => handleCopyPhase(phase)}
                    className="ml-auto text-xs text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                  >
                    <i className="ri-file-copy-line w-3.5 h-3.5 flex items-center justify-center"></i> Copy Phase
                  </button>
                </div>

                <div className="divide-y divide-background-200/40">
                  {pStages.map((stage) => {
                    const stageKey = `${phase}-${stage.stage_number}`;
                    const isOpen = expandedStages.has(stageKey);
                    const blockers = stage.items.filter((i) => i.is_launch_blocker).length;

                    return (
                      <div key={stageKey}>
                        <button
                          onClick={() => toggleStage(stageKey)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-background-50/50 transition-colors cursor-pointer text-left"
                        >
                          <i className={`ri-arrow-right-s-line text-foreground-500 transition-transform duration-200 text-sm w-4 h-4 flex items-center justify-center ${isOpen ? 'rotate-90' : ''}`}></i>
                          <span className="text-sm font-medium text-foreground-200 flex-1">Stage {stage.stage_number}: {stage.stage_title}</span>
                          <span className="text-xs text-foreground-500">{stage.items.length} items</span>
                          {blockers > 0 && <span className="text-[10px] text-red-400">{blockers} blockers</span>}
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-3 space-y-0.5">
                            {stage.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2.5 py-1 px-2 rounded-md">
                                <div className="w-4 h-4 rounded border border-background-300/60 shrink-0"></div>
                                <span className="text-sm text-foreground-300 flex-1">{item.item_title}</span>
                                {item.is_launch_blocker && (
                                  <span className="text-[9px] font-label bg-red-500/10 text-red-400 rounded px-1 py-0.5 whitespace-nowrap">BLOCKER</span>
                                )}
                                {!item.is_required && (
                                  <span className="text-[9px] font-label bg-foreground-500/10 text-foreground-500 rounded px-1 py-0.5 whitespace-nowrap">OPT</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Checklist Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreateDialog(false)}></div>
          <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-xl w-full max-w-md shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] z-10">
            <div className="p-5 border-b border-background-400/60 flex items-center justify-between">
              <h3 className="text-sm font-heading font-semibold text-foreground-100">Create New Checklist</h3>
              <button onClick={() => setShowCreateDialog(false)} className="text-foreground-500 hover:text-foreground-200 cursor-pointer">
                <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="text-xs text-foreground-500">Template</span>
                <p className="text-sm text-foreground-100 mt-0.5">{selectedTemplate?.template_name}</p>
              </div>
              <div>
                <span className="text-xs text-foreground-500">Select Project</span>
                <select
                  value={createProjectId}
                  onChange={(e) => setCreateProjectId(e.target.value)}
                  className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 cursor-pointer"
                >
                  <option value="">Choose a project...</option>
                  {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
                </select>
              </div>
              <button
                onClick={handleCreateChecklist}
                disabled={!createProjectId}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  createProjectId ? 'bg-accent-500 hover:bg-accent-400 text-background-950' : 'bg-background-200/40 text-foreground-600 cursor-not-allowed'
                }`}
              >
                Create Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-lg px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.75)]">
          <p className="text-sm text-foreground-100">{toast}</p>
        </div>
      )}
    </div>
  );
}