import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "pdf", "txt", "csv"]);
const BLOCKED_EXT = new Set([
  "exe", "dll", "bat", "cmd", "ps1", "js", "mjs", "html", "htm", "svg",
  "sh", "msi", "com", "scr", "vbs", "jar",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Resolve the authenticated user from the verified JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Owner/admin only.
  const { data: roleRow } = await supabaseAdmin
    .from("internal_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = roleRow?.role;
  if (role !== "owner" && role !== "admin") {
    return json({ error: "Forbidden" }, 403);
  }

  const contentType = req.headers.get("content-type") ?? "";

  // ---- Multipart upload ------------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Invalid form data" }, 400);
    }

    const file = form.get("file");
    const ticketId = (form.get("ticket_id") ?? "").toString().trim();
    const messageIdRaw = (form.get("message_id") ?? "").toString().trim();

    if (!ticketId) return json({ error: "Missing ticket" }, 400);
    if (!(file instanceof File)) return json({ error: "Missing file" }, 400);

    const fileName = file.name;
    const ext = (fileName.split(".").pop() ?? "").toLowerCase();
    if (!ext || BLOCKED_EXT.has(ext)) {
      return json({ error: "This file type is not allowed" }, 400);
    }
    if (!ALLOWED_EXT.has(ext)) {
      return json({ error: "Unsupported file type" }, 400);
    }
    if (file.size > MAX_SIZE) {
      return json({ error: "File exceeds the 10 MB limit" }, 400);
    }

    // Ticket must exist (and thus be accessible to this authenticated user).
    const { data: ticket } = await supabaseAdmin
      .from("internal_support_tickets")
      .select("id")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) return json({ error: "Ticket not found" }, 404);

    // Unpredictable path — never trust a client-provided path.
    const storagePath = `${ticketId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("support-ticket-attachments")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) return json({ error: "Upload failed" }, 500);

    const { data: attachment, error: insErr } = await supabaseAdmin
      .from("internal_ticket_attachments")
      .insert({
        ticket_id: ticketId,
        message_id: messageIdRaw || null,
        file_name: fileName,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size: file.size,
        uploaded_by: user.id,
        is_customer_visible: true,
      })
      .select()
      .single();

    if (insErr) {
      // Best-effort cleanup so we don't leave an orphaned object.
      await supabaseAdmin.storage
        .from("support-ticket-attachments")
        .remove([storagePath])
        .catch(() => {});
      return json({ error: "Failed to save attachment" }, 500);
    }

    return json({ ok: true, attachment }, 200);
  }

  // ---- Signed URL (JSON) ----------------------------------------------
  let body: { action?: string; attachment_id?: string; ticket_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "signed_url") {
    const attachmentId = body.attachment_id ?? "";
    const ticketId = body.ticket_id ?? "";
    if (!attachmentId || !ticketId) {
      return json({ error: "Missing attachment or ticket" }, 400);
    }

    // Enforce cross-ticket isolation: the attachment must belong to the
    // requested ticket before we issue a URL.
    const { data: att } = await supabaseAdmin
      .from("internal_ticket_attachments")
      .select("ticket_id, storage_path")
      .eq("id", attachmentId)
      .maybeSingle();

    if (!att || att.ticket_id !== ticketId) {
      return json({ error: "Not found" }, 404);
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("support-ticket-attachments")
      .createSignedUrl(att.storage_path, 3600); // 1 hour, short-lived

    if (signErr || !signed?.signedUrl) {
      return json({ error: "Failed to generate link" }, 500);
    }

    return json({ ok: true, url: signed.signedUrl }, 200);
  }

  return json({ error: "Unknown action" }, 400);
});
