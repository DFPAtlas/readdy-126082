import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { check_type, target_url, monitor_id, project_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const checkedAt = new Date().toISOString();
    const result: any = {
      check_type,
      monitor_id,
      project_id,
      status: "unknown",
      status_code: null,
      response_time_ms: null,
      message: "",
      error_message: null,
      checked_at: checkedAt,
    };

    switch (check_type) {
      case "website": {
        const start = Date.now();
        let resp: Response | null = null;
        try {
          resp = await fetch(target_url, { redirect: "follow" });
          result.response_time_ms = Date.now() - start;
          result.status_code = resp.status;
          const isHttps = target_url.startsWith("https://");
          const sslStatus = isHttps ? "valid" : "unknown";

          if (resp.status >= 200 && resp.status < 400) {
            const isSlow = result.response_time_ms > 1500;
            const isWarningSpeed = result.response_time_ms > 500;
            result.status = isSlow ? "slow" : isWarningSpeed ? "warning" : "healthy";
            result.message = `Website responded ${resp.status} in ${result.response_time_ms}ms`;
          } else if (resp.status >= 400 && resp.status < 500) {
            result.status = "error";
            result.message = `Website returned client error ${resp.status} in ${result.response_time_ms}ms`;
          } else {
            result.status = "failed";
            result.message = `Website returned server error ${resp.status} in ${result.response_time_ms}ms`;
          }

          // Update monitored_websites row
          const websiteStatus = result.status === "healthy" || result.status === "warning" ? "online" : result.status === "slow" ? "slow" : result.status === "error" ? "error" : "offline";
          await supabaseAdmin
            .from("internal_monitored_websites")
            .update({
              last_status_code: result.status_code,
              last_response_time_ms: result.response_time_ms,
              last_checked_at: checkedAt,
              status: websiteStatus,
              ssl_status: sslStatus,
            })
            .eq("id", monitor_id);
        } catch (e: any) {
          result.status = "failed";
          result.response_time_ms = Date.now() - start;
          result.error_message = e.message ?? "Request failed";
          result.message = "Website check failed: " + (e.message ?? "unknown error");

          await supabaseAdmin
            .from("internal_monitored_websites")
            .update({
              last_status_code: 0,
              last_response_time_ms: result.response_time_ms,
              last_checked_at: checkedAt,
              status: "offline",
            })
            .eq("id", monitor_id);
        }
        break;
      }

      case "supabase": {
        const start = Date.now();
        let dbStatus = "healthy";
        let authStatus = "healthy";
        let storageStatus = "healthy";
        let edgeStatus = "healthy";
        let realtimeStatus = "healthy";

        try {
          const { error: dbErr } = await supabaseAdmin.from("internal_monitored_websites").select("id").limit(1);
          if (dbErr) dbStatus = "failed";
        } catch { dbStatus = "failed"; }

        try {
          const authResp = await fetch(`${supabaseUrl}/auth/v1/health`);
          if (!authResp.ok) authStatus = "warning";
        } catch { authStatus = "failed"; }

        try {
          const storageResp = await fetch(`${supabaseUrl}/storage/v1/bucket`);
          if (!storageResp.ok) storageStatus = "warning";
        } catch { storageStatus = "failed"; }

        try {
          const fnResp = await fetch(`${supabaseUrl}/functions/v1/internal-monitoring-run-check`, { method: "HEAD" });
          if (!fnResp.ok && fnResp.status !== 405) edgeStatus = "warning";
        } catch { edgeStatus = "failed"; }

        try {
          const rtResp = await fetch(`${supabaseUrl}/realtime/v1/health`);
          if (!rtResp.ok) realtimeStatus = "warning";
        } catch { realtimeStatus = "failed"; }

        result.response_time_ms = Date.now() - start;
        const allHealthy = dbStatus === "healthy" && authStatus === "healthy" && storageStatus === "healthy" && edgeStatus === "healthy" && realtimeStatus === "healthy";
        const anyFailed = dbStatus === "failed" || authStatus === "failed" || storageStatus === "failed" || edgeStatus === "failed" || realtimeStatus === "failed";
        result.status = anyFailed ? "failed" : allHealthy ? "healthy" : "warning";
        result.message = `DB:${dbStatus} Auth:${authStatus} Storage:${storageStatus} EdgeFn:${edgeStatus} RT:${realtimeStatus}`;
        result.metadata = { database_status: dbStatus, auth_status: authStatus, storage_status: storageStatus, edge_functions_status: edgeStatus, realtime_status: realtimeStatus };

        await supabaseAdmin
          .from("internal_supabase_monitors")
          .update({
            database_status: dbStatus,
            auth_status: authStatus,
            storage_status: storageStatus,
            edge_functions_status: edgeStatus,
            realtime_status: realtimeStatus,
            last_checked_at: checkedAt,
          })
          .eq("id", monitor_id);
        break;
      }

      case "edge_function": {
        const start = Date.now();
        try {
          const resp = await fetch(target_url);
          result.status_code = resp.status;
          result.response_time_ms = Date.now() - start;
          if (resp.ok) {
            result.status = "healthy";
            result.message = `Edge function responded ${resp.status} in ${result.response_time_ms}ms`;
          } else {
            result.status = "failed";
            const body = await resp.text();
            result.error_message = body.slice(0, 500);
            result.message = `Edge function returned ${resp.status}`;
          }

          const now = new Date().toISOString();
          await supabaseAdmin
            .from("internal_edge_function_monitors")
            .update({
              last_status_code: result.status_code,
              last_response_time_ms: result.response_time_ms,
              last_checked_at: now,
              status: result.status,
              last_success_at: result.status === "healthy" ? now : undefined,
              last_failure_at: result.status === "failed" ? now : undefined,
              last_error_message: result.status === "failed" ? result.error_message : null,
            })
            .eq("id", monitor_id);
        } catch (e: any) {
          result.status = "failed";
          result.response_time_ms = Date.now() - start;
          result.error_message = e.message ?? "Request failed";
          result.message = "Edge function check failed: " + (e.message ?? "unknown");

          const now = new Date().toISOString();
          await supabaseAdmin
            .from("internal_edge_function_monitors")
            .update({
              last_status_code: 0,
              last_response_time_ms: result.response_time_ms,
              last_checked_at: now,
              status: "failed",
              last_failure_at: now,
              last_error_message: result.error_message,
            })
            .eq("id", monitor_id);
        }
        break;
      }

      case "webhook": {
        if (!target_url) {
          result.status = "unknown";
          result.message = "No webhook URL provided for health check";
        } else {
          const start = Date.now();
          try {
            const resp = await fetch(target_url, { method: "HEAD", redirect: "follow" });
            result.status_code = resp.status;
            result.response_time_ms = Date.now() - start;
            if (resp.ok || resp.status === 405) {
              result.status = "healthy";
              result.message = `Webhook endpoint reachable (${resp.status}) in ${result.response_time_ms}ms`;
            } else {
              result.status = "failed";
              result.error_message = `HTTP ${resp.status}`;
              result.message = `Webhook returned ${resp.status}`;
            }
          } catch (e: any) {
            result.status = "failed";
            result.response_time_ms = Date.now() - start;
            result.error_message = e.message ?? "Request failed";
            result.message = "Webhook check failed: " + (e.message ?? "unknown");
          }

          const now = new Date().toISOString();
          await supabaseAdmin
            .from("internal_webhook_monitors")
            .update({
              last_checked_at: now,
              status: result.status,
              last_success_at: result.status === "healthy" ? now : undefined,
              last_failure_at: result.status === "failed" ? now : undefined,
              last_error_message: result.status === "failed" ? result.error_message : null,
              failure_count_today: result.status === "failed" ? undefined : undefined,
            })
            .eq("id", monitor_id);
        }
        break;
      }

      case "agent": {
        if (!target_url) {
          result.status = "unknown";
          result.message = "No agent health URL provided";
        } else {
          const start = Date.now();
          try {
            const resp = await fetch(target_url, { redirect: "follow" });
            result.status_code = resp.status;
            result.response_time_ms = Date.now() - start;
            if (resp.ok) {
              result.status = "healthy";
              result.message = `Agent endpoint reachable (${resp.status}) in ${result.response_time_ms}ms`;
            } else {
              result.status = "failed";
              result.error_message = `HTTP ${resp.status}`;
              result.message = "Agent check returned " + resp.status;
            }

            const now = new Date().toISOString();
            await supabaseAdmin
              .from("internal_agent_monitors")
              .update({
                last_checked_at: now,
                status: result.status,
                last_success_at: result.status === "healthy" ? now : undefined,
                last_failure_at: result.status === "failed" ? now : undefined,
                last_error_message: result.status === "failed" ? result.error_message : null,
              })
              .eq("id", monitor_id);
          } catch (e: any) {
            result.status = "failed";
            result.response_time_ms = Date.now() - start;
            result.error_message = e.message ?? "Request failed";
            result.message = "Agent check failed: " + (e.message ?? "unknown");

            const now = new Date().toISOString();
            await supabaseAdmin
              .from("internal_agent_monitors")
              .update({
                last_checked_at: now,
                status: "failed",
                last_failure_at: now,
                last_error_message: result.error_message,
              })
              .eq("id", monitor_id);
          }
        }
        break;
      }

      default:
        result.status = "unknown";
        result.message = "Unknown check type";
    }

    // Always save a monitoring log entry
    await supabaseAdmin
      .from("internal_monitoring_logs")
      .insert({
        project_id: project_id ?? null,
        monitor_type: check_type,
        monitor_id: monitor_id ?? null,
        status: result.status,
        status_code: result.status_code ?? null,
        response_time_ms: result.response_time_ms ?? null,
        message: result.message ?? null,
        error_message: result.error_message ?? null,
        checked_at: checkedAt,
        metadata_json: result.metadata ?? null,
      });

    return new Response(JSON.stringify({ code: "OK", data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ code: "InternalError", data: null, meta: { message: err.message ?? "Internal error" } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
