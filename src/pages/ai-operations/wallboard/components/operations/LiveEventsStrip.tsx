import {
  getLiveEvents,
  getGlobalSystemState,
  toneHex,
  type LiveEventItem,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

const PROVENANCE_BADGE: Record<LiveEventItem['provenance'], { label: string; color: string }> = {
  live: { label: 'LIVE', color: '#22d3ee' },
  simulated: { label: 'SIMULATED', color: '#f59e0b' },
};

function EventItem({ item }: { item: LiveEventItem }) {
  const tone = toneHex(item.tone);
  const badge = PROVENANCE_BADGE[item.provenance];
  return (
    <div className="ow-arrive flex items-center gap-2 whitespace-nowrap">
      <span className="font-mono text-[10px] tabular-nums text-slate-500">{item.time}</span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone }} />
      <span className="text-[10px] font-label tracking-[0.06em] text-slate-400">{item.site}</span>
      <span className="text-[10.5px] text-slate-200">{item.text}</span>
      <span
        className="text-[7.5px] font-bold tracking-[0.12em] px-1.5 py-0.5 rounded-sm border shrink-0"
        style={{ color: badge.color, borderColor: `${badge.color}55`, background: `${badge.color}14` }}
      >
        {badge.label}
      </span>
    </div>
  );
}

/**
 * One pass of the ticker content. Each event unit carries a leading separator
 * so the track is perfectly uniform — the loop point is seamless.
 */
function TickerRun({ items, hidden }: { items: LiveEventItem[]; hidden: boolean }) {
  return (
    <>
      {items.map((item) => (
        <div
          key={`${hidden ? 'dup' : 'main'}-${item.id}`}
          className="flex items-center shrink-0"
          aria-hidden={hidden || undefined}
        >
          <span className="w-px h-4 mx-4 shrink-0" style={{ background: 'rgba(34,211,238,0.14)' }} />
          <EventItem item={item} />
        </div>
      ))}
    </>
  );
}

/**
 * Bottom Live Events strip — a calm, continuously-moving operational ticker
 * driven by the existing audit-event feed, with the global system state pinned
 * far right.
 */
export default function LiveEventsStrip() {
  const events = getLiveEvents();
  const global = getGlobalSystemState();
  const gTone = toneHex(global.tone);
  const operational = global.state === 'nominal';

  return (
    <footer className="shrink-0 flex items-center border-t border-cyan-400/15 h-[46px]">
      <div className="shrink-0 flex flex-col justify-center px-5 border-r border-cyan-400/12 h-full">
        <span className="text-[10px] font-bold tracking-[0.2em] text-slate-100 whitespace-nowrap">LIVE EVENTS</span>
        <span className="text-[7.5px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">LATEST ACTIVITY ACROSS DFP</span>
      </div>

      <div className="flex-1 min-w-0 h-full">
        {events.length === 0 ? (
          <div className="flex items-center h-full px-5">
            <span className="text-[10px] font-label tracking-[0.14em] text-slate-500 whitespace-nowrap">
              NO RECENT OPERATIONAL EVENTS
            </span>
          </div>
        ) : (
          <div className="ow-ticker">
            <div className="ow-ticker-track">
              <TickerRun items={events} hidden={false} />
              <TickerRun items={events} hidden />
            </div>
            <div className="ow-ticker-mask ow-ticker-mask-left" aria-hidden="true" />
            <div className="ow-ticker-mask ow-ticker-mask-right" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2 px-5 border-l border-cyan-400/12 h-full">
        <span
          className={`w-2 h-2 rounded-full ${operational ? 'ow-pulse' : 'ow-alert'}`}
          style={{ background: gTone }}
        />
        <span className="text-[10px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: gTone }}>
          {operational ? 'ALL SYSTEMS OPERATIONAL' : global.label}
        </span>
      </div>
    </footer>
  );
}