// ============================================================================
// AI Operations — Wallboard Power & Comm Room Data Store.
//
// Read-only monitoring over UPS / mains / environmental telemetry. This is a
// MONITORING-ONLY surface: there are no control actions (no shutdown, reboot,
// outlet switching, or remote power control) anywhere in this module.
//
// SOURCE AUDIT (Wallboard 26):
//   * No NUT / PeaNUT / TrueNAS UPS / Home Assistant / IPMI / environmental
//     sensor source exists anywhere in the codebase, the runtime bridge, or
//     the database. `dfp_service_health` holds 11 application services (none
//     power-related) and `dfp_health_checks` carries no sensor columns.
//   * The HAL runtime bridge relays only n8n /healthz + Ollama /api/tags +
//     heartbeat — no power/sensor telemetry.
//
// Because no source exists, this store exposes a SINGLE clean integration
// point (registerPowerSource) and, until one is wired, reports
// `sourceStatus: 'not_connected'` honestly — never fabricating UPS or sensor
// values.
// ============================================================================

import { useSyncExternalStore } from 'react';

// --- Data contract -----------------------------------------------------------

export interface UpsDevice {
  /** Stable device key (NOT a serial number). */
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  /** Raw NUT/ups.status flags (e.g. "OL", "OB", "LB", "RB", "OVER"). */
  status: string | null;
  /** Mains state — online vs battery operation. */
  mains: 'online' | 'on_battery' | 'unknown' | null;
  /** Battery charge, percent 0–100. */
  batteryCharge: number | null;
  /** Estimated remaining runtime, seconds. */
  runtimeSeconds: number | null;
  /** Load, percent 0–100. */
  loadPercent: number | null;
  /** Input (mains) voltage, volts. */
  inputVoltage: number | null;
  /** Output voltage, volts. */
  outputVoltage: number | null;
  /** Battery health text (e.g. "OK", "replace"). */
  batteryCondition: string | null;
  /** Last telemetry timestamp. */
  updatedAt: string | null;
}

export interface EnvironmentSensor {
  id: string;
  label: string;
  kind: 'temperature' | 'humidity' | 'fan';
  value: number | null;
  unit: string;
  status: 'ok' | 'warning' | 'critical' | 'unknown' | null;
  updatedAt: string | null;
}

export interface PowerSourcePayload {
  ups: UpsDevice[];
  environment: EnvironmentSensor[];
}

/** A single, swappable telemetry source (NUT / Home Assistant / TrueNAS / IPMI). */
export interface PowerSource {
  fetch(): Promise<PowerSourcePayload>;
}

export type PowerSourceStatus = 'live' | 'not_connected' | 'unavailable';

export interface PowerData {
  loading: boolean;
  lastRefreshed: Date;
  sourceStatus: PowerSourceStatus;
  ups: UpsDevice[];
  environment: EnvironmentSensor[];
}

function emptySnapshot(): PowerData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    sourceStatus: 'not_connected',
    ups: [],
    environment: [],
  };
}

// --- The single integration point -------------------------------------------

// Wire a telemetry source here when NUT / Home Assistant / TrueNAS / IPMI data
// becomes available (e.g. relayed through the HAL runtime bridge or a new
// server-side probe). Until then the store stays `not_connected` — no fake data.
let powerSource: PowerSource | null = null;

export function registerPowerSource(source: PowerSource): void {
  powerSource = source;
}

// --- External store -----------------------------------------------------------

let snapshot: PowerData = emptySnapshot();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): PowerData {
  return snapshot;
}

export function getPowerData(): PowerData {
  return snapshot;
}

export function usePowerData(): PowerData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

export async function refreshPowerData(): Promise<void> {
  if (!powerSource) {
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      sourceStatus: 'not_connected',
      ups: [],
      environment: [],
    };
    emit();
    return;
  }

  try {
    const payload = await powerSource.fetch();
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      sourceStatus: 'live',
      ups: payload.ups,
      environment: payload.environment,
    };
  } catch {
    snapshot = {
      loading: false,
      lastRefreshed: new Date(),
      sourceStatus: 'unavailable',
      ups: [],
      environment: [],
    };
  }
  emit();
}