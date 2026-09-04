// ============================================================================
// AI Operations — Wallboard Sites & Services selectors.
//
// Pure read-only derivations over the shared group live-data snapshot
// (authoritative `ai_sites` registry) + the website reachability/SSL monitor
// (siteStore.ts) + the reused public-service health (infrastructureSelectors).
// These produce a distance-readable public-availability view and the critical
// outages that feed Wallboard 22 Incident Mode.
//
// Honesty & source-priority rules honoured here:
//   * The Group Site Registry is the AUTHORITATIVE site list — no separate
//     hard-coded site array.
//   * Availability is derived from the application-level `operational_status`
//     (deeper than a bare HTTP 200). A simple reachability check is never
//     treated as proof the full application is healthy.
//   * Response-time / SSL come ONLY from `internal_monitored_websites` (the
//     authoritative monitor). A stale reading is never shown as current, and an
//     unmatched site is "not monitored" — never fabricated.
//   * UNKNOWN is kept distinct from OFFLINE; monitoring-unavailable is never
//     shown as ONLINE.
//   * Only authoritative states trigger incidents: a fresh certificate-expired
//     reading. Site outages and service outages already feed Incident Mode via
//     getSiteHealth() and getInfrastructureIncidents() and are NOT duplicated.
// ============================================================================

import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { getSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import {
  getInfrastructureServices,
  type InfraStatus,
} from '@/pages/ai-operations/wallboard/infrastructureSelectors';
import { getUsersOnline } from '@/pages/ai-operations/wallboard/selectors';

// --- Normalised site availability ---------------------------------------------

export type SiteAvailability = 'online' | 'degraded' | 'offline' | 'maintenance' | 'unknown';

export const SITE_STATE_META: Record<
  SiteAvailability,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }
> = {
  online: { label: 'ONLINE', tone: 'emerald' },
  degraded: { label: 'DEGRADED', tone: 'amber' },
  offline: { label: 'OFFLINE', tone: 'red' },
  maintenance: { label: 'MAINTENANCE', tone: 'amber' },
  unknown: { label: 'UNKNOWN', tone: 'secondary' },
};

/**
 * Normalise the registry `operational_status` (application-level health) onto
 * wallboard levels. Maintenance is respected (never flagged as outage) when the
 * registry already carries it. Underlying states are never rewritten.
 */
function normalizeSiteStatus(status: string | null | undefined): SiteAvailability {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':
    case 'active':
      return 'online';
    case 'warning':
    case 'partial':
      return 'degraded';
    case 'critical':
    case 'offline':
    case 'down':
      return 'offline';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'unknown';
  }
}

// A reading older than this is STALE and never shown as current.
const STALE_MS = 10 * 60 * 1000; // 10 minutes

function isStale(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  return now.getTime() - d.getTime() > STALE_MS;
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

// --- Site tile model ----------------------------------------------------------

export interface SitesServiceTile {
  key: string;
  name: string;
  domain: string;
  state: SiteAvailability;
  aiStatus: string;
  criticality: string | null;
  onlineVisitors: number | null;
  /** Reachability overlay — only from the authoritative monitor. */
  monitoring: 'monitored' | 'not_monitored' | 'stale';
  responseTimeMs: number | null;
  sslStatus: 'valid' | 'warning' | 'expired' | null;
  lastCheck: string | null;
}

function normalizeSsl(ssl: string | null | undefined): SitesServiceTile['sslStatus'] {
  switch ((ssl ?? '').toLowerCase()) {
    case 'valid':
      return 'valid';
    case 'warning':
    case 'expiring':
      return 'warning';
    case 'expired':
      return 'expired';
    default:
      return null;
  }
}

/**
 * The authoritative site list (Group Site Registry) with availability from
 * `operational_status`, online visitors from Wallboard 20 presence, and a
 * reachability/SSL overlay joined from the authoritative monitor by domain.
 */
export function getSitesServicesList(): SitesServiceTile[] {
  const data = getGroupLiveData();
  const monitor = getSiteMonitorData();
  const presence = getUsersOnline();
  const now = new Date();

  const monitorByDomain = new Map<string, (typeof monitor.websites)[number]>();
  for (const w of monitor.websites) {
    const key = normalizeDomain(w.url);
    if (key) monitorByDomain.set(key, w);
  }

  const presenceByKey = new Map(presence.sites.map((s) => [s.siteKey, s.count]));

  return data.sites.map((s) => {
    const domainKey = normalizeDomain(s.domain);
    const match = monitorByDomain.get(domainKey);

    let monitoring: SitesServiceTile['monitoring'];
    let responseTimeMs: number | null = null;
    let sslStatus: SitesServiceTile['sslStatus'] = null;
    let lastCheck: string | null = null;

    if (!match) {
      monitoring = 'not_monitored';
    } else if (isStale(match.last_checked_at, now)) {
      monitoring = 'stale';
      lastCheck = match.last_checked_at;
    } else {
      monitoring = 'monitored';
      responseTimeMs = match.last_response_time_ms ?? null;
      sslStatus = normalizeSsl(match.ssl_status);
      lastCheck = match.last_checked_at;
    }

    return {
      key: s.site_key,
      name: s.name,
      domain: s.domain ?? '',
      state: normalizeSiteStatus(s.operational_status),
      aiStatus: s.ai_status,
      criticality: s.criticality,
      onlineVisitors: presenceByKey.get(s.site_key) ?? null,
      monitoring,
      responseTimeMs,
      sslStatus,
      lastCheck,
    };
  });
}

// --- Public services (reused from dfp_service_health, no re-fetch) ------------

// Public-facing dependency services (externally reachable / critical deps).
// The rest (n8n automation, PBX, UAT worker, backups, deployment) are internal
// and remain in the Infrastructure view.
const PUBLIC_SERVICE_KEYS = [
  'website',
  'supabase_auth',
  'supabase_database',
  'supabase_storage',
  'stripe',
  'email_resend',
];

export interface PublicServiceTile {
  key: string;
  name: string;
  category: string;
  status: InfraStatus;
  latencyMs: number | null;
}

export function getPublicServices(): PublicServiceTile[] {
  return getInfrastructureServices()
    .filter((s) => PUBLIC_SERVICE_KEYS.includes(s.key))
    .map((s) => ({
      key: s.key,
      name: s.name,
      category: s.category ?? 'service',
      status: s.status,
      latencyMs: s.latencyMs,
    }));
}

// --- Summary -----------------------------------------------------------------

export interface SitesServicesSummary {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  maintenance: number;
  unknown: number;
  /** Whether the authoritative registry loaded. */
  sourceState: 'live' | 'unavailable';
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'red' | 'secondary';
}

export function getSitesServicesSummary(): SitesServicesSummary {
  const data = getGroupLiveData();
  const tiles = getSitesServicesList();

  const counts = { online: 0, degraded: 0, offline: 0, maintenance: 0, unknown: 0 };
  for (const t of tiles) counts[t.state] += 1;

  const sourceState: SitesServicesSummary['sourceState'] =
    data.mode === 'unavailable' || !data.availability.sites ? 'unavailable' : 'live';

  let label: string;
  let detail: string;
  let tone: SitesServicesSummary['tone'];

  if (sourceState === 'unavailable') {
    label = 'SITE STATUS UNKNOWN';
    detail = 'Site registry could not be reached.';
    tone = 'secondary';
  } else if (counts.offline > 0) {
    label = `${counts.offline} SITE${counts.offline > 1 ? 'S' : ''} OFFLINE`;
    detail = `${counts.online} online · ${counts.degraded} degraded · ${counts.offline} offline`;
    tone = 'red';
  } else if (counts.degraded > 0 || counts.maintenance > 0) {
    label = 'DEGRADED';
    detail = `${counts.degraded} degraded · ${counts.maintenance} maintenance`;
    tone = 'amber';
  } else {
    label = 'ALL SITES ONLINE';
    detail = `${counts.online} of ${counts.total} sites healthy`;
    tone = 'emerald';
  }

  return { total: tiles.length, ...counts, sourceState, label, detail, tone };
}

// --- Critical incidents (feed Wallboard 22 Incident Mode) ---------------------

export interface SitesIncident {
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
 * Authoritative sites/services incidents only. Site outages (offline/critical)
 * and service outages (dfp_service_health offline/degraded) ALREADY feed
 * Incident Mode via getSiteHealth() and getInfrastructureIncidents(), so they
 * are NOT duplicated here.
 *
 * The only genuinely new signal is a FRESH certificate-expired reading from the
 * authoritative SSL monitor. A stale reading is never treated as an outage.
 */
export function getSitesIncidents(): SitesIncident[] {
  const tiles = getSitesServicesList();
  const incidents: SitesIncident[] = [];

  for (const t of tiles) {
    if (t.monitoring !== 'monitored' || t.sslStatus !== 'expired') continue;
    incidents.push({
      id: `sites-ssl-${t.key}`,
      severity: 'critical',
      title: `${t.name} certificate expired`,
      affectedService: t.name,
      sourceLabel: 'Sites',
      firstDetected: t.lastCheck,
      lastUpdated: t.lastCheck,
      status: 'expired',
      description: `Public certificate for ${t.domain} is expired.`,
    });
  }

  return incidents;
}