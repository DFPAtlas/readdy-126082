import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// n8n-runtime-connector — read-only / DRY-RUN n8n metadata adapter for DFP AI
// Operations (Phase 3 Prompt 06).
//
// This is NOT the execution gateway. It is a server-side n8n metadata adapter
// that sits behind the trusted runtime gateway. It may verify connectivity,
// authenticate, discover workflow metadata, maintain the approved workflow
// allowlist, validate mappings, and produce a DISPATCH PREVIEW — but it NEVER:
//   * executes an n8n workflow
//   * calls a production webhook (POST)
//   * activates/deactivates/edits/creates/deletes workflows
//   * changes credentials
//
// SECURITY:
//   * verify_jwt = true → only authenticated users reach this.
//   * internal_role() IS NOT NULL → only internal staff.
//   * N8N_URL / N8N_API_KEY are read via Deno.env server-side only and NEVER
//     returned to the browser (no credential, auth header, partial value, or
//     raw env dump).
//   * Only read-only n8n API GET metadata endpoints are used (no POST/PATCH/
//     PUT/DELETE). Full workflow JSON (nodes/connections/credentials/expressions)
//     is NEVER returned — only sanitised metadata.
//   * Only an allowlisted set of operations is accepted; arbitrary API paths and
//     arbitrary URLs are impossible.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIMEOUT_MS = 8000;

const ALLOWED_OPERATIONS = new Set([
  "status",
  "list_workflows",
  "inspect_workflow",
  "validate_mapping",
  "dispatch_preview",
]);

const ALLOWED_REQUEST_TYPES = new Set([
  "evaluate_orchestration",
  "request_agent_run",
  "scheduled_agent_run",
  "retry_run",
  "remediation_request",
]);

const RED_NODE_HINTS = [
  "stripe", "paypal", "billing", "payment", "delete", "remove", "destroy",
  "deploy", "terraform", "auth", "credential", "secret", "security",
  "user.delete", "database.delete", "github", "gitlab",
];
const AMBER_NODE_HINTS = [
  "write", "insert", "update", "postgres", "database", "mysql", "email",
  "send", "httpRequest", "webhook", "slack", "notify", "telegram", "discord",
  "s3", "storage", "ftp", "ssh",
];

interface Json { [k: string]: unknown; }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- Sanitisation -------------------------------------------------------------

function extractNodeMeta(nodes: unknown): { nodeCount: number; nodeTypes: string[]; triggers: string[] } {
  const list = Array.isArray(nodes) ? (nodes as Json[]) : [];
  const nodeTypes: string[] = [];
  const triggers: string[] = [];
  for (const n of list) {
    const t = typeof n?.type === "string" ? (n.type as string) : "";
    if (t) nodeTypes.push(t);
    if (
      t === "n8n-nodes-base.webhook" ||
      t === "n8n-nodes-base.scheduleTrigger" ||
      t === "n8n-nodes-base.manualTrigger" ||
      t === "n8n-nodes-base.cron" ||
      t === "n8n-nodes-base.formTrigger"
    ) {
      triggers.push(t);
    }
  }
  return { nodeCount: list.length, nodeTypes, triggers };
}

function classifyRisk(nodeTypes: string[], triggerTypes: string[]): "green" | "amber" | "red" {
  const joined = [...nodeTypes, ...triggerTypes].join(" ").toLowerCase();
  if (RED_NODE_HINTS.some((h) => joined.includes(h.toLowerCase()))) return "red";
  if (AMBER_NODE_HINTS.some((h) => joined.includes(h.toLowerCase()))) return "amber";
  if (nodeTypes.length === 0) return "red"; // unknown → red pending review
  return "green";
}

function sanitiseWorkflow(w: Json | null | undefined): Json | null {
  if (!w) return null;
  const meta = extractNodeMeta(w.nodes);
  const triggers = meta.triggers.length > 0
    ? meta.triggers.map((t) => t.replace("n8n-nodes-base.", ""))
    : ["manual"];
  return {
    id: typeof w.id === "string" ? w.id : String(w.id ?? ""),
    name: typeof w.name === "string" ? w.name : "",
    active: w.active === true,
    tags: Array.isArray(w.tags)
      ? (w.tags as Json[]).filter((t) => typeof t?.name === "string").map((t) => t.name as string)
      : [],
    updatedAt: typeof w.updatedAt === "string" ? w.updatedAt : null,
    nodeCount: meta.nodeCount,
    triggers,
    hasWebhook: meta.triggers.some((t) => t.includes("webhook")),
    hasSchedule: meta.triggers.some((t) => t.includes("schedule") || t.includes("cron")),
    risk: classifyRisk(meta.nodeTypes, meta.triggers),
  };
}

// --- n8n read-only API calls --------------------------------------------------

interface N8nState {
  configured: boolean;
  reachable: boolean;
  authenticated: boolean | null;
  error: string | null;
}

async function getN8nState(): Promise<N8nState> {
  const url = (Deno.env.get("N8N_URL") ?? "").trim();
  const apiKey = (Deno.env.get("N8N_API_KEY") ?? "").trim();
  if (!url || !apiKey) {
    return { configured: false, reachable: false, authenticated: null, error: "n8n runtime is not configured (missing N8N_URL or N8N_API_KEY)." };
  }
  const endpoint = url.replace(/\/+$/, "") + "/healthz";
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: { "X-N8N-API-KEY": apiKey },
    }, TIMEOUT_MS);
    if (res.ok) return { configured: true, reachable: true, authenticated: true, error: null };
    if (res.status === 401 || res.status === 403) return { configured: true, reachable: true, authenticated: false, error: "n8n rejected the API key (authentication failed)." };
    return { configured: true, reachable: false, authenticated: null, error: `n8n responded with status ${res.status}.` };
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === "AbortError") return { configured: true, reachable: false, authenticated: null, error: "n8n did not respond within the time limit." };
    return { configured: true, reachable: false, authenticated: null, error: "n8n could not be reached from the cloud Edge runtime (may be private/Tailscale-only)." };
  }
}

async function listWorkflowsSanitised(): Promise<{ ok: boolean; workflows: Json[]; error: string | null }> {
  const url = (Deno.env.get("N8N_URL") ?? "").trim();
  const apiKey = (Deno.env.get("N8N_API_KEY") ?? "").trim();
  if (!url || !apiKey) return { ok: false, workflows: [], error: "n8n not configured." };
  try {
    const res = await fetchWithTimeout(url.replace(/\/+$/, "") + "/api/v1/workflows", {
      method: "GET",
      headers: { "X-N8N-API-KEY": apiKey },
    }, TIMEOUT_MS);
    if (!res.ok) return { ok: false, workflows: [], error: `n8n responded with status ${res.status}.` };
    const payload = await res.json();
    const raw = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const workflows = (raw as Json[]).map(sanitiseWorkflow).filter((w): w is Json => w !== null);
    return { ok: true, workflows, error: null };
  } catch {
    return { ok: false, workflows: [], error: "n8n could not be reached from the cloud Edge runtime." };
  }
}

async function getWorkflowSanitised(id: string): Promise<{ ok: boolean; workflow: Json | null; error: string | null }> {
  const url = (Deno.env.get("N8N_URL") ?? "").trim();
  const apiKey = (Deno.env.get("N8N_API_KEY") ?? "").trim();
  if (!url || !apiKey) return { ok: false, workflow: null, error: "n8n not configured." };
  try {
    const res = await fetchWithTimeout(url.replace(/\/+$/, "") + `/api/v1/workflows/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "X-N8N-API-KEY": apiKey },
    }, TIMEOUT_MS);
    if (res.status === 404) return { ok: false, workflow: null, error: "Workflow not found in n8n (may have been deleted)." };
    if (!res.ok) return { ok: false, workflow: null, error: `n8n responded with status ${res.status}.` };
    const payload = await res.json();
    const w = sanitiseWorkflow(payload?.data ?? payload);
    return { ok: true, workflow: w, error: null };
  } catch {
    return { ok: false, workflow: null, error: "n8n could not be reached from the cloud Edge runtime." };
  }
}

// --- Server-side authoritative state (reuse, never a weaker engine) ----------

async function loadControls(admin: ReturnType<typeof createClient>) {
  const { data: masterRows } = await admin.from("ai_runtime_controls").select("*").eq("control_type", "master_kill_switch").limit(1);
  const master = masterRows && masterRows.length > 0 ? masterRows[0] : null;
  const { data: riskRows } = await admin.from("ai_runtime_controls").select("*").eq("control_type", "risk_gate").limit(1);
  const risk = riskRows && riskRows.length > 0 ? riskRows[0] : null;
  return { master, risk };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: role } = await userClient.rpc("internal_role");
  if (!role) return json({ error: "Internal staff access required." }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const operation = typeof body.operation === "string" ? body.operation : "";
  if (!ALLOWED_OPERATIONS.has(operation)) return json({ error: "Unknown or disallowed operation." }, 422);

  const actor = user.email ?? user.id;

  if (operation === "status") {
    const state = await getN8nState();
    const { data: regRows } = await admin.from("ai_n8n_workflow_registry").select("id, runtime_status").eq("execution_mode", "disabled");
    const regRowsList = regRows ?? [];
    return json({
      operation: "status",
      connection: state,
      approvedWorkflows: regRowsList.length,
      verifiedMappings: regRowsList.filter((r) => r.runtime_status === "verified").length,
      mappingsNeedingReview: regRowsList.filter((r) => r.runtime_status === "review_required").length,
      dispatchMode: "disabled",
    });
  }

  if (operation === "list_workflows") {
    const { ok, workflows, error } = await listWorkflowsSanitised();
    return json({ operation: "list_workflows", ok, workflows, error });
  }

  if (operation === "inspect_workflow") {
    const id = typeof body.n8n_workflow_id === "string" ? body.n8n_workflow_id.trim() : "";
    if (!id) return json({ error: "n8n_workflow_id is required." }, 400);
    const { ok, workflow, error } = await getWorkflowSanitised(id);
    return json({ operation: "inspect_workflow", ok, workflow, error });
  }

  if (operation === "validate_mapping") {
    const workflowKey = typeof body.workflow_key === "string" ? body.workflow_key.trim() : "";
    const n8nId = typeof body.n8n_workflow_id === "string" ? body.n8n_workflow_id.trim() : "";
    if (!workflowKey && !n8nId) return json({ error: "workflow_key or n8n_workflow_id is required." }, 400);

    const { data: regRows } = await admin.from("ai_n8n_workflow_registry").select("*").or(`workflow_key.eq.${workflowKey},n8n_workflow_id.eq.${n8nId}`).limit(1);
    const reg = regRows && regRows.length > 0 ? regRows[0] : null;
    if (!reg) return json({ error: "No approved mapping found for this workflow." }, 404);

    const { ok, workflow, error } = await getWorkflowSanitised(reg.n8n_workflow_id ?? "");
    if (!ok) {
      return json({
        operation: "validate_mapping",
        verified: false,
        driftDetected: true,
        driftReasons: [`Workflow could not be fetched from n8n (${error ?? "unreachable"}).`],
        workflow: null,
        error,
      });
    }

    const driftReasons: string[] = [];
    if ((workflow?.name ?? "") !== (reg.name ?? "")) driftReasons.push("Workflow was renamed in n8n.");
    if (typeof workflow?.nodeCount === "number" && typeof reg.node_count === "number" && Math.abs(workflow.nodeCount - reg.node_count) > 1) {
      driftReasons.push(`Node count materially changed (registry ${reg.node_count} → n8n ${workflow.nodeCount}).`);
    }
    const regTriggers: string[] = Array.isArray(reg.trigger_types) ? reg.trigger_types : [];
    const wfTriggers: string[] = Array.isArray(workflow?.triggers) ? workflow.triggers : [];
    if (JSON.stringify(regTriggers.slice().sort()) !== JSON.stringify(wfTriggers.slice().sort())) {
      driftReasons.push("Trigger type changed since last verification.");
    }

    const verified = driftReasons.length === 0;
    const now = new Date().toISOString();

    if (verified) {
      await admin.from("ai_n8n_workflow_registry").update({
        runtime_status: "verified",
        last_verified_at: now,
        last_seen_updated_at: (workflow?.updatedAt as string | null) ?? null,
        node_count: workflow?.nodeCount ?? null,
        trigger_types: workflow?.triggers ?? [],
        is_active: true,
      }).eq("id", reg.id);
      await admin.from("ai_audit_events").insert({
        audit_key: uid("N8N"),
        occurred_at: now,
        event_type: "n8n_workflow_mapping_verified",
        action: "n8n_workflow_mapping",
        outcome: "success",
        severity: "low",
        actor_type: "human",
        actor_reference: actor,
        trigger_source: "manual",
        environment: "production",
        notes: `n8n workflow mapping ${workflowKey || n8nId} verified (read-only metadata check). No workflow executed.`,
      });
    } else {
      await admin.from("ai_n8n_workflow_registry").update({
        runtime_status: "review_required",
        last_seen_updated_at: (workflow?.updatedAt as string | null) ?? null,
        node_count: workflow?.nodeCount ?? null,
        trigger_types: workflow?.triggers ?? [],
      }).eq("id", reg.id);
      await admin.from("ai_audit_events").insert({
        audit_key: uid("N8N"),
        occurred_at: now,
        event_type: "n8n_workflow_mapping_drift_detected",
        action: "n8n_workflow_mapping",
        outcome: "review_required",
        severity: "medium",
        actor_type: "human",
        actor_reference: actor,
        trigger_source: "manual",
        environment: "production",
        review_required: true,
        notes: `n8n workflow mapping ${workflowKey || n8nId} drift detected: ${driftReasons.join(" ")}. No workflow executed.`,
      });
    }

    return json({
      operation: "validate_mapping",
      verified,
      driftDetected: !verified,
      driftReasons,
      workflow,
      error: null,
    });
  }

  if (operation === "dispatch_preview") {
    const workflowKey = typeof body.workflow_key === "string" ? body.workflow_key.trim() : "";
    const requestType = typeof body.request_type === "string" ? body.request_type : "";
    const siteKey = typeof body.site_key === "string" ? body.site_key.trim() : "";
    const agentKey = typeof body.agent_key === "string" ? body.agent_key.trim() : "";
    const orchestrationKey = typeof body.orchestration_key === "string" ? body.orchestration_key.trim() : "";
    const riskLevelRaw = typeof body.risk_level === "string" ? body.risk_level : "";

    if (!workflowKey) return json({ error: "workflow_key is required." }, 400);
    if (requestType && !ALLOWED_REQUEST_TYPES.has(requestType)) return json({ error: "Unknown or disallowed request type." }, 422);

    const { data: regRows } = await admin.from("ai_n8n_workflow_registry").select("*").eq("workflow_key", workflowKey).limit(1);
    const reg = regRows && regRows.length > 0 ? regRows[0] : null;
    if (!reg) return json({ error: "No approved mapping found for this workflow key." }, 404);

    const { master, risk } = await loadControls(admin);
    const state = await getN8nState();

    // Reload live site / agent server-side (never trust browser metadata).
    let siteValid = !siteKey;
    let siteBlockNote = "No site scope — gate not required.";
    if (siteKey) {
      const { data: siteRows } = await admin.from("ai_sites").select("id, site_key, environment, is_active").eq("site_key", siteKey).limit(1);
      const site = siteRows && siteRows.length > 0 ? siteRows[0] : null;
      if (!site) siteBlockNote = "Site not found in the registry.";
      else if (site.is_active !== true) siteBlockNote = "Site is inactive.";
      else siteValid = false; // exists + active, but no execution gate allows it (default deny)
    }
    if (siteKey && siteValid === false && !siteBlockNote.includes("not found") && !siteBlockNote.includes("inactive")) {
      siteBlockNote = "Site execution is not allowed (default deny).";
    }

    let agentValid = !agentKey;
    let agentBlockNote = "No agent scope — gate not required.";
    if (agentKey) {
      const { data: agentRows } = await admin.from("ai_operations_agents").select("id, agent_key, environment, is_active").eq("agent_key", agentKey).limit(1);
      const agent = agentRows && agentRows.length > 0 ? agentRows[0] : null;
      if (!agent) agentBlockNote = "Agent not found in the registry.";
      else if (agent.is_active !== true) agentBlockNote = "Agent is inactive.";
      else agentValid = false; // exists + active, but no execution gate allows it (default deny)
    }
    if (agentKey && agentValid === false && !agentBlockNote.includes("not found") && !agentBlockNote.includes("inactive")) {
      agentBlockNote = "Agent execution is not allowed (default deny).";
    }

    const executionMode = reg.execution_mode ?? "disabled";
    const mappingVerified = reg.runtime_status === "verified";

    const gates = [
      { key: "master_kill_switch", label: "Master Kill Switch", state: master && master.execution_allowed === true ? "pass" : "block", note: master && master.execution_allowed === true ? "Master kill switch allows execution." : "Master kill switch is ON — execution blocked." },
      { key: "production_enabled", label: "Production Enabled", state: "block", note: "Production execution is disabled (Production Enabled = 0)." },
      { key: "site_gate", label: "Site Execution Gate", state: siteKey ? "block" : "not_required", note: siteBlockNote },
      { key: "agent_gate", label: "Agent Execution Gate", state: agentKey ? "block" : "not_required", note: agentBlockNote },
      { key: "risk_gate", label: "Risk Gate", state: riskLevelRaw === "red" ? "block" : "pass", note: risk ? `Risk ceiling is ${risk.risk_ceiling ?? "green"}.` : "Risk gate not provisioned." },
      { key: "n8n_connectivity", label: "n8n Connectivity", state: state.configured && state.reachable ? "pass" : "block", note: state.error ?? "n8n reachable." },
      { key: "workflow_verification", label: "Workflow Verification", state: mappingVerified ? "pass" : "block", note: mappingVerified ? "Mapping verified." : "Mapping not verified (or drift detected)." },
      { key: "execution_dispatch", label: "Execution Dispatch", state: "block", note: "Execution dispatch is not started." },
    ];

    const reasons = [
      "Master kill switch is ON — execution blocked.",
      "Production Enabled = 0.",
      "n8n configuration / connectivity not verified.",
      "Execution dispatch not started.",
    ];

    return json({
      operation: "dispatch_preview",
      decision: "BLOCKED",
      executionAllowed: false,
      workflow: {
        workflowKey,
        name: reg.name ?? null,
        executionMode,
        mappingVerified,
        n8nState: reg.is_active === true ? "active" : "inactive",
      },
      requestType: requestType || null,
      siteKey: siteKey || null,
      agentKey: agentKey || null,
      orchestrationKey: orchestrationKey || null,
      riskLevel: riskLevelRaw || null,
      approvalRequired: reg.approval_required === true,
      gates,
      reasons,
      blockedReasons: reasons,
      evaluatedAt: new Date().toISOString(),
      message: "Dispatch preview only — no workflow, webhook, run, agent, model or tool was executed.",
    });
  }

  return json({ error: "Unknown operation." }, 422);
});
