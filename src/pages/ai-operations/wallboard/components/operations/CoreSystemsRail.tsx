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

function SystemRow({ row }: { row: CoreSystemRow }) {
  const tone = toneHex(row.tone);
  return (
    <div className="flex items-center gap-3 px-3 py-[7px] border-b border-cyan-400/8 last:border-b-0">
      <span className="w-8 h-8 flex items-center justify-center border border-cyan-400/15 rounded-md" style={{ color: row.tone === 'muted' ? '#64748b' : '#67e8f9' }}>
        <i className={`${SYSTEM_ICON[row.key] ?? 'ri-server-line'} text-[15px]`}></i>
      </span>

      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-[13px] font-semibold tracking-[0.08em] text-slate-200 whitespace-nowrap">
          {row.name}
        </div>
        <div className="text-[8.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">
          {row.subtitle}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-label tracking-[0.12em] whitespace-nowrap" style={{ color: tone }}>
          {row.statusLabel}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${row.tone === 'green' ? 'ow-pulse' : row.tone === 'red' ? 'ow-alert' : ''}`}
          style={{ background: tone }}
        />
      </div>
    </div>
  );
}

/**
 * Left Core Systems rail — seven integrated console rows (HAL, TRON, N8N-01,
 * N8N-02, Supabase, Network, Storage) plus the DFP identity block at the base.
 */
export default function CoreSystemsRail() {
  const systems = getCoreSystems();

  return (
    <aside className="flex flex-col min-h-0 h-full">
      <div className="ow-panel ow-glow-cyan flex flex-col flex-1 min-h-0">
        <div className="shrink-0 px-3 py-2 border-b border-cyan-400/15">
          <span className="text-[10px] font-label tracking-[0.24em] text-cyan-300">CORE SYSTEMS</span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {systems.map((row) => (
            <SystemRow key={row.key} row={row} />
          ))}
        </div>
      </div>

      {/* DFP identity block */}
      <div className="shrink-0 mt-3 ow-panel flex flex-col items-center justify-center py-3 px-3 border-orange-500/20">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center border border-orange-500/40 rounded-sm">
            <span className="text-[11px] font-bold text-orange-400">D</span>
          </span>
          <span className="text-[15px] font-bold tracking-[0.22em] text-slate-100">DFP</span>
        </div>
        <div className="text-[8.5px] font-label tracking-[0.3em] text-slate-500 mt-1">
          DIGITAL FOOTPRINT
        </div>
        <div className="text-[8px] font-label tracking-[0.14em] text-orange-400/70 mt-1">
          CONNECTED SYSTEMS // STRONGER OUTCOMES
        </div>
      </div>
    </aside>
  );
}