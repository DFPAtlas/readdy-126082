import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// support-digital-footprint-repair — server-to-server safe repair connector.
//
//   * verify_jwt = false → n8n DFP Support Repair Executor is the caller.
//   * Authenticated via HMAC-SHA256 (hex) over `timestamp.rawBody`, using
//     N8N_SUPPORT_SHARED_SECRET, within a 5-minute timestamp window.
//   * Server-side approval re-verification: the repair record must exist and
//     independently match site_id, action_type, approved_by, and be in
//     "executing" status at LOW / MEDIUM risk only. n8n is never trusted as
//     the sole authority to mutate customer data.
//   * Hardcoded action_type allowlist only. HIGH / CRITICAL are impossible.
//   * Only two executable actions today:
//       refresh_account_sync  (LOW)    — read-only reconciliation verification
//       reactivate_account    (MEDIUM) — updates ONLY clients.status = "active"
//   * Every successful mutation is immediately read back and verified.
// ============================================================================

const encoder = new TextEncoder();
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

// Digital Footprint support site id (the only site this connector serves).
const DF_SITE_ID = "0faf127e-30ba-4669-bc44-e6de47672a29";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Actions that are recognised upstream but NOT yet safe to execute here.
const NOT_YET_EXECUTABLE = [
  "resend_verification_email",
  "resend_password_reset_email",
  "retry_failed_email",
  "retry_failed_webhook",
  "rebuild_customer_mapping",
  "clear_safe_application_cache",
  "unlock_login",
  "refresh_permissions",
  "refresh_subscription_status",
];

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

function asUuidOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

function failValidation(repairActionId: string) {
  return json(
    {
      repair_action_id: repairActionId,
      status: "failed",
      previous_state: null,
      new_state: null,
      verification: {
        status: "failed",
        message: "Repair approval validation failed.",
      },
      message: "Repair approval validation failed.",
    },
    200,
  );
}

// Resolve the customer/organisation mapping from the ticket link. Never
// creates anything; never guesses identity.
async function resolveMapping(
  admin: ReturnType<typeof createClient>,
  ticketId: string | null,
  requestCustomerId: string | null,
) {
  if (ticketId && isUuid(ticketId)) {
    const { data: links, error } = await admin
      .from("support_ticket_customer_links")
      .select("organisation_id, customer_user_id, site_id")
      .eq("ticket_id", ticketId)
      .limit(100);

    if (error) throw error;

    const matching = (links ?? []).find((l) => l.site_id === DF_SITE_ID);
    if (matching) {
      return {
        organisationId: typeof matching.organisation_id === "string" ? matching.organisation_id : null,
        customerUserId: typeof matching.customer_user_id === "string" ? matching.customer_user_id : null,
        found: true,
      };
    }

    // Links exist but none point at this site → treat as unresolved.
    return {
      organisationId: null,
      customerUserId: null,
      found: (links ?? []).length > 0,
    };
  }

  // No ticket link — fall back to the request's customer_id for a portal
  // profile check only (no organisation can be resolved this way).
  return {
    organisationId: null,
    customerUserId: requestCustomerId,
    found: false,
  };
}

// ---------------------------------------------------------------------------
// Action 1 — refresh_account_sync (LOW). Read-only reconciliation. No mutation.
// ---------------------------------------------------------------------------
async function runRefreshAccountSync(
  admin: ReturnType<typeof createClient>,
  repairActionId: string,
  ticketId: string | null,
  requestCustomerId: string | null,
) {
  try {
    const mapping = await resolveMapping(admin, ticketId, requestCustomerId);

    let organisationOk = true;
    let profileOk = true;

    if (mapping.organisationId) {
      if (!isUuid(mapping.organisationId)) organisationOk = false;
      else {
        const { data: client } = await admin
          .from("clients")
          .select("id")
          .eq("id", mapping.organisationId)
          .maybeSingle();
        if (!client) organisationOk = false;
      }
    }

    if (mapping.customerUserId) {
      if (!isUuid(mapping.customerUserId)) profileOk = false;
      else {
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .or(`id.eq.${mapping.customerUserId},auth_user_id.eq.${mapping.customerUserId}`)
          .maybeSingle();
        if (!profile) profileOk = false;
      }
    }

    if (mapping.found && !mapping.organisationId && !mapping.customerUserId) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: null,
          new_state: null,
          verification: {
            status: "failed",
            message: "Account mapping is inconsistent and requires staff review.",
          },
          message: "Account synchronisation could not be verified.",
        },
        200,
      );
    }

    if (!mapping.organisationId && !mapping.customerUserId) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: null,
          new_state: null,
          verification: {
            status: "failed",
            message: "No customer or organisation is linked to this repair.",
          },
          message: "Account synchronisation could not be verified.",
        },
        200,
      );
    }

    if (!organisationOk || !profileOk) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: null,
          new_state: null,
          verification: {
            status: "failed",
            message: "Account or support mapping is inconsistent and requires staff review.",
          },
          message: "Account synchronisation verification failed.",
        },
        200,
      );
    }

    return json(
      {
        repair_action_id: repairActionId,
        status: "completed",
        previous_state: "Account mapping verified",
        new_state: "Account mapping verified",
        verification: {
          status: "confirmed",
          message: "Account and support mapping are consistent.",
        },
        message: "Account synchronisation verification completed successfully.",
      },
      200,
    );
  } catch (err) {
    console.error("refresh_account_sync failed", {
      repair_action_id: repairActionId,
      error_name: err instanceof Error ? err.name : typeof err,
    });
    return json(
      {
        repair_action_id: repairActionId,
        status: "failed",
        previous_state: null,
        new_state: null,
        verification: {
          status: "failed",
          message: "Account synchronisation could not be completed.",
        },
        message: "Account synchronisation verification failed.",
      },
      200,
    );
  }
}

// ---------------------------------------------------------------------------
// Action 2 — reactivate_account (MEDIUM). May change ONLY clients.status.
// ---------------------------------------------------------------------------
async function runReactivateAccount(
  admin: ReturnType<typeof createClient>,
  repairActionId: string,
  ticketId: string | null,
  targetStatus: string | null,
) {
  if (!ticketId || !isUuid(ticketId)) {
    return json(
      {
        repair_action_id: repairActionId,
        status: "failed",
        previous_state: null,
        new_state: null,
        verification: {
          status: "failed",
          message: "Organisation could not be resolved from the support ticket link.",
        },
        message: "Account reactivation could not be completed.",
      },
      200,
    );
  }

  if (!targetStatus || targetStatus !== "active") {
    return json(
      {
        repair_action_id: repairActionId,
        status: "failed",
        previous_state: null,
        new_state: null,
        verification: {
          status: "failed",
          message: "Target status must be \"active\".",
        },
        message: "Account reactivation was rejected.",
      },
      200,
    );
  }

  try {
    const mapping = await resolveMapping(admin, ticketId, null);
    const organisationId = mapping.organisationId;

    if (!organisationId || !isUuid(organisationId)) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: null,
          new_state: null,
          verification: {
            status: "failed",
            message: "Organisation could not be resolved from the support ticket link.",
          },
          message: "Account reactivation could not be completed.",
        },
        200,
      );
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, status, archived_at")
      .eq("id", organisationId)
      .maybeSingle();

    if (!client) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: null,
          new_state: null,
          verification: {
            status: "failed",
            message: "Organisation record not found.",
          },
          message: "Account reactivation could not be completed.",
        },
        200,
      );
    }

    const previousState = typeof client.status === "string" ? client.status : "";

    // BLOCK archived customers — never auto-restore an archived organisation.
    if (client.archived_at) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: previousState || null,
          new_state: previousState || null,
          verification: {
            status: "failed",
            message: "Organisation is archived and cannot be reactivated automatically.",
          },
          message: "Manual staff review is required for archived customers.",
        },
        200,
      );
    }

    // Current status must not already be archived/deleted.
    const lowerCurrent = previousState.toLowerCase();
    if (lowerCurrent.includes("archiv") || lowerCurrent.includes("delet")) {
      return json(
        {
          repair_action_id: repairActionId,
          status: "failed",
          previous_state: previousState || null,
          new_state: previousState || null,
          verification: {
            status: "failed",
            message: "Organisation status is not eligible for reactivation.",
          },
          message: "Account reactivation was rejected.",
        },
        200,
      );
    }

    // The ONLY allowed mutation: clients.status = "active".
    const { error: updateError } = await admin
      .from("clients")
      .update({ status: "active" })
      .eq("id", organisationId);

    if (updateError) throw updateError;

    // Immediate read-back verification.
    const { data: readback } = await admin
      .from("clients")
      .select("id, status")
      .eq("id", organisationId)
      .maybeSingle();

    const newState = readback && typeof readback.status === "string" ? readback.status : null;

    if (newState === "active") {
      return json(
        {
          repair_action_id: repairActionId,
          status: "completed",
          previous_state: previousState || null,
          new_state: "active",
          verification: {
            status: "confirmed",
            message: "Organisation status was verified as active after the repair.",
          },
          message: "Organisation account was reactivated successfully.",
        },
        200,
      );
    }

    return json(
      {
        repair_action_id: repairActionId,
        status: "failed",
        previous_state: previousState || null,
        new_state: newState ?? null,
        verification: {
          status: "failed",
          message: "Post-repair verification failed.",
        },
        message: "Account reactivation could not be verified.",
      },
      200,
    );
  } catch (err) {
    console.error("reactivate_account failed", {
      repair_action_id: repairActionId,
      error_name: err instanceof Error ? err.name : typeof err,
    });
    return json(
      {
        repair_action_id: repairActionId,
        status: "failed",
        previous_state: null,
        new_state: null,
        verification: {
          status: "failed",
          message: "Account reactivation could not be completed.",
        },
        message: "Account reactivation could not be verified.",
      },
      200,
    );
  }
}

// ---------------------------------------------------------------------------
// Not yet executable — zero customer-data writes.
// ---------------------------------------------------------------------------
function notYetExecutable(repairActionId: string) {
  return json(
    {
      repair_action_id: repairActionId,
      status: "failed",
      previous_state: null,
      new_state: null,
      verification: {
        status: "failed",
        message:
          "This repair action is not yet implemented by the Digital Footprint safe connector.",
      },
      message: "Manual staff action is currently required for this repair type.",
    },
    200,
  );
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("N8N_SUPPORT_SHARED_SECRET") ?? "";
  if (!secret) {
    return json({ error: "Connector not configured" }, 503);
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

  const repairActionId = typeof body.repair_action_id === "string" ? body.repair_action_id : "";
  if (!UUID_RE.test(repairActionId)) {
    return json({ error: "repair_action_id is required and must be a valid UUID" }, 400);
  }

  const siteId = asUuidOrNull(body.site_id);
  if (siteId !== DF_SITE_ID) {
    return json({ error: "Unsupported site" }, 400);
  }

  const actionType = typeof body.action_type === "string" ? body.action_type : "";
  const approvedBy = asUuidOrNull(body.approved_by);
  const ticketId = asUuidOrNull(body.ticket_id);
  const requestCustomerId = asUuidOrNull(body.customer_id);

  if (!actionType) {
    return json({ error: "action_type is required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ---- Server-side approval re-verification (independent of n8n) ----
  const { data: repair } = await admin
    .from("support_repair_actions")
    .select("*")
    .eq("id", repairActionId)
    .maybeSingle();

  if (!repair) {
    return failValidation(repairActionId);
  }

  const r = repair as Record<string, unknown>;
  const rSiteId = typeof r.site_id === "string" ? r.site_id : "";
  const rActionType = typeof r.action_type === "string" ? r.action_type : "";
  const rApprovedBy = typeof r.approved_by === "string" ? r.approved_by : "";
  const rStatus = typeof r.status === "string" ? r.status : "";
  const rRisk = typeof r.risk_level === "string" ? r.risk_level.toLowerCase() : "";

  if (rSiteId !== siteId) return failValidation(repairActionId);
  if (rActionType !== actionType) return failValidation(repairActionId);
  if (rApprovedBy !== approvedBy) return failValidation(repairActionId);
  if (rStatus !== "executing") return failValidation(repairActionId);
  if (rRisk !== "low" && rRisk !== "medium") return failValidation(repairActionId);

  // ---- Execute only the hardcoded allowlist ----
  if (NOT_YET_EXECUTABLE.includes(actionType)) {
    return notYetExecutable(repairActionId);
  }

  if (actionType === "refresh_account_sync") {
    return await runRefreshAccountSync(admin, repairActionId, ticketId, requestCustomerId);
  }

  if (actionType === "reactivate_account") {
    const parameters =
      body.parameters && typeof body.parameters === "object" ? (body.parameters as Record<string, unknown>) : {};
    const targetStatus =
      typeof parameters.target_status === "string" ? parameters.target_status : null;
    return await runReactivateAccount(admin, repairActionId, ticketId, targetStatus);
  }

  return notYetExecutable(repairActionId);
});
