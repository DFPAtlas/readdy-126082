import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-triage-result — protected callback for n8n to post the AI triage
// classification back to DFP Command.
//
//   * verify_jwt = false → webhook receiver (n8n cannot send a JWT).
//   * Authenticated via HMAC shared secret + timestamp window (same convention
//     as support-diagnostics-result / support-repair-result).
//   * Validates the triage run exists and validates every field against
//     strict allowlists. Invalid teams are ignored (never trusted). AI never
//     assigns staff or mutates the ticket — it only updates triage fields.
//   * Writes ai_triage_completed / ai_triage_failed audit events.
// ============================================================================

const encoder = new TextEncoder();
const TIMESTAMP_WINDOW_MS = 15 * 60 * 1000;

const CATEGORIES = new Set([
  "general", "technical", "account", "billing", "access",
  "bug", "complaint", "feature_request", "security", "other",
]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent", "critical"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const DIAGNOSTIC_MODULES = new Set([
  "authentication", "account_status", "subscription", "billing_state",
  "email_delivery", "recent_errors", "api_health", "permissions",
]);

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

function confidenceFrom(conf: string | null, score: unknown): string {
  if (conf && CONFIDENCE.has(conf)) return conf;
  const n = typeof score === "number" && Number.isFinite(score) ? score : NaN;
  if (!Number.isNaN(n)) {
    if (n >= 0.7) return "high";
    if (n >= 0.4) return "medium";
    return "low";
  }
  return "low";
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

  const triageId = typeof body.triage_id === "string" ? body.triage_id : "";
  if (!UUID_RE.test(triageId)) {
    return json({ error: "triage_id is required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing } = await admin
    .from("support_ticket_triage")
    .select("id, ticket_id, status")
    .eq("id", triageId)
    .maybeSingle();

  if (!existing) {
    return json({ error: "Unknown triage run" }, 404);
  }
  if (existing.status === "completed") {
    return json({ accepted: true, duplicate: true, triage_id: triageId, status: "completed" }, 200);
  }

  const rawStatus = typeof body.status === "string" ? body.status : "completed";
  const finalStatus = rawStatus === "failed" ? "failed" : "completed";

  // Field validation (strict allowlists where applicable).
  const categoryRaw = str(body.category, 100);
  const category = categoryRaw && CATEGORIES.has(categoryRaw) ? categoryRaw : null;

  const subcategory = str(body.subcategory, 120);

  const priorityRaw = str(body.suggested_priority, 50);
  const suggestedPriority = priorityRaw && PRIORITIES.has(priorityRaw) ? priorityRaw : null;

  const confidenceScore =
    typeof body.confidence_score === "number" && Number.isFinite(body.confidence_score)
      ? Math.min(1, Math.max(0, body.confidence_score as number))
      : null;

  const confidence = confidenceFrom(
    str(body.confidence, 20),
    confidenceScore,
  );

  const summary = str(body.summary, 4000);
  const likelyIssue = str(body.likely_issue, 2000);
  const suggestedAction = str(body.suggested_action, 2000);
  const suggestedDiagnosticRaw = str(body.suggested_diagnostic, 80);
  const suggestedDiagnostic =
    suggestedDiagnosticRaw && DIAGNOSTIC_MODULES.has(suggestedDiagnosticRaw) ? suggestedDiagnosticRaw : null;
  const suggestedResponse = str(body.suggested_response, 8000);

  const securityRelated = body.security_related === true;

  // Team suggestion must reference an active team authorised for this site.
  let suggestedTeamId: string | null = null;
  const teamRaw = typeof body.suggested_team_id === "string" ? body.suggested_team_id : "";
  if (UUID_RE.test(teamRaw)) {
    const { data: team } = await admin
      .from("internal_support_teams")
      .select("id, status")
      .eq("id", teamRaw)
      .eq("status", "active")
      .maybeSingle();
    if (team) {
      const { data: tkt } = await admin
        .from("internal_support_tickets")
        .select("site_id")
        .eq("id", existing.ticket_id)
        .maybeSingle();
      const siteId = tkt?.site_id ?? null;
      if (siteId) {
        const { data: mapping } = await admin
          .from("internal_support_team_sites")
          .select("id")
          .eq("team_id", teamRaw)
          .eq("site_id", siteId)
          .maybeSingle();
        if (mapping) suggestedTeamId = teamRaw;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("support_ticket_triage")
    .update({
      status: finalStatus,
      category,
      subcategory,
      suggested_priority: suggestedPriority,
      suggested_team_id: suggestedTeamId,
      confidence,
      confidence_score: confidenceScore,
      summary,
      likely_issue: likelyIssue,
      suggested_action: suggestedAction,
      suggested_diagnostic: suggestedDiagnostic,
      suggested_response: suggestedResponse,
      security_related: securityRelated,
      completed_at: completedAt,
      error_message: finalStatus === "failed"
        ? (str(body.error_message, 2000) ?? "AI triage reported a failure.")
        : null,
    })
    .eq("id", triageId);

  if (updErr) {
    return json({ error: "Failed to update triage run" }, 500);
  }

  await admin.from("support_customer_activity").insert({
    staff_user_id: null,
    ticket_id: existing.ticket_id,
    action: finalStatus === "completed" ? "ai_triage_completed" : "ai_triage_failed",
    metadata: { triage_id: triageId, confidence, category, security_related: securityRelated },
  });

  if (finalStatus === "completed") {
    await admin.from("internal_ticket_events").insert({
      ticket_id: existing.ticket_id,
      actor_user_id: null,
      actor_type: "system",
      event_type: "ai_triage_completed",
      description: `AI triage completed (${confidence} confidence${category ? ", " + category : ""}).`,
    });
  }

  return json({ accepted: true, triage_id: triageId, status: finalStatus }, 200);
});
