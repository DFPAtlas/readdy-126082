import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decode64(content: string): string {
  try {
    const cleaned = content.replace(/\n/g, "").replace(/\r/g, "");
    return atob(cleaned);
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("GITHUB_ACCESS_TOKEN");
  if (!token) {
    return new Response(
      JSON.stringify({ error: "GitHub token is not configured." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const gh = async (path: string) => {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
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

    // Deduplicate repos by id across all sources.
    const seen = new Map<number, any>();
    const addRepos = (list: any[]) => {
      for (const r of list) {
        if (r && typeof r.id === "number") seen.set(r.id, r);
      }
    };

    // 1. Personal + collaborator + org-member repos (best-effort).
    let page = 1;
    while (page <= 10) {
      const data = await gh(
        `/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=${page}&sort=created`,
      );
      addRepos(data);
      if (data.length < 100) break;
      page++;
    }

    // 2. Explicitly enumerate every organisation the token belongs to (e.g. DFPAtlas).
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

    // "Empty" candidates: size === 0 (no tracked files at all).
    const candidates = allRepos.filter((r) => (r.size ?? 0) === 0);

    const results = [];
    for (const r of candidates) {
      const repoName = r.name;
      // Use the repo's real owner (org or user), not the authenticated login.
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

    return new Response(
      JSON.stringify({
        owner: userLogin,
        orgs: orgLogins,
        total_repos: allRepos.length,
        empty_repo_count: candidates.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
