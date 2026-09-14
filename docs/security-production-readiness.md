# DFP Command — Security + Production Readiness Audit

> **Build Tag:** DFP-COMMAND-17B-SECURITY-PRODUCTION-READINESS-AUDIT
> **Audit Date:** 2026-09-14
> **Scope:** Entire DFP Command application — AuthGuard, Supabase RLS, Edge Functions, project isolation, admin/approval actions, deployment controls, runtime controls, secrets handling, activity/audit, GitHub/Readdy integration, Support/UAT/AI Operations access.

---

## 1. Production Verdict

### **NO-GO** (updated 18G)

> **18G live sequencing verification (2026-09-14).** The 18E deployment-sequencing P1 (#13) is now **VERIFIED RESOLVED** at the live behavioural level. All 9 `deployment_*` SECURITY DEFINER RPCs, the `internal_assert_owner_admin` / `internal_deployment_audit` helpers, the `internal_guard_project_launch` trigger, and the `false` write policies were confirmed present live (`pg_proc`/`pg_policies`/`pg_trigger`/`pg_class`). Executed as an authenticated owner against safe test records (removed afterward): SHA drift → `SHA_DRIFT`; SHA unavailable → `SHA_VERIFICATION_UNAVAILABLE` (fail-closed); deployed-SHA mismatch → `DEPLOYED_SHA_MISMATCH`; forged/UNKNOWN/FAIL verification → rejected; acceptance-before-verification → `ACCEPTANCE_NOT_ALLOWED`; direct `status='live'`/`launched_at` → rejected by trigger; first-launch acceptance → atomic `live` + `launched_at`; later release → `launched_at` preserved; concurrent start → `DEPLOYMENT_ALREADY_ACTIVE`; rollback target derived server-side (no client SHA) and UNKNOWN/FAIL rollback verification rejected; complete audit trail with actor identity. Anonymous / no-role users denied (`UNAUTHORIZED`). Overall verdict remains **NO-GO** solely because `GITHUB_ACCESS_TOKEN` rotation is still **OUTSTANDING** (manual owner action).

> **18F server-side sequencing result (2026-09-14).**

> **18F server-side sequencing result (2026-09-14).** The 18E deployment-sequencing P1 (#13) is now **REMEDIATED — PENDING 18G VERIFICATION**. Live inspection found the server-side state machine already existed in the live DB (9 `deployment_*` SECURITY DEFINER RPCs, the `internal_guard_project_launch` trigger, and `false` write policies on `internal_project_deployments`), but was **not captured in any migration** (drift) and the **frontend hooks still did direct writes**. Migration `202610070000_deployment_sequencing_18f.sql` codifies the full state machine + hardened RLS + grants, hardens the verification-completion RPCs to reject mandatory `UNKNOWN` checks (not just `FAIL`), and the frontend `useProjectDeployment.ts` is rewired to call the RPCs (no direct `insert()`/`update()`; acceptance performs the atomic live transition server-side; rollback target is derived server-side). The overall verdict remains **NO-GO** solely because `GITHUB_ACCESS_TOKEN` rotation is still **OUTSTANDING**, and until 18G live-executes the sequencing matrix.

> **18E final GO gate result (2026-09-14).** Two production-blocking items remain, so the verdict is **NO-GO** (downgraded from GO WITH CONDITIONS):
>
> 1. **`GITHUB_ACCESS_TOKEN` exposure CANNOT BE RULED OUT.** The pre-18B unauthenticated functions make it impossible to rule out that the token was exercised anonymously during that window; whether it was configured then is not determinable from the repository. Rotation is **required** and remains **OUTSTANDING** (manual owner action, not independently verifiable).
> 2. **NEW P1 — deployment sequencing gates are client-side only.** SHA-drift block, verification-before-acceptance, acceptance-before-live, single-active-deployment, and rollback-verification are enforced only in React hooks (no server-side RPC/trigger/constraint). The audit's own NO-GO criteria (deployment-approval bypass, SHA-drift bypass, live-transition bypass) treat these as blocking.
>
> Deployment **authorization** (owner/admin only) is correctly server-side (RLS), which is PASS. See §3 finding #13 for full detail.

> **18D live verification result (2026-09-14).** The 18B RLS finding (#12) is now **VERIFIED RESOLVED at the live behavioural level**. `internal_role_aal2()` requires both MFA (`aal2`) and `status='active'` (fails closed to NULL), and `internal_projects` / `internal_project_budgets` carry a single `internal_cc_*` policy set with no `internal_role()`-only permissive path. The full live matrix passed — function-level **and** table-level (role switched to `authenticated`, actual SELECT/INSERT/UPDATE/DELETE): active+aal2 allowed; no-MFA, disabled+aal2 (valid session), no-role, and anonymous all denied. Build green; no secret regression; no data leakage.
>
> **Verdict rationale:** no P0, no open production-blocking code P1. The one remaining potentially-blocking item is the **`GITHUB_ACCESS_TOKEN` manual review** — determine whether the token was ever invoked through the previously-unauthenticated functions pre-18B, and rotate if exposure cannot be ruled out. This is a credential-exposure question that cannot be independently resolved from the repository, so the verdict is held at GO WITH CONDITIONS rather than GO.

The application's core authorization model is sound (role-aware RLS, privileged writes server-side, no committed secrets, client permissions UI-only). Remaining conditions: close the `GITHUB_ACCESS_TOKEN` manual item, run the broader lifecycle matrices (SHA-drift, deployment chain, verification, acceptance, rollback) as a real user, and (P2) apply the deferred hardening.

---

## 2. Severity Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **P1 HIGH** | `list-github-repos` — no auth; anonymous repo enumeration | **FIXED (18B deployed)** |
| 2 | **P1 HIGH** | `inspect-github-empty-repos` — no auth; anonymous repo content read | **FIXED (18B deployed)** |
| 3 | **P1 HIGH** | AuthGuard MFA check **fails open** (`catch → 'satisfied'`) | **FIXED in code** |
| 4 | **P1 HIGH** | AuthGuard role check uses negative `status !== 'disabled'` | **FIXED in code** |
| 5 | **P2 MED** | No `.gitignore` — env/secret files at risk of being tracked | **FIXED (created)** |
| 6 | **P2 MED** | No single-active-deployment DB constraint (§34 concurrency) | Documented |
| 7 | **P2 MED** | Deployment/launch `github_sha` is unvalidated free text (§22) | Documented |
| 8 | **P2 MED** | Integration URLs not scheme-validated (§23) | Documented |
| 9 | **P2 MED** | Hard-delete project confirmation is misleading + no name-confirmation (§37) | Documented |
| 10 | **P3 LOW** | Project workstream tables use soft references (no FK → orphan risk) (§7/§36) | Documented (intentional) |
| 11 | **P3 LOW** | `Access-Control-Allow-Origin: *` on Edge Functions (JWT-gated) | Documented |
| 12 | **P1 HIGH** | **(NEW 18B, resolved 18C, verified 18D)** RLS overlap defeats MFA + disabled-account enforcement on `internal_projects` / `internal_project_budgets` | **VERIFIED RESOLVED (18D)** — combined active+AAL2 check codified + live function **and** table-level behavioural matrix passed (active+aal2 allowed; no-MFA / disabled+aal2 / no-role / anonymous denied) |
| 13 | **P1 HIGH** | **(NEW 18E)** Deployment sequencing gates (SHA-drift block, verification-before-acceptance, acceptance-before-live, single-active-deployment, rollback-verification) enforced **only client-side** in React hooks — no server-side RPC/trigger/constraint | **VERIFIED RESOLVED (18G)** — 18F codified the server-side state machine (migration `202610070000`) + wired the frontend to RPCs; 18G live-executed the full matrix as an authenticated owner and every bypass test passed (see §3 finding #13) |

---

## 3. Findings — Detailed

### P1 — Unauthenticated GitHub Edge Functions

**Files:** `supabase/functions/list-github-repos/index.ts`, `supabase/functions/inspect-github-empty-repos/index.ts`

Both functions check only that `GITHUB_ACCESS_TOKEN` is present in the environment, then proceed to call the GitHub API with a server-side token. There is **no `auth.getUser()` JWT validation and no role check**. Any caller (anonymous, if `verify_jwt` is disabled, or any authenticated low-privilege user) can:

- enumerate all personal, collaborator, and organisation repositories (including `private`),
- read repository contents (`README.md`, `package.json`, `index.html`) and commit history.

**Remediation (prepared, requires redeploy):** Add the same JWT + owner/admin gate used by `command-centre-invite-user` and `internal-monitoring-run-check`:

```ts
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
if (!jwt) return json({ error: "Missing authentication token." }, 401);
const { data: { user }, error } = await admin.auth.getUser(jwt);
if (error || !user) return json({ error: "Invalid or expired token." }, 401);
const { data: roleRow } = await admin.from("internal_user_roles")
  .select("role, status").eq("user_id", user.id).maybeSingle();
if (!roleRow || roleRow.status !== "active" || (roleRow.role !== "owner" && roleRow.role !== "admin")) {
  return json({ error: "Insufficient permission." }, 403);
}
```

> **18B update (2026-09-14):** SaaS Supabase connected. Both functions were **redeployed via `deploy_edge_function`** with `verify_jwt=true` and the internal JWT + active owner/admin gate (mirroring `internal_role()`). The exposure is closed — the functions are no longer anonymously callable.

### P1 — AuthGuard MFA fail-open — **FIXED**

`checkMfaStatus()` caught every error and returned `'satisfied'`, which would grant privileged access whenever MFA verification threw. Now it returns an explicit `'unavailable'` state, and `AuthGuard` renders a **blocking screen** ("Unable to verify security") with Retry / Sign out — no silent allow, no redirect loop.

### P1 — Account-status negative check — **FIXED**

`fetchRole` granted a role for any `status !== 'disabled'`, so a `pending`/`suspended`/missing status would have been treated as an active account. Now it uses the explicit allow-list `status === 'active'`, matching the server-side `internal_role()` behaviour exactly.

### P1 — RLS policy overlap defeats MFA + disabled-account enforcement — **VERIFIED RESOLVED (18D)**

**Tables:** `internal_projects`, `internal_project_budgets`.

Live `pg_policies` shows each table carries **two overlapping policy sets per command**, which Postgres ORs together:

- `internal_cc_*` → `internal_role_aal2()` — requires `auth.jwt()->>'aal' = 'aal2'` (MFA), but `internal_role_aal2()` **does not check `status`**.
- `internal_projects_*` / `internal_budgets_*` → `internal_role()` — requires `status='active'`, but **does not require MFA**.

Effective access is therefore the union, meaning **neither control holds**:
- Active role-holder **without MFA** → read/write via the non-aal2 policies.
- **Disabled/suspended** owner/admin with a still-valid `aal2` session (app-level `status` does not invalidate the Supabase session) → read/write via `internal_cc_*`.

This is a sensitive-RLS-gap / defense-in-depth failure on the project registry and financial data. The 5 new lifecycle tables (integrations, launch approvals, deployments, maintenance, reviews) each have a single correct policy set and are unaffected.

**Remediation (18C — applied):** migration `202610060000_rls_blocker_remediation_18c.sql` codifies the combined check. `internal_role_aal2()` now requires **both** `aal2` and `status='active'` (fails closed to NULL); the legacy `internal_projects_*` / `internal_budgets_*` policies are dropped; the `internal_cc_*` policies on both tables are (re)created against `internal_role_aal2()`. Post-migration enumeration confirms each table has exactly 4 `internal_cc_*` policies and **no** `internal_role()`-only path. The live function matrix passed (active+aal2 → role; no-MFA / disabled / no-role / anonymous → NULL).
>
> **18C correction:** live inspection found the 18B reading overstated the live exposure — `internal_role_aal2()` already carried `status='active'` and the legacy policies were already `false`. The real defect was **migration/live drift** (secure state uncaptured in `.sql`), now closed by the migration.
>
> **18D live verification (2026-09-14):** policy enumeration confirmed exactly 4 `internal_cc_*` policies per table, all gated on `internal_role_aal2()`, zero `internal_role()`-only path. Table-level matrix (role switched to `authenticated`): active owner+aal2 → SELECT 12/6 rows, UPDATE 12 rows (allowed); active owner+aal1 → SELECT 0, UPDATE 0, INSERT **rejected** (`new row violates row-level security policy`); no-role+aal2 → SELECT 0; disabled admin+aal2 (valid session) → `internal_role_aal2()` NULL, SELECT 0, UPDATE 0; anonymous → 0. Both former bypass cases (active non-MFA; disabled+aal2) are **blocked**. Admin account restored to `active`; no test rows leaked.

### P1 — Deployment sequencing gates client-side only — NEW (18E)

**Tables:** `internal_project_deployments`, `internal_project_launch_approvals`.

Deployment **authorization** is server-side (RLS: SELECT any active role, writes `internal_role() IN ('owner','admin')`). But the **sequencing/safety rules** are enforced only in the React hooks (`useProjectDeployment.ts` / `useProjectLaunch.ts`):

- **SHA drift** — `markCompleted` compares `github_sha` vs `deployed_sha` (client-side; no DB/RPC check).
- **Verification-before-acceptance** — `acceptProduction` requires `status === 'VERIFIED'` (client-side).
- **Acceptance-before-live** — `acceptProduction` sets `status='live'` + `launched_at` only when not already launched; the only partial server guard is the `.is('launched_at', null)` filter.
- **Single-active-deployment** — SELECT-then-INSERT TOCTOU; no partial unique index (confirmed via `pg_indexes`).
- **Rollback verification** — `markRolledBack` requires `deployed_sha === rollback_sha` (client-side).

Live inspection confirmed no server-side enforcement: `pg_proc` has no deploy/launch/accept/rollback/verify function, and `pg_trigger` on both tables is empty. A non-privileged user cannot bypass these (RLS blocks them), but an authorized owner/admin can via direct API. The audit's NO-GO criteria (deployment-approval bypass, SHA-drift bypass, live-transition bypass) treat these as blocking. **Remediation (deferred to 18F):** move the sequencing gates into SECURITY DEFINER RPCs or triggers + a partial unique index for single-active-deployment.

> **18F remediation (2026-09-14):** the server-side state machine was already present live (9 `deployment_*` RPCs + `internal_guard_project_launch` trigger + `false` write policies) but uncaptured in any migration — live/migration drift. Migration `202610070000` codifies it, and hardens `deployment_complete_verification` / `deployment_complete_rollback` to reject mandatory `UNKNOWN` checks (previously only `FAIL`). `useProjectDeployment.ts` is rewired to the RPCs (no direct writes); `deployment_accept` performs the atomic live transition server-side; `deployment_start_rollback` derives the target SHA server-side. Direct owner/admin advanced-state inserts/updates are blocked by the `false` write policies. Live behavioural matrix remains deferred to 18G.
>
> **18G live verification (2026-09-14) — VERIFIED RESOLVED.** All objects confirmed live (`pg_proc`/`pg_policies`/`pg_trigger`/`pg_class`: 9 SECURITY DEFINER RPCs, `internal_assert_owner_admin`, `internal_deployment_audit`, `internal_guard_project_launch` trigger, `false` INSERT/UPDATE/DELETE policies, RLS enabled). Executed as an authenticated owner via `set_config('request.jwt.claims', …)` against safe test records (removed afterward). Results: SHA drift → `SHA_DRIFT`; SHA unavailable → `SHA_VERIFICATION_UNAVAILABLE` (fail-closed); deployed-SHA mismatch → `DEPLOYED_SHA_MISMATCH`; verification UNKNOWN → `VERIFICATION_INCOMPLETE`, FAIL → `VERIFICATION_FAILED` (forged client PASS cannot bypass); acceptance-before-verification → `ACCEPTANCE_NOT_ALLOWED`; direct `status='live'` → `LAUNCH_TRANSITION_REQUIRES_ACCEPTANCE` and direct `launched_at` → `LAUNCHED_AT_REQUIRES_ACCEPTANCE` (trigger); first-launch acceptance → atomic `live` + `launched_at`; later release → `launched_at` preserved; concurrent start → `DEPLOYMENT_ALREADY_ACTIVE`; rollback target derived server-side (no client SHA), cross-project impossible (single `failed_deployment_id` input, target scoped to same project), rollback UNKNOWN/FAIL → `ROLLBACK_VERIFICATION_FAILED`; valid rollback → `ROLLED_BACK` with lineage preserved. Anonymous / no-role → `UNAUTHORIZED`. Full audit trail with actor identity. The single remaining blocker is the manual `GITHUB_ACCESS_TOKEN` rotation (unchanged).

### P2 — Single-active-deployment constraint

`internal_project_deployments` has no partial unique index preventing two `DEPLOYING`/`VERIFYING` rows for the same project. Concurrent duplicate deployments are currently prevented only by disabled UI buttons. A focused partial unique index is recommended:

```sql
CREATE UNIQUE INDEX internal_project_deployments_one_active
  ON public.internal_project_deployments (project_id)
  WHERE status IN ('DEPLOYING','VERIFYING');
```

### P2 — SHA validation

`github_sha` / `last_known_good_sha` on launch approvals and deployments are free-text with no commit-identifier validation. Server-side SHA shape validation (40-hex) at write time would prevent arbitrary text from masquerading as a commit reference.

### P2 — URL scheme validation

Integration-record URLs (`github_url`, `production_url`, `staging_url`, `supabase_dashboard_url`, `monitoring_dashboard_url`) are not validated against unsafe schemes (`javascript:`, `data:`). Support-integrations already reject `search/hash/user/password` — the same allowlist (`https://` / `http://` only) should apply to project integration URLs before they are rendered as clickable links.

### P2 — Hard-delete confirmation

`handleDelete` issues a single `.delete()` on `internal_projects` (RLS-gated to owner/admin — server-enforced, good). Two issues:

1. The confirmation message claims *"All related ideas, bugs, change requests, notes, and file links will also be removed"* — but there is **no cascade**. Those workstream tables use soft `bigint project_id` references, so deleting the project **orphans** them rather than deleting them (deployment/launch/budget history are therefore *preserved*, which is good for audit, but the message is wrong).
2. No stronger confirmation (e.g. typing the project name). Recommend: type-to-confirm for hard delete, and correct the message to state which records are deleted vs archived/orphaned.

### P3 — Soft references / orphan risk

Project workstream tables intentionally use `project_id bigint` without a hard FK (documented "DFP Command 09 note"). This avoids accidental cascade destruction of audit history but permits orphaned records after a hard delete. Acceptable for now; flagged for future FK hardening (e.g. `ON DELETE SET NULL`).

### P3 — CORS on Edge Functions

Edge Functions use `Access-Control-Allow-Origin: *`. This is acceptable because every privileged function resolves identity from the `Authorization` bearer token (never from `Origin`), and public webhook receivers validate HMAC signatures. Flagged as a hardening candidate, not a blocker.

---

## 4. PASS Findings (verified)

- **RLS enabled + role-aware.** `internal_*` tables have RLS enabled; `internal_role()` (SECURITY DEFINER) derives the caller's role from `auth.uid()` and only returns a role for `status = 'active'`; writes are owner/admin-only; anonymous has no access.
- **`internal_user_roles` is hardened.** Owner-only write, self-demotion/self-disable/last-owner protection via server RPCs.
- **Invite-only onboarding.** `accept_invitation` derives the user email from `auth.users` (never the browser); the legacy self-provisioning RPC was neutralised to read-only.
- **No committed secrets.** Repo-wide scan of `src/` found no service-role keys, tokens, or credentials — only documentation comments and safe UI copy. `.env` contains only `VITE_PUBLIC_*` values (publishable anon key + public URL), which are browser-safe by design.
- **Edge Functions broadly validate JWT + role.** `command-centre-invite-user`, `internal-monitoring-run-check`, `manage-support-integrations`, `runtime-*`, and the support `*` functions all resolve the caller from `auth.getUser()` and enforce role/permission checks server-side.
- **SSRF protection** in `internal-monitoring-run-check`: https-only, private/link-local/metadata IP blocking, DNS re-resolution, redirect validation, 15s timeout, per-monitor 30s cooldown.
- **Server-side authorization for privileged writes.** Support RPCs (`support_request_repair`, `support_reject_repair`, `support_create_session`, etc.) enforce `internal_has_permission` + `internal_has_site_access` in SECURITY DEFINER functions. Launch/deployment/integration writes are RLS-gated to owner/admin.
- **Client permissions are UI-only.** `usePermissions()` mirrors the server matrix; the authoritative check is `internal_has_permission()` server-side.
- **Secret redaction in diagnostics.** `wallboardDiagnostics` strips secrets/keys/tokens from surfaced errors; `CredentialPanel` shows raw secrets exactly once and stores only hash + ciphertext.
- **One integration record per project** via a unique index on `internal_project_integrations.project_id`.
- **Logging is clean.** Only `console.warn` for auth session restoration (no tokens/headers/secret payloads logged).

---

## 5. RLS / Auth / Privileged-Action Test Matrices

### RLS matrix (expected behaviour)

| Table group | Anonymous | Active viewer | Active admin/owner | Disabled user |
|-------------|-----------|---------------|--------------------|---------------|
| `internal_projects` + all `internal_*` | Denied | SELECT only | SELECT/INSERT/UPDATE/DELETE | Denied (role → NULL) |
| `internal_user_roles` | Denied | SELECT own row only | owner: all; admin: none | Denied |
| `internal_invitations` | Denied | Denied | owner only | Denied |
| `internal_project_integrations` | Denied | SELECT only | owner/admin write | Denied |

### Auth matrix (expected behaviour)

| Scenario | Result |
|----------|--------|
| Unauthenticated | Redirected to `/login` |
| Valid active user | Allowed (role-scoped) |
| Disabled/suspended user | Denied (explicit allow-list `status === 'active'`) |
| MFA-required but unverified | Held on `/mfa/verify` |
| MFA verification **unavailable/error** | **Blocked (fail-closed) — fixed** |
| Expired/invalid JWT | Session cleared → `/login` |

### Privileged-action server denial (expected)

| Action | Anonymous | Viewer | Active admin/owner |
|--------|-----------|--------|--------------------|
| Approve/reject launch | Denied | Denied (RLS) | Allowed |
| Start / accept / rollback deployment | Denied | Denied (RLS) | Allowed |
| Delete project | Denied | Denied (RLS) | Allowed (see §37 warnings) |
| Modify integrations | Denied | Denied (RLS) | Allowed |
| Runtime control | Denied | Denied (JWT + role) | Allowed (allowlisted connector) |
| Approve high-risk AI action | Denied | Denied (server gate) | Allowed (approval-gated) |

> These matrices reflect the **intended** behaviour encoded in RLS/RPCs/Edge Functions. They could not be executed live because no backend is connected; they should be re-verified against a live environment as part of launch.

---

## 6. Required Manual Actions

1. ~~Connect backend + redeploy GitHub functions~~ **DONE (18B)** — deployed with `verify_jwt=true` + active owner/admin gate.
2. **Set `GITHUB_ACCESS_TOKEN` in Supabase Secrets** (Edge Functions → Secrets) — least-privilege read-only scope; rotate if it was ever invoked unauthenticated.
3. ~~Apply indexes~~ **DONE (18B)** — lifecycle migrations `202609250000`–`202610050000` applied; RLS enabled on all `internal_project%` tables.
4. ~~Re-run the RLS matrix~~ **DONE (18D)** — `internal_projects` / `internal_project_budgets` live-verified (active+aal2 allowed; no-MFA / disabled+aal2 / no-role / anonymous denied). Broader privileged-action / SHA-drift / deployment / verification / rollback matrices still to be live-executed.
5. **Review the hard-delete confirmation copy** to accurately describe what is deleted vs orphaned (see §37).

---

## 7. Secrets Requiring Rotation

**None discovered in source control.** `.env` contains only public `VITE_PUBLIC_*` values. No service-role keys, GitHub tokens, database passwords, or private keys were found committed.

> If the GitHub `GITHUB_ACCESS_TOKEN` was ever invoked through the previously-unauthenticated functions, rotate it as a precaution (manual action #2).

---

## 8. Non-Changes Observed

No product behaviour, lifecycle, commercial logic, deployment workflow, monitoring thresholds, or external integrations were changed. No secrets were rotated automatically. No Git history was rewritten.