# Automatic inbound email → DFP Command (Phase 3B)
**Status: development design, no production changes.**
**Source:** QuickGuard Resend `email.received` → signature-verified QuickGuard staging → authenticated service-to-service DFP Command intake.

## Current contracts verified
- QuickGuard already stores Resend messages in `app.support_inbound_emails` with unique `resend_email_id`; receipt requires verified Svix signature.
- Existing DFP `receive-support-ticket` creates ordinary support tickets but assumes `consent.privacyAccepted === true`; do **not** falsely assign consent based on an email.
- Existing DFP `receive-support-message` matches existing tickets and appends **customer-visible** follow-ups. Never use it for unverified email content.
- DFP `public.internal_support_tickets` has nullable customer identity, a `metadata` JSONB field, and source/site references. `public.internal_ticket_inbound_events` stores provider message identifiers, but a dedicated per-site deduplication key and transactional inbox binding still need verification.
- Existing central QuickGuard site is active. The current QuickGuard admin inbox remains an independent safety fallback until cutover proves reliable.

## New protected ingestion path
1. Resend → QuickGuard receiver. Verify webhook signature and store metadata/text privately, deduplicating by `resend_email_id`. Return HTTP 200 only after durable storage.
2. A **QuickGuard service worker**, not the webhook and not an end-user browser, claims unsent staged records in bounded batches. Sign the exact JSON body with the existing DFP HMAC service credential and send to a NEW central `receive-unverified-support-email` endpoint. Use `siteSlug`, `providerEmailId`, `from`, `to`, `subject`, `text`, `receivedAt`; no consent assertion and no customer user ID.
3. DFP endpoint verifies active site, credential, timestamp, nonce, signature, and size limits. Reject invalid recipients, irrelevant events, oversized content, malformed message IDs, or disabled sources. Require an allowlisted support recipient for the site.
4. In one database transaction, enforce uniqueness on `(site_id, provider_email_id)`, create the *unverified intake record* and either create a restricted **email intake** ticket or link to a previously approved ticket with verified threading. Never match by sender email or subject alone.
5. Mark `identity_status=unverified` and `source=email`. Keep raw text in a staff-only message/body record. Do not treat as an authenticated client message. No customer portal visibility, outbound replies, AI agent execution, or automatic DFP public ticket notifications before policies are reviewed.
6. DFP acknowledges a durable acceptance with stable central ID. QuickGuard records delivery and central ticket reference, with idempotent retry and dead-letter escalation. A failure in DFP must not lose the email.
7. Support staff work the intake in DFP Command: review, classify spam, independently verify account ownership, and explicitly promote/associate to a customer ticket. The QuickGuard admin inbox becomes a fallback/diagnostic view rather than a required routine approval step.

## Required separate implementation
- New DFP service endpoint and dedicated atomic stored procedure (do **not** reuse `receive-support-message` or fake `privacyAccepted`).
- Unique `(site_id, provider_email_id)` index; internal restricted intake status and staff-only RLS; audit transitions and explicit verification actor.
- QuickGuard transactional outbox/queue with leases, exponential backoff, max attempts, replay controls; do not mark delivered before a 2xx persisted acknowledgment.
- Admin view in DFP for unverified email intake, with role-limited actions, spam/attachment quarantine, retention and GDPR basis documented.
- Map QuickGuard ticket ID/reference only when a separate verified QuickGuard ticket exists. Avoid unnecessary duplicate parallel customer tickets.

## Safety/acceptance tests
- Valid webhook, invalid signature, replayed message ID, concurrent duplicate, out-of-order delivery, spoofed From/Reply-To, unauthenticated client, unknown sender, oversized payload, malicious HTML, attachments, auto-reply loops.
- Wrong HMAC, expired timestamp, forged nonce, cross-site ID, disabled site, DFP outage, timeout-after-commit retry, database transaction failure, duplicate central write, poison-message dead letter.
- A sender matching a QuickGuard account must **not** automatically acquire that customer's identity or ticket visibility.
- Verify user can view the email in the DFP staff inbox without creating a customer-visible ticket or sending an email.
- For a staged UAT email, verify one intake in QuickGuard and exactly one in DFP, and that source ID/replay correlation survive retries.
- Keep outbound replies, live cutover and AI actions disabled until tested in isolation and reviewed.

## Rollout / rollback
1. Migrate and test in isolated database; test SQL, auth, RLS, idempotency and worker concurrency.
2. Deploy new receiver and worker **disabled** with staff-only feature flag.
3. Replay a single non-sensitive test email; verify both database records and DFP staff UI.
4. Gradually enable ingestion for QuickGuard; keep other apps and current Resend route unchanged.
5. Roll back by disabling worker feature flag; queued mail stays in QuickGuard, existing mail reception unaffected.

## Dependencies
QuickGuard PR #110 (client verified-ticket creation) is a separate workflow; DFP message worker PR #109 only handles authenticated, customer-visible follow-ups and must not ingest unverified mail. This Phase 3B endpoint is deliberately separate.
