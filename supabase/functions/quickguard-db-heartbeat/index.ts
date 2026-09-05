import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// ============================================================================
// quickguard-db-heartbeat — server-side QuickGuard database heartbeat.
//
// Performs a very small, safe health query equivalent to `SELECT 1` against the
// canonical QuickGuard Supabase project and records the result on the EXISTING
// `internal_supabase_monitors` record (joined by the canonical site_key
// `quickguard`, never by the project display-name spelling).
//
// Security:
//   * The database connection string lives ONLY in the trusted Edge Function
//     secret store (`QUICKGUARD_DB_URL`); it is read server-side and never
//     returned to the caller, logged, or exposed to the browser.
//   * The function is token-gated (x-dfp-scheduler-token) and fails closed.
//   * No raw rows, table data, URLs, or stack traces are returned.
//
// State written to `database_status`:
//   healthy     — `SELECT 1` completed within the healthy latency window.
//   degraded    — database reachable but response time exceeded the threshold.
//   offline     — confirmed connection/query failure against the database.
//   check_error — the monitoring process itself failed (missing config,
//                 timeout, or unexpected probe error); database availability
//                 could not be determined.
// `stale` is intentionally NOT written here — it is derived by the wallboard
// reader from heartbeat freshness (an old success must never read as healthy).
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-dfp-scheduler-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_KEY = "quickguard";
const HEALTHY_LATENCY_MS = 1000;
const QUERY_TIMEOUT_MS = 10_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

async function runSelectOne(connectionString: string): Promise<{
  ok: boolean;
  latency_ms: number;
  error_code: string | null;
}> {
  const started = Date.now();

  const attempt = (async () => {
    const client = new Client(connectionString);
    try {
      await client.connect();
      await client.queryArray("SELECT 1");
      return { ok: true as const, latency_ms: Date.now() - started, error_code: null };
    } finally {
      try {
        await client.end();
      } catch {
        /* noop */
      }
    }
  })();

  const timeout = new Promise<{ ok: boolean; latency_ms: number; error_code: string }>(
    (resolve) =>
      setTimeout(
        () => resolve({ ok: false, latency_ms: Date.now() - started, error_code: "TIMEOUT" }),
        QUERY_TIMEOUT_MS,
      ),
  );

  return await Promise.race([attempt, timeout]);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expected = (
    Deno.env.get("DFP_SCHEDULER_SECRET") ?? Deno.env.get("dfp_scheduler_secret") ?? ""
  ).trim();
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

  const { data: monitor, error: monErr } = await admin
    .from("internal_supabase_monitors")
    .select("id, site_key")
    .eq("site_key", SITE_KEY)
    .maybeSingle();

  if (monErr || !monitor) {
    return json({ error: "QuickGuard monitor record not found" }, 404);
  }

  const checkedAt = new Date().toISOString();
  const connectionString = Deno.env.get("QUICKGUARD_DB_URL");

  let status: "healthy" | "degraded" | "offline" | "check_error";
  let latencyMs: number | null = null;
  let errorCode: string | null = null;
  let errorReason: string | null = null;
  let lastHeartbeatAt: string | null = null;

  if (!connectionString || connectionString.trim().length === 0) {
    status = "check_error";
    errorCode = "CONFIG_MISSING";
    errorReason = "Database heartbeat credential is not configured.";
  } else {
    let result: { ok: boolean; latency_ms: number; error_code: string | null };
    try {
      result = await runSelectOne(connectionString);
    } catch (e) {
      result = {
        ok: false,
        latency_ms: 0,
        error_code: (e as { name?: string })?.name ?? "PROBE_ERROR",
      };
    }

    latencyMs = result.latency_ms;

    if (result.ok) {
      if (result.latency_ms <= HEALTHY_LATENCY_MS) {
        status = "healthy";
      } else {
        status = "degraded";
        errorCode = "SLOW_RESPONSE";
        errorReason = `Database responded in ${result.latency_ms}ms (threshold ${HEALTHY_LATENCY_MS}ms).`;
      }
      lastHeartbeatAt = checkedAt;
    } else if (result.error_code === "TIMEOUT") {
      status = "check_error";
      errorCode = "PROBE_TIMEOUT";
      errorReason = "Heartbeat query timed out; database availability undetermined.";
    } else {
      status = "offline";
      errorCode = result.error_code;
      errorReason = "Database connection or query failed.";
    }
  }

  await admin
    .from("internal_supabase_monitors")
    .update({
      database_status: status,
      database_latency_ms: latencyMs,
      database_last_heartbeat_at: lastHeartbeatAt,
      database_error_code: errorCode,
      database_error_reason: errorReason,
      last_checked_at: checkedAt,
    })
    .eq("id", monitor.id);

  return json({
    site_key: SITE_KEY,
    status,
    latency_ms: latencyMs,
    checked_at: checkedAt,
    error_code: errorCode,
    error_reason: errorReason,
  });
});
