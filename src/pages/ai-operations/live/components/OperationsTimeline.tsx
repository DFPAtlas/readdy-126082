import { getActivityEvents } from '@/pages/ai-operations/live/selectors';
import { SEVERITY } from '@/pages/ai-operations/constants';
import type { Severity } from '@/pages/ai-operations/types';

const IMPORTANT: Severity[] = ['critical', 'high', 'medium'];

export default function OperationsTimeline() {
  const events = getActivityEvents().filter((e) => IMPORTANT.includes(e.severity)).slice(0, 10);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Operations Timeline</h3>
      </div>

      <div className="px-4 py-4">
        <div className="relative">
          <span className="absolute left-[7px] top-1 bottom-1 w-px bg-background-300/40"></span>
          <div className="space-y-4">
            {events.map((event) => {
              const severity = SEVERITY[event.severity];
              return (
                <div key={event.id} className="relative pl-7">
                  <span
                    className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center ${
                      event.severity === 'critical'
                        ? 'bg-red-500/20 border-red-400'
                        : event.severity === 'high'
                          ? 'bg-amber-500/20 border-amber-400'
                          : 'bg-background-200/40 border-background-300/60'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${severity.tone === 'red' ? 'bg-red-400' : severity.tone === 'amber' ? 'bg-amber-400' : 'bg-foreground-500'}`}></span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-label text-foreground-600 tabular-nums">{event.timestamp}</span>
                    <span className="text-xs font-medium text-foreground-200">{event.site}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5">{event.event}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{event.actor}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}