import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { SCHEDULE_STATUS, RISK_LEVEL, AUTOMATION_TYPE_LABELS } from '@/pages/ai-operations/constants';
import { useSchedules } from '@/pages/ai-operations/schedules/SchedulesContext';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ScheduleHeader({ schedule }: { schedule: AiSchedule }) {
  const { updateScheduleStatus } = useSchedules();
  const status = SCHEDULE_STATUS[schedule.status];
  const risk = RISK_LEVEL[schedule.risk];

  const controls: { action: 'paused' | 'active' | 'disabled'; label: string; icon: string; tone: string }[] = [
    { action: 'paused', label: 'Pause', icon: 'ri-pause-line', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/20' },
    { action: 'active', label: 'Resume', icon: 'ri-play-line', tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20' },
    { action: 'disabled', label: 'Disable', icon: 'ri-stop-line', tone: 'text-foreground-400 bg-background-50 border-background-300/60 hover:bg-background-200/50' },
  ];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/schedules" className="hover:text-foreground-200 transition-colors cursor-pointer">Scheduling &amp; Automation</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{schedule.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{schedule.name}</h1>
            <StatusPill tone={status.tone} label={status.label} pulse={schedule.status === 'running'} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={risk.tone} label={risk.label} />
            <span className="text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              {AUTOMATION_TYPE_LABELS[schedule.automationType]}
            </span>
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            <span className="font-mono">{schedule.id}</span> · {schedule.siteName} · {schedule.agentName}
          </p>
          <p className="text-sm text-foreground-400 mt-2 max-w-2xl">{schedule.description}</p>
          <div className="flex items-center gap-2 mt-2 text-xs font-label text-foreground-500 flex-wrap">
            <span className="whitespace-nowrap">Frequency: {schedule.frequency}</span>
            <span>·</span>
            <span className="whitespace-nowrap">Next run: <span className="font-mono text-foreground-300">{schedule.nextRun}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {controls.map((c) => (
            <button
              key={c.action}
              onClick={() => void updateScheduleStatus(schedule.id, c.action)}
              disabled={schedule.status === c.action}
              className={`inline-flex items-center gap-1.5 text-xs font-label border rounded-md px-3 py-2 transition-colors duration-150 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${c.tone}`}
            >
              <i className={`${c.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-3 flex items-start gap-2.5">
        <i className="ri-information-line text-sm text-foreground-500 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
        <p className="text-[11px] font-label text-foreground-500 leading-relaxed">
          Scheduling runtime is not connected. Pause / Resume / Disable update registry state only — no scheduler process is connected and no execution occurs.
        </p>
      </div>
    </div>
  );
}