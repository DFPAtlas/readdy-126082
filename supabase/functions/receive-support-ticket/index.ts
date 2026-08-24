import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_BYTES = 64_000;
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const NONCE_WINDOW_MS = 24 * 60 * 60 * 1000;

const CATEGORIES = new Set([
  "general", "technical", "account", "billing", "access",
  "bug", "complaint", "feature_request", "security", "other",
]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent", "critical"]);
const PUBLIC_PRIORITIES = new Set(["low", "normal", "high"]);

const LIMITS: Record<string, number> = {
  siteSlug: 100,
  name: 150,
  email: 320,
  phone: 50,
  subject: 250,
  description: 20000,
  externalReference: 200,
  sourcePageUrl: 2000,
};

type Json = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

function hashSubject(value: string): Promise<string> {
  const pepper = Deno.env.get("TICKET_HASH_PEPPER") ?? "";
  return hmacSha256Hex(pepper, value.trim().toLowerCase());
}

function corsHeadersFor(origin: string | null) {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "content-type, x-dfp-site, x-dfp-key, x-dfp-timestamp, x-dfp-nonce, x-dfp-signature, x-idempotency-key, x-dfp-turnstile-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body: Json, status: number, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
    status,
  });
}

function correlationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function checkLength(value: string, key: string): string | null {
  if (value.length > LIMITS[key]) return key;
  return null;
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function urlCount(text: string): number {
  const matches = text.match(/https?:\/\/[^\s]+/g);
  return matches ? matches.length : 0;
}

async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  siteId: string,
  bucket: string,
  subjectHash: string,
  windowSeconds: number,
  max: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

  const { data, error } = await supabaseAdmin.rpc("internal_ticket_rate_limit_hit", {
    p_site_id: siteId,
    p_bucket: bucket,
    p_subject_hash: subjectHash,
    p_window_start: windowStart,
    p_max: max,
  });

  if (error || !data) {
    return { allowed: true };
  }

  const count = (data as { count: number }).count;
  if (count > max) {
    const retryMs = windowMs - (Date.now() % windowMs);
    return { allowed: false, retryAfter: Math.ceil(retryMs / 1000) };
  }
  return { allowed: true };
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("TICKET_CREDENTIAL_ENCRYPTION_KEY") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function decryptSecret(cipher: string): Promise<string> {
  const key = await getEncryptionKey();
  const full = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  const iv = full.slice(0, 12);
  const ct = full.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return decoder.decode(pt);
}

serve(async (req: Request) => {
  const requestId = correlationId();
  const method = req.method;
  const originHeader = req.headers.get("origin");

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersFor(originHeader), status: 204 });
  }

  if (method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405, originHeader);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let rawBody: string;
  let body: Json;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return json({ success: false, error: "Content-Type must be application/json" }, 415, originHeader);
    }
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) {
      return json({ success: false, error: "Request body too large" }, 413, originHeader);
    }
    rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return json({ success: false, error: "Request body too large" }, 413, originHeader);
    }
    body = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Invalid request body" }, 400, originHeader);
    }
  } catch {
    return json({ success: false, error: "Malformed JSON" }, 400, originHeader);
  }

  try {
    const siteSlug = cleanText(body.siteSlug ?? req.headers.get("x-dfp-site"));
    if (!siteSlug) {
      return json({ success: false, error: "Site slug is required" }, 400, originHeader);
    }
    if (siteSlug.length > LIMITS.siteSlug) {
      return json({ success: false, error: "Site slug too long" }, 400, originHeader);
    }

    const { data: site, error: siteErr } = await supabaseAdmin
      .from("internal_support_sites")
      .select("id, site_slug, site_name, project_id, is_active")
      .eq("site_slug", siteSlug)
      .maybeSingle();

    if (siteErr || !site) {
      return json({ success: false, error: "Source not recognised" }, 401, originHeader);
    }
    if (!site.is_active) {
      return json({ success: false, error: "Source is inactive" }, 403, originHeader);
    }

    const signature = cleanText(req.headers.get("x-dfp-signature"));
    const keyPrefix = cleanText(req.headers.get("x-dfp-key"));
    const mode: "server_to_server" | "public_form" = signature ? "server_to_server" : "public_form";

    let credential: {
      id: string;
      key_prefix: string;
      secret_ciphertext: string | null;
      allowed_origins: string[];
      turnstile_required: boolean;
      elevated_priority_allowed: boolean;
      is_active: boolean;
    } | null = null;

    const clientQuery = supabaseAdmin
      .from("internal_ticket_api_clients")
      .select(
        "id, key_prefix, secret_ciphertext, allowed_origins, turnstile_required, elevated_priority_allowed, is_active, integration_mode",
      )
      .eq("site_id", site.id)
      .eq("is_active", true);

    if (mode === "server_to_server") {
      if (!keyPrefix) {
        return json({ success: false, error: "Key prefix is required for signed requests" }, 401, originHeader);
      }
      const { data: creds } = await clientQuery.eq("key_prefix", keyPrefix).eq("integration_mode", "server_to_server");
      credential = (creds?.[0] as typeof credential) ?? null;
      if (!credential) {
        return json({ success: false, error: "Invalid credentials" }, 401, originHeader);
      }
    } else {
      const { data: creds } = await clientQuery.eq("integration_mode", "public_form");
      credential = (creds?.[0] as typeof credential) ?? null;
    }

    const allowedOrigins: string[] = credential?.allowed_origins ?? [];
    let responseOrigin: string | null = null;

    if (originHeader) {
      if (!allowedOrigins.includes(originHeader)) {
        return json({ success: false, error: "Origin not allowed" }, 403, null);
      }
      responseOrigin = originHeader;
    } else if (mode === "server_to_server") {
      responseOrigin = null;
    } else {
      return json({ success: false, error: "Origin required" }, 403, null);
    }

    if (mode === "server_to_server") {
      const timestamp = cleanText(req.headers.get("x-dfp-timestamp"));
      const nonce = cleanText(req.headers.get("x-dfp-nonce"));
      const secret = credential?.secret_ciphertext
        ? await decryptSecret(credential.secret_ciphertext)
        : null;

      if (!secret) {
        return json({ success: false, error: "Credential verification failed" }, 401, responseOrigin);
      }
      if (!timestamp || !nonce || !signature) {
        return json({ success: false, error: "Missing signature headers" }, 401, responseOrigin);
      }

      const tsMs = Date.parse(timestamp);
      if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > TIMESTAMP_WINDOW_MS) {
        return json({ success: false, error: "Request timestamp out of range" }, 401, responseOrigin);
      }

      const bodyHash = await sha256Hex(rawBody);
      const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
      const expected = await hmacSha256Hex(secret, canonical);
      if (!timingSafeEqual(expected, signature.toLowerCase())) {
        return json({ success: false, error: "Invalid signature" }, 401, responseOrigin);
      }
    }

    if (mode === "public_form" && credential?.turnstile_required) {
      const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
      const devMode = Deno.env.get("TICKET_DEV_MODE") === "true";
      const token = cleanText(
        body.turnstileToken ?? body.captchaToken ?? req.headers.get("x-dfp-turnstile-token"),
      );

      if (!turnstileSecret) {
        if (devMode) {
          // controlled development fallback
        } else {
          return json({ success: false, error: "Verification unavailable" }, 503, responseOrigin);
        }
      } else if (!token) {
        return json({ success: false, error: "CAPTCHA token required" }, 400, responseOrigin);
      } else {
        const form = new URLSearchParams();
        form.set("secret", turnstileSecret);
        form.set("response", token);
        const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          body: form,
        });
        if (!cfRes.ok) {
          return json({ success: false, error: "CAPTCHA verification failed" }, 403, responseOrigin);
        }
        const cfData = (await cfRes.json()) as { success?: boolean };
        if (!cfData.success) {
          return json({ success: false, error: "CAPTCHA verification failed" }, 403, responseOrigin);
        }
      }
    }

    const customer = (body.customer ?? {}) as Json;
    const ticket = (body.ticket ?? {}) as Json;

    const name = cleanText(customer.name);
    const email = cleanText(customer.email);
    const phone = cleanText(customer.phone);
    const subject = cleanText(ticket.subject);
    const description = cleanText(ticket.description);
    const category = cleanText(ticket.category);
    let priority = cleanText(ticket.priority) || "normal";
    const sourcePageUrl = cleanText(ticket.sourcePageUrl);
    const externalReference = cleanText(body.externalReference);
    const consentAccepted = body.consent && (body.consent as Json).privacyAccepted === true;

    const fieldErrors: string[] = [];
    if (!name) fieldErrors.push("customer.name is required");
    if (!email) fieldErrors.push("customer.email is required");
    if (!subject) fieldErrors.push("ticket.subject is required");
    if (!description) fieldErrors.push("ticket.description is required");
    if (!consentAccepted) fieldErrors.push("consent.privacyAccepted must be true");
    if (email && !isValidEmail(email)) fieldErrors.push("customer.email is invalid");
    if (!CATEGORIES.has(category)) fieldErrors.push("ticket.category is invalid");
    if (!PRIORITIES.has(priority)) fieldErrors.push("ticket.priority is invalid");
    if (sourcePageUrl && !isValidUrl(sourcePageUrl)) fieldErrors.push("ticket.sourcePageUrl is invalid");

    for (const [val, key] of [
      [name, "name"], [email, "email"], [phone, "phone"], [subject, "subject"],
      [description, "description"], [externalReference, "externalReference"],
      [sourcePageUrl, "sourcePageUrl"],
    ] as Array<[string, string]>) {
      if (val) {
        const tooLong = checkLength(val, key);
        if (tooLong) fieldErrors.push(`${tooLong} is too long`);
      }
    }

    if (fieldErrors.length > 0) {
      return json({ success: false, error: "Validation failed", fields: fieldErrors }, 400, responseOrigin);
    }

    if (!PUBLIC_PRIORITIES.has(priority)) {
      if (mode === "server_to_server" && credential?.elevated_priority_allowed) {
        // trusted integration may use urgent/critical
      } else {
        priority = "high";
      }
    }

    const honeypot = cleanText(body.website_alt ?? body.company_alt ?? body.phone_alt ?? body.honeypot);
    if (honeypot) {
      return json({ success: true, ticketNumber: null, message: "Thank you, your message has been received." }, 201, responseOrigin);
    }
    if (urlCount(description) > 5) {
      return json({ success: false, error: "Too many links in description" }, 400, responseOrigin);
    }

    const nonce = cleanText(body.nonce ?? req.headers.get("x-dfp-nonce"));
    const timestampRaw = cleanText(body.timestamp ?? req.headers.get("x-dfp-timestamp"));
    const idempotencyKey = cleanText(body.idempotencyKey ?? req.headers.get("x-idempotency-key"));

    if (mode === "public_form") {
      if (!nonce) {
        return json({ success: false, error: "nonce is required" }, 400, responseOrigin);
      }
      if (nonce.length > 128) {
        return json({ success: false, error: "nonce too long" }, 400, responseOrigin);
      }
      if (timestampRaw) {
        const tsMs = Date.parse(timestampRaw);
        if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > NONCE_WINDOW_MS) {
          return json({ success: false, error: "Timestamp out of range" }, 400, responseOrigin);
        }
      }
    }

    const nonceHash = nonce ? await hashSubject(nonce) : null;
    const idempotencyHash = idempotencyKey ? await hashSubject(idempotencyKey) : null;

    const clientIp =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const networkHash = await hashSubject(clientIp);
    const emailHash = await hashSubject(email);

    const netLimit = await checkRateLimit(supabaseAdmin, site.id, "net", networkHash, 15 * 60, 5);
    if (!netLimit.allowed) {
      return json({ success: false, error: "Too many requests", retryAfter: netLimit.retryAfter }, 429, responseOrigin);
    }
    const emailLimit = await checkRateLimit(supabaseAdmin, site.id, "email", emailHash, 60 * 60, 3);
    if (!emailLimit.allowed) {
      return json({ success: false, error: "Too many requests", retryAfter: emailLimit.retryAfter }, 429, responseOrigin);
    }

    const context = (body.context ?? {}) as Json;
    const metadata: Json = {};
    if (sourcePageUrl) metadata.sourcePageUrl = sourcePageUrl;
    const ctxKeys = Object.keys(context);
    if (ctxKeys.length > 0) {
      const cleanCtx: Json = {};
      for (const k of ctxKeys) {
        const v = context[k];
        if (typeof v === "string") cleanCtx[k] = v.slice(0, 500);
        else if (v === null || ["number", "boolean"].includes(typeof v)) cleanCtx[k] = v;
        else if (typeof v === "object") cleanCtx[k] = JSON.stringify(v).slice(0, 1000);
      }
      metadata.context = cleanCtx;
    }

    const source = mode === "server_to_server" ? "api" : "website";
    const customerUserIdRaw = (body.customer as Json)?.customerUserId;
    const customerUserId = typeof customerUserIdRaw === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerUserIdRaw)
      ? customerUserIdRaw
      : null;

    const { data: result, error: rpcErr } = await supabaseAdmin.rpc(
      "internal_create_support_ticket",
      {
        p_site_id: site.id,
        p_project_id: site.project_id ?? null,
        p_external_reference: externalReference || null,
        p_customer_user_id: customerUserId,
        p_customer_name: name,
        p_customer_email: email,
        p_customer_phone: phone || null,
        p_subject: subject,
        p_description: description,
        p_category: category,
        p_priority: priority,
        p_source: source,
        p_metadata: metadata,
        p_nonce_hash: nonceHash,
        p_idempotency_hash: idempotencyHash,
      },
    );

    if (rpcErr) {
      const msg = rpcErr.message ?? "";
      if (msg.includes("NONCE_REPLAY")) {
        return json({ success: false, error: "Request already processed" }, 409, responseOrigin);
      }
      if (msg.includes("IDEMPOTENCY_IN_PROGRESS")) {
        return json({ success: false, error: "Request in progress, retry shortly" }, 409, responseOrigin);
      }
      if (msg.includes("SITE_INACTIVE")) {
        return json({ success: false, error: "Source is inactive" }, 403, responseOrigin);
      }
      return json({ success: false, error: "Failed to create ticket", requestId }, 500, responseOrigin);
    }

    const created = (result ?? {}) as { status?: string; ticket_number?: string };
    const isNew = created.status === "created";
    const isDup = created.status === "duplicate_idempotency" ||
      created.status === "duplicate_external_reference";
    const ticketNumber = created.ticket_number ?? null;

    if (credential?.id) {
      await supabaseAdmin
        .from("internal_ticket_api_clients")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", credential.id);
    }

    if (isNew) {
      return json({
        success: true,
        ticketNumber,
        message: "Thank you, your message has been received.",
      }, 201, responseOrigin);
    }
    if (isDup) {
      return json({
        success: true,
        ticketNumber,
        message: "Thank you, your message has been received.",
      }, 200, responseOrigin);
    }

    return json({ success: false, error: "Unexpected result", requestId }, 500, responseOrigin);
  } catch (err) {
    return json({ success: false, error: "Internal error", requestId }, 500, null);
  }
});
