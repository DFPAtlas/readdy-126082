import {
  getComputeCore,
  getAiSystemsStatus,
  toneHex,
  type ComputeNode,
  type AiSystemRow,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

function NodeMetrics({ node, accentColor }: { node: ComputeNode; accentColor: string }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
      {node.metrics.map((m) => (
        <div key={m.label} className="flex items-baseline justify-between border-b border-cyan-400/8 py-[3px]">
          <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">{m.label}</span>
          <span
            className="font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap"
            style={{ color: m.value === 'NOT MONITORED' || m.value === 'NOT CONNECTED' || m.value === '—' ? '#475569' : accentColor }}
          >
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function AiSystemPanel() {
  const rows = getAiSystemsStatus();
  return (
    <div className="ow-panel flex flex-col px-3 py-2 min-w-0">
      <div className="shrink-0 text-[9px] font-label tracking-[0.2em] text-cyan-300 border-b border-cyan-400/10 pb-1.5">
        AI SYSTEMS
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {rows.map((r) => (
          <AiSystemLine key={r.label} row={r} />
        ))}
      </div>
    </div>
  );
}

function AiSystemLine({ row }: { row: AiSystemRow }) {
  const tone = toneHex(row.tone);
  return (
    <div className="flex items-center justify-between py-[5px] border-b border-cyan-400/8 last:border-b-0">
      <span className="text-[8.5px] font-label tracking-[0.14em] text-slate-500 whitespace-nowrap">{row.label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-semibold whitespace-nowrap" style={{ color: tone }}>
          {row.value}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${row.tone === 'green' ? 'ow-pulse' : row.tone === 'red' ? 'ow-alert' : ''}`}
          style={{ background: tone }}
        />
      </span>
    </div>
  );
}

/**
 * Lower-centre Compute Core — HAL (orchestration) and TRON (AI overwatch)
 * side by side with a linked-status spine, plus the compact AI Systems
 * diagnostic block on the right.
 */
export default function ComputeCore() {
  const { hal, tron, link } = getComputeCore();
  const halColor = hal.tone === 'green' ? '#fb923c' : toneHex(hal.tone);
  const tronColor = '#a78bfa';
  const linkColor = toneHex(link.tone);

  return (
    <section className="shrink-0 mt-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] font-bold tracking-[0.16em] text-slate-100">COMPUTE CORE</span>
        <span className="ow-hairline flex-1" />
        <span className="text-[8.5px] font-label tracking-[0.18em] text-slate-500">THE ENGINE THAT KEEPS DFP MOVING</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 min-h-0">
        {/* HAL */}
        <div className="ow-panel px-3 py-2 min-w-0" style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center border rounded-sm" style={{ borderColor: '#fb923c', color: '#fb923c', background: '#fb923c14' }}>
              <i className="ri-cpu-line text-[13px]"></i>
            </span>
            <div className="leading-tight">
              <span className="text-[12px] font-bold tracking-[0.1em]" style={{ color: '#fb923c' }}>HAL</span>
              <span className="block text-[7.5px] font-label tracking-[0.18em] text-slate-500">ORCHESTRATION NODE</span>
            </div>
            <span className="ml-auto text-[8.5px] font-label tracking-[0.12em]" style={{ color: toneHex(hal.tone) }}>
              {hal.stateLabel}
            </span>
          </div>
          <NodeMetrics node={hal} accentColor={halColor} />
        </div>

        {/* Link spine */}
        <div className="flex flex-col items-center justify-center px-2 min-w-0">
          <div className="text-center leading-tight">
            <span className="font-mono text-[10px] tracking-[0.08em]" style={{ color: linkColor }}>HAL ↔ TRON</span>
            <div className="text-[8px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: linkColor }}>{link.label}</div>
          </div>
          <div className="relative w-full h-px mt-2" style={{ background: 'rgba(34,211,238,0.2)' }}>
            <span className="ow-link absolute top-1/2 -translate-y-1/2 left-0 w-1.5 h-1.5 rounded-full" style={{ background: '#67e8f9', boxShadow: '0 0 8px #67e8f9' }} />
          </div>
        </div>

        {/* TRON */}
        <div className="ow-panel px-3 py-2 min-w-0" style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center border rounded-sm" style={{ borderColor: '#a78bfa', color: '#a78bfa', background: '#a78bfa14' }}>
              <i className="ri-radar-line text-[13px]"></i>
            </span>
            <div className="leading-tight">
              <span className="text-[12px] font-bold tracking-[0.1em]" style={{ color: '#a78bfa' }}>TRON</span>
              <span className="block text-[7.5px] font-label tracking-[0.18em] text-slate-500">AI OVERWATCH</span>
            </div>
            <span className="ml-auto text-[8.5px] font-label tracking-[0.12em]" style={{ color: toneHex(tron.tone) }}>
              {tron.stateLabel}
            </span>
          </div>
          <NodeMetrics node={tron} accentColor={tronColor} />
        </div>

        {/* AI Systems diagnostic block */}
        <AiSystemPanel />
      </div>
    </section>
  );
}