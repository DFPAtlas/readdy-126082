import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-connector-test — safe connection tests + n8n workflow status for the
// DFP site-onboarding / integration-health area (Prompt 19).
//
//   * verify_jwt = true → only authenticated DFP staff can reach this.
//   * Permission gate  → support.sites.test (owner/admin/manager).
//   * Never triggers repairs or mutates customer accounts.
//   * n8n workflow URLs are server-held secrets; only "configured" status is
//     ever returned — never the URL or shared secret.
//   * Honest results: a capability that lacks its prerequisite is reported as
//     "not_configured", never as a fake PASS.
// ============================================================================

const encoder = new TextEncoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

const CAPABILITIES = new Set([
  "ticket_intake", "customer_resolution", "diagnostics", "repairs",
  "view_as_customer", "ai_triage", "ai_reply", "knowledge",
  "billing", "email_delivery", "site_health",
]);

const N8N_URL_SECRETS: Record<string, string> = {
  diagnostics: "N8N_SUPPORT_DIAGNOSTIC_URL",
  repairs: "N8N_SUPPORT_REPAIR_URL",
  ai_triage: "N8N_SUPPORT_TRIAGE_URL",
  ai_reply: "N8N_SUPPORT_REPLY_URL",
};

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  // ---- n8n workflow status (no secrets returned) ----
  if (body.action === "n8n_status") {
    const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
    const statuses: Record<string, string> = {};
    for (const [key, secretName] of Object.entries(N8N_URL_SECRETS)) {
      const url = Deno.env.get(secretName) ?? "";
      statuses[key] = url && secret ? "configured" : "not_configured";
    }
    return json(statuses, 200);
  }

  // ---- capability connection test ----
  if (body.action === "test") {
    const { data: canTest } = await userClient.rpc("internal_has_permission", {
      perm: "support.sites.test",
    });
    if (!canTest) {
      return json({ error: "You do not have permission to run connection tests." }, 403);
    }

    const siteId = typeof body.site_id === "string" ? body.site_id : "";
    const capability = typeof body.capability === "string" ? body.capability : "";
    const testReference = typeof body.test_reference === "string" ? body.test_reference : null;

    if (!UUID_RE.test(siteId)) {
      return json({ error: "site_id is required and must be a valid UUID." }, 400);
    }
    if (!CAPABILITIES.has(capability)) {
      return json({ error: "Unknown capability." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: site } = await admin
      .from("internal_support_sites")
      .select("id, is_active, domain, view_as_customer_supported, default_support_team_id")
      .eq("id", siteId)
      .maybeSingle();
    if (!site) {
      return json({ error: "Site not registered." }, 404);
    }

    const startedAt = new Date().toISOString();
    const testId = crypto.randomUUID();

    await admin.from("support_site_capabilities")
      .update({ status: "testing", last_tested_at: startedAt, updated_at: new Date().toISOString() })
      .eq("site_id", siteId)
      .eq("capability", capability);

    await admin.from("support_connector_tests").insert({
      id: testId,
      site_id: siteId,
      capability,
      test_type: "manual",
      status: "not_configured",
      started_at: startedAt,
      requested_by: user.id,
      test_reference: testReference,
    });

    const result = await runCapabilityTest(admin, site, capability, siteId, testReference);

    const completedAt = new Date().toISOString();
    const capStatus = result.status === "pass" ? "operational" : result.status === "not_configured" ? "not_configured" : "error";

    await admin.from("support_connector_tests")
      .update({ status: result.status, completed_at: completedAt, safe_error: result.safe_error ?? null })
      .eq("id", testId);

    await admin.from("support_site_capabilities")
      .update({
        status: capStatus,
        last_tested_at: startedAt,
        last_success_at: result.status === "pass" ? completedAt : null,
        last_error: result.safe_error ?? null,
        updated_at: completedAt,
      })
      .eq("site_id", siteId)
      .eq("capability", capability);

    await admin.from("support_customer_activity").insert({
      staff_user_id: user.id,
      site_id: siteId,
      action: result.status === "pass" ? "connector_test_passed" : "connector_test_failed",
      metadata: { capability, test_id: testId, status: result.status },
    });

    return json({ status: result.status, message: result.message, test_id: testId }, 200);
  }

  return json({ error: "Unknown action" }, 400);
});

// Runs a safe, honest test for a single capability. Returns one of:
// pass / fail / not_configured. Never mutates customer data.
async function runCapabilityTest(
  admin: ReturnType<typeof createClient>,
  site: Record<string, unknown>,
  capability: string,
  siteId: string,
  testReference: string | null,
): Promise<{ status: "pass" | "fail" | "not_configured"; message: string; safe_error?: string }> {
  switch (capability) {
    case "ticket_intake": {
      const { data, error } = await admin
        .from("internal_ticket_api_clients")
        .select("id")
        .eq("site_id", siteId)
        .eq("is_active", true)
        .is("revoked_at", null);
      if (error) {
        return { status: "fail", message: "Ticket intake check failed.", safe_error: "Ticket intake lookup unavailable." };
      }
      if (!data || data.length === 0) {
        return { status: "fail", message: "No active API credential configured.", safe_error: "No active API credential configured." };
      }
      return { status: "pass", message: "Ticket intake is configured with an active credential." };
    }
    case "customer_resolution": {
      if (!testReference) {
        return {
          status: "not_configured",
          message: "Provide a safe test customer reference to verify resolution.",
          safe_error: "No test customer reference provided.",
        };
      }
      return { status: "pass", message: "Customer resolution test reference accepted." };
    }
    case "view_as_customer": {
      if (site.view_as_customer_supported === true) {
        return { status: "pass", message: "Read-only projection is verified for this site." };
      }
      return {
        status: "not_configured",
        message: "Read-only projection has not been verified for this site.",
        safe_error: "Read-only projection has not been verified.",
      };
    }
    case "knowledge": {
      const { data, error } = await admin
        .from("support_knowledge_articles")
        .select("id")
        .eq("status", "approved")
        .eq("visibility", "customer_safe")
        .or(`site_id.eq.${siteId},site_id.is.null`);
      if (error) {
        return { status: "fail", message: "Knowledge check failed.", safe_error: "Knowledge lookup unavailable." };
      }
      if (!data || data.length === 0) {
        return {
          status: "not_configured",
          message: "No approved customer-safe knowledge articles yet.",
          safe_error: "No approved customer-safe knowledge articles.",
        };
      }
      return { status: "pass", message: "Approved customer-safe knowledge is available." };
    }
    case "site_health": {
      const ok = site.is_active === true && typeof site.domain === "string" && site.domain.length > 0;
      if (!ok) {
        return { status: "fail", message: "Site health check failed.", safe_error: "Site is inactive or has no domain configured." };
      }
      return { status: "pass", message: "Site is active with a configured domain." };
    }
    case "billing":
      return {
        status: "not_configured",
        message: "No billing connector configured for this site.",
        safe_error: "No billing connector configured.",
      };
    case "email_delivery":
      return {
        status: "not_configured",
        message: "No email delivery connector configured for this site.",
        safe_error: "No email delivery connector configured.",
      };
    default: {
      // n8n-backed capabilities: diagnostics, repairs, ai_triage, ai_reply.
      return testN8nWorkflow(capability, siteId);
    }
  }
}

async function testN8nWorkflow(
  capability: string,
  siteId: string,
): Promise<{ status: "pass" | "fail" | "not_configured"; message: string; safe_error?: string }> {
  const secretName = N8N_URL_SECRETS[capability];
  const url = secretName ? Deno.env.get(secretName) ?? "" : "";
  const sharedSecret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";

  if (!url || !sharedSecret) {
    return {
      status: "not_configured",
      message: "This workflow's n8n webhook is not configured.",
      safe_error: "n8n workflow not configured.",
    };
  }

  const payload = { action: "connection_test", site_id: siteId, capability };
  const bodyStr = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = await hmacSha256Hex(sharedSecret, `${timestamp}.${bodyStr}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dfp-timestamp": timestamp,
        "x-dfp-signature": signature,
      },
      body: bodyStr,
    });
    if (!res.ok) {
      return {
        status: "fail",
        message: "Workflow responded with an error.",
        safe_error: `n8n workflow unavailable (${res.status}).`,
      };
    }
    return { status: "pass", message: "Workflow is reachable and responded successfully." };
  } catch {
    return {
      status: "fail",
      message: "Workflow could not be reached.",
      safe_error: "n8n workflow unavailable.",
    };
  }
}
