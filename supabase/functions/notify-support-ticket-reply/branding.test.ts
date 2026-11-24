import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSupportReply } from "./branding.ts";

test("GuardianHub uses its verified identity and escaped branded content", () => {
  const mail = renderSupportReply({site_slug:"guardianhub",domain:"guardian-hub.uk"}, "support@digital-footprint.uk", "DFP-2026-000029", '<script>alert("x")</script>\nThanks & welcome');
  assert.equal(mail.from,"GuardianHub Support <support@guardian-hub.uk>");
  assert.equal(mail.subject,"[DFP-2026-000029] GuardianHub Support");
  assert.ok(mail.html.includes("#0a0e1a") && mail.html.includes("#2563eb"));
  assert.ok(mail.html.includes("&lt;script&gt;") && !mail.html.includes("<script>"));
  assert.ok(mail.html.includes("Thanks &amp; welcome"));
  assert.ok(mail.text.includes('Thanks & welcome') && mail.html.includes("owned and operated"));
});
test("other and missing sites retain the deployed default identity and styling", () => {
  for (const site of [null, {site_slug:"quickguard",domain:"other.uk"}, {site_slug:"guardianhub",domain:"other.uk"}, {site_slug:"other",domain:"guardian-hub.uk"}]) {
    const mail=renderSupportReply(site,"support@digital-footprint.uk","DFP-1","Hello");
    assert.equal(mail.from,"Digital Footprint Support <support@digital-footprint.uk>");
    assert.equal(mail.subject,"[DFP-1] Reply from Digital Footprint Support");
    assert.ok(mail.html.includes("background:#ffffff") && !mail.html.includes("<h1"));
  }
});

test("QuickGuard uses its verified support identity and escapes email content", () => {
  const mail = renderSupportReply({site_slug:"quickguard",domain:"quickguard.uk"},
    "support@digital-footprint.uk", "DFP-2026-000031", "<script>unsafe</script>\nThanks & welcome");
  assert.equal(mail.from, "QuickGuard Support <support@quickguard.uk>");
  assert.equal(mail.subject, "[DFP-2026-000031] Reply from QuickGuard Support");
  assert.ok(mail.html.includes("QuickGuard Support"));
  assert.ok(mail.text.startsWith("QuickGuard Support"));
  assert.ok(mail.html.includes("&lt;script&gt;") && !mail.html.includes("<script>"));
  assert.ok(mail.html.includes("Thanks &amp; welcome"));
});
