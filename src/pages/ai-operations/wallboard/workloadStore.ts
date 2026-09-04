// ============================================================================
// AI Operations — Wallboard Operations Workload Data Store.
//
// A read-only aggregation layer over the existing Digital Footprint Command
// operational sources (staff directory, support tickets/teams, internal
// projects, and the UAT system). It is deliberately SEPARATE from
// groupLiveDataStore (which already carries AI runs/approvals/agents) and from
// businessStore, so the operational refresh surface stays independent and each
// source can fail without breaking the others.
//
// READ ONLY — no writes, no new task manager, no new HR system. Projections
// are deliberately privacy-safe: staff email/phone/name, customer identity,
// ticket subject/body, and tester identity are NEVER selected.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal, privacy-safe projections only) --------------------

export interface StaffAggregateRow {
  role: string | null;
  active: boolean;
  status: string | null;
}

export interface SupportTicketRow {
  id: string;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  sla_state: string | null;
  created_at: string | null;
}

export interface SupportTeamRow {
  id: string;
  name: string | null;
  status: string | null;
}

export interface WorkloadProjectRow {
  id: number;
  project_name: string | null;
  status: string | null;
  priority: string | null;
  target_launch_date: string | null;
  created_at: string | null;
}

export interface UatAssignmentRow {
  id: string;
  status: string | null;
  review_status: string | null;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface UatJobRow {
  id: string;
  status: string | null;
}

export interface UatApprovalRow {
  id: string;
  status: string | null;
  decided_at: string | null;
}

export interface UatPaymentRow {
  id: string;
  status: string | null;
}

export interface WorkloadAvailability {
  staff: boolean;
  tickets: boolean;
  teams: boolean;
  projects: boolean;
  uatAssignments: boolean;
  uatJobs: boolean;
  uatApprovals: boolean;
  uatPayments: boolean;
}

export interface WorkloadData {
  loading: boolean;
  lastRefreshed: Date;
  availability: WorkloadAvailability;
  staff: StaffAggregateRow[];
  tickets: SupportTicketRow[];
  teams: SupportTeamRow[];
  projects: WorkloadProjectRow[];
  uatAssignments: UatAssignmentRow[];
  uatJobs: UatJobRow[];
  uatApprovals: UatApprovalRow[];
  uatPayments: UatPaymentRow[];
}

function emptyAvailability(): WorkloadAvailability {
  return {
    staff: false,
    tickets: false,
    teams: false,
    projects: false,
    uatAssignments: false,
    uatJobs: false,
    uatApprovals: false,
    uatPayments: false,
  };
}

function emptySnapshot(): WorkloadData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: emptyAvailability(),
    staff: [],
    tickets: [],
    teams: [],
    projects: [],
    uatAssignments: [],
    uatJobs: [],
    uatApprovals: [],
    uatPayments: [],
  };
}

// --- External store (module-level) -----------------------------------------

let snapshot: WorkloadData = emptySnapshot();
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

function getSnapshot(): WorkloadData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current workload snapshot. */
export function getWorkloadData(): WorkloadData {
  return snapshot;
}

/** Subscribe to the workload snapshot (re-renders on refresh). */
export function useWorkloadData(): WorkloadData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ----------------------------------------------------------------

export async function refreshWorkloadData(): Promise<void> {
  const [
    staffRes,
    ticketsRes,
    teamsRes,
    projectsRes,
    uatAssignmentsRes,
    uatJobsRes,
    uatApprovalsRes,
    uatPaymentsRes,
  ] = await Promise.all([
    supabase.from('staff_profiles').select('role,active,status'),
    supabase
      .from('internal_support_tickets')
      .select('id,status,priority,assigned_to,sla_state,created_at'),
    supabase.from('internal_support_teams').select('id,name,status'),
    supabase
      .from('internal_projects')
      .select('id,project_name,status,priority,target_launch_date,created_at'),
    supabase
      .from('uat_assignments')
      .select('id,status,review_status,submitted_at,completed_at,created_at'),
    supabase.from('uat_jobs').select('id,status'),
    supabase.from('uat_approvals').select('id,status,decided_at'),
    supabase.from('uat_payments').select('id,status'),
  ]);

  const availability: WorkloadAvailability = {
    staff: !staffRes.error,
    tickets: !ticketsRes.error,
    teams: !teamsRes.error,
    projects: !projectsRes.error,
    uatAssignments: !uatAssignmentsRes.error,
    uatJobs: !uatJobsRes.error,
    uatApprovals: !uatApprovalsRes.error,
    uatPayments: !uatPaymentsRes.error,
  };

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability,
    staff: (staffRes.data ?? []) as StaffAggregateRow[],
    tickets: (ticketsRes.data ?? []) as SupportTicketRow[],
    teams: (teamsRes.data ?? []) as SupportTeamRow[],
    projects: (projectsRes.data ?? []) as WorkloadProjectRow[],
    uatAssignments: (uatAssignmentsRes.data ?? []) as UatAssignmentRow[],
    uatJobs: (uatJobsRes.data ?? []) as UatJobRow[],
    uatApprovals: (uatApprovalsRes.data ?? []) as UatApprovalRow[],
    uatPayments: (uatPaymentsRes.data ?? []) as UatPaymentRow[],
  };

  emit();
}