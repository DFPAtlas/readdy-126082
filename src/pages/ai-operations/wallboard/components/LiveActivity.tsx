import { getWallboardActivity } from '@/pages/ai-operations/wallboard/selectors';
import { SEVERITY, ACTIVITY_SOURCE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function LiveActivity() {
  const events = getWallboardActivity(10);

  return (
    <section className="h-full bg-background-100 border border-background-200/60 rounded-lg flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Live Activity</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Live
        </span>
      </div>

      <div className="divide-y divide-background-200/40 overflow-y-auto">
        {events.map((event) => {
          const severity = SEVERITY[event.severity];
          return (
            <div key={event.id} className="px-4 py-2 flex items-center gap-3">
              <span className="text-[10px] font-label text-foreground-600 tabular-nums whitespace-nowrap shrink-0">{event.timestamp}</span>
              <span className="text-[10px] font-label text-foreground-500 bg-background-200/50 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                {ACTIVITY_SOURCE_LABELS[event.sourceType]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground-200 whitespace-nowrap">{event.site}</span>
                  <span className="text-foreground-600">&middot;</span>
                  <span className="text-xs text-foreground-400 truncate">{event.event}</span>
                </div>
              </div>
              <StatusPill tone={severity.tone} label={severity.label} />
            </div>
          );
        })}
      </div>
    </section>
  );
}