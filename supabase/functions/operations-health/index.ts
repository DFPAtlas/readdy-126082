import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// operations-health — minimal authenticated DFP cloud health endpoint.
//
// Performs a lightweight server-side database read + Storage service check and
// returns ONLY { status, latency_ms } per service + a sampled_at timestamp.
// No rows, bucket names, table data, URLs, error stacks or secrets are ever
// returned. HTTP 200 is used whenever the function itself completed, even if an
// individual service is unavailable.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "configuration_missing" }),
      { headers: { ...CORS, "Content-Type": "application/json" }, status: 503 },
    );
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Database — lightweight server-side read (result discarded).
  let dbStatus: "healthy" | "degraded" | "unavailable" = "unavailable";
  let dbLatencyMs = 0;
  try {
    const started = Date.now();
    const { error } = await client.from("dfp_service_health").select("service").limit(1);
    dbLatencyMs = Date.now() - started;
    dbStatus = error ? "unavailable" : "healthy";
  } catch {
    dbStatus = "unavailable";
    dbLatencyMs = 0;
  }

  // Storage — server-side Storage service check (bucket/object data discarded).
  let storageStatus: "healthy" | "degraded" | "unavailable" = "unavailable";
  let storageLatencyMs = 0;
  try {
    const started = Date.now();
    const { error } = await client.storage.listBuckets();
    storageLatencyMs = Date.now() - started;
    storageStatus = error ? "unavailable" : "healthy";
  } catch {
    storageStatus = "unavailable";
    storageLatencyMs = 0;
  }

  return new Response(
    JSON.stringify({
      sampled_at: new Date().toISOString(),
      database: { status: dbStatus, latency_ms: dbLatencyMs },
      storage: { status: storageStatus, latency_ms: storageLatencyMs },
    }),
    { headers: { ...CORS, "Content-Type": "application/json" }, status: 200 },
  );
});
