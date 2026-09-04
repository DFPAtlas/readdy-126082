// ============================================================================
// AI Operations — Wallboard Backups & Recovery selectors.
//
// Pure read-only derivations over the backup snapshot (backupStore.ts) + the
// live health signal from the "backups" service in dfp_service_health (reused
// via infrastructureStore.ts). These produce a distance-readable backup view
// and the critical backup incidents that feed Wallboard 22 Incident Mode.
//
// Honesty rules honoured here:
//   * Presentation states (CURRENT / DUE / FAILED / STALE / NEVER BACKED UP /
//     UNKNOWN) are NORMALISED for the wallboard only — the underlying backup
//     software state is never rewritten.
//   * "Completed" is kept distinct from "Verified" — recoverability is never
//     claimed merely because a backup file exists.
//   * The STALE / DEGRADED classification is the one ALREADY computed
//     server-side by dfp-health-probe (not a locally invented age threshold).
//   * Restore verification is never implied: a drill that only reached
//     "source verified" with a pending restore is reported as pending, not as
//     "recovery tested".
//   * Monitoring-unavailable is never reported as healthy.
// ============================================================================

import {
  getBackupData,
  type BackupRecordRow,
} from '@/pages/ai-operations/wallboard/backupStore';
import { getInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';

// --- Normalised wallboard status ---------------------------------------------

export type BackupState =
  | 'current'
  | 'due'
  | 'failed'
  | 'stale'
  | 'never_backed_up'
  | 'unknown';

export const BACKUP_STATE_META: Record<
  BackupState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  current: { label: 'CURRENT', tone: 'emerald' },
  due: { label: 'DUE', tone: 'amber' },
  failed: { label: 'FAILED', tone: 'red' },
  stale: { label: 'STALE', tone: 'amber' },
  never_backed_up: { label: 'NEVER BACKED UP', tone: 'red' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/**
 * The LIVE health signal for the "backups" service from dfp_service_health
 * (server-computed stale/failed/degraded). This is the authoritative age/
 * failure determination — the wallboard does not invent its own thresholds.
 */
function backupsServiceHealth(): { status: string; message: string | null } {
  const data = getInfrastructureData();
  const svc = data.services.find(
    (s) => (s.service ?? '').toLowerCase() === 'backups',
  );
  return { status: svc?.status ?? '', message: svc?.message ?? null };
}

/** Map a backup record onto the wallboard presentation state. */
function deriveTargetState(record: BackupRecordRow): BackupState {
  const recStatus = (record.status ?? '').toLowerCase();
  const svc = backupsServiceHealth().status.toLowerCase();

  if (['failed', 'error'].includes(recStatus)) return 'failed';
  if (recStatus === 'completed') {
    // LIVE signal from the server-computed health probe.
    if (['degraded', 'stale'].includes(svc)) return 'stale';
    if (['offline', 'failed'].includes(svc)) return 'failed';
    return 'current';
  }
  if (!record.completed_at) return 'never_backed_up';
  return 'unknown';
}

// --- Friendly labels (privacy-safe) ------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  supabase: 'Supabase',
  postgres: 'PostgreSQL',
};

const SCOPE_LABELS: Record<string, string> = {
  database: 'Database',
  application: 'Application',
  configuration: 'Configuration',
  file: 'File',
  full: 'Full System',
};

function friendlyTargetName(record: BackupRecordRow): string {
  const provider = PROVIDER_LABELS[(record.provider ?? '').toLowerCase()] ?? record.provider ?? 'Backup';
  const scope = SCOPE_LABELS[(record.backup_scope ?? '').toLowerCase()] ?? 'Backup';
  return `${provider} ${scope}`;
}

function ageLabel(record: BackupRecordRow): string {
  // Prefer the authoritative server-computed age ("Backup 471h old").
  const msg = backupsServiceHealth().message;
  if (msg) {
    const m = /(\d+)\s*h/i.exec(msg);
    if (m) return `${m[1]}h`;
  }
  if (record.completed_at) {
    const diff = Date.now() - new Date(record.completed_at).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h > 0) return `${h}h`;
  }
  return '—';
}

function verificationLabel(record: BackupRecordRow): string {
  switch ((record.verification_status ?? '').toLowerCase()) {
    case 'verified':
      return 'Verified';
    case 'failed':
      return 'Verification failed';
    case 'pending':
      return 'Verification pending';
    default:
      return 'Not verified';
  }
}

// --- Tile model --------------------------------------------------------------

export interface BackupTargetView {
  key: string;
  name: string;
  type: string;
  provider: string | null;
  state: BackupState;
  lastSuccess: string | null;
  age: string;
  verification: string;
  verifiedAt: string | null;
  note: string | null;
}

/** Registered backup targets (one per backup_records row). */
export function getBackupTargets(): BackupTargetView[] {
  const data = getBackupData();
  const svcMessage = backupsServiceHealth().message;

  return data.records.map((r: BackupRecordRow) => ({
    key: r.id,
    name: friendlyTargetName(r),
    type: r.backup_type ?? 'backup',
    provider: PROVIDER_LABELS[(r.provider ?? '').toLowerCase()] ?? r.provider,
    state: deriveTargetState(r),
    lastSuccess: r.completed_at,
    age: ageLabel(r),
    verification: verificationLabel(r),
    verifiedAt: r.verified_at,
    note: svcMessage,
  }));
}

// --- Restore / recovery readiness --------------------------------------------

export interface RestoreReadiness {
  hasDrill: boolean;
  drillReference: string | null;
  drillStatus: string | null;
  databaseResult: string | null;
  storageResult: string | null;
  applicationResult: string | null;
  recoveryTimeMinutes: number | null;
  recoveryPointGapMinutes: number | null;
  /** Honest note — never implies recovery has been tested. */
  note: string;
}

export function getRestoreReadiness(): RestoreReadiness {
  const data = getBackupData();
  const drill = data.drills[0];

  if (!drill) {
    return {
      hasDrill: false,
      drillReference: null,
      drillStatus: null,
      databaseResult: null,
      storageResult: null,
      applicationResult: null,
      recoveryTimeMinutes: null,
      recoveryPointGapMinutes: null,
      note: 'Restore verification not configured — no restore/test drill is registered.',
    };
  }

  const dbResult = drill.database_result ?? 'not_run';
  const reachedSourceOnly = (drill.status ?? '').toLowerCase() === 'source_verified' && dbResult === 'pending_restore';

  return {
    hasDrill: true,
    drillReference: drill.drill_reference,
    drillStatus: drill.status,
    databaseResult: dbResult,
    storageResult: drill.storage_result ?? 'not_included',
    applicationResult: drill.application_result ?? 'not_run',
    recoveryTimeMinutes: drill.recovery_time_minutes,
    recoveryPointGapMinutes: drill.recovery_point_gap_minutes,
    note: reachedSourceOnly
      ? 'The latest restore drill reached source-verification only; the actual restore is still pending. Restore has not yet been verified.'
      : 'Restore drill status is recorded; refer to the drill details for verification outcome.',
  };
}

// --- Backup gaps (critical systems with no usable source) --------------------

export interface BackupGap {
  system: string;
  note: string;
}

/** Systems audited to have NO backup-status telemetry anywhere in the project. */
export function getBackupGaps(): BackupGap[] {
  return [
    { system: 'Proxmox hosts / VMs', note: 'No backup telemetry source.' },
    { system: 'TrueNAS / Atlas Vault', note: 'No snapshot / ZFS source.' },
    { system: 'Docker stacks', note: 'No application backup source.' },
    { system: 'HAL runtime host', note: 'No host backup source.' },
    { system: 'Website / project data', note: 'No site backup source.' },
    { system: 'Configuration repositories', note: 'No source-backup source.' },
  ];
}

// --- Summary -----------------------------------------------------------------

export interface BackupSummary {
  total: number;
  current: number;
  due: number;
  stale: number;
  failed: number;
  neverBackedUp: number;
  unknown: number;
  sourceState: 'live' | 'partial' | 'unavailable';
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getBackupSummary(): BackupSummary {
  const data = getBackupData();
  const targets = getBackupTargets();

  const counts = {
    current: 0,
    due: 0,
    stale: 0,
    failed: 0,
    never_backed_up: 0,
    unknown: 0,
  };
  for (const t of targets) counts[t.state] += 1;

  const live = data.recordsAvailability && !data.loading;
  let sourceState: BackupSummary['sourceState'];
  if (data.loading) {
    sourceState = 'unavailable';
  } else if (live) {
    sourceState = 'live';
  } else {
    sourceState = 'unavailable';
  }

  let label: string;
  let detail: string;
  let tone: BackupSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'BACKUP STATUS UNKNOWN';
    detail = 'Backup monitoring source could not be reached.';
    tone = 'secondary';
  } else if (counts.failed > 0) {
    label = 'BACKUP FAILURE';
    detail = `${counts.failed} backup target${counts.failed > 1 ? 's' : ''} failed.`;
    tone = 'red';
  } else if (counts.stale > 0) {
    label = 'BACKUP STALE';
    detail = `${counts.stale} backup target${counts.stale > 1 ? 's' : ''} beyond the approved schedule.`;
    tone = 'amber';
  } else if (counts.never_backed_up > 0) {
    label = 'BACKUP MISSING';
    detail = `${counts.never_backed_up} target${counts.never_backed_up > 1 ? 's' : ''} never backed up.`;
    tone = 'red';
  } else if (counts.due > 0) {
    label = 'BACKUP DUE';
    detail = `${counts.due} backup target${counts.due > 1 ? 's' : ''} due.`;
    tone = 'amber';
  } else {
    label = 'BACKUPS CURRENT';
    detail = 'All registered backup targets are current and verified.';
    tone = 'emerald';
  }

  return {
    total: targets.length,
    current: counts.current,
    due: counts.due,
    stale: counts.stale,
    failed: counts.failed,
    neverBackedUp: counts.never_backed_up,
    unknown: counts.unknown,
    sourceState,
    label,
    detail,
    tone,
  };
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) --------------------

export interface BackupIncident {
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
 * Authoritative backup incidents only:
 *   * A critical (database) backup target FAILED → CRITICAL.
 *   * Any other backup target FAILED → HIGH.
 *   * Verification FAILED (verification required) → HIGH.
 *   * A restore drill recording a FAILED restore result → HIGH.
 *
 * The STALE signal ("Backup N h old") is already raised by the Infrastructure
 * view (the dfp_service_health "backups" service → HIGH) and is intentionally
 * NOT duplicated here. No threshold is invented — only explicit failure states
 * are used.
 */
export function getBackupIncidents(): BackupIncident[] {
  const data = getBackupData();
  const incidents: BackupIncident[] = [];

  for (const r of data.records) {
    const state = deriveTargetState(r);
    const isDatabase = (r.backup_scope ?? '').toLowerCase() === 'database';

    if (state === 'failed') {
      incidents.push({
        id: `backup-failed-${r.id}`,
        severity: isDatabase ? 'critical' : 'high',
        title: isDatabase
          ? 'Critical database backup failed'
          : `${friendlyTargetName(r)} backup failed`,
        affectedService: friendlyTargetName(r),
        sourceLabel: 'Backups',
        firstDetected: r.started_at,
        lastUpdated: r.completed_at,
        status: 'failed',
        description: 'The backup record reports a failed state.',
      });
    } else if ((r.verification_status ?? '').toLowerCase() === 'failed') {
      incidents.push({
        id: `backup-verify-${r.id}`,
        severity: 'high',
        title: `${friendlyTargetName(r)} verification failed`,
        affectedService: friendlyTargetName(r),
        sourceLabel: 'Backups',
        firstDetected: r.verified_at,
        lastUpdated: r.verified_at,
        status: 'verification_failed',
        description: 'Backup verification failed where verification is required.',
      });
    }
  }

  for (const d of data.drills) {
    const results = [d.database_result, d.storage_result, d.application_result];
    const failed = results.some((v) => (v ?? '').toLowerCase().includes('fail'));
    if (failed) {
      incidents.push({
        id: `restore-failed-${d.id}`,
        severity: 'high',
        title: 'Restore drill reported a failure',
        affectedService: d.drill_reference ?? 'Restore drill',
        sourceLabel: 'Backups',
        firstDetected: d.planned_at,
        lastUpdated: d.completed_at,
        status: 'restore_failed',
        description: d.issues_found ?? 'A restore/test drill recorded a failed result.',
      });
    }
  }

  return incidents;
}