import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// internal-monitoring-scheduled — scheduled website monitoring runner.
//
// Invoked ONLY by pg_cron (via net.http_post) and guarded by the shared
// X-DFP-Scheduler-Token (vault secret `dfp_scheduler_secret`). Fails closed
// when the token is missing/mismatched. Public (verify_jwt=false) but token
// gated, mirroring runtime-health-scheduled.
//
// Runs the SAME SSRF-safe website-check rules as the manual
// internal-monitoring-run-check function: HTTPS-only, private/reserved IP
// blocking, DNS validation, redirect validation, 15s timeout, response-body
// cancellation. Read-only: persists monitor results + append-only logs and
// reconciles incidents. Never accepts a target URL from the request body.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-dfp-scheduler-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const CONCURRENCY = 3;

const FAILING_STATUSES = new Set(["failed", "offline", "error"]);
const DISABLED_STATUSES = new Set(["paused", "disabled"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

// --- SSRF guards (identical to internal-monitoring-run-check) ----------------
function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}
function isIPv6Literal(host: string): boolean {
  return host.includes(":") && /^[0-9a-fA-F:]+$/.test(host);
}
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/%.*$/, "");
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  return false;
}
function validateUrl(raw: string): { ok: boolean; reason?: string; url?: URL } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "NON_HTTPS_PROTOCOL" };
  const host = u.hostname;
  if (isIPv4Literal(host)) return isPrivateIPv4(host) ? { ok: false, reason: "PRIVATE_IP" } : { ok: true, url: u };
  if (isIPv6Literal(host)) return isPrivateIPv6(host) ? { ok: false, reason: "PRIVATE_IP" } : { ok: true, url: u };
  return { ok: true, url: u };
}
async function isHostnameSafe(hostname: string): Promise<boolean> {
  const ips: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      ips.push(...(await Deno.resolveDns(hostname, type)));
    } catch {
      // resolution failure surfaces as a fetch error; do not trust unresolved host
    }
  }
  if (ips.length === 0) return false;
  return ips.every((ip) => (ip.includes(":") ? !isPrivateIPv6(ip) : !isPrivateIPv4(ip)));
}

interface SafeFetchResult {
  ok: boolean;
  status_code: number | null;
  response_time_ms: number;
  final_url: string;
  error_code: string | null;
}

async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
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
      if (!(await isHostnameSafe(hostname))) {
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
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(currentUrl, { method: "GET", redirect: "manual", signal: controller.signal });
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

// --- Incident reconciliation (identical to internal-monitoring-run-check) ----
async function reconcileIncident(
  admin: ReturnType<typeof createClient>,
  args: {
    projectId: number | null;
    monitorId: number;
    title: string;
    previousStatus: string | null;
    newStatus: string;
    message: string | null;
  },
): Promise<void> {
  const { projectId, monitorId, title, previousStatus, newStatus, message } = args;
  const wasFailing = FAILING_STATUSES.has(previousStatus ?? "");
  const nowFailing = FAILING_STATUSES.has(newStatus);
  const now = new Date().toISOString();

  try {
    if (!wasFailing && nowFailing) {
      await admin.from("internal_monitoring_incidents").insert({
        project_id: projectId,
        incident_title: title,
        incident_type: "website",
        severity: "medium",
        status: "open",
        source_monitor_type: "website",
        source_monitor_id: monitorId,
        first_seen_at: now,
        last_seen_at: now,
        summary: message,
      });
    } else if (wasFailing && nowFailing) {
      await admin
        .from("internal_monitoring_incidents")
        .update({ last_seen_at: now })
        .eq("source_monitor_type", "website")
        .eq("source_monitor_id", monitorId)
        .eq("status", "open");
    } else if (wasFailing && !nowFailing) {
      await admin
        .from("internal_monitoring_incidents")
        .update({ status: "resolved", resolved_at: now, last_seen_at: now })
        .eq("source_monitor_type", "website")
        .eq("source_monitor_id", monitorId)
        .eq("status", "open");
    }
  } catch {
    // Incident bookkeeping must never fail the check itself.
  }
}

// --- Concurrency helper (max 3, one failing site never stops the others) -----
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Token guard — fail closed. Shared with dfp-health-probe + runtime-health.
  const expected = (Deno.env.get("DFP_SCHEDULER_SECRET") ?? Deno.env.get("dfp_scheduler_secret") ?? "").trim();
  const supplied = (req.headers.get("x-dfp-scheduler-token") ?? "").trim();
  if (!expected || !supplied || supplied !== expected) {
    return json({ error: "Unauthorized scheduler token." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing service configuration" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load enabled website monitors server-side. Target URLs are NEVER taken from
  // the request body — only the monitor records already in the database.
  // Group Operations scope: only site-keyed monitors (site_key non-null and
  // non-empty). Legacy rows with site_key NULL are excluded defensively here.
  const { data: monitors, error: monErr } = await admin
    .from("internal_monitored_websites")
    .select("*")
    .not("url", "is", null)
    .not("site_key", "is", null);

  if (monErr) return json({ error: "Failed to load website monitors" }, 500);

  const enabled = (monitors ?? []).filter((monitor) => {
    const siteKey =
      typeof monitor.site_key === "string"
        ? monitor.site_key.trim()
        : "";

    return (
      siteKey.length > 0 &&
      !DISABLED_STATUSES.has(String(monitor.status ?? ""))
    );
  });
  if (enabled.length === 0) {
    return json({ checked: 0, summary: "No enabled website monitors." });
  }

  const results = await mapWithConcurrency(enabled, CONCURRENCY, async (monitor) => {
    const targetUrl = monitor.url as string;
    const title = monitor.website_name ?? "Website";
    const checkedAt = new Date().toISOString();
    const previousStatus = String(monitor.status ?? "");

    let safeResult: SafeFetchResult;
    try {
      safeResult = await safeFetch(targetUrl);
    } catch {
      safeResult = {
        ok: false,
        status_code: null,
        response_time_ms: 0,
        final_url: targetUrl,
        error_code: "REQUEST_FAILED",
      };
    }

    const succeeded = safeResult.ok && safeResult.status_code !== null && safeResult.status_code < 400;

    let newStatus: string;
    let responseStatus: string;
    if (!safeResult.ok && safeResult.status_code === null) {
      newStatus = "offline";
      responseStatus = "offline";
    } else if (succeeded) {
      newStatus = "online";
      responseStatus = "online";
    } else if (safeResult.status_code && safeResult.status_code >= 400 && safeResult.status_code < 500) {
      newStatus = "error";
      responseStatus = "error";
    } else {
      newStatus = "offline";
      responseStatus = "offline";
    }

    const message = succeeded
      ? `${title} responded ${safeResult.status_code} in ${safeResult.response_time_ms}ms`
      : `${title} check failed (${safeResult.error_code ?? `HTTP ${safeResult.status_code}`})`;

    // Update the monitor record (same fields as the manual website check).
    await admin
      .from("internal_monitored_websites")
      .update({
        last_status_code: safeResult.status_code ?? 0,
        last_response_time_ms: safeResult.response_time_ms,
        last_checked_at: checkedAt,
        status: newStatus,
        ssl_status: targetUrl.startsWith("https://") ? "valid" : "unknown",
      })
      .eq("id", monitor.id);

    // Append-only log.
    await admin.from("internal_monitoring_logs").insert({
      project_id: monitor.project_id ?? null,
      monitor_type: "website",
      monitor_id: monitor.id,
      status: responseStatus,
      status_code: safeResult.status_code ?? null,
      response_time_ms: safeResult.response_time_ms,
      message,
      error_message: succeeded ? null : safeResult.error_code ?? `HTTP ${safeResult.status_code}`,
      checked_at: checkedAt,
      metadata_json: { final_url: safeResult.final_url, trigger: "scheduled" },
    });

    // Incident reconciliation.
    await reconcileIncident(admin, {
      projectId: monitor.project_id ?? null,
      monitorId: monitor.id,
      title,
      previousStatus,
      newStatus: responseStatus,
      message,
    });

    return {
      monitor_id: monitor.id,
      status: responseStatus,
      status_code: safeResult.status_code,
      response_time_ms: safeResult.response_time_ms,
    };
  });

  const counts: Record<string, number> = { online: 0, offline: 0, error: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const summary = `Scheduled website monitoring: ${counts.online} online, ${counts.offline} offline, ${counts.error} error.`;

  return json({ checked: results.length, counts, summary });
});
