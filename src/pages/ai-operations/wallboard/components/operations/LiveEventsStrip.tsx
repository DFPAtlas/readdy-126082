import {
  getLiveEvents,
  getGlobalSystemState,
  toneHex,
  type LiveEventItem,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

function EventItem({ item }: { item: LiveEventItem }) {
  const tone = toneHex(item.tone);
  return (
    <div className="ow-arrive flex items-center gap-2 px-3 whitespace-nowrap">
      <span className="font-mono text-[10px] tabular-nums text-slate-500">{item.time}</span>
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: tone }} />
      <span className="text-[10.5px] text-slate-300 truncate">{item.text}</span>
    </div>
  );
}

/**
 * Bottom Live Events strip — a calm horizontally-arranged stream of recent
 * operational events, with the global "all systems operational" state pinned
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

      <div className="flex-1 flex items-center overflow-hidden min-w-0">
        {events.map((e, i) => (
          <div key={e.id} className="flex items-center min-w-0">
            <EventItem item={e} />
            {i < events.length - 1 && <span className="w-px h-4" style={{ background: 'rgba(34,211,238,0.12)' }} />}
          </div>
        ))}
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