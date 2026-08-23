# Central Support Ticket — Secure Ingestion API

This document explains how an approved Digital Footprint website
(Digital-Footprint.uk, The Forge, LetHub.uk, QuickGuard.uk, Wedora, and future
sites) submits customer support tickets into the central FootprintCC ticket
database.

The endpoint is a protected Supabase Edge Function. It **never** exposes the
Supabase service-role key to a browser, and it never returns private ticket
records or internal notes.

---

## 1. Endpoint

| Purpose | URL |
| --- | --- |
| Submit a ticket | `https://<project-ref>.supabase.co/functions/v1/receive-support-ticket` |
| Manage integrations (internal admin) | `https://<project-ref>.supabase.co/functions/v1/manage-support-integrations` |
| Manage credentials (legacy, secret-gated) | `https://<project-ref>.supabase.co/functions/v1/manage-support-credentials` |

Only `POST` is accepted (plus `OPTIONS` for browser preflight). Anything else
returns `405`.

---

## 2. Request format

```json
{
  "siteSlug": "example-site",
  "externalReference": "optional-source-generated-id",
  "customer": {
    "name": "Customer name",
    "email": "customer@example.com",
    "phone": "optional",
    "customerUserId": "optional-customer-uuid"
  },
  "ticket": {
    "subject": "Short ticket subject",
    "description": "Customer support request",
    "category": "technical",
    "priority": "normal",
    "sourcePageUrl": "https://example.com/support"
  },
  "context": {
    "browser": "optional",
    "operatingSystem": "optional",
    "appVersion": "optional",
    "accountReference": "optional",
    "orderReference": "optional",
    "additionalData": {}
  },
  "consent": { "privacyAccepted": true },
  "timestamp": "2026-08-23T12:00:00.000Z",
  "nonce": "unique-request-value",
  "idempotencyKey": "optional-stable-key"
}
```

### Field limits

| Field | Max length |
| --- | --- |
| siteSlug | 100 |
| customer.name | 150 |
| customer.email | 320 |
| customer.phone | 50 |
| ticket.subject | 250 |
| ticket.description | 20,000 |
| externalReference | 200 |
| ticket.sourcePageUrl | 2,000 |

Allowed `category`: `general`, `technical`, `account`, `billing`, `access`,
`bug`, `complaint`, `feature_request`, `security`, `other`.

Allowed `priority`: `low`, `normal`, `high`, `urgent`, `critical`.
**Public submissions may only request `low` / `normal` / `high`.** If a public
request sends `urgent` or `critical`, the ticket is stored as `high` unless the
credential is a trusted server-to-server integration with elevated priority
enabled.

`consent.privacyAccepted` **must** be `true`.

---

## 3. Authentication modes

### 3a. `public_form` (browser support forms)

Designed for a plain HTML/JS form embedded in a website.

* No browser-held secret is required.
* The request `Origin` header must be in the credential's `allowed_origins`.
* Strict rate limiting applies.
* If the credential has `turnstile_required = true`, a Cloudflare Turnstile
  token must be supplied (see §5).
* Only basic ticket creation is permitted — no reads or updates.

### 3b. `server_to_server` (signed requests)

For sites with a backend or serverless function that can hold a secret.

* Requires a key prefix, timestamp, nonce, and an HMAC signature.
* The signature is verified against the stored encrypted secret using a
  timing-safe comparison.
* Stale (>5 minutes) or replayed requests are rejected.
* May enable elevated priorities (`urgent`/`critical`) if the credential allows
  it.

---

## 4. Headers

| Header | Used by | Required |
| --- | --- | --- |
| `Content-Type: application/json` | both | yes |
| `X-DFP-Site` | both | yes (or `siteSlug` in body) |
| `X-DFP-Key` | server-to-server | yes |
| `X-DFP-Timestamp` | server-to-server | yes |
| `X-DFP-Nonce` | server-to-server | yes |
| `X-DFP-Signature` | server-to-server | yes |
| `X-Idempotency-Key` | both | optional |
| `X-DFP-Turnstile-Token` | public_form (when CAPTCHA required) | conditional |

---

## 5. Turnstile CAPTCHA (public_form)

When a `public_form` credential has CAPTCHA enabled, pass the Turnstile token in
the body (`turnstileToken` or `captchaToken`) or the `X-DFP-Turnstile-Token`
header.

* The token is verified server-side against `TURNSTILE_SECRET_KEY`.
* If CAPTCHA is required but verification cannot run, production requests
  **fail closed** (no ticket is created).
* A controlled development mode exists only when `TICKET_DEV_MODE=true` is
  explicitly set (never in production).

---

## 6. Example: public-form fetch (plain HTML/JS)

```html
<form id="supportForm">
  <input name="name" type="text" required>
  <input name="email" type="email" required>
  <input name="subject" type="text" required>
  <textarea name="description" required></textarea>
  <!-- honeypot: leave empty; hidden via CSS, not inline style -->
  <input name="website_alt" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button type="submit">Send</button>
</form>

<script>
  const ENDPOINT = "https://<project-ref>.supabase.co/functions/v1/receive-support-ticket";
  const SITE_SLUG = "example-site";

  document.getElementById("supportForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const body = {
      siteSlug: SITE_SLUG,
      customer: {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
      },
      ticket: {
        subject: f.subject.value.trim(),
        description: f.description.value.trim(),
        category: "technical",
        priority: "normal",
      },
      consent: { privacyAccepted: true },
      timestamp: new Date().toISOString(),
      nonce: crypto.randomUUID(),
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      f.reset();
      // show a success message
    }
  });
</script>
```

---

## 6b. React component (reusable `SupportTicketForm`)

FootprintCC ships a reusable, configurable public-form component at
`src/components/feature/SupportTicketForm.tsx`. It handles validation,
honeypot, duplicate-submit prevention, CAPTCHA, safe success/error states, and
submits to `receive-support-ticket` — with **no** secret in the bundle.

```tsx
import SupportTicketForm from '@/components/feature/SupportTicketForm';

<SupportTicketForm
  siteSlug="YOUR_SITE_SLUG"
  defaultCategory="technical"
  defaultPriority="normal"
  sourcePageUrl={window.location.href}
  accountReference="optional-account-ref"
  orderReference="optional-order-ref"
  turnstileSiteKey="YOUR_TURNSTILE_SITE_KEY"   // only when CAPTCHA is enabled
  captchaRequired={false}                       // match the credential setting
  onSuccess={({ ticketNumber }) => console.log('created', ticketNumber)}
  onError={(message) => console.warn(message)}
/>;
```

Configuration props (all optional except `siteSlug`): `endpointUrl`,
`defaultCategory`, `defaultPriority` (low/normal/high only), `sourcePageUrl`,
`customerUserId`, `accountReference`, `orderReference`, `externalReference`,
`context`, `turnstileSiteKey`, `captchaRequired`, `compact`,
`confirmBeforeSubmit`, `onSuccess`, `onError`.

The component never accepts `urgent`/`critical` priority, never exposes the
ticket UUID, renders all input as plain text, and treats itself as an untrusted
browser client. Attachments are disabled (the ingestion endpoint does not yet
accept them) with an explanatory note.

### Internal test page

Owner/admin users can preview and test the form at
`/admin/support-integrations/test-form`. It lists active sites, shows the slug
and allowed origins, runs a safe OPTIONS dry-run, and — with explicit
confirmation — creates a real ticket marked with a `TEST-…` external reference
(no customer notification). Use a non-production test email.

---

## 7. Example: server-to-server signed request (Node)

```ts
const crypto = await import("node:crypto");

const SECRET = "<raw secret returned once at issuance>";
const KEY_PREFIX = "<key prefix returned at issuance>";
const SITE_SLUG = "example-site";
const ENDPOINT = "https://<project-ref>.supabase.co/functions/v1/receive-support-ticket";

const payload = {
  siteSlug: SITE_SLUG,
  customer: { name: "Jane Doe", email: "jane@example.com" },
  ticket: {
    subject: "Billing question",
    description: "I was charged twice this month.",
    category: "billing",
    priority: "high",
  },
  consent: { privacyAccepted: true },
};

const rawBody = JSON.stringify(payload);
const timestamp = new Date().toISOString();
const nonce = crypto.randomUUID();
const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
const canonical = `${timestamp}\n${nonce}\n${bodyHash}`;
const signature = crypto.createHmac("sha256", SECRET).update(canonical).digest("hex");

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-DFP-Site": SITE_SLUG,
    "X-DFP-Key": KEY_PREFIX,
    "X-DFP-Timestamp": timestamp,
    "X-DFP-Nonce": nonce,
    "X-DFP-Signature": signature,
  },
  body: rawBody,
});

console.log(res.status, await res.json());
```

The signature is computed over:

```
<timestamp>\n<nonce>\n<sha256-hex-of-raw-request-body>
```

---

## 8. Responses

| Case | Status | Body |
| --- | --- | --- |
| New ticket created | `201` | `{ success: true, ticketNumber: "DFP-2026-000123", message }` |
| Idempotent retry / duplicate reference | `200` | `{ success: true, ticketNumber, message }` |
| Validation failure | `400` | `{ success: false, error, fields?: [...] }` |
| Unauthorised / bad signature | `401` | `{ success: false, error }` |
| Disallowed origin / inactive / forbidden | `403` | `{ success: false, error }` |
| Replayed nonce / in-progress idempotency | `409` | `{ success: false, error }` |
| Rate limited | `429` | `{ success: false, error, retryAfter }` |
| Server error | `500` | `{ success: false, error: "Internal error", requestId }` |

The endpoint never returns the internal ticket UUID (unless already known), other
tickets, assignments, internal notes, SQL errors, credentials, or stack traces.

---

## 9. Registering a site / issuing a credential

Site registration, credential issuance, rotation and revocation are managed in
the authenticated **Support integrations** admin area
(`/admin/support-integrations`), which is only available to owner/admin
Command Centre users. The raw secret is generated server-side, stored only as
a SHA-256 hash plus an AES-GCM ciphertext, and returned **exactly once** in the
one-time setup panel — it cannot be retrieved again afterwards.

The following placeholders are used throughout this guide and in the generated
setup panel (never real secrets):

| Placeholder | Meaning |
| --- | --- |
| `YOUR_SITE_SLUG` | The site's registered URL-safe slug |
| `YOUR_KEY_PREFIX` | The `dfp_…` key prefix shown at issuance |
| `YOUR_SERVER_SECRET` | The raw secret shown once at issuance (server-side only) |
| `YOUR_IDEMPOTENCY_KEY` | A stable, unique value you generate per logical submission |

> For a `public_form` integration, the browser only needs the site slug — never
> a secret. For `server_to_server`, keep `YOUR_SERVER_SECRET` in a backend
> environment variable, never in frontend JavaScript.

Credentials are issued server-side (never in a browser). Call the management
endpoint with the admin secret:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/manage-support-credentials \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <TICKET_ADMIN_SECRET>" \
  -d '{
    "action": "issue",
    "siteSlug": "example-site",
    "clientName": "Example contact form",
    "integrationMode": "public_form",
    "allowedOrigins": ["https://www.example.com"],
    "turnstileRequired": true
  }'
```

The response contains `keyPrefix` and `secret` — **save the secret immediately;
it is shown only once.**

For a server-to-server credential:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/manage-support-credentials \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <TICKET_ADMIN_SECRET>" \
  -d '{
    "action": "issue",
    "siteSlug": "example-site",
    "clientName": "Example backend",
    "integrationMode": "server_to_server",
    "elevatedPriorityAllowed": false
  }'
```

### Revoke / rotate

Revoke a credential (keeps history, blocks future use):

```bash
curl -X POST .../manage-support-credentials \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <TICKET_ADMIN_SECRET>" \
  -d '{ "action": "revoke", "keyPrefix": "dfp_xxxxxxxxxxxx" }'
```

Rotation = revoke the old key prefix, then issue a new one.

---

## 10. Required Supabase secrets

Set these in **Supabase Dashboard → Edge Functions → Secrets** (never in `.env`
or frontend code):

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Edge Function Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role access (Edge Function only) |
| `TICKET_CREDENTIAL_ENCRYPTION_KEY` | Encrypts/decrypts credential secrets at rest |
| `TICKET_HASH_PEPPER` | HMAC pepper for nonce/idempotency/rate-limit hashes |
| `TICKET_ADMIN_SECRET` | Gates the credential-management endpoint |
| `TURNSTILE_SECRET_KEY` | Optional — verifies Cloudflare Turnstile tokens |
| `TICKET_DEV_MODE` | Optional — `true` enables controlled dev fallback only |

> Do **not** put the service-role key or any of these in `.env`, Vite
> variables, source code, or GitHub.

---

## 11. Test checklist

- [ ] Valid public submission → `201`, ticket + first message + event created.
- [ ] Valid signed server request → `201`.
- [ ] Invalid site slug → `401`.
- [ ] Inactive site → `403`.
- [ ] Disallowed origin → `403`.
- [ ] Missing required field → `400` with `fields`.
- [ ] Invalid email → `400`.
- [ ] Invalid category → `400`.
- [ ] Oversized description → `400`.
- [ ] Failed CAPTCHA → `403`.
- [ ] Reused nonce → `409`.
- [ ] Duplicate `externalReference` → `200` (same ticket number, no new ticket).
- [ ] Repeated `idempotencyKey` → `200` (same ticket number, no new ticket).
- [ ] Rate-limit breach → `429`.
- [ ] Public `urgent`/`critical` → stored as `high`.
- [ ] Unsupported HTTP method (GET/PUT) → `405`.
- [ ] Malformed JSON → `400`.
- [ ] RPC transaction rollback — a failing step leaves no partial rows.
- [ ] Anonymous `SELECT` on ticket tables returns nothing (RLS).