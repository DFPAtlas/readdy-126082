# Verification matrix — unverified inbound email receiver

Current status: receiver source and migration committed to draft PR #12; **not deployed**. These tests must be performed on an isolated staging database with a separate shared secret.

| Case | Expected result |
| --- | --- |
| Missing / short server secret | 503, no write |
| GET request | 405, no write |
| Valid signed QuickGuard support email | 200, exactly one restricted intake record |
| Same provider ID retried, even with changed body | 200, original record not overwritten |
| Invalid HMAC or missing signature | 401, no write |
| Timestamp older/newer than five minutes | 401, no write |
| Oversized payload | 413, no write |
| Wrong site slug, wrong recipient, malformed sender, empty ID | 400, no write |
| Inactive QuickGuard support source | 403, no write |
| Database outage | 503, sender must retry |
| Authenticated customer queries restricted intake table | Denied / no rows |
| Operator review | Staff-only, no customer visibility |
| Automatic customer email | Must not occur |

Additional blockers before rollout: provide the companion QuickGuard signed outbox worker; isolate secrets; verify migration and unique constraint; test DFP receiving persistence; implement secure staff UI; document retention and audit verification; confirm that all customer-visible ticket triggers are bypassed. Existing customer ticket/message receivers remain untouched.
