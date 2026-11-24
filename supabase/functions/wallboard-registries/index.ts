import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { headers, status });
}

async function readSource(
  name: string,
  query: PromiseLike<{ data: unknown[] | null; error: { code: string } | null; count: number | null }>,
) {
  try {
    const { data, error, count } = await query;
    if (!error && data && data.length === count) return data;
    console.error("Wallboard registry unavailable", name, error?.code ?? "incomplete_result");
  } catch {
    console.error("Wallboard registry request failed", name);
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Registry service unavailable" }, 503);

  const auth = { autoRefreshToken: false, persistSession: false };
  try {
    const caller = createClient(url, anonKey, {
      auth,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await caller.auth.getUser(token);
    if (userError || !user) return json({ error: "Authentication required" }, 401);

    const { data: role, error: roleError } = await caller.rpc("internal_role_aal2");
    if (roleError) return json({ error: "Operator access unavailable" }, 503);
    if (role !== "owner" && role !== "admin") {
      return json({ error: "Operator access required" }, 403);
    }

    const admin = createClient(url, serviceKey, { auth });
    const options = { count: "exact" } as const;
    const [invoices, checkout, backupRecords, restoreDrills] = await Promise.all([
      readSource("invoices", admin.from("invoices")
        .select("id,status,currency,amount_paid,amount_outstanding,paid_at,archived_at,cancelled_at,written_off_at", options)
        .is("garage_id", null)),
      readSource("checkout", admin.from("dfp_checkout_orders")
        .select("id,currency,starting_payment_minor,remaining_balance_minor,payment_status,created_at", options)),
      readSource("backup_records", admin.from("backup_records")
        .select("id,backup_type,backup_scope,provider,environment,status,started_at,completed_at,encryption_status,verification_status,verified_at,retention_until,notes", options)
        .order("completed_at", { ascending: false })),
      readSource("restore_drills", admin.from("restore_drills")
        .select("id,drill_reference,status,planned_at,completed_at,database_result,storage_result,application_result,recovery_time_minutes,recovery_point_gap_minutes,issues_found", options)
        .order("planned_at", { ascending: false })),
    ]);
    return json({ invoices, checkout, backupRecords, restoreDrills });
  } catch {
    return json({ error: "Registry service unavailable" }, 503);
  }
});
