import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-health — safe server-side connectivity verification for DFP AI Ops.
//
// HEALTH / CONNECTIVITY verification ONLY. Never:
//   * executes agents / n8n workflows
//   * calls models for inference
//   * executes tools, sends email, creates financial objects, writes to GitHub
//   * mutates business data
//
// Phase 3 Prompt 02 additions:
//   * persists each result into ai_runtime_health_checks
//   * persists one summary into ai_runtime_health_sweeps
//   * applies monitoring-rule failure/recovery thresholds (alert dedupe +
//     recovery) — observation only, never remediation.
//
// Security:
//   * verify_jwt = true → only authenticated users reach this.
//   * internal_role() IS NOT NULL → only internal staff.
//   * Every target maps to a hardcoded, allowlisted adapter. Arbitrary URLs are
//     impossible (SSRF-safe). Secrets are read server-side only and never
//     returned to the browser.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

const SYSTEMS = new Set([
  "supabase", "n8n", "ollama", "openai", "anthropic",
  "resend", "stripe", "github", "readdy", "monitoring",
  "notifications", "site_api",
]);

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

function healthy(
  r: HealthResult,
  msg: string,
  latencyMs: number | null,
  authenticated: boolean | null = null,
): HealthResult {
  r.status = "healthy";
  r.reachable = true;
  r.authenticated = authenticated;
  r.latencyMs = latencyMs;
  r.configurationState = "configured";
  r.errorCategory = null;
  r.safeMessage = msg;
  return r;
}

function degraded(
  r: HealthResult,
  msg: string,
  category: string,
  latencyMs: number | null = null,
): HealthResult {
  r.status = "degraded";
  r.reachable = false;
  r.latencyMs = latencyMs;
  r.errorCategory = category;
  r.safeMessage = msg;
  return r;
}

function unavailable(
  r: HealthResult,
  msg: string,
  category: string,
  latencyMs: number | null = null,
): HealthResult {
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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
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

async function checkSupabase(
  admin: ReturnType<typeof createClient>,
  r: HealthResult,
): Promise<HealthResult> {
  const tables = [
    "ai_sites", "ai_operations_agents", "ai_runs", "ai_approvals",
    "ai_tool_connections", "ai_budgets",
  ];
  const started = Date.now();
  let reachable = 0;
  for (const t of tables) {
    try {
      const { error } = await admin.from(t).select("id").limit(1);
      if (!error) reachable += 1;
    } catch {
      // ignore individual table failures; summarise below
    }
  }
  const latencyMs = Date.now() - started;
  if (reachable === tables.length) {
    return healthy(r, "Database reachable — core AI Operations tables accessible.", latencyMs, true);
  }
  if (reachable > 0) {
    return degraded(
      r,
      `Database reachable but only ${reachable} of ${tables.length} core tables were accessible.`,
      "unavailable",
      latencyMs,
    );
  }
  return unavailable(r, "Database could not be read.", "unavailable", latencyMs);
}

async function checkN8n(r: HealthResult): Promise<HealthResult> {
  const url = (Deno.env.get("N8N_URL") ?? "").trim();
  const apiKey = (Deno.env.get("N8N_API_KEY") ?? "").trim();
  if (!url || !apiKey) {
    return notConfigured(r, "n8n runtime is not configured (missing instance URL or API key).");
  }
  const endpoint = url.replace(/\/+$/, "") + "/healthz";
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: { "X-N8N-API-KEY": apiKey },
    }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return healthy(r, "Connectivity Verified — Workflow Execution Disabled.", latencyMs, true);
    }
    if (res.status === 401 || res.status === 403) return authFailed(r);
    return unavailable(r, `n8n responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkOllama(r: HealthResult): Promise<HealthResult> {
  const url = (Deno.env.get("OLLAMA_URL") ?? "").trim();
  if (!url) {
    return notConfigured(r, "Local Ollama runtime is not configured (no host URL).");
  }
  const endpoint = url.replace(/\/+$/, "") + "/api/tags";
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(endpoint, { method: "GET" }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return healthy(r, "Ollama reachable — model catalogue available (no inference).", latencyMs, true);
    }
    return unavailable(r, `Ollama responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return unavailable(r, "Unreachable from current runtime.", "unavailable", Date.now() - started);
  }
}

async function checkOpenAI(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
  if (!key) {
    return notConfigured(r, "OpenAI provider is not configured (no API key).");
  }
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return healthy(r, "Provider reachable — metadata check succeeded (no inference).", latencyMs, true);
    }
    if (res.status === 401) return authFailed(r);
    if (res.status === 429) return degraded(r, "Provider rate-limited the health check.", "rate_limited", latencyMs);
    return unavailable(r, `Provider responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkAnthropic(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim();
  if (!key) {
    return notConfigured(r, "Anthropic provider is not configured (no API key).");
  }
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
    }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return healthy(r, "Provider reachable — metadata check succeeded (no inference).", latencyMs, true);
    }
    if (res.status === 401) return authFailed(r);
    if (res.status === 429) return degraded(r, "Provider rate-limited the health check.", "rate_limited", latencyMs);
    return unavailable(r, `Provider responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkResend(r: HealthResult): Promise<HealthResult> {
  const key = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  if (!key) {
    return notConfigured(r, "Email (Resend) is not configured (no API key).");
  }
  const senderDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "digital-footprint.uk").trim().toLowerCase();
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      const payload = await res.json().catch(() => null) as { data?: Array<{ name?: string; status?: string }> } | null;
      const domain = payload?.data?.find((d) => (d.name ?? "").toLowerCase() === senderDomain);
      if (!domain) {
        return degraded(r, `Configured sender domain ${senderDomain} is not present in Resend.`, "sender_domain_missing", latencyMs);
      }
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
  if (!key) {
    return notConfigured(r, "Stripe is not configured (no secret key).");
  }
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/account", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return healthy(r, "Stripe reachable — account metadata check succeeded (no financial object created).", latencyMs, true);
    }
    if (res.status === 401) return authFailed(r);
    return unavailable(r, `Stripe responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

async function checkGitHub(r: HealthResult): Promise<HealthResult> {
  const token = (Deno.env.get("GITHUB_TOKEN") ?? "").trim();
  if (!token) {
    return notConfigured(r, "GitHub is not configured (no access token).");
  }
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }, TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return healthy(r, "GitHub reachable — authenticated identity check succeeded (no write).", latencyMs, true);
    }
    if (res.status === 401) return authFailed(r);
    return unavailable(r, `GitHub responded with status ${res.status}.`, "unavailable", latencyMs);
  } catch (err) {
    return classifyFetchError(r, err, Date.now() - started);
  }
}

function staticResult(system: string, connectionKey: string, message: string): HealthResult {
  const r = base(system, connectionKey);
  if (system === "readdy") return notTestable(r, message);
  return notConfigured(r, message);
}

async function runAdapter(
  system: string,
  connectionKey: string,
  admin: ReturnType<typeof createClient>,
): Promise<HealthResult> {
  const r = base(system, connectionKey);
  switch (system) {
    case "supabase":
      return await checkSupabase(admin, r);
    case "n8n":
      return await checkN8n(r);
    case "ollama":
      return await checkOllama(r);
    case "openai":
      return await checkOpenAI(r);
    case "anthropic":
      return await checkAnthropic(r);
    case "resend":
      return await checkResend(r);
    case "stripe":
      return await checkStripe(r);
    case "github":
      return await checkGitHub(r);
    case "readdy":
      return staticResult(system, connectionKey, "No safe read-only programmatic health check exists — reported as not testable.");
    case "monitoring":
      return staticResult(system, connectionKey, "No monitoring runtime provider is connected.");
    case "notifications":
      return staticResult(system, connectionKey, "No notification runtime provider is connected.");
    case "site_api":
      return staticResult(system, connectionKey, "No safe per-site API health endpoint is configured.");
    default:
      return notTestable(r, "Unknown system.");
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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

// --- Persistence + monitoring alert evaluation (Phase 3 Prompt 02) ----------

const PROVIDER_SYSTEMS = new Set(["openai", "anthropic", "ollama"]);
const FAILURE_STATUSES = new Set(["degraded", "unavailable"]);

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function systemDisplayName(system: string): string {
  const names: Record<string, string> = {
    supabase: "Supabase", n8n: "n8n", ollama: "Ollama", openai: "OpenAI",
    anthropic: "Anthropic", resend: "Email (Resend)", stripe: "Stripe",
    github: "GitHub", readdy: "Readdy", monitoring: "Monitoring",
    notifications: "Notifications", site_api: "Site API",
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
  triggerType: "manual" | "scheduled",
  initiatedBy: string,
  startedAt: string,
  durationMs: number,
): Promise<{ sweepKey: string; persisted: boolean; error: string | null }> {
  const sweepKey = uid("SWP");
  const now = new Date().toISOString();
  const systems = results.map((r) => r.system);

  const { error: sweepError } = await admin.from("ai_runtime_health_sweeps").insert({
    sweep_key: sweepKey,
    started_at: startedAt,
    completed_at: now,
    trigger_type: triggerType,
    initiated_by: initiatedBy,
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
  if (sweepError) {
    return { sweepKey, persisted: false, error: "Sweep history could not be saved." };
  }

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
    initiated_by: initiatedBy,
    trigger_type: triggerType,
  }));

  const { error: checkError } = await admin.from("ai_runtime_health_checks").insert(checkRows);
  if (checkError) {
    return { sweepKey, persisted: false, error: "Some health results could not be saved." };
  }

  return { sweepKey, persisted: true, error: null };
}

async function upsertFailureAlert(
  admin: ReturnType<typeof createClient>,
  system: string,
  dedupeKey: string,
  severity: "high" | "critical",
  now: string,
  initiatedBy: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("ai_alerts")
    .select("id, occurrence_count")
    .eq("correlation_id", dedupeKey)
    .not("status", "in", '("resolved","closed")')
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    const occ = (existing[0].occurrence_count ?? 0) + 1;
    await admin.from("ai_alerts").update({
      occurrence_count: occ,
      last_seen_at: now,
    }).eq("id", existing[0].id);
    return;
  }

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
    actor_reference: initiatedBy,
    trigger_source: "runtime_monitoring",
    environment: "production",
    notes: `${systemDisplayName(system)} confirmed a monitoring failure after repeated failed checks.`,
  });
}

async function resolveAlert(
  admin: ReturnType<typeof createClient>,
  system: string,
  dedupeKey: string,
  now: string,
  initiatedBy: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("ai_alerts")
    .select("id")
    .eq("correlation_id", dedupeKey)
    .not("status", "in", '("resolved","closed")')
    .order("created_at", { ascending: false })
    .limit(1);

  if (!existing || existing.length === 0) return;

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
    actor_reference: initiatedBy,
    trigger_source: "runtime_monitoring",
    environment: "production",
    notes: `${systemDisplayName(system)} connectivity recovered — associated alert resolved.`,
  });
}

async function evaluateMonitoring(
  admin: ReturnType<typeof createClient>,
  results: HealthResult[],
  initiatedBy: string,
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
      await upsertFailureAlert(admin, system, dedupeKey, severity, now, initiatedBy);
    }

    if (rule.create_alert_on_recovery && consecutiveSuccesses >= rule.recovery_threshold) {
      await resolveAlert(admin, system, dedupeKey, now, initiatedBy);
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: role } = await userClient.rpc("internal_role");
  if (!role) {
    return json({ error: "Internal staff access required." }, 403);
  }

  let body: { targets?: { system?: unknown; connectionKey?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const targets = Array.isArray(body.targets) ? body.targets : [];
  const valid = targets
    .filter((t) => typeof t?.system === "string" && SYSTEMS.has(t.system))
    .map((t) => ({
      system: t.system as string,
      connectionKey: typeof t.connectionKey === "string" ? t.connectionKey : t.system as string,
    }));

  if (valid.length === 0) {
    return json({ error: "No valid targets supplied." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const actor = user.email ?? user.id;
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();

  if (valid.length > 1) {
    await admin.from("ai_audit_events").insert({
      audit_key: uid("RH"),
      occurred_at: startedAt,
      event_type: "runtime_health_check_started",
      action: "runtime_health_check",
      outcome: "informational",
      severity: "low",
      actor_type: "human",
      actor_reference: actor,
      trigger_source: "manual",
      environment: "production",
      notes: `Runtime health sweep started for ${valid.length} systems.`,
    });
  }

  const results = await mapWithConcurrency(valid, CONCURRENCY, (t) =>
    runAdapter(t.system, t.connectionKey, admin),
  );

  const counts: Record<string, number> = {
    healthy: 0, degraded: 0, unavailable: 0, not_configured: 0, not_testable: 0, unknown: 0,
  };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const summaryStatus =
    counts.unavailable > 0 || counts.degraded > 0 ? "partial"
      : counts.healthy === results.length ? "success"
        : "partial";

  const summary = `Runtime health: ${counts.healthy} healthy, ${counts.degraded} degraded, ` +
    `${counts.unavailable} unavailable, ${counts.not_configured} not configured, ` +
    `${counts.not_testable} not testable.`;

  const durationMs = Date.now() - startedAtMs;

  // Persist sweep + individual results (append-only history). Persistence is
  // best-effort — a persistence failure must never change a provider's reported
  // health. Reported separately in the response.
  const persistence = await persistSweepAndChecks(
    admin, results, counts, summary, summaryStatus, "manual", actor, startedAt, durationMs,
  );

  // Apply monitoring-rule failure/recovery thresholds (alert dedupe + recovery).
  try {
    await evaluateMonitoring(admin, results, actor);
  } catch {
    // Alert bookkeeping must never fail the health check itself.
  }

  await admin.from("ai_audit_events").insert({
    audit_key: uid("RH"),
    occurred_at: new Date().toISOString(),
    event_type: "runtime_health_check_completed",
    action: "runtime_health_check",
    outcome: summaryStatus,
    severity: summaryStatus === "success" ? "low" : "medium",
    actor_type: "human",
    actor_reference: actor,
    trigger_source: "manual",
    environment: "production",
    notes: `${summary} Systems checked: ${valid.map((t) => t.system).join(", ")}.`,
  });

  return json({
    results,
    sweep: {
      sweepKey: persistence.sweepKey,
      checkedAt: new Date().toISOString(),
      total: results.length,
      counts,
      summary,
      persisted: persistence.persisted,
      persistError: persistence.error,
    },
  });
});
