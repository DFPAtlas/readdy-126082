// Run with Node 22.18+ (native TypeScript support): node supabase/tests/quickguard_reply_branding.mjs
import assert from "node:assert/strict";
import { renderSupportReply } from "../functions/notify-support-ticket-reply/branding.ts";

const reply = renderSupportReply({ site_slug: "quickguard", domain: "quickguard.uk" },
  "support@digital-footprint.uk", "DFP-2026-000031", "Hello <script>alert(1)</script>\nNext line");
assert.equal(reply.from, "QuickGuard Support <support@quickguard.uk>");
assert.equal(reply.subject, "[DFP-2026-000031] Reply from QuickGuard Support");
assert.ok(reply.html.includes("QuickGuard Support"));
assert.ok(reply.html.includes("&lt;script&gt;"));
assert.ok(!reply.html.includes("<script>"));
assert.ok(reply.text.startsWith("QuickGuard Support"));
assert.equal(renderSupportReply({ site_slug: "guardianhub", domain: "guardian-hub.uk" },
  "support@digital-footprint.uk", "T1", "Hello").from, "GuardianHub Support <support@guardian-hub.uk>");
for (const site of [null, { site_slug: "other", domain: "other.uk" },
  { site_slug: "quickguard", domain: "other.uk" }]) {
  assert.equal(renderSupportReply(site, "support@digital-footprint.uk", "T1", "Hello").from,
    "Digital Footprint Support <support@digital-footprint.uk>");
}
console.log("PASS: QuickGuard email identity, escaping and fallback sender selection");
