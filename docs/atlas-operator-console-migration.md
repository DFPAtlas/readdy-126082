# Atlas Operator Console migration and release checks

This branch adds the first database foundation and a DFP Command admin selector. It does not register a WebRTC extension, connect FreePBX, provision a trunk, or place calls.

## Existing records and authority

- `ai_sites.id` is the canonical group-site UUID; `site_key` is the stable app slug.
- `internal_support_sites.id` remains the support-system key. Its new `ai_site_id` links to the group site. The migration backfills only exact `site_slug = site_key` matches.
- `pbx_tenants.id` remains the phone-system key. Its `ai_site_id` is set when a tenant is deliberately provisioned. No tenant is created here.
- `operator_pads` and `operator_pad_sites` register a pad and its allowed sites. A pad key is an identifier, not an authentication secret. Staff still sign in.
- `operator_interactions` links a site, correlation ID, optional PBX call log and optional support ticket. A trigger rejects links to a different site.
- `operator_ai_handoffs` stores a structured summary and transcript reference. Raw transcripts remain in their source system.

## Deployment order

1. Apply `20260929144028_atlas_operator_foundation.sql` and verify the two existing support-site links. The admin form's new `ai_site_id` selection requires this column before the UI is deployed.
2. Apply `20260929144314_atlas_operator_site_access.sql`. It scopes reads on central support sites, tickets, messages, attachments, events and customer links. Owner/admin retain global access. Other active staff require `internal_staff_site_access` membership. Existing write policies are unchanged.
3. Deploy the DFP Command frontend. In **Admin → Support Integrations**, edit a site and verify the Group Site Registry selection persists. Register GarageFlow only after its group-site identity and support intake configuration are reviewed.
4. Do not expose PBX tables directly to a tablet yet: their older `app_private.is_internal()` policies are broader than the new operator site rule. A later PBX integration must restrict those reads and audit customer lookup RPCs before live calls.

## Verification matrix

Use a staging database or rollback-only transaction with representative owner, admin, assigned support agent, unassigned support agent, disabled staff and anonymous identities. Verify both direct Data API reads and app routes; do not rely on hidden UI controls.

| Identity | Expected result |
| --- | --- |
| Owner/admin | See all support sites and tickets; manage pads and handoffs. |
| Agent assigned to site A | See site A, its tickets and child records, assigned pad/sites and interaction handoffs. No site B records. |
| Agent without site A assignment | No site A tickets, child records or handoffs, even by known UUID. |
| Disabled staff | No pad metadata or site records. |
| Anonymous | No operator tables or helper execution. |

Additional checks:

- Backfill links only Digital Footprint and QuickGuard when those are the only exact site-key matches; unmatched sites remain null.
- Attempt to create an interaction for site A with a ticket or PBX call from site B; both must fail.
- A handoff arriving before its PBX call can first create an interaction using `(ai_site_id, correlation_id)` and link the call later.
- Duplicate `(ai_site_id, correlation_id)` and duplicate pad-site assignment must fail without creating a second record.
- In DFP Command, a new support site cannot be saved without selecting a group site; a duplicate group-site link returns a safe error.
- Retest ticket inbox, ticket detail, support integration admin and customer lookup RPCs with assigned and unassigned staff. The RPC audit is a release gate for real customer data.

## Rollback

The frontend can be reverted independently. The foundation migration is additive and its tables can remain dormant. If scoped support reads interrupt operations, restore the previous SELECT policies from the pre-deployment snapshot while leaving the new schema intact. Do not drop populated interaction or handoff records as a routine rollback.
