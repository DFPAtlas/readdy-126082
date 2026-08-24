import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-reply-result — protected callback for n8n to post the AI-generated
// reply draft back to DFP Command.
//
//   * verify_jwt = false → webhook receiver (n8n cannot send a JWT).
//   * Authenticated via HMAC shared secret + timestamp window.
//   * Validates the reply request exists and validates output shape. Only the
//     reply draft + facts/sources are stored — the ticket/customer is never
//     mutated and nothing is auto-sent.
//   * Writes ai_reply_generated / ai_reply_failed audit events.
// ============================================================================

const encoder = new TextEncoder();
const TIMESTAMP_WINDOW_MS = 15 * 60 * 1000;

const FACTS_KINDS = new Set(["confirmed", "likely", "unknown"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.slice(0, max);
}

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

  const replyId = typeof body.reply_id === "string" ? body.reply_id : "";
  if (!UUID_RE.test(replyId)) {
    return json({ error: "reply_id is required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing } = await admin
    .from("support_ai_replies")
    .select("id, ticket_id, status")
    .eq("id", replyId)
    .maybeSingle();

  if (!existing) {
    return json({ error: "Unknown reply request" }, 404);
  }
  if (existing.status === "completed") {
    return json({ accepted: true, duplicate: true, reply_id: replyId, status: "completed" }, 200);
  }

  const rawStatus = typeof body.status === "string" ? body.status : "completed";
  const finalStatus = rawStatus === "failed" ? "failed" : "completed";

  const replyText = str(body.reply_text, 20000);

  // Facts summary: validated shape — array of {kind, statement}.
  let factsSummary: unknown = null;
  if (Array.isArray(body.facts_summary)) {
    const arr = (body.facts_summary as unknown[])
      .map((f) => {
        if (typeof f !== "object" || f === null) return null;
        const o = f as Record<string, unknown>;
        const kind = typeof o.kind === "string" && FACTS_KINDS.has(o.kind) ? o.kind : "unknown";
        const statement = str(o.statement, 2000);
        if (!statement) return null;
        return { kind, statement };
      })
      .filter(Boolean);
    factsSummary = arr.length ? arr : null;
  }

  // Sources: array of {type, label} strings. No executable content.
  let sources: unknown = null;
  if (Array.isArray(body.sources)) {
    const arr = (body.sources as unknown[])
      .map((s) => {
        if (typeof s !== "object" || s === null) return null;
        const o = s as Record<string, unknown>;
        const type = str(o.type, 40);
        const label = str(o.label, 300);
        if (!label) return null;
        return { type: type ?? "context", label };
      })
      .filter(Boolean)
      .slice(0, 20);
    sources = arr.length ? arr : null;
  }

  const completedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("support_ai_replies")
    .update({
      status: finalStatus,
      reply_text: replyText,
      facts_summary: factsSummary as Record<string, unknown> | null,
      sources: sources as Record<string, unknown> | null,
      completed_at: completedAt,
      error_message: finalStatus === "failed"
        ? (str(body.error_message, 2000) ?? "AI reply generation reported a failure.")
        : null,
    })
    .eq("id", replyId);

  if (updErr) {
    return json({ error: "Failed to update reply request" }, 500);
  }

  await admin.from("support_customer_activity").insert({
    staff_user_id: null,
    ticket_id: existing.ticket_id,
    action: finalStatus === "completed" ? "ai_reply_generated" : "ai_reply_failed",
    metadata: { reply_id: replyId },
  });

  if (finalStatus === "completed" && replyText) {
    await admin.from("internal_ticket_events").insert({
      ticket_id: existing.ticket_id,
      actor_user_id: null,
      actor_type: "system",
      event_type: "ai_reply_generated",
      description: "AI reply draft generated for staff review.",
    });
  }

  return json({ accepted: true, reply_id: replyId, status: finalStatus }, 200);
});
