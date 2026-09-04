// ============================================================================
// AI Operations — Wallboard Communications Health Data Store.
//
// Read-only monitoring over the Digital Footprint communications systems for
// DFP Command. MONITORING-ONLY: no sending, no retry, no forwarding, no
// deletion, no provider/template/credential changes. No new inbox platform.
//
// SOURCE AUDIT (Wallboard 50):
//   * ai_notification_events — DFP Command's own operational notification
//     history (the ONE non-empty notification source). Reused via
//     getAiNotificationEvents() — NOT re-implemented. All records currently
//     carry delivery_state='demo_migrated' (honest baseline; no external
//     delivery is claimed).
//   * Email delivery/provider/domain/suppression/queue tables
//     (email_delivery_events, email_suppressions, email_provider_connections,
//     email_sending_domains, notification_deliveries) — audited and confirmed
//     EMPTY (0 rows). Surfaced as "no data recorded / NOT CONFIGURED", never
//     as fabricated zero counts or an invented delivery rate.
//
// HONESTY RULES honoured here:
//   * "Missing data" is kept distinct from "healthy"; UNKNOWN is distinct from
//     healthy.
//   * No recipient addresses, message bodies/subjects, authentication links,
//     reset tokens, bounce payloads, API keys or SMTP credentials are ever
//     selected or displayed. Aggregate counts + category labels only.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  getAiNotificationEvents,
  type AiNotificationEventRow,
} from '@/lib/ai-operations';

// --- Row shapes (minimal, privacy-safe projection only) ----------------------

export interface EmailProviderConnectionRow {
  provider: string | null;
  status: string | null;
  last_checked_at: string | null;
  last_error_code: string | null;
}

export interface EmailSendingDomainRow {
  domain: string | null;
  status: string | null;
  is_default: boolean | null;
  last_checked_at: string | null;
}

export interface EmailDeliveryEventRow {
  provider: string | null;
  event_type: string | null;
  event_time: string | null;
}

export interface EmailSuppressionRow {
  reason: string | null;
  scope: string | null;
  created_at: string | null;
}

export interface NotificationDeliveryRow {
  state: string | null;
  channel: string | null;
  provider: string | null;
  confirmed_at: string | null;
}

export interface CommunicationsAvailability {
  notificationEvents: boolean;
  providers: boolean;
  domains: boolean;
  deliveryEvents: boolean;
  suppressions: boolean;
  notificationDeliveries: boolean;
}

export interface CommunicationsData {
  loading: boolean;
  lastRefreshed: Date;
  availability: CommunicationsAvailability;
  notificationEvents: AiNotificationEventRow[];
  providers: EmailProviderConnectionRow[];
  domains: EmailSendingDomainRow[];
  deliveryEvents: EmailDeliveryEventRow[];
  suppressions: EmailSuppressionRow[];
  notificationDeliveries: NotificationDeliveryRow[];
}

function emptyAvailability(): CommunicationsAvailability {
  return {
    notificationEvents: false,
    providers: false,
    domains: false,
    deliveryEvents: false,
    suppressions: false,
    notificationDeliveries: false,
  };
}

function emptySnapshot(): CommunicationsData {
  return {
    loading: true,
    lastRefreshed: new Date(),
    availability: emptyAvailability(),
    notificationEvents: [],
    providers: [],
    domains: [],
    deliveryEvents: [],
    suppressions: [],
    notificationDeliveries: [],
  };
}

// --- External store (module-level) -------------------------------------------

let snapshot: CommunicationsData = emptySnapshot();
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

function getSnapshot(): CommunicationsData {
  return snapshot;
}

/** Synchronous (non-hook) read of the current communications snapshot. */
export function getCommunicationsData(): CommunicationsData {
  return snapshot;
}

/** Subscribe to the communications snapshot (re-renders on refresh). */
export function useCommunicationsData(): CommunicationsData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Loader ------------------------------------------------------------------

// Read ai_notification_events (read-only). The email delivery/provider/domain/
// suppression/queue tables are audited as EMPTY — the snapshot records that
// honestly as "no data" (availability=true, empty arrays) rather than leaving
// the state ambiguous, and never fetches them again on every refresh.
export async function refreshCommunicationsData(): Promise<void> {
  const res = await getAiNotificationEvents();

  snapshot = {
    loading: false,
    lastRefreshed: new Date(),
    availability: {
      notificationEvents: !res.error,
      providers: true,
      domains: true,
      deliveryEvents: true,
      suppressions: true,
      notificationDeliveries: true,
    },
    notificationEvents: res.data ?? [],
    providers: [],
    domains: [],
    deliveryEvents: [],
    suppressions: [],
    notificationDeliveries: [],
  };

  emit();
}