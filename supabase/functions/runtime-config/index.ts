import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-config — safe server-side configuration-readiness check for DFP AI
// Operations (Phase 3 Prompt 03).
//
// SECRET-PRESENCE ONLY. This function tests whether expected server-side
// configuration names are present (configured = true/false) and NEVER returns
// secret values, partial values, prefixes, suffixes, lengths, or a raw
// environment dump. Only an explicit allowlist of configuration names may be
// tested — no arbitrary secret name, and no arbitrary URL (SSRF-safe).
//
// Configuration verification only. Never executes agents, triggers n8n,
// performs model inference, sends email, creates financial objects, or writes
// to GitHub. Secrets are read via Deno.env server-side only.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Allowlisted configuration spec per system. `required` names are checked for
// presence only (never values). `safeTest` indicates whether the runtime-health
// layer has a safe non-invasive adapter; systems without one are never probed.
const CONFIG_SPECS: Record<
  string,
  { required: string[]; safeTest: boolean; blocker: string | null }
> = {
  supabase: { required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], safeTest: true, blocker: null },
  n8n: { required: ["N8N_URL", "N8N_API_KEY"], safeTest: true, blocker: null },
  ollama: { required: ["OLLAMA_URL"], safeTest: true, blocker: null },
  openai: { required: ["OPENAI_API_KEY"], safeTest: true, blocker: null },
  anthropic: { required: ["ANTHROPIC_API_KEY"], safeTest: true, blocker: null },
  resend: { required: ["RESEND_API_KEY"], safeTest: true, blocker: null },
  stripe: { required: ["STRIPE_SECRET_KEY"], safeTest: true, blocker: null },
  github: { required: ["GITHUB_TOKEN"], safeTest: true, blocker: null },
  scheduler: { required: ["DFP_SCHEDULER_SECRET"], safeTest: false, blocker: "Scheduler token handshake is not yet verified." },
  readdy: { required: [], safeTest: false, blocker: "No safe read-only programmatic health check exists." },
  monitoring: { required: [], safeTest: false, blocker: "No monitoring runtime provider is connected." },
  notifications: { required: [], safeTest: false, blocker: "No notification runtime provider is connected." },
  site_api: { required: [], safeTest: false, blocker: "No approved per-site health endpoint configured." },
};

interface ConfigResult {
  systemSlug: string;
  requiredConfig: string[];
  configured: boolean;
  presentConfig: string[];
  missingConfig: string[];
  safeTestSupported: boolean;
  blocker: string | null;
  lastChecked: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function secretPresent(name: string): boolean {
  return (Deno.env.get(name) ?? "").trim().length > 0;
}

function buildConfigInventory(): ConfigResult[] {
  const now = new Date().toISOString();
  const out: ConfigResult[] = [];
  for (const [slug, spec] of Object.entries(CONFIG_SPECS)) {
    const present: string[] = [];
    const missing: string[] = [];
    if (slug === "scheduler") {
      // Scheduler token may be stored under either name.
      if (secretPresent("DFP_SCHEDULER_SECRET") || secretPresent("dfp_scheduler_secret")) {
        present.push("DFP_SCHEDULER_SECRET");
      } else {
        missing.push("DFP_SCHEDULER_SECRET");
      }
    } else {
      for (const name of spec.required) {
        if (secretPresent(name)) present.push(name);
        else missing.push(name);
      }
    }
    out.push({
      systemSlug: slug,
      requiredConfig: [...spec.required],
      configured: missing.length === 0,
      presentConfig: present,
      missingConfig: missing,
      safeTestSupported: spec.safeTest,
      blocker: spec.safeTest ? null : spec.blocker,
      lastChecked: now,
    });
  }
  return out;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: role } = await userClient.rpc("internal_role");
  if (!role) {
    return json({ error: "Internal staff access required." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const inventory = buildConfigInventory();

  // Audit the configuration check (no secret values, no per-name noise).
  await admin.from("ai_audit_events").insert({
    audit_key: `CFG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    occurred_at: new Date().toISOString(),
    event_type: "runtime_configuration_check",
    action: "runtime_configuration_check",
    outcome: "informational",
    severity: "low",
    actor_type: "human",
    actor_reference: user.email ?? user.id,
    trigger_source: "manual",
    environment: "production",
    notes: `Configuration presence checked for ${inventory.length} allowlisted systems (values never exposed).`,
  });

  return json({ config: inventory });
});
