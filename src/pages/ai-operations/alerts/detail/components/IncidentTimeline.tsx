import type { IncidentTimelineEvent } from '@/pages/ai-operations/types';

export default function IncidentTimeline({ events }: { events: IncidentTimelineEvent[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Incident Timeline</h4>
      </div>
      <div className="px-4 py-4">
        <ol className="relative border-l border-background-200/60 ml-2 space-y-5">
          {events.map((e, i) => (
            <li key={i} className="ml-4">
              <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-accent-500 border border-background-100"></span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{e.timestamp}</span>
                <span className="text-xs font-label text-foreground-300">{e.event}</span>
              </div>
              <p className="text-sm text-foreground-200 mt-0.5">{e.actor}</p>
              <p className="text-sm text-foreground-400 mt-0.5">{e.summary}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}