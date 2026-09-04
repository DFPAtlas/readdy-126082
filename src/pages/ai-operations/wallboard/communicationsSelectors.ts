// ============================================================================
// AI Operations — Wallboard Communications Health selectors.
//
// Pure read-only derivations over the EXISTING communications sources — no new
// inbox, no second delivery tracker, no sending/retry controls:
//   * getCommunicationsData() → ai_notification_events (DFP notification
//     history) + email provider/domain/delivery/suppression/queue tables.
//   * getGroupLiveData()      → ai_sites (per-site email_provider field).
//   * getSupport()            → Wallboard 41 support-inbox health (reused, NOT
//     duplicated) for the "support inbox relationship".
//
// HONESTY RULES honoured here:
//   * Email delivery/provider/domain/suppression/queue tables are readable but
//     EMPTY — reported as "no data / NOT CONFIGURED", never as zero counts or
//     an invented delivery percentage.
//   * A delivery rate is only produced when authoritative delivered + attempted
//     figures exist (they do not today) — otherwise N/A, with the formula
//     documented.
//   * Missing data is never shown as zero; unavailable is distinct from healthy.
//   * No recipient identity, bodies, subjects, links, tokens or credentials.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getCommunicationsData } from '@/pages/ai-operations/wallboard/communicationsStore';
import { getSupportData } from '@/pages/ai-operations/wallboard/supportStore';

// --- Source-state helper ------------------------------------------------------

export type CommsSourceState = 'live' | 'empty' | 'unavailable';

function classify(available: boolean, count: number): CommsSourceState {
  if (!available) return 'unavailable';
  return count > 0 ? 'live' : 'empty';
}

// --- Provider status -----------------------------------------------------------

export interface ProviderStatusRow {
  provider: string;
  status: string;
  lastChecked: string | null;
  lastError: string | null;
}

export interface ProviderStatusResult {
  sourceState: CommsSourceState;
  rows: ProviderStatusRow[];
}

export function getProviderStatus(): ProviderStatusResult {
  const data = getCommunicationsData();
  const rows = data.providers.map((p) => ({
    provider: p.provider ?? 'Unknown provider',
    status: (p.status ?? 'unknown').toLowerCase(),
    lastChecked: p.last_checked_at,
    lastError: p.last_error_code,
  }));
  return {
    sourceState: classify(data.availability.providers, data.providers.length),
    rows,
  };
}

// --- Sending domains -----------------------------------------------------------

export interface SendingDomainRow {
  domain: string;
  status: string;
  isDefault: boolean;
  lastChecked: string | null;
}

export interface SendingDomainResult {
  sourceState: CommsSourceState;
  rows: SendingDomainRow[];
}

export function getSendingDomains(): SendingDomainResult {
  const data = getCommunicationsData();
  const rows = data.domains.map((d) => ({
    domain: d.domain ?? 'Unknown domain',
    status: (d.status ?? 'unknown').toLowerCase(),
    isDefault: d.is_default === true,
    lastChecked: d.last_checked_at,
  }));
  return {
    sourceState: classify(data.availability.domains, data.domains.length),
    rows,
  };
}

// --- Delivery summary (email_delivery_events) ---------------------------------

// Delivery-rate definition (documented for transparency):
//   delivered ÷ attempted, where "attempted" excludes queued/in-flight messages.
// No rate is produced unless authoritative delivered + attempted figures exist.

export interface DeliverySummary {
  sourceState: CommsSourceState;
  sent: number | null;
  delivered: number | null;
  failed: number | null;
  bounced: number | null;
  latestEvent: string | null;
  deliveryRate: number | null;
}

const DELIVERED_TYPES = new Set(['delivered']);
const FAILED_TYPES = new Set(['failed', 'send_failed', 'error']);
const BOUNCED_TYPES = new Set(['bounced', 'bounce', 'hard_bounce', 'soft_bounce']);
const SENT_TYPES = new Set(['sent', 'queued', 'scheduled', 'accepted']);

export function getDeliverySummary(): DeliverySummary {
  const data = getCommunicationsData();
  const events = data.deliveryEvents;

  const available = data.availability.deliveryEvents;
  const hasData = events.length > 0;

  if (!available) {
    return {
      sourceState: 'unavailable',
      sent: null,
      delivered: null,
      failed: null,
      bounced: null,
      latestEvent: null,
      deliveryRate: null,
    };
  }

  if (!hasData) {
    return {
      sourceState: 'empty',
      sent: null,
      delivered: null,
      failed: null,
      bounced: null,
      latestEvent: null,
      deliveryRate: null,
    };
  }

  const count = (set: Set<string>) =>
    events.filter((e) => set.has((e.event_type ?? '').toLowerCase())).length;
  const sent = count(SENT_TYPES);
  const delivered = count(DELIVERED_TYPES);
  const failed = count(FAILED_TYPES);
  const bounced = count(BOUNCED_TYPES);

  // attempted = delivered + failed + bounced (excludes queued/in-flight).
  const attempted = delivered + failed + bounced;
  const deliveryRate = attempted > 0 ? delivered / attempted : null;

  const latestEvent = events
    .map((e) => e.event_time)
    .filter((v): v is string => v != null && v !== '')
    .sort()
    .pop() ?? null;

  return {
    sourceState: 'live',
    sent,
    delivered,
    failed,
    bounced,
    latestEvent,
    deliveryRate,
  };
}

/** Documented delivery-rate definition, surfaced for transparency on the wall. */
export function getDeliveryRateDefinition(): string {
  return 'delivery rate = delivered ÷ attempted (attempted excludes queued/in-flight)';
}

// --- Bounces (email_suppressions) ----------------------------------------------

export interface BounceBreakdown {
  reason: string;
  count: number;
}

export interface BounceResult {
  sourceState: CommsSourceState;
  total: number | null;
  breakdown: BounceBreakdown[];
}

export function getBounces(): BounceResult {
  const data = getCommunicationsData();
  const rows = data.suppressions;

  if (!data.availability.suppressions) {
    return { sourceState: 'unavailable', total: null, breakdown: [] };
  }
  if (rows.length === 0) {
    return { sourceState: 'empty', total: null, breakdown: [] };
  }

  const byReason = new Map<string, number>();
  for (const r of rows) {
    const key = (r.reason ?? 'unspecified').trim() || 'unspecified';
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  const breakdown = Array.from(byReason.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return { sourceState: 'live', total: rows.length, breakdown };
}

// --- Notification queue (notification_deliveries) -------------------------------

export interface QueueState {
  sourceState: CommsSourceState;
  queued: number | null;
  processing: number | null;
  failed: number | null;
  delivered: number | null;
}

const QUEUED_STATES = new Set(['queued', 'pending', 'scheduled', 'requested']);
const PROCESSING_STATES = new Set(['processing', 'sending', 'in_flight']);
const FAILED_STATES = new Set(['failed', 'error', 'bounced', 'permanent_failure']);
const DELIVERED_STATES = new Set(['delivered', 'sent', 'confirmed', 'complete']);

export function getQueueState(): QueueState {
  const data = getCommunicationsData();
  const rows = data.notificationDeliveries;

  if (!data.availability.notificationDeliveries) {
    return { sourceState: 'unavailable', queued: null, processing: null, failed: null, delivered: null };
  }
  if (rows.length === 0) {
    return { sourceState: 'empty', queued: null, processing: null, failed: null, delivered: null };
  }

  const count = (set: Set<string>) =>
    rows.filter((r) => set.has((r.state ?? '').toLowerCase())).length;

  return {
    sourceState: 'live',
    queued: count(QUEUED_STATES),
    processing: count(PROCESSING_STATES),
    failed: count(FAILED_STATES),
    delivered: count(DELIVERED_STATES),
  };
}

// --- DFP notification history (ai_notification_events) ---------------------------

export interface NotificationSummary {
  sourceState: CommsSourceState;
  total: number | null;
  byChannel: { label: string; count: number }[];
  deliveryStates: { label: string; count: number }[];
  latestEvent: string | null;
}

export function getNotificationSummary(): NotificationSummary {
  const data = getCommunicationsData();
  const events = data.notificationEvents;

  if (!data.availability.notificationEvents) {
    return {
      sourceState: 'unavailable',
      total: null,
      byChannel: [],
      deliveryStates: [],
      latestEvent: null,
    };
  }
  if (events.length === 0) {
    return {
      sourceState: 'empty',
      total: null,
      byChannel: [],
      deliveryStates: [],
      latestEvent: null,
    };
  }

  const byChannel = new Map<string, number>();
  for (const e of events) {
    const key = (e.channel ?? 'unspecified').trim() || 'unspecified';
    byChannel.set(key, (byChannel.get(key) ?? 0) + 1);
  }
  const byChannelRows = Array.from(byChannel.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const byState = new Map<string, number>();
  for (const e of events) {
    const key = (e.delivery_state ?? e.status ?? 'unspecified').trim() || 'unspecified';
    byState.set(key, (byState.get(key) ?? 0) + 1);
  }
  const deliveryStates = Array.from(byState.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const latestEvent = events
    .map((e) => e.created_at)
    .filter((v): v is string => v != null && v !== '')
    .sort()
    .pop() ?? null;

  return {
    sourceState: 'live',
    total: events.length,
    byChannel: byChannelRows,
    deliveryStates,
    latestEvent,
  };
}

// --- Message categories (ai_notification_events event_type) ---------------------

export interface CategoryBreakdown {
  label: string;
  count: number;
}

export function getMessageCategories(): CategoryBreakdown[] {
  const data = getCommunicationsData();
  const byType = new Map<string, number>();
  for (const e of data.notificationEvents) {
    const key = (e.event_type ?? 'other').trim() || 'Other';
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  return Array.from(byType.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// --- Site communication status (ai_sites.email_provider) ------------------------

export type SiteCommsState = 'configured' | 'not_configured' | 'unavailable';

export interface SiteCommunicationRow {
  siteId: string;
  siteName: string;
  provider: string | null;
  state: SiteCommsState;
}

export function getSiteCommunication(): SiteCommunicationRow[] {
  const data = getGroupLiveData();

  return data.sites.map((site) => {
    const provider = site.email_provider?.trim() || null;
    let state: SiteCommsState;
    if (!data.availability.sites) state = 'unavailable';
    else if (provider) state = 'configured';
    else state = 'not_configured';

    return {
      siteId: site.id,
      siteName: site.name,
      provider,
      state,
    };
  });
}

// --- Support inbox relationship (reuse Wallboard 41, NOT duplicated) ------------

export interface SupportInboxHealth {
  receiving: 'live' | 'unavailable';
  openTickets: number | null;
  urgentTickets: number | null;
  sourceState: string;
}

export function getSupportInboxHealth(): SupportInboxHealth {
  // The support overview (support_analytics_overview) carries the authoritative
  // inbox queue figures. Reused from the Wallboard 41 support store — no new
  // ticketing query and no duplicate workload.
  const data = getSupportData();
  const overview = data.overview;
  const overviewOk = data.availability.overview && overview != null;

  return {
    receiving: data.availability.overview ? 'live' : 'unavailable',
    openTickets: overviewOk ? overview.open_tickets : null,
    urgentTickets: overviewOk ? overview.urgent_tickets : null,
    sourceState: data.availability.overview ? 'live' : 'unavailable',
  };
}

// --- Monitoring gaps (honest, never fabricated) -----------------------------------

export interface CommunicationGap {
  area: string;
  note: string;
}

export function getCommunicationGaps(): CommunicationGap[] {
  return [
    { area: 'Email delivery', note: 'No email delivery events are recorded — the email delivery event log (provider webhooks) is empty.' },
    { area: 'Email provider', note: 'No email provider connection is registered (email_provider_connections is empty) — provider status is NOT CONFIGURED.' },
    { area: 'Sending domain', note: 'No sending domain is registered or verified — outbound domain status is NOT CONFIGURED.' },
    { area: 'Bounces / suppressions', note: 'No bounce or suppression records exist — bounce tracking is not yet populated.' },
    { area: 'Notification queue', note: 'No notification delivery attempts are recorded — the queue is empty, not confirmed healthy.' },
    { area: 'DFP notifications', note: 'DFP notification events are baseline migrated data (demo_migrated) — no live external delivery is claimed.' },
  ];
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ------------------------

export interface CommunicationIncident {
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
 * Authoritative communications incidents only. There is currently NO
 * authoritative escalation signal here:
 *   * The email provider / delivery / queue tables are empty — an empty table
 *     is a "not yet populated" state, not a runtime outage, so no outage can be
 *     raised honestly.
 *   * DFP notification events are baseline migrated data, not live failures.
 *   * There is no provider-unavailable or widespread-failure telemetry.
 * Returns an empty list until an authoritative escalation rule exists.
 */
export function getCommunicationIncidents(): CommunicationIncident[] {
  return [];
}