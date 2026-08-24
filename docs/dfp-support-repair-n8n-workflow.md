# DFP Support — Repair Executor (n8n Workflow Spec)

> **Purpose:** Complete the n8n execution layer required by `N8N_SUPPORT_REPAIR_URL`.
> The DFP Command application side (Prompt 12) already exists — do not rebuild it.
>
> **Role of this workflow:** A **controlled, read-only-ish repair executor**. It is
> NOT an unrestricted AI agent. It executes one previously human-approved, allowlisted
> repair action per request, verifies the result, and posts a signed callback back.

---

## 1. Architecture

```
DFP Command (support-repair-run Edge Function)
        │  POST + HMAC signature (x-dfp-timestamp / x-dfp-signature)
        ▼
n8n  "DFP Support — Repair Executor"
   Webhook → verify signature → validate → allowlist → route site
        → idempotency check → state check → execute → verify
        → build result → signed callback
        ▼
DFP Command (support-repair-result Edge Function)
   → updates support_repair_actions + audit
```

Principle (unchanged from Prompt 12):

```
DIAGNOSE → RECOMMEND → HUMAN APPROVAL → SECURE n8n EXECUTION
        → STATE CHECK → REPAIR → VERIFY → SIGNED CALLBACK → AUDIT
```

---

## 2. The HMAC contract (must match byte-for-byte)

Both directions use the **same** signing scheme. Getting this wrong breaks the
whole chain.

**Algorithm:** HMAC-SHA256, hex-encoded **lowercase**.

**Message:** `${timestamp}.${rawBody}`

- `timestamp` = epoch milliseconds as a string (`Date.now().toString()`).
- `rawBody` = the **exact JSON body bytes** as sent/received.

**Headers:** `x-dfp-timestamp` and `x-dfp-signature`.

**Timestamp window:** 15 minutes (the callback Edge Function enforces this; the
n8n workflow must enforce the same on incoming requests).

### 2.1 Outbound (DFP Command → n8n)

Headers sent by `support-repair-run`:

```
x-dfp-timestamp: 1751371200000
x-dfp-signature: <hex hmac-sha256 of "1751371200000.{body}">
content-type: application/json
```

Body:

```json
{
  "repair_action_id": "0e6f8f5e-…-uuid",
  "ticket_id": "…-uuid",
  "customer_id": "…-uuid",
  "site_id": "…-uuid",
  "user_id": "…-uuid",
  "action_type": "reactivate_account",
  "approved_by": "…-uuid",
  "approved_at": "2026-08-26T09:00:00.000Z",
  "parameters": {
    "expected_current_status": "suspended",
    "target_status": "active"
  }
}
```

> `approved_by` is the staff UUID; `parameters` carries only
> `expected_current_status` / `target_status` (validated identifiers). Never any
> tokens, passwords, or unrelated data.

### 2.2 Callback (n8n → DFP Command)

Headers the n8n workflow must send to the `support-repair-result` endpoint:

```
x-dfp-timestamp: 1751371230000
x-dfp-signature: <hex hmac-sha256 of "1751371230000.{body}">
content-type: application/json
```

---

## 3. Prerequisites (credentials & secrets)

Configure these as **n8n credentials / environment variables** — never in Code node
source, Set node values, workflow names, notes, response bodies, or the DFP frontend.

| Name | Where | Purpose |
|---|---|---|
| `N8N_SUPPORT_SHARED_SECRET` | n8n credential / env | HMAC signing both directions |
| `DFP_REPAIR_CALLBACK_URL` | n8n credential / env | `https://<PROJECT_REF>.supabase.co/functions/v1/support-repair-result` |
| Per-site connector creds | n8n credential (per site) | The Forge / LetHub / QuickGuard / etc. |

Enable **n8n credential masking** where available. Never log secrets.

---

## 4. Workflow node map

```
[1] Webhook (POST, "DFP Support — Repair Executor")
        │
[2] Code: verify_signature        → INVALID_SIGNATURE  (401)
        │
[3] Code: validate_payload        → INVALID_PAYLOAD    (400)
        │
[4] Switch: action_type allowlist → UNKNOWN_ACTION     (403)
        │
[5] Switch: site routing (site_id → connector)
        │                        → SITE_CONNECTOR_UNAVAILABLE
        │
[6] Code/DB: idempotency check    → reuse existing result
        │
[7] Code: current state check     → STATE_CHANGED / SECURITY_REVIEW_REQUIRED
        │
[8] Sub-workflow / per-action node: execute repair
        │
[9] Code: post-repair verification → VERIFICATION_FAILED
        │
[10] Code: build structured result
        │
[11] Code: sign callback + HTTP Request (POST to DFP callback)
        │                        → CALLBACK_FAILED (retry callback only)
        │
[12] Respond 200 to DFP Command
```

---

## 5. Node-by-node detail

### [1] Webhook

- Method: `POST`.
- **Enable "Raw Body"** in the Webhook node options. HMAC must be computed over the
  exact raw bytes; a re-parsed/re-serialised object will produce a different signature.
- Respond immediately — do not block the incoming HTTP request on the full repair.
  (DFP Command's `support-repair-run` treats a 2xx as "executing".)

### [2] Verify signature (Code node)

```javascript
const crypto = require('crypto');
const secret = $env.N8N_SUPPORT_SHARED_SECRET;

const timestamp = $request.headers['x-dfp-timestamp'];
const signature = ($request.headers['x-dfp-signature'] || '').toLowerCase();
const rawBody = $request.rawBody; // exact bytes, requires "Raw Body" enabled

if (!secret || !timestamp || !signature || !rawBody) {
  return [{ json: { ok: false, error_code: 'INVALID_SIGNATURE', httpStatus: 401 } }];
}

const tsMs = parseInt(timestamp, 10);
if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > 15 * 60 * 1000) {
  return [{ json: { ok: false, error_code: 'INVALID_SIGNATURE', httpStatus: 401 } }];
}

const expected = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

const a = Buffer.from(expected, 'utf8');
const b = Buffer.from(signature, 'utf8');
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return [{ json: { ok: false, error_code: 'INVALID_SIGNATURE', httpStatus: 401 } }];
}

return [{ json: { ok: true, body: $request.body } }];
```

> If `$request.rawBody` is unavailable in your n8n version, configure the Webhook
> node to **not auto-parse** the body and `JSON.parse` it inside this node after
> verification — so the signature is always checked against the literal bytes.

### [3] Validate payload (Code node)

Required fields, all strings (UUIDs validated with the same regex DFP uses):

```javascript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function check(p) {
  if (!p || typeof p !== 'object') return { ok: false, code: 'INVALID_PAYLOAD' };
  if (!UUID_RE.test(p.repair_action_id || '')) return { ok: false, code: 'INVALID_PAYLOAD', reason: 'repair_action_id missing/invalid' };
  if (!p.action_type || typeof p.action_type !== 'string') return { ok: false, code: 'INVALID_PAYLOAD', reason: 'action_type missing' };
  // ticket_id / customer_id / site_id / user_id are optional but must be valid UUIDs if present
  for (const k of ['ticket_id', 'customer_id', 'site_id', 'user_id', 'approved_by']) {
    if (p[k] != null && !UUID_RE.test(String(p[k]))) return { ok: false, code: 'INVALID_PAYLOAD', reason: `${k} invalid` };
  }
  return { ok: true };
}
// …return [{ json: check($json.body) }];
```

**Reject outright** (never pass through): `password`, `session_token`,
`api_key`/`api_secret`, `sql`, `shell`/`command`, `url`/`endpoint`, `function_name`.

### [4] Action allowlist (Switch node)

Exact allowlist. Anything else → `UNKNOWN_ACTION` (403). HIGH/CRITICAL never reach
here because `support-repair-run` already refuses them, but **this Switch is the
defence-in-depth boundary** and must reject anything not on this list.

| Risk | action_type |
|---|---|
| LOW | `resend_verification_email`, `resend_password_reset_email`, `retry_failed_email`, `refresh_account_sync`, `retry_failed_webhook`, `rebuild_customer_mapping`, `clear_safe_application_cache` |
| MEDIUM | `unlock_login`, `reactivate_account`, `refresh_permissions`, `refresh_subscription_status` |

### [5] Site routing (Switch on `site_id`)

Resolve `site_id` against the DFP product/integration registry to select the
connector sub-workflow. Do **not** hard-code a monolithic executor; add connectors
as new branches so future DFP sites don't require rebuilding the whole workflow.

- The Forge → Forge connector
- LetHub → LetHub connector
- QuickGuard → QuickGuard connector
- GuardianHub → GuardianHub connector
- (future) → registered connector

No connector → callback with `error_code: SITE_CONNECTOR_UNAVAILABLE` (status `failed`).

### [6] Idempotency check

Store/retrieve an execution record keyed by `repair_action_id` (n8n workflow
execution data, or a small n8n-accessible store):

```
repair_action_id | action_type | status | started_at | completed_at | result
```

- If `repair_action_id` already `completed`/`failed` → **do not execute again**;
  return the **existing** result through the callback.

### [7] Current state check (before any state-changing repair)

For state-changing types (`reactivate_account`, `unlock_login`,
`refresh_permissions`), read the **actual current state** from the connector.

- If actual ≠ `parameters.expected_current_status` → callback `status: failed`,
  `error_code: STATE_CHANGED`, `message: "Account state changed since approval."`.
- If security indicators are present (see §6) → `SECURITY_REVIEW_REQUIRED`.

### [8] Execute repair (per-action nodes)

Each allowlisted action calls **only its predefined integration**. No dynamic
dispatch on incoming text. Validate parameters per type (e.g. `reactivate_account`
accepts `user_id` + `expected_current_status`, nothing else). See §7 for
per-action behaviour.

### [9] Post-repair verification

A `200` is **not** success. Re-read the account/state and confirm the change.

`verification.status` ∈ `confirmed` | `warning` | `failed`.

If verification fails → callback `status: failed`, `error_code: VERIFICATION_FAILED`.

### [10] Build structured result

```json
{
  "repair_action_id": "…",
  "status": "completed",
  "action_type": "reactivate_account",
  "site_id": "…",
  "started_at": "2026-08-26T09:01:00.000Z",
  "completed_at": "2026-08-26T09:01:12.000Z",
  "previous_state": "suspended",
  "new_state": "active",
  "verification": { "status": "confirmed", "message": "Account confirmed active" },
  "message": "Account reactivated and verified.",
  "error_code": null
}
```

### [11] Sign callback + HTTP Request

```javascript
const crypto = require('crypto');
const secret = $env.N8N_SUPPORT_SHARED_SECRET;

const body = {
  repair_action_id: $json.repair_action_id,
  status: $json.status,                       // "completed" | "failed" | "completed_with_warning"
  action_type: $json.action_type,
  site_id: $json.site_id,
  started_at: $json.started_at,
  completed_at: $json.completed_at,
  previous_state: $json.previous_state,
  new_state: $json.new_state,
  verification: $json.verification,
  message: $json.message,                     // human-readable reason (persisted by DFP)
  error_code: $json.error_code,               // informational
};

const rawBody = JSON.stringify(body);
const timestamp = Date.now().toString();
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

return [{ json: {
  url: $env.DFP_REPAIR_CALLBACK_URL,
  headers: {
    'content-type': 'application/json',
    'x-dfp-timestamp': timestamp,
    'x-dfp-signature': signature,
  },
  rawBody,
} }];
```

HTTP Request node → `POST` to the callback URL, send `rawBody` **verbatim** (Body
Content Type "Raw" / JSON string), with the three headers above.

> **The `message` field is where the readable reason must go** — the callback Edge
> Function persists `message` as `result_summary` / `error_message`. `error_code` is
> not separately stored, so always include a human-readable explanation in `message`.

### [12] Respond 200 to DFP Command

Return a 2xx so `support-repair-run` leaves the repair in `executing`. The final
status arrives later via the callback (async — no need to block the request).

---

## 6. Security-review branch (for security-sensitive actions)

For `unlock_login`, `reactivate_account`, `refresh_permissions`, inspect available
security indicators first. Stop execution if any of:

- suspicious login activity
- active security suspension
- fraud flag
- compromised-account flag
- administrator security hold

Stop → callback `status: failed`, `error_code: SECURITY_REVIEW_REQUIRED`,
`message: "Security review required."`. Never auto-override a security hold.

---

## 7. Per-action behaviour

| action_type | Rules |
|---|---|
| `resend_verification_email` | Confirm account exists → trigger supported verification-email flow → confirm provider accepted. **Never expose verification tokens.** |
| `resend_password_reset_email` | Confirm account exists → trigger normal reset flow. **Never set/read passwords; never return reset tokens.** |
| `retry_failed_email` | Retry only the approved failed-message reference. **No destination/address override from payload.** |
| `refresh_account_sync` | Run predefined sync → verify account mapping afterwards. |
| `retry_failed_webhook` | Retry only an existing approved failed webhook/event. **No arbitrary URL.** |
| `rebuild_customer_mapping` | Rebuild mapping using approved identifiers. **Never merge on name similarity alone.** Verify afterwards. |
| `clear_safe_application_cache` | Clear only the predefined safe cache. **Never clear auth/security audit history; no arbitrary cache keys.** |
| `unlock_login` | Check lock reason. If security-flagged → `SECURITY_REVIEW_REQUIRED`. Else unlock + verify. |
| `reactivate_account` | Confirm current status matches expected → reactivate → verify active. |
| `refresh_permissions` | Recalculate existing permissions. **Never grant a role/permission not authorised by source (no privilege escalation).** |
| `refresh_subscription_status` | Read authoritative billing state → sync local. **Never cancel/change plan/refund/charge/modify payment method.** |

Unsupported action on a given site → callback `status: failed`, message
`"Unavailable for this site."` (never a fake success).

---

## 8. Error-code table (explicit branches)

| error_code | Trigger | HTTP on incoming | Callback status |
|---|---|---|---|
| `INVALID_SIGNATURE` | bad/missing/expired signature | 401 | — |
| `INVALID_PAYLOAD` | malformed body / bad UUID / forbidden field | 400 | — |
| `UNKNOWN_ACTION` | action not on allowlist | 403 | — |
| `SITE_CONNECTOR_UNAVAILABLE` | no connector for site | — | failed |
| `CUSTOMER_NOT_FOUND` | account missing at connector | — | failed |
| `STATE_CHANGED` | actual ≠ expected state | — | failed |
| `SECURITY_REVIEW_REQUIRED` | security indicators present | — | failed |
| `UPSTREAM_UNAVAILABLE` | connector/billing provider down | — | failed |
| `REPAIR_FAILED` | repair operation errored | — | failed |
| `VERIFICATION_FAILED` | post-repair verify failed | — | failed |
| `CALLBACK_FAILED` | DFP callback unreachable | — | retry callback only |
| `INTERNAL_ERROR` | unexpected | — | failed |

Never include stack traces, DB credentials, or secrets in any `message`.

---

## 9. AI restriction

- AI may later help **explain** results. It must NOT: change `action_type`, choose
  another customer, change `user_id`/`site_id`, override expected state, approve
  repairs, or execute arbitrary tools.
- The repair action is already human-approved before this workflow runs.

---

## 10. Test plan (required for live readiness)

| # | Test | Expected | Pass marker |
|---|---|---|---|
| 1 | End-to-end (`refresh_account_sync` against a **test** account) | full chain completes + record updates + audit | `E2E: PASS` |
| 2 | Duplicate delivery (same `repair_action_id` twice) | 2nd reuses result, no second change | `IDEMPOTENCY TEST: PASS` |
| 3 | State change before execute | `STATE_CHANGED`, no repair | `STALE STATE PROTECTION: PASS` |
| 4 | Invalid HMAC signature | rejected, no connector called | `REQUEST AUTH TEST: PASS` |
| 5 | Invalid callback → then signed callback | invalid rejected, valid accepted | `CALLBACK AUTH TEST: PASS` |
| 6 | Security-hold account + `unlock_login` | `SECURITY_REVIEW_REQUIRED`, no unlock | `SECURITY HOLD TEST: PASS` |

Recommended first test: `refresh_account_sync` (LOW, non-destructive). **Never use a
live customer for the first test.**

---

## 11. Callback-failure handling

If DFP Command cannot receive the callback: **retry only the callback delivery**,
never the repair. Preserve the original result in n8n execution state and re-post it.
`RETRY CALLBACK` ≠ `REPEAT REPAIR`.

---

## 12. Execution logging (n8n side)

Record where practical: `repair_action_id`, `site_id`, `action_type`, `received_at`,
validation result, state-check result, execution result, verification result,
callback result. Never store secrets/passwords in logs.