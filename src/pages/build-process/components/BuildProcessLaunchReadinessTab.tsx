import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildRun, BuildRunItem, Project } from '../types';
import { PHASE_LABELS, READINESS_VERDICT } from '../types';

interface Props {
  runs: BuildRun[];
  projects: Project[];
  onRefresh: () => void;
  getProjectName: (id: number | null) => string;
}

export default function BuildProcessLaunchReadinessTab({ runs, projects, onRefresh, getProjectName }: Props) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [items, setItems] = useState<BuildRunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (selectedRunId) loadItems(selectedRunId);
  }, [selectedRunId]);

  const loadItems = async (runId: number) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('internal_build_process_run_items')
        .select('*')
        .eq('run_id', runId)
        .order('item_order');
      setItems(data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  const calculateScore = (): { score: number; deductions: { reason: string; points: number }[] } => {
    if (!selectedRun) return { score: 0, deductions: [] };
    const base = selectedRun.progress_percent;
    const deductions: { reason: string; points: number }[] = [];

    const launchBlockers = items.filter((i) => i.is_launch_blocker && !i.checked);
    if (launchBlockers.length > 0) {
      const deduction = Math.min(launchBlockers.length * 10, 50);
      deductions.push({ reason: `${launchBlockers.length} open launch blockers`, points: deduction });
    }

    const blockedRequired = items.filter((i) => i.is_required && i.status === 'blocked');
    if (blockedRequired.length > 0) {
      const deduction = Math.min(blockedRequired.length * 5, 25);
      deductions.push({ reason: `${blockedRequired.length} blocked required items`, points: deduction });
    }

    const legalItems = items.filter((i) => i.stage_number === 20);
    const missingLegal = legalItems.filter((i) => i.is_required && !i.checked);
    if (missingLegal.length > 0) {
      deductions.push({ reason: `${missingLegal.length} missing legal pages`, points: 10 });
    }

    const testingItems = items.filter((i) => i.stage_number === 17);
    const missingTesting = testingItems.filter((i) => i.is_required && !i.checked);
    if (missingTesting.length > 0) {
      deductions.push({ reason: `${missingTesting.length} missing testing items`, points: 10 });
    }

    const deployItems = items.filter((i) => i.stage_number === 21);
    const missingDeploy = deployItems.filter((i) => i.is_required && !i.checked);
    if (missingDeploy.length > 0) {
      deductions.push({ reason: `${missingDeploy.length} missing deployment items`, points: 10 });
    }

    let score = base;
    deductions.forEach((d) => { score -= d.points; });
    score = Math.max(0, Math.min(100, score));
    return { score, deductions };
  };

  const { score, deductions } = calculateScore();
  const verdict = READINESS_VERDICT.find((v) => score >= v.min && score <= v.max) ?? READINESS_VERDICT[0];

  const mustCompleteItems = items.filter((i) => i.is_launch_blocker && !i.checked || (i.stage_number === 17 || i.stage_number === 20 || i.stage_number === 21) && i.is_required && !i.checked);

  const handleCopyLaunchPrompt = () => {
    if (!selectedRun) return;
    const projectName = getProjectName(selectedRun.project_id);
    const blockerItems = mustCompleteItems.slice(0, 10);
    const itemList = blockerItems.map((i) => `- ${i.item_title} (${PHASE_LABELS[i.phase]}, Stage ${i.stage_number})`).join('\n');

    const prompt = `Update the Digital Footprint project for ${projectName}. Complete the following launch-critical items to improve readiness score from ${score} to target 100:\n\n${itemList}\n\nThis project currently has a readiness score of ${score}/100 with verdict: ${verdict.label}. Make the required UI/database/code changes and keep the existing style consistent.`;
    navigator.clipboard.writeText(prompt);
    setToast('Launch fix prompt copied to clipboard!');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Run Selector */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <select
          value={selectedRunId ?? ''}
          onChange={(e) => setSelectedRunId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
        >
          <option value="">Select a project checklist...</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.run_name} — {getProjectName(run.project_id)} ({run.launch_readiness_score}/100)
            </option>
          ))}
        </select>
      </div>

      {selectedRun && !loading && (
        <>
          {/* Score Card */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-background-200/60 mb-4">
                <span className={`text-3xl font-heading font-bold ${verdict.color}`}>{score}</span>
              </div>
              <h3 className={`text-lg font-heading font-bold ${verdict.color}`}>{verdict.label}</h3>
              <p className="text-sm text-foreground-500 mt-1">{getProjectName(selectedRun.project_id)} — {selectedRun.run_name}</p>
            </div>

            {/* Deductions */}
            {deductions.length > 0 && (
              <div className="mt-6 pt-4 border-t border-background-200/60">
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Score Deductions</h4>
                <div className="space-y-1.5">
                  {deductions.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span className="text-foreground-300">{d.reason}</span>
                      <span className="text-red-400 font-medium">-{d.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Must-Complete Launch Items */}
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Must-Complete Launch Items</h3>
              <button
                onClick={handleCopyLaunchPrompt}
                className="text-xs text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <i className="ri-file-copy-line w-3.5 h-3.5 flex items-center justify-center"></i> Copy Launch Fix Prompt
              </button>
            </div>
            {mustCompleteItems.length === 0 ? (
              <p className="text-sm text-emerald-400">All launch-critical items are complete!</p>
            ) : (
              <div className="space-y-1">
                {mustCompleteItems.map((item) => (
                  <div key={item.id} className={`flex items-center gap-2.5 py-1.5 px-3 rounded-lg border ${item.is_launch_blocker && !item.checked ? 'bg-red-500/5 border-red-500/10' : 'bg-background-50 border-background-200/40'}`}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      readOnly
                      className="w-4 h-4 rounded border-background-300/60 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground-200">{item.item_title}</p>
                      <p className="text-[10px] text-foreground-600">{PHASE_LABELS[item.phase]} &middot; Stage {item.stage_number}: {item.stage_title}</p>
                    </div>
                    {item.is_launch_blocker && (
                      <span className="text-[9px] font-label bg-red-500/10 text-red-400 rounded px-1 py-0.5 whitespace-nowrap">BLOCKER</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-background-200/40 rounded"></div>)}
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