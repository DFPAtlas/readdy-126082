import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { SCHEDULE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

// Extracts a sortable date key (YYYY-MM-DD) from a nextRun string; returns
// null for event/condition/on-demand schedules with no concrete date.
function dateKey(nextRun: string): string | null {
  const m = nextRun.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduleCalendar({ schedules }: { schedules: AiSchedule[] }) {
  const days = useMemo(() => {
    const map = new Map<string, AiSchedule[]>();
    schedules.forEach((s) => {
      const key = dateKey(s.nextRun);
      if (!key) return;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 14);
  }, [schedules]);

  if (days.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
        <p className="text-sm text-foreground-500">No dated upcoming runs to display.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-[11px] font-label text-foreground-600">
        <i className="ri-calendar-2-line w-4 h-4 flex items-center justify-center"></i>
        <span>Upcoming scheduled jobs by day (demo only — no production scheduler connected)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map(([key, list]) => {
          const d = new Date(key + 'T00:00:00');
          const label = DAY_LABELS[d.getDay()];
          return (
            <div key={key} className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-background-200/60 flex items-center justify-between gap-2">
                <span className="text-sm font-label font-semibold text-foreground-100">{label}</span>
                <span className="text-[11px] font-label text-foreground-500 font-mono">{key}</span>
              </div>
              <div className="divide-y divide-background-200/40">
                {list.map((s) => {
                  const status = SCHEDULE_STATUS[s.status];
                  return (
                    <Link key={s.id} to={`/ai-operations/schedules/${s.id}`} className="block px-4 py-2.5 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground-100 truncate">{s.name}</p>
                          <p className="text-[10px] font-label text-foreground-500 mt-0.5">{s.siteName} · {s.nextRun.slice(11)}</p>
                        </div>
                        <StatusPill tone={status.tone} label={status.label} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}