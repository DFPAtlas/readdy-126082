# DFP Command — Final Regression + Launch Readiness

> **Build Tag:** DFP-COMMAND-17C-FINAL-REGRESSION-LAUNCH-READINESS
> **Audit Date:** 2026-09-14
> **Scope:** Entire DFP Command application — full end-to-end regression across the completed lifecycle.

---

## 18E Final GO Gate Verification — Result (DFP-COMMAND-18E)

> **Build Tag:** DFP-COMMAND-18E-FINAL-GO-GATE-VERIFICATION
> **Audit Date:** 2026-09-14
> **Scope:** Close the two remaining GO-determining items — (1) `GITHUB_ACCESS_TOKEN` exposure audit / rotation decision, (2) verification of the deployment security chain. No P2/P3 cleanup, no redesign, no new features.

### 1. GitHub token assessment

**Classification: EXPOSURE CANNOT BE RULED OUT → ROTATION REQUIRED → OUTSTANDING (manual).**

- **Current state (verified in source):** `list-github-repos` and `inspect-github-empty-repos` resolve the caller via `auth.getUser(token)` and require an active `owner`/`admin` (`internal_user_roles.status='active'`), returning 401 (no/invalid token) / 403 (insufficient role) otherwise. The token is read **only** from `Deno.env.get("GITHUB_ACCESS_TOKEN")` (Supabase Secrets, server-side). The token value never appears in source, reports, logs, database rows, or browser storage. The `gh()` error handler truncates the *GitHub API error body* (`text.slice(0,200)`), not the token.
- **Historical gap (determining factor):** pre-18B both functions had **no auth gate**. Whether the token was configured during that window — and therefore whether an anonymous caller could ever have exercised it against the GitHub API — is **not determinable from the repository**. No evidence confirms the token was absent during that period.
- Therefore exposure **cannot be ruled out**, and rotation is **required** per the rotation rule. Rotation is an external/manual owner action that **cannot be independently verified from the repository** → the item remains **OUTSTANDING**. (Token value was not printed or logged at any point; only the classification is recorded.)

### 2. Deployment chain — authorization (server-side) — PASS

Live `pg_policies` confirms both `internal_project_deployments` and `internal_project_launch_approvals` are RLS-gated:

| Command | Policy condition |
|---|---|
| SELECT | `internal_role() IS NOT NULL` (any active internal role) |
| INSERT / UPDATE / DELETE | `internal_role() IN ('owner','admin')` |

`internal_role()` is `SECURITY DEFINER`: `SELECT role FROM internal_user_roles WHERE user_id = auth.uid() AND status = 'active' LIMIT 1`. Anonymous and non-owner/admin authenticated users are denied privileged writes **server-side**. **Deployment authorization = PASS.**

### 3. Deployment chain — sequencing/safety gates — NEW FINDING (client-side only)

**P1 (NEW) — the deployment sequencing gates are enforced only in client-side React hooks, not server-side.**

Live inspection found **no server-side RPC, trigger, or constraint** enforcing the critical sequencing rules: `pg_proc` contains no deploy/launch/accept/rollback/verify function (only `accept_invitation` and `dfp_verify_scheduler_token`); `pg_trigger` on the two tables is empty; `pg_indexes` shows no partial unique index on `internal_project_deployments`. The following are enforced **only** in `useProjectDeployment.ts` / `useProjectLaunch.ts` (client-side, bypassable via direct API by an authorized owner/admin):

- **SHA drift** — `markCompleted` compares `github_sha` vs `deployed_sha` and returns an error; no DB/RPC check.
- **Verification-before-acceptance** — `acceptProduction` requires `status === 'VERIFIED'`; no DB/RPC check.
- **Acceptance-before-live** — `acceptProduction` sets `status='live'` + `launched_at` only when not already launched; the only partial server guard is the `.is('launched_at', null)` filter (which does prevent re-setting `launched_at`), but `status='live'` is otherwise unconstrained.
- **Single-active-deployment** — `startDeployment` SELECT-then-INSERT (TOCTOU race); no partial unique index (confirmed).
- **Rollback verification** — `markRolledBack` requires `deployed_sha === rollback_sha`; no DB/RPC check.

The authorization boundary (owner/admin only) is correctly server-side, so a **non-privileged** user cannot bypass these. But the sequencing rules that the GO criteria treat as hard requirements (18B §34: *deployment approval bypass*, *SHA drift bypass*, *production Live transition bypass*) are **not** server-enforced.

### 4. Real-user live execution — NOT EXECUTED

The §7 real-user deployment-chain workflow (drive an authenticated browser through Launch Approval → Deploy → Verify → Accept → Live, plus SHA-drift, rollback, concurrency) **could not be executed as a live authenticated browser session in this environment**. Per §18, these are marked **NOT EXECUTED**, not PASS. The evidence available is static + live-schema inspection (above): it confirms authorization is server-side, but sequencing is client-side.

### 5. 18E result summary

| Test | Result |
|---|---|
| GitHub token exposure | CANNOT BE RULED OUT |
| Token rotation | REQUIRED / OUTSTANDING (manual) |
| SHA Drift (live) | NOT EXECUTED (client-side only) |
| Deployment authorization | PASS (server-side RLS) |
| Verification gate | NOT EXECUTED (client-side only) |
| Acceptance gate | NOT EXECUTED (client-side only) |
| Rollback | NOT EXECUTED (client-side only) |
| Concurrent deployment | P2 HARDENING REQUIRED (UI-only) |
| Live transition | NOT EXECUTED (client-side only) |
| Build | PASS |

### 6. Verdict: NO-GO

Two production-blocking items remain, so the verdict is **NO-GO** (downgraded from GO WITH CONDITIONS):

1. **`GITHUB_ACCESS_TOKEN` rotation OUTSTANDING** — exposure cannot be ruled out; rotation is a manual owner action that cannot be verified from the repository. §19 does not permit downgrading production credential uncertainty to a cosmetic condition.
2. **Deployment sequencing gates are client-side only** — SHA-drift block, verification-before-acceptance, acceptance-before-live, single-active-deployment, and rollback-verification are not server-enforced, which the audit's own NO-GO criteria (18B §34) treat as deployment-approval / SHA-drift / live-transition bypass risk.

Both must be resolved before GO (see remediation queue below).

---

## 18F Server-Side Deployment Sequencing — Result (DFP-COMMAND-18F)

> **Build Tag:** DFP-COMMAND-18F-SERVER-SIDE-DEPLOYMENT-SEQUENCING
> **Audit Date:** 2026-09-14
> **Scope:** Move the critical deployment lifecycle gates (launch → SHA → deploy → verify → accept → live, plus failed → rollback → restore) to authoritative server-side enforcement. No P2/P3, no redesign, no providers, no production deploy, no token rotation.

### 1. Finding — live DB was already ahead of the migrations (drift), frontend not wired

Independent live inspection (`pg_proc`, `pg_policies`, `pg_trigger`, `pg_get_functiondef`) found that the **server-side enforcement already existed in the live database**, but was **not captured in any migration file** and the **frontend hooks still performed direct `insert()`/`update()`** on the deployment ledger (which the hardened RLS had already neutralised). Concretely:

- `internal_project_deployments` live write policies (`internal_deploy_insert/update/delete`) were already `false` — direct client writes blocked, read preserved (`internal_role() IS NOT NULL`).
- Nine SECURITY DEFINER RPCs (`deployment_start`, `deployment_complete`, `deployment_fail`, `deployment_start_verification`, `deployment_complete_verification`, `deployment_accept`, `deployment_start_rollback`, `deployment_enter_rollback_sha`, `deployment_complete_rollback`), plus `internal_assert_owner_admin`, `internal_deployment_audit`, and the `internal_guard_project_launch` trigger, already existed live — but `grep` confirmed **none appear in any `.sql` migration**.
- `useProjectDeployment.ts` still used `.insert()`/`.update()` for lifecycle transitions — now blocked by the `false` RLS, and (per §25) should call the RPCs.

This is the **same migration-drift defect class as 18C**: the secure state existed live but a fresh migration replay would silently lose it.

### 2. Remediation applied

**Migration `202610070000_deployment_sequencing_18f.sql`** codifies the full server-side state machine: all 9 RPCs + helpers, the launch-guard trigger, the hardened `false` write policies (read preserved), and EXECUTE grants (REVOKE PUBLIC → GRANT `authenticated`). It also **hardens the two verification-completion functions** to reject mandatory `UNKNOWN` checks (previously only `FAIL` was rejected), closing §14/§32 — a client `PASS` or `UNKNOWN` cannot forge `VERIFIED`/`ROLLED_BACK`.

**Frontend migration** — `useProjectDeployment.ts` now routes every lifecycle mutation through the RPCs (no direct `insert()`/`update()`); `deployment_accept` performs the atomic live transition server-side (the hook no longer writes `internal_projects` directly); `deployment_start_rollback` derives the target SHA server-side (the client no longer supplies `rollbackSha`/`failedSha`). Callers updated to the new input shapes. `StartDeploymentInput.headSha` is the authoritative current SHA — the server **fails closed** with `SHA_VERIFICATION_UNAVAILABLE` when it is null and rejects `SHA_DRIFT` when it differs from the approved SHA.

### 3. Server-side gates now enforced (codified)

| Gate | Enforcement |
|---|---|
| Authorization (active owner/admin) | `internal_assert_owner_admin()` in every RPC |
| Project/approval/deployment relationship | validated in each RPC |
| SHA drift / SHA unavailable | `deployment_start` (`SHA_DRIFT` / `SHA_VERIFICATION_UNAVAILABLE`) |
| State machine (arbitrary jumps rejected) | per-RPC `status` checks |
| Deployed-SHA == approved-SHA | `deployment_complete` / `deployment_start_verification` |
| Verification cannot be forged | `deployment_complete_verification` recomputes SHA match + rejects `FAIL`/mandatory `UNKNOWN` |
| Acceptance requires VERIFIED | `deployment_accept` |
| Acceptance + first-live atomic | `deployment_accept` (single transaction + `internal_guard_project_launch` trigger) |
| `launched_at` set once | `deployment_accept` (`IF v_project.launched_at IS NULL`) |
| Rollback target from history | `deployment_start_rollback` (never a client SHA) |
| Rollback requires verification | `deployment_complete_rollback` |
| Direct live-transition bypass | `internal_guard_project_launch` trigger |
| Direct write bypass | `internal_deploy_insert/update/delete` = `false` |
| Concurrency (transactional) | `pg_advisory_xact_lock` + active-count check (partial unique index remains P2) |
| Audit | `internal_deployment_audit` (same transaction) |

### 4. Test results (schema/static level)

- Direct owner/admin advanced-state insert/update → **blocked** (RLS `false`; no permissive path).
- `SHA_DRIFT` / `SHA_VERIFICATION_UNAVAILABLE` / `DEPLOYED_SHA_MISMATCH` / `VERIFICATION_FAILED` / `VERIFICATION_INCOMPLETE` / `ACCEPTANCE_NOT_ALLOWED` / `ROLLBACK_TARGET_UNAVAILABLE` — all raised deterministically server-side.
- Unauthorized callers → `UNAUTHORIZED` (`internal_assert_owner_admin`, `auth.uid()` fail-closed).
- Live behavioural matrix (real-user CRUD through the app) remains **deferred to 18G** — marked NOT EXECUTED, not PASS.

### 5. Verdict

This P1 is **REMEDIATED — PENDING 18G VERIFICATION**. The deployment sequencing no longer depends on React for enforcement; the live RPC set is now codified in a migration and the frontend is wired to it. The overall verdict remains **NO-GO** while `GITHUB_ACCESS_TOKEN` rotation is outstanding (unchanged manual item) and until 18G independently live-executes the sequencing matrix (§40).

---

## 18G Live Server-Side Sequencing Verification — Result (DFP-COMMAND-18G)

> **Build Tag:** DFP-COMMAND-18G-LIVE-SEQUENCING-VERIFICATION
> **Audit Date:** 2026-09-14
> **Scope:** Independently live-verify that the deployment lifecycle is now enforced server-side and cannot be bypassed by an authorized owner/admin via direct API/DB writes. Verification only — no feature changes, no P2/P3, no fixes.

### 1. Live object enumeration (authoritative `pg_proc` / `pg_policies` / `pg_trigger` / `pg_indexes` / `pg_class`)

All 18F server-side objects confirmed present **live** (not just in the migration):

- **9 SECURITY DEFINER RPCs:** `deployment_start`, `deployment_complete`, `deployment_fail`, `deployment_start_verification`, `deployment_complete_verification`, `deployment_accept`, `deployment_start_rollback`, `deployment_enter_rollback_sha`, `deployment_complete_rollback` — all `prosecdef = true`, `SET search_path TO 'public','pg_temp'`.
- **2 helpers:** `internal_assert_owner_admin()` (active owner/admin only, fail-closed on null `auth.uid()`), `internal_deployment_audit()` (writes `internal_activity_log` in the same transaction).
- **Trigger:** `tr_internal_projects_guard_launch` (BEFORE UPDATE on `internal_projects`, enabled) → rejects direct `status='live'` and direct `launched_at` writes outside the atomic accept path.
- **RLS (live `pg_policies`):** `internal_project_deployments` carries exactly 4 policies — SELECT `internal_role() IS NOT NULL`, and INSERT/UPDATE/DELETE `WITH CHECK (false)` / `USING (false)`. **No permissive write policy exists.** `relrowsecurity = true` on all three tables.
- **Indexes:** no partial unique single-active-deployment index (concurrency relies on the RPC's `pg_advisory_xact_lock` + active-count check — P2 remains open).

### 2. Live behavioural matrix (authenticated owner context via `set_config('request.jwt.claims', …)`, calling the live RPCs)

Safe test records (project `999999001` + 3 approvals) were created and fully removed afterwards. Every result below was observed as a live RPC call / live write, not inferred from source:

| Test | Live result | Verdict |
|---|---|---|
| Anonymous / no-auth RPC call | `UNAUTHORIZED` (fail-closed) | ✅ |
| Unauthorized user (no internal role) | `UNAUTHORIZED` | ✅ |
| SHA drift (head=B vs approved=A) | `SHA_DRIFT` | ✅ |
| SHA unavailable (head=NULL) | `SHA_VERIFICATION_UNAVAILABLE` (fail closed) | ✅ |
| SHA match (head=A) | success → `DEPLOYING`, actor+approved SHA recorded | ✅ |
| Concurrent 2nd start (active deployment present) | `DEPLOYMENT_ALREADY_ACTIVE` | ✅ |
| Deployed SHA mismatch (complete with B) | `DEPLOYED_SHA_MISMATCH` | ✅ |
| Acceptance before verification (DEPLOYING) | `ACCEPTANCE_NOT_ALLOWED` | ✅ |
| Valid completion (A) | `DEPLOYING → DEPLOYED` | ✅ |
| Verification UNKNOWN (mandatory) | `VERIFICATION_INCOMPLETE` | ✅ |
| Verification FAIL (mandatory) | `VERIFICATION_FAILED` | ✅ |
| Valid verification (all PASS) | `VERIFYING → VERIFIED`, server snapshot (`generated_by=server`, `authoritative_sha_match=PASS`), `verified_by` = actor | ✅ |
| Direct `status='live'` (trigger) | `LAUNCH_TRANSITION_REQUIRES_ACCEPTANCE` | ✅ |
| Direct `launched_at` (trigger) | `LAUNCHED_AT_REQUIRES_ACCEPTANCE` | ✅ |
| Valid acceptance (first launch) | `VERIFIED → accepted` + atomic `status='live'` + `launched_at` set | ✅ |
| launched_at immutability (2nd release) | `launched_at` unchanged; recorded as `Production Release Accepted` | ✅ |
| Rollback target derivation | target derived server-side from `last_known_good_sha` (RPC takes no client SHA) | ✅ |
| Rollback SHA mismatch | `DEPLOYED_SHA_MISMATCH` | ✅ |
| Rollback UNKNOWN / FAIL | `ROLLBACK_VERIFICATION_FAILED` | ✅ |
| Valid rollback | `ROLLING_BACK → ROLLED_BACK`, lineage (`rollback_of_deployment_id`) + failed release preserved | ✅ |

### 3. Audit trail (live `internal_activity_log`)

All lifecycle events written with correct actor (`user_id` = `auth.uid()`), project, and timestamp: Deployment Started/Completed, Verification Started, Deployment Verified, Project Launched, Production Release Accepted, Deployment Failed, Rollback Started/Deployed/Completed. No secret values in audit payloads (only SHAs/ids).

### 4. Direct-write bypass — structural proof

The owner/admin direct INSERT/UPDATE/DELETE bypass (18E §28/§31) is closed **by construction**: the only write policies on `internal_project_deployments` are `WITH CHECK (false)` / `USING (false)`, and RLS is enabled with no permissive overlap. A live `authenticated`-role direct write could not be executed because the SQL executor prohibits `SET ROLE`/`BEGIN`, but the `false` predicate is deterministic — no `authenticated` principal (owner/admin included) can satisfy it. The only write path is the SECURITY DEFINER RPCs, which enforce the state machine.

### 5. Verdict

**Deployment-sequencing P1 = VERIFIED RESOLVED.** Every critical bypass test passed live (SHA drift, SHA unavailable, deployed-SHA mismatch, forged/UNKNOWN/FAIL verification, acceptance-before-verification, direct live transition, launched_at immutability, concurrency, arbitrary/cross-project rollback, rollback-without-verification). Overall verdict remains **NO-GO** for the one remaining reason: `GITHUB_ACCESS_TOKEN` rotation is still **OUTSTANDING** (manual owner action, unverifiable from the repo).

---

## 18D Live RLS Verification — Result (DFP-COMMAND-18D)

> **Build Tag:** DFP-COMMAND-18D-LIVE-RLS-VERIFICATION
> **Audit Date:** 2026-09-14
> **Scope:** Live behavioural verification of the 18C RLS remediation on `internal_projects` and `internal_project_budgets`. Verification-only — no policy changes, no P2/P3 work, no features.

### Live policy enumeration (authoritative `pg_policies`)

Both sensitive tables carry **exactly 4 `internal_cc_*` policies each**, all gated on `internal_role_aal2()`. **Zero** `internal_role()`-only permissive policy remains — the former OR-based bypass path is gone.

| Table | SELECT (`USING`) | INSERT (`WITH CHECK`) | UPDATE (`USING`/`WITH CHECK`) | DELETE (`USING`) |
|---|---|---|---|---|
| `internal_projects` | `internal_role_aal2() IS NOT NULL` | `internal_role_aal2() IN ('owner','admin')` | same (both) | `IN ('owner','admin')` |
| `internal_project_budgets` | `internal_role_aal2() IS NOT NULL` | `internal_role_aal2() IN ('owner','admin')` | same (both) | `IN ('owner','admin')` |

### Helper definition verified (live `pg_get_functiondef`)

`internal_role_aal2()` returns a role **only when** `auth.jwt()->>'aal' = 'aal2'` **and** a matching `internal_user_roles` row exists with `status = 'active'`; otherwise it returns `NULL`. This fails closed for anonymous, no-MFA, non-active status, missing role, and missing profile.

### Function matrix (live)

| Case | Context | Result | Expected | Pass |
|---|---|---|---|---|
| A | active owner + aal2 | `owner` | `owner` | ✅ |
| B | active owner + aal1 (no MFA) | NULL | NULL | ✅ |
| C | disabled admin + aal2 (valid session) | NULL | NULL | ✅ |
| D | disabled admin + aal1 | NULL | NULL | ✅ |
| E | no internal role + aal2 | NULL | NULL | ✅ |
| F | anonymous | NULL | NULL | ✅ |

### Table-level behavioural matrix (live RLS, role switched to `authenticated`)

Ground truth: 12 `internal_projects` rows, 6 `internal_project_budgets` rows.

| Case | SELECT (visible rows) | UPDATE | INSERT | Pass |
|---|---|---|---|---|
| anonymous | 0 / 0 | — | — | ✅ |
| active owner + aal2 | 12 / 6 | 12 rows affected (allowed) | allowed | ✅ |
| active owner + aal1 | 0 / 0 | 0 rows (denied) | **error: RLS violation** | ✅ |
| no role + aal2 | 0 / 0 | — | — | ✅ |
| disabled admin + aal2 | 0 / 0 | 0 rows (denied) | — | ✅ |

### Explicit bypass tests (§5)

- **CASE 1 — active allowed-role + AAL1 only → DENIED.** Confirmed: `internal_role_aal2()` = NULL, SELECT 0 rows, UPDATE 0 rows, INSERT raises `new row violates row-level security policy`.
- **CASE 2 — disabled allowed-role + AAL2 + still-valid session → DENIED.** Confirmed: admin account temporarily set `status='disabled'`, then `internal_role_aal2()` returned NULL and table SELECT/UPDATE returned 0 rows despite the `aal2` JWT and valid session. Account restored to `active` immediately after.

### Data integrity / state restoration

No test rows leaked (projects still 12, budgets still 6); the admin account used for the disabled-case test was restored to `active`; `internal_user_roles` holds exactly the 2 accounts, both `active` (0 non-active). The five newer lifecycle tables were not touched.

### RLS blocker status

**VERIFIED RESOLVED.** Both tables require active internal account **and** AAL2/MFA, with no permissive-policy bypass. The 18B NO-GO blocker is closed at the live behavioural level, not just the predicate level.

---

## 18C RLS Blocker Remediation — Result (DFP-COMMAND-18C)

> **Build Tag:** DFP-COMMAND-18C-RLS-BLOCKER-REMEDIATION
> **Audit Date:** 2026-09-14
> **Scope:** The single production-blocking P1 surfaced in 18B — the sensitive RLS overlap on `internal_projects` and `internal_project_budgets`. Remediation only; no new features, no auth redesign, no P2/P3 work.

### Correction of the 18B live-state reading

18C's independent live inspection found that **the bypass described in 18B was not present in the live database** at remediation time:

- `internal_role_aal2()` **already** required `status = 'active'` (the "ignores status" claim did not match the live function definition).
- The legacy `internal_projects_*` / `internal_budgets_*` policies were **already `USING (false)`** (neutralised), not the permissive `internal_role()` path 18B described.

The accurate, real gap was **migration/live drift**: the correct combined-check state existed live but was **not captured in any migration file** — `internal_role_aal2()` is not created in any `.sql`, and the legacy-policy neutralisation was unrecorded. A fresh migration replay would not reproduce the secure state.

### Remediation applied (migration `202610060000_rls_blocker_remediation_18c.sql`)

1. `internal_role_aal2()` codified to require **both** `aal2` (MFA) **and** `status='active'`, failing closed to NULL (anonymous / no-MFA / non-active / missing-role all → NULL). EXECUTE revoked from PUBLIC, granted to `authenticated` only.
2. Legacy `internal_projects_*` / `internal_budgets_*` policies (8) dropped.
3. `internal_cc_*` policies (re)created on both tables against `internal_role_aal2()` — the combined check is now the **only** access path.

### Verification evidence

**Policy enumeration (post-migration):** each table carries exactly 4 `internal_cc_*` policies (SELECT/INSERT/UPDATE/DELETE), all gated on `internal_role_aal2()`. No `internal_role()`-only permissive policy remains.

**Direct function test (live):**

| Case | Context | Result | Expected | Pass |
|---|---|---|---|---|
| A | active owner + aal2 | `owner` | `owner` | ✅ |
| B | active owner + aal1 (no MFA) | NULL | NULL | ✅ |
| C | disabled admin + aal2 (valid session) | NULL | NULL | ✅ |
| E | no internal role + aal2 | NULL | NULL | ✅ |
| F | anonymous | NULL | NULL | ✅ |

The mandatory §11 regression (disabled + aal2 → denied) **passes**. No project/budget data rewritten, truncated, or deleted; the admin account used for Case C was restored to `active`. The five newer lifecycle tables are untouched.

### Verdict

**PENDING LIVE RLS RE-VERIFICATION.** The RLS blocker is closed at the function + policy level (proven above). The full behavioural matrix (§10 — actual SELECT/INSERT/UPDATE/DELETE as distinct auth roles through the application) remains deferred to 18D.

---

## 18B Remediation Verification — Result (DFP-COMMAND-18B)

> **Build Tag:** DFP-COMMAND-18B-REMEDIATION-VERIFICATION
> **Audit Date:** 2026-09-14
> **Scope:** Independent verification of the P0/P1 findings remediated in 18A. Verification-only — no new features, no redesign, no new fixes (§28).

### Verification matrix (original P0/P1 findings)

| Finding ID | Original Severity | 18A Remediation | 18B Verification | Evidence | Final Status |
|---|---|---|---|---|---|
| GH-1 `list-github-repos` — no auth; anonymous repo enumeration | P1 | Redeploy with JWT + active owner/admin gate | Source re-inspected | `list-github-repos/index.ts` resolves caller via `auth.getUser(token)`, requires `internal_user_roles.role IN ('owner','admin')` **and** `status='active'`; returns 401 (no/invalid token) / 403 (insufficient role) otherwise | **VERIFIED RESOLVED** |
| GH-2 `inspect-github-empty-repos` — no auth; anonymous content read | P1 | Same gate | Source re-inspected | `inspect-github-empty-repos/index.ts` has the identical gate | **VERIFIED RESOLVED** |
| AU-3 AuthGuard MFA fail-open | P1 | `catch → 'unavailable'` | Source re-inspected | `checkMfaStatus()` catch returns `'unavailable'`; `AuthGuard` renders a blocking "Unable to verify security" screen (Retry / Sign out), no silent allow, no redirect loop | **VERIFIED RESOLVED** |
| AU-4 account-status negative check | P1 | explicit `status === 'active'` allow-list | Source re-inspected | `fetchRole` returns a role only for `status === 'active'`; live `internal_role()` also carries `AND status = 'active'` | **VERIFIED RESOLVED** |

### New finding discovered during 18B live RLS inspection

**P1 (NEW) — RLS policy overlap defeats MFA + disabled-account enforcement on `internal_projects` and `internal_project_budgets`.**

Live `pg_policies` inspection revealed that the two most sensitive tables each carry **two overlapping policy sets per command**, which Postgres ORs together:

- `internal_cc_*` → `internal_role_aal2()` (requires `aal2`/MFA, **but does not check `status`**),
- `internal_projects_*` / `internal_budgets_*` → `internal_role()` (requires `status='active'`, **but does not require MFA**).

Net effect — the union means **neither control is actually enforced** on these two tables:
- An active role-holder **without MFA** can read/write (via the non-aal2 policies).
- A **disabled/suspended** owner/admin with a still-valid `aal2` session can read/write (via `internal_cc_*`, because `internal_role_aal2()` omits the `status` check).

This is a sensitive-RLS-gap / defense-in-depth failure on the project registry and financial data. It is **production-blocking** (see verdict). The 5 new lifecycle tables (integrations, launch approvals, deployments, maintenance, reviews) each carry a single correct policy set and are **not** affected. This policy set + `internal_role_aal2()` exist in the live DB but are **not captured in any migration file** (live/migration drift) — noted, secondary.

### Recalculated verdict

**NO-GO** (downgraded from GO WITH CONDITIONS).

Reason: 18B discovered a production-blocking P1 — a sensitive RLS gap meaning MFA and disabled-account enforcement are not effective server-side on `internal_projects` and `internal_project_budgets`. Per §34, a sensitive RLS gap mandates NO-GO. The four original P1s are all genuinely resolved; this is a newly-surfaced issue, documented rather than fixed (verification-only, §28).

### Remaining remediation queue (deferred to 18C)

- **P1:** Consolidate `internal_projects` / `internal_project_budgets` RLS to a single policy set; fix `internal_role_aal2()` to require `status='active'`; drop the redundant non-aal2 `internal_projects_*` / `internal_budgets_*` policies (or remove the aal2 intent).
- **P1/Manual:** Confirm whether `GITHUB_ACCESS_TOKEN` was ever invoked unauthenticated pre-18B; rotate if so.
- **P2:** single-active-deployment partial unique index; SHA shape validation; URL scheme validation; hard-delete confirmation copy.
- **P3:** soft-reference FK hardening; CORS review on JWT-gated Edge Functions.

---

## 18A Post-Audit P0/P1 Remediation — Result (DFP-COMMAND-18A)

> **Audit Date:** 2026-09-14
> **Inputs:** this report (17C) + `docs/security-production-readiness.md` (17B).

### Finding-by-finding status

| Finding | Severity | 18A Status | Evidence |
|---------|----------|------------|----------|
| `list-github-repos` — no auth; anonymous private-repo enumeration | P1 | **RESOLVED (18B, deployed)** | Redeployed via `deploy_edge_function` with `verify_jwt=true` + internal JWT/active owner-admin gate (mirrors `internal_role()`). |
| `inspect-github-empty-repos` — no auth; anonymous repo-content read | P1 | **RESOLVED (18B, deployed)** | Same gate deployed. |
| AuthGuard MFA fail-open (17B P1 #3) | P1 | **RESOLVED (17B, re-verified 18A)** | `checkMfaStatus()` catch returns `'unavailable'`; blocking "Unable to verify security" screen present in source. |
| Account-status negative check (17B P1 #4) | P1 | **RESOLVED (17B, re-verified 18A)** | `fetchRole` uses explicit `status === 'active'` allow-list. |

### P0

**None found.** Confirmed against both reports and re-checked in source; nothing new was invented.

### 18B Supabase Unblock — Result (post-18A)

SaaS Supabase connected. Both blockers from 17C/18A are now resolved:

- **GitHub P1s deployed.** `list-github-repos` and `inspect-github-empty-repos` redeployed via `deploy_edge_function` with `verify_jwt=true` **and** an internal gate that resolves the caller from their JWT and requires `internal_user_roles.role IN ('owner','admin')` with `status = 'active'` — exactly mirroring the server's `internal_role()`.
- **Lifecycle schema applied.** Migrations `202609250000`–`202610050000` (integrations, launch approvals, deployments, verification, acceptance/rollback, maintenance, reviews, cleanup, indexes) applied to the live database. Confirmed: all `internal_project%` tables now exist with RLS enabled (previously only 5 of 10 existed — the launch/deployment/operations layer was entirely absent).

### Recalculated verdict

**GO WITH CONDITIONS** (upgraded from NO-GO).

- No P0 (unchanged).
- No open production-blocking P1 — the GitHub auth gap is deployed and closed.
- Remaining conditions are non-blocking and documented below: (1) set `GITHUB_ACCESS_TOKEN` in Supabase Secrets, (2) run the live behavioural test matrices, (3) optional P2 hardening.

### Remaining manual actions

1. Set `GITHUB_ACCESS_TOKEN` in Supabase → Edge Functions → Secrets (functions return 500 until present; confirm least-privilege read-only scope, rotate if it was ever invoked unauthenticated).
2. Run the live RLS / auth / privileged-action / SHA-drift / deployment / verification / rollback matrices as a real authenticated user.
3. (P2, optional) single-active-deployment partial unique index; SHA shape validation; URL scheme validation.

---

## Final Verdict

### **NO-GO**

> **Updated by 18G (2026-09-14).** The deployment-sequencing P1 is now **VERIFIED RESOLVED** at the live behavioural level: every critical bypass test passed against the live backend as an authenticated owner (SHA drift / SHA-unavailable fail-closed, deployed-SHA mismatch, forged + mandatory UNKNOWN/FAIL verification rejection, acceptance-before-verification, direct live/launched_at transition blocked by trigger, launched_at immutability, server-side concurrency, and server-derived rollback with UNKNOWN/FAIL rejection). The RPCs, helpers, guard trigger, and hardened `false` write policies are all confirmed present live with a complete audit trail. The overall verdict remains **NO-GO** for a single reason: `GITHUB_ACCESS_TOKEN` rotation is still **OUTSTANDING** (manual owner action, not verifiable from the repository).

> **Updated by 18F (2026-09-14).** The 18E deployment-sequencing P1 is now **REMEDIATED — PENDING 18G VERIFICATION**. The full server-side state machine (9 SECURITY DEFINER RPCs, launch-guard trigger, hardened `false` write policies, UNKNOWN-blocking verification) is codified in migration `202610070000` and the frontend hooks are wired to the RPCs (no direct writes). The overall verdict remains **NO-GO** for one reason: `GITHUB_ACCESS_TOKEN` rotation is still **OUTSTANDING** (exposure cannot be ruled out; manual owner action, not verifiable from the repository). The deployment-sequencing item itself moves from OPEN to REMEDIATED, but §40 holds the verdict at NO-GO until 18G independently live-executes the sequencing matrix.

> **Updated by 18E (2026-09-14).** Two production-blocking items remain, so the verdict is **NO-GO** (downgraded from GO WITH CONDITIONS): (1) `GITHUB_ACCESS_TOKEN` exposure cannot be ruled out → rotation required and **OUTSTANDING** (manual owner action, not verifiable from the repository); and (2) a new P1 — the deployment sequencing gates (SHA-drift block, verification-before-acceptance, acceptance-before-live, single-active-deployment, rollback-verification) are enforced **only client-side**, not server-side (no RPC/trigger/constraint). Per §19, a production credential uncertainty cannot be downgraded to a cosmetic condition, and the audit's own NO-GO criteria (18B §34) flag SHA-drift / live-transition / deployment-approval bypasses. Full detail in the 18E section above.

> **Updated by 18D (2026-09-14).** The sensitive RLS P1 surfaced in 18B is now **VERIFIED RESOLVED at the live behavioural level**. `internal_role_aal2()` requires both MFA (`aal2`) and `status='active'`, both sensitive tables carry a single `internal_cc_*` policy set with no `internal_role()`-only permissive path, and the full live matrix passed (function + table-level SELECT/INSERT/UPDATE/DELETE as distinct auth roles): active+aal2 allowed; no-MFA, disabled+aal2, no-role, and anonymous all denied. Build green; secret state unregressed; data integrity preserved.

The RLS blocker is closed. The verdict upgrades from PENDING LIVE RLS RE-VERIFICATION to **GO WITH CONDITIONS** because one remaining item can still be production-blocking and cannot be independently resolved from the repository:

**Conditions carried forward (the determining item is #1):**
1. **`GITHUB_ACCESS_TOKEN` manual review (OPEN).** Determine whether the token was ever invoked through the previously-unauthenticated `list-github-repos` / `inspect-github-empty-repos` functions pre-18B; rotate if exposure cannot be ruled out. This is the one remaining item that could be production-blocking and is not a code defect — it is a credential-exposure question that requires an owner action.
2. Exercise the broader lifecycle matrices (SHA-drift, deployment approval chain, verification, acceptance, rollback) as a real logged-in user — the schema and code are present and statically verified, but these paths have not been live-executed.
3. (P2, optional) single-active-deployment constraint, SHA shape validation, URL scheme validation, hard-delete copy.

---

## Application Build Result

**✅ PASS** — `build_project_check` succeeds. TypeScript compiles, no broken imports, no unresolved routes, no migration compilation issues introduced by the 16A–17C build sequence.

---

## Route Regression

**✅ PASS (static)** — `src/router/config.tsx` was audited and all major modules are registered:

| Area | Routes present |
|------|----------------|
| Auth | `/login`, `/signup`, `/mfa/setup`, `/mfa/verify` |
| Core | `/dashboard`, `/projects`, `/projects/:slug`, `/ideas`, `/roadmap`, `/team`, `/security`, `/help` |
| Build / Workstream | `/build-process`, `/bugs`, `/change-requests`, `/notes`, `/prompts`, `/files-links` |
| Budget | `/project-budget` |
| GitHub | `/github` |
| Activity | `/activity-log` |
| Monitoring | `/system-status` |
| Support | `/support`, `/support-tickets` (+ detail/preferences/reports), `/customers`, `/support-repairs`, `/support-teams`, `/support-routing`, `/support-knowledge`, `/support-session/:id` |
| UAT | `/admin/website-uat` (admin-guarded), `/account/uat` + `/uat` (tester-guarded) |
| AI Operations | `/ai-operations` + sites/agents/runs/approvals/live/orchestrator/tools/models/knowledge/security/alerts/audit/costs/notifications/schedules/search/wallboard/agent-deployment/readiness/runtime-health/runtime-controls |
| Catch-all | `*` → `NotFound` |

Project Command Centre (`/projects/:slug`) exposes the 16 implemented sections via `?section=` (Overview, Build, GitHub, Infrastructure, AI Ops, UAT, Bugs, Changes, Budget, Support, Monitoring, Launch, Deployment, Operations, Activity, Files). `?section=` state and invalid-section fallback are code-present; browser-refresh persistence was **not live-executed** (no backend).

---

## Auth Result

**✅ PASS (code) / ⚠️ NOT live-verified.**

- Fail-closed MFA: `checkMfaStatus()` returns `unavailable` on error; `AuthGuard` renders a blocking "Unable to verify security" screen (Retry / Sign-out) — **no silent allow, no redirect loop**. *(Verified in source — 17B fix landed.)*
- Explicit account allow-list: role granted only for `status === 'active'` — `pending`/`suspended`/`disabled`/missing all denied. *(Verified in source — 17B fix landed.)*
- Invite-only role gating via server-side `accept_invitation` (SECURITY DEFINER).
- ⚠️ The §43 auth matrix (unauthenticated → denied, disabled → denied, MFA-unverified → denied, expired JWT → denied) is **expected-behaviour** only; it could not be exercised against a live Supabase Auth instance.

---

## RLS Result

**✅ PASS (code) / ⚠️ NOT live-verified.**

RLS is enabled and role-aware across `internal_*` tables (reviewed in 17B): `internal_role()` derives the caller from `auth.uid()`, anonymous has no access, writes are owner/admin-only, `internal_user_roles` is owner-hardened. No RLS gap was identified in the migration source.

⚠️ The §31 RLS regression matrix (project/integration/bug/change/budget/launch/deployment/maintenance/review/UAT/support/AI read-write denials) **could not be executed** without a live database.

---

## Project Lifecycle Result

**⚠️ Code-present, NOT live-executed.**

The full lifecycle (Project Creation → Integration → Build → GitHub/Readdy → Infrastructure → AI Ops → UAT → Bugs/Changes → Budget → Support → Monitoring → Launch → Deployment → Verification → Acceptance → Operations → Maintenance) is implemented across the migration set and hooks, but the §3–§27 end-to-end tests (project creation, integration consistency, SHA-drift blocking, deployment-approval enforcement, production verification, acceptance, rollback, operations for Live projects) **require a live backend and test records** and were not executed.

The canonical-project-identity rule (`internal_projects.id`, never name-matching) is documented in the charter and reflected in the migration FKs/soft references; verified statically, not against live data.

---

## Launch / Deployment Result

**⚠️ Code-present, NOT live-executed.**

- Launch gates, approval (request/approve/reject with actor identity), SHA locking, `CODE CHANGED AFTER APPROVAL` drift detection, one-active-deployment intent, production verification (`DEPLOYED → VERIFYING → VERIFIED`), acceptance gating (`launched_at` set only when null), and rollback-with-history are all implemented in the `202609290000`–`202610020000` migration sequence and section hooks.
- ⚠️ The **critical acceptance test §21 (SHA drift)** and §22–§25 (deployment approval enforcement, verification, acceptance, rollback) were **not executed** — they depend on live RLS + test records.
- Known P2 gaps from 17B remain relevant here: no DB-level single-active-deployment constraint, and `github_sha` is unvalidated free text (see P2).

---

## Operations Result

**⚠️ Code-present, NOT live-executed.**

Operations/maintenance/review sections for Live projects are implemented but require a Live test project against a live backend to verify; not exercised.

---

## Performance Result

**✅ PASS (static).**

Confirmed from 16C and re-verified in source: `usePortfolio` uses bulk `.in('project_id', ids)` queries (no per-project N+1), the Executive Dashboard reuses portfolio + limited/aggregate queries, and the integration record is loaded once and threaded into all sections. Full subsystem histories remain section-scoped. `.select('*')` usage in `usePortfolio`/detail hooks is for genuine full-detail section loads (§10 allows). Hot `project_id` paths have prepared composite indexes (pending migration apply).

⚠️ Indexes are **written but not applied** (no backend to run the migration against).

---

## Documentation Result

**✅ PASS — with one regression found and fixed in this command.**

- `project_plan.md` is the canonical Product Charter (17A) — correct product definition, canonical `internal_projects` entity, lifecycle, status semantics, integration model, launch/deployment distinctions, security principles.
- `docs/repository-master-map.md` now maps the actual codebase modules + routes.
- Root `README.md` has the correct concise product definition.
- **Regression found & fixed:** `index.html` still carried the obsolete consumer-product SEO copy — description *"Get privacy scores, risk insights…"* and keywords *"privacy, online security, data monitoring"*. 17A's scan covered Markdown only and missed the HTML head. Corrected to describe DFP Command as Digital Footprint's internal operating system (title, description, and keywords all updated).
- No other canonical document retains the old "consumer digital-footprint scoring" self-description.

---

## Issue Classification

### P0 CRITICAL

**None identified in source.** (Cannot be fully certified absent a live environment, but no P0 was found in static audit.)

### P1 HIGH

| # | Finding | Status |
|---|---------|--------|
| 1 | `list-github-repos` — no auth; anonymous private-repo enumeration | **RESOLVED (18B)** — deployed with `verify_jwt=true` + active owner/admin gate |
| 2 | `inspect-github-empty-repos` — no auth; anonymous repo-content read | **RESOLVED (18B)** — deployed with `verify_jwt=true` + active owner/admin gate |
| 3 | **(NEW 18B, resolved 18C, verified 18D)** RLS overlap defeats MFA + disabled-account enforcement on `internal_projects` / `internal_project_budgets` | **VERIFIED RESOLVED (18D)** — combined active+AAL2 check codified (migration `202610060000`) and proven by live function **and** table-level behavioural matrix (SELECT/INSERT/UPDATE/DELETE across active+aal2 / no-MFA / disabled+aal2 / no-role / anonymous) |

> **Resolution (18B):** After SaaS Supabase was connected, both functions were redeployed via `deploy_edge_function` with the JWT + active owner/admin gate (matching `command-centre-invite-user` and mirroring `internal_role()`). `verify_jwt` is enabled. The earlier 17B "fix prepared" record was inaccurate (the source was never modified); that discrepancy is now moot — the fix is actually deployed.

### P2 MEDIUM (carried from 17B, unchanged)

3. No DB-level single-active-deployment constraint (concurrency relies on disabled buttons).
4. `github_sha` / `last_known_good_sha` are unvalidated free text.
5. Integration-record URLs are not scheme-validated against `javascript:`/`data:`.
6. Hard-delete confirmation is misleading (orphans rather than cascades; message claims the opposite).

### P3 LOW (carried from 17B, unchanged)

7. Project workstream tables use soft `project_id` references (no FK → orphan risk after hard delete).
8. `Access-Control-Allow-Origin: *` on JWT-gated Edge Functions (acceptable; hardening candidate).

---

## Manual Actions Remaining

1. **Set `GITHUB_ACCESS_TOKEN` in Supabase Secrets** (Edge Functions → Secrets) — least-privilege read-only scope; rotate if it was ever invoked unauthenticated.
2. ~~Redeploy the GitHub functions~~ **DONE (18B)** — deployed with `verify_jwt=true` + active owner/admin gate.
3. ~~Apply migrations/indexes~~ **DONE (18B)** — lifecycle migrations `202609250000`–`202610050000` applied; RLS enabled on all `internal_project%` tables.
4. **Execute the live test matrices** — RLS (§31), auth (§30/§43), privileged-action (§32/§44), SHA-drift (§21), deployment/verification/acceptance/rollback (§22–§25), operations (§26).
5. *(P2, optional)* single-active-deployment partial unique index, SHA shape validation, URL scheme validation.

---

## GO Criteria Assessment

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Build/type checks pass | ✅ |
| 2 | No unresolved P0 | ✅ (none found) |
| 3 | No unresolved production-blocking P1 | ✅ GitHub auth P1 resolved (18B) |
| 4 | Auth fails closed | ✅ (code) |
| 5 | RLS validated for critical data | ✅ enabled + policies live (18B); behaviour pending live matrix run |
| 6 | No privileged secret exposure | ✅ (scan clean) |
| 7 | Launch Approval works | ⚠️ schema live (18B), not behaviour-tested |
| 8 | SHA drift blocks deployment | ⚠️ schema live (18B), not behaviour-tested |
| 9 | Production verification works | ⚠️ schema live (18B), not behaviour-tested |
| 10 | Rollback history preserved | ⚠️ schema live (18B), not behaviour-tested |
| 11 | No fake Healthy/green state | ✅ (16B status semantics) |
| 12 | Core global modules work | ✅ (build passes, routes present) |

**Result:** the hard requirement *no open production-blocking P1* is met (18B GitHub; 18C RLS; 18D live-verified). The RLS blocker is closed at the live behavioural level. Hence **GO WITH CONDITIONS** — the sole remaining potentially-blocking item is the `GITHUB_ACCESS_TOKEN` manual review (credential-exposure question, not a code defect), plus the broader lifecycle matrices still to be live-executed.

---

## Path to GO

1. ~~Connect backend~~ ✅ SaaS Supabase connected.
2. ~~Deploy GitHub auth gate~~ ✅ deployed (18B).
3. ~~Apply migrations + indexes~~ ✅ applied (18B).
4. ~~Verify RLS blocker live~~ ✅ live-verified (18D).
5. **Set + audit `GITHUB_ACCESS_TOKEN`** (Supabase Secrets) — confirm it was never invoked unauthenticated; rotate if uncertain.
6. Run the broader lifecycle matrices (SHA-drift, deployment chain, verification, acceptance, rollback) → upgrade to **GO** once the GitHub-token item is closed.

---

## Non-Changes Observed

No product features added, no pages redesigned, no lifecycle/commercial/deployment logic changed, no secrets rotated, no Git history rewritten, no production deployment performed. The only code edits in this command were the `index.html` SEO metadata correction (documentation truth, §37).