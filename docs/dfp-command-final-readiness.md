# DFP Command — Final Readiness

## Current Verdict

**NO-GO** (unchanged pending 18G live verification + `GITHUB_ACCESS_TOKEN` manual rotation).

| Item | Status |
| --- | --- |
| Deployment sequencing (18F) | Remediated |
| Authoritative server evidence (18F2) | Remediated — pending 18G |
| 18G live sequencing verification | Pending |
| GITHUB_ACCESS_TOKEN manual rotation | Pending |

## 18E — Finding

Production deployment could be driven by browser-supplied values: the current
GitHub HEAD SHA and the production verification result were both accepted from
the client. An authorised owner/admin with table access could therefore fabricate
either "the code has not changed" or "the release passed verification".

## 18F — Remediation (Server-Side Deployment Sequencing)

Deployment sequencing was moved behind protected server-side RPCs
(`deployment_start`, `deployment_complete_verification`, `deployment_accept`,
`deployment_start_rollback`). This introduced server-side state transitions but
still accepted `p_head_sha` and the verification `p_snapshot` from the browser —
the two remaining P1 gaps closed by 18F2.

## 18F2 — Authoritative Server Evidence Remediation

The current GitHub SHA and the production verification result are now resolved
**server-side only**. The browser has no input capable of changing either result.

### Changes

- **`deployment-start` Edge Function** — resolves the canonical GitHub identity
  (owner / repository / branch) from `internal_project_integrations`, resolves the
  current repository HEAD via GitHub using `GITHUB_ACCESS_TOKEN` (secret storage
  only, never returned or logged), and compares it against the approved launch SHA.
  Fail closed: `SHA_DRIFT` / `SHA_VERIFICATION_UNAVAILABLE`.
- **`deployment-verify` Edge Function** — the server-side verification engine. It
  independently resolves every mandatory check from authoritative stored telemetry
  (freshness-checked, > 24h ⇒ UNKNOWN, never a stale PASS): approved SHA = deployed
  SHA, deployment state, project validity, monitoring configuration, production
  monitoring state, critical alerts, backend/database health, runtime health, AI
  state. Only all-mandatory-PASS transitions `VERIFYING → VERIFIED`.
- **`deployment_start` / `deployment_complete_verification` RPCs** — now reject any
  non-`service_role` caller and consume the server-generated evidence. They no
  longer trust a browser `p_head_sha` or client `p_snapshot`.
- **`verification_authoritative` column + evidence guards** — a service_role-only
  marker that `deployment_accept` requires; BEFORE INSERT/UPDATE triggers stop an
  owner/admin from writing `status = 'VERIFIED'` (or `DEPLOYING`) directly.
- **`deployment_accept`** — refuses legacy / forged snapshots (`VERIFICATION_REQUIRED`);
  only server-generated, authoritative verification satisfies acceptance.
- **Frontend** — `useProjectDeployment` now routes start / verify / accept through
  the Edge Functions / RPC, and the verification view labels client checks
  "Preliminary".

### Security tests

- **Forged SHA** — approved SHA = A, actual GitHub HEAD = B, client claims A.
  Expected: deployment blocked. The browser has no input that changes the
  authoritative GitHub result; `deployment_start` is service_role-only and the
  INSERT guard blocks a direct `DEPLOYING` write.
- **GitHub unavailable** — authoritative lookup unavailable. Expected: deployment
  does not start; `SHA_VERIFICATION_UNAVAILABLE` (fail closed, no client fall-back).
- **Valid SHA** — approved SHA = server-resolved HEAD. Expected: deployment may
  start if all other conditions pass.
- **Forged verification** — client JSON claims every check PASS while authoritative
  monitoring/backend/runtime evidence is UNKNOWN or FAIL. Expected: cannot become
  `VERIFIED` (client snapshot never accepted; `deployment-verify` re-derives results).
- **Stale telemetry** — stale "healthy/online/green" rows. Expected: not PASS;
  verification remains incomplete where mandatory.
- **Authoritative verification** — fresh evidence + all mandatory checks PASS.
  Expected: `VERIFYING → VERIFIED` with a server-generated snapshot recorded.
- **Legacy snapshot acceptance** — a snapshot predating the authoritative verifier.
  Expected: rejected / re-verification required.

## Remaining to reach GO

1. **18G** — live sequencing verification passes.
2. **GITHUB_ACCESS_TOKEN** manual rotation completed.