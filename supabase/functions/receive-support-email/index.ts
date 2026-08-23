import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// receive-support-email — inbound customer reply webhook (Resend inbound).
//
// Verifies the provider (Svix-style) signature, extracts the scoped reply
// token from the recipient address, confirms the sender is the ticket's
// customer, dedupes by provider message id, sanitises the body to plain text,
// and atomically creates a customer message via internal_add_customer_reply.
//
// Secrets: SUPPORT_EMAIL_WEBHOOK_SECRET, TICKET_HASH_PEPPER
// ============================================================================

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const BLOCKED_ATTACHMENT_EXT = new Set([
  "exe", "dll", "bat", "cmd", "ps1", "js", "mjs", "html", "htm", "svg",
  "sh", "msi", "com", "scr", "vbs", "jar",
]);

const encoder = new TextEncoder();

function json(body: unknown, status: number) {
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(message));
  return bytesToBase64(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function tokenHash(token: string): Promise<string> {
  const pepper = Deno.env.get("TICKET_HASH_PEPPER") ?? "";
  return hmacSha256Hex(pepper, token);
}

// Verify a Svix-compatible signature (Resend uses Svix).
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("SUPPORT_EMAIL_WEBHOOK_SECRET") ?? "";
  if (!secret) return false;

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = await hmacSha256Base64(secret, signedContent);

  // svix-signature may contain multiple space-separated signatures; match any.
  const parts = svixSignature.split(" ");
  for (const part of parts) {
    if (part && timingSafeEqual(part, expected)) return true;
  }
  return false;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripQuotedContent(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^(On .+ wrote:|>|—\s*Reply above this line|Sent from)/i.test(t)) {
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function cleanBody(text: string | undefined, html: string | undefined): string {
  let out = text && text.trim() ? text : html ? stripHtmlToText(html) : "";
  out = stripQuotedContent(out);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function extractToken(to: unknown): string | null {
  const list = Array.isArray(to) ? to : [to];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const local = item.split("@")[0] ?? "";
    const idx = local.lastIndexOf("+");
    if (idx >= 0 && idx < local.length - 1) {
      const token = local.slice(idx + 1);
      if (/^[a-zA-Z0-9_-]{8,200}$/.test(token)) return token;
    }
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  if (!(await verifySignature(req, rawBody))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Malformed payload" }, 400);
  }

  // Resend wraps some payloads in { type, data }; handle both.
  const data = (payload.data ?? payload) as Record<string, unknown>;

  const fromRaw = data.from;
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";
  const to = data.to;

  // Sender email (strip optional display name).
  const senderEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
  if (!senderEmail) {
    return json({ error: "Missing sender" }, 400);
  }

  // Provider message id for replay protection.
  const headers = (data.headers ?? {}) as Record<string, unknown>;
  const providerMessageId =
    (typeof headers["message-id"] === "string" ? headers["message-id"] : "") ||
    (typeof data.id === "string" ? data.id : "") ||
    (typeof data.message_id === "string" ? data.message_id : "");
  if (!providerMessageId) {
    return json({ error: "Missing message id" }, 400);
  }

  // Reject executable / oversized attachments before doing anything.
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  for (const att of attachments) {
    const a = att as Record<string, unknown>;
    const fileName = typeof a.filename === "string" ? a.filename : "";
    const ext = (fileName.split(".").pop() ?? "").toLowerCase();
    if (BLOCKED_ATTACHMENT_EXT.has(ext)) {
      return json({ error: "Attachment type not allowed" }, 400);
    }
    const size = typeof a.size === "number" ? a.size : 0;
    if (size > 10 * 1024 * 1024) {
      return json({ error: "Attachment too large" }, 400);
    }
  }

  // Identify the ticket via the scoped reply token.
  const token = extractToken(to);
  if (!token) {
    return json({ error: "No ticket reference found" }, 400);
  }

  const tokenHashed = await tokenHash(token);
  const { data: tokenRow } = await supabaseAdmin
    .from("internal_ticket_reply_tokens")
    .select("id, ticket_id, customer_email, expires_at, used_at, revoked_at")
    .eq("token_hash", tokenHashed)
    .maybeSingle();

  if (!tokenRow) {
    return json({ error: "Unknown ticket reference" }, 404);
  }
  if (tokenRow.revoked_at || tokenRow.used_at) {
    return json({ error: "Reply token no longer valid" }, 403);
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return json({ error: "Reply token expired" }, 403);
  }
  if (senderEmail.toLowerCase() !== tokenRow.customer_email.toLowerCase()) {
    return json({ error: "Sender not authorised for this ticket" }, 403);
  }

  // Replay protection: dedupe by provider message id.
  const { data: existingEvent } = await supabaseAdmin
    .from("internal_ticket_inbound_events")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (existingEvent) {
    return json({ ok: true, duplicate: true }, 200);
  }

  const body = cleanBody(
    typeof data.text === "string" ? data.text : undefined,
    typeof data.html === "string" ? data.html : undefined,
  );
  if (!body) {
    return json({ error: "Empty message body" }, 400);
  }
  if (body.length > 20000) {
    body = body.slice(0, 20000);
  }

  // Mark the token used + record the inbound event, then create the message.
  await supabaseAdmin
    .from("internal_ticket_reply_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
    "internal_add_customer_reply",
    {
      p_ticket_id: tokenRow.ticket_id,
      p_message_body: body,
      p_sender_email: senderEmail,
      p_email_message_id: providerMessageId,
    },
  );

  if (rpcErr) {
    return json({ error: "Failed to save reply" }, 500);
  }

  await supabaseAdmin.from("internal_ticket_inbound_events").insert({
    provider_message_id: providerMessageId,
    ticket_id: tokenRow.ticket_id,
  }).catch(() => {});

  return json({ ok: true, status: (rpcResult as { status?: string })?.status ?? "created" }, 200);
});
