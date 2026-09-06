// ============================================================================
// DFP COMMAND — SYSTEM STATE DEMO ALERT REPAIR 01.
//
// Legacy demo-fixture provenance check for the shared group live snapshot.
//
// The Phase 2 alerts/incidents migration
// (supabase/migrations/202609140000_ai_operations_alerts_incidents.sql) seeded
// 27 demo alerts and 17 demo incidents with `environment = 'production'`, so
// the existing sandbox/inactive filter does NOT exclude them. Those untouched
// fixtures therefore contaminated the global system state, the group alert
// count, the per-site alert counts and the safety summary — producing a false
// CRITICAL state on the Operations Wall.
//
// This module identifies a record as a CONFIRMED demo fixture only when it
// matches its original seeded fingerprint EXACTLY across stable key, original
// content (title + summary), severity, status, occurrence count, and original
// event timestamps (first_seen_at / last_seen_at for alerts, started_at for
// incidents). A record is deliberately NOT matched — and therefore retained as
// a genuine warning — when:
//   * its key is unknown (never hidden by ID alone),
//   * its title / summary was edited,
//   * its severity or status changed (a human actually acted on it),
//   * its occurrence count or last-seen timestamp advanced (a new occurrence),
//   * any timestamp diverges from the seed.
//
// This is read-only and non-destructive: no database record is deleted,
// resolved, suppressed, or modified, and no schema / permission / connection
// change is made. The source rows remain available for review.
// ============================================================================

import type { AiAlertRow, AiIncidentRow } from '@/lib/ai-operations';

// --- Fingerprint shapes -------------------------------------------------------

interface DemoAlertFingerprint {
  title: string;
  summary: string;
  severity: string;
  status: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface DemoIncidentFingerprint {
  title: string;
  summary: string;
  severity: string;
  status: string;
  started_at: string;
}

// --- Timestamp normalisation ---------------------------------------------------

// Seed values are written as `YYYY-MM-DD HH:MM` (no timezone) and cast to
// timestamptz; PostgREST returns them as ISO-8601 with an explicit offset.
// Normalise both forms to epoch milliseconds (UTC) so an unchanged timestamp
// matches regardless of the serialised representation.
function normalizeTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  // Seed form: `YYYY-MM-DD HH:MM[:SS]` — interpret as UTC.
  const seedForm = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(t);
  if (seedForm) {
    const ms = Date.parse(`${seedForm[1]}T${seedForm[2]}Z`);
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

// --- Seeded demo alert fixtures (27) -------------------------------------------

const DEMO_ALERTS: Record<string, DemoAlertFingerprint> = {
  'ALR-5001': {
    title: 'OpenAI provider degraded — elevated latency',
    summary: 'The shared cloud model provider is reporting elevated response latency and intermittent 5xx errors on completion calls.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:12', last_seen_at: '2026-08-25 10:05',
  },
  'ALR-5002': {
    title: 'n8n connection failure — automation queue stalled',
    summary: 'The shared n8n automation connection is unreachable, stalling scheduled workflow execution across the group.',
    severity: 'critical', status: 'escalated', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:55', last_seen_at: '2026-08-25 09:50',
  },
  'ALR-5003': {
    title: 'Blocked RED action — production data deletion attempt',
    summary: 'An agent attempted a production data deletion that was blocked by policy and routed to human approval.',
    severity: 'high', status: 'awaiting_approval', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:30', last_seen_at: '2026-08-25 10:10',
  },
  'ALR-5004': {
    title: 'Approval expiring — RED deployment authorisation',
    summary: 'A RED deployment approval is approaching expiry without sign-off, risking workflow stall.',
    severity: 'high', status: 'awaiting_approval', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:40', last_seen_at: '2026-08-25 10:00',
  },
  'ALR-5005': {
    title: 'Group security anomaly scan blocked',
    summary: 'The group-wide security anomaly scan was blocked at the execution gate pending risk review.',
    severity: 'critical', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:05', last_seen_at: '2026-08-25 10:15',
  },
  'ALR-5006': {
    title: 'Repeated escalation-policy mismatch',
    summary: 'A recurring mismatch between escalation routing and policy has been detected again.',
    severity: 'medium', status: 'acknowledged', occurrence_count: 3,
    first_seen_at: '2026-08-25 07:50', last_seen_at: '2026-08-25 08:30',
  },
  'ALR-5007': {
    title: 'Group billing threshold warning',
    summary: 'Group AI spend approached its daily cost threshold.',
    severity: 'low', status: 'acknowledged', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:00', last_seen_at: '2026-08-25 08:40',
  },
  'ALR-5008': {
    title: 'Group backup failure',
    summary: 'A scheduled backup failed to complete.',
    severity: 'medium', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:10', last_seen_at: '2026-08-25 10:00',
  },
  'ALR-5010': {
    title: 'Digital Footprint support diagnostics failure',
    summary: 'The Digital Footprint diagnostics agent failed a support-diagnosis run, delaying ticket resolution.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:58', last_seen_at: '2026-08-25 10:20',
  },
  'ALR-5011': {
    title: 'Digital Footprint data health warning',
    summary: 'A data health check flagged a minor inconsistency in project records.',
    severity: 'medium', status: 'monitoring', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:30', last_seen_at: '2026-08-25 09:00',
  },
  'ALR-5020': {
    title: 'QuickGuard guard matching run failure',
    summary: 'The guard matching agent failed a shift-matching run, leaving a shift unassigned.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 10:31', last_seen_at: '2026-08-25 10:45',
  },
  'ALR-5021': {
    title: 'QuickGuard compliance licence warning',
    summary: 'A licence renewal window is approaching for several guards, flagged by the compliance agent.',
    severity: 'medium', status: 'waiting', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:10', last_seen_at: '2026-08-25 09:00',
  },
  'ALR-5022': {
    title: 'QuickGuard timesheet sync failure',
    summary: 'Timesheet data failed to sync to payroll, flagged for reconciliation.',
    severity: 'medium', status: 'acknowledged', occurrence_count: 1,
    first_seen_at: '2026-08-25 07:30', last_seen_at: '2026-08-25 08:10',
  },
  'ALR-5030': {
    title: 'GuardianHub check-call failure (repeating)',
    summary: 'The check-call agent failed again on a welfare check-call, matching a previously documented incident.',
    severity: 'critical', status: 'escalated', occurrence_count: 3,
    first_seen_at: '2026-08-25 09:20', last_seen_at: '2026-08-25 10:10',
  },
  'ALR-5031': {
    title: 'GuardianHub Supabase degraded',
    summary: 'The GuardianHub Supabase connection is degraded, slowing database operations.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:00', last_seen_at: '2026-08-25 10:00',
  },
  'ALR-5032': {
    title: 'GuardianHub welfare escalation blocked',
    summary: 'A welfare escalation was blocked pending human approval.',
    severity: 'critical', status: 'awaiting_approval', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:40', last_seen_at: '2026-08-25 10:20',
  },
  'ALR-5040': {
    title: 'LetHub tenancy compliance warning',
    summary: 'A tenancy compliance review flagged documents approaching expiry.',
    severity: 'medium', status: 'monitoring', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:20', last_seen_at: '2026-08-25 09:10',
  },
  'ALR-5041': {
    title: 'LetHub maintenance triage failure',
    summary: 'The maintenance agent failed to triage an incoming maintenance request.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:50', last_seen_at: '2026-08-25 10:15',
  },
  'ALR-5050': {
    title: 'Vowora RSVP notification failure',
    summary: 'The RSVP agent failed to send guest notifications due to an email connection issue.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:15', last_seen_at: '2026-08-25 10:05',
  },
  'ALR-5051': {
    title: 'Vowora supplier quote chase failure',
    summary: 'The supplier agent failed to chase an outstanding quote.',
    severity: 'medium', status: 'acknowledged', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:05', last_seen_at: '2026-08-25 08:50',
  },
  'ALR-5060': {
    title: 'The Forge UAT failure',
    summary: 'A release UAT cycle failed validation, blocking the release gate.',
    severity: 'high', status: 'investigating', occurrence_count: 1,
    first_seen_at: '2026-08-25 09:35', last_seen_at: '2026-08-25 10:20',
  },
  'ALR-5061': {
    title: 'The Forge code agent error',
    summary: 'The code agent entered an error state during a generation task.',
    severity: 'high', status: 'escalated', occurrence_count: 1,
    first_seen_at: '2026-08-25 10:00', last_seen_at: '2026-08-25 10:25',
  },
  'ALR-5062': {
    title: 'The Forge n8n degraded',
    summary: 'The Forge n8n connection is degraded, slowing build automation.',
    severity: 'medium', status: 'monitoring', occurrence_count: 1,
    first_seen_at: '2026-08-25 08:45', last_seen_at: '2026-08-25 09:30',
  },
  'ALR-5090': {
    title: 'LetHub property sync resolved',
    summary: 'A property sync issue was diagnosed and fixed.',
    severity: 'medium', status: 'resolved', occurrence_count: 1,
    first_seen_at: '2026-08-24 16:20', last_seen_at: '2026-08-24 18:00',
  },
  'ALR-5091': {
    title: 'Vowora seating validation resolved',
    summary: 'A seating chart validation failure was fixed and re-verified.',
    severity: 'medium', status: 'resolved', occurrence_count: 1,
    first_seen_at: '2026-08-24 15:40', last_seen_at: '2026-08-24 17:30',
  },
  'ALR-5092': {
    title: 'QuickGuard payroll reconciliation closed',
    summary: 'A payroll reconciliation run failure was resolved and closed.',
    severity: 'high', status: 'closed', occurrence_count: 2,
    first_seen_at: '2026-08-24 14:10', last_seen_at: '2026-08-24 16:40',
  },
  'ALR-5093': {
    title: 'The Forge sandbox isolation resolved',
    summary: 'A sandbox isolation breach attempt was contained and resolved.',
    severity: 'high', status: 'resolved', occurrence_count: 1,
    first_seen_at: '2026-08-24 13:30', last_seen_at: '2026-08-24 15:50',
  },
};

// --- Seeded demo incident fixtures (17) ----------------------------------------

const DEMO_INCIDENTS: Record<string, DemoIncidentFingerprint> = {
  'INC-8101': {
    title: 'OpenAI provider degraded — elevated latency',
    summary: 'The shared cloud model provider is reporting elevated response latency and intermittent 5xx errors on completion calls.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 09:12',
  },
  'INC-8102': {
    title: 'n8n connection failure — automation queue stalled',
    summary: 'The shared n8n automation connection is unreachable, stalling scheduled workflow execution across the group.',
    severity: 'critical', status: 'escalated', started_at: '2026-08-25 08:55',
  },
  'INC-8103': {
    title: 'Blocked RED action — production data deletion attempt',
    summary: 'An agent attempted a production data deletion that was blocked by policy and routed to human approval.',
    severity: 'high', status: 'awaiting_approval', started_at: '2026-08-25 09:30',
  },
  'INC-8104': {
    title: 'Approval expiring — RED deployment authorisation',
    summary: 'A RED deployment approval is approaching expiry without sign-off, risking workflow stall.',
    severity: 'high', status: 'awaiting_approval', started_at: '2026-08-25 08:40',
  },
  'INC-8105': {
    title: 'Group security anomaly scan blocked',
    summary: 'The group-wide security anomaly scan was blocked at the execution gate pending risk review.',
    severity: 'critical', status: 'investigating', started_at: '2026-08-25 09:05',
  },
  'INC-8106': {
    title: 'Repeated escalation-policy mismatch',
    summary: 'A recurring mismatch between escalation routing and policy has been detected again.',
    severity: 'medium', status: 'acknowledged', started_at: '2026-08-25 07:50',
  },
  'INC-8110': {
    title: 'Digital Footprint support diagnostics failure',
    summary: 'The Digital Footprint diagnostics agent failed a support-diagnosis run, delaying ticket resolution.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 09:58',
  },
  'INC-8120': {
    title: 'QuickGuard guard matching run failure',
    summary: 'The guard matching agent failed a shift-matching run, leaving a shift unassigned.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 10:31',
  },
  'INC-8130': {
    title: 'GuardianHub check-call failure (repeating)',
    summary: 'The check-call agent failed again on a welfare check-call, matching a previously documented incident.',
    severity: 'critical', status: 'escalated', started_at: '2026-08-25 09:20',
  },
  'INC-8131': {
    title: 'GuardianHub Supabase degraded',
    summary: 'The GuardianHub Supabase connection is degraded, slowing database operations.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 09:00',
  },
  'INC-8132': {
    title: 'GuardianHub welfare escalation blocked',
    summary: 'A welfare escalation was blocked pending human approval.',
    severity: 'critical', status: 'awaiting_approval', started_at: '2026-08-25 09:40',
  },
  'INC-8141': {
    title: 'LetHub maintenance triage failure',
    summary: 'The maintenance agent failed to triage an incoming maintenance request.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 09:50',
  },
  'INC-8150': {
    title: 'Vowora RSVP notification failure',
    summary: 'The RSVP agent failed to send guest notifications due to an email connection issue.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 09:15',
  },
  'INC-8160': {
    title: 'The Forge UAT failure',
    summary: 'A release UAT cycle failed validation, blocking the release gate.',
    severity: 'high', status: 'investigating', started_at: '2026-08-25 09:35',
  },
  'INC-8161': {
    title: 'The Forge code agent error',
    summary: 'The code agent entered an error state during a generation task.',
    severity: 'high', status: 'escalated', started_at: '2026-08-25 10:00',
  },
  'INC-8192': {
    title: 'QuickGuard payroll reconciliation closed',
    summary: 'A payroll reconciliation run failure was resolved and closed.',
    severity: 'high', status: 'closed', started_at: '2026-08-24 14:10',
  },
  'INC-8193': {
    title: 'The Forge sandbox isolation resolved',
    summary: 'A sandbox isolation breach attempt was contained and resolved.',
    severity: 'high', status: 'resolved', started_at: '2026-08-24 13:30',
  },
};

// --- Confirmed-demo matching ---------------------------------------------------

/** True only when a live alert is byte-for-byte identical to its seeded demo
 *  fixture — i.e. it has not been edited, re-severitied, re-stated, or had a
 *  new occurrence since the migration. Any divergence → retained as genuine. */
export function isConfirmedDemoAlert(row: AiAlertRow): boolean {
  const fp = DEMO_ALERTS[row.alert_key];
  if (!fp) return false;
  return (
    row.title === fp.title &&
    (row.summary ?? null) === fp.summary &&
    (row.severity ?? null) === fp.severity &&
    (row.status ?? null) === fp.status &&
    row.occurrence_count === fp.occurrence_count &&
    normalizeTimestamp(row.first_seen_at) === normalizeTimestamp(fp.first_seen_at) &&
    normalizeTimestamp(row.last_seen_at) === normalizeTimestamp(fp.last_seen_at)
  );
}

/** True only when a live incident is byte-for-byte identical to its seeded demo
 *  fixture. Any divergence → retained as genuine. */
export function isConfirmedDemoIncident(row: AiIncidentRow): boolean {
  const fp = DEMO_INCIDENTS[row.incident_key];
  if (!fp) return false;
  return (
    row.title === fp.title &&
    (row.summary ?? null) === fp.summary &&
    (row.severity ?? null) === fp.severity &&
    (row.status ?? null) === fp.status &&
    normalizeTimestamp(row.started_at) === normalizeTimestamp(fp.started_at)
  );
}