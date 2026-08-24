import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-repair-result — protected callback for n8n to post repair execution
// results back to DFP Command.
//
//   * verify_jwt = false → webhook receiver (n8n cannot send a JWT).
//   * Authenticated via HMAC shared secret + timestamp window.
//   * Validates the repair exists and validates the payload.
//   * Updates ONLY permitted repair fields (status/completed_at/previous_state/
//     new_state/verification/result_summary/error_message).
//   * Idempotent: a second callback for an already-completed/failed repair is
//     acknowledged without re-applying the account change.
//   * Cannot touch customer, ticket, subscription or auth data.
// ============================================================================

const encoder = new TextEncoder();
const TIMESTAMP_WINDOW_MS = 15 * 60 * 1000;

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERIFICATION_STATUSES = new Set(["confirmed", "warning", "failed"]);

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
  if (!secret) {
    return json({ error: "Callback not configured" }, 503);
  }

  const timestamp = req.headers.get("x-dfp-timestamp") ?? "";
  const signature = req.headers.get("x-dfp-signature") ?? "";
  const rawBody = await req.text();

  if (!timestamp || !signature) {
    return json({ error: "Missing signature" }, 401);
  }
  const tsMs = Date.parse(timestamp);
  if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > TIMESTAMP_WINDOW_MS) {
    return json({ error: "Timestamp out of range" }, 401);
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return json({ error: "Invalid signature" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const repairId = typeof body.repair_action_id === "string" ? body.repair_action_id : "";
  if (!UUID_RE.test(repairId)) {
    return json({ error: "repair_action_id is required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing } = await admin
    .from("support_repair_actions")
    .select("id, status, customer_id, ticket_id, site_id")
    .eq("id", repairId)
    .maybeSingle();

  if (!existing) {
    return json({ error: "Unknown repair action" }, 404);
  }

  // Idempotency — a completed/failed repair is not re-applied.
  if (existing.status === "completed" || existing.status === "failed") {
    return json({
      accepted: true,
      duplicate: true,
      repair_action_id: repairId,
      status: existing.status,
    }, 200);
  }

  const rawStatus = typeof body.status === "string" ? body.status : "";
  let finalStatus: "completed" | "failed";
  if (rawStatus === "failed") {
    finalStatus = "failed";
  } else if (rawStatus === "completed" || rawStatus === "completed_with_warning") {
    finalStatus = "completed";
  } else {
    return json({ error: "status must be completed or failed" }, 400);
  }

  const previousState = typeof body.previous_state === "string" ? body.previous_state.slice(0, 200) : null;
  const newState = typeof body.new_state === "string" ? body.new_state.slice(0, 200) : null;
  const message = typeof body.message === "string" ? body.message.slice(0, 4000) : null;

  let verification: Record<string, unknown> | null = null;
  if (body.verification && typeof body.verification === "object") {
    const v = body.verification as Record<string, unknown>;
    const vStatus = typeof v.status === "string" && VERIFICATION_STATUSES.has(v.status) ? v.status : null;
    if (vStatus) {
      verification = {
        status: vStatus,
        message: typeof v.message === "string" ? v.message.slice(0, 1000) : null,
      };
    }
  }

  const completedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("support_repair_actions")
    .update({
      status: finalStatus,
      completed_at: completedAt,
      failed_at: finalStatus === "failed" ? completedAt : null,
      previous_state: previousState,
      new_state: newState,
      verification,
      result_summary: message,
      error_message: finalStatus === "failed" ? (message ?? "Repair failed.") : null,
    })
    .eq("id", repairId);

  if (updErr) {
    return json({ error: "Failed to update repair action" }, 500);
  }

  const run = existing as { customer_id?: string; ticket_id?: string; site_id?: string };
  await admin.from("support_customer_activity").insert({
    staff_user_id: null,
    customer_user_id: run.customer_id ?? null,
    ticket_id: run.ticket_id ?? null,
    site_id: run.site_id ?? null,
    action: finalStatus === "completed" ? "repair_execution_completed" : "repair_execution_failed",
    metadata: { repair_id: repairId, previous_state: previousState, new_state: newState },
  });

  if (verification) {
    await admin.from("support_customer_activity").insert({
      staff_user_id: null,
      customer_user_id: run.customer_id ?? null,
      ticket_id: run.ticket_id ?? null,
      site_id: run.site_id ?? null,
      action: "repair_verified",
      metadata: { repair_id: repairId, verification: verification.status },
    });
  }

  return json({ accepted: true, repair_action_id: repairId, status: finalStatus }, 200);
});
