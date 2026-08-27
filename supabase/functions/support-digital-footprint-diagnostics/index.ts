import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-digital-footprint-diagnostics — read-only, server-to-server
// diagnostic data connector for the n8n DFP Support Diagnostics Agent.
//
//   * verify_jwt = false → n8n is the caller (no browser JWT available).
//   * Authenticated via HMAC-SHA256 shared secret + 5-minute timestamp window.
//   * Read-only: never creates/updates/deletes customer data; never returns
//     secrets, auth tokens, password data, internal notes, or unrestricted rows.
//   * Informational "unavailable" checks never fail the connector — only real
//     faults surface as warning/error.
// ============================================================================

const encoder = new TextEncoder();
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const SOURCE = "digital-footprint";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE_KEYS = ["account", "authentication", "subscription", "email", "recent_errors"];

// Maps a request scope key to the emitted check name.
const CHECK_NAMES: Record<string, string> = {
  account: "account_status",
  authentication: "authentication",
  subscription: "subscription",
  email: "email_delivery",
  recent_errors: "recent_errors",
};

type CheckStatus = "pass" | "warning" | "fail" | "error" | "unavailable";
type CheckSeverity = "info" | "warning" | "error";

interface Check {
  name: string;
  status: CheckStatus;
  severity: CheckSeverity;
  message: string;
  details?: Record<string, unknown>;
  source: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function cleanScope(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === "string" && SCOPE_KEYS.includes(v) && !out.includes(v)) out.push(v);
  }
  return out.length ? out : [...SCOPE_KEYS];
}

function asUuid(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// ACCOUNT — inspect the organisation (clients) record. Returns safe fields only.
// ---------------------------------------------------------------------------
async function checkAccount(admin: ReturnType<typeof createClient>, organisationId: string | null): Promise<Check> {
  if (!organisationId) {
    return {
      name: CHECK_NAMES.account,
      status: "unavailable",
      severity: "info",
      message: "No organisation record is linked.",
      source: SOURCE,
    };
  }

  const { data: client, error } = await admin
    .from("clients")
    .select(
      "status, portal_access_state, health_status, attention_needed, onboarding_state, offboarding_state, last_activity_at, archived_at",
    )
    .eq("id", organisationId)
    .maybeSingle();

  if (error) throw error;

  if (!client) {
    return {
      name: CHECK_NAMES.account,
      status: "warning",
      severity: "warning",
      message: "Organisation record not found.",
      source: SOURCE,
    };
  }

  const rawStatus = typeof client.status === "string" ? client.status.toLowerCase() : "";
  const isActive = !client.archived_at && rawStatus !== "inactive" && rawStatus !== "archived";

  return {
    name: CHECK_NAMES.account,
    status: isActive ? "pass" : "warning",
    severity: isActive ? "info" : "warning",
    message: isActive
      ? "Organisation record is active."
      : `Organisation record status is "${client.status ?? "unknown"}".`,
    details: {
      exists: true,
      status: client.status ?? null,
      portal_access_state: client.portal_access_state ?? null,
      health_status: client.health_status ?? null,
      attention_needed: client.attention_needed === true,
      onboarding_state: client.onboarding_state ?? null,
      offboarding_state: client.offboarding_state ?? null,
      last_activity_at: client.last_activity_at ?? null,
    },
    source: SOURCE,
  };
}

// ---------------------------------------------------------------------------
// AUTHENTICATION — inspect the profile/auth relationship. No tokens/hashes.
// ---------------------------------------------------------------------------
async function checkAuthentication(admin: ReturnType<typeof createClient>, customerId: string | null): Promise<Check> {
  if (!customerId) {
    return {
      name: CHECK_NAMES.authentication,
      status: "unavailable",
      severity: "info",
      message: "No portal/login account is linked to this organisation.",
      source: SOURCE,
    };
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, status, auth_user_id")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    return {
      name: CHECK_NAMES.authentication,
      status: "warning",
      severity: "warning",
      message: "Portal account record not found.",
      source: SOURCE,
    };
  }

  return {
    name: CHECK_NAMES.authentication,
    status: "pass",
    severity: "info",
    message: "Portal account exists.",
    details: {
      account_exists: true,
      profile_status: profile.status ?? null,
      has_portal_login: Boolean(profile.auth_user_id),
    },
    source: SOURCE,
  };
}

// ---------------------------------------------------------------------------
// SUBSCRIPTION — aggregate subscriptions + client_services. No billing data.
// ---------------------------------------------------------------------------
async function checkSubscription(admin: ReturnType<typeof createClient>, organisationId: string | null): Promise<Check> {
  if (!organisationId) {
    return {
      name: CHECK_NAMES.subscription,
      status: "unavailable",
      severity: "info",
      message: "No organisation record is linked.",
      source: SOURCE,
    };
  }

  const [subRes, svcRes] = await Promise.all([
    admin.from("subscriptions").select("status, next_billing_date").eq("client_id", organisationId).limit(1000),
    admin.from("client_services").select("status").eq("client_id", organisationId).limit(1000),
  ]);

  if (subRes.error) throw subRes.error;
  if (svcRes.error) throw svcRes.error;

  const subs = subRes.data ?? [];
  const services = svcRes.data ?? [];

  if (subs.length === 0 && services.length === 0) {
    return {
      name: CHECK_NAMES.subscription,
      status: "unavailable",
      severity: "info",
      message: "No subscription or service records found.",
      source: SOURCE,
    };
  }

  const normalise = (s: string | null | undefined) =>
    typeof s === "string" ? s.toLowerCase() : "";

  const isActive = (s: { status?: string | null }) => normalise(s.status) === "active";
  const attentionStates = new Set([
    "suspended", "past_due", "pastdue", "paused", "cancelled", "canceled",
    "failed", "expired", "overdue", "unpaid", "trial_expired",
  ]);
  const needsAttention = (s: { status?: string | null }) =>
    attentionStates.has(normalise(s.status));

  const activeSubs = subs.filter(isActive);
  const activeServices = services.filter(isActive);
  const attentionSubs = subs.filter(needsAttention);
  const attentionServices = services.filter(needsAttention);

  const hasActive = activeSubs.length > 0 || activeServices.length > 0;
  const hasAttention = attentionSubs.length > 0 || attentionServices.length > 0;

  // Safe aggregate status counts (subscriptions + services combined).
  const statusCounts: Record<string, number> = {};
  for (const s of [...subs, ...services]) {
    const key = normalise(s.status) || "unknown";
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  const now = Date.now();
  const upcoming = subs
    .map((s) => s.next_billing_date)
    .filter((d): d is string => typeof d === "string" && !!d)
    .filter((d) => new Date(d).getTime() >= now)
    .sort()[0] ?? null;

  let status: CheckStatus;
  let message: string;
  if (hasActive && !hasAttention) {
    status = "pass";
    message = "At least one subscription or service is active.";
  } else if (hasActive && hasAttention) {
    status = "warning";
    message = "Active subscription/service found, but some records require attention.";
  } else {
    status = "warning";
    message = "Subscription or service records exist but none are active.";
  }

  return {
    name: CHECK_NAMES.subscription,
    status,
    severity: status === "pass" ? "info" : "warning",
    message,
    details: {
      subscription_count: subs.length,
      active_subscription_count: activeSubs.length,
      service_count: services.length,
      active_service_count: activeServices.length,
      status_counts: statusCounts,
      next_billing_date: upcoming,
    },
    source: SOURCE,
  };
}

// ---------------------------------------------------------------------------
// EMAIL DELIVERY — aggregate recent delivery events (last 30 days). No raw
// recipient addresses or provider payloads.
// ---------------------------------------------------------------------------
async function checkEmailDelivery(admin: ReturnType<typeof createClient>, organisationId: string | null): Promise<Check> {
  if (!organisationId) {
    return {
      name: CHECK_NAMES.email,
      status: "unavailable",
      severity: "info",
      message: "No organisation record is linked.",
      source: SOURCE,
    };
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("email_delivery_events")
    .select("event_type")
    .eq("organisation_id", organisationId)
    .gte("event_time", cutoff)
    .limit(10000);

  if (error) throw error;

  const events = data ?? [];
  if (events.length === 0) {
    return {
      name: CHECK_NAMES.email,
      status: "unavailable",
      severity: "info",
      message: "No recent email delivery events found.",
      source: SOURCE,
    };
  }

  const counts = { total: events.length, delivered: 0, bounced: 0, failed: 0, complained: 0 };
  for (const e of events) {
    const t = typeof e.event_type === "string" ? e.event_type.toLowerCase() : "";
    if (/deliver/.test(t)) counts.delivered++;
    else if (/bounce/.test(t)) counts.bounced++;
    else if (/fail|error/.test(t)) counts.failed++;
    else if (/complain|spam/.test(t)) counts.complained++;
  }

  const problemCount = counts.bounced + counts.failed + counts.complained;

  let status: CheckStatus;
  let severity: CheckSeverity;
  let message: string;

  if (problemCount === 0 && counts.delivered > 0) {
    status = "pass";
    severity = "info";
    message = "Email delivery looks healthy with no meaningful failures.";
  } else if (problemCount > 0 && counts.delivered > 0) {
    status = "warning";
    severity = "warning";
    message = "Email delivery is working but has failures requiring investigation.";
  } else if (problemCount > 0 && counts.delivered === 0) {
    status = "fail";
    severity = "error";
    message = "Email delivery has serious failure conditions with no successful deliveries.";
  } else {
    status = "unavailable";
    severity = "info";
    message = "Email delivery events are present but could not be classified.";
  }

  return {
    name: CHECK_NAMES.email,
    status,
    severity,
    message,
    details: counts,
    source: SOURCE,
  };
}

// ---------------------------------------------------------------------------
// RECENT ERRORS — only report error telemetry when a reliable organisation-
// linked project/site mapping exists. Never uses unrelated global error logs.
// ---------------------------------------------------------------------------
async function checkRecentErrors(admin: ReturnType<typeof createClient>, organisationId: string | null): Promise<Check> {
  const unavailable = (): Check => ({
    name: CHECK_NAMES.recent_errors,
    status: "unavailable",
    severity: "info",
    message: "No organisation-linked error telemetry is available.",
    source: SOURCE,
  });

  if (!organisationId) return unavailable();

  const [projRes, siteRes] = await Promise.all([
    admin
      .from("projects")
      .select("id")
      .or(`client_id.eq.${organisationId},organisation_id.eq.${organisationId}`)
      .limit(100),
    admin.from("client_websites").select("id").eq("client_id", organisationId).limit(100),
  ]);

  if (projRes.error) throw projRes.error;
  if (siteRes.error) throw siteRes.error;

  const projectIds = (projRes.data ?? []).map((p) => p.id as string);
  const siteIds = (siteRes.data ?? []).map((s) => s.id as string);

  // A site-only mapping has no project-scoped error log; treat as unavailable.
  if (projectIds.length === 0 && siteIds.length === 0) return unavailable();
  if (projectIds.length === 0) return unavailable();

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("dev_logs")
    .select("action")
    .in("project_id", projectIds)
    .gte("created_at", cutoff)
    .limit(5000);

  if (error) throw error;

  const logs = data ?? [];
  const errorEvents = logs.filter((l) =>
    /error|fail|exception|crash/i.test(typeof l.action === "string" ? l.action : ""),
  ).length;

  return {
    name: CHECK_NAMES.recent_errors,
    status: errorEvents > 0 ? "warning" : "pass",
    severity: errorEvents > 0 ? "warning" : "info",
    message: errorEvents > 0
      ? `${errorEvents} recent error event(s) found.`
      : "No recent error events found.",
    details: { total_events: logs.length, error_events: errorEvents },
    source: SOURCE,
  };
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
  if (!secret) {
    return json({ ok: false, error: "Connector not configured" }, 503);
  }

  const timestamp = req.headers.get("x-dfp-timestamp") ?? "";
  const signature = req.headers.get("x-dfp-signature") ?? "";
  const rawBody = await req.text();

  if (!timestamp || !signature) {
    return json({ ok: false, error: "Missing signature" }, 401);
  }

  const tsMs = Number(timestamp);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > TIMESTAMP_WINDOW_MS) {
    return json({ ok: false, error: "Timestamp out of range" }, 401);
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return json({ ok: false, error: "Invalid signature" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "Malformed JSON" }, 400);
  }

  const diagnosticRunId = typeof body.diagnostic_run_id === "string" ? body.diagnostic_run_id : "";
  if (!UUID_RE.test(diagnosticRunId)) {
    return json({ ok: false, error: "diagnostic_run_id is required" }, 400);
  }

  let customerId = asUuid(body.customer_id);
  let organisationId = asUuid(body.organisation_id);

  if (customerId && !UUID_RE.test(customerId)) {
    return json({ ok: false, error: "customer_id is invalid" }, 400);
  }
  if (organisationId && !UUID_RE.test(organisationId)) {
    return json({ ok: false, error: "organisation_id is invalid" }, 400);
  }
  if (!customerId && !organisationId) {
    return json({ ok: false, error: "At least one of customer_id or organisation_id is required" }, 400);
  }

  const subjectType = customerId ? "user" : "organisation";
  const scope = cleanScope(body.scope);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const runners: Record<string, () => Promise<Check>> = {
    account: () => checkAccount(admin, organisationId),
    authentication: () => checkAuthentication(admin, customerId),
    subscription: () => checkSubscription(admin, organisationId),
    email: () => checkEmailDelivery(admin, organisationId),
    recent_errors: () => checkRecentErrors(admin, organisationId),
  };

  const checks: Check[] = [];

  for (const key of scope) {
    const runner = runners[key];
    if (!runner) continue;
    try {
      checks.push(await runner());
    } catch (err) {
      // A database/query failure is a real fault → surface as an error check
      // without crashing the connector or leaking internals.
      console.error("digital-footprint diagnostic check failed", {
        check: key,
        errorName: err instanceof Error ? err.name : typeof err,
      });
      checks.push({
        name: CHECK_NAMES[key] ?? key,
        status: "error",
        severity: "error",
        message: "Diagnostic check could not be completed.",
        source: SOURCE,
      });
    }
  }

  return json(
    { ok: true, diagnostic_run_id: diagnosticRunId, subject_type: subjectType, checks },
    200,
  );
});
