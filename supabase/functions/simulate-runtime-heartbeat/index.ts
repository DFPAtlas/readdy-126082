import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// simulate-runtime-heartbeat — operator-only test control.
//
// Lets an owner/admin inject a synthetic bridge heartbeat for a runtime node so
// the wallboard can be exercised (e.g. flip TRON's Ollama status between
// healthy and degraded) WITHOUT hand-writing SQL. It writes through the same
// service-role path the real bridge uses, but is clearly marked as simulated in
// the audit trail and heartbeat safe_summary. No execution, no real bridge.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_OLLAMA_STATUS = new Set(["healthy", "degraded"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
    status,
  });
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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

  const isPrivileged = role === "owner" || role === "admin";
  if (!isPrivileged) return json({ error: "Owner or admin role required." }, 403);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const nodeKey = str(body.node_key);
  const ollamaStatus = str(body.ollama_status);

  if (!nodeKey) return json({ error: "node_key is required." }, 400);
  if (!ALLOWED_OLLAMA_STATUS.has(ollamaStatus)) {
    return json({ error: "ollama_status must be healthy or degraded." }, 422);
  }

  const { data: nodeRows } = await admin
    .from("ai_runtime_bridge_nodes")
    .select("id, node_key, capabilities")
    .eq("node_key", nodeKey)
    .limit(1);
  const node = nodeRows && nodeRows.length > 0 ? nodeRows[0] : null;
  if (!node) return json({ error: "Bridge node not found." }, 404);

  const nodeId = node.id as string;

  // Preserve the newest heartbeat's n8n status / local_services (model count)
  // / capabilities so only the Ollama status changes.
  const { data: latestRows } = await admin
    .from("ai_runtime_bridge_heartbeats")
    .select("n8n_status, local_services, capabilities, latency_ms")
    .eq("node_id", nodeId)
    .order("received_at", { ascending: false })
    .limit(1);
  const latest = latestRows && latestRows.length > 0 ? latestRows[0] : null;

  const nowIso = new Date().toISOString();
  const n8nStatus = latest?.n8n_status ?? null;
  const localServices = latest?.local_services ?? null;
  const capabilities = Array.isArray(latest?.capabilities)
    ? latest.capabilities
    : (Array.isArray(node.capabilities) ? node.capabilities : []);

  await admin.from("ai_runtime_bridge_heartbeats").insert({
    heartbeat_key: uid("SIM"),
    node_id: nodeId,
    message_id: null,
    received_at: nowIso,
    bridge_timestamp: nowIso,
    status: ollamaStatus,
    latency_ms: latest?.latency_ms ?? null,
    n8n_status: n8nStatus,
    ollama_status: ollamaStatus,
    local_services: localServices,
    capabilities,
    safe_summary: `Simulated ${ollamaStatus} Ollama state (operator-injected test heartbeat). No real bridge heartbeat.`,
    payload_hash: null,
  });

  await admin.from("ai_runtime_bridge_nodes").update({
    last_seen_at: nowIso,
    last_heartbeat_at: nowIso,
    status: "reachable",
  }).eq("id", nodeId);

  await admin.from("ai_audit_events").insert({
    audit_key: uid("AUD"),
    occurred_at: nowIso,
    event_type: "runtime_simulated_heartbeat",
    action: "simulate_runtime_heartbeat",
    outcome: "success",
    severity: "low",
    actor_type: "human",
    actor_reference: user.email ?? user.id,
    trigger_source: "manual",
    environment: "production",
    notes: `Simulated ${ollamaStatus} Ollama heartbeat for node ${nodeKey}. Test only — no real bridge, no execution.`,
  });

  return json({
    accepted: true,
    operation: "simulate_runtime_heartbeat",
    nodeKey,
    ollamaStatus,
    receivedAt: nowIso,
    executionEnabled: false,
    message: `Simulated ${ollamaStatus} Ollama heartbeat recorded for ${nodeKey}.`,
  });
});
