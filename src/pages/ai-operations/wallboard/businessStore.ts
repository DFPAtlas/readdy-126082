// ============================================================================
// AI Operations — Wallboard Business Data Store.
//
// A read-only aggregation layer over the existing Digital Footprint business
// registries (leads, clients, invoices, checkout orders, subscriptions,
// internal projects, and the UAT system). This is deliberately SEPARATE from
// groupLiveDataStore so the operational refresh surface stays untouched.
//
// READ ONLY — no writes, no new tables, no new CRM/ledger. Each source loads
// independently so a single failing source never breaks the others (it just
// surfaces as "unavailable" in the derived KPIs).
// ============================================================================

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

// --- Row shapes (minimal projections only) ---------------------------------

export interface BusinessLeadRow {
  id: string;
  status: string | null;
  stage: string | null;
  created_at: string | null;
  estimated_value: number | null;
  currency: string | null;
  archived_at: string | null;
  // Pipeline / conversion fields (Lead Engine authoritative signals).
  source: string | null;
  campaign: string | null;
  converted_to_client: string | null;
  converted_to_project: string | null;
  converted_at: string | null;
  lost_reason: string | null;
  next_action_due: string | null;
  stage_changed_at: string | null;
  last_activity_at: string | null;
}

export interface BusinessFollowUpRow {
  id: string;
  lead_id: string | null;
  action: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string | null;
}

export interface BusinessStageHistoryRow {
  id: string;
  lead_id: string | null;
  from_stage: string | null;
  to_stage: string | null;
  created_at: string | null;
}

export interface BusinessClientRow {
  id: string;
  status: string | null;
  created_at: string | null;
  archived_at: string | null;
}

export interface BusinessInvoiceRow {
  id: string;
  status: string | null;
  currency: string | null;
  amount_paid: number | null;
  amount_outstanding: number | null;
  paid_at: string | null;
  archived_at: string | null;
  cancelled_at: string | null;
  written_off_at: string | null;
}

export interface BusinessCheckoutRow {
  id: string;
  currency: string | null;
  starting_payment_minor: number | null;
  remaining_balance_minor: number | null;
  payment_status: string | null;
  created_at: string | null;
}

export interface BusinessSubscriptionRow {
  id: string;
  status: string | null;
  currency: string | null;
  amount: number | null;
  interval: string | null;
}

export interface BusinessProjectRow {
  id: number;
  status: string | null;
  created_at: string | null;
}

export interface BusinessUatRow {
  id: string;
  status: string | null;
  created_at: string | null;
}

export interface BusinessAvailability {
  leads: boolean;
  clients: boolean;
  invoices: boolean;
  checkout: boolean;
  subscriptions: boolean;
  projects: boolean;
  uatProjects: boolean;
  uatAssignments: boolean;
  uatApprovals: boolean;
  uatPayments: boolean;
  followUps: boolean;
  stageHistory: boolean;
}

export interface BusinessData {
  loading: boolean;
  lastRefreshed: Date;
  availability: BusinessAvailability;
  leads: BusinessLeadRow[];
  clients: BusinessClientRow[];
  invoices: BusinessInvoiceRow[];
  checkout: BusinessCheckoutRow[];
  subscriptions: BusinessSubscriptionRow[];
  projects: BusinessProjectRow[];
  uatProjects: BusinessUatRow[];
  uatAssignments: BusinessUatRow[];
  uatApprovals: BusinessUatRow[];
  uatPayments: BusinessUatRow[];
  followUps: BusinessFollowUpRow[];
  stageHistory: BusinessStageHistoryRow[];
}

function emptyAvailability(): BusinessAvailability {
  return {
    leads: false,
    clients: false,
    invoices: false,
    checkout: false,
    subscriptions: false,
    projects: false,
    uatProjects: false,
    uatAssignments: false,
    uatApprovals: false,
    uatPayments: false,
    followUps: false,
    stageHistory: false,
  };
}

function emptySnapshot(): BusinessData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: emptyAvailability(),
    leads: [],
    clients: [],
    invoices: [],
    checkout: [],
    subscriptions: [],
    projects: [],
    uatProjects: [],
    uatAssignments: [],
    uatApprovals: [],
    uatPayments: [],
    followUps: [],
    stageHistory: [],
  };
}

// --- External store (module-level) -----------------------------------------

let snapshot: BusinessData = emptySnapshot();
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

function getSnapshot(): BusinessData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current business snapshot. */
export function getBusinessData(): BusinessData {
  return snapshot;
}

/** Subscribe to the business snapshot (re-renders on refresh). */
export function useBusinessData(): BusinessData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ----------------------------------------------------------------

export async function refreshBusinessData(): Promise<void> {
  const [
    leadsRes,
    clientsRes,
    invoicesRes,
    checkoutRes,
    subscriptionsRes,
    projectsRes,
    uatProjectsRes,
    uatAssignmentsRes,
    uatApprovalsRes,
    uatPaymentsRes,
    followUpsRes,
    stageHistoryRes,
  ] = await Promise.all([
    supabase.from('leads').select('id,status,stage,created_at,estimated_value,currency,archived_at,source,campaign,converted_to_client,converted_to_project,converted_at,lost_reason,next_action_due,stage_changed_at,last_activity_at'),
    supabase.from('clients').select('id,status,created_at,archived_at'),
    supabase.from('invoices').select('id,status,currency,amount_paid,amount_outstanding,paid_at,archived_at,cancelled_at,written_off_at'),
    supabase.from('dfp_checkout_orders').select('id,currency,starting_payment_minor,remaining_balance_minor,payment_status,created_at'),
    supabase.from('subscriptions').select('id,status,currency,amount,interval'),
    supabase.from('internal_projects').select('id,status,created_at'),
    supabase.from('uat_projects').select('id,status,created_at'),
    supabase.from('uat_assignments').select('id,status,created_at'),
    supabase.from('uat_approvals').select('id,status,created_at'),
    supabase.from('uat_payments').select('id,status,created_at'),
    supabase.from('lead_follow_ups').select('id,lead_id,action,due_at,completed_at,outcome,created_at'),
    supabase.from('lead_stage_history').select('id,lead_id,from_stage,to_stage,created_at'),
  ]);

  const availability: BusinessAvailability = {
    leads: !leadsRes.error,
    clients: !clientsRes.error,
    invoices: !invoicesRes.error,
    checkout: !checkoutRes.error,
    subscriptions: !subscriptionsRes.error,
    projects: !projectsRes.error,
    uatProjects: !uatProjectsRes.error,
    uatAssignments: !uatAssignmentsRes.error,
    uatApprovals: !uatApprovalsRes.error,
    uatPayments: !uatPaymentsRes.error,
    followUps: !followUpsRes.error,
    stageHistory: !stageHistoryRes.error,
  };

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability,
    leads: (leadsRes.data ?? []) as BusinessLeadRow[],
    clients: (clientsRes.data ?? []) as BusinessClientRow[],
    invoices: (invoicesRes.data ?? []) as BusinessInvoiceRow[],
    checkout: (checkoutRes.data ?? []) as BusinessCheckoutRow[],
    subscriptions: (subscriptionsRes.data ?? []) as BusinessSubscriptionRow[],
    projects: (projectsRes.data ?? []) as BusinessProjectRow[],
    uatProjects: (uatProjectsRes.data ?? []) as BusinessUatRow[],
    uatAssignments: (uatAssignmentsRes.data ?? []) as BusinessUatRow[],
    uatApprovals: (uatApprovalsRes.data ?? []) as BusinessUatRow[],
    uatPayments: (uatPaymentsRes.data ?? []) as BusinessUatRow[],
    followUps: (followUpsRes.data ?? []) as BusinessFollowUpRow[],
    stageHistory: (stageHistoryRes.data ?? []) as BusinessStageHistoryRow[],
  };

  emit();
}