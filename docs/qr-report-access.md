# QR code on the invoice — patient self-service report access


## 1. Context

Patients have no way to get their own reports. Every report path is
`auth(admin, receptionist)`, so collecting a result means visiting the desk or
phoning it. The ask: a QR code on the printed invoice that a patient scans to
read their own reports once the invoice is settled.

This is the **first unauthenticated data route in the codebase** — only
`/auth/login` and `/auth/refresh-token` are public today — and it exposes medical
records. The security design is therefore the substance of this plan, not an
afterthought.

Decisions already taken:

| Decision | Choice |
|---|---|
| Access control | QR link **+ last 4 digits of the phone on file** |
| Unpaid invoice | Show the balance due, after verification |
| Which reports | `uploaded` **and** `delivered`; `pending` shown greyed out |

### Why the printed QR needs a second factor

A QR on paper is a bearer credential nobody can revoke after losing it. Invoices
get dropped, photographed, and left on counters. A token alone turns any of those
into a medical-record disclosure. The phone check costs the patient one tap and
makes a found invoice inert to a stranger.

Four digits alone is weak (10,000 combinations). Combined with a 128-bit token an
attacker must already hold, plus the attempt lockout in step 4, it is sound.

## 2. Design

### 2.1 Token

`publicToken` on the Invoice: 16 random bytes, base64url (22 chars), unique
sparse index. The QR encodes `<CLIENT_URL>/r/<publicToken>` — ~52 characters, a
version-3 QR that scans reliably at ~22mm on A4.

Stored **in plaintext, deliberately**: an invoice must reprint with the same QR,
so a hash would break reprints. The token is already printed on paper; the phone
check is what guards the data.

**Not a JWT** — a JWT payload makes the QR dense and hard to scan from paper, and
an opaque row-backed token can be revoked by regenerating one field.

### 2.2 Endpoints — new module `server/src/app/modules/PublicReport/`

Its own module rather than new routes in `invoice.route.ts`, so "public" is a
property of a whole file reviewable in one place and nobody adds an unguarded
route to the invoice router by pattern-matching.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/v1/public/reports/:token` | Centre name, invoice number, **masked** patient name, visit date. Nothing else. |
| `POST` | `/api/v1/public/reports/:token/verify` | `{ last4 }` → session JWT + full payload |
| `GET` | `/api/v1/public/reports/:token/items/:itemId/file` | Streams report bytes (session JWT required) |

**Everything sensitive sits behind verify, including the balance due.** The paper
invoice already shows the balance to whoever holds it, but a *photographed QR*
should reveal nothing — so the pre-verify page is deliberately near-empty.

The session JWT uses a **new secret** (`PUBLIC_REPORT_SECRET`), never
`JWT_ACCESS_SECRET`. A separate key means a patient token can never be replayed
against a staff endpoint. Payload `{ invoiceId, scope: 'public-report' }`,
30-minute expiry.

### 2.3 Gates the public endpoints must re-assert

The "paid in full" rule currently lives only in `markReportDelivered`. The public
route cannot rely on it and must check for itself, **on every request** including
the file fetch:

1. `invoice.isCancelled` → cancelled notice, nothing else
2. `paymentStatus !== 'paid'` → balance-due screen, **no test names** (an unpaid
   patient is still a patient; the tests they ordered are PHI)
3. Otherwise list `!isCancelled` items; `uploaded`/`delivered` viewable,
   `pending` shown as "not ready yet"

A payload that said "viewable" is never trusted on the way back in.

### 2.4 Attempt limiting

Serverless has no in-process counters, so this lives on the document:
`publicAccess: { failedAttempts, lockedUntil }`. Five failures locks the token
for 15 minutes; success resets it. Caps an attacker at ~20 guesses/hour against
10,000 combinations.

Plus a dedicated `express-rate-limit` on `/api/v1/public` — the global limiter is
500/15min and shared with staff traffic, far too loose for an unauthenticated
enumeration target.

### 2.5 Client hazard — do not use `baseApi`

`baseApi`'s `prepareHeaders` attaches a logged-in staff member's Bearer token to
every request, and `baseQueryWithReauth` dispatches `logout()` on any 401. A
patient's expired QR opened on the front-desk browser would **silently sign the
receptionist out**. `publicApi` gets its own plain `fetchBaseQuery`: no
`prepareHeaders`, no reauth wrapper. The public endpoints return `404`/`410`
rather than `401` for the same reason.

## 3. Step-by-step breakdown

Ordered so the system is never half-wired: the token exists before anything
reads it, the API is complete and testable before any UI calls it, and the QR is
printed last — only once the page it points at works.

### Step 0 — Document
Write this file to `docs/qr-report-access.md`. Branch `feat/invoice-qr-report-access`.

### Step 1 — Token on the invoice *(server)*
- `invoice.interface.ts` / `invoice.model.ts`: add `publicToken?: string` (unique,
  sparse index) and `publicAccess?: { failedAttempts: number; lockedUntil?: Date }`.
- New `utils/publicToken.ts`: `generatePublicToken()` using
  `crypto.randomBytes(16).toString('base64url')`.
- `invoice.service.ts` `createInvoice`: generate on create.
- Lazy backfill in `getInvoice` — a write-on-read for legacy rows, chosen over a
  migration script so no deploy-ordering step is needed. Idempotent and one-time
  per invoice.
- Expose `publicToken` to staff only, via the existing `serializeInvoice`.

**Done when:** a new invoice has a token, and fetching a pre-existing invoice
backfills one.

### Step 2 — Public read endpoint *(server)*
- New module `PublicReport/` with `route.ts`, `controller.ts`, `service.ts`,
  `validation.ts`.
- `GET /:token` → masked summary only. `maskName('Mustakim Al Noman')` → `M••••••• A• N••••`.
- Mount `/public` in `routes/index.ts`; add the rate limiter in `app.ts`.
- Unknown token → **404**, never 401.

**Done when:** curl with a valid token returns the masked summary; a bad token 404s.

### Step 3 — Config + session token *(server)*
- `config/index.ts`: add `PUBLIC_REPORT_SECRET`; add to `.env` and push to Vercel.
- `PublicReport/token.ts`: sign/verify the 30-minute scoped JWT.
- Middleware `publicReportAuth` verifying scope **and** that the token's
  `invoiceId` matches the `:token` in the path — otherwise a session for invoice A
  could read invoice B.

### Step 4 — Verification endpoint *(server)*
- `POST /:token/verify`, Zod-validated `last4` (exactly 4 digits).
- Compare against the last 4 of `patientInfo.phone` (strip non-digits first —
  stored numbers may carry `+880`, spaces or dashes).
- Lockout: check `lockedUntil`; on failure increment and set; on success reset.
- Returns session token + the gated payload from §2.3.

**Done when:** right code returns reports, wrong code fails, 5 failures lock.

### Step 5 — File streaming endpoint *(server)*
- `GET /:token/items/:itemId/file` behind `publicReportAuth`.
- **Re-assert all three gates**, then reuse the existing candidate-URL ladder in
  `invoice.service.ts` / `candidateFileUrls` — do not re-implement Cloudinary
  fetching.
- Same headers as the staff route: `Content-Disposition: inline`,
  `Cache-Control: private, no-store`.

### Step 6 — Public API slice *(client)*
- `services/publicApi.ts` with its **own** `fetchBaseQuery` (§2.5).
- Register its reducer/middleware in `app/store.ts`.

### Step 7 — Public page *(client)*
- `pages/public/PublicReportPage.tsx`, mobile-first, lazy-loaded.
- Three states: verify form → reports list → balance due / cancelled.
- Reuse `ReportPreviewModal` and the object-URL handling in
  `hooks/useReportPreview.ts` rather than writing new blob code.
- Route in `App.tsx` as a **sibling of `/login`**, outside `ProtectedRoute`, and
  registered explicitly — the `*` catch-all otherwise redirects to `/login`.
- EN + BN strings in `i18n/translations.ts`; `LanguageProvider` already wraps
  `BrowserRouter`, so `useT()` works here.

### Step 8 — QR on the printed invoice *(client)*
- Add `qrcode.react`; render **inline SVG**, not a data-URL image — SVG prints
  crisply at A4 and avoids an async round trip inside the `react-to-print` capture.
- Place in the existing `<footer>` of `PrintInvoicePage.tsx` (already
  `flex items-end justify-between` and `keep-together`) as a third `shrink-0`
  cell beside the signature rule, with a one-line caption in both languages.

### Step 9 — Verify, commit, deploy
Run the test cases in §4, then commit per step, PR, merge, deploy both apps.

## 4. Test cases

`INV-P` = part-paid invoice with an uploaded report. `INV-S` = settled invoice,
one report uploaded, one test still pending. `INV-C` = cancelled invoice.

### Access control

| # | Case | Steps | Expected |
|---|---|---|---|
| A1 | Valid token, pre-verify | `GET /public/reports/<INV-S token>` | 200; invoice number, masked name, visit date only. **No** test names, amounts, phone, address |
| A2 | Bad token | Alter one character | **404** (not 401) |
| A3 | Missing token | `GET /public/reports/` | 404 |
| A4 | Correct last-4 | `POST .../verify` with real last 4 | 200; session token + report list |
| A5 | Wrong last-4 | Wrong digits | 401-equivalent app error; **no** payload |
| A6 | Lockout | 5 wrong attempts | 6th rejected as locked, even with the *correct* code |
| A7 | Lockout expiry | Wait 15 min | Correct code works again |
| A8 | Success resets | 3 wrong, then correct, then 1 wrong | Counter reset — not locked |
| A9 | Cross-invoice replay | Session token from INV-S against INV-P's path | Rejected |
| A10 | Expired session | Session token older than 30 min | Rejected; page returns to verify form |
| A11 | Wrong-secret forgery | JWT signed with `JWT_ACCESS_SECRET` | Rejected |
| A12 | Staff token replay | Real staff access token as `Authorization` on the file endpoint | Rejected — staff tokens are not public sessions |

### Business rules

| # | Case | Expected |
|---|---|---|
| B1 | Settled invoice | Uploaded/delivered reports listed and viewable |
| B2 | Pending test on a settled invoice | Listed, greyed, **not** fetchable |
| B3 | Part-paid invoice | Balance-due screen; **no test names**; no files fetchable |
| B4 | Unpaid → file fetch by direct URL | Rejected — gate re-asserted server-side, not just hidden in UI |
| B5 | Cancelled invoice | Cancelled notice only |
| B6 | Cancelled item on a settled invoice | Not listed |
| B7 | Pay off a part-paid invoice, reload | Reports appear without a new QR |
| B8 | Commission fields | Absent from every public payload |
| B9 | Referrer details | Absent from every public payload |

### Regression — this is the one that bites

| # | Case | Expected |
|---|---|---|
| R1 | **Staff logged in, opens a bad QR link in the same browser** | Receptionist **still logged in**; no `logout()` dispatched |
| R2 | Staff logged in, opens a valid QR link | Their Bearer token is **not** sent to the public endpoint |
| R3 | Existing staff report view/download | Unchanged |
| R4 | Legacy invoice (created before this change) | Token backfilled on fetch; QR prints |
| R5 | Reprint an invoice twice | Same token both times |
| R6 | Rate limiter | >30 public requests in 15 min from one IP → 429; staff traffic unaffected |

### File delivery

| # | Case | Expected |
|---|---|---|
| F1 | PDF report | Opens in the modal |
| F2 | Image report | Opens in the modal |
| F3 | Report >4.5MB | Known Vercel limit — document the failure, do not silently retry |

### UI / i18n / print

| # | Case | Expected |
|---|---|---|
| U1 | Page at 390px, 360px | No horizontal overflow |
| U2 | Language toggle | Whole public page switches EN ↔ BN |
| U3 | QR printed on A4 | Scans with a real phone camera at printed size |
| U4 | Printed invoice | QR present; **no commission** anywhere on the sheet |
| U5 | Scan → phone browser | Lands on the verify form, readable without zooming |

## 5. Verification

1. `npm run build` (client) and `npx tsc --noEmit` (server)
2. Work §4 top to bottom against a local server, then against the deployed pair
3. **A12, B4, R1** are the ones that must pass before merge — they are the
   disclosure and the sign-out bugs
4. Print a real invoice and scan it with a real phone (U3) — this cannot be
   verified in a headless browser
5. Confirm `PUBLIC_REPORT_SECRET` is set on Vercel before deploying the server,
   or every verify call 500s

## 6. Known constraints

- **Vercel caps serverless responses at ~4.5MB** and the file endpoint streams
  through the function, so large reports fail for patients exactly as they do for
  staff today. Out of scope; the real fix is signed direct-to-Cloudinary delivery.
- **`JWT_ACCESS_SECRET` is still 6 characters.** Unrelated to this feature but
  now sharing a production surface with a public route. Worth rotating alongside
  adding `PUBLIC_REPORT_SECRET`, which should be 32+ random bytes.
