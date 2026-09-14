import { useState } from 'react';
import { PHASE_LABELS, PHASE_COLORS, STATUS_COLORS } from '@/pages/build-process/types';
import type { ProjectBuildItem } from '../buildUtils';
import { isBlocked } from '../buildUtils';

const PHASE_ORDER = ['conception', 'development', 'deployment'] as const;

interface StageGroup {
  stageNumber: number;
  stageTitle: string;
  phase: string;
  items: ProjectBuildItem[];
}

export default function BuildChecklist({ items }: { items: ProjectBuildItem[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
          <i className="ri-list-check-2 text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
        </div>
        <p className="text-sm text-foreground-500">This checklist has no items yet.</p>
      </div>
    );
  }

  const stageGroups: StageGroup[] = [];
  items.forEach((item) => {
    let group = stageGroups.find((g) => g.stageNumber === item.stage_number);
    if (!group) {
      group = { stageNumber: item.stage_number, stageTitle: item.stage_title, phase: item.phase, items: [] };
      stageGroups.push(group);
    }
    group.items.push(item);
  });
  stageGroups.sort((a, b) => a.stageNumber - b.stageNumber);

  const toggleStage = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map((phase) => {
        const stages = stageGroups.filter((s) => s.phase === phase);
        if (stages.length === 0) return null;

        const phaseTotal = stages.reduce((sum, s) => sum + s.items.length, 0);
        const phaseDone = stages.reduce((sum, s) => sum + s.items.filter((i) => i.checked).length, 0);
        const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

        return (
          <div key={phase} className="bg-background-50 border border-background-200/60 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PHASE_COLORS[phase]}`}>
                <i className={`${phase === 'conception' ? 'ri-lightbulb-line' : phase === 'development' ? 'ri-code-s-slash-line' : 'ri-rocket-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
              </div>
              <div>
                <h4 className="text-sm font-heading font-semibold text-foreground-100">{PHASE_LABELS[phase] ?? phase}</h4>
                <p className="text-xs text-foreground-500">{stages.length} stages &middot; {phaseDone}/{phaseTotal} done</p>
              </div>
              <span className="ml-auto text-sm font-bold text-foreground-100">{phasePct}%</span>
            </div>

            <div className="divide-y divide-background-200/40">
              {stages.map((stage) => {
                const stageKey = `${phase}-${stage.stageNumber}`;
                const isOpen = !collapsed.has(stageKey);
                const stageDone = stage.items.filter((i) => i.checked).length;
                const stageTotal = stage.items.length;

                return (
                  <div key={stageKey}>
                    <button
                      type="button"
                      onClick={() => toggleStage(stageKey)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-background-100/50 transition-colors cursor-pointer text-left"
                    >
                      <i className={`ri-arrow-right-s-line text-foreground-500 transition-transform duration-200 text-sm w-4 h-4 flex items-center justify-center ${isOpen ? 'rotate-90' : ''}`}></i>
                      <span className="text-sm font-medium text-foreground-200 flex-1">Stage {stage.stageNumber}: {stage.stageTitle}</span>
                      <span className="text-xs text-foreground-500">{stageDone}/{stageTotal}</span>
                      <div className="w-20 h-1.5 bg-background-200/60 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${stageTotal > 0 ? Math.round((stageDone / stageTotal) * 100) : 0}%` }}></div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-3 space-y-0.5">
                        {stage.items.map((item) => {
                          const blocked = isBlocked(item);
                          return (
                            <div key={item.id} className="flex items-start gap-2.5 py-1.5 px-2 rounded-md hover:bg-background-100/70 transition-colors">
                              <div className={`w-4 h-4 mt-0.5 rounded border border-background-300/60 shrink-0 flex items-center justify-center ${item.checked ? 'bg-accent-500 border-accent-500' : ''}`}>
                                {item.checked && <i className="ri-check-line text-background-950 text-[10px] w-3 h-3 flex items-center justify-center"></i>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className={`text-sm ${item.checked ? 'text-foreground-500 line-through' : 'text-foreground-200'}`}>
                                  {item.item_title}
                                </span>
                                {item.notes && <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{item.notes}</p>}
                                {item.blocker_notes && (
                                  <p className="text-xs text-red-400 mt-1 leading-relaxed">
                                    <i className="ri-alert-line w-3 h-3 flex items-center justify-center inline-block mr-1"></i>
                                    {item.blocker_notes}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {item.is_required && (
                                    <span className="text-[9px] font-label bg-primary-500/10 text-primary-400 rounded px-1 py-0.5 whitespace-nowrap">REQUIRED</span>
                                  )}
                                  {!item.is_required && (
                                    <span className="text-[9px] font-label bg-foreground-500/10 text-foreground-500 rounded px-1 py-0.5 whitespace-nowrap">OPTIONAL</span>
                                  )}
                                  {item.is_launch_blocker && (
                                    <span className="text-[9px] font-label bg-red-500/10 text-red-400 rounded px-1 py-0.5 whitespace-nowrap">LAUNCH BLOCKER</span>
                                  )}
                                  {blocked && (
                                    <span className="text-[9px] font-label bg-red-500/10 text-red-400 rounded px-1 py-0.5 whitespace-nowrap">BLOCKED</span>
                                  )}
                                  <span className={`text-[9px] font-label rounded px-1 py-0.5 whitespace-nowrap ${STATUS_COLORS[item.status] ?? 'bg-foreground-500/10 text-foreground-500'}`}>
                                    {item.status.replace('_', ' ')}
                                  </span>
                                  {item.due_date && (
                                    <span className={`text-[10px] whitespace-nowrap ${new Date(item.due_date) < new Date() && !item.checked ? 'text-red-400' : 'text-foreground-600'}`}>
                                      Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
  );
}