import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// github-head-sha — authoritative server-side GitHub HEAD SHA resolver.
// ============================================================================
// Returns the current commit SHA for a repository + branch, resolved server-side
// using GITHUB_ACCESS_TOKEN (Supabase secret storage). The token is never
// returned, logged or exposed to the browser.
//
// This function is a reusable resolver. The authoritative deployment gate
// (`deployment-start`) performs its own resolution inline so the deploy
// decision is atomic and cannot be split across a second network hop.
//
// Input : { owner, repo, branch? }  (branch optional -> repo default branch)
// Output: { code: 'OK', data: { sha, owner, repo, branch } }
//         or { code: 'SHA_VERIFICATION_UNAVAILABLE', message }
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
      return json({ code: "InternalError", message: "GitHub token is not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
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

    let body: { owner?: unknown; repo?: unknown; branch?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ code: "BadRequest", message: "Invalid JSON body" }, 400);
    }
    const owner = String(body.owner ?? "").trim();
    const repo = String(body.repo ?? "").trim();
    if (!owner || !repo) {
      return json({ code: "BadRequest", message: "owner and repo are required" }, 400);
    }
    const requestedBranch = String(body.branch ?? "").trim();

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

    let branch = requestedBranch;
    if (!branch) {
      const repoInfo = await gh(`/repos/${owner}/${repo}`);
      branch = repoInfo?.default_branch ?? "";
    }
    if (!branch) {
      return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "Could not resolve the repository branch" }, 200);
    }

    const commit = await gh(`/repos/${owner}/${repo}/commits/${branch}`);
    const sha = typeof commit?.sha === "string" ? commit.sha : "";
    if (!sha) {
      return json({ code: "SHA_VERIFICATION_UNAVAILABLE", message: "GitHub did not return a commit SHA" }, 200);
    }

    return json({ code: "OK", data: { sha, owner, repo, branch } }, 200);
  } catch (err) {
    return json({
      code: "SHA_VERIFICATION_UNAVAILABLE",
      message: "GitHub could not be queried",
    }, 200);
  }
});
