import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// deployment-start — authoritative server-side deployment start gate.
// ============================================================================
// DFP COMMAND 18F2 — closes the P1 "browser-supplied head SHA" trust boundary.
//
// The browser sends ONLY the deployment intent (project id + launch approval id
// + bookkeeping). The current repository HEAD SHA is resolved SERVER-SIDE from
// the canonical integration record + GitHub (GITHUB_ACCESS_TOKEN secret), then
// compared against the approved launch SHA. The browser has no input capable of
// changing the authoritative GitHub result.
//
// Failure codes (fail closed, never fall back to client SHA / cached UI / LKG):
//   SHA_VERIFICATION_UNAVAILABLE  — GitHub could not be queried / no repo mapped
//   SHA_DRIFT                     — HEAD has moved since launch approval
//   APPROVAL_REQUIRED / APPROVAL_INVALID / DEPLOYMENT_ALREADY_ACTIVE / ...
//
// Body : { projectId, launchApprovalId, lastKnownGoodSha, productionUrl,
//          deploymentMethod, provider }
// Output: { code: 'OK', data: { deploymentId } } or { code, message }
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = Deno.env.get("GITHUB_ACCESS_TOKEN");
    if (!supabaseUrl || !serviceKey) {
      return json({ code: "InternalError", message: "Missing service configuration" }, 500);
    }
    if (!token) {
      return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "GitHub token is not configured" }, 200);
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
      return json({ code: "Forbidden", message: "Insufficient permission to start a deployment" }, 403);
    }

    // 2. Parse input — intent only, never a SHA claim.
    let body: {
      projectId?: unknown;
      launchApprovalId?: unknown;
      lastKnownGoodSha?: unknown;
      productionUrl?: unknown;
      deploymentMethod?: unknown;
      provider?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return json({ code: "BadRequest", message: "Invalid JSON body" }, 400);
    }
    const projectId = Number(body.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return json({ code: "BadRequest", message: "projectId must be a positive integer" }, 400);
    }
    const launchApprovalId = String(body.launchApprovalId ?? "").trim();
    if (!launchApprovalId) {
      return json({ code: "BadRequest", message: "launchApprovalId is required" }, 400);
    }

    // 3. Resolve canonical GitHub identity SERVER-SIDE (never from the browser).
    const { data: integration } = await admin
      .from("internal_project_integrations")
      .select("github_owner, github_repository, github_default_branch")
      .eq("project_id", projectId)
      .maybeSingle();
    const owner = String(integration?.github_owner ?? "").trim();
    const repo = String(integration?.github_repository ?? "").trim();
    const configuredBranch = String(integration?.github_default_branch ?? "").trim();
    if (!owner || !repo) {
      return json({
        code: "SHA_VERIFICATION_UNAVAILABLE",
        message: "GitHub repository is not configured for this project",
      }, 200);
    }

    // 4. Resolve the approved launch SHA (for comparison + drift audit).
    const { data: approval } = await admin
      .from("internal_project_launch_approvals")
      .select("github_sha, decision, project_id")
      .eq("id", launchApprovalId)
      .maybeSingle();
    if (!approval) {
      return json({ code: "APPROVAL_REQUIRED", message: "Launch approval not found" }, 200);
    }
    if (approval.decision !== "APPROVED") {
      return json({ code: "APPROVAL_REQUIRED", message: "Launch approval is not approved" }, 200);
    }
    if (approval.project_id !== projectId) {
      return json({ code: "APPROVAL_INVALID", message: "Launch approval does not belong to this project" }, 200);
    }
    const approvedSha = String(approval.github_sha ?? "").trim();
    if (!approvedSha) {
      return json({ code: "APPROVAL_INVALID", message: "Launch approval has no approved SHA" }, 200);
    }

    // 5. Resolve current HEAD SERVER-SIDE via GitHub.
    const gh = async (path: string) => {
      const res = await fetch(`https://api.github.com${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "dfp-command",
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${text.slice(0, 160)}`);
      }
      return res.json();
    };

    let headSha = "";
    try {
      let branch = configuredBranch;
      if (!branch) {
        const repoInfo = await gh(`/repos/${owner}/${repo}`);
        branch = repoInfo?.default_branch ?? "";
      }
      if (!branch) {
        return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "Could not resolve the repository branch" }, 200);
      }
      const commit = await gh(`/repos/${owner}/${repo}/commits/${branch}`);
      headSha = typeof commit?.sha === "string" ? commit.sha : "";
    } catch {
      return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "GitHub could not be queried" }, 200);
    }
    if (!headSha) {
      return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "GitHub did not return a commit SHA" }, 200);
    }

    // 6. Authoritative SHA comparison — fail closed, never fall back.
    if (headSha !== approvedSha) {
      await admin.from("internal_activity_log").insert({
        entity_type: "project",
        entity_id: projectId,
        action: "SHA drift detected",
        description: `Deployment blocked for project ${projectId}: GitHub HEAD differs from the approved SHA.`,
      }).then(() => {}, () => {});
      return json({
        code: "SHA_DRIFT",
        message: "The repository HEAD has moved since launch approval. A new launch evaluation is required.",
      }, 200);
    }

    // 7. Consume trusted evidence via the service_role-only RPC.
    const { data: rpcData, error: rpcErr } = await admin.rpc("deployment_start", {
      p_project_id: projectId,
      p_launch_approval_id: launchApprovalId,
      p_head_sha: headSha,
      p_last_known_good_sha: body.lastKnownGoodSha ?? null,
      p_production_url: body.productionUrl ?? null,
      p_deployment_method: body.deploymentMethod ?? null,
      p_provider: body.provider ?? null,
    });
    if (rpcErr) {
      const msg = String(rpcErr?.message ?? "");
      if (msg.includes("SHA_DRIFT")) {
        return json({ code: "SHA_DRIFT", message: "The repository HEAD has moved since launch approval." }, 200);
      }
      if (msg.includes("SHA_VERIFICATION_UNAVAILABLE")) {
        return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "GitHub could not be queried." }, 200);
      }
      if (msg.includes("DEPLOYMENT_ALREADY_ACTIVE")) {
        return json({ code: "DEPLOYMENT_ALREADY_ACTIVE", message: "A production deployment or rollback is already in progress." }, 200);
      }
      return json({ code: "InternalError", message: msg || "Failed to start deployment" }, 200);
    }

    return json({ code: "OK", data: { deploymentId: rpcData } }, 200);
  } catch (err) {
    return json({ code: "InternalError", message: err instanceof Error ? err.message : "Internal error" }, 200);
  }
});
