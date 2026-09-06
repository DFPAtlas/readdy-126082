import {
  getMasterAgentRows,
  toneHex,
  type MasterAgentRow,
  type MasterRowState,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';
import {
  getQuickGuardManagerReport,
  type QuickGuardManagerReport,
} from '@/pages/ai-operations/wallboard/managerReportSelectors';

// Stable key → short command code. Authoritative mapping, never array order.
const SITE_CODE: Record<string, string> = {
  qg: 'QG',
  bn: 'BN',
  gh: 'GH',
  lethub: 'LH',
  gg: 'GG',
  vowora: 'VW',
  synq: 'SQ',
};

const SITE_ORDER = ['qg', 'bn', 'gh', 'lethub', 'gg', 'vowora', 'synq'];

// Presentation colours aligned to the command-centre state semantics. Standby
// is muted cyan and unassigned is dim grey — deliberately distinct from the
// shared `tone` field so the two never read the same on the wall.
const STATE_COLOR: Record<MasterRowState, string> = {
  running: '#22c55e',
  review: '#f59e0b',
  standby: '#22d3ee',
  failed: '#ef4444',
  blocked: '#ef4444',
  unassigned: '#64748b',
};

// failed / blocked collapse onto the same red alert treatment.
const STATE_CLASS: Record<MasterRowState, string> = {
  running: 'running',
  review: 'review',
  standby: 'standby',
  failed: 'blocked',
  blocked: 'blocked',
  unassigned: 'unassigned',
};

// Fixed constellation geometry (SVG user units, viewBox 260 × 250).
const CX = 130;
const CY = 122;
const RING = 78;
const NODE_R = 16;
const HUB_R = 25;

/** Honest task line: MASTER NOT ASSIGNED when unassigned, NO ACTIVE COMMAND
 *  when there is no real task, otherwise the real task text. Never a generated
 *  id, progress value or agent reference. */
function taskLabel(row: MasterAgentRow): string {
  if (row.state === 'unassigned') return 'MASTER NOT ASSIGNED';
  const t = (row.task ?? '').trim();
  if (!t || /^no (active task|master agent)$/i.test(t)) return 'NO ACTIVE COMMAND';
  return t;
}

interface SiteNode {
  key: string;
  code: string;
  row: MasterAgentRow | undefined;
  x: number;
  y: number;
}

/** Seven site masters arranged radially around the DFP hub, resolved by stable
 *  key (never the array order of getMasterAgentRows()). */
function siteNodes(rows: MasterAgentRow[]): SiteNode[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const n = SITE_ORDER.length;
  return SITE_ORDER.map((key, i) => {
    const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
    return {
      key,
      code: SITE_CODE[key],
      row: byKey.get(key),
      x: CX + RING * Math.cos(angle),
      y: CY + RING * Math.sin(angle),
    };
  });
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'red' | 'cyan';
}) {
  return (
    <div className="text-center">
      <div className="text-[15px] font-bold leading-none tabular-nums" style={{ color: toneHex(tone) }}>
        {value}
      </div>
      <div className="text-[7px] font-label tracking-[0.12em] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function MissionRow({ row, report }: { row: MasterAgentRow; report?: QuickGuardManagerReport }) {
  const tone = STATE_COLOR[row.state];
  const task = taskLabel(row);
  return (
    <div className="ow-mission-row" title={task} aria-label={`${row.label} — ${row.stateLabel} — ${task}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold tracking-[0.04em] text-slate-200 truncate">{row.label}</span>
        <span
          className="ow-mission-badge"
          style={{ color: tone, borderColor: `${tone}55`, background: `${tone}16` }}
        >
          {row.stateLabel}
        </span>
      </div>
      <div className="text-[11px] text-slate-300 truncate mt-0.5">{task}</div>
      <div className="font-mono text-[8.5px] tracking-[0.06em] text-slate-600 truncate mt-0.5">{row.refKey}</div>
      {report && report.source !== 'loading' && (
        <div className="flex items-center gap-1.5 mt-0.5 leading-none">
          <span className="text-[8px] font-semibold tracking-[0.04em]" style={{ color: toneHex(report.reportingTone) }}>
            REPORT {report.reportingLabel}
          </span>
          {report.businessHealth && (
            <span className="text-[8px] font-semibold tracking-[0.04em]" style={{ color: toneHex(report.businessHealthTone) }}>
              BUSINESS {report.businessHealth}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Constellation({ rows, dfp }: { rows: MasterAgentRow[]; dfp: MasterAgentRow | undefined }) {
  const nodes = siteNodes(rows);
  const dfpClass = dfp ? STATE_CLASS[dfp.state] : 'unassigned';
  const dfpColor = dfp ? STATE_COLOR[dfp.state] : STATE_COLOR.unassigned;
  const dfpStateLabel = dfp ? dfp.stateLabel : 'NOT ASSIGNED';

  return (
    <div className="ow-constellation">
      <svg
        className="ow-const-svg"
        viewBox="0 0 260 250"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Autonomous command constellation"
      >
        {/* Command links — hub → each site node, treated by the node's state. */}
        {nodes.map((n) => (
          <line
            key={`link-${n.key}`}
            x1={CX}
            y1={CY}
            x2={n.x}
            y2={n.y}
            className={`ow-const-link ow-const-link-${n.row ? STATE_CLASS[n.row.state] : 'unassigned'}`}
          />
        ))}

        {/* DFP MASTER hub — ring + links react to the real DFP row state. */}
        <g>
          <title>{`DFP MASTER — ${dfpStateLabel}`}</title>
          <circle cx={CX} cy={CY} r={31} className={`ow-const-energy ow-const-energy-${dfpClass}`} />
          <circle cx={CX} cy={CY} r={HUB_R} className={`ow-const-hub ow-const-hub-${dfpClass}`} />
          <text x={CX} y={CY - 3} textAnchor="middle" dominantBaseline="central" className="ow-const-hub-dfp">
            DFP
          </text>
          <text x={CX} y={CY + 9} textAnchor="middle" dominantBaseline="central" className="ow-const-hub-master">
            MASTER
          </text>
          <text
            x={CX}
            y={CY + 42}
            textAnchor="middle"
            dominantBaseline="central"
            className="ow-const-state"
            style={{ fill: dfpColor }}
          >
            {dfpStateLabel}
          </text>
        </g>

        {/* Seven site-master nodes. */}
        {nodes.map((n) => {
          const cls = n.row ? STATE_CLASS[n.row.state] : 'unassigned';
          const color = n.row ? STATE_COLOR[n.row.state] : STATE_COLOR.unassigned;
          const stateLabel = n.row ? n.row.stateLabel : 'NOT ASSIGNED';
          const codeColor = cls === 'unassigned' ? '#475569' : '#e2e8f0';
          return (
            <g key={n.key}>
              <title>{`${n.code} — ${stateLabel}`}</title>
              <circle cx={n.x} cy={n.y} r={NODE_R} className={`ow-const-node ow-const-node-${cls}`} />
              {cls === 'review' && <circle cx={n.x} cy={n.y} r={NODE_R} className="ow-const-sweep" />}
              <circle cx={n.x} cy={n.y - NODE_R} r={2.5} className={`ow-const-dot ow-const-dot-${cls}`} />
              <text
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="ow-const-code"
                style={{ fill: codeColor }}
              >
                {n.code}
              </text>
              <text
                x={n.x}
                y={n.y + NODE_R + 10}
                textAnchor="middle"
                dominantBaseline="central"
                className="ow-const-state"
                style={{ fill: color }}
              >
                {stateLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Right Autonomous Operations rail — a graphical command constellation
 * (DFP MASTER hub + seven site masters) with live state totals and a compact
 * mission list, all driven by the authoritative getMasterAgentRows() selector.
 */
export default function AutonomousOperationsRail() {
  const rows = getMasterAgentRows();
  const dfp = rows.find((r) => r.key === 'dfp');
  const qgReport = getQuickGuardManagerReport();

  // Derived counters — straight from the eight returned rows (never hard-coded).
  const running = rows.filter((r) => r.state === 'running').length;
  const review = rows.filter((r) => r.state === 'review').length;
  const blocked = rows.filter((r) => r.state === 'failed' || r.state === 'blocked').length;
  const assigned = rows.filter((r) => r.state !== 'unassigned').length;

  return (
    <aside className="flex flex-col min-h-0 h-full w-full max-w-full overflow-hidden">
      <div className="ow-panel ow-glow-cyan flex flex-col flex-1 min-h-0 w-full max-w-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-3 pt-2 pb-1.5 border-b border-cyan-400/15">
          <div className="text-[10px] font-label tracking-[0.24em] text-cyan-300">AUTONOMOUS OPERATIONS</div>
          <div className="text-[8px] font-label tracking-[0.18em] text-slate-500 mt-0.5">MASTER AGENT COMMAND</div>
        </div>

        {/* Command constellation graphic */}
        <Constellation rows={rows} dfp={dfp} />

        {/* Live state totals */}
        <div className="shrink-0 flex items-center justify-around px-2 py-1.5 border-y border-cyan-400/10">
          <Total label="RUNNING" value={running} tone="green" />
          <Total label="REVIEW" value={review} tone="amber" />
          <Total label="BLOCKED" value={blocked} tone="red" />
          <Total label="ASSIGNED" value={assigned} tone="cyan" />
        </div>

        {/* Compact master-agent mission list */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {rows.map((row) => (
            <MissionRow key={row.key} row={row} report={row.key === 'qg' ? qgReport : undefined} />
          ))}
        </div>
      </div>
    </aside>
  );
}