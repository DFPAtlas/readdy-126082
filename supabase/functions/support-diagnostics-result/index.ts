import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-diagnostics-result — protected callback for n8n to post structured
// diagnostic results back to DFP Command.
//
//   * verify_jwt = false → webhook receiver (n8n cannot send a JWT).
//   * Authenticated via HMAC shared secret + timestamp window.
//   * Validates the run exists, validates the payload, and updates ONLY
//     permitted diagnostic fields (status/summary/result_data/completed_at).
//   * Read-only: cannot touch customer, ticket, subscription or auth data.
//   * Accepts an optional recommended_repair (Prompt 12) — validated against a
//     strict action-type allowlist, risk derived server-side.
//   * If n8n does not supply a valid recommendation, derives a SAFE
//     deterministic recommendation from the cleaned checks when there is a
//     genuine account/profile mapping warning (refresh_account_sync / low).
// ============================================================================

const encoder = new TextEncoder();
const TIMESTAMP_WINDOW_MS = 15 * 60 * 1000;
const MAX_CHECKS = 50;

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
const CHECK_STATUSES = new Set(["ok", "pass", "warning", "fail", "unavailable", "error"]);
const SEVERITIES = new Set(["info", "low", "medium", "high", "critical", "warning", "error"]);
const OVERALL = new Set(["ok", "pass", "warning", "fail", "error"]);

// Allowlist of repair action types -> risk classification. Only LOW and
// MEDIUM are ever executable; HIGH/CRITICAL require manual admin process.
const REPAIR_TYPES: Record<string, "low" | "medium" | "high" | "critical"> = {
  resend_verification_email: "low",
  resend_password_reset_email: "low",
  retry_failed_email: "low",
  refresh_account_sync: "low",
  retry_failed_webhook: "low",
  rebuild_customer_mapping: "low",
  clear_safe_application_cache: "low",
  unlock_login: "medium",
  reactivate_account: "medium",
  refresh_permissions: "medium",
  refresh_subscription_status: "medium",
  subscription_modification: "high",
  role_modification: "high",
  financial_action: "high",
  account_deletion: "critical",
  ownership_transfer: "critical",
  security_credential_modification: "critical",
};

function cleanRecommendedRepair(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const actionType = typeof r.action_type === "string" ? r.action_type : "";
  if (!actionType || !REPAIR_TYPES[actionType]) return null;
  const out: Record<string, unknown> = {
    action_type: actionType,
    risk_level: REPAIR_TYPES[actionType],
    security_related: r.security_related === true,
  };
  if (typeof r.problem_detected === "string") out.problem_detected = r.problem_detected.slice(0, 1000);
  if (typeof r.reason === "string") out.reason = r.reason.slice(0, 1000);
  if (typeof r.requested_change === "string") out.requested_change = r.requested_change.slice(0, 500);
  if (typeof r.current_value === "string") out.current_value = r.current_value.slice(0, 200);
  if (typeof r.proposed_value === "string") out.proposed_value = r.proposed_value.slice(0, 200);
  return out;
}

// Deterministic safe recommendation derived from cleaned/validated checks.
// Triggers ONLY on a genuine account/profile mapping warning — never on
// ok/pass/unavailable/info-only results, and never from subscription,
// email_delivery or recent_errors checks.
function deriveSafeRecommendedRepair(
  checks: Record<string, unknown>[],
): Record<string, unknown> | null {
  const hasWarning = (name: string) =>
    checks.some(
      (c) => c.name === name && c.status === "warning",
    );

  // Priority: account_status warning wins over authentication warning.
  const accountStatusWarning = hasWarning("account_status");
  const authWarning = hasWarning("authentication");

  if (accountStatusWarning) {
    return {
      action_type: "refresh_account_sync",
      risk_level: "low",
      security_related: false,
      problem_detected: "The diagnostic detected an inconsistency in the organisation account mapping.",
      reason: "Verify that the support ticket, organisation and account records still resolve consistently.",
      requested_change: "Verify account and support mapping consistency.",
      current_value: "Mapping requires verification",
      proposed_value: "Mapping verified",
    };
  }

  if (authWarning) {
    return {
      action_type: "refresh_account_sync",
      risk_level: "low",
      security_related: false,
      problem_detected: "The diagnostic detected an inconsistency in the linked portal account.",
      reason: "Verify that the support ticket and linked account records still resolve consistently.",
      requested_change: "Verify account and support mapping consistency.",
      current_value: "Mapping requires verification",
      proposed_value: "Mapping verified",
    };
  }

  return null;
}

function cleanCheck(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.slice(0, 120) : "";
  const status = typeof r.status === "string" ? r.status : "";
  const message = typeof r.message === "string" ? r.message.slice(0, 2000) : "";
  if (!name || !CHECK_STATUSES.has(status)) return null;
  const severity = typeof r.severity === "string" && SEVERITIES.has(r.severity)
    ? r.severity
    : "info";
  const out: Record<string, unknown> = { name, status, message, severity };
  if (typeof r.timestamp === "string") out.timestamp = r.timestamp.slice(0, 64);
  if (typeof r.source === "string") out.source = r.source.slice(0, 120);
  if (r.details && typeof r.details === "object") out.details = r.details;
  return out;
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

  const runId = typeof body.diagnostic_run_id === "string" ? body.diagnostic_run_id : "";
  if (!UUID_RE.test(runId)) {
    return json({ error: "diagnostic_run_id is required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing } = await admin
    .from("support_diagnostic_runs")
    .select("id, customer_id, ticket_id, site_id")
    .eq("id", runId)
    .maybeSingle();

  if (!existing) {
    return json({ error: "Unknown diagnostic run" }, 404);
  }

  const overallStatus = OVERALL.has(body.overall_status)
    ? (body.overall_status as string)
    : "error";

  const checks = (Array.isArray(body.checks) ? body.checks : [])
    .map(cleanCheck)
    .filter((c): c is Record<string, unknown> => c !== null)
    .slice(0, MAX_CHECKS);

  const rawAi = (body.ai_summary && typeof body.ai_summary === "object"
    ? body.ai_summary
    : {}) as Record<string, unknown>;

  const aiSummary: Record<string, unknown> = {};
  if (typeof rawAi.likely_cause === "string") aiSummary.likely_cause = rawAi.likely_cause.slice(0, 2000);
  if (Array.isArray(rawAi.evidence)) {
    aiSummary.evidence = rawAi.evidence
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.slice(0, 500))
      .slice(0, 20);
  }
  if (typeof rawAi.suggested_action === "string") aiSummary.suggested_action = rawAi.suggested_action.slice(0, 2000);
  if (typeof rawAi.confidence === "string") aiSummary.confidence = rawAi.confidence.slice(0, 40);

  const summary = typeof body.summary === "string" ? body.summary.slice(0, 4000) : null;

  // Prefer a valid n8n-supplied recommendation; otherwise fall back to the
  // deterministic safe recommendation derived from the cleaned checks.
  const n8nRecommendation = cleanRecommendedRepair(body.recommended_repair);
  const safeDerivedRecommendation = deriveSafeRecommendedRepair(checks);
  const recommendedRepair = n8nRecommendation ?? safeDerivedRecommendation;

  const finalStatus = overallStatus === "ok" || overallStatus === "pass" || overallStatus === "warning"
    ? "completed"
    : "failed";

  const resultData = {
    overall_status: overallStatus,
    checks,
    ai_summary: Object.keys(aiSummary).length ? aiSummary : null,
    recommended_repair: recommendedRepair,
  };

  const { error: updErr } = await admin
    .from("support_diagnostic_runs")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      summary,
      result_data: resultData,
      error_message: finalStatus === "failed" ? (summary ?? "Diagnostic reported failures.") : null,
    })
    .eq("id", runId);

  if (updErr) {
    return json({ error: "Failed to update diagnostic run" }, 500);
  }

  const run = existing as { customer_id?: string; ticket_id?: string; site_id?: string };
  await admin.from("support_customer_activity").insert({
    staff_user_id: null,
    customer_user_id: run.customer_id ?? null,
    ticket_id: run.ticket_id ?? null,
    site_id: run.site_id ?? null,
    action: finalStatus === "completed" ? "diagnostic_completed" : "diagnostic_failed",
    metadata: { run_id: runId, overall_status: overallStatus },
  });

  return json({ accepted: true, run_id: runId, status: finalStatus }, 200);
});
