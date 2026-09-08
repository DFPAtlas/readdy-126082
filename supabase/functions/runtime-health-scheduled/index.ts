import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-health-scheduled — server-side scheduled connectivity monitoring.
//
// Invoked ONLY by the pg_cron scheduler (via net.http_post) using the same
// shared scheduler token as the existing dfp-health-probe job. This is a
// public (verify_jwt=false) endpoint guarded by the X-DFP-Scheduler-Token
// header — if the token is missing/mismatched the function fails closed and
// performs no work.
//
// Runs ONLY the fixed, allowlisted runtime-health adapters for systems that
// have an enabled, active, due monitoring rule. Never accepts arbitrary URLs,
// never executes business operations, never performs inference, never sends
// messages. Persists append-only history and applies failure/recovery
// thresholds (alert dedupe + recovery) — observation only.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-dfp-scheduler-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

type Status =
  | "healthy" | "degraded" | "unavailable"
  | "not_configured" | "not_testable" | "unknown";

interface HealthResult {
  connectionKey: string;
  system: string;
  checkedAt: string;
  status: Status;
  latencyMs: number | null;
  reachable: boolean;
  authenticated: boolean | null;
  configurationState: string;
  errorCategory: string | null;
  safeMessage: string;
  source: "runtime" | "registry";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function base(system: string, connectionKey: string): HealthResult {
  return {
    connectionKey,
    system,
    checkedAt: new Date().toISOString(),
    status: "unknown",
    latencyMs: null,
    reachable: false,
    authenticated: null,
    configurationState: "unknown",
    errorCategory: null,
    safeMessage: "",
    source: "runtime",
  };
}

function notConfigured(r: HealthResult, msg: string): HealthResult {
  r.status = "not_configured";
  r.errorCategory = "configuration_missing";
  r.configurationState = "missing";
  r.safeMessage = msg;
  r.source = "registry";
  return r;
}

function notTestable(r: HealthResult, msg: string): HealthResult {
  r.status = "not_testable";
  r.errorCategory = "unsupported_test";
  r.configurationState = "unknown";
  r.safeMessage = msg;
  r.source = "registry";
  return r;
}

function healthy(r: HealthResult, msg: string, latencyMs: number | null, authenticated: boolean | null = null): HealthResult {
  r.status = "healthy";
  r.reachable = true;
  r.authenticated = authenticated;
  r.latencyMs = latencyMs;
  r.configurationState = "configured";
  r.errorCategory = null;
  r.safeMessage = msg;
  return r;
}

function degraded(r: HealthResult, msg: string, category: string, latencyMs: number | null = null): HealthResult {
  r.status = "degraded";
  r.reachable = false;
  r.latencyMs = latencyMs;
  r.errorCategory = category;
  r.safeMessage = msg;
  return r;
}

function unavailable(r: HealthResult, msg: string, category: string, latencyMs: number | null = null): HealthResult {
  r.status = "unavailable";
  r.reachable = false;
  r.latencyMs = latencyMs;
  r.errorCategory = category;
  r.safeMessage = msg;
  return r;
}

function authFailed(r: HealthResult): HealthResult {
  r.status = "unavailable";
  r.reachable = true;
  r.authenticated = false;
  r.errorCategory = "authentication_failed";
  r.safeMessage = "Provider rejected the supplied credentials (authentication failed).";
  return r;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classifyFetchError(r: HealthResult, err: unknown, latencyMs: number): HealthResult {
  const name = (err as Error)?.name;
  if (name === "AbortError") {
    return degraded(r, "Provider did not respond within the time limit.", "timeout", latencyMs);
  }
  return unavailable(r, "Provider could not be reached.", "unavailable", latencyMs);
}

async function checkSupabase(admin: ReturnType<typeof createClient>, r: HealthResult): Promise<HealthResult> {
  const tables = ["ai_sites", "ai_operations_agents", "ai_runs", "ai_approvals", "ai_tool_connections", "ai_budgets"];
  const started = Date.now();
  let reachable = 0;
  for (const t of tables) {
    try {
      const { error } = await admin.from(t).select("id").limit(1);
      if (!error) reachable += 1;
    } catch {
      // ignore individual table failures
    }
  }
  const latencyMs = Date.now() - started;
  if (reachable === tables.length) return healthy(r, "Database reachable — core AI Operations tables accessible.", latencyMs, true);
  if (reachable > 0) return degraded(r, `Database reachable but only ${reachable} of ${tables.length} core tables were accessible.`, "unavailable", latencyMs);
  return unavailable(r, "Database could not be read.", "unavailable", latencyMs);
}

async function checkN8n(r: HealthResult): Promise<HealthResult> {
  const url = (Deno.env.get("N8N_URL") ?? "").trim();
  const apiKey = (Deno.env.get("N8N_API_KEY") ?? "").trim();
  if (!url || !apiKey) return notConfigured(r, "n8n runtime is not configured (missing instance URL or API key).");
  const endpoint = url.replace(/\/+$/, "") + "/healthz";
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(endpoint, { method: "GET", headers: { "X-N8N-API-KEY": apiKey } }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) return healthy(r, "Connectivity Verified — Workflow Execution Disabled.", latencyMs, true);
    if (res.status === 401 || res.status === 403) return authFailed(r);
    return unavailable(r, `n8n responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkOllama(r: HealthResult): Promise<HealthResult> {
  const url = (Deno.env.get("OLLAMA_URL") ?? "").trim();
  if (!url) return notConfigured(r, "Local Ollama runtime is not configured (no host URL).");
  const endpoint = url.replace(/\/+$/, "") + "/api/tags";
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(endpoint, { method: "GET" }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) return healthy(r, "Ollama reachable — model catalogue available (no inference).", latencyMs, true);
    return unavailable(r, `Ollama responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return unavailable(r, "Unreachable from current runtime.", "unavailable", Date.now() - started);
  }
}

async function checkOpenAI(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
  if (!key) return notConfigured(r, "OpenAI provider is not configured (no API key).");
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/models", { method: "GET", headers: { Authorization: `Bearer ${key}` } }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) return healthy(r, "Provider reachable — metadata check succeeded (no inference).", latencyMs, true);
    if (res.status === 401) return authFailed(r);
    if (res.status === 429) return degraded(r, "Provider rate-limited the health check.", "rate_limited", latencyMs);
    return unavailable(r, `Provider responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkAnthropic(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim();
  if (!key) return notConfigured(r, "Anthropic provider is not configured (no API key).");
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/models", { method: "GET", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) return healthy(r, "Provider reachable — metadata check succeeded (no inference).", latencyMs, true);
    if (res.status === 401) return authFailed(r);
    if (res.status === 429) return degraded(r, "Provider rate-limited the health check.", "rate_limited", latencyMs);
    return unavailable(r, `Provider responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkResend(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  if (!key) return notConfigured(r, "Email (Resend) is not configured (no API key).");
  const senderDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "digital-footprint.uk").trim().toLowerCase();
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", { method: "GET", headers: { Authorization: `Bearer ${key}` } }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      const payload = await res.json().catch(() => null) as { data?: Array<{ name?: string; status?: string }> } | null;
      const domain = payload?.data?.find((d) => (d.name ?? "").toLowerCase() === senderDomain);
      if (!domain) return degraded(r, `Configured sender domain ${senderDomain} is not present in Resend.`, "sender_domain_missing", latencyMs);
      if ((domain.status ?? "").toLowerCase() !== "verified") {
        return degraded(r, `Configured sender domain ${senderDomain} is ${domain.status || "not verified"}.`, "sender_domain_unverified", latencyMs);
      }
      return healthy(r, `Email API reachable — sender domain ${senderDomain} is verified (no email sent).`, latencyMs, true);
    }
    if (res.status === 401) return authFailed(r);
    return unavailable(r, `Email API responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkStripe(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  if (!key) return notConfigured(r, "Stripe is not configured (no secret key).");
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/account", { method: "GET", headers: { Authorization: `Bearer ${key}` } }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) return healthy(r, "Stripe reachable — account metadata check succeeded (no financial object created).", latencyMs, true);
    if (res.status === 401) return authFailed(r);
    return unavailable(r, `Stripe responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkGitHub(r: HealthResult): Promise<HealthResult> {
  const token = (Deno.env.get("GITHUB_TOKEN") ?? "").trim();
  if (!token) return notConfigured(r, "GitHub is not configured (no access token).");
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.github.com/user", { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) return healthy(r, "GitHub reachable — authenticated identity check succeeded (no write).", latencyMs, true);
    if (res.status === 401) return authFailed(r);
    return unavailable(r, `GitHub responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

const ADAPTERS: Record<string, (admin: ReturnType<typeof createClient>, r: HealthResult) => Promise<HealthResult>> = {
  supabase: (a, r) => checkSupabase(a, r),
  n8n: (_a, r) => checkN8n(r),
  ollama: (_a, r) => checkOllama(r),
  openai: (_a, r) => checkOpenAI(r),
  anthropic: (_a, r) => checkAnthropic(r),
  resend: (_a, r) => checkResend(r),
  stripe: (_a, r) => checkStripe(r),
  github: (_a, r) => checkGitHub(r),
};

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

// --- Persistence + alert evaluation (mirrors runtime-health) ----------------

const PROVIDER_SYSTEMS = new Set(["openai", "anthropic", "ollama"]);
const FAILURE_STATUSES = new Set(["degraded", "unavailable"]);

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function systemDisplayName(system: string): string {
  const names: Record<string, string> = {
    supabase: "Supabase", n8n: "n8n", ollama: "Ollama", openai: "OpenAI",
    anthropic: "Anthropic", resend: "Email (Resend)", stripe: "Stripe",
    github: "GitHub",
  };
  return names[system] ?? system;
}

function systemAlertType(system: string): string {
  return PROVIDER_SYSTEMS.has(system) ? "model_provider" : "tool_connection";
}

async function persistSweepAndChecks(
  admin: ReturnType<typeof createClient>,
  results: HealthResult[],
  counts: Record<string, number>,
  summary: string,
  summaryStatus: string,
  startedAt: string,
  durationMs: number,
): Promise<void> {
  const sweepKey = uid("SWP");
  const now = new Date().toISOString();
  const systems = results.map((r) => r.system);

  await admin.from("ai_runtime_health_sweeps").insert({
    sweep_key: sweepKey,
    started_at: startedAt,
    completed_at: now,
    trigger_type: "scheduled",
    initiated_by: "scheduler",
    systems_requested: systems,
    systems_checked: systems,
    healthy_count: counts.healthy ?? 0,
    degraded_count: counts.degraded ?? 0,
    unavailable_count: counts.unavailable ?? 0,
    not_configured_count: counts.not_configured ?? 0,
    not_testable_count: counts.not_testable ?? 0,
    overall_status: summaryStatus,
    duration_ms: durationMs,
    environment: "production",
    summary,
  });

  const checkRows = results.map((r) => ({
    check_key: uid("CHK"),
    sweep_key: sweepKey,
    connection_key: r.connectionKey,
    system_slug: r.system,
    category: r.system,
    checked_at: r.checkedAt,
    status: r.status,
    reachable: r.reachable,
    authenticated: r.authenticated,
    latency_ms: r.latencyMs,
    configuration_state: r.configurationState,
    error_category: r.errorCategory,
    safe_message: r.safeMessage,
    environment: "production",
    source: r.source,
    initiated_by: "scheduler",
    trigger_type: "scheduled",
  }));

  await admin.from("ai_runtime_health_checks").insert(checkRows);
}

async function evaluateMonitoring(
  admin: ReturnType<typeof createClient>,
  results: HealthResult[],
): Promise<void> {
  const systems = [...new Set(results.map((r) => r.system))];
  if (systems.length === 0) return;

  const { data: rules } = await admin
    .from("ai_runtime_monitoring_rules")
    .select("*")
    .in("system_slug", systems)
    .eq("is_active", true)
    .eq("enabled", true);

  if (!rules || rules.length === 0) return;

  const now = new Date().toISOString();

  for (const rule of rules) {
    const system = rule.system_slug;
    if (!rule.create_alert_on_failure && !rule.create_alert_on_recovery) continue;

    const window = Math.max(rule.failure_threshold, rule.recovery_threshold, 5) * 2;
    const { data: recent } = await admin
      .from("ai_runtime_health_checks")
      .select("status")
      .eq("system_slug", system)
      .order("checked_at", { ascending: false })
      .limit(window);

    const statuses = (recent ?? []).map((c) => c.status as string);

    let consecutiveFailures = 0;
    for (const s of statuses) {
      if (FAILURE_STATUSES.has(s)) consecutiveFailures += 1;
      else break;
    }
    let consecutiveSuccesses = 0;
    for (const s of statuses) {
      if (s === "healthy") consecutiveSuccesses += 1;
      else break;
    }

    const dedupeKey = `mon:${system}`;

    if (rule.create_alert_on_failure && consecutiveFailures >= rule.failure_threshold) {
      const severity = statuses[0] === "unavailable" ? "critical" : "high";
      const { data: existing } = await admin
        .from("ai_alerts")
        .select("id, occurrence_count")
        .eq("correlation_id", dedupeKey)
        .not("status", "in", '("resolved","closed")')
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        await admin.from("ai_alerts").update({
          occurrence_count: (existing[0].occurrence_count ?? 0) + 1,
          last_seen_at: now,
        }).eq("id", existing[0].id);
      } else {
        await admin.from("ai_alerts").insert({
          alert_key: uid("ALR"),
          title: `${systemDisplayName(system)} connectivity failure`,
          summary: `${systemDisplayName(system)} failed consecutive monitoring checks and crossed the configured failure threshold.`,
          alert_type: systemAlertType(system),
          source_type: "Runtime health monitoring",
          source_reference: system,
          severity,
          priority: severity === "critical" ? "critical" : "high",
          status: "new",
          risk_level: severity,
          environment: "production",
          correlation_id: dedupeKey,
          occurrence_count: 1,
          first_seen_at: now,
          last_seen_at: now,
          is_active: true,
        });
        await admin.from("ai_audit_events").insert({
          audit_key: uid("AUD"),
          occurred_at: now,
          event_type: "runtime_health_failure_confirmed",
          action: "runtime_monitoring",
          outcome: "failure",
          severity,
          actor_type: "system",
          actor_reference: "scheduler",
          trigger_source: "runtime_monitoring",
          environment: "production",
          notes: `${systemDisplayName(system)} confirmed a monitoring failure after repeated failed checks.`,
        });
      }
    }

    if (rule.create_alert_on_recovery && consecutiveSuccesses >= rule.recovery_threshold) {
      const { data: existing } = await admin
        .from("ai_alerts")
        .select("id")
        .eq("correlation_id", dedupeKey)
        .not("status", "in", '("resolved","closed")')
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        await admin.from("ai_alerts").update({
          status: "resolved",
          resolved_at: now,
          last_seen_at: now,
          resolution_summary: `${systemDisplayName(system)} connectivity recovered after consecutive healthy checks.`,
        }).eq("id", existing[0].id);
        await admin.from("ai_audit_events").insert({
          audit_key: uid("AUD"),
          occurred_at: now,
          event_type: "runtime_health_recovered",
          action: "runtime_monitoring",
          outcome: "success",
          severity: "low",
          actor_type: "system",
          actor_reference: "scheduler",
          trigger_source: "runtime_monitoring",
          environment: "production",
          notes: `${systemDisplayName(system)} connectivity recovered — associated alert resolved.`,
        });
      }
    }
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Token guard — fail closed. The scheduler shares the same token as the
  // existing dfp-health-probe cron (vault secret `dfp_scheduler_secret`).
  const expected = (Deno.env.get("DFP_SCHEDULER_SECRET") ?? Deno.env.get("dfp_scheduler_secret") ?? "").trim();
  const supplied = (req.headers.get("x-dfp-scheduler-token") ?? "").trim();
  if (!expected || !supplied || supplied !== expected) {
    return json({ error: "Unauthorized scheduler token." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();

  // Load due monitoring rules (enabled + active + next_check_at <= now).
  const { data: rules } = await admin
    .from("ai_runtime_monitoring_rules")
    .select("*")
    .eq("is_active", true)
    .eq("enabled", true)
    .lte("next_check_at", new Date().toISOString())
    .order("system_slug", { ascending: true });

  if (!rules || rules.length === 0) {
    return json({ checked: 0, summary: "No monitoring rules are due." });
  }

  const results = await mapWithConcurrency(rules, CONCURRENCY, async (rule) => {
    const adapter = ADAPTERS[rule.system_slug];
    const r = base(rule.system_slug, rule.connection_key ?? rule.system_slug);
    if (!adapter) return notTestable(r, "No allowlisted adapter for this system.");
    try {
      return await adapter(admin, r);
    } catch {
      return unavailable(r, "Health check failed unexpectedly.", "unavailable", null);
    }
  });

  const counts: Record<string, number> = {
    healthy: 0, degraded: 0, unavailable: 0, not_configured: 0, not_testable: 0, unknown: 0,
  };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const summaryStatus =
    counts.unavailable > 0 || counts.degraded > 0 ? "partial"
      : counts.healthy === results.length ? "success"
        : "partial";

  const summary = `Scheduled runtime health: ${counts.healthy} healthy, ${counts.degraded} degraded, ${counts.unavailable} unavailable, ${counts.not_configured} not configured, ${counts.not_testable} not testable.`;

  const durationMs = Date.now() - startedAtMs;

  try {
    await persistSweepAndChecks(admin, results, counts, summary, summaryStatus, startedAt, durationMs);
  } catch {
    // persistence is best-effort
  }

  try {
    await evaluateMonitoring(admin, results);
  } catch {
    // alert bookkeeping must not fail the sweep
  }

  // Advance each rule's next_check_at (last_checked_at = now).
  const now = new Date();
  for (const rule of rules) {
    const next = new Date(now.getTime() + (rule.interval_minutes ?? 15) * 60_000).toISOString();
    await admin.from("ai_runtime_monitoring_rules").update({
      last_checked_at: now.toISOString(),
      next_check_at: next,
    }).eq("id", rule.id);
  }

  return json({
    checked: results.length,
    counts,
    summary,
    sweepKey: null,
  });
});
