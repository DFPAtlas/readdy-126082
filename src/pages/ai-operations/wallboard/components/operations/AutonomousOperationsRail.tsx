import {
  getMasterAgentRows,
  toneHex,
  type MasterAgentRow,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

const TOTAL_SEGMENTS = 8;

function Segments({ progress, tone }: { progress: number; tone: string }) {
  const segments = Array.from({ length: TOTAL_SEGMENTS }, (_, i) => i < progress);
  return (
    <span className="inline-flex gap-[2px]" aria-label={`${progress} of ${TOTAL_SEGMENTS} segments`}>
      {segments.map((on, i) => (
        <span
          key={i}
          className="w-[4px] h-[9px]"
          style={{ background: on ? tone : 'rgba(34,211,238,0.15)' }}
        />
      ))}
    </span>
  );
}

function AgentRow({ row }: { row: MasterAgentRow }) {
  const tone = toneHex(row.tone);
  return (
    <div className="flex items-center gap-2 px-3 py-[6px] border-b border-cyan-400/8 last:border-b-0">
      <div className="w-[86px] min-w-0 leading-tight">
        <div className="text-[11px] font-semibold tracking-[0.05em] text-slate-200 truncate">{row.label}</div>
      </div>

      <div className="w-[58px] shrink-0 flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${row.state === 'running' ? 'ow-pulse' : row.state === 'failed' || row.state === 'blocked' ? 'ow-alert' : ''}`}
          style={{ background: tone }}
        />
        <span className="text-[9px] font-label tracking-[0.08em] whitespace-nowrap" style={{ color: tone }}>
          {row.stateLabel}
        </span>
      </div>

      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-[9.5px] text-slate-400 truncate">{row.task}</div>
        <div className="font-mono text-[8px] tracking-[0.08em] text-slate-600">{row.taskId}</div>
      </div>

      <div className="shrink-0">
        <Segments progress={row.progress} tone={tone} />
      </div>
    </div>
  );
}

/**
 * Right Autonomous Operations rail — a command status table of eight master
 * agents (AGENT / STATE / TASK / segmented PROGRESS), not an admin data table.
 */
export default function AutonomousOperationsRail() {
  const rows = getMasterAgentRows();

  return (
    <aside className="flex flex-col min-h-0 h-full">
      <div className="ow-panel flex flex-col flex-1 min-h-0">
        <div className="shrink-0 px-3 py-2 border-b border-cyan-400/15">
          <div className="text-[10px] font-label tracking-[0.24em] text-cyan-300">AUTONOMOUS OPERATIONS</div>
          <div className="text-[8px] font-label tracking-[0.18em] text-slate-500 mt-0.5">MASTER AGENTS STATUS</div>
        </div>

        <div className="shrink-0 grid grid-cols-[86px_58px_1fr_auto] gap-2 px-3 py-1 border-b border-cyan-400/10">
          <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500">AGENT</span>
          <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500">STATE</span>
          <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500">TASK</span>
          <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500">PROG</span>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {rows.map((row) => (
            <AgentRow key={row.key} row={row} />
          ))}
        </div>
      </div>
    </aside>
  );
}