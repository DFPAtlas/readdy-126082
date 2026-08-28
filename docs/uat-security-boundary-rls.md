# UAT Security Boundary — RLS Reference

> Permanent reference of the Row Level Security (RLS) boundary for the UAT tester
> marketplace (Prompts 08–13). Captured from the live database so it stays in sync
> with code changes and future prompts.
>
> Generated: 2026-08-28

---

## 1. Helper functions (`app_private` / `public`)

All helper functions are `SECURITY DEFINER` with `SET search_path TO ''` (hardened).

| Function | Returns | Notes |
|---|---|---|
| `app_private.is_admin()` | boolean | `auth.uid()` matches an active `admin_profiles` row (`owner`/`super_admin`/`admin`), **or** JWT `aal=aal2` + `internal_user_roles` (`owner`/`admin`). |
| `app_private.is_staff()` | boolean | Referenced by `is_internal()` (not dumped here — defined in an earlier migration). |
| `app_private.is_internal()` | boolean | `is_admin() OR is_staff()`. |
| `app_private.current_uat_tester_id()` | uuid | Returns `uat_testers.id` for the signed-in user where `status IN ('approved','active')`. Returns NULL if none. |
| `app_private.can_access_uat_job(target_job_id)` | boolean | `is_admin()` **or** tester is `approved/active` **and** (job `open`, has an application, or has an assignment). |
| `public.resolve_tester_from_auth()` | uuid | **Raises** if no `approved` tester found. Used inside the session/result/evidence write RPCs to hard-gate writes. |
| `public.uat_tester_comm_project_ids(tester_uuid)` | setof uuid | Project ids a tester can see via their assignments. |

**Key distinction:** `current_uat_tester_id()` is *lenient* (returns NULL, used for reads);
`resolve_tester_from_auth()` is *strict* (raises, used for writes). Do not swap them.

---

## 2. Role buckets used by policies

- `anon` — unauthenticated public. Only allowed to *apply* (insert) and never read back.
- `authenticated` — any signed-in user. Scoped further by ownership checks.
- `PUBLIC` — a policy targeting all roles (the check expression itself does the scoping, e.g. `is_internal()`).

---

## 3. RLS policies by table

All UAT tables have `RLS enabled = true` (`rls_forced = false`).

### Core tester identity

**`uat_testers`**
- `uat_testers_public_apply` (INSERT, anon) — create a *pending* application: `user_id IS NULL`, `status='pending'`, `notes IS NULL`, `is_over_18`, name 2–120 chars, email format validated.
- `uat_testers_select_own` (SELECT, authenticated) — `user_id = auth.uid()`.
- `uat_testers_admin_all` (ALL, authenticated) — `is_admin()`.

**`uat_tester_applications`**
- `Allow public insert` (INSERT, authenticated+anon) — `status='submitted'`, `admin_notes IS NULL`, `reviewed_by/at IS NULL`, valid reference (8–80 chars), valid email.
- `Allow public lookup by reference and email` (SELECT, anon) — `false` (hard-blocked; lookups go through a server-side path, not direct read).
- `Allow admin select` / `Allow admin update` (SELECT/UPDATE, authenticated) — `is_internal()`.

### Jobs, assignments, marketplace

**`uat_jobs`**
- `uat_jobs_admin_all` (ALL) — `is_admin()`.
- `uat_jobs_tester_select` (SELECT) — `can_access_uat_job(id)`.

**`uat_assignments`**
- `uat_assignments_select_own` (SELECT) — `tester_id = current_uat_tester_id()`.
- `uat_assignments_admin_all` (ALL) — `is_admin()`.

**`uat_job_applications`**
- `uat_applications_insert_own` (INSERT) — `tester_id = current_uat_tester_id()`, `status='pending'`, `admin_notes IS NULL`, job `open`.
- `uat_applications_select_own` (SELECT) — `tester_id = current_uat_tester_id()`.
- `uat_job_applications_admin_all` (ALL) — `is_admin()`.

**`uat_projects`** — `uat_projects_admin_all` (ALL) + `uat_projects_tester_select` (SELECT, via `can_access_uat_job`).

**`uat_environments`** — `uat_environments_admin_all` (ALL) + `uat_environments_tester_select` (SELECT, only while assignment is `assigned/reserved/in_progress/testing`).

### Test cases & steps (read-only for testers)

**`uat_test_cases`**
- `testers_read_assigned_cases` (SELECT) — via `uat_assignment_test_cases` → own tester.
- `Internal access uat_test_cases` (ALL) — `is_internal()`.

**`uat_test_case_steps`**
- `testers_read_assigned_steps` (SELECT) — via assignment test cases.
- `staff_manage_case_steps` (ALL) — `staff_profiles` role in `staff/admin/super_admin`.

**`uat_test_suites`**
- `testers_read_assigned_suites_v2` (SELECT) — via assignment→job→project.
- `staff_manage_test_suites` (ALL) — staff roles.

**`uat_assignment_test_cases`**
- `testers_read_own_assign_cases` (SELECT) — `tester_id` matches own approved tester.
- `testers_update_own_assign_cases` (UPDATE) — same ownership.
- `staff_manage_assign_cases` (ALL) — staff roles.

### Results, sessions, evidence (the runner)

**`uat_test_case_results`**
- `testers_read_own_results` (SELECT) / `testers_insert_own_results` (INSERT) / `testers_update_own_results` (UPDATE) — all keyed to own approved `tester_id`.
- `staff_read_all_results` (SELECT) + `admin_read_all_results` (SELECT) — staff/admin read.

**`uat_sessions`**
- `testers_read_own_sessions` / `testers_insert_own_sessions` / `testers_update_own_sessions` — own approved tester.
- `staff_read_all_sessions` (SELECT) — `is_admin()`.
- `Internal access uat_sessions` (ALL) — `is_internal()`.

**`uat_evidence`**
- `testers_read_own_evidence` (SELECT) — own approved tester.
- `staff_manage_evidence` (ALL) — staff roles.
- `Internal access uat_evidence` (ALL) — `is_internal()`.

**`uat_evidence_events`** — `staff_read_evidence_events` (SELECT, staff roles) only. Testers do not read raw event rows.

**`uat_session_events`**
- `testers_read_own_events` (SELECT) — own approved tester.
- `staff_read_all_events` (SELECT) — active admin.

### Rewards / payments

**`uat_payments`**
- `uat_payments_select_own` (SELECT) — `tester_id = current_uat_tester_id()`.
- `uat_payments_admin_all` (ALL) — `is_admin()`.

**`uat_payment_entitlements` / `uat_payment_disputes`** — `internal_all_*` (ALL) — `is_internal()`. Tester-inaccessible.

### Feedback & reproduction

**`uat_feedback`**
- `uat_feedback_select_own` (SELECT) — own tester.
- `uat_feedback_insert_own` (INSERT) — own tester, `admin_notes IS NULL`, `status='open'`, assignment belongs to tester.
- `uat_feedback_update_own` (UPDATE) — own tester, `status IN ('open','needs_info')`, `admin_notes IS NULL` on write.
- `uat_feedback_admin_all` (ALL) — `is_admin()`.

**`uat_feedback_messages`** — `uat_fm_testers_read`/`uat_fm_testers_insert` (own feedback thread) + `uat_fm_staff_all`.

**`uat_feedback_session_events`** — `tester_insert_fse`/`tester_select_fse` (own feedback) + `staff_all_fse`.

**`uat_reproduction_runs` / `uat_reproduction_steps` / `uat_reproduction_events`** — staff full access + tester read-own (via feedback).

### Tester profile extras

**`uat_tester_ratings` / `uat_tester_badges`** — `*_select_own` (own tester) + `*_admin_all`.

**`uat_badges`** — `uat_badges_public_select` (SELECT, authenticated+anon, `is_active=true`) + `uat_badges_admin_all`.

**Internal-only (tester-inaccessible)**: `uat_tester_capabilities`, `uat_tester_devices`, `uat_tester_availability`, `uat_tester_agreements`, `uat_tester_warnings`, `uat_audit_log`, `uat_reports` (admin), `uat_test_plans`, `uat_test_scenarios`, `uat_retests`, `uat_approvals`.

**Sandbox tables** (`uat_sandbox_*`) — staff manage + tester read-own (scoped by `tester_id` or via assignment→job→project). Not part of the marketplace reward flow.

**Terms**: `uat_terms_versions` (`authenticated_read_active_version` + `staff_manage_versions`); `uat_terms_acceptances` (`users_read_own_acceptance` = `user_id = auth.uid()` + `staff_read_all_acceptances`).

---

## 4. Storage policies (evidence uploads)

Two distinct buckets exist. **They are separate systems — do not merge them.**

### `uat-evidence` (marketplace tester evidence — the runner uses this)

| Policy | Command | Rule |
|---|---|---|
| `uat_evidence_tester_insert` | INSERT | `bucket_id='uat-evidence'` AND `owner=auth.uid()` |
| `uat_evidence_tester_select` | SELECT | `bucket_id='uat-evidence'` AND `owner=auth.uid()` |
| `uat_evidence_tester_delete` | DELETE | `bucket_id='uat-evidence'` AND `owner=auth.uid()` |

### `bs-uat-evidence` (Both-Sides capability-gated evidence — separate product)

| Policy | Command | Rule |
|---|---|---|
| `uat_evidence_objects_insert` | INSERT | `bucket_id='bs-uat-evidence'` AND `bs_has_uat_capability('bs_uat_execute_tests')` OR `bs_has_uat_capability('bs_uat_review_evidence')` |
| `uat_evidence_objects_read` | SELECT | `bucket_id='bs-uat-evidence'` AND (`owner=auth.uid()` OR `bs_has_uat_capability('bs_uat_review_evidence')`) |
| `uat_evidence_objects_update` / `delete` | UPDATE/DELETE | `bucket_id='bs-uat-evidence'` AND `owner=auth.uid()` |

> Note: the marketplace runner (`/account/uat/.../run`) writes to **`uat-evidence`** via
> `prepare_uat_evidence_upload`. The `bs-uat-evidence` bucket is a different "Both Sides"
> capability system and is unrelated to tester marketplace evidence.

---

## 5. Security invariants (do not violate)

1. **Testers read only their own data** — every tester policy keys on `tester_id` → own `auth.uid()` (approved/active status).
2. **`anon` can apply but never read** — the `Allow public lookup by reference and email` policy is `false` (server-side path only).
3. **Writes go through `SECURITY DEFINER` RPCs** (`resolve_tester_from_auth`, `update_uat_test_case_result`, `finish_uat_session`, `prepare_uat_evidence_upload`) — the runner never inserts raw rows directly.
4. **Internal notes never exposed** — `admin_notes` / `review_notes` / `internal_notes` are gated behind `is_internal()`/`is_admin()` policies and are never selected on tester pages.
5. **Reward amounts are snapshots** — tester reads come from `uat_payments` (`reward_amount_minor`) / `uat_assignments.agreed_reward_amount_minor`, never the live job reward.
6. **Do not add a policy that widens `uat_payments`, `uat_evidence`, `uat_feedback`, or `uat_sessions` beyond `current_uat_tester_id()` / own-tester checks.**

---

## 6. Verification history

- Prompt 12 (runner): provisioned `uat-evidence` bucket + 3 tester policies; **no table RLS changed**.
- Prompt 13 (status/earnings): **no RLS changes**; added tester-facing review labels only.
- UAT connect check: `uat_testers` retains its 3 policies; all helper functions unchanged.