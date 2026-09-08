import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBSITE_URL = Deno.env.get("HEALTH_PROBE_WEBSITE_URL") || "https://digital-footprint.uk";
const ENVIRONMENT = Deno.env.get("HEALTH_PROBE_ENVIRONMENT") || "production";
const TIMEOUT_MS = Number(Deno.env.get("HEALTH_PROBE_TIMEOUT_MS") || "10000");
const SLOW_MS = Number(Deno.env.get("HEALTH_PROBE_SLOW_MS") || "1500");
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

type Status = "healthy" | "degraded" | "down" | "unknown" | "not_configured";

interface CheckResult {
  service: string;
  display_name: string;
  category: string;
  status: Status;
  status_code: number | null;
  response_time_ms: number | null;
  message: string;
  error_code: string | null;
}

type Admin = ReturnType<typeof createClient>;

function cors(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "content-type": "application/json",
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-dfp-scheduler-token",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: cors(req) });
}

function envOr(name: string): string | null {
  const v = Deno.env.get(name);
  return v && v.trim().length > 0 ? v.trim() : null;
}

function notConfigured(service: string, display_name: string, category: string, message: string): CheckResult {
  return { service, display_name, category, status: "not_configured", status_code: null, response_time_ms: null, message, error_code: "not_configured" };
}

function unknownResult(service: string, display_name: string, category: string, message: string): CheckResult {
  return { service, display_name, category, status: "unknown", status_code: null, response_time_ms: null, message, error_code: null };
}

async function isInternalUser(admin: Admin, token: string): Promise<boolean> {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const [a, s] = await Promise.all([
    admin.from("admin_profiles").select("id").eq("id", data.user.id).maybeSingle(),
    admin.from("staff_profiles").select("id").eq("id", data.user.id).eq("active", true).maybeSingle(),
  ]);
  return Boolean(a.data || s.data);
}

async function checkWebsite(): Promise<CheckResult> {
  const started = performance.now();
  const base = { service: "website", display_name: "Public Website", category: "availability", error_code: null };
  try {
    const res = await fetch(WEBSITE_URL, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "DFP-Health-Probe/1.0" } });
    const ms = Math.round(performance.now() - started);
    const ok = res.status >= 200 && res.status < 400;
    if (ok && ms <= SLOW_MS) return { ...base, status: "healthy", status_code: res.status, response_time_ms: ms, message: `HTTP ${res.status} · ${ms}ms` };
    if (ok) return { ...base, status: "degraded", status_code: res.status, response_time_ms: ms, message: `HTTP ${res.status} · ${ms}ms (slow)` };
    return { ...base, status: "down", status_code: res.status, response_time_ms: ms, message: `HTTP ${res.status}` };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const text = String((err as Error)?.message ?? err).toLowerCase();
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: text.includes("timeout") ? `Timed out after ${TIMEOUT_MS}ms` : "Connection failed", error_code: "connection_failed" };
  }
}

async function checkDatabase(admin: Admin): Promise<CheckResult> {
  const started = performance.now();
  const base = { service: "supabase_database", display_name: "Supabase Database", category: "supabase", error_code: null };
  try {
    const { error } = await admin.from("digital_footprint_projects").select("id", { count: "exact", head: true }).limit(1);
    const ms = Math.round(performance.now() - started);
    if (!error) return { ...base, status: "healthy", status_code: null, response_time_ms: ms, message: `Query OK · ${ms}ms` };
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: error.message, error_code: error.code };
  } catch {
    return { ...base, status: "down", status_code: null, response_time_ms: Math.round(performance.now() - started), message: "Database unreachable", error_code: "database_unreachable" };
  }
}

async function checkAuth(admin: Admin): Promise<CheckResult> {
  const started = performance.now();
  const base = { service: "supabase_auth", display_name: "Supabase Auth", category: "supabase", error_code: null };
  try {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const ms = Math.round(performance.now() - started);
    if (!error) return { ...base, status: "healthy", status_code: null, response_time_ms: ms, message: `Auth API OK · ${ms}ms` };
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: error.message, error_code: "auth_unavailable" };
  } catch {
    return { ...base, status: "down", status_code: null, response_time_ms: Math.round(performance.now() - started), message: "Auth unreachable", error_code: "auth_unreachable" };
  }
}

async function checkStorage(admin: Admin): Promise<CheckResult> {
  const started = performance.now();
  const base = { service: "supabase_storage", display_name: "Supabase Storage", category: "supabase", error_code: null };
  try {
    const { data, error } = await admin.storage.listBuckets();
    const ms = Math.round(performance.now() - started);
    if (!error) return { ...base, status: "healthy", status_code: null, response_time_ms: ms, message: `Storage OK · ${data?.length ?? 0} buckets` };
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: error.message, error_code: "storage_unavailable" };
  } catch {
    return { ...base, status: "down", status_code: null, response_time_ms: Math.round(performance.now() - started), message: "Storage unreachable", error_code: "storage_unreachable" };
  }
}

async function checkStripe(admin: Admin): Promise<CheckResult> {
  const base = { service: "stripe", display_name: "Stripe Payments", category: "payments", error_code: null };
  const key = envOr("STRIPE_SECRET_KEY");
  if (!key) return notConfigured("stripe", "Stripe Payments", "payments", "STRIPE_SECRET_KEY not configured");
  const started = performance.now();
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) return { ...base, status: "down", status_code: res.status, response_time_ms: ms, message: `Stripe API ${res.status}`, error_code: "stripe_api_error" };
    const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
    const { count } = await admin.from("stripe_webhook_events").select("id", { count: "exact", head: true }).gte("received_at", since).or("status.eq.failed,error_message.not.is.null");
    if ((count ?? 0) >= 3) return { ...base, status: "degraded", status_code: null, response_time_ms: ms, message: `API OK · ${count} webhook failures (24h)`, error_code: "webhook_failures" };
    return { ...base, status: "healthy", status_code: null, response_time_ms: ms, message: `API OK · ${ms}ms` };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const text = String((err as Error)?.message ?? err).toLowerCase();
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: text.includes("timeout") ? "Timed out" : "Connection failed", error_code: "stripe_unreachable" };
  }
}

async function checkEmail(admin: Admin): Promise<CheckResult> {
  const base = { service: "email_resend", display_name: "Email (Resend)", category: "communications", error_code: null };
  const key = envOr("RESEND_API_KEY");
  if (!key) return notConfigured("email_resend", "Email (Resend)", "communications", "RESEND_API_KEY not configured");
  const senderDomain = envOr("RESEND_FROM_DOMAIN") || "digital-footprint.uk";
  const started = performance.now();
  try {
    const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) return { ...base, status: "down", status_code: res.status, response_time_ms: ms, message: `Resend API ${res.status}`, error_code: "resend_api_error" };

    const payload = await res.json().catch(() => null) as { data?: Array<{ name?: string; status?: string }> } | null;
    const domain = payload?.data?.find((d) => (d.name ?? "").toLowerCase() === senderDomain.toLowerCase());
    if (!domain) {
      return { ...base, status: "degraded", status_code: null, response_time_ms: ms, message: `Sender domain ${senderDomain} is missing in Resend`, error_code: "sender_domain_missing" };
    }
    if ((domain.status ?? "").toLowerCase() !== "verified") {
      return { ...base, status: "degraded", status_code: null, response_time_ms: ms, message: `Sender domain ${senderDomain} is ${domain.status || "not verified"}`, error_code: "sender_domain_unverified" };
    }

    const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
    const { count } = await admin.from("lead_notification_events").select("id", { count: "exact", head: true }).gte("requested_at", since).eq("state", "failed");
    if ((count ?? 0) >= 3) return { ...base, status: "degraded", status_code: null, response_time_ms: ms, message: `Domain verified · ${count} email failures (24h)`, error_code: "email_failures" };
    return { ...base, status: "healthy", status_code: null, response_time_ms: ms, message: `Domain verified · ${ms}ms` };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const text = String((err as Error)?.message ?? err).toLowerCase();
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: text.includes("timeout") ? "Timed out" : "Connection failed", error_code: "resend_unreachable" };
  }
}

async function checkN8n(): Promise<CheckResult> {
  const base = { service: "n8n", display_name: "n8n Automation", category: "automation", error_code: null };
  const url = envOr("DFP_N8N_URL");
  if (!url) return notConfigured("n8n", "n8n Automation", "automation", "DFP_N8N_URL not configured");
  const started = performance.now();
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/healthz`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "DFP-Health-Probe/1.0" } });
    const ms = Math.round(performance.now() - started);
    if (res.ok) return { ...base, status: "healthy", status_code: res.status, response_time_ms: ms, message: `n8n reachable · ${ms}ms` };
    return { ...base, status: "down", status_code: res.status, response_time_ms: ms, message: `n8n HTTP ${res.status}`, error_code: "n8n_error" };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const text = String((err as Error)?.message ?? err).toLowerCase();
    return { ...base, status: "down", status_code: null, response_time_ms: ms, message: text.includes("timeout") ? "Timed out" : "Connection failed", error_code: "n8n_unreachable" };
  }
}

async function checkPbx(admin: Admin): Promise<CheckResult> {
  const base = { service: "pbx", display_name: "PBX Telephony", category: "communications", error_code: null };
  try {
    const { count: tenants, error } = await admin.from("pbx_tenants").select("id", { count: "exact", head: true });
    if (error) return { ...base, status: "down", status_code: null, response_time_ms: null, message: "PBX tenant query failed", error_code: "pbx_query_failed" };
    if ((tenants ?? 0) === 0) return notConfigured("pbx", "PBX Telephony", "communications", "No PBX tenants configured");
    const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
    const { count: failed } = await admin.from("pbx_webhook_events").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "failed");
    if ((failed ?? 0) >= 3) return { ...base, status: "degraded", status_code: null, response_time_ms: null, message: `${tenants} tenant(s) · ${failed} webhook errors (24h)`, error_code: "pbx_webhook_errors" };
    return { ...base, status: "healthy", status_code: null, response_time_ms: null, message: `${tenants} tenant(s) active` };
  } catch {
    return { ...base, status: "down", status_code: null, response_time_ms: null, message: "PBX check failed", error_code: "pbx_check_failed" };
  }
}

async function checkUatWorker(admin: Admin): Promise<CheckResult> {
  const base = { service: "uat_worker", display_name: "UAT Worker", category: "testing", error_code: null };
  const url = envOr("UAT_WORKER_URL");
  const token = envOr("UAT_WORKER_TOKEN");
  if (url && token) {
    const started = performance.now();
    try {
      const res = await fetch(url.replace(/\/$/, "") + "/health", { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Authorization: `Bearer ${token}` } });
      const ms = Math.round(performance.now() - started);
      if (res.ok) return { ...base, status: "healthy", status_code: res.status, response_time_ms: ms, message: `Worker ready · ${ms}ms` };
      return { ...base, status: "down", status_code: res.status, response_time_ms: ms, message: `Worker HTTP ${res.status}`, error_code: "uat_worker_error" };
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      const text = String((err as Error)?.message ?? err).toLowerCase();
      return { ...base, status: "down", status_code: null, response_time_ms: ms, message: text.includes("timeout") ? "Timed out" : "Connection failed", error_code: "uat_worker_unreachable" };
    }
  }
  if (url && !token) return notConfigured("uat_worker", "UAT Worker", "testing", "UAT_WORKER_TOKEN not configured");
  try {
    const { data: workers, error } = await admin.from("bs_uat_workers").select("state, last_heartbeat_at, suspended_at").order("last_heartbeat_at", { ascending: false }).limit(1);
    if (error || !workers || workers.length === 0) return notConfigured("uat_worker", "UAT Worker", "testing", "No UAT worker registered");
    const w = workers[0];
    if (w.suspended_at) return { ...base, status: "down", status_code: null, response_time_ms: null, message: "Worker suspended", error_code: "worker_suspended" };
    const hb = w.last_heartbeat_at ? new Date(w.last_heartbeat_at).getTime() : 0;
    const ageMs = Date.now() - hb;
    if (hb === 0 || ageMs > 30 * 60 * 1000) return { ...base, status: "degraded", status_code: null, response_time_ms: null, message: "Worker heartbeat stale", error_code: "worker_heartbeat_stale" };
    return { ...base, status: "healthy", status_code: null, response_time_ms: null, message: `Worker heartbeat OK (${w.state ?? "unknown"})` };
  } catch {
    return { ...base, status: "unknown", status_code: null, response_time_ms: null, message: "Worker state unavailable", error_code: null };
  }
}

async function checkBackups(admin: Admin): Promise<CheckResult> {
  const base = { service: "backups", display_name: "Backups", category: "data", error_code: null };
  try {
    const { data, error } = await admin.from("backup_records").select("status, completed_at, verification_status, last_verified_at").order("completed_at", { ascending: false }).limit(1);
    if (error) return { ...base, status: "down", status_code: null, response_time_ms: null, message: "Backup query failed", error_code: "backup_query_failed" };
    if (!data || data.length === 0) return { ...base, status: "down", status_code: null, response_time_ms: null, message: "CRITICAL — no verified backup record", error_code: "no_backup" };
    const latest = data[0];
    const lastAt = latest.completed_at ? new Date(latest.completed_at).getTime() : 0;
    const ageMs = Date.now() - lastAt;
    const ageHours = Math.round(ageMs / 3600000);
    const ok = latest.status === "success" || latest.status === "completed";
    if (!ok) return { ...base, status: "down", status_code: null, response_time_ms: null, message: `Latest backup ${latest.status}`, error_code: "backup_failed" };
    if (ageMs > 48 * 3600000) return { ...base, status: "degraded", status_code: null, response_time_ms: null, message: `Backup ${ageHours}h old`, error_code: "backup_stale" };
    return { ...base, status: "healthy", status_code: null, response_time_ms: null, message: `Last backup ${ageHours}h ago` };
  } catch {
    return { ...base, status: "down", status_code: null, response_time_ms: null, message: "Backup check failed", error_code: "backup_check_failed" };
  }
}

async function checkDeployment(admin: Admin): Promise<CheckResult> {
  const base = { service: "deployment", display_name: "Deployment", category: "delivery", error_code: null };
  try {
    const { data, error } = await admin.from("digital_footprint_deployments").select("deployment_status, build_status, latest_commit, deployed_at").order("deployed_at", { ascending: false }).limit(1);
    if (error) return { ...base, status: "unknown", status_code: null, response_time_ms: null, message: "Deployment query failed", error_code: "deployment_query_failed" };
    if (!data || data.length === 0) return unknownResult("deployment", "Deployment", "delivery", "UNKNOWN — no deployment metadata");
    const d = data[0];
    if (d.deployment_status === "failed" || d.build_status === "failed") return { ...base, status: "down", status_code: null, response_time_ms: null, message: "Failed deployment", error_code: "deployment_failed" };
    const sha = d.latest_commit ? d.latest_commit.slice(0, 7) : "UNKNOWN";
    return { ...base, status: "healthy", status_code: null, response_time_ms: null, message: `${d.deployment_status ?? "unknown"} · ${sha}` };
  } catch {
    return { ...base, status: "unknown", status_code: null, response_time_ms: null, message: "Deployment state unavailable", error_code: null };
  }
}

async function reconcileAlerts(admin: Admin, prev: Map<string, string>, results: CheckResult[]): Promise<void> {
  const alerting = new Set(["down", "degraded"]);
  const now = new Date().toISOString();
  for (const r of results) {
    const prevStatus = prev.get(r.service);
    const shouldAlert = alerting.has(r.status);
    const wasAlerting = prevStatus ? alerting.has(prevStatus) : false;
    const title = `${r.display_name} is ${r.status}`;
    if (shouldAlert && !wasAlerting) {
      const { data: existing } = await admin.from("digital_footprint_alerts").select("id").eq("source", "health_probe").eq("title", title).eq("is_resolved", false).limit(1).maybeSingle();
      if (!existing) {
        await admin.from("digital_footprint_alerts").insert({ alert_type: r.status === "down" ? "critical" : "warning", title, description: r.message || "Service issue", source: "health_probe", is_read: false, is_resolved: false });
      }
    } else if (!shouldAlert && wasAlerting) {
      const prevTitle = `${r.display_name} is ${prevStatus}`;
      await admin.from("digital_footprint_alerts").update({ is_resolved: true, resolved_at: now }).eq("source", "health_probe").eq("title", prevTitle).eq("is_resolved", false);
    }
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== "POST") return json(req, { success: false, error: "Method not allowed" }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(req, { success: false, error: "Health probe is not configured" }, 503);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const schedulerToken = req.headers.get("x-dfp-scheduler-token")?.trim() ?? "";
    let isCronCall = false;

    if (schedulerToken) {
      const { data: tokenValid, error: tokenError } = await admin.rpc("dfp_verify_scheduler_token", { p_token: schedulerToken });
      if (tokenError || tokenValid !== true) {
        return json(req, { success: false, error: "Invalid scheduler token" }, 401);
      }
      isCronCall = true;
    }

    if (!isCronCall) {
      const authorization = req.headers.get("authorization") ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!token) return json(req, { success: false, error: "Authentication required" }, 401);
      const isScheduled = token === SERVICE_ROLE_KEY;
      if (!isScheduled && !(await isInternalUser(admin, token))) {
        return json(req, { success: false, error: "Staff or admin access required" }, 403);
      }
    }

    const { data: prevRows } = await admin.from("dfp_service_health").select("service, status");
    const prev = new Map<string, string>();
    for (const row of (prevRows ?? [])) prev.set(row.service, row.status);

    const results = await Promise.all([
      checkWebsite(),
      checkDatabase(admin),
      checkAuth(admin),
      checkStorage(admin),
      checkStripe(admin),
      checkEmail(admin),
      checkN8n(),
      checkPbx(admin),
      checkUatWorker(admin),
      checkBackups(admin),
      checkDeployment(admin),
    ]);

    const now = new Date().toISOString();

    for (const r of results) {
      await admin.from("dfp_service_health").upsert({
        service: r.service, display_name: r.display_name, category: r.category, status: r.status,
        status_code: r.status_code, response_time_ms: r.response_time_ms, message: r.message,
        environment: ENVIRONMENT, checked_at: now, updated_at: now,
      }, { onConflict: "service" });

      await admin.from("dfp_health_checks").insert({
        service: r.service, status: r.status, status_code: r.status_code,
        response_time_ms: r.response_time_ms, message: r.message, error_code: r.error_code, checked_at: now,
      });
    }

    try { await reconcileAlerts(admin, prev, results); } catch { /* best-effort */ }

    if (isCronCall) {
      await admin.from("dfp_health_scheduler_state")
        .update({ last_auto_run_at: now, last_auto_run_status: "ok", updated_at: now })
        .eq("id", true);
    }

    return json(req, { success: true, checked_at: now, environment: ENVIRONMENT, results });
  } catch (err) {
    return json(req, { success: false, error: "health_probe_failed", message: String((err as Error)?.message ?? "Unexpected error") }, 500);
  }
});
