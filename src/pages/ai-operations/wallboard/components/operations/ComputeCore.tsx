import type { CSSProperties } from 'react';
import {
  getComputeCore,
  getAiSystemsStatus,
  toneHex,
  type Tone,
  type ComputeGauge,
  type ComputeNode,
  type TronDial,
  type TronDialTone,
  type AiSystemRow,
  type ComputeStatusRow,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';
import { getRuntimeResilienceView } from '@/pages/ai-operations/wallboard/runtimeResilienceStore';
import {
  isWatchdogRunning,
  isWatchdogFault,
  RECOVERY_TARGET_MS,
  type RuntimeResilienceNode,
} from '@/lib/ai-operations/runtimeResilience';
import {
  HeartbeatECG,
  WatchdogStatusIndicator,
  RecoveryStatusIndicator,
  type EcgState,
  type WatchdogVisual,
  type RecoveryVisual,
} from '@/pages/ai-operations/wallboard/components/operations/resilienceIndicators';

const DIAL_ACCENT: Record<'orange' | 'cyan', string> = {
  orange: '#fb923c',
  cyan: '#22d3ee',
};

const DIAL_GLOW: Record<'orange' | 'cyan', string> = {
  orange: 'rgba(251, 146, 60, 0.35)',
  cyan: 'rgba(34, 211, 238, 0.35)',
};

const TRON_TONE_HEX: Record<TronDialTone, string> = {
  violet: '#8b5cf6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  muted: '#64748b',
};

const TRON_TONE_GLOW: Record<TronDialTone, string> = {
  violet: 'rgba(139, 92, 246, 0.4)',
  green: 'rgba(34, 197, 94, 0.4)',
  amber: 'rgba(245, 158, 11, 0.4)',
  red: 'rgba(239, 68, 68, 0.4)',
  muted: 'rgba(100, 116, 139, 0.15)',
};

function metricColor(value: string, accentColor: string): string {
  return value === 'NOT MONITORED' || value === 'NOT CONNECTED' || value === 'NOT CONFIGURED' || value === '—'
    ? '#475569'
    : accentColor;
}

/** Amber provenance badge — shown on a runtime card when its latest heartbeat
 *  is simulated (heartbeat_key starts with SIM-). A following real heartbeat
 *  clears it automatically. */
function SimulatedBadge() {
  return (
    <span className="text-[7px] font-bold tracking-[0.1em] px-1 py-0.5 rounded-sm border shrink-0" style={{ color: '#f59e0b', borderColor: '#f59e0b55', background: '#f59e0b14' }}>
      SIMULATED
    </span>
  );
}

/** Recovery SLA target label, derived from the single authoritative constant. */
const TARGET_LABEL = `<${Math.round(RECOVERY_TARGET_MS / 1000)}s`;

/** Find a runtime-resilience node by its stable bridge-key suffix (hal / tron). */
function findResilienceNode(nodes: RuntimeResilienceNode[], key: 'hal' | 'tron'): RuntimeResilienceNode | null {
  return nodes.find((n) => n.nodeKey.toLowerCase().includes(key)) ?? null;
}

/** Map a watchdog status string onto a compact display label + tone + visual state. */
function watchdogDisplay(status: string | null): { label: string; color: string; state: WatchdogVisual } {
  if (isWatchdogFault(status)) return { label: 'FAULT', color: '#ef4444', state: 'fault' };
  if (isWatchdogRunning(status)) return { label: 'RUNNING', color: '#22c55e', state: 'running' };
  if (status?.trim().toLowerCase() === 'recovering') return { label: 'RECOVERING', color: '#f59e0b', state: 'recovering' };
  return { label: '—', color: '#64748b', state: 'none' };
}

function formatRecovery(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Recovery display values — never renders PASS without real recovery data. */
function recoveryDisplay(node: RuntimeResilienceNode | null): {
  value: string;
  result: string;
  valueColor: string;
  resultColor: string;
  state: RecoveryVisual;
} {
  if (!node) {
    return { value: '—', result: '—', valueColor: '#64748b', resultColor: '#64748b', state: 'none' };
  }
  if (node.nodeStatus === 'RECOVERING') {
    return { value: 'IN PROGRESS', result: '—', valueColor: '#f59e0b', resultColor: '#64748b', state: 'progress' };
  }
  if (node.lastRecoveryMs == null) {
    return { value: '—', result: '—', valueColor: '#64748b', resultColor: '#64748b', state: 'none' };
  }
  const met = node.recoveryTargetMet;
  const pass = met === true;
  const result = met == null ? '—' : pass ? 'PASS' : 'FAIL';
  const color = met == null ? '#64748b' : pass ? '#22c55e' : '#ef4444';
  // A healthy success glow is only shown while the node is actually reachable
  // (HEALTHY or DEGRADED). While OFFLINE or in WATCHDOG FAULT, the last-known
  // recovery value stays readable but must not present a "currently healthy"
  // success treatment.
  const unreachable = node.nodeStatus === 'OFFLINE' || node.nodeStatus === 'WATCHDOG FAULT';
  const state: RecoveryVisual = unreachable ? 'none' : met == null ? 'none' : pass ? 'pass' : 'fail';
  return { value: formatRecovery(node.lastRecoveryMs), result, valueColor: color, resultColor: color, state };
}

// ---------------------------------------------------------------------------
// DFP Relay — live cross-node status (HAL ⇄ DFP COMMAND ⇄ TRON).
// Each side derives from its own node (ComputeNode) + resilience snapshot; the
// centre derives from both. No new data model — everything reuses the existing
// bridge/heartbeat/watchdog/recovery signals already composed for the cards.
// ---------------------------------------------------------------------------

type RelaySide = 'live' | 'degraded' | 'offline' | 'recovering';
type RelayOverall = 'healthy' | 'degraded' | 'recovering' | 'offline' | 'partial';

const RELAY_SIDE_LABEL: Record<RelaySide, string> = {
  live: 'LIVE',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  recovering: 'RECOVERING',
};

const RELAY_SIDE_COLOR: Record<RelaySide, string> = {
  live: '#22c55e',
  degraded: '#f59e0b',
  offline: '#ef4444',
  recovering: '#f59e0b',
};

const RELAY_OVERALL_LABEL: Record<RelayOverall, string> = {
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  recovering: 'RECOVERING',
  offline: 'OFFLINE',
  partial: 'PARTIAL',
};

const RELAY_OVERALL_COLOR: Record<RelayOverall, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  recovering: '#f59e0b',
  offline: '#ef4444',
  partial: '#f59e0b',
};

/** Per-node relay side state — the node's own runtime signal, with active
 *  recovery from its resilience snapshot taking precedence. */
function relaySideState(node: ComputeNode, res: RuntimeResilienceNode | null): RelaySide {
  if (res?.nodeStatus === 'RECOVERING') return 'recovering';
  if (node.state === 'nominal') return 'live';
  if (node.state === 'offline') return 'offline';
  return 'degraded';
}

/** Centre state derived from the two sides (never a competing timer). */
function relayOverallState(halSide: RelaySide, tronSide: RelaySide): RelayOverall {
  if (halSide === 'recovering' || tronSide === 'recovering') return 'recovering';
  if (halSide === 'live' && tronSide === 'live') return 'healthy';
  if (halSide === 'offline' && tronSide === 'offline') return 'offline';
  if (halSide === 'offline' || tronSide === 'offline') return 'partial';
  return 'degraded';
}

/** Compact per-node state line (HAL LIVE / TRON OFFLINE …). */
function RelaySideLabel({ node, side }: { node: 'HAL' | 'TRON'; side: RelaySide }) {
  const color = RELAY_SIDE_COLOR[side];
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="text-[7.5px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">{node}</span>
      <span className="flex items-center gap-1">
        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-mono text-[8px] font-semibold tracking-[0.06em] whitespace-nowrap" style={{ color }}>
          {RELAY_SIDE_LABEL[side]}
        </span>
      </span>
    </div>
  );
}

/** Compact summary count row (BRIDGES 2/2 · HEARTBEATS 2/2 · …). */
function RelaySummaryRow({ label, value, color, dot }: { label: string; value: string; color: string; dot: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {dot && <span className="ow-summary-dot" style={{ background: '#22c55e' }} aria-hidden="true" />}
      <span className="text-[7px] font-label tracking-[0.12em] text-slate-500 whitespace-nowrap">{label}</span>
      <span className="font-mono text-[7px] font-semibold tabular-nums tracking-[0.02em] whitespace-nowrap" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/** Icons for the role-specific system states (HAL: HAL n8n / LeadGen n8n /
 *  MASTER / BRIDGE, TRON: RAG / OVERWATCH / BRIDGE). */
const ROLE_ICONS: Record<string, string> = {
  'HAL N8N': 'ri-git-branch-line',
  'LEADGEN N8N': 'ri-flow-chart',
  N8N: 'ri-git-branch-line',
  MASTER: 'ri-cpu-line',
  BRIDGE: 'ri-link-m',
  RAG: 'ri-database-2-line',
  OVERWATCH: 'ri-radar-line',
};

/** A single role-specific system state — a compact inline row (status icon +
 *  label + status text) rather than a bordered table cell. The status dot
 *  breathes gently only while healthy; muted states stay neutral.
 *
 *  AWAITING TELEMETRY rows (RAG / OVERWATCH with no authoritative source yet)
 *  present a neutral muted status with a subtle identity-specific dormant
 *  effect (RAG scan / OVERWATCH radar sweep) — the system is defined, never
 *  "broken". */
function RoleStatusTile({ row }: { row: ComputeStatusRow }) {
  const tone = toneHex(row.tone);
  const icon = ROLE_ICONS[row.label] ?? 'ri-shield-star-line';
  const healthy = row.tone === 'green';
  const isAwaiting = row.tone === 'muted' && row.value === 'AWAITING TELEMETRY';
  const isRag = row.label === 'RAG';
  const isOverwatch = row.label === 'OVERWATCH';

  // Identity-specific icon treatment: a dormant scan/sweep while awaiting
  // telemetry, or a subtle active glow/sweep once real live telemetry is wired
  // (green tone).
  const iconEffect = isAwaiting
    ? isRag ? 'ow-role-dormant-rag' : isOverwatch ? 'ow-role-dormant-overwatch' : ''
    : healthy && isRag ? 'ow-role-active-rag'
      : healthy && isOverwatch ? 'ow-role-active-overwatch'
        : '';

  const valueCell = (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAwaiting ? 'ow-standby-pulse' : healthy ? 'ow-pulse' : ''}`} style={{ background: tone }} />
      <span className="font-mono text-[10.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: tone }}>{row.value}</span>
    </span>
  );

  return (
    <div className="py-[3px]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 ${iconEffect}`} style={{ color: row.tone === 'muted' ? '#64748b' : tone }}>
            <i className={`${icon} text-[10px]`}></i>
          </span>
          <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">{row.label}</span>
        </span>
        {valueCell}
      </div>
      {row.detail ? (
        <div className="flex items-center justify-end mt-[1px]">
          <span className="text-[6.5px] font-label tracking-[0.12em] text-slate-600 whitespace-nowrap">{row.detail}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Map a heartbeat/bridge metric text onto the ECG visual state. */
function ecgState(value: string): EcgState {
  if (value === 'LIVE') return 'live';
  if (value === 'STALE') return 'stale';
  if (value === 'OFFLINE') return 'offline';
  return 'none';
}

/**
 * HUD-style circular telemetry dial for HAL's CPU / memory percentages.
 * Truthful: a stored numeric value alone is NOT live — the reading is LIVE
 * (glow + pulse) only while HAL's own heartbeat is fresh. A stale or offline
 * heartbeat shows the retained value as LAST KNOWN / STALE or LAST KNOWN /
 * OFFLINE with no live animation; missing telemetry renders an em-dash and
 * never a fabricated zero.
 */
function TelemetryDial({ gauge, nodeName }: { gauge: ComputeGauge; nodeName: string }) {
  const accent = DIAL_ACCENT[gauge.accent];
  const glow = DIAL_GLOW[gauge.accent];
  const hasValue = gauge.percent != null && Number.isFinite(gauge.percent);
  const isLive = hasValue && gauge.freshness === 'live';
  const clamped = hasValue ? Math.max(0, Math.min(100, gauge.percent as number)) : 0;
  const deg = clamped * 3.6;
  const statusLabel = !hasValue
    ? 'NOT MONITORED'
    : isLive
      ? 'LIVE'
      : gauge.freshness === 'offline'
        ? 'LAST KNOWN / OFFLINE'
        : 'LAST KNOWN / STALE';
  const ringAccent = isLive ? accent : '#64748b';
  const statusColor = isLive ? accent : '#64748b';
  const ariaLabel = hasValue
    ? `${nodeName} ${gauge.label.toLowerCase()} utilization ${clamped.toFixed(1)} percent, ${isLive ? 'live' : 'last known'}`
    : `${nodeName} ${gauge.label.toLowerCase()} utilization not monitored`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`ow-dial ${isLive ? 'ow-dial-live' : 'ow-dial-empty'}`}
        role="img"
        aria-label={ariaLabel}
        style={{
          '--ow-dial-fill': `${deg}deg`,
          '--ow-dial-accent': ringAccent,
          '--ow-dial-glow': glow,
        } as CSSProperties}
      >
        <div className="ow-dial-center">
          <span className="ow-dial-value font-mono" style={{ color: hasValue ? (isLive ? accent : '#94a3b8') : '#475569' }}>
            {hasValue ? gauge.value : '—'}
          </span>
        </div>
      </div>
      <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">{gauge.label}</span>
      <span className="flex items-center gap-[3px]">
        <span
          className={`w-1 h-1 rounded-full ${isLive ? 'ow-dial-pulse' : ''}`}
          style={{ background: statusColor }}
        />
        <span className="text-[7.5px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </span>
    </div>
  );
}

/**
 * TRON HUD instrument — a non-percentage circular dial. The MODELS dial shows a
 * live Ollama model count on a violet segmented ring with a slow orbiting
 * highlight; the OLLAMA dial shows a status word (LIVE/ALERT/N/C/—) on a
 * status-tinted ring. Never fabricates a percentage.
 */
function TronInstrument({ dial, nodeName }: { dial: TronDial; nodeName: string }) {
  const isModels = dial.key === 'models';
  const tone = TRON_TONE_HEX[dial.tone];
  const glow = TRON_TONE_GLOW[dial.tone];
  const hasValue = dial.live;
  const centreColor = hasValue ? (isModels ? '#c4b5fd' : tone) : '#475569';
  // Healthy (green) and degraded (amber) both breathe; red/muted/violet stay steady.
  const pulseLive = hasValue && (dial.tone === 'green' || dial.tone === 'amber');

  const ariaLabel = `${nodeName} ${dial.label.toLowerCase()} ${dial.value} ${dial.statusLabel.toLowerCase()}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`ow-tron-dial ${isModels ? 'ow-tron-dial-models' : 'ow-tron-dial-ollama'} ${hasValue ? 'ow-tron-dial-live' : 'ow-tron-dial-empty'}`}
        role="img"
        aria-label={ariaLabel}
        style={{
          '--ow-tron-status': tone,
          '--ow-tron-glow': glow,
        } as CSSProperties}
      >
        {isModels && hasValue && <span className="ow-tron-orbit" aria-hidden="true" />}
        <div className="ow-tron-dial-center">
          <span className="ow-tron-dial-value font-mono" style={{ color: centreColor }}>
            {dial.value}
          </span>
        </div>
      </div>
      <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">{dial.label}</span>
      <span className="flex items-center gap-[3px]">
        <span
          className={`w-1 h-1 rounded-full ${pulseLive ? 'ow-tron-pulse' : ''}`}
          style={{ background: hasValue ? tone : '#64748b', '--ow-tron-glow': glow } as CSSProperties}
        />
        <span className="text-[7.5px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: hasValue ? tone : '#64748b' }}>
          {dial.statusLabel}
        </span>
      </span>
    </div>
  );
}

const AI_INSTRUMENT_ACCENT: Record<Tone, { accent: string; glow: string }> = {
  green: { accent: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
  amber: { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)' },
  red: { accent: '#ef4444', glow: 'rgba(239, 68, 68, 0.35)' },
  cyan: { accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)' },
  muted: { accent: '#64748b', glow: 'rgba(100, 116, 139, 0.15)' },
};

// Vector DB uses a cyan identity for its connected state; everything else
// (red disconnected / muted unknown) reuses the shared tone accents.
const VECTOR_CONNECTED = { accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)' };

function vectorAccent(tone: Tone): { accent: string; glow: string } {
  return tone === 'cyan' ? VECTOR_CONNECTED : AI_INSTRUMENT_ACCENT[tone];
}

function AiSystemPanel() {
  const rows = getAiSystemsStatus();
  const vector = rows.find((r) => r.key === 'vector_db');
  const tools = rows.find((r) => r.key === 'tools');
  const model = rows.find((r) => r.key === 'model_status');
  const safety = rows.find((r) => r.key === 'safety');
  if (!vector || !tools || !model || !safety) return null;

  return (
    <div className="ow-panel flex flex-col px-3 py-2 min-w-0 max-w-full">
      <div className="shrink-0 text-[10px] font-label tracking-[0.24em] text-cyan-300 border-b border-cyan-400/10 pb-1.5">
        AI SYSTEMS
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div className="flex items-start justify-center gap-3">
          <VectorDbInstrument row={vector} />
          <ToolsInstrument row={tools} />
        </div>
        <div className="flex flex-col">
          <AiSystemStatusRow row={model} icon="ri-brain-line" />
          <AiSystemStatusRow row={safety} icon="ri-shield-line" alertIcon="ri-shield-flash-line" />
        </div>
      </div>
    </div>
  );
}

/**
 * Vector DB — cyan circular HUD with a live embedding count, slow orbiting
 * database nodes and a subtle data-flow animation. The ring is decorative and
 * never implies a percentage.
 */
function VectorDbInstrument({ row }: { row: AiSystemRow }) {
  const { accent, glow } = vectorAccent(row.tone);
  const connected = row.live;
  const hasCount = row.count != null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`ow-ai-instrument ow-ai-vector ${connected ? 'ow-ai-instrument-live' : 'ow-ai-instrument-empty'}`}
        role="img"
        aria-label={`Vector database ${row.value.toLowerCase()}${hasCount ? `, ${row.count} embeddings` : ''}`}
        style={{ '--ow-ai-accent': accent, '--ow-ai-glow': glow } as CSSProperties}
      >
        {connected && (
          <span className="ow-ai-vector-orbit" aria-hidden="true">
            <span className="ow-ai-node" />
            <span className="ow-ai-node ow-ai-node-2" />
            <span className="ow-ai-node ow-ai-node-3" />
          </span>
        )}
        <div className="ow-ai-center">
          <span className="ow-ai-value font-mono" style={{ color: hasCount ? accent : '#475569' }}>
            {hasCount ? row.count : '—'}
          </span>
        </div>
      </div>
      <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">{row.label}</span>
      <span className="flex items-center gap-[3px]">
        <span className="w-1 h-1 rounded-full" style={{ background: accent }} />
        <span className="text-[7.5px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: accent }}>
          {row.value}
        </span>
      </span>
    </div>
  );
}

/**
 * Tools — green/cyan segmented circuit ring with illuminated connection
 * points and a gentle sequential node pulse when online. The fixed segment
 * count is decorative and never represents a percentage.
 */
function ToolsInstrument({ row }: { row: AiSystemRow }) {
  const { accent, glow } = AI_INSTRUMENT_ACCENT[row.tone];
  const online = row.live;
  const hasCount = row.count != null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`ow-ai-instrument ow-ai-tools ${online ? 'ow-ai-tools-online ow-ai-instrument-live' : 'ow-ai-instrument-empty'}`}
        role="img"
        aria-label={`Tool network ${row.value.toLowerCase()}${hasCount ? `, ${row.count} online tools` : ''}`}
        style={{ '--ow-ai-accent': accent, '--ow-ai-glow': glow } as CSSProperties}
      >
        <span className="ow-ai-tools-point ow-ai-tools-point-1" aria-hidden="true" />
        <span className="ow-ai-tools-point ow-ai-tools-point-2" aria-hidden="true" />
        <span className="ow-ai-tools-point ow-ai-tools-point-3" aria-hidden="true" />
        <div className="ow-ai-center">
          <span className="ow-ai-value font-mono" style={{ color: hasCount ? accent : '#475569' }}>
            {hasCount ? row.count : '—'}
          </span>
        </div>
      </div>
      <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">{row.label}</span>
      <span className="flex items-center gap-[3px]">
        <span className="w-1 h-1 rounded-full" style={{ background: accent }} />
        <span className="text-[7.5px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: accent }}>
          {row.value}
        </span>
      </span>
    </div>
  );
}

/**
 * Compact full-width status row. MODEL STATUS carries a brain icon; SAFETY
 * carries a shield icon and, when ALERT, a controlled red glow + slow pulse
 * (never a rapid flash).
 */
function AiSystemStatusRow({ row, icon, alertIcon }: { row: AiSystemRow; icon: string; alertIcon?: string }) {
  const tone = toneHex(row.tone);
  const safetyAlert = row.key === 'safety' && row.value === 'ALERT';
  const iconName = safetyAlert && alertIcon ? alertIcon : icon;
  const dotClass = row.tone === 'green' ? 'ow-pulse' : safetyAlert ? 'ow-safety-pulse' : '';

  const valueCell = (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] font-semibold whitespace-nowrap" style={{ color: tone }}>
        {row.value}
      </span>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} style={{ background: tone }} />
    </span>
  );

  return (
    <div className={`flex items-center justify-between py-[5px] border-b border-cyan-400/8 last:border-b-0 ${safetyAlert ? 'ow-safety-alert' : ''}`}>
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0" style={{ color: safetyAlert ? tone : '#64748b' }}>
          <i className={`${iconName} text-[11px]`}></i>
        </span>
        <span className="text-[8.5px] font-label tracking-[0.14em] text-slate-500 whitespace-nowrap">{row.label}</span>
      </span>
      {row.detail ? (
        <span className="ow-safety-tip" tabIndex={0} aria-label={`${row.value} — ${row.detail}`}>
          {valueCell}
          <span className="ow-safety-tip-bubble" role="tooltip">{row.detail}</span>
        </span>
      ) : (
        valueCell
      )}
    </div>
  );
}

/**
 * Lower-centre Compute Core — HAL (orchestration) and TRON (AI overwatch)
 * side by side with a linked-status spine, plus the compact AI Systems
 * diagnostic block on the right. The body fills the constrained row height so
 * HAL, TRON, DFP Relay and AI Systems always share a single row.
 */
export default function ComputeCore() {
  const { hal, tron } = getComputeCore();
  const halColor = hal.tone === 'green' ? '#fb923c' : toneHex(hal.tone);
  const tronColor = '#a78bfa';

  // Runtime resilience — composed + evaluated data (same HAL/TRON source).
  const resilienceNodes = getRuntimeResilienceView()?.nodes ?? [];
  const halRes = findResilienceNode(resilienceNodes, 'hal');
  const tronRes = findResilienceNode(resilienceNodes, 'tron');
  const halWatchdog = watchdogDisplay(halRes?.watchdogStatus ?? null);
  const tronWatchdog = watchdogDisplay(tronRes?.watchdogStatus ?? null);
  const halRecovery = recoveryDisplay(halRes);
  const tronRecovery = recoveryDisplay(tronRes);

  // --- DFP Relay — live cross-node status (HAL ⇄ DFP COMMAND ⇄ TRON) ------
  const halSide = relaySideState(hal, halRes);
  const tronSide = relaySideState(tron, tronRes);
  const relayOverall = relayOverallState(halSide, tronSide);
  const overallColor = RELAY_OVERALL_COLOR[relayOverall];

  // Bridges + heartbeats — each node's own BRIDGE row + heartbeat signal.
  const halBridgeLive = hal.statusRows.some((r) => r.label === 'BRIDGE' && r.value === 'LIVE');
  const tronBridgeLive = tron.statusRows.some((r) => r.label === 'BRIDGE' && r.value === 'LIVE');
  const bridgesLive = (halBridgeLive ? 1 : 0) + (tronBridgeLive ? 1 : 0);

  const halHeartbeatLive = hal.heartbeat.value === 'LIVE';
  const tronHeartbeatLive = tron.heartbeat.value === 'LIVE';
  const heartbeatsLive = (halHeartbeatLive ? 1 : 0) + (tronHeartbeatLive ? 1 : 0);

  // Watchdogs — HAL + TRON only (2/2 semantics), never inferred from bridge.
  const halWatchdogActive = isWatchdogRunning(halRes?.watchdogStatus ?? null);
  const tronWatchdogActive = isWatchdogRunning(tronRes?.watchdogStatus ?? null);
  const watchdogsActive = (halWatchdogActive ? 1 : 0) + (tronWatchdogActive ? 1 : 0);
  const hasWatchdogData = Boolean(halRes?.hasResilienceSnapshot || tronRes?.hasResilienceSnapshot);

  // Recovery SLA — never PASS without real recovery data.
  const halRecoveryMet = halRes?.recoveryTargetMet ?? null;
  const tronRecoveryMet = tronRes?.recoveryTargetMet ?? null;
  const halHasRecovery = halRecoveryMet != null;
  const tronHasRecovery = tronRecoveryMet != null;
  const hasAnyRecovery = halHasRecovery || tronHasRecovery;
  const hasAllRecovery = halHasRecovery && tronHasRecovery;

  let slaLabel: string;
  let slaColor: string;
  if (!hasAnyRecovery) {
    slaLabel = 'PARTIAL';
    slaColor = '#64748b';
  } else if (!hasAllRecovery) {
    const known = halHasRecovery ? halRecoveryMet : tronRecoveryMet;
    slaLabel = known ? 'PARTIAL' : 'FAIL';
    slaColor = known ? '#f59e0b' : '#ef4444';
  } else {
    const pass = halRecoveryMet === true && tronRecoveryMet === true;
    slaLabel = pass ? 'PASS' : 'FAIL';
    slaColor = pass ? '#22c55e' : '#ef4444';
  }

  // Summary count colours (2/2 green · 1/2 amber · 0/2 red).
  const bridgesColor = bridgesLive === 2 ? '#22c55e' : bridgesLive === 1 ? '#f59e0b' : '#ef4444';
  const heartbeatsColor = heartbeatsLive === 2 ? '#22c55e' : heartbeatsLive === 1 ? '#f59e0b' : '#ef4444';
  const watchdogColor = !hasWatchdogData ? '#64748b' : watchdogsActive === 2 ? '#22c55e' : watchdogsActive === 1 ? '#f59e0b' : '#ef4444';

  return (
    <section className="ow-compute-core">
      <div className="ow-compute-heading">
        <span className="text-[11px] font-bold tracking-[0.16em] text-slate-100 whitespace-nowrap">COMPUTE CORE</span>
        <span className="ow-hairline flex-1" />
        <span className="text-[8.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">THE ENGINE THAT KEEPS DFP MOVING</span>
      </div>

      <div className="ow-compute-body">
        {/* HAL */}
        <div className="ow-panel flex flex-col px-3 py-2" style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
          <div className="shrink-0 flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center border rounded-sm" style={{ borderColor: '#fb923c', color: '#fb923c', background: '#fb923c14' }}>
              <i className="ri-cpu-line text-[13px]"></i>
            </span>
            <div className="leading-tight">
              <span className="text-[12px] font-bold tracking-[0.1em]" style={{ color: '#fb923c' }}>HAL</span>
              <span className="block text-[7.5px] font-label tracking-[0.18em] text-slate-500">ORCHESTRATION NODE</span>
            </div>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-[8.5px] font-label tracking-[0.12em]" style={{ color: toneHex(hal.tone) }}>
                {hal.stateLabel}
              </span>
              {hal.simulated && <SimulatedBadge />}
            </span>
          </div>

          {hal.gauges && hal.gauges.length > 0 && (
            <div className="shrink-0 flex items-start justify-center gap-4 mt-1.5">
              {hal.gauges.map((g) => (
                <TelemetryDial key={g.label} gauge={g} nodeName={hal.name} />
              ))}
            </div>
          )}

          <div className="shrink-0 ow-node-role mt-2">
            {hal.statusRows.map((row) => (
              <RoleStatusTile key={row.label} row={row} />
            ))}
          </div>

          <div className="shrink-0 ow-node-resilience mt-auto">
            <HeartbeatECG label={hal.heartbeat.label} state={ecgState(hal.heartbeat.value)} text={hal.heartbeat.value} accent={halColor} color={metricColor(hal.heartbeat.value, halColor)} recovering={halRes?.nodeStatus === 'RECOVERING'} />
            <WatchdogStatusIndicator state={halRes?.nodeStatus === 'OFFLINE' ? 'none' : halWatchdog.state} text={halWatchdog.label} color={halWatchdog.color} />
            <RecoveryStatusIndicator value={halRecovery.value} result={halRecovery.result} valueColor={halRecovery.valueColor} resultColor={halRecovery.resultColor} targetLabel={TARGET_LABEL} state={halRecovery.state} />
          </div>
        </div>

        {/* DFP Relay — HAL ⇄ DFP COMMAND ⇄ TRON live cross-node hub */}
        <div className="flex flex-col items-center justify-center px-1 min-w-0">
          <span className="font-mono text-[10px] tracking-[0.08em] whitespace-nowrap" style={{ color: overallColor }}>DFP RELAY</span>

          <div className="ow-relay mt-1.5" aria-label={`DFP relay ${RELAY_OVERALL_LABEL[relayOverall]}`}>
            <div className={`ow-relay-track ow-relay-track-hal ow-relay-track-${halSide}`}>
              <span className="ow-relay-packet ow-relay-packet-hal" />
              <span className="ow-relay-packet ow-relay-ack-hal" />
            </div>
            <div className={`ow-relay-core ow-relay-core-${relayOverall}`}>
              <i className="ri-node-tree text-[14px]"></i>
            </div>
            <div className={`ow-relay-track ow-relay-track-tron ow-relay-track-${tronSide}`}>
              <span className="ow-relay-packet ow-relay-packet-tron" />
              <span className="ow-relay-packet ow-relay-ack-tron" />
            </div>
          </div>

          {/* Compact per-node state (no duplicated telemetry). */}
          <div className="flex flex-col items-center gap-[3px] mt-1.5 min-w-0">
            <RelaySideLabel node="HAL" side={halSide} />
            <RelaySideLabel node="TRON" side={tronSide} />
          </div>

          {/* Cross-node summary counts. */}
          <div className="flex flex-col items-center gap-[3px] mt-1.5 min-w-0">
            <RelaySummaryRow label="BRIDGES" value={`${bridgesLive}/2`} color={bridgesColor} dot={bridgesLive === 2} />
            <RelaySummaryRow label="HEARTBEATS" value={`${heartbeatsLive}/2`} color={heartbeatsColor} dot={heartbeatsLive === 2} />
            <RelaySummaryRow label="WATCHDOGS" value={hasWatchdogData ? `${watchdogsActive}/2` : '—'} color={watchdogColor} dot={watchdogsActive === 2} />
            <div className="flex items-center justify-center gap-1">
              {slaLabel === 'PASS' && <span className="ow-summary-dot" style={{ background: '#22c55e' }} aria-hidden="true" />}
              <div className="text-[7px] font-label tracking-[0.12em] whitespace-nowrap" style={{ color: slaColor }}>
                RECOVERY {TARGET_LABEL} · {slaLabel}
              </div>
            </div>
          </div>
        </div>

        {/* TRON */}
        <div className="ow-panel flex flex-col px-3 py-2" style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
          <div className="shrink-0 flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center border rounded-sm" style={{ borderColor: '#a78bfa', color: '#a78bfa', background: '#a78bfa14' }}>
              <i className="ri-radar-line text-[13px]"></i>
            </span>
            <div className="leading-tight">
              <span className="text-[12px] font-bold tracking-[0.1em]" style={{ color: '#a78bfa' }}>TRON</span>
              <span className="block text-[7.5px] font-label tracking-[0.18em] text-slate-500">AI OVERWATCH</span>
            </div>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-[8.5px] font-label tracking-[0.12em]" style={{ color: toneHex(tron.tone) }}>
                {tron.stateLabel}
              </span>
              {tron.simulated && <SimulatedBadge />}
            </span>
          </div>

          {tron.dials && tron.dials.length > 0 && (
            <div className="shrink-0 flex items-start justify-center gap-4 mt-1.5">
              {tron.dials.map((d) => (
                <TronInstrument key={d.key} dial={d} nodeName={tron.name} />
              ))}
            </div>
          )}

          <div className="shrink-0 ow-node-role mt-2">
            {tron.statusRows.map((row) => (
              <RoleStatusTile key={row.label} row={row} />
            ))}
          </div>

          <div className="shrink-0 ow-node-resilience mt-auto">
            <HeartbeatECG label={tron.heartbeat.label} state={ecgState(tron.heartbeat.value)} text={tron.heartbeat.value} accent={tronColor} color={metricColor(tron.heartbeat.value, tronColor)} recovering={tronRes?.nodeStatus === 'RECOVERING'} />
            <WatchdogStatusIndicator state={tronRes?.nodeStatus === 'OFFLINE' ? 'none' : tronWatchdog.state} text={tronWatchdog.label} color={tronWatchdog.color} />
            <RecoveryStatusIndicator value={tronRecovery.value} result={tronRecovery.result} valueColor={tronRecovery.valueColor} resultColor={tronRecovery.resultColor} targetLabel={TARGET_LABEL} state={tronRecovery.state} />
          </div>
        </div>

        {/* AI Systems diagnostic block */}
        <AiSystemPanel />
      </div>
    </section>
  );
}