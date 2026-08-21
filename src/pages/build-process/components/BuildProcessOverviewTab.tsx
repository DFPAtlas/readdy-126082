import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildRun, BuildRunItem, Project } from '../types';
import { PHASE_LABELS, PHASE_COLORS, STATUS_COLORS, STATUS_DOT_COLORS } from '../types';

interface Props {
  runs: BuildRun[];
  projects: Project[];
  onRefresh: () => void;
  getProjectName: (id: number | null) => string;
}

interface RunItemWithNotes extends BuildRunItem {
  run_name?: string;
  project_name?: string;
}

export default function BuildProcessOverviewTab({ runs, projects, onRefresh, getProjectName }: Props) {
  const [recentCompleted, setRecentCompleted] = useState<RunItemWithNotes[]>([]);
  const [blockedItems, setBlockedItems] = useState<RunItemWithNotes[]>([]);
  const [nextActions, setNextActions] = useState<RunItemWithNotes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubData();
  }, [runs]);

  const loadSubData = async () => {
    const activeRuns = runs.filter((r) => r.run_status === 'active');
    if (activeRuns.length === 0) { setLoading(false); return; }

    try {
      const runIds = activeRuns.map((r) => r.id);

      const [{ data: completed }, { data: blocked }, { data: next }] = await Promise.all([
        supabase.from('internal_build_process_run_items').select('*').in('run_id', runIds).eq('checked', true).order('checked_at', { ascending: false }).limit(8),
        supabase.from('internal_build_process_run_items').select('*').in('run_id', runIds).eq('status', 'blocked').order('updated_at', { ascending: false }).limit(8),
        supabase.from('internal_build_process_run_items').select('*').in('run_id', runIds).eq('is_required', true).eq('checked', false).order('item_order').limit(5),
      ]);

      const enrich = (items: BuildRunItem[]): RunItemWithNotes[] =>
        items.map((item) => {
          const run = activeRuns.find((r) => r.id === item.run_id);
          return { ...item, run_name: run?.run_name, project_name: getProjectName(run?.project_id ?? null) };
        });

      setRecentCompleted(enrich(completed ?? []));
      setBlockedItems(enrich(blocked ?? []));
      setNextActions(enrich(next ?? []));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleToggleItem = async (item: BuildRunItem) => {
    const newChecked = !item.checked;
    await supabase.from('internal_build_process_run_items').update({
      checked: newChecked,
      status: newChecked ? 'done' : 'not_started',
      checked_at: newChecked ? new Date().toISOString() : null,
    }).eq('id', item.id);
    onRefresh();
  };

  const activeRuns = runs.filter((r) => r.run_status === 'active');

  return (
    <div className="space-y-6">
      {/* Active Checklists Overview */}
      <div className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Active Project Checklists</h3>
        {activeRuns.length === 0 ? (
          <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-list-check-2 text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
            </div>
            <p className="text-sm text-foreground-500">No active checklists. Create one to start tracking your build process.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRuns.map((run) => {
              const progressPct = run.total_items > 0 ? Math.round((run.completed_items / run.total_items) * 100) : 0;
              const totalItems = run.total_items || 0;
              const doneItems = run.completed_items || 0;
              const readiness = progressPct;

              return (
                <div key={run.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-accent-500/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-heading font-semibold text-foreground-100 truncate">{run.run_name}</h4>
                      <p className="text-xs text-foreground-500 mt-0.5">{getProjectName(run.project_id)}</p>
                    </div>
                    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${run.run_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-foreground-500/10 text-foreground-400'}`}>
                      {run.run_status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground-500">Progress</span>
                      <span className="text-foreground-200 font-medium">{progressPct}%</span>
                    </div>
                    <div className="h-2 bg-background-200/60 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
                    </div>
                  </div>

                  {/* Phase bars */}
                  <div className="space-y-1.5 mb-3">
                    {(['conception', 'development', 'deployment'] as const).map((phase, i) => {
                      const phasePct = i === 0 ? (progressPct > 0 ? 100 : 0) : i === 1 ? (progressPct > 33 ? 100 : Math.max(0, Math.round((progressPct - 1) * 3))) : Math.max(0, Math.round((progressPct - 66) * 3));
                      return (
                        <div key={phase} className="flex items-center gap-2">
                          <span className={`text-[10px] font-label ${PHASE_COLORS[phase]} px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap`}>
                            {PHASE_LABELS[phase].charAt(0)}
                          </span>
                          <div className="flex-1 h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-300 ${phase === 'conception' ? 'bg-sky-400' : phase === 'development' ? 'bg-accent-400' : 'bg-emerald-400'}`} style={{ width: `${phasePct}%` }}></div>
                          </div>
                          <span className="text-[10px] text-foreground-600 w-8 text-right">{phasePct}%</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-foreground-500 border-t border-background-200/60 pt-3">
                    <span>{doneItems} done</span>
                    <span>Score: {readiness}</span>
                    {run.due_date && <span className="ml-auto whitespace-nowrap">Due {new Date(run.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recently Completed */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Recently Completed</h3>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-background-200/40 rounded"></div>)}
            </div>
          ) : recentCompleted.length === 0 ? (
            <p className="text-sm text-foreground-500">No items completed yet.</p>
          ) : (
            <div className="space-y-1">
              {recentCompleted.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-background-200/40 last:border-0">
                  <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-200 line-clamp-1">{item.item_title}</p>
                    <p className="text-[10px] text-foreground-600 mt-0.5">{item.run_name || item.project_name} &middot; {formatDate(item.completed_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked Tasks */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Blocked Tasks</h3>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-background-200/40 rounded"></div>)}
            </div>
          ) : blockedItems.length === 0 ? (
            <p className="text-sm text-foreground-500">No blocked tasks — great!</p>
          ) : (
            <div className="space-y-1">
              {blockedItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-background-200/40 last:border-0">
                  <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-red-400 shrink-0"></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-200 line-clamp-1">{item.item_title}</p>
                    {item.blocker_notes && <p className="text-xs text-red-400 mt-0.5 line-clamp-1">{item.blocker_notes}</p>}
                    <p className="text-[10px] text-foreground-600 mt-0.5">{item.run_name || item.project_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Next Actions */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Next Recommended Actions</h3>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-background-200/40 rounded"></div>)}
          </div>
        ) : nextActions.length === 0 ? (
          <p className="text-sm text-foreground-500">All required items are complete!</p>
        ) : (
          <div className="space-y-2">
            {nextActions.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-background-50 rounded-lg border border-background-200/40">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleItem(item)}
                  className="w-4 h-4 rounded border-background-300/60 accent-accent-500 cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground-200">{item.item_title}</p>
                  <p className="text-[10px] text-foreground-600 mt-0.5">
                    {PHASE_LABELS[item.phase]} &middot; Stage {item.stage_number} &middot; {item.run_name || item.project_name}
                    {item.is_launch_blocker && <span className="ml-1.5 text-red-400 font-medium">LAUNCH BLOCKER</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}