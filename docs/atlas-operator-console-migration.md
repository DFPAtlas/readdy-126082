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

The pad's first customer lookup uses `operator_search_site_ticket_customers` and
`operator_get_site_ticket_context`. Both require the assigned support site and
read only tickets within it. Search returns a masked preview, and detail is
limited to the selected ticket. Customers without an existing support ticket
remain unavailable until a site connector with its own access checks is built.
The older `support_search_customers*` and `support_get_customer_360` functions
remain global support tools and must not be called by the pad.

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
- For operator lookup, verify an assigned ticket can be found, a ticket from
  another site cannot be found even by known email or UUID, and anonymous users
  cannot execute either operator function. Keep the full ticket contact panel
  behind the caller verification step in the UI.

## Isolated database verification — 29 September 2026

PASS using the uploaded production schema-only snapshot in a temporary Supabase
branch (`atlas-operator-schema-staging`). The snapshot contained 1,120 public
tables, 296 functions and 2,567 policies, and no COPY/INSERT data statements.
SHA-256: `3dbef6b4ee930c868d5098ba52112c0d2b57195fc95fbcd46f172e109407ce8c`.
The snapshot was restored into the empty branch, then both Atlas migrations were
executed successfully. The resulting database contained 1,124 public tables.

`supabase/tests/atlas_operator_access.sql` passed with synthetic fixtures:
owner/admin global visibility; assigned viewer site A only; unassigned and
disabled viewers no records; ticket child records and handoffs inherit site
visibility; site-scoped customer search/context; anonymous table/RPC grants
revoked; cross-site ticket and PBX links rejected; duplicate interactions and
pad assignments rejected; viewer pad writes rejected. Fixtures rolled back;
zero test users and pads remained. The branch was deleted after verification.
Production schema, data and migration history were not changed.

### Repeat the database test

Use a fresh, isolated Supabase-compatible database, with managed auth schemas
and roles present. Restore the schema-only snapshot before the Atlas migrations.
Do not replay historical migrations on top of this current snapshot. With
`ATLAS_STAGING_DB_URL` set locally to the isolated target, run:

```sh
psql "$ATLAS_STAGING_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f schema.sql
psql "$ATLAS_STAGING_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260929144028_atlas_operator_foundation.sql -f supabase/migrations/20260929144314_atlas_operator_site_access.sql
psql "$ATLAS_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/atlas_operator_access.sql
```

The raw snapshot remains a private export rather than a checked-in deployment
migration. It describes the entire shared database and is not safe to apply to
production as an additive migration.

### Frontend component verification — 29 September 2026

Ten isolated DOM component checks passed with mocked Supabase responses:
anonymous direct ticket route redirects; disabled staff denied without invitation
acceptance; MFA exception and API error block protected content; retry recovers;
no verified factor redirects to setup; aal1 redirects to verification; active
aal2 staff can render protected content; missing group site blocks registration;
selected group ID is submitted; duplicate group links show a safe error.

Fixed AuthGuard's former MFA exception fallback, which returned `satisfied`.
MFA failures now display a retry screen. Existing inactive roles and role-query
errors return no access without calling invitation acceptance. Targeted lint
had zero errors and the existing React Fast Refresh export warning.
These are component regressions, not live sign-in or end-to-end ticket tests.

### Remaining release gates

Automatic branch creation still fails when replaying production's incomplete
historical migration history. This manual snapshot restore establishes isolated
SQL compatibility and database access checks; it does not repair automatic
branch provisioning. A separate migration-history reconciliation is required
before claiming automatic branching is fixed.

Browser sign-in, app-route access, ticket inbox/detail and the admin selector
save/error flow still need staging verification. Database role tests do not
replace those frontend checks or real FreePBX/WebRTC call tests.

## Rollback

The frontend can be reverted independently. The foundation migration is additive and its tables can remain dormant. If scoped support reads interrupt operations, restore the previous SELECT policies from the pre-deployment snapshot while leaving the new schema intact. Do not drop populated interaction or handoff records as a routine rollback.
