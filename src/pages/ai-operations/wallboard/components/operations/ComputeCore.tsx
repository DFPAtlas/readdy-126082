import type { CSSProperties } from 'react';
import {
  getComputeCore,
  getAiSystemsStatus,
  toneHex,
  type Tone,
  type ComputeNode,
  type ComputeGauge,
  type TronDial,
  type TronDialTone,
  type AiSystemRow,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

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

function NodeMetrics({ node, accentColor, single = false }: { node: ComputeNode; accentColor: string; single?: boolean }) {
  if (single) {
    return (
      <div className="mt-1.5">
        {node.metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between border-b border-cyan-400/8 py-[2px] last:border-b-0">
            <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">{m.label}</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap" style={{ color: metricColor(m.value, accentColor) }}>
              {m.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
      {node.metrics.map((m) => (
        <div key={m.label} className="flex items-baseline justify-between border-b border-cyan-400/8 py-[3px]">
          <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">{m.label}</span>
          <span className="font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap" style={{ color: metricColor(m.value, accentColor) }}>
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * HUD-style circular telemetry dial for HAL's live CPU / memory percentages.
 * Truthful: the conic fill maps directly from the raw percentage; missing
 * telemetry renders muted with an em-dash centre and never a fabricated zero.
 */
function TelemetryDial({ gauge, nodeName }: { gauge: ComputeGauge; nodeName: string }) {
  const accent = DIAL_ACCENT[gauge.accent];
  const glow = DIAL_GLOW[gauge.accent];
  const hasValue = gauge.percent != null && Number.isFinite(gauge.percent);
  const clamped = hasValue ? Math.max(0, Math.min(100, gauge.percent as number)) : 0;
  const deg = clamped * 3.6;
  const ariaLabel = hasValue
    ? `${nodeName} ${gauge.label.toLowerCase()} utilization ${clamped.toFixed(1)} percent`
    : `${nodeName} ${gauge.label.toLowerCase()} utilization not monitored`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`ow-dial ${hasValue ? 'ow-dial-live' : 'ow-dial-empty'}`}
        role="img"
        aria-label={ariaLabel}
        style={{
          '--ow-dial-fill': `${deg}deg`,
          '--ow-dial-accent': accent,
          '--ow-dial-glow': glow,
        } as CSSProperties}
      >
        <div className="ow-dial-center">
          <span className="ow-dial-value font-mono" style={{ color: hasValue ? accent : '#475569' }}>
            {hasValue ? gauge.value : '—'}
          </span>
        </div>
      </div>
      <span className="text-[7.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">{gauge.label}</span>
      <span className="flex items-center gap-[3px]">
        <span
          className={`w-1 h-1 rounded-full ${hasValue ? 'ow-dial-pulse' : ''}`}
          style={{ background: hasValue ? accent : '#64748b' }}
        />
        <span className="text-[7.5px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: hasValue ? accent : '#64748b' }}>
          {hasValue ? 'LIVE' : 'NOT MONITORED'}
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

  const ariaLabel = `${nodeName} ${dial.label.toLowerCase()} ${hasValue ? dial.value : 'not monitored'}`;

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

  return (
    <div className={`flex items-center justify-between py-[5px] border-b border-cyan-400/8 last:border-b-0 ${safetyAlert ? 'ow-safety-alert' : ''}`}>
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0" style={{ color: safetyAlert ? tone : '#64748b' }}>
          <i className={`${iconName} text-[11px]`}></i>
        </span>
        <span className="text-[8.5px] font-label tracking-[0.14em] text-slate-500 whitespace-nowrap">{row.label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-semibold whitespace-nowrap" style={{ color: tone }}>
          {row.value}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} style={{ background: tone }} />
      </span>
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
  const { hal, tron, link } = getComputeCore();
  const halColor = hal.tone === 'green' ? '#fb923c' : toneHex(hal.tone);
  const tronColor = '#a78bfa';
  const linkColor = toneHex(link.tone);
  const relayMode = link.tone === 'green' ? 'active' : link.tone === 'amber' ? 'degraded' : 'idle';

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

          <NodeMetrics node={hal} accentColor={halColor} single />
        </div>

        {/* DFP Relay — HAL ⇄ DFP COMMAND ⇄ TRON */}
        <div className="flex flex-col items-center justify-center px-1 min-w-0">
          <span className="font-mono text-[10px] tracking-[0.08em] whitespace-nowrap" style={{ color: linkColor }}>DFP RELAY</span>

          <div className={`ow-relay ow-relay-${relayMode} mt-1.5`}>
            <div className="ow-relay-track ow-relay-track-hal">
              <span className="ow-relay-packet ow-relay-packet-hal" />
              <span className="ow-relay-packet ow-relay-ack-hal" />
            </div>
            <div className="ow-relay-core">
              <i className="ri-node-tree text-[14px]"></i>
            </div>
            <div className="ow-relay-track ow-relay-track-tron">
              <span className="ow-relay-packet ow-relay-packet-tron" />
              <span className="ow-relay-packet ow-relay-ack-tron" />
            </div>
          </div>

          <span className="text-[7.5px] font-label tracking-[0.12em] text-slate-500 mt-1.5 text-center leading-tight">
            HEARTBEATS · HEALTH · MODEL CATALOGUE
          </span>

          <div className="text-center leading-tight mt-1.5 min-w-0">
            <div className="text-[8px] font-label tracking-[0.14em]" style={{ color: linkColor }}>{link.label}</div>
            <div className="text-[7px] font-label tracking-[0.14em] mt-0.5" style={{ color: '#64748b' }}>{link.sublabel}</div>
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

          <NodeMetrics node={tron} accentColor={tronColor} single />
        </div>

        {/* AI Systems diagnostic block */}
        <AiSystemPanel />
      </div>
    </section>
  );
}