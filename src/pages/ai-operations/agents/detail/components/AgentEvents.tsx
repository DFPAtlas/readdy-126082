import type { AgentEvent } from '@/pages/ai-operations/types';

function eventIcon(event: string) {
  if (event.toLowerCase().includes('error') || event.toLowerCase().includes('failed')) return { icon: 'ri-error-warning-line', tone: 'text-red-400 bg-red-500/10' };
  if (event.toLowerCase().includes('paused')) return { icon: 'ri-pause-circle-line', tone: 'text-amber-400 bg-amber-500/10' };
  if (event.toLowerCase().includes('approval')) return { icon: 'ri-shield-check-line', tone: 'text-amber-400 bg-amber-500/10' };
  if (event.toLowerCase().includes('config') || event.toLowerCase().includes('permission')) return { icon: 'ri-settings-3-line', tone: 'text-accent-400 bg-accent-500/10' };
  if (event.toLowerCase().includes('completed')) return { icon: 'ri-checkbox-circle-line', tone: 'text-emerald-400 bg-emerald-500/10' };
  if (event.toLowerCase().includes('started') || event.toLowerCase().includes('resumed')) return { icon: 'ri-play-circle-line', tone: 'text-emerald-400 bg-emerald-500/10' };
  return { icon: 'ri-information-line', tone: 'text-secondary-300 bg-secondary-500/10' };
}

export default function AgentEvents({ events }: { events: AgentEvent[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Events</h3>
        <span className="text-xs font-label text-foreground-600">{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No events recorded yet.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          {events.map((e, i) => {
            const style = eventIcon(e.event);
            return (
              <div key={`${e.timestamp}-${i}`} className="px-4 py-3 flex items-start gap-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.tone}`}>
                  <i className={`${style.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground-200">{e.event}</span>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-500">{e.actor}</span>
                  </div>
                  <p className="text-xs text-foreground-400 mt-0.5">{e.summary}</p>
                </div>
                <span className="text-[11px] font-label text-foreground-600 shrink-0 whitespace-nowrap">{e.timestamp}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}