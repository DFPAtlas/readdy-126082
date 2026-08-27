import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { SCHEDULE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

// Returns a sortable timestamp (or Infinity) for chronological ordering of
// upcoming runs. Non-dated schedules sort last.
function sortValue(nextRun: string): number {
  if (nextRun.startsWith('2026-')) {
    const t = new Date(nextRun.replace(' ', 'T')).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }
  return Number.MAX_SAFE_INTEGER;
}

export default function ScheduleTimeline({ schedules }: { schedules: AiSchedule[] }) {
  const upcoming = useMemo(() => {
    return [...schedules].sort((a, b) => sortValue(a.nextRun) - sortValue(b.nextRun)).slice(0, 20);
  }, [schedules]);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Upcoming Timeline</h3>
        <span className="text-[11px] font-label text-foreground-600">chronological · demo only</span>
      </div>

      <div className="p-4">
        <div className="relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-background-300/40"></div>
          <div className="space-y-4">
            {upcoming.map((s) => {
              const status = SCHEDULE_STATUS[s.status];
              const isDated = s.nextRun.startsWith('2026-');
              return (
                <div key={s.id} className="relative flex items-start gap-4 pl-10">
                  <div className={`absolute left-[9px] top-1 w-3.5 h-3.5 rounded-full border ${status.tone === 'red' ? 'bg-red-500/20 border-red-500/40' : 'bg-accent-500/20 border-accent-500/40'}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/ai-operations/schedules/${s.id}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                          {s.name}
                        </Link>
                        <p className="text-[11px] font-label text-foreground-500 mt-0.5">{s.siteName} · {s.agentName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-label text-foreground-300 font-mono whitespace-nowrap">{isDated ? s.nextRun : s.nextRun}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}