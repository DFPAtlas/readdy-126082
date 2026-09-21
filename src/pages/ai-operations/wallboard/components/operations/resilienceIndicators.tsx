import type { CSSProperties } from 'react';

// ============================================================================
// DFP COMMAND — Runtime resilience presentation helpers (HAL + TRON).
//
// Presentation-only. These components consume ALREADY-evaluated state values
// from ComputeCore (which derives them from the Runtime Resilience service /
// bridge selectors). No telemetry evaluation or business logic lives here —
// they only decide how a given state should LOOK, using the existing
// command-centre CSS tokens (ow-ecg / ow-watchdog / ow-recovery).
// ============================================================================

// --- Heartbeat (ECG) ---------------------------------------------------------

export type EcgState = 'live' | 'stale' | 'offline' | 'none';

/** A compact repeating EKG trace (sharp QRS-style spikes on a flat baseline).
 *  The bright "sweep" path rides the same polyline so the moving pulse follows
 *  the waveform, not just a straight line. */
const ECG_PATH =
  'M0 8 H9 L11 2.5 L13 13.5 L15 8 H24 L26 2.5 L28 13.5 L30 8 H45 L47 2.5 L49 13.5 L51 8 H60';

/**
 * Compact inline ECG-style heartbeat indicator. Replaces the plain-text
 * LIVE/STALE/OFFLINE readout with a thin glowing trace + a small moving pulse.
 *
 *   live      → active sweep + glow, text LIVE
 *   stale     → slower, weaker sweep, warning-tinted
 *   offline   → flat/inactive trace, text OFFLINE
 *   none      → flat muted trace, text — / UNKNOWN
 *
 * `recovering` (when live) adds a restrained flicker so the node reads as
 * actively transitioning, never a full stop.
 */
export function HeartbeatECG({
  label,
  state,
  text,
  accent,
  color,
  recovering = false,
}: {
  label: string;
  state: EcgState;
  text: string;
  accent: string;
  color: string;
  recovering?: boolean;
}) {
  const animated = state === 'live' || state === 'stale';
  const flicker = recovering && state === 'live';

  return (
    <div className="flex items-baseline justify-between border-b border-cyan-400/8 py-[2px] last:border-b-0">
      <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">
        {label}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <svg
          className={`ow-ecg ow-ecg-${state}${flicker ? ' ow-ecg-recovering' : ''}`}
          viewBox="0 0 60 16"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ '--ow-ecg-accent': accent } as CSSProperties}
        >
          <path className="ow-ecg-path ow-ecg-base" d={ECG_PATH} />
          {animated && <path className="ow-ecg-path ow-ecg-sweep" d={ECG_PATH} />}
        </svg>
        <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
          {text}
        </span>
      </span>
    </div>
  );
}

// --- Watchdog -----------------------------------------------------------------

export type WatchdogVisual = 'running' | 'fault' | 'recovering' | 'none';

/**
 * Compact watchdog status indicator with a distinct "guarding" effect that is
 * visually separate from the heartbeat ECG:
 *
 *   running    → steady breathing core dot + a slow rotating radar sweep ring
 *   fault      → static red ring, slow serious pulse (no healthy sweep)
 *   recovering → dashed rotating ring (stepped activity, in progress)
 *   none       → muted static marker
 */
export function WatchdogStatusIndicator({
  state,
  text,
  color,
}: {
  state: WatchdogVisual;
  text: string;
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-cyan-400/8 py-[2px] last:border-b-0">
      <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">
        WATCHDOG
      </span>
      <span
        className={`ow-watchdog ow-watchdog-${state}`}
        style={{ '--ow-wd-accent': color } as CSSProperties}
      >
        <span className="ow-watchdog-mark">
          <span className="ow-watchdog-ring" />
          <span className="ow-watchdog-core" />
        </span>
        <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
          {text}
        </span>
      </span>
    </div>
  );
}

// --- Recovery -----------------------------------------------------------------

export type RecoveryVisual = 'pass' | 'fail' | 'progress' | 'none';

/**
 * Compact recovery metric row. Keeps the <5s target + PASS/FAIL result, adding
 * a measured performance treatment:
 *
 *   pass     → soft highlight on the value + a gentle micro-glow pulse on PASS
 *   fail     → warning/fault treatment on FAIL (no healthy glow)
 *   progress → animated shimmer bar + "IN PROGRESS" (active recovery)
 *   none     → — , no animation, never implies PASS
 */
export function RecoveryStatusIndicator({
  value,
  result,
  valueColor,
  resultColor,
  targetLabel,
  state,
}: {
  value: string;
  result: string;
  valueColor: string;
  resultColor: string;
  targetLabel: string;
  state: RecoveryVisual;
}) {
  const badgeCls = state === 'pass' ? 'ow-recovery-pass' : state === 'fail' ? 'ow-recovery-fail' : '';
  const valueCls = state === 'pass' ? 'ow-recovery-pass-value' : '';

  return (
    <div className="flex items-baseline justify-between border-b border-cyan-400/8 py-[2px] last:border-b-0">
      <span className="text-[8px] font-label tracking-[0.16em] text-slate-500 whitespace-nowrap">
        RECOVERY
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {state === 'progress' && <span className="ow-progress ow-recovery-progress-bar" aria-hidden="true" />}
        <span
          className={`font-mono text-[11px] font-semibold tabular-nums ${valueCls}`}
          style={{ color: valueColor }}
        >
          {value}
        </span>
        <span className="text-[8px] font-label tracking-[0.14em] text-slate-500">TARGET</span>
        <span className="font-mono text-[9px] text-slate-300">{targetLabel}</span>
        <span
          className={`inline-flex items-center px-1 py-0.5 rounded-sm border ${badgeCls}`}
          style={{ color: resultColor, borderColor: `${resultColor}55`, background: `${resultColor}14` }}
        >
          <span className="text-[7px] font-bold tracking-[0.1em]">{result}</span>
        </span>
      </span>
    </div>
  );
}