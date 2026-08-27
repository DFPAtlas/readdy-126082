import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { TASK_TYPE_LABELS } from '@/pages/ai-operations/constants';

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <i className={`${on ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-checkbox-blank-circle-line text-foreground-600'} w-4 h-4 flex items-center justify-center`}></i>
      <span className={`text-xs font-label ${on ? 'text-foreground-100' : 'text-foreground-500'}`}>{label}</span>
    </div>
  );
}

export default function TaskDefinition({ schedule }: { schedule: AiSchedule }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Task Definition</h3>
        <span className="text-[11px] font-label text-foreground-600">{TASK_TYPE_LABELS[schedule.taskType]}</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Task summary</p>
          <p className="text-sm text-foreground-100">{schedule.taskSummary}</p>
        </div>
        <div>
          <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Expected outcome</p>
          <p className="text-sm text-foreground-300">{schedule.expectedOutcome}</p>
        </div>

        <div>
          <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5">Required tools</p>
          <div className="flex flex-wrap gap-1.5">
            {schedule.requiredTools.length === 0 && <span className="text-xs text-foreground-600">None listed</span>}
            {schedule.requiredTools.map((tool) => (
              <Link
                key={tool}
                to="/ai-operations/tools"
                className="text-[10px] font-label text-foreground-400 bg-background-50 border border-background-200/60 rounded px-2 py-0.5 hover:text-accent-400 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                {tool}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5">Required knowledge</p>
          <div className="flex flex-wrap gap-1.5">
            {schedule.requiredKnowledge.length === 0 && <span className="text-xs text-foreground-600">None listed</span>}
            {schedule.requiredKnowledge.map((k) => (
              <Link
                key={k}
                to={`/ai-operations/knowledge/${k}`}
                className="text-[10px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/25 rounded px-2 py-0.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap font-mono"
              >
                {k}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-background-200/60">
          <Check on={schedule.verificationRequired} label="Verification required" />
          <Check on={schedule.uatRequired} label="UAT required" />
          <Check on={schedule.auditRequired} label="Audit required" />
        </div>
      </div>
    </section>
  );
}