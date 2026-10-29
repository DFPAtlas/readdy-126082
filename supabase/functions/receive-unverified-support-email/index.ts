import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const reply = (code: number, body: object) => new Response(JSON.stringify(body), {
  status: code, headers: { "content-type": "application/json" }
});
const encoder = new TextEncoder();
async function signature(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string): boolean {
  if(a.length !== b.length) return false;
  let diff = 0;
  for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async req => {
  if(req.method !== "POST") return reply(405,{error:"Method not allowed"});
  const key = Deno.env.get("DFP_UNVERIFIED_EMAIL_SHARED_SECRET");
  if(!key || key.length < 32) return reply(503,{error:"Not configured"});
  const timestamp = req.headers.get("x-dfp-timestamp") ?? "";
  const supplied = req.headers.get("x-dfp-signature") ?? "";
  const ms = Date.parse(timestamp);
  if(!Number.isFinite(ms) || Math.abs(Date.now()-ms)>300000) return reply(401,{error:"Invalid timestamp"});
  const bodyText = await req.text();
  if(encoder.encode(bodyText).length > 24000) return reply(413,{error:"Too large"});
  const expected = await signature(key, timestamp + "\n" + bodyText);
  if(!equal(expected, supplied.toLowerCase())) return reply(401,{error:"Invalid signature"});
  let data: Record<string, unknown>;
  try { data=JSON.parse(bodyText); } catch { return reply(400,{error:"Invalid JSON"}); }
  const {siteSlug,providerEmailId,from,to,subject,text,receivedAt}=data;
  if(siteSlug !== "quickguard" || typeof providerEmailId !== "string" ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(providerEmailId) ||
    typeof from !== "string" || from.length > 320 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(from) ||
    typeof to !== "string" || to.toLowerCase() !== "support@quickguard.uk" ||
    typeof subject !== "string" || subject.length > 500 ||
    typeof text !== "string" || text.length > 20000 ||
    typeof receivedAt !== "string" || !Number.isFinite(Date.parse(receivedAt))) {
    return reply(400,{error:"Invalid email fields"});
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:site}=await db.from("internal_support_sites").select("id").eq("site_slug",siteSlug).eq("is_active",true).maybeSingle();
  if(!site) return reply(403,{error:"Site disabled"});
  // Persist first; duplicate provider IDs are acknowledged without overwriting the prior record.
  const {error}=await db.from("internal_unverified_email_intake").upsert({
    site_slug:siteSlug, provider_message_id:providerEmailId, sender_email:from, recipient_email:to,
    subject, body_text:text, received_at:new Date(receivedAt).toISOString()
  },{onConflict:"site_slug,provider_message_id",ignoreDuplicates:true});
  if(error) return reply(503,{error:"Storage unavailable"});
  return reply(200,{accepted:true,providerEmailId});
});
