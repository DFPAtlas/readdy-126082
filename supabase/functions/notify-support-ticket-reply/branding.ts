type SupportSite = { site_slug?: string | null; domain?: string | null } | null;
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderSupportReply(
  site: SupportSite,
  fallbackAddress: string,
  ticketNumber: string,
  replyBody: string,
) {
  const guardian = site?.site_slug === "guardianhub" && site.domain === "guardian-hub.uk";
  const quickguard = site?.site_slug === "quickguard" && site.domain === "quickguard.uk";
  const label = quickguard ? "QuickGuard Support" : guardian ? "GuardianHub Support" : "Digital Footprint Support";
  const from = quickguard ? "QuickGuard Support <support@quickguard.uk>" : guardian ? "GuardianHub Support <support@guardian-hub.uk>" : `Digital Footprint Support <${fallbackAddress}>`;
  const subject = `[${ticketNumber}] ${quickguard ? "Reply from QuickGuard Support" : guardian ? "GuardianHub Support" : "Reply from Digital Footprint Support"}`;
  const number = escapeHtml(ticketNumber);
  const bodyHtml = escapeHtml(replyBody).replace(/\n/g, "<br>");
  const html = guardian ? `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GuardianHub Support</title></head>
<body style="margin:0;background:#0a0e1a;color:#e5e7eb;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0e1a;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#111827;border:1px solid #334155;border-radius:12px;">
<tr><td style="padding:28px 24px;border-top:4px solid #2563eb;"><p style="margin:0;color:#60a5fa;font-size:22px;font-weight:bold;">GuardianHub</p><h1 style="font-size:20px;margin:12px 0;color:#ffffff;">Support reply</h1><p style="margin:0;color:#cbd5e1;font-size:13px;">Ticket ${number}</p></td></tr>
<tr><td style="padding:0 24px 28px;color:#e5e7eb;font-size:16px;line-height:1.6;overflow-wrap:anywhere;">${bodyHtml}</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #334155;color:#cbd5e1;font-size:13px;line-height:1.6;">To continue this conversation, reply to this email.<br><a href="https://guardian-hub.uk" style="color:#93c5fd;">guardian-hub.uk</a><br>GuardianHub is owned and operated by <a href="https://digital-footprint.uk" style="color:#93c5fd;">Digital Footprint</a>.</td></tr>
</table></td></tr></table></body></html>` : `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#1a1a1a;">
      ${quickguard ? '<h1 style="font-size:22px;margin:0 0 20px;color:#1a1a1a;">QuickGuard Support</h1>' : ""}<p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:20px;">Ticket ${number}</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${bodyHtml}</div>
      <p style="margin:24px 0 0;font-size:13px;color:#888;">If you need anything else, just reply to this email.</p>
    </div>
  `;
  const text = `${label}\nTicket ${ticketNumber}\n\n${replyBody}\n\nTo continue this conversation, reply to this email.${guardian ? "\nhttps://guardian-hub.uk\nGuardianHub is owned and operated by Digital Footprint." : ""}`;
  return { from, subject, html, text };
}
