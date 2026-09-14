import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      throw new Error(`GitHub API error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  };

  try {
    const seen = new Map<number, any>();
    const addRepos = (list: any[]) => {
      for (const r of list) {
        if (r && typeof r.id === "number") seen.set(r.id, r);
      }
    };

    // Personal + collaborator + org-member repos.
    let page = 1;
    while (page <= 10) {
      const data = await gh(
        `/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=${page}&sort=updated`,
      );
      addRepos(data);
      if (data.length < 100) break;
      page++;
    }

    // Enumerate every organisation the token belongs to (e.g. DFPAtlas).
    let orgs: any[] = [];
    try {
      orgs = await gh("/user/orgs?per_page=100");
    } catch {
      orgs = [];
    }

    for (const org of orgs) {
      if (!org || !org.login) continue;
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

    const repos = allRepos.map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      fork: r.fork,
      private: r.private,
      archived: r.archived,
      updated_at: r.updated_at,
      pushed_at: r.pushed_at,
      created_at: r.created_at,
      topics: r.topics ?? [],
      default_branch: r.default_branch,
    }));

    return new Response(JSON.stringify({ repos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
