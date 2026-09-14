import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

// Reads private repo contents — owner/admin only.
const ALLOWED_ROLES = ["owner", "admin"];

function decode64(content: string): string {
  try {
    const cleaned = content.replace(/\n/g, "").replace(/\r/g, "");
    return atob(cleaned);
  } catch {
    return "";
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ---- Auth gate: resolve caller from JWT, require an active owner/admin ----
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing authentication token" }, 401);

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return json({ error: "Invalid or expired token" }, 401);

  const { data: roleRow } = await supabaseAdmin
    .from("internal_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!roleRow || !ALLOWED_ROLES.includes(roleRow.role)) {
    return json({ error: "Forbidden" }, 403);
  }
  // ---- end auth gate ----

  const ghToken = Deno.env.get("GITHUB_ACCESS_TOKEN");
  if (!ghToken) {
    return json({ error: "GitHub token is not configured." }, 500);
  }

  const gh = async (path: string) => {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "readdy-command-centre",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status} for ${path}: ${text.slice(0, 200)}`);
    }
    return res.json();
  };

  try {
    const user = await gh("/user");
    const userLogin = user.login;

    const seen = new Map<number, any>();
    const addRepos = (list: any[]) => {
      for (const r of list) {
        if (r && typeof r.id === "number") seen.set(r.id, r);
      }
    };

    let page = 1;
    while (page <= 10) {
      const data = await gh(
        `/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=${page}&sort=created`,
      );
      addRepos(data);
      if (data.length < 100) break;
      page++;
    }

    let orgs: any[] = [];
    try {
      orgs = await gh("/user/orgs?per_page=100");
    } catch {
      orgs = [];
    }

    const orgLogins: string[] = [];
    for (const org of orgs) {
      if (!org || !org.login) continue;
      orgLogins.push(org.login);
      let p = 1;
      while (p <= 10) {
        try {
          const data = await gh(`/orgs/${org.login}/repos?type=all&per_page=100&page=${p}`);
          addRepos(data);
          if (data.length < 100) break;
        } catch {
          break;
        }
        p++;
      }
    }

    const allRepos = Array.from(seen.values());

    const candidates = allRepos.filter((r) => (r.size ?? 0) === 0);

    const results = [];
    for (const r of candidates) {
      const repoName = r.name;
      const repoOwner = r.owner?.login ?? userLogin;
      const branch = r.default_branch || "main";

      let commitMessage: string | null = null;
      let commitCount = 0;
      let files: string[] = [];
      let readme: string | null = null;
      let packageName: string | null = null;
      let htmlTitle: string | null = null;

      try {
        const commits = await gh(`/repos/${repoOwner}/${repoName}/commits?per_page=100`);
        commitCount = Array.isArray(commits) ? commits.length : 0;
        if (Array.isArray(commits) && commits.length > 0) {
          commitMessage = commits[commits.length - 1]?.commit?.message ?? null;
        }
      } catch {
        // repo may have no commits or be inaccessible
      }

      try {
        const tree = await gh(`/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`);
        files = Array.isArray(tree.tree) ? tree.tree.map((t: any) => t.path) : [];
      } catch {
        // no tree
      }

      const readmePath =
        files.find((f) => f.toLowerCase() === "readme.md") ??
        files.find((f) => f.toLowerCase() === "readme");

      if (readmePath) {
        try {
          const content = await gh(`/repos/${repoOwner}/${repoName}/contents/${readmePath}`);
          readme = decode64(content.content);
        } catch {
          // ignore
        }
      }

      const pkgPath = files.find((f) => f.toLowerCase() === "package.json");
      if (pkgPath) {
        try {
          const content = await gh(`/repos/${repoOwner}/${repoName}/contents/${pkgPath}`);
          const parsed = JSON.parse(decode64(content.content));
          packageName = parsed.name ?? null;
        } catch {
          // ignore
        }
      }

      const htmlPath = files.find((f) => f.toLowerCase() === "index.html");
      if (htmlPath) {
        try {
          const content = await gh(`/repos/${repoOwner}/${repoName}/contents/${htmlPath}`);
          const html = decode64(content.content);
          const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          htmlTitle = m ? m[1].trim() : null;
        } catch {
          // ignore
        }
      }

      results.push({
        full_name: r.full_name ?? `${repoOwner}/${repoName}`,
        owner: repoOwner,
        repo: repoName,
        created_at: r.created_at,
        updated_at: r.updated_at,
        size_kb: r.size ?? 0,
        default_branch: branch,
        commit_count: commitCount,
        initial_commit_message: commitMessage,
        file_count: files.length,
        files: files.slice(0, 100),
        readme,
        package_name: packageName,
        html_title: htmlTitle,
      });
    }

    return json(
      {
        owner: userLogin,
        orgs: orgLogins,
        total_repos: allRepos.length,
        empty_repo_count: candidates.length,
        results,
      },
      200,
    );
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
