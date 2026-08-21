import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildRun, BuildRunItem, Project } from '../types';
import { PHASE_LABELS, APP_TYPE_LABELS } from '../types';

interface Props {
  runs: BuildRun[];
  projects: Project[];
  getProjectName: (id: number | null) => string;
}

export default function BuildProcessReportsTab({ runs, projects, getProjectName }: Props) {
  const [reportData, setReportData] = useState<{ runId: number; items: BuildRunItem[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [runs]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const allItems: { runId: number; items: BuildRunItem[] }[] = [];
      for (const run of runs) {
        const { data } = await supabase
          .from('internal_build_process_run_items')
          .select('*')
          .eq('run_id', run.id)
          .order('item_order');
        allItems.push({ runId: run.id, items: data ?? [] });
      }
      setReportData(allItems);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse h-24"></div>
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
          <i className="ri-bar-chart-2-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <p className="text-sm text-foreground-500">No build checklists yet. Create one to see reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Build Progress by Project */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Build Progress by Project</h3>
        <div className="space-y-3">
          {runs.map((run) => {
            const items = reportData.find((rd) => rd.runId === run.id)?.items ?? [];
            const conceptionDone = items.filter((i) => i.phase === 'conception' && i.checked).length;
            const conceptionTotal = items.filter((i) => i.phase === 'conception').length;
            const devDone = items.filter((i) => i.phase === 'development' && i.checked).length;
            const devTotal = items.filter((i) => i.phase === 'development').length;
            const deployDone = items.filter((i) => i.phase === 'deployment' && i.checked).length;
            const deployTotal = items.filter((i) => i.phase === 'deployment').length;

            return (
              <div key={run.id} className="border border-background-200/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-foreground-100">{run.run_name}</p>
                    <p className="text-xs text-foreground-500">{getProjectName(run.project_id)}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground-100">{run.progress_percent}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[{ phase: 'conception', done: conceptionDone, total: conceptionTotal, color: 'bg-sky-400' },
                    { phase: 'development', done: devDone, total: devTotal, color: 'bg-accent-400' },
                    { phase: 'deployment', done: deployDone, total: deployTotal, color: 'bg-emerald-400' },
                  ].map((p) => (
                    <div key={p.phase}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-foreground-500">{PHASE_LABELS[p.phase]?.split(' — ')[1] || p.phase}</span>
                        <span className="text-foreground-400">{p.total > 0 ? Math.round((p.done / p.total) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.total > 0 ? Math.round((p.done / p.total) * 100) : 0}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blocked Tasks */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Blocked Tasks by Project</h3>
        <div className="space-y-2">
          {runs.map((run) => {
            const items = reportData.find((rd) => rd.runId === run.id)?.items ?? [];
            const blocked = items.filter((i) => i.status === 'blocked');

            return (
              <div key={run.id} className="flex items-center justify-between py-2 border-b border-background-200/40 last:border-0">
                <div>
                  <p className="text-sm text-foreground-200">{getProjectName(run.project_id)}</p>
                  <p className="text-xs text-foreground-600">{run.run_name}</p>
                </div>
                <span className={`text-sm font-bold ${blocked.length > 0 ? 'text-red-400' : 'text-foreground-500'}`}>
                  {blocked.length} blocked
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overdue Tasks */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Overdue Tasks</h3>
        <div className="space-y-1">
          {runs.flatMap((run) => {
            const items = reportData.find((rd) => rd.runId === run.id)?.items ?? [];
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return items.filter((i) => i.due_date && new Date(i.due_date) < now && !i.checked).map((i) => ({ ...i, run_name: run.run_name, project_name: getProjectName(run.project_id) }));
          }).length === 0 ? (
            <p className="text-sm text-foreground-500">No overdue items — great!</p>
          ) : (
            runs.flatMap((run) => {
              const items = reportData.find((rd) => rd.runId === run.id)?.items ?? [];
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              return items.filter((i) => i.due_date && new Date(i.due_date) < now && !i.checked).map((i) => ({ ...i, run_name: run.run_name, project_name: getProjectName(run.project_id) }));
            }).map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 py-2 px-3 bg-background-50 rounded-lg border border-background-200/40">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground-200 line-clamp-1">{item.item_title}</p>
                  <p className="text-[10px] text-foreground-600">{item.project_name} &middot; Due {new Date(item.due_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Incomplete Launch Blockers */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Incomplete Launch Blockers</h3>
        <div className="space-y-1">
          {runs.flatMap((run) => {
            const items = reportData.find((rd) => rd.runId === run.id)?.items ?? [];
            return items.filter((i) => i.is_launch_blocker && !i.checked).map((i) => ({ ...i, run_name: run.run_name, project_name: getProjectName(run.project_id) }));
          }).length === 0 ? (
            <p className="text-sm text-foreground-500">All launch blockers resolved!</p>
          ) : (
            runs.flatMap((run) => {
              const items = reportData.find((rd) => rd.runId === run.id)?.items ?? [];
              return items.filter((i) => i.is_launch_blocker && !i.checked).map((i) => ({ ...i, run_name: run.run_name, project_name: getProjectName(run.project_id) }));
            }).map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 py-2 px-3 bg-red-500/5 rounded-lg border border-red-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground-200 line-clamp-1">{item.item_title}</p>
                  <p className="text-[10px] text-foreground-600">{item.project_name} &middot; {item.stage_title}</p>
                </div>
                <span className="text-[10px] text-red-400 font-medium whitespace-nowrap">BLOCKER</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Readiness Score Chart */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Readiness Score Chart</h3>
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center gap-3">
              <span className="text-sm text-foreground-300 w-32 truncate">{getProjectName(run.project_id)}</span>
              <div className="flex-1 h-4 bg-background-200/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    run.launch_readiness_score >= 90 ? 'bg-emerald-400' : run.launch_readiness_score >= 70 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${run.launch_readiness_score}%` }}
                ></div>
              </div>
              <span className={`text-sm font-bold w-12 text-right ${
                run.launch_readiness_score >= 90 ? 'text-emerald-400' : run.launch_readiness_score >= 70 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {run.launch_readiness_score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}