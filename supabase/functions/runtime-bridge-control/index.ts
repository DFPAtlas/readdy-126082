import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// runtime-bridge-control — authenticated internal-staff control endpoint for
// the private runtime transport probe (Phase 3 Prompt 10).
//
// This is TRANSPORT TESTING ONLY. It queues a safe dry-run transport probe
// through the existing private runtime bridge and reads back its status. It
// NEVER executes n8n, performs Ollama inference, runs an agent, creates a run,
// calls a tool, retrieves knowledge, sends notifications, runs schedules, or
// mutates business data. The probe proves cloud → HAL → cloud transport only.
//
// SECURITY:
//   * verify_jwt = true → only authenticated users reach this.
//   * internal_role() gate: owner/admin may queue a probe; any internal role
//     (including viewer) may read status only.
//   * Only two allowlisted operations exist (queue_transport_probe,
//     get_transport_probe_status). No generic queue-message endpoint.
//   * The probe payload is strictly limited to safe metadata — no URLs,
//     commands, workflow IDs, model prompts, SQL, or file paths.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROBE_TTL_MS = 2 * 60_000; // probe expires in 2 minutes
const HEARTBEAT_FRESH_MS = 2 * 60_000; // heartbeat must be < 2 min old

const ALLOWED_OPERATIONS = new Set([
  "queue_transport_probe",
  "get_transport_probe_status",
]);

const PROBE_MESSAGE_TYPE = "runtime_transport_probe";
const ACK_MESSAGE_TYPE = "runtime_transport_probe_ack";

const PROBE_STATUSES = new Set([
  "pending",
  "delivered",
  "acknowledged",
  "expired",
  "rejected",
]);

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

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function auditEvent(
  admin: ReturnType<typeof createClient>,
  eventType: string,
  outcome: string,
  severity: string,
  actor: string,
  notes: string,
  correlationId: string | null = null,
) {
  await admin.from("ai_audit_events").insert({
    audit_key: uid("BRC"),
    occurred_at: new Date().toISOString(),
    event_type: eventType,
    action: "runtime_transport_probe",
    outcome,
    severity,
    actor_type: "human",
    actor_reference: actor,
    trigger_source: "manual",
    environment: "production",
    correlation_id: correlationId,
    notes,
  });
}

// Lazily expire any pending/delivered probe whose expires_at has passed.
// Idempotent — only transitions a row that is still pending/delivered.
async function expireProbeIfNeeded(
  admin: ReturnType<typeof createClient>,
  probe: Record<string, unknown>,
  actor: string,
): Promise<Record<string, unknown>> {
  const expiresAt = str((probe.safe_payload as Record<string, unknown>)?.expires_at);
  if (!expiresAt) return probe;
  const expired = Date.now() > new Date(expiresAt).getTime();
  const status = str(probe.status);
  if (!expired) return probe;
  if (status === "pending" || status === "delivered") {
    await admin.from("ai_runtime_bridge_messages").update({ status: "expired" }).eq("message_key", str(probe.message_key));
    await auditEvent(admin, "runtime_transport_probe_expired", "expired", "low", actor,
      `Transport probe ${str(probe.message_key)} expired without a signed acknowledgement. No execution occurred.`,
      str(probe.correlation_id) || null);
    return { ...probe, status: "expired" };
  }
  return probe;
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const operation = str(body.operation);
  if (!ALLOWED_OPERATIONS.has(operation)) return json({ error: "Unknown or disallowed operation." }, 422);

  const actor = user.email ?? user.id;
  const isPrivileged = role === "owner" || role === "admin";

  // ===========================================================================
  // QUEUE_TRANSPORT_PROBE — owner/admin only.
  // ===========================================================================
  if (operation === "queue_transport_probe") {
    if (!isPrivileged) return json({ error: "Owner or admin role required to send a transport probe." }, 403);

    const nodeKeyParam = str(body.node_key);
    const { data: nodeRows } = await admin
      .from("ai_runtime_bridge_nodes")
      .select("id, node_key, name, status, last_handshake_at, last_heartbeat_at, last_seen_at")
      .eq(nodeKeyParam ? "node_key" : "status", nodeKeyParam || "reachable")
      .order("last_seen_at", { ascending: false })
      .limit(1);

    const node = nodeRows && nodeRows.length > 0 ? nodeRows[0] : null;
    if (!node) return json({ error: "No reachable bridge node found.", detail: "queue_blocked" }, 404);

    // Verify handshake is current (has ever completed) and heartbeat is fresh.
    if (!node.last_handshake_at) {
      return json({ error: "Bridge node has not completed a verified handshake.", detail: "handshake_missing" }, 409);
    }
    const lastBeat = node.last_heartbeat_at ?? node.last_seen_at;
    const beatAge = lastBeat ? Date.now() - new Date(lastBeat as string).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(beatAge) || beatAge > HEARTBEAT_FRESH_MS) {
      return json({ error: "Bridge node heartbeat is stale — transport probe refused.", detail: "heartbeat_stale" }, 409);
    }

    const now = new Date();
    const probeKey = uid("PRB");
    const correlationId = uid("COR");
    const safePayload = {
      probe_key: probeKey,
      correlation_id: correlationId,
      requested_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PROBE_TTL_MS).toISOString(),
      expected_node_key: node.node_key,
      message: "transport verification only",
    };

    const payloadHash = await sha256Hex(JSON.stringify(safePayload));

    await admin.from("ai_runtime_bridge_messages").insert({
      message_key: uid("BRM"),
      message_id: probeKey,
      nonce_hash: null,
      node_id: node.id,
      direction: "outbound",
      message_type: PROBE_MESSAGE_TYPE,
      correlation_id: correlationId,
      status: "pending",
      payload_type: "transport_probe",
      safe_payload: safePayload,
      payload_hash: payloadHash,
      created_at: now.toISOString(),
    });

    await auditEvent(admin, "runtime_transport_probe_queued", "success", "low", actor,
      `Transport probe ${probeKey} queued for bridge node ${node.node_key}. Transport verification only — no execution.`,
      correlationId);

    return json({
      accepted: true,
      operation: "queue_transport_probe",
      probeKey,
      correlationId,
      nodeKey: node.node_key,
      nodeName: node.name ?? null,
      requestedAt: now.toISOString(),
      expiresAt: safePayload.expires_at,
      status: "pending",
      executionEnabled: false,
      message: "Dry-run transport probe queued. This verifies transport only — no execution is performed.",
    });
  }

  // ===========================================================================
  // GET_TRANSPORT_PROBE_STATUS — any internal role (viewer read-only).
  // ===========================================================================
  if (operation === "get_transport_probe_status") {
    const correlationIdParam = str(body.correlation_id);

    let query = admin
      .from("ai_runtime_bridge_messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("message_type", PROBE_MESSAGE_TYPE);
    if (correlationIdParam) query = query.eq("correlation_id", correlationIdParam);
    query = query.order("created_at", { ascending: false }).limit(5);

    const { data: probeRows } = await query;
    if (!probeRows || probeRows.length === 0) {
      return json({ operation: "get_transport_probe_status", found: false, probes: [], executionEnabled: false });
    }

    // Lazily expire any stale probes (idempotent).
    const probes: Record<string, unknown>[] = [];
    for (const p of probeRows) {
      probes.push(await expireProbeIfNeeded(admin, p, actor));
    }

    // Resolve the signed acknowledgement for each probe (inbound ack message).
    const results = await Promise.all(probes.map(async (p) => {
      const corr = str(p.correlation_id);
      const ackRows = corr
        ? await admin.from("ai_runtime_bridge_messages")
          .select("message_key, status, safe_payload, acknowledged_at, created_at")
          .eq("direction", "inbound")
          .eq("message_type", ACK_MESSAGE_TYPE)
          .eq("correlation_id", corr)
          .order("created_at", { ascending: false })
          .limit(1)
        : { data: [] };

      const ack = ackRows.data && ackRows.data.length > 0 ? ackRows.data[0] : null;
      const payload = (p.safe_payload as Record<string, unknown>) ?? {};
      const queuedAt = str(p.created_at);
      const ackedAt = ack ? (str(ack.acknowledged_at) || str(ack.created_at)) : null;

      let roundTripMs: number | null = null;
      if (queuedAt && ackedAt) {
        const delta = new Date(ackedAt).getTime() - new Date(queuedAt).getTime();
        if (Number.isFinite(delta)) roundTripMs = Math.max(0, delta);
      }

      return {
        probeKey: str(payload.probe_key),
        messageKey: str(p.message_key),
        correlationId: corr,
        nodeId: p.node_id ?? null,
        status: str(p.status),
        queuedAt,
        acknowledgedAt: ackedAt,
        expiresAt: str(payload.expires_at),
        expectedNodeKey: str(payload.expected_node_key),
        signedAck: ack ? true : false,
        ackStatus: ack ? (str((ack.safe_payload as Record<string, unknown>)?.status) || str(ack.status)) : null,
        ackSummary: ack ? (str((ack.safe_payload as Record<string, unknown>)?.summary) || null) : null,
        roundTripMs,
      };
    }));

    const verified = results.some((r) => r.status === "acknowledged");

    return json({
      operation: "get_transport_probe_status",
      found: true,
      verified,
      probes: results,
      executionEnabled: false,
      message: verified
        ? "Transport verified — no execution performed."
        : "Transport probe status read (no execution performed).",
    });
  }

  return json({ error: "Unknown operation." }, 422);
});