# New Lab Diagnostic & Consultation Centre

Diagnostic Centre Billing & Management System built as a **Turborepo + pnpm monorepo**. Patient registration, test booking, cash billing with partial payments, referrer discount and commission tracking, diagnostic report handling, and an admin-only financial module.

## Monorepo structure

```
apps/
  server/   Express + Mongoose + Zod + JWT          (port 5000)
  client/   React 19 + Vite + TypeScript + Tailwind (port 5173)
packages/
  utils/          Shared date/money utilities
  eslint-config/  Shared ESLint flat config
  tsconfig/       Shared TypeScript configs
```

## Running locally

```bash
# Install all dependencies
pnpm install

# Run both apps in parallel
pnpm dev

# Or run individually
pnpm --filter @repo/server dev   # http://localhost:5000
pnpm --filter @repo/client dev   # http://localhost:5173
```

The server seeds an admin account on first boot from the `ADMIN_*` values in
`apps/server/.env`. Sign in with those credentials, then create receptionist
accounts under **Users**.

## Roles

| | Admin | Receptionist |
|---|---|---|
| Patients, bookings, payments, reports upload | ✔ | ✔ |
| Test catalogue, departments, referrers | manage | read-only |
| Patient report | ✔ | ✔ |
| Financial summary, revenue, commission, dues | ✔ | ✘ |
| Commission payouts, user management | ✔ | ✘ |
| User activity log | ✔ | ✘ |

Restriction is enforced by the API, not the UI. Route guards gate whole
endpoints, and a receptionist gets no aggregate revenue, discount or commission
figures anywhere.

## How the money works

`apps/server/src/app/modules/Invoice/invoice.totals.ts` is the single place invoice
money is derived:

```
gross      = sum of test prices              (read from the Test catalogue)
discount   = gross x discountPercent         <- comes off the PATIENT's bill
net        = gross - discount                <- what the patient pays
due        = net - paid                      (paid comes from the Payment ledger)
```

**Discount and commission are separate arrangements and move money in opposite
directions.** The discount is what the patient saves. The commission is what
the centre pays the referring doctor; it never touches the patient's bill.

Worked example — a ৳2,000 bill with a 25% discount:

```
Gross            2,000
Discount 25%      -500
──────────────────────
Patient pays     1,500

Commission       ৳300  either 20% of 1,500, or a flat 300 — the centre's call
Centre keeps     1,200
```

Invoice numbers read **`NLDC-MM-DD-YY-NNN`** (e.g. `NLDC-08-30-26-001`).

## Testing

```bash
pnpm test                    # all packages
pnpm --filter @repo/server test
pnpm --filter @repo/client test
```

## Building

```bash
pnpm build                   # all apps and packages via Turborepo
```

## Docker

```bash
# Full stack (server + client + MongoDB)
docker compose up

# Production
docker compose -f docker-compose.prod.yml up
```

## CI / CD

- **CI** (`.github/workflows/ci.yml`): type-check → lint → test:coverage → SonarQube on every push and PR
- **CD** (`.github/workflows/deploy.yml`): PRs deploy a Vercel preview of `server` and `client`; pushes to `main` deploy to production.
  - Create two Vercel projects (Root Directory `apps/server` and `apps/client`) and set app env vars in each.
  - GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_SERVER_PROJECT_ID`, `VERCEL_CLIENT_PROJECT_ID`.
  - Disable Vercel's own Git auto-deploy for both projects so builds aren't duplicated.
