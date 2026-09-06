import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-dfp-scheduler-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HEALTHY_LATENCY_MS = 1000;
const QUERY_TIMEOUT_MS = 10_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function safeDiagnostic(err: unknown): string {
  const raw =
    (err as { message?: unknown })?.message ??
    (err as { name?: unknown })?.name ??
    "unknown";
  const text = String(raw);
  return text
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, "postgresql://[redacted]")
    .replace(/password[=:]\S+/gi, "password=[redacted]")
    .replace(/([?&]password=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 300);
}

function secretNameFor(siteKey: string): string {
  return `${siteKey.toUpperCase().replace(/-/g, "_")}_DB_URL`;
}

type ProbeResult = {
  ok: boolean;
  latency_ms: number;
  error_code: string | null;
  diagnostic: string | null;
};

async function runExternalSelectOne(connectionString: string): Promise<ProbeResult> {
  const started = Date.now();

  const attempt = (async () => {
    const client = new Client(connectionString);
    try {
      await client.connect();
      await client.queryArray("SELECT 1");
      return {
        ok: true as const,
        latency_ms: Date.now() - started,
        error_code: null,
        diagnostic: null,
      };
    } finally {
      try {
        await client.end();
      } catch {
        /* noop */
      }
    }
  })();

  const timeout = new Promise<ProbeResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          ok: false,
          latency_ms: Date.now() - started,
          error_code: "TIMEOUT",
          diagnostic: "Heartbeat query timed out.",
        }),
      QUERY_TIMEOUT_MS,
    ),
  );

  return await Promise.race([attempt, timeout]);
}

async function runSelfSelectOne(
  admin: ReturnType<typeof createClient>,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const { error } = await admin
      .from("internal_supabase_monitors")
      .select("id")
      .limit(1);
    if (error) {
      return {
        ok: false,
        latency_ms: Date.now() - started,
        error_code: error.code ?? "QUERY_ERROR",
        diagnostic: error.message,
      };
    }
    return {
      ok: true,
      latency_ms: Date.now() - started,
      error_code: null,
      diagnostic: null,
    };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - started,
      error_code: (e as { name?: string })?.name ?? "PROBE_ERROR",
      diagnostic: safeDiagnostic(e),
    };
  }
}

type Monitor = {
  id: number;
  site_key: string | null;
  supabase_url: string | null;
};

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

  const { data: monitors, error: monErr } = await admin
    .from("internal_supabase_monitors")
    .select("id, site_key, supabase_url")
    .not("site_key", "is", null)
    .neq("database_status", "testing");

  if (monErr || !monitors || monitors.length === 0) {
    return json({ error: "No database monitors configured" }, 404);
  }

  const selfUrl = supabaseUrl.replace(/\/+$/, "").toLowerCase();
  const results: Record<string, unknown>[] = [];

  for (const monitor of monitors) {
    const isSelf =
      (monitor.supabase_url ?? "").replace(/\/+$/, "").toLowerCase() === selfUrl;

    const checkedAt = new Date().toISOString();

    let status: "healthy" | "degraded" | "offline" | "check_error";
    let latencyMs: number | null = null;
    let errorCode: string | null = null;
    let errorReason: string | null = null;
    let lastHeartbeatAt: string | null = null;

    if (isSelf) {
      const result = await runSelfSelectOne(admin);
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
      } else {
        status = "offline";
        errorCode = result.error_code;
        errorReason = result.diagnostic ?? "Database connection or query failed.";
      }
    } else {
      const connectionString = Deno.env.get(secretNameFor(monitor.site_key ?? ""));
      if (!connectionString || connectionString.trim().length === 0) {
        status = "check_error";
        errorCode = "CONFIG_MISSING";
        errorReason = "Database heartbeat credential is not configured.";
      } else {
        let result: ProbeResult;
        try {
          result = await runExternalSelectOne(connectionString);
        } catch (e) {
          result = {
            ok: false,
            latency_ms: 0,
            error_code: (e as { name?: string })?.name ?? "PROBE_ERROR",
            diagnostic: safeDiagnostic(e),
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
          errorReason = result.diagnostic ?? "Database connection or query failed.";
        }
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

    results.push({
      site_key: monitor.site_key,
      status,
      latency_ms: latencyMs,
      checked_at: checkedAt,
      error_code: errorCode,
      error_reason: errorReason,
    });
  }

  return json({ monitors: results });
});
