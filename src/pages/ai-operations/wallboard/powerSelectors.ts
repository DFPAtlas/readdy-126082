// ============================================================================
// AI Operations — Wallboard Power & Comm Room selectors.
//
// Pure read-only derivations over the power snapshot (powerStore.ts). These
// produce a distance-readable power view for the wallboard and the critical
// power incidents that feed Wallboard 22 Incident Mode.
//
// Honesty rules honoured here:
//   * UPS state is NORMALISED for wallboard presentation only (ONLINE / ON
//     BATTERY / LOW BATTERY / OVERLOAD / REPLACE BATTERY / COMMUNICATION LOST /
//     UNKNOWN). The underlying NUT/UPS configuration is never altered.
//   * LOW BATTERY and REPLACE BATTERY are treated as authoritative when the UPS
//     explicitly reports them — higher priority than any locally invented
//     percentage threshold.
//   * STALE readings are surfaced (a battery value never appears current
//     indefinitely). Unavailable sensors are omitted, never fabricated.
//   * No control actions exist — this is monitoring only.
// ============================================================================

import {
  getPowerData,
  type UpsDevice,
  type PowerSourceStatus,
} from '@/pages/ai-operations/wallboard/powerStore';

// --- Normalised UPS status -----------------------------------------------------

export type UpsStatus =
  | 'online'
  | 'on_battery'
  | 'low_battery'
  | 'overload'
  | 'replace_battery'
  | 'communication_lost'
  | 'unknown';

export const UPS_STATUS_META: Record<
  UpsStatus,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  online: { label: 'ONLINE', tone: 'emerald' },
  on_battery: { label: 'ON BATTERY', tone: 'amber' },
  low_battery: { label: 'LOW BATTERY', tone: 'red' },
  overload: { label: 'OVERLOAD', tone: 'red' },
  replace_battery: { label: 'REPLACE BATTERY', tone: 'amber' },
  communication_lost: { label: 'COMMUNICATION LOST', tone: 'red' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/**
 * Map a raw NUT `ups.status` (space-separated flags: OL OB LB RB OVER CHRG
 * DISCHRG …) onto the wallboard levels. Priority reflects NUT semantics —
 * low battery / replace battery / overload are authoritative failures.
 */
export function normalizeUpsStatus(raw: string | null | undefined): UpsStatus {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('LB')) return 'low_battery';
  if (s.includes('RB')) return 'replace_battery';
  if (s.includes('OVER') || s.includes('OVL')) return 'overload';
  if (s.includes('OB')) return 'on_battery';
  if (s.includes('OL')) return 'online';
  return 'unknown';
}

// --- Stale detection ------------------------------------------------------------

/** A UPS reading older than this many seconds is treated as stale. */
const UPS_STALE_SECONDS = 5 * 60;

export function isStale(updatedAt: string | null | undefined, now: Date): boolean {
  if (!updatedAt) return false;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return false;
  return now.getTime() - d.getTime() > UPS_STALE_SECONDS * 1000;
}

// --- Runtime formatting ----------------------------------------------------------

/** Format seconds as human-readable runtime: `1h 42m`, `36m`, or `Unavailable`. */
export function formatRuntime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'Unavailable';
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// --- Device model ---------------------------------------------------------------

export interface PowerDeviceView {
  key: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  status: UpsStatus;
  mains: UpsDevice['mains'];
  batteryCharge: number | null;
  runtimeLabel: string;
  loadPercent: number | null;
  inputVoltage: number | null;
  outputVoltage: number | null;
  batteryCondition: string | null;
  stale: boolean;
  lastSeen: string | null;
}

export function getUpsDevices(): PowerDeviceView[] {
  const data = getPowerData();
  const now = new Date();
  return data.ups.map((u) => ({
    key: u.id,
    name: u.name,
    manufacturer: u.manufacturer,
    model: u.model,
    status: normalizeUpsStatus(u.status),
    mains: u.mains,
    batteryCharge: u.batteryCharge,
    runtimeLabel: formatRuntime(u.runtimeSeconds),
    loadPercent: u.loadPercent,
    inputVoltage: u.inputVoltage,
    outputVoltage: u.outputVoltage,
    batteryCondition: u.batteryCondition,
    stale: isStale(u.updatedAt, now),
    lastSeen: u.updatedAt,
  }));
}

// --- Summary ---------------------------------------------------------------------

export interface PowerSummary {
  sourceStatus: PowerSourceStatus;
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
  upsCount: number;
  onBatteryCount: number;
  environmentCount: number;
}

export function getPowerSummary(): PowerSummary {
  const data = getPowerData();
  const devices = getUpsDevices();

  const onBattery = devices.filter((d) => d.status === 'on_battery' || d.status === 'low_battery');
  const lowBattery = devices.filter((d) => d.status === 'low_battery');
  const commLost = devices.filter((d) => d.status === 'communication_lost');
  const overload = devices.filter((d) => d.status === 'overload');

  if (data.sourceStatus === 'not_connected') {
    return {
      sourceStatus: 'not_connected',
      label: 'POWER MONITORING NOT CONNECTED',
      detail: 'No UPS or environmental telemetry source is wired.',
      tone: 'secondary',
      upsCount: devices.length,
      onBatteryCount: 0,
      environmentCount: data.environment.length,
    };
  }

  if (data.sourceStatus === 'unavailable') {
    return {
      sourceStatus: 'unavailable',
      label: 'POWER DATA UNAVAILABLE',
      detail: 'The power telemetry source failed to respond.',
      tone: 'amber',
      upsCount: devices.length,
      onBatteryCount: 0,
      environmentCount: data.environment.length,
    };
  }

  if (lowBattery.length > 0) {
    return {
      sourceStatus: 'live',
      label: 'LOW BATTERY',
      detail: `${lowBattery.length} UPS reporting low battery.`,
      tone: 'red',
      upsCount: devices.length,
      onBatteryCount: onBattery.length,
      environmentCount: data.environment.length,
    };
  }

  if (commLost.length > 0) {
    return {
      sourceStatus: 'live',
      label: 'UPS COMMUNICATION LOST',
      detail: `${commLost.length} UPS stopped reporting.`,
      tone: 'red',
      upsCount: devices.length,
      onBatteryCount: onBattery.length,
      environmentCount: data.environment.length,
    };
  }

  if (overload.length > 0) {
    return {
      sourceStatus: 'live',
      label: 'UPS OVERLOAD',
      detail: `${overload.length} UPS overloaded.`,
      tone: 'red',
      upsCount: devices.length,
      onBatteryCount: onBattery.length,
      environmentCount: data.environment.length,
    };
  }

  if (onBattery.length > 0) {
    const first = onBattery[0];
    const remaining = first.status === 'on_battery' ? first.runtimeLabel : 'Low';
    return {
      sourceStatus: 'live',
      label: 'ON BATTERY',
      detail: `${remaining}${first.status === 'on_battery' ? ' remaining' : ''} · ${onBattery.length} UPS affected.`,
      tone: 'amber',
      upsCount: devices.length,
      onBatteryCount: onBattery.length,
      environmentCount: data.environment.length,
    };
  }

  return {
    sourceStatus: 'live',
    label: 'POWER NORMAL',
    detail: `${devices.length} UPS online on mains.`,
    tone: 'emerald',
    upsCount: devices.length,
    onBatteryCount: 0,
    environmentCount: data.environment.length,
  };
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) -----------------------

export interface PowerIncident {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  affectedService: string;
  sourceLabel: string;
  firstDetected: string | null;
  lastUpdated: string | null;
  status: string;
  description: string;
}

/**
 * Authoritative power incidents only:
 *   * mains lost (ON BATTERY) → CRITICAL
 *   * LOW BATTERY → CRITICAL
 *   * OVERLOAD → HIGH
 *   * REPLACE BATTERY → HIGH
 *   * COMMUNICATION LOST → HIGH
 * Nothing is triggered from locally invented thresholds.
 */
export function getPowerIncidents(): PowerIncident[] {
  const data = getPowerData();
  if (data.sourceStatus !== 'live') return [];

  const incidents: PowerIncident[] = [];

  for (const d of getUpsDevices()) {
    switch (d.status) {
      case 'on_battery':
        incidents.push({
          id: `power-mains-${d.key}`,
          severity: 'critical',
          title: `${d.name} is on battery`,
          affectedService: d.name,
          sourceLabel: 'Power',
          firstDetected: d.lastSeen,
          lastUpdated: d.lastSeen,
          status: 'on_battery',
          description: `Mains power lost — UPS running on battery (${d.runtimeLabel} estimated remaining).`,
        });
        break;
      case 'low_battery':
        incidents.push({
          id: `power-lowbatt-${d.key}`,
          severity: 'critical',
          title: `${d.name} low battery`,
          affectedService: d.name,
          sourceLabel: 'Power',
          firstDetected: d.lastSeen,
          lastUpdated: d.lastSeen,
          status: 'low_battery',
          description: 'UPS is on battery and reporting low battery.',
        });
        break;
      case 'overload':
        incidents.push({
          id: `power-overload-${d.key}`,
          severity: 'high',
          title: `${d.name} overloaded`,
          affectedService: d.name,
          sourceLabel: 'Power',
          firstDetected: d.lastSeen,
          lastUpdated: d.lastSeen,
          status: 'overload',
          description: 'UPS load exceeds its rated capacity.',
        });
        break;
      case 'replace_battery':
        incidents.push({
          id: `power-replacebatt-${d.key}`,
          severity: 'high',
          title: `${d.name} battery needs replacing`,
          affectedService: d.name,
          sourceLabel: 'Power',
          firstDetected: d.lastSeen,
          lastUpdated: d.lastSeen,
          status: 'replace_battery',
          description: 'UPS reports battery requires replacement.',
        });
        break;
      case 'communication_lost':
        incidents.push({
          id: `power-comms-${d.key}`,
          severity: 'high',
          title: `${d.name} communication lost`,
          affectedService: d.name,
          sourceLabel: 'Power',
          firstDetected: d.lastSeen,
          lastUpdated: d.lastSeen,
          status: 'communication_lost',
          description: 'UPS stopped reporting telemetry.',
        });
        break;
      default:
        break;
    }
  }

  return incidents;
}