# GuardianHub inbound support mapping

This migration adds `support@guardian-hub.uk` to the existing active GuardianHub site. It preserves `guardianhub@digital-footprint.uk` and does not alter the site's support sender, status, n8n credentials, permissions or AI dispatch settings.

## Preconditions and behavior

The active, unarchived site must match both slug `guardianhub` and domain `guardian-hub.uk`. Missing or ambiguous sites abort the migration. A conflicting address assignment also aborts rather than silently moving or reactivating it. Reapplying an already correct mapping is a no-op.

## Verify after application

```sql
select a.address, a.purpose, a.is_active, s.site_slug, s.domain
from public.internal_support_inbound_addresses a
join public.internal_support_sites s on s.id = a.site_id
where a.address in ('support@guardian-hub.uk', 'guardianhub@digital-footprint.uk');
```

Expect both addresses mapped to GuardianHub with purpose ticket and is_active true.

Send one new test email with a unique subject to the custom-domain support address. Confirm exactly one GuardianHub ticket and inbound event are recorded. Use a staff reply from that ticket to test subsequent customer threading; replying to the earlier standalone manual delivery test does not prove ticket threading.

The earlier Resend test was received but had no matching ticket/inbound event when checked. Adding a route does not automatically replay that historical message. Do not replay or resend it without checking deduplication and possible notifications first.

Ticket ingestion does not prove HAL/TRON processing. Verify the configured existing triage/reply routes and inspect their actual run results separately; leave automated sending off.

## Deployment

Merge, then apply the migration to the DFP Command database. Pulling/publishing Readdy alone does not apply it. No frontend build is required for this data-only change.
