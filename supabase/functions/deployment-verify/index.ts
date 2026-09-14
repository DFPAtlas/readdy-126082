import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// deployment-verify — authoritative server-side production verification engine.
// ============================================================================
// DFP COMMAND 18F2 — closes the P1 "browser-supplied verification result"
// trust boundary. The browser may still display PRELIMINARY checks, but only
// this engine may transition VERIFYING -> VERIFIED.
//
// The engine independently resolves every mandatory check from authoritative
// stored telemetry (freshness-checked, > 24h => UNKNOWN, never a stale PASS):
//   - Approved SHA = deployed SHA          (deployment record)
//   - Deployment state = VERIFYING          (deployment record)
//   - Project relationship valid            (internal_projects)
//   - Monitoring configured where mandatory (integration record)
//   - Production monitoring state           (internal_monitored_websites)
//   - Critical operational alerts           (internal_monitoring_alerts/incidents)
//   - Backend / database health             (internal_supabase_monitors)
//   - Runtime health where required         (ai_runtime_bridge_nodes)
//   - AI state where AI-powered             (honest UNKNOWN — no project→site map)
//
// Any mandatory FAIL => VERIFICATION_FAILED. Any mandatory UNKNOWN =>
// VERIFICATION_INCOMPLETE. Only all-mandatory-PASS transitions to VERIFIED via
// the service_role-only deployment_complete_verification RPC.
//
// Body : { deploymentId }
// Output: { code: 'OK', data: { deploymentId, snapshot } } or { code, message }
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const FRESH_MS = 24 * 60 * 60 * 1000;

type Result = "PASS" | "FAIL" | "WARNING" | "UNKNOWN" | "NOT_REQUIRED";
interface Check {
  key: string;
  label: string;
  result: Result;
  source: string;
  source_timestamp: string | null;
  freshness: "fresh" | "stale" | "none" | "n/a";
  reason: string;
}

function freshness(iso: string | null | undefined): "fresh" | "stale" | "none" {
  if (!iso) return "none";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "none";
  return Date.now() - t > FRESH_MS ? "stale" : "fresh";
}

function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return s !== "resolved" && s !== "closed";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ code: "InternalError", message: "Missing service configuration" }, 500);
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Authenticate + authorize (owner/admin).
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ code: "Unauthorized", message: "Missing authentication token" }, 401);
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(jwt);
    if (userErr || !user) {
      return json({ code: "Unauthorized", message: "Invalid or expired token" }, 401);
    }
    const { data: roleRow } = await admin
      .from("internal_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!roleRow || (roleRow.role !== "owner" && roleRow.role !== "admin")) {
      return json({ code: "Forbidden", message: "Insufficient permission to run verification" }, 403);
    }

    // 2. Parse input.
    let body: { deploymentId?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ code: "BadRequest", message: "Invalid JSON body" }, 400);
    }
    const deploymentId = String(body.deploymentId ?? "").trim();
    if (!deploymentId) {
      return json({ code: "BadRequest", message: "deploymentId is required" }, 400);
    }

    // 3. Load the deployment + project + integration server-side.
    const { data: deployment } = await admin
      .from("internal_project_deployments")
      .select("*")
      .eq("id", deploymentId)
      .maybeSingle();
    if (!deployment) {
      return json({ code: "INVALID_DEPLOYMENT_STATE", message: "Deployment record not found" }, 200);
    }

    const projectId = Number(deployment.project_id);
    const { data: project } = await admin
      .from("internal_projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    const { data: integration } = await admin
      .from("internal_project_integrations")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    const checks: Check[] = [];

    // ── Check A: deployment state ──────────────────────────────────────────
    const stateResult: Result = deployment.status === "VERIFYING" ? "PASS" : "FAIL";
    checks.push({
      key: "deployment-state",
      label: "Deployment State = Verifying",
      result: stateResult,
      source: "internal_project_deployments",
      source_timestamp: deployment.updated_at ?? null,
      freshness: "n/a",
      reason: stateResult === "PASS" ? "Deployment is in the VERIFYING state" : `Deployment is in state ${deployment.status}`,
    });

    // ── Check B: project relationship valid ────────────────────────────────
    checks.push({
      key: "project-valid",
      label: "Project Relationship Valid",
      result: project ? "PASS" : "FAIL",
      source: "internal_projects",
      source_timestamp: project?.updated_at ?? null,
      freshness: "n/a",
      reason: project ? "Project exists" : "Project not found",
    });

    // ── Check C: approved SHA = deployed SHA ───────────────────────────────
    const githubSha = String(deployment.github_sha ?? "");
    const deployedSha = String(deployment.deployed_sha ?? "");
    let shaResult: Result;
    let shaReason: string;
    if (!deployedSha) {
      shaResult = "UNKNOWN";
      shaReason = "Actual deployed SHA not recorded";
    } else if (githubSha && deployedSha === githubSha) {
      shaResult = "PASS";
      shaReason = "Approved SHA matches deployed SHA";
    } else {
      shaResult = "FAIL";
      shaReason = "Deployed SHA does not match the approved SHA";
    }
    checks.push({
      key: "sha-match",
      label: "Approved SHA Deployed",
      result: shaResult,
      source: "internal_project_deployments",
      source_timestamp: deployment.completed_at ?? null,
      freshness: "n/a",
      reason: shaReason,
    });

    const isInternalTool = Boolean(project?.is_internal_tool);
    const isAiPowered = Boolean(project?.is_ai_powered);

    // ── Check D: monitoring configured where mandatory ─────────────────────
    const monitoringConfigured = Boolean(
      integration?.monitoring_provider || integration?.monitoring_target ||
      integration?.production_url || integration?.supabase_project_ref ||
      integration?.runtime_node,
    );
    const monConfigResult: Result = isInternalTool
      ? "NOT_REQUIRED"
      : monitoringConfigured
        ? "PASS"
        : "FAIL";
    checks.push({
      key: "monitoring-configured",
      label: "Monitoring Configured",
      result: monConfigResult,
      source: "internal_project_integrations",
      source_timestamp: integration?.updated_at ?? null,
      freshness: "n/a",
      reason: isInternalTool
        ? "Internal tool — monitoring not required"
        : monitoringConfigured
          ? "Monitoring mapping present"
          : "Monitoring not configured",
    });

    // ── Check E: production monitoring state (live telemetry) ──────────────
    const { data: liveSite } = await admin
      .from("internal_monitored_websites")
      .select("status, last_checked_at, website_name")
      .eq("project_id", projectId)
      .eq("environment", "live")
      .order("last_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let siteResult: Result;
    let siteReason: string;
    const siteFresh = freshness(liveSite?.last_checked_at);
    if (!liveSite) {
      siteResult = isInternalTool ? "NOT_REQUIRED" : "UNKNOWN";
      siteReason = isInternalTool ? "Internal tool — no public site" : "No live website telemetry available";
    } else if (liveSite.status === "online" && siteFresh === "fresh") {
      siteResult = "PASS";
      siteReason = "Production responding (monitored online)";
    } else if (liveSite.status === "offline" || liveSite.status === "error") {
      siteResult = "FAIL";
      siteReason = "Production confirmed down";
    } else if (liveSite.status === "slow") {
      siteResult = "WARNING";
      siteReason = "Production responding slowly";
    } else if (siteFresh === "stale") {
      siteResult = "UNKNOWN";
      siteReason = "Production telemetry is stale";
    } else {
      siteResult = "UNKNOWN";
      siteReason = "Production state unknown";
    }
    checks.push({
      key: "production-monitoring-state",
      label: "Production Monitoring State",
      result: siteResult,
      source: "internal_monitored_websites",
      source_timestamp: liveSite?.last_checked_at ?? null,
      freshness: siteFresh,
      reason: siteReason,
    });

    // ── Check F: no critical operational alerts ────────────────────────────
    const { data: alerts, error: alertsErr } = await admin
      .from("internal_monitoring_alerts")
      .select("id, severity, status")
      .eq("project_id", projectId);
    const { data: incidents } = await admin
      .from("internal_monitoring_incidents")
      .select("id, severity, status")
      .eq("project_id", projectId);

    let alertResult: Result;
    let alertReason: string;
    if (alertsErr) {
      alertResult = "UNKNOWN";
      alertReason = "Alert query failed — cannot confirm zero critical alerts";
    } else {
      const criticalAlerts = (alerts ?? []).filter(
        (a) => isActiveStatus(a.status) && String(a.severity).toLowerCase() === "critical",
      );
      const criticalIncidents = (incidents ?? []).filter(
        (i) => isActiveStatus(i.status) && String(i.severity).toLowerCase() === "critical",
      );
      const criticalCount = criticalAlerts.length + criticalIncidents.length;
      if (criticalCount > 0) {
        alertResult = "FAIL";
        alertReason = `${criticalCount} active critical alert/incident`;
      } else {
        alertResult = "PASS";
        alertReason = "No active critical operational alerts";
      }
    }
    checks.push({
      key: "critical-alerts",
      label: "No Critical Operational Alerts",
      result: alertResult,
      source: "internal_monitoring_alerts",
      source_timestamp: null,
      freshness: "n/a",
      reason: alertReason,
    });

    // ── Check G: backend / database health ─────────────────────────────────
    const { data: supabaseMonitor } = await admin
      .from("internal_supabase_monitors")
      .select("database_status, last_checked_at, database_last_heartbeat_at")
      .eq("project_id", projectId)
      .order("last_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let backendResult: Result;
    let backendReason: string;
    let backendTs: string | null = null;
    let backendFresh: "fresh" | "stale" | "none" | "n/a" = "n/a";
    if (!supabaseMonitor) {
      backendResult = integration?.supabase_project_ref ? "UNKNOWN" : "NOT_REQUIRED";
      backendReason = integration?.supabase_project_ref
        ? "Backend mapped — no live telemetry available"
        : "No backend mapping";
    } else {
      const db = String(supabaseMonitor.database_status ?? "");
      backendTs = supabaseMonitor.database_last_heartbeat_at ?? supabaseMonitor.last_checked_at ?? null;
      backendFresh = freshness(backendTs);
      if (db === "failed") {
        backendResult = "FAIL";
        backendReason = "Backend confirmed failed";
      } else if (db === "warning") {
        backendResult = "WARNING";
        backendReason = "Backend degraded";
      } else if (db === "healthy" && backendFresh === "fresh") {
        backendResult = "PASS";
        backendReason = "Backend healthy";
      } else if (backendFresh === "stale") {
        backendResult = "UNKNOWN";
        backendReason = "Backend telemetry is stale";
      } else {
        backendResult = "UNKNOWN";
        backendReason = "Backend state unknown";
      }
    }
    checks.push({
      key: "backend-health",
      label: "Backend / Database Reachable",
      result: backendResult,
      source: "internal_supabase_monitors",
      source_timestamp: backendTs,
      freshness: backendFresh,
      reason: backendReason,
    });

    // ── Check H: runtime health where required ─────────────────────────────
    const runtimeNode = String(integration?.runtime_node ?? "").trim();
    let runtimeResult: Result;
    let runtimeReason: string;
    let runtimeTs: string | null = null;
    let runtimeFresh: "fresh" | "stale" | "none" | "n/a" = "n/a";
    if (!runtimeNode) {
      runtimeResult = "NOT_REQUIRED";
      runtimeReason = "No runtime dependency";
    } else {
      const { data: runtimeNodeRow } = await admin
        .from("ai_runtime_bridge_nodes")
        .select("node_key, name, status, last_heartbeat_at, last_seen_at")
        .or(`node_key.eq.${runtimeNode},name.eq.${runtimeNode}`)
        .limit(1)
        .maybeSingle();
      if (!runtimeNodeRow) {
        runtimeResult = "UNKNOWN";
        runtimeReason = "Runtime node mapped — no live telemetry";
      } else {
        runtimeTs = runtimeNodeRow.last_heartbeat_at ?? runtimeNodeRow.last_seen_at ?? null;
        runtimeFresh = freshness(runtimeTs);
        const st = String(runtimeNodeRow.status ?? "").toLowerCase();
        if ((st === "online" || st === "healthy") && runtimeFresh === "fresh") {
          runtimeResult = "PASS";
          runtimeReason = "Runtime online";
        } else if (st === "offline") {
          runtimeResult = "FAIL";
          runtimeReason = "Runtime offline";
        } else if (runtimeFresh === "stale") {
          runtimeResult = "UNKNOWN";
          runtimeReason = "Runtime telemetry is stale";
        } else {
          runtimeResult = "UNKNOWN";
          runtimeReason = "Runtime state unknown";
        }
      }
    }
    checks.push({
      key: "runtime-health",
      label: "Required Runtime Online",
      result: runtimeResult,
      source: "ai_runtime_bridge_nodes",
      source_timestamp: runtimeTs,
      freshness: runtimeFresh,
      reason: runtimeReason,
    });

    // ── Check I: AI state where AI-powered ─────────────────────────────────
    const aiResult: Result = isAiPowered ? "UNKNOWN" : "NOT_REQUIRED";
    checks.push({
      key: "ai-state",
      label: "AI Operations Available",
      result: aiResult,
      source: "ai_sites",
      source_timestamp: null,
      freshness: "n/a",
      reason: isAiPowered
        ? "AI runtime state not project-scoped"
        : "Project not AI-powered",
    });

    // ── Overall decision (fail closed) ─────────────────────────────────────
    const mandatory = checks.filter((c) => c.result !== "NOT_REQUIRED");
    const hasFail = mandatory.some((c) => c.result === "FAIL");
    const hasUnknown = mandatory.some((c) => c.result === "UNKNOWN");
    const overall: "PASS" | "FAIL" | "INCOMPLETE" = hasFail
      ? "FAIL"
      : hasUnknown
        ? "INCOMPLETE"
        : "PASS";

    const snapshot = {
      snapshot_version: "2",
      generated_by: "server",
      authoritative: true,
      overall,
      verified_sha: deployedSha,
      approved_sha: githubSha,
      generated_at: new Date().toISOString(),
      checks,
    };

    if (overall !== "PASS") {
      const action = overall === "FAIL" ? "Production verification failed" : "Production verification incomplete";
      await admin.from("internal_activity_log").insert({
        entity_type: "project",
        entity_id: projectId,
        action,
        description: `${action} for project ${projectId}: ${overall}.`,
      }).then(() => {}, () => {});
      return json({
        code: overall === "FAIL" ? "VERIFICATION_FAILED" : "VERIFICATION_INCOMPLETE",
        message: overall === "FAIL"
          ? "One or more mandatory checks failed."
          : "Mandatory checks have unknown or stale evidence.",
        data: { snapshot },
      }, 200);
    }

    // ── All mandatory PASS — transition via the service_role-only RPC ──────
    const { error: rpcErr } = await admin.rpc("deployment_complete_verification", {
      p_deployment_id: deploymentId,
      p_snapshot: snapshot,
    });
    if (rpcErr) {
      const msg = String(rpcErr?.message ?? "");
      if (msg.includes("VERIFICATION_FAILED")) {
        return json({ code: "VERIFICATION_FAILED", message: "One or more mandatory checks failed." }, 200);
      }
      if (msg.includes("VERIFICATION_INCOMPLETE")) {
        return json({ code: "VERIFICATION_INCOMPLETE", message: "Mandatory checks have unknown evidence." }, 200);
      }
      return json({ code: "InternalError", message: msg || "Failed to verify deployment" }, 200);
    }

    return json({ code: "OK", data: { deploymentId, snapshot } }, 200);
  } catch (err) {
    return json({ code: "InternalError", message: err instanceof Error ? err.message : "Internal error" }, 200);
  }
});
