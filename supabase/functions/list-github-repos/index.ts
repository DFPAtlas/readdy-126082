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

  try {
    const allRepos: any[] = [];
    let page = 1;

    while (page <= 10) {
      const url =
        `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=${page}&sort=updated`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "readdy-command-centre",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        return new Response(
          JSON.stringify({ error: `GitHub API error ${res.status}: ${text}` }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await res.json();
      allRepos.push(...data);
      if (data.length < 100) break;
      page++;
    }

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
      updated_at: r.updated_at,
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
