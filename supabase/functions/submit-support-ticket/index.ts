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

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let fields: Record<string, string> = {};

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      fields = body && typeof body === "object" ? body : {};
    } else {
      // application/x-www-form-urlencoded (plain HTML form post)
      const raw = await req.text();
      const params = new URLSearchParams(raw);
      fields = {};
      for (const [k, v] of params.entries()) {
        fields[k] = v;
      }
    }

    const pick = (k: string) => (fields[k] ?? "").toString().trim();

    const name = pick("submitted_by") || pick("name");
    const email = pick("submitted_email") || pick("email");
    const subject = pick("ticket_title") || pick("subject");
    const message = pick("ticket_description") || pick("message");
    const honeypot = pick("website_alt") || pick("company_alt") || pick("phone_alt");

    // Honeypot: bots fill this, return fake success, store nothing.
    if (honeypot) {
      return json({ ok: true, received: true }, 200);
    }

    if (!subject) {
      return json({ ok: false, error: "Subject is required" }, 400);
    }
    if (!message) {
      return json({ ok: false, error: "Message is required" }, 400);
    }
    if (message.length > 10000) {
      return json({ ok: false, error: "Message is too long" }, 400);
    }
    if (email && !isValidEmail(email)) {
      return json({ ok: false, error: "Email address is invalid" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await supabaseAdmin.from("digital_footprint_support").insert({
      ticket_title: subject,
      ticket_description: message,
      submitted_by: name || null,
      submitted_email: email || null,
      status: "Open",
      priority: "Medium",
    });

    if (error) {
      return json({ ok: false, error: "Failed to save ticket" }, 500);
    }

    return json({ ok: true, received: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ ok: false, error: message }, 500);
  }
});
