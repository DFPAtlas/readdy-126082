import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-diagnostics-run — creates a read-only diagnostic run and dispatches
// it to the n8n Support Diagnostic Agent via a signed server-side request.
//
//   * verify_jwt = true → only authenticated DFP staff can reach this.
//   * Permission gate  → support.diagnostics.run (owner/admin only).
//   * n8n config        → N8N_SUPPORT_DIAGNOSTIC_URL + N8N_SUPPORT_SHARED_SECRET
//                         (Supabase Dashboard secrets). Never exposed to client.
//   * Read-only         → never performs destructive account actions.
//
// Subject support:
//   * user-backed customer   → customer_id present (backward compatible).
//   * organisation-only      → organisation_id present, customer_id may be null.
//     `authentication` scope is removed because no portal/login account exists.
// ============================================================================

const encoder = new TextEncoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE_KEYS = ["account", "authentication", "subscription", "email", "recent_errors"];

function cleanScope(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === "string" && SCOPE_KEYS.includes(v) && !out.includes(v)) out.push(v);
  }
  return out.length ? out : [...SCOPE_KEYS];
}

function asUuid(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

  const { data: canRun } = await userClient.rpc("internal_has_permission", {
    perm: "support.diagnostics.run",
  });
  if (!canRun) {
    return json({ error: "You do not have permission to run diagnostics." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  // ---- config status check (no secrets returned) ----
  if (body.action === "status") {
    const url = Deno.env.get("N8N_SUPPORT_DIAGNOSTIC_URL") ?? "";
    const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
    return json({ configured: Boolean(url && secret) }, 200);
  }

  const n8nUrl = Deno.env.get("N8N_SUPPORT_DIAGNOSTIC_URL") ?? "";
  const n8nSecret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";

  let customerId = asUuid(body.customer_id);
  let organisationId = asUuid(body.organisation_id);
  let siteId = asUuid(body.site_id);
  const userId = asUuid(body.user_id);
  const ticketId = asUuid(body.ticket_id);

  // Validate every supplied UUID before trusting it.
  if (customerId && !UUID_RE.test(customerId)) return json({ error: "customer_id is invalid." }, 400);
  if (organisationId && !UUID_RE.test(organisationId)) return json({ error: "organisation_id is invalid." }, 400);
  if (siteId && !UUID_RE.test(siteId)) return json({ error: "site_id is invalid." }, 400);
  if (userId && !UUID_RE.test(userId)) return json({ error: "user_id is invalid." }, 400);
  if (ticketId && !UUID_RE.test(ticketId)) return json({ error: "ticket_id is invalid." }, 400);

  if (!n8nUrl || !n8nSecret) {
    return json({
      status: "not_configured",
      message: "n8n support diagnostics are not configured. Contact an administrator.",
    }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Derive authoritative identifiers from the resolved link (if any) ----
  // Never trust arbitrary customer/organisation identifiers supplied by the
  // browser: when a ticket_id is provided, the stored resolved link is the
  // single source of truth.
  if (ticketId) {
    const { data: link, error: linkErr } = await admin
      .from("support_ticket_customer_links")
      .select("customer_user_id, organisation_id, site_id, resolution_status")
      .eq("ticket_id", ticketId)
      .maybeSingle();
    if (linkErr) {
      return json({ error: "Failed to load ticket link." }, 500);
    }
    if (!link) {
      return json({ error: "Ticket has no resolved customer link." }, 400);
    }
    if (link.resolution_status !== "resolved") {
      return json({ error: "Ticket customer link is not resolved." }, 400);
    }
    customerId = (link.customer_user_id as string | null) ?? null;
    organisationId = (link.organisation_id as string | null) ?? null;
    if (link.site_id) siteId = link.site_id as string;
  }

  if (!customerId && !organisationId) {
    return json({ error: "At least one of customer_id or organisation_id is required." }, 400);
  }

  const subjectType = customerId ? "user" : "organisation";

  // Organisation-only runs: authentication checks are not applicable because
  // no portal/login account is linked. Remove the scope before dispatch so the
  // entire run is never blocked by the unavailable check.
  let scope = cleanScope(body.scope);
  if (!customerId && organisationId) {
    scope = scope.filter((s) => s !== "authentication");
  }

  const { data: run, error: insertErr } = await admin
    .from("support_diagnostic_runs")
    .insert({
      customer_id: customerId,
      organisation_id: organisationId,
      site_id: siteId,
      user_id: userId,
      ticket_id: ticketId,
      status: "queued",
      requested_by: user.id,
      diagnostic_scope: scope.join(","),
    })
    .select("id")
    .single();

  if (insertErr || !run) {
    return json({ error: "Failed to create diagnostic run." }, 500);
  }
  const runId = run.id as string;

  await admin.from("support_customer_activity").insert({
    staff_user_id: user.id,
    customer_user_id: customerId,
    organisation_id: organisationId,
    ticket_id: ticketId,
    site_id: siteId,
    action: "diagnostic_requested",
    metadata: { run_id: runId, scope, subject_type: subjectType },
  });

  // ---- signed server-side dispatch to n8n (identifiers only) ----
  const payload = {
    diagnostic_run_id: runId,
    customer_id: customerId,
    organisation_id: organisationId,
    site_id: siteId,
    user_id: userId,
    ticket_id: ticketId,
    requested_by: user.id,
    scope,
    subject_type: subjectType,
  };
  const bodyStr = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = await hmacSha256Hex(n8nSecret, `${timestamp}.${bodyStr}`);

  try {
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dfp-timestamp": timestamp,
        "x-dfp-signature": signature,
      },
      body: bodyStr,
    });
    if (!res.ok) throw new Error(`n8n responded ${res.status}`);

    await admin
      .from("support_diagnostic_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);
    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: customerId,
      organisation_id: organisationId,
      ticket_id: ticketId,
      site_id: siteId,
      action: "diagnostic_started",
      metadata: { run_id: runId },
    });

    return json({ status: "running", run_id: runId, message: "Diagnostics started." }, 200);
  } catch (err) {
    // Safe diagnostic logging — never log secrets, signatures, headers,
    // tokens, request bodies, customer data, or the full webhook path.
    let n8nHostname = "";
    let n8nPort = "";
    try {
      const parsed = new URL(n8nUrl);
      n8nHostname = parsed.hostname;
      n8nPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    } catch {
      n8nHostname = "unknown";
      n8nPort = "unknown";
    }
    const errName = err instanceof Error ? err.name : typeof err;
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("n8n diagnostics dispatch failed", {
      errorName: errName,
      errorMessage: errMessage,
      n8nHostname,
      n8nPort,
    });

    const safe = "Diagnostics could not be started because the n8n service is unavailable.";
    await admin
      .from("support_diagnostic_runs")
      .update({ status: "failed", error_message: safe, completed_at: new Date().toISOString() })
      .eq("id", runId);
    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      customer_user_id: customerId,
      organisation_id: organisationId,
      ticket_id: ticketId,
      site_id: siteId,
      action: "diagnostic_failed",
      metadata: { run_id: runId, reason: "n8n_unavailable" },
    });
    return json({ status: "failed", run_id: runId, message: safe }, 200);
  }
});
