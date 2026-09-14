# Security — Production Readiness

## Scope

Production deployment evidence integrity for Digital Footprint Command: the current
GitHub SHA and the production verification result must come from trusted server-side
sources, never from the browser.

## 18E — Finding

`deployment_start(... p_head_sha ...)` trusted the browser's claim of the current
HEAD, and `deployment_complete_verification(... p_snapshot ...)` read PASS / FAIL /
UNKNOWN results straight from the client JSON. Either could be fabricated by an
authorised owner/admin.

## 18F — Remediation (Server-Side Deployment Sequencing)

Deployment transitions moved to protected server-side RPCs. This removed the direct
client write path but still accepted `p_head_sha` and the client `p_snapshot`.

## 18F2 — Authoritative Evidence Remediation

### Trust boundary

- **Current GitHub SHA** — resolved by the `deployment-start` Edge Function via
  `GITHUB_ACCESS_TOKEN` (secret storage only). The browser sends intent only
  (`project_id`, `launch_approval_id`, bookkeeping). Fail closed on
  `SHA_DRIFT` / `SHA_VERIFICATION_UNAVAILABLE`; never falls back to client SHA /
  cached UI / Last-Known-Good / approval SHA.
- **Production verification** — performed by the `deployment-verify` Edge Function
  over authoritative stored telemetry (freshness-checked). Only it may transition
  `VERIFYING → VERIFIED`. Client check results are ignored as security decisions.
- **Enforcement** — `deployment_start` and `deployment_complete_verification` reject
  non-`service_role` callers; `verification_authoritative` (service_role-writable
  only) is required by `deployment_accept`; BEFORE INSERT/UPDATE evidence guards
  block direct `DEPLOYING` / `VERIFIED` / authoritative-flag writes.

### Secrets

- `GITHUB_ACCESS_TOKEN` is read from Supabase secret storage inside Edge Functions
  only. It is never returned, logged, written to SQL, exposed in the browser, or
  included in activity records or error payloads.
- No raw authorization headers are logged.

### Security tests

| Test | Input | Expected |
| --- | --- | --- |
| Forged SHA | approved = A, HEAD = B, client claims A | deployment blocked |
| GitHub unavailable | authoritative lookup fails | no start; `SHA_VERIFICATION_UNAVAILABLE` |
| Valid SHA | approved = server-resolved HEAD | may start (if other conditions pass) |
| Forged verification | client claims all PASS, evidence UNKNOWN/FAIL | cannot become `VERIFIED` |
| Stale telemetry | stale "healthy" rows | not PASS; incomplete where mandatory |
| Authoritative verification | fresh evidence, all mandatory PASS | `VERIFYING → VERIFIED` |
| Legacy snapshot | pre-authoritative snapshot | rejected / re-verification required |

### RLS & privileges

- `internal_project_deployments` RLS is unchanged (owner/admin write, authenticated
  read, no anonymous access).
- Evidence-guard triggers run `SECURITY DEFINER` and inspect `auth.role()` so a
  browser caller (role `authenticated`/`anon`) cannot perform an evidence-bearing
  state transition, while the server-side Edge Functions (role `service_role`) can.
- `deployment_start` and `deployment_complete_verification` are service_role-only
  (EXECUTE revoked from PUBLIC; body additionally rejects non-service_role callers).

## Remaining

1. **18G** live sequencing verification.
2. **GITHUB_ACCESS_TOKEN** manual rotation.