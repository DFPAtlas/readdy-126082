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

/** Compact relative age from an ISO timestamp (e.g. "42s ago"), or null. */
function relativeAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** Human-readable container uptime (e.g. "3d 4h"). */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  return `${Math.floor(hr / 24)}d ${hr % 24}h`;
}

/**
 * Compose a row's hover detail from whatever telemetry ACTUALLY reported.
 *
 * Fields that were never received are omitted entirely (never rendered as "—"),
 * so a feed that only relays a status reads as a short line rather than a wall
 * of blanks. Surfaced on hover so the fixed-height rail row is never disturbed
 * on the 1920×1080 wall.
 */
function coreSystemDetail(row: CoreSystemRow): string {
  const parts: string[] = [];
  if (row.host) parts.push(`Host ${row.host}`);
  if (row.endpoint) parts.push(`Endpoint ${row.endpoint}${row.port != null ? `:${row.port}` : ''}`);
  else if (row.port != null) parts.push(`Port ${row.port}`);
  if (row.containerStatus) parts.push(`Container ${row.containerStatus}`);
  if (row.restartCount != null) parts.push(`Restarts ${row.restartCount}`);
  if (row.uptimeSeconds != null) parts.push(`Uptime ${formatUptime(row.uptimeSeconds)}`);
  if (row.latencyMs != null) parts.push(`Latency ${row.latencyMs}ms`);
  const age = relativeAge(row.lastCheck);
  if (age) parts.push(`Checked ${age}`);
  return parts.join(' · ');
}

function SystemNodeRow({ row }: { row: CoreSystemRow }) {
  const tone = toneHex(row.tone);
  const detail = coreSystemDetail(row);
  return (
    <div className="ow-sys-row" title={detail || undefined}>
      {/* Connector group — horizontal circuit trace into the vertical bus. */}
      <span className="ow-sys-connector" aria-hidden="true">
        <span className="ow-sys-trace" />
        <span
          className={`ow-sys-node ${NODE_CLASS[row.tone]}`}
          role="img"
          aria-label={detail ? `${row.name} — ${row.statusLabel}. ${detail}` : `${row.name} — ${row.statusLabel}`}
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
 * Left Core Systems rail — seven console rows (HAL, TRON, HAL n8n, LeadGen n8n,
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