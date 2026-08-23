import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// DFP COMMAND CENTRE — SECURE MONITORING RUN CHECK
// ============================================================================
// Hardened rewrite of the monitoring trigger. Security guarantees:
//   1. Authentication  — requires a valid JWT (Bearer token). 401 otherwise.
//   2. Authorization   — owner/admin only (viewer / no-role => 403).
//   3. No arbitrary URL — the browser sends ONLY { monitor_id, check_type }.
//      The target URL, project_id, and all settings are loaded server-side
//      from the authorised monitor record. target_url/project_id from the
//      browser are IGNORED.
//   4. SSRF protection — https:// only; private/reserved/link-local/metadata
//      ranges blocked; DNS resolution validated; redirects validated.
//   5. Rate limiting   — one manual check per monitor per 30s (429).
//   6. No secrets / stack traces are ever returned to the caller.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_CHECK_TYPES = ["website", "supabase", "edge_function", "agent", "webhook"] as const;
type CheckType = (typeof ALLOWED_CHECK_TYPES)[number];

const COOLDOWN_MS = 30_000; // one manual check per monitor per 30 seconds
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

const FAILING_STATUSES = new Set(["failed", "offline", "error"]);
const DISABLED_STATUSES = new Set(["paused", "disabled"]);

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

// ---------------------------------------------------------------------------
// SSRF — URL / IP validation
// ---------------------------------------------------------------------------
function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIPv6Literal(host: string): boolean {
  return host.includes(":") && /^[0-9a-fA-F:]+$/.test(host);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed => unsafe
  const [a, b] = parts;
  if (a === 0 || a === 127 || a === 10) return true; // 0.0.0.0/8, loopback, 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 169 && b === 254) return true; // link-local 169.254/16 (incl. cloud metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18/15
  if (a >= 224) return true; // multicast 224/4 + reserved 240/4
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/%.*$/, ""); // strip zone id
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique-local
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  return false;
}

function validateUrl(raw: string): { ok: boolean; reason?: string; url?: URL } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }
  if (u.protocol !== "https:") {
    return { ok: false, reason: "NON_HTTPS_PROTOCOL" };
  }
  const host = u.hostname;
  if (isIPv4Literal(host)) {
    return isPrivateIPv4(host) ? { ok: false, reason: "PRIVATE_IP" } : { ok: true, url: u };
  }
  if (isIPv6Literal(host)) {
    return isPrivateIPv6(host) ? { ok: false, reason: "PRIVATE_IP" } : { ok: true, url: u };
  }
  return { ok: true, url: u };
}

async function isHostnameSafe(hostname: string): Promise<boolean> {
  const ips: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      const records = await Deno.resolveDns(hostname, type);
      ips.push(...records);
    } catch {
      // resolution failure will surface as a fetch error; do not trust unresolved host
    }
  }
  if (ips.length === 0) return false;
  return ips.every((ip) => (ip.includes(":") ? !isPrivateIPv6(ip) : !isPrivateIPv4(ip)));
}

// ---------------------------------------------------------------------------
// SSRF-safe fetch: validates every hop, caps redirects, enforces a timeout,
// and never downloads the response body.
// ---------------------------------------------------------------------------
interface SafeFetchResult {
  ok: boolean;
  status_code: number | null;
  response_time_ms: number;
  final_url: string;
  error_code: string | null;
}

async function safeFetch(rawUrl: string, method: "GET" | "HEAD"): Promise<SafeFetchResult> {
  const start = Date.now();
  let currentUrl = rawUrl;
  let lastStatus: number | null = null;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = validateUrl(currentUrl);
    if (!parsed.ok) {
      return {
        ok: false,
        status_code: null,
        response_time_ms: Date.now() - start,
        final_url: currentUrl,
        error_code: parsed.reason,
      };
    }

    const hostname = parsed.url!.hostname;
    if (!isIPv4Literal(hostname) && !isIPv6Literal(hostname)) {
      const safe = await isHostnameSafe(hostname);
      if (!safe) {
        return {
          ok: false,
          status_code: null,
          response_time_ms: Date.now() - start,
          final_url: currentUrl,
          error_code: "UNSAFE_HOST",
        };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(currentUrl, { method, redirect: "manual", signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      const code = (e as { name?: string })?.name === "AbortError" ? "TIMEOUT" : "REQUEST_FAILED";
      return {
        ok: false,
        status_code: null,
        response_time_ms: Date.now() - start,
        final_url: currentUrl,
        error_code: code,
      };
    }
    clearTimeout(timer);

    lastStatus = resp.status;
    // Discard body immediately — we only collect status / time / final URL.
    try {
      await resp.body?.cancel();
    } catch {
      /* noop */
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) {
        return {
          ok: false,
          status_code: resp.status,
          response_time_ms: Date.now() - start,
          final_url: currentUrl,
          error_code: "MISSING_REDIRECT_LOCATION",
        };
      }
      currentUrl = new URL(location, currentUrl).toString();
      if (i === MAX_REDIRECTS) {
        return {
          ok: false,
          status_code: resp.status,
          response_time_ms: Date.now() - start,
          final_url: currentUrl,
          error_code: "TOO_MANY_REDIRECTS",
        };
      }
      continue;
    }

    return {
      ok: resp.ok,
      status_code: resp.status,
      response_time_ms: Date.now() - start,
      final_url: currentUrl,
      error_code: null,
    };
  }

  return {
    ok: false,
    status_code: lastStatus,
    response_time_ms: Date.now() - start,
    final_url: currentUrl,
    error_code: "TOO_MANY_REDIRECTS",
  };
}

// ---------------------------------------------------------------------------
// Incident reconciliation (safe, non-destructive)
//   healthy -> failed : open an incident
//   failed  -> failed : bump last_seen_at on the open incident
//   failed  -> healthy: resolve the open incident
// ---------------------------------------------------------------------------
async function reconcileIncident(
  admin: ReturnType<typeof createClient>,
  args: {
    projectId: number | null;
    monitorType: CheckType;
    monitorId: number;
    title: string;
    previousStatus: string | null;
    newStatus: string;
    message: string | null;
  },
): Promise<void> {
  const { projectId, monitorType, monitorId, title, previousStatus, newStatus, message } = args;
  const wasFailing = FAILING_STATUSES.has(previousStatus ?? "");
  const nowFailing = FAILING_STATUSES.has(newStatus);
  const now = new Date().toISOString();

  try {
    if (!wasFailing && nowFailing) {
      await admin.from("internal_monitoring_incidents").insert({
        project_id: projectId,
        incident_title: title,
        incident_type: monitorType,
        severity: "medium",
        status: "open",
        source_monitor_type: monitorType,
        source_monitor_id: monitorId,
        first_seen_at: now,
        last_seen_at: now,
        summary: message,
      });
    } else if (wasFailing && nowFailing) {
      await admin
        .from("internal_monitoring_incidents")
        .update({ last_seen_at: now })
        .eq("source_monitor_type", monitorType)
        .eq("source_monitor_id", monitorId)
        .eq("status", "open");
    } else if (wasFailing && !nowFailing) {
      await admin
        .from("internal_monitoring_incidents")
        .update({ status: "resolved", resolved_at: now, last_seen_at: now })
        .eq("source_monitor_type", monitorType)
        .eq("source_monitor_id", monitorId)
        .eq("status", "open");
    }
  } catch {
    // Incident bookkeeping must never fail the check itself.
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ code: "InternalError", message: "Missing service configuration" }, 500);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Authenticate — resolve the caller from the JWT, never from the body.
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ code: "Unauthorized", message: "Missing authentication token" }, 401);

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return json({ code: "Unauthorized", message: "Invalid or expired token" }, 401);
    }

    // 2. Authorize — owner or admin only. Viewer / no-role => 403.
    const { data: roleRow } = await admin
      .from("internal_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleRow || (roleRow.role !== "owner" && roleRow.role !== "admin")) {
      return json({ code: "Forbidden", message: "Insufficient permission to run monitoring checks" }, 403);
    }

    // 3. Parse input — only monitor_id and check_type are accepted.
    let body: { monitor_id?: unknown; check_type?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ code: "BadRequest", message: "Invalid JSON body" }, 400);
    }

    const monitorId = Number(body.monitor_id);
    if (!Number.isInteger(monitorId) || monitorId <= 0) {
      return json({ code: "BadRequest", message: "monitor_id must be a positive integer" }, 400);
    }

    const checkType = String(body.check_type ?? "").trim() as CheckType;
    if (!ALLOWED_CHECK_TYPES.includes(checkType)) {
      return json({ code: "BadRequest", message: "Unknown check type" }, 400);
    }

    const checkedAt = new Date().toISOString();

    // -------------------------------------------------------------------------
    // SUPABASE — checks the Command Centre's own Supabase (env-configured URLs,
    // no arbitrary target). No SSRF surface; no incident reconciliation.
    // -------------------------------------------------------------------------
    if (checkType === "supabase") {
      const { data: monitor, error: monErr } = await admin
        .from("internal_supabase_monitors")
        .select("*")
        .eq("id", monitorId)
        .maybeSingle();

      if (monErr) return json({ code: "InternalError", message: "Failed to load monitor" }, 500);
      if (!monitor) return json({ code: "NotFound", message: "Monitor not found" }, 404);

      const start = Date.now();
      let dbStatus = "healthy";
      let authStatus = "healthy";
      let storageStatus = "healthy";
      let realtimeStatus = "healthy";
      const edgeStatus = "unknown"; // self-checking this function would recurse; not performed.

      try {
        const { error } = await admin.from("internal_monitored_websites").select("id").limit(1);
        if (error) dbStatus = "failed";
      } catch {
        dbStatus = "failed";
      }
      try {
        const r = await fetch(`${supabaseUrl}/auth/v1/health`);
        if (!r.ok) authStatus = "warning";
      } catch {
        authStatus = "failed";
      }
      try {
        const r = await fetch(`${supabaseUrl}/storage/v1/bucket`);
        if (!r.ok) storageStatus = "warning";
      } catch {
        storageStatus = "failed";
      }
      try {
        const r = await fetch(`${supabaseUrl}/realtime/v1/health`);
        if (!r.ok) realtimeStatus = "warning";
      } catch {
        realtimeStatus = "failed";
      }

      const responseTimeMs = Date.now() - start;
      const anyFailed = [dbStatus, authStatus, storageStatus, realtimeStatus].some((s) => s === "failed");
      const allHealthy = [dbStatus, authStatus, storageStatus, realtimeStatus].every((s) => s === "healthy");
      const overall = anyFailed ? "offline" : allHealthy ? "online" : "warning";

      await admin
        .from("internal_supabase_monitors")
        .update({
          database_status: dbStatus,
          auth_status: authStatus,
          storage_status: storageStatus,
          edge_functions_status: edgeStatus,
          realtime_status: realtimeStatus,
          last_checked_at: checkedAt,
        })
        .eq("id", monitorId);

      await admin.from("internal_monitoring_logs").insert({
        project_id: monitor.project_id ?? null,
        monitor_type: checkType,
        monitor_id: monitorId,
        status: overall,
        status_code: null,
        response_time_ms: responseTimeMs,
        message: `DB:${dbStatus} Auth:${authStatus} Storage:${storageStatus} Realtime:${realtimeStatus}`,
        error_message: null,
        checked_at: checkedAt,
        metadata_json: { database_status: dbStatus, auth_status: authStatus, storage_status: storageStatus, realtime_status: realtimeStatus },
      });

      return json(
        {
          code: "OK",
          data: {
            success: !anyFailed,
            monitor_id: monitorId,
            check_type: checkType,
            status: overall,
            status_code: null,
            response_time_ms: responseTimeMs,
            checked_at: checkedAt,
            message: `DB:${dbStatus} Auth:${authStatus} Storage:${storageStatus} Realtime:${realtimeStatus}`,
          },
        },
        200,
      );
    }

    // -------------------------------------------------------------------------
    // URL-BASED TYPES (website / edge_function / agent / webhook)
    // -------------------------------------------------------------------------
    const tableMap: Record<string, string> = {
      website: "internal_monitored_websites",
      edge_function: "internal_edge_function_monitors",
      agent: "internal_agent_monitors",
      webhook: "internal_webhook_monitors",
    };
    const table = tableMap[checkType];

    const { data: monitor, error: monErr } = await admin
      .from(table)
      .select("*")
      .eq("id", monitorId)
      .maybeSingle();

    if (monErr) return json({ code: "InternalError", message: "Failed to load monitor" }, 500);
    if (!monitor) return json({ code: "NotFound", message: "Monitor not found" }, 404);

    // Disabled / paused monitor — do not run.
    if (DISABLED_STATUSES.has(String(monitor.status ?? ""))) {
      await admin.from("internal_monitoring_logs").insert({
        project_id: monitor.project_id ?? null,
        monitor_type: checkType,
        monitor_id: monitorId,
        status: "disabled",
        status_code: null,
        response_time_ms: null,
        message: "Monitor is disabled/paused",
        error_message: null,
        checked_at: checkedAt,
        metadata_json: null,
      });
      return json(
        {
          code: "OK",
          data: { success: false, monitor_id: monitorId, check_type: checkType, status: "disabled", status_code: null, response_time_ms: null, checked_at: checkedAt, message: "Monitor is disabled/paused" },
        },
        200,
      );
    }

    // Resolve the target URL server-side from the monitor record.
    let targetUrl: string | null = null;
    let title = "";
    let method: "GET" | "HEAD" = "GET";
    if (checkType === "website") {
      targetUrl = monitor.url ?? null;
      title = monitor.website_name ?? "Website";
    } else if (checkType === "edge_function") {
      targetUrl = monitor.function_url ?? null;
      title = monitor.function_name ?? "Edge function";
    } else if (checkType === "agent") {
      targetUrl = monitor.webhook_url ?? monitor.workflow_url ?? null;
      title = monitor.agent_name ?? "Agent";
    } else {
      targetUrl = monitor.webhook_url ?? null;
      title = monitor.webhook_name ?? "Webhook";
      method = "HEAD";
    }

    if (!targetUrl) {
      await admin.from("internal_monitoring_logs").insert({
        project_id: monitor.project_id ?? null,
        monitor_type: checkType,
        monitor_id: monitorId,
        status: "unknown",
        status_code: null,
        response_time_ms: null,
        message: "No target URL configured",
        error_message: null,
        checked_at: checkedAt,
        metadata_json: null,
      });
      return json(
        {
          code: "OK",
          data: { success: false, monitor_id: monitorId, check_type: checkType, status: "unknown", status_code: null, response_time_ms: null, checked_at: checkedAt, message: "No target URL configured" },
        },
        200,
      );
    }

    // Rate limit — no more than one manual check per monitor per 30s.
    if (monitor.last_checked_at) {
      const lastMs = new Date(monitor.last_checked_at).getTime();
      if (!Number.isNaN(lastMs) && Date.now() - lastMs < COOLDOWN_MS) {
        return json({ code: "RateLimited", message: "This monitor was checked too recently. Please wait before retrying." }, 429);
      }
    }

    // Run the SSRF-safe check.
    const previousStatus = String(monitor.status ?? "");
    const fetchResult = await safeFetch(targetUrl, method);
    const succeeded = fetchResult.ok && fetchResult.status_code !== null && fetchResult.status_code < 400;

    let newStatus: string;
    let responseStatus: string;
    if (!fetchResult.ok && fetchResult.status_code === null) {
      // Request never completed (timeout / SSRF block / DNS failure).
      newStatus = "offline";
      responseStatus = "offline";
    } else if (succeeded) {
      newStatus = "online";
      responseStatus = "online";
    } else if (fetchResult.status_code && fetchResult.status_code >= 400 && fetchResult.status_code < 500) {
      newStatus = "error";
      responseStatus = "error";
    } else {
      newStatus = "offline";
      responseStatus = "offline";
    }

    const message = succeeded
      ? `${title} responded ${fetchResult.status_code} in ${fetchResult.response_time_ms}ms`
      : `${title} check failed (${fetchResult.error_code ?? `HTTP ${fetchResult.status_code}`})`;

    // Update the monitor record with only the fields that exist on its table.
    if (checkType === "website") {
      await admin
        .from(table)
        .update({
          last_status_code: fetchResult.status_code ?? 0,
          last_response_time_ms: fetchResult.response_time_ms,
          last_checked_at: checkedAt,
          status: newStatus,
          ssl_status: targetUrl.startsWith("https://") ? "valid" : "unknown",
        })
        .eq("id", monitorId);
    } else if (checkType === "edge_function") {
      await admin
        .from(table)
        .update({
          last_status_code: fetchResult.status_code ?? 0,
          last_response_time_ms: fetchResult.response_time_ms,
          last_checked_at: checkedAt,
          status: newStatus,
          last_success_at: succeeded ? checkedAt : undefined,
          last_failure_at: succeeded ? undefined : checkedAt,
          last_error_message: succeeded ? null : fetchResult.error_code ?? `HTTP ${fetchResult.status_code}`,
        })
        .eq("id", monitorId);
    } else if (checkType === "agent") {
      await admin
        .from(table)
        .update({
          last_checked_at: checkedAt,
          status: newStatus,
          last_success_at: succeeded ? checkedAt : undefined,
          last_failure_at: succeeded ? undefined : checkedAt,
          last_error_message: succeeded ? null : fetchResult.error_code ?? `HTTP ${fetchResult.status_code}`,
        })
        .eq("id", monitorId);
    } else {
      // webhook
      await admin
        .from(table)
        .update({
          last_checked_at: checkedAt,
          status: newStatus,
          last_success_at: succeeded ? checkedAt : undefined,
          last_failure_at: succeeded ? undefined : checkedAt,
          last_error_message: succeeded ? null : fetchResult.error_code ?? `HTTP ${fetchResult.status_code}`,
        })
        .eq("id", monitorId);
    }

    // Log entry.
    await admin.from("internal_monitoring_logs").insert({
      project_id: monitor.project_id ?? null,
      monitor_type: checkType,
      monitor_id: monitorId,
      status: responseStatus,
      status_code: fetchResult.status_code ?? null,
      response_time_ms: fetchResult.response_time_ms,
      message,
      error_message: succeeded ? null : fetchResult.error_code ?? `HTTP ${fetchResult.status_code}`,
      checked_at: checkedAt,
      metadata_json: { final_url: fetchResult.final_url },
    });

    // Incident reconciliation.
    await reconcileIncident(admin, {
      projectId: monitor.project_id ?? null,
      monitorType: checkType,
      monitorId,
      title,
      previousStatus,
      newStatus: responseStatus,
      message,
    });

    return json(
      {
        code: "OK",
        data: {
          success: succeeded,
          monitor_id: monitorId,
          check_type: checkType,
          status: responseStatus,
          status_code: fetchResult.status_code,
          response_time_ms: fetchResult.response_time_ms,
          checked_at: checkedAt,
          message,
          ...(succeeded ? {} : { error_code: fetchResult.error_code ?? `HTTP ${fetchResult.status_code}` }),
        },
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ code: "InternalError", message }, 500);
  }
});
