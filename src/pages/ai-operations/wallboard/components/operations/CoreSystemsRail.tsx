import {
  getCoreSystems,
  toneHex,
  type CoreSystemRow,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

const SYSTEM_ICON: Record<string, string> = {
  hal: 'ri-cpu-line',
  tron: 'ri-radar-line',
  'n8n-01': 'ri-flow-chart',
  'n8n-02': 'ri-flow-chart',
  supabase: 'ri-database-2-line',
  network: 'ri-global-line',
  storage: 'ri-hard-drive-2-line',
};

/** Status tone → node treatment (colour + animation). */
const NODE_CLASS: Record<CoreSystemRow['tone'], string> = {
  green: 'ow-sys-node-green',
  amber: 'ow-sys-node-amber',
  red: 'ow-sys-node-red',
  cyan: 'ow-sys-node-green', // cyan treated as a live/known interface state
  muted: 'ow-sys-node-muted',
};

function SystemNodeRow({ row }: { row: CoreSystemRow }) {
  const tone = toneHex(row.tone);
  return (
    <div className="ow-sys-row">
      {/* Connector group — horizontal circuit trace into the vertical bus. */}
      <span className="ow-sys-connector" aria-hidden="true">
        <span className="ow-sys-trace" />
        <span
          className={`ow-sys-node ${NODE_CLASS[row.tone]}`}
          role="img"
          aria-label={`${row.name} — ${row.statusLabel}`}
        >
          <i className={SYSTEM_ICON[row.key] ?? 'ri-server-line'}></i>
        </span>
      </span>

      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-[13px] font-semibold tracking-[0.08em] text-slate-200 whitespace-nowrap">
          {row.name}
        </div>
        <div className="text-[8.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap truncate">
          {row.subtitle}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {row.simulated && <span className="ow-sys-sim">SIM</span>}
        <span
          className="ow-sys-capsule"
          style={{ color: tone, borderColor: `${tone}55`, background: `${tone}16` }}
        >
          {row.statusLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Left Core Systems rail — seven console rows (HAL, TRON, N8N-01, N8N-02,
 * Supabase, Network, Storage) connected through a thin vertical cyan data bus
 * (monitoring connectivity only), plus the DFP Core Hub identity block at the
 * base as the visual source of the bus.
 */
export default function CoreSystemsRail() {
  const systems = getCoreSystems();

  // Derived summary — counts from the seven displayed rows only (never hard-coded).
  const ok = systems.filter((s) => ['healthy', 'online', 'active'].includes(s.status)).length;
  const warn = systems.filter((s) => s.status === 'degraded').length;
  const down = systems.filter((s) => s.status === 'offline').length;
  const unknown = systems.filter((s) => ['unknown', 'not_configured', 'not_monitored'].includes(s.status)).length;

  // A data packet only travels the bus when at least one system reports a known status.
  const hasKnownStatus = systems.some((s) => !['unknown', 'not_configured', 'not_monitored'].includes(s.status));

  return (
    <aside className="flex flex-col min-h-0 h-full">
      <div className="ow-panel ow-glow-cyan flex flex-col flex-1 min-h-0">
        {/* Heading + derived summary */}
        <div className="shrink-0 px-3 pt-2 pb-1.5 border-b border-cyan-400/15">
          <span className="text-[10px] font-label tracking-[0.24em] text-cyan-300">CORE SYSTEMS</span>
          <div className="mt-1 text-[8.5px] font-label tracking-[0.06em] tabular-nums leading-none">
            <span style={{ color: toneHex('green') }}>OK {ok}</span>
            <span className="text-slate-600"> · </span>
            <span style={{ color: toneHex('amber') }}>WARN {warn}</span>
            <span className="text-slate-600"> · </span>
            <span style={{ color: toneHex('red') }}>DOWN {down}</span>
            <span className="text-slate-600"> · </span>
            <span style={{ color: toneHex('muted') }}>UNKNOWN {unknown}</span>
          </div>
        </div>

        {/* Body — vertical bus behind the seven nodes */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <span className="ow-sys-bus" aria-hidden="true" />
          {hasKnownStatus && <span className="ow-sys-packet" aria-hidden="true" />}
          <div role="list" className="h-full">
            {systems.map((row) => (
              <div role="listitem" key={row.key}>
                <SystemNodeRow row={row} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DFP Core Hub — visual source of the bus (no unsupported health claim). */}
      <div className="shrink-0 mt-3 ow-panel ow-hub relative overflow-hidden flex items-center py-2.5 pl-5 pr-2.5">
        <span className="ow-hub-node" aria-hidden="true">
          <span className="ow-hub-node-d">D</span>
        </span>
        <div className="flex-1 min-w-0 leading-tight pl-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tracking-[0.22em] text-slate-100 whitespace-nowrap">DFP</span>
            <span className="text-[8px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">CORE HUB</span>
          </div>
          <div className="text-[8.5px] font-label tracking-[0.3em] text-slate-500 whitespace-nowrap">
            DIGITAL FOOTPRINT
          </div>
          <div className="text-[8px] font-label tracking-[0.14em] text-orange-400/70 whitespace-nowrap truncate">
            CONNECTED SYSTEMS // STRONGER OUTCOMES
          </div>
        </div>
      </div>
    </aside>
  );
}