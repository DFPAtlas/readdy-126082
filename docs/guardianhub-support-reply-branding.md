# GuardianHub staff-reply branding

Deploy `notify-support-ticket-reply` with its new `branding.ts` module after merge. No database migration or GuardianHub website publication is required.

The server resolves the ticket's site record; only slug `guardianhub` AND domain `guardian-hub.uk` select GuardianHub Support <support@guardian-hub.uk>. All other sites keep the deployed Digital Footprint sender fallback and white/grey styling. The site's editable support_email is not used as a sender authority.

GuardianHub gets a navy/blue HTML template, ticket reference, public website link and Digital Footprint ownership footer. A plain-text alternative is included. Reply content and ticket references are HTML-escaped. No remote logo or tracking is added.

The deployed function was ahead of GitHub in its sender fallback and template. This PR incorporates that deployed baseline so deployment does not restore noreply@ or the old FootprintCC subject/greeting.

## Validation
Run `node --test supabase/functions/notify-support-ticket-reply/branding.test.ts` with Node 24. Tests cover GuardianHub identity, escaped content, ownership footer and non-GuardianHub/mismatched-site fallbacks.

Before deployment confirm guardian-hub.uk remains verified for sending in Resend. After deployment send one approved staff reply from the existing GuardianHub test ticket. Confirm sender, subject, navy/blue appearance and plain text. Reply from the same Gmail account, then verify exactly one customer message on that same ticket and no new ticket. The scoped Reply-To token and threading headers are intentionally unchanged.

These tests do not prove inbox rendering or deployed delivery. No test email is sent by this PR. New-ticket notifications and the wider Email Studio brand-kit integration remain outside this staff-reply change.
