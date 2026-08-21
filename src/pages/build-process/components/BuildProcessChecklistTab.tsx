import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildRun, BuildRunItem, BuildTemplate, BuildTemplateItem, Project } from '../types';
import { PHASE_LABELS, PHASE_COLORS, STATUS_COLORS, STATUS_DOT_COLORS, APP_TYPE_LABELS } from '../types';

interface Props {
  runs: BuildRun[];
  projects: Project[];
  templates: BuildTemplate[];
  onRefresh: () => void;
  getProjectName: (id: number | null) => string;
}

export default function BuildProcessChecklistTab({ runs, projects, templates, onRefresh, getProjectName }: Props) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runItems, setRunItems] = useState<BuildRunItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [itemDrawer, setItemDrawer] = useState<BuildRunItem | null>(null);
  const [searchItems, setSearchItems] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOwner, setFilterOwner] = useState('all');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (selectedRunId) {
      loadRunItems(selectedRunId);
      setExpandedStages(new Set());
    }
  }, [selectedRunId]);

  const loadRunItems = async (runId: number) => {
    setLoadingItems(true);
    try {
      const { data } = await supabase
        .from('internal_build_process_run_items')
        .select('*')
        .eq('run_id', runId)
        .order('item_order');
      setRunItems(data ?? []);
    } catch { /* ignore */ }
    finally { setLoadingItems(false); }
  };

  const handleToggleItem = async (item: BuildRunItem) => {
    const newChecked = !item.checked;
    await supabase.from('internal_build_process_run_items').update({
      checked: newChecked,
      status: newChecked ? 'done' : 'not_started',
      checked_at: newChecked ? new Date().toISOString() : null,
    }).eq('id', item.id);

    setRunItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: newChecked, status: newChecked ? 'done' : 'not_started', checked_at: newChecked ? new Date().toISOString() : null } : i))
    );

    await recalcRunProgress(item.run_id);
    onRefresh();
  };

  const handleStatusChange = async (item: BuildRunItem, newStatus: string) => {
    const newChecked = newStatus === 'done';
    await supabase.from('internal_build_process_run_items').update({
      status: newStatus,
      checked: newChecked,
      checked_at: newChecked ? new Date().toISOString() : null,
    }).eq('id', item.id);

    setRunItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus as any, checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null } : i))
    );
    await recalcRunProgress(item.run_id);
    onRefresh();
  };

  const recalcRunProgress = async (runId: number) => {
    const { data: items } = await supabase.from('internal_build_process_run_items').select('checked,status,is_required,is_launch_blocker,phase').eq('run_id', runId);
    if (!items) return;
    const total = items.length;
    const done = items.filter((i) => i.checked).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    // Calculate readiness score
    let score = progress;
    const launchBlockers = items.filter((i) => i.is_launch_blocker && !i.checked).length;
    const blockedRequired = items.filter((i) => i.is_required && i.status === 'blocked').length;
    score -= launchBlockers * 10;
    score -= blockedRequired * 5;
    score = Math.max(0, Math.min(100, score));

    // Determine current phase
    const conceptionDone = items.filter((i) => i.phase === 'conception' && i.checked).length;
    const developmentDone = items.filter((i) => i.phase === 'development' && i.checked).length;
    let currentPhase = 'conception';
    if (conceptionDone >= items.filter((i) => i.phase === 'conception').length * 0.8) currentPhase = 'development';
    if (developmentDone >= items.filter((i) => i.phase === 'development').length * 0.8) currentPhase = 'deployment';

    await supabase.from('internal_build_process_runs').update({
      progress_percent: progress,
      launch_readiness_score: score,
      current_phase: currentPhase,
    }).eq('id', runId);
  };

  const handleSaveItemNotes = async () => {
    if (!itemDrawer) return;
    await supabase.from('internal_build_process_run_items').update({
      notes: itemDrawer.notes,
      blocker_notes: itemDrawer.blocker_notes,
      owner: itemDrawer.owner,
      due_date: itemDrawer.due_date,
    }).eq('id', itemDrawer.id);
    setRunItems((prev) => prev.map((i) => (i.id === itemDrawer.id ? { ...itemDrawer } : i)));
    setItemDrawer(null);
    onRefresh();
  };

  const handleCopyPrompt = (item: BuildRunItem) => {
    const run = runs.find((r) => r.id === item.run_id);
    const projectName = getProjectName(run?.project_id ?? null);
    const prompt = `Update the Digital Footprint project for ${projectName}. Work on build process item: ${item.item_title}. This belongs to phase ${item.phase}, stage ${item.stage_number} ${item.stage_title}. Current notes: ${item.notes || 'None'}. Blockers: ${item.blocker_notes || 'None'}. Make the required UI/database/code changes and keep the existing style consistent.`;
    navigator.clipboard.writeText(prompt);
    setToast('Prompt copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  const stageGroups = () => {
    const groups: Record<number, { stage_number: number; stage_title: string; phase: string; items: BuildRunItem[] }> = {};
    let filtered = runItems;

    if (searchItems) {
      const q = searchItems.toLowerCase();
      filtered = filtered.filter((i) => i.item_title.toLowerCase().includes(q));
    }
    if (filterPhase !== 'all') filtered = filtered.filter((i) => i.phase === filterPhase);
    if (filterStatus !== 'all') filtered = filtered.filter((i) => i.status === filterStatus);
    if (filterOwner !== 'all') filtered = filtered.filter((i) => i.owner === filterOwner);

    filtered.forEach((item) => {
      const key = item.stage_number;
      if (!groups[key]) groups[key] = { stage_number: item.stage_number, stage_title: item.stage_title, phase: item.phase, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.stage_number - b.stage_number);
  };

  const uniqueOwners = [...new Set(runItems.map((i) => i.owner).filter(Boolean))] as string[];

  const toggleStage = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const phaseGroups = () => {
    const stages = stageGroups();
    return {
      conception: stages.filter((s) => s.phase === 'conception'),
      development: stages.filter((s) => s.phase === 'development'),
      deployment: stages.filter((s) => s.phase === 'deployment'),
    };
  };

  return (
    <div className="space-y-4">
      {/* Checklist Selector */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <select
          value={selectedRunId ?? ''}
          onChange={(e) => setSelectedRunId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
        >
          <option value="">Select a checklist to view...</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.run_name} — {getProjectName(run.project_id)} ({run.progress_percent}%)
            </option>
          ))}
        </select>
      </div>

      {selectedRun && selectedRunId && (
        <>
          {/* Run Info Bar */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-xs text-foreground-500">Project</span>
              <p className="text-sm font-medium text-foreground-100">{getProjectName(selectedRun.project_id)}</p>
            </div>
            <div>
              <span className="text-xs text-foreground-500">Type</span>
              <p className="text-sm font-medium text-foreground-100">{APP_TYPE_LABELS[selectedRun.app_type] || selectedRun.app_type}</p>
            </div>
            <div>
              <span className="text-xs text-foreground-500">Owner</span>
              <p className="text-sm font-medium text-foreground-100">{selectedRun.owner || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-foreground-500">Due Date</span>
              <p className="text-sm font-medium text-foreground-100">{selectedRun.due_date ? new Date(selectedRun.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
            </div>
            <div className="ml-auto">
              <span className="text-xs text-foreground-500">Readiness</span>
              <p className={`text-sm font-bold ${selectedRun.launch_readiness_score >= 90 ? 'text-emerald-400' : selectedRun.launch_readiness_score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                {selectedRun.launch_readiness_score}/100
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px] relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 text-sm w-4 h-4 flex items-center justify-center"></i>
                <input type="text" value={searchItems} onChange={(e) => setSearchItems(e.target.value)} placeholder="Search checklist items..." className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
              </div>
              <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
                <option value="all">All Phases</option>
                <option value="conception">Conception</option>
                <option value="development">Development</option>
                <option value="deployment">Deployment</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
                <option value="skipped">Skipped</option>
              </select>
              <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
                <option value="all">All Owners</option>
                {uniqueOwners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Checklist Detail */}
          {loadingItems ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse space-y-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-background-200/40 rounded"></div>)}
            </div>
          ) : runItems.length === 0 ? (
            <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-12 text-center">
              <p className="text-sm text-foreground-500">No checklist items found. This checklist may need to be initialized from a template.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(['conception', 'development', 'deployment'] as const).map((phase) => {
                const pStages = phaseGroups()[phase];
                if (pStages.length === 0) return null;
                const phaseTotal = pStages.reduce((s, st) => s + st.items.length, 0);
                const phaseDone = pStages.reduce((s, st) => s + st.items.filter((i) => i.checked).length, 0);
                const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

                return (
                  <div key={phase} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PHASE_COLORS[phase]}`}>
                        <i className={`${phase === 'conception' ? 'ri-lightbulb-line' : phase === 'development' ? 'ri-code-s-slash-line' : 'ri-rocket-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
                      </div>
                      <div>
                        <h4 className="text-sm font-heading font-semibold text-foreground-100">{PHASE_LABELS[phase]}</h4>
                        <p className="text-xs text-foreground-500">{pStages.length} stages &middot; {phaseDone}/{phaseTotal} done</p>
                      </div>
                      <div className="ml-auto text-right">
                        <span className="text-sm font-bold text-foreground-100">{phasePct}%</span>
                      </div>
                    </div>

                    <div className="divide-y divide-background-200/40">
                      {pStages.map((stage) => {
                        const stageKey = `${phase}-${stage.stage_number}`;
                        const isOpen = expandedStages.has(stageKey);
                        const stageDone = stage.items.filter((i) => i.checked).length;
                        const stageTotal = stage.items.length;

                        return (
                          <div key={stageKey}>
                            <button
                              onClick={() => toggleStage(stageKey)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-background-50/50 transition-colors cursor-pointer text-left"
                            >
                              <i className={`ri-arrow-right-s-line text-foreground-500 transition-transform duration-200 text-sm w-4 h-4 flex items-center justify-center ${isOpen ? 'rotate-90' : ''}`}></i>
                              <span className="text-sm font-medium text-foreground-200 flex-1">Stage {stage.stage_number}: {stage.stage_title}</span>
                              <span className="text-xs text-foreground-500">{stageDone}/{stageTotal}</span>
                              <div className="w-20 h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                                <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${stageTotal > 0 ? Math.round((stageDone / stageTotal) * 100) : 0}%` }}></div>
                              </div>
                            </button>

                            {isOpen && (
                              <div className="px-4 pb-3 space-y-1">
                                {stage.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-background-50/70 transition-colors group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={item.checked}
                                      onChange={() => handleToggleItem(item)}
                                      className="w-4 h-4 rounded border-background-300/60 accent-accent-500 cursor-pointer shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <span className={`text-sm ${item.checked ? 'text-foreground-500 line-through' : 'text-foreground-200'}`}>
                                        {item.item_title}
                                      </span>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {item.is_required && (
                                          <span className="text-[9px] font-label bg-primary-500/10 text-primary-400 rounded px-1 py-0.5 whitespace-nowrap">REQUIRED</span>
                                        )}
                                        {item.is_launch_blocker && (
                                          <span className="text-[9px] font-label bg-red-500/10 text-red-400 rounded px-1 py-0.5 whitespace-nowrap">LAUNCH BLOCKER</span>
                                        )}
                                        {item.owner && (
                                          <span className="text-[10px] text-foreground-600 whitespace-nowrap">{item.owner}</span>
                                        )}
                                        {item.due_date && (
                                          <span className={`text-[10px] whitespace-nowrap ${new Date(item.due_date) < new Date() && !item.checked ? 'text-red-400' : 'text-foreground-600'}`}>
                                            {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <select
                                      value={item.status}
                                      onChange={(e) => handleStatusChange(item, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[10px] bg-background-50 border border-background-300/40 rounded px-1.5 py-1 text-foreground-300 outline-none cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <option value="not_started">Not Started</option>
                                      <option value="in_progress">In Progress</option>
                                      <option value="blocked">Blocked</option>
                                      <option value="done">Done</option>
                                      <option value="skipped">Skipped</option>
                                    </select>

                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setItemDrawer(item)}
                                        className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
                                        title="Notes"
                                      >
                                        <i className="ri-sticky-note-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
                                      </button>
                                      <button
                                        onClick={() => handleCopyPrompt(item)}
                                        className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer"
                                        title="Copy Readdy Prompt"
                                      >
                                        <i className="ri-file-copy-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
                                      </button>
                                    </div>
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
        </>
      )}

      {/* Item Drawer Modal */}
      {itemDrawer && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setItemDrawer(null)}></div>
          <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-xl w-full max-w-lg shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] z-10 max-h-[80vh] overflow-y-auto">
            <div className="p-5 border-b border-background-400/60 flex items-center justify-between">
              <h3 className="text-sm font-heading font-semibold text-foreground-100">Item Details</h3>
              <button onClick={() => setItemDrawer(null)} className="text-foreground-500 hover:text-foreground-200 cursor-pointer">
                <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="text-xs text-foreground-500">Title</span>
                <p className="text-sm text-foreground-100 mt-0.5">{itemDrawer.item_title}</p>
              </div>
              {itemDrawer.item_description && (
                <div>
                  <span className="text-xs text-foreground-500">Description</span>
                  <p className="text-sm text-foreground-300 mt-0.5">{itemDrawer.item_description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-foreground-500">Owner</span>
                  <input
                    type="text"
                    value={itemDrawer.owner || ''}
                    onChange={(e) => setItemDrawer({ ...itemDrawer, owner: e.target.value })}
                    placeholder="Assign owner..."
                    className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-md px-3 py-1.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40"
                  />
                </div>
                <div>
                  <span className="text-xs text-foreground-500">Due Date</span>
                  <input
                    type="date"
                    value={itemDrawer.due_date || ''}
                    onChange={(e) => setItemDrawer({ ...itemDrawer, due_date: e.target.value || null })}
                    className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-md px-3 py-1.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <span className="text-xs text-foreground-500">Notes</span>
                <textarea
                  value={itemDrawer.notes || ''}
                  onChange={(e) => setItemDrawer({ ...itemDrawer, notes: e.target.value })}
                  placeholder="Add notes..."
                  rows={3}
                  maxLength={500}
                  className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-md px-3 py-1.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 resize-none"
                ></textarea>
              </div>
              <div>
                <span className="text-xs text-foreground-500">Blocker Notes</span>
                <textarea
                  value={itemDrawer.blocker_notes || ''}
                  onChange={(e) => setItemDrawer({ ...itemDrawer, blocker_notes: e.target.value })}
                  placeholder="Describe what is blocking this item..."
                  rows={2}
                  maxLength={500}
                  className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-md px-3 py-1.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 resize-none"
                ></textarea>
              </div>
              <button
                onClick={handleSaveItemNotes}
                className="w-full bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Save Changes
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