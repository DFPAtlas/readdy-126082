import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const ALLOWED_ROLES = ["admin", "support_manager", "support_agent", "developer", "viewer"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Require a valid authenticated JWT (resolve caller from token, never from body).
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ code: "Unauthorized", message: "Missing authentication token" }, 401);

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return json({ code: "Unauthorized", message: "Invalid or expired token" }, 401);
    }

    // 2. Verify the caller is the Command Centre owner.
    const { data: roleRow } = await supabaseAdmin
      .from("internal_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleRow || roleRow.role !== "owner") {
      return json({ code: "Forbidden", message: "Only the owner can invite users" }, 403);
    }

    // 3. Parse and validate input.
    let body: { email?: string; role?: string };
    try {
      body = await req.json();
    } catch {
      return json({ code: "BadRequest", message: "Invalid JSON body" }, 400);
    }

    const email = (body.email ?? "").trim().toLowerCase();
    const role = (body.role ?? "").trim().toLowerCase();

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return json({ code: "BadRequest", message: "Invalid email address" }, 400);
    }

    // 4. Strict allow-list. Owner can never be granted here.
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ code: "BadRequest", message: "Invalid role" }, 400);
    }

    // 5. Upsert the pending invitation (handles duplicate / re-invite of the same email).
    const now = new Date().toISOString();
    const { error: inviteDbErr } = await supabaseAdmin
      .from("internal_invitations")
      .upsert(
        {
          email,
          role,
          status: "pending",
          invited_by: user.id,
          invited_at: now,
          updated_at: now,
          accepted_at: null,
        },
        { onConflict: "email" },
      );

    if (inviteDbErr) {
      return json({ code: "InternalError", message: inviteDbErr.message }, 500);
    }

    // 6. Send the invitation email via the Supabase Admin API (service role, server-side).
    //    Redirect back to the app's /login using the browser Origin, never the
    //    edge function's own host.
    const origin = req.headers.get("Origin");
    const inviteOptions: { data: { role: string }; redirectTo?: string } = { data: { role } };
    if (origin) inviteOptions.redirectTo = `${origin}/login`;

    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOptions);

    if (inviteErr) {
      return json({ code: "InternalError", message: inviteErr.message }, 500);
    }

    return json({ code: "OK", data: { email, role } }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ code: "InternalError", message }, 500);
  }
});
