# Phase 1 — Pre-Migration Audit Report

**Date:** 2026-09-16  
**Project:** new_lab (ByteSpate Diagnostic)  
**Apps audited:** `server` (Express + TypeScript) · `client` (React 19 + Vite + TypeScript)

---

## 1. Dependency Inventory

### 1.1 Server Production Dependencies

| Package | Version | Category |
|---------|---------|----------|
| `express` | ^4.21.1 | HTTP framework |
| `mongoose` | ^8.8.3 | MongoDB ODM |
| `zod` | ^3.23.8 | Schema validation |
| `jsonwebtoken` | ^9.0.2 | JWT auth |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `cloudinary` | ^2.11.0 | File/image storage |
| `multer` | ^2.3.0 | File upload |
| `cookie-parser` | ^1.4.7 | Cookie middleware |
| `cors` | ^2.8.5 | CORS middleware |
| `dotenv` | ^16.4.7 | Env vars |
| `helmet` | ^8.3.0 | Security headers |
| `express-rate-limit` | ^8.7.0 | Rate limiting |
| `express-mongo-sanitize` | ^2.2.0 | NoSQL injection guard |
| `http-status` | ^2.0.0 | HTTP status codes |

### 1.2 Server Dev Dependencies

| Package | Version | Category |
|---------|---------|----------|
| `typescript` | ^5.7.2 | Language |
| `ts-node-dev` | ^2.0.0 | Dev runner |
| `eslint` | ^9.16.0 | Linting |
| `typescript-eslint` | ^8.17.0 | TS lint rules |
| `@eslint/js` | ^9.16.0 | ESLint JS rules |
| `mongodb-memory-server` | ^11.2.0 | In-memory Mongo for tests |
| `nodemon` | ^3.1.7 | File watcher |
| `@types/*` | various | Type definitions |

### 1.3 Client Production Dependencies

| Package | Version | Category |
|---------|---------|----------|
| `react` | ^19.2.0 | UI framework |
| `react-dom` | ^19.2.0 | DOM renderer |
| `react-router-dom` | ^7.10.0 | Routing |
| `@reduxjs/toolkit` | ^2.11.0 | State management |
| `react-redux` | ^9.2.0 | React-Redux bindings |
| `@headlessui/react` | ^2.2.9 | Accessible UI primitives |
| `lucide-react` | ^0.556.0 | Icon library |
| `sonner` | ^2.0.7 | Toast notifications |
| `dayjs` | ^1.11.19 | Date formatting |
| `jspdf` | ^4.2.1 | PDF generation |
| `jspdf-autotable` | ^5.0.8 | PDF table plugin |
| `qrcode.react` | ^4.2.0 | QR code rendering |
| `react-to-print` | ^3.2.0 | Print support |
| `xlsx` | 0.20.3 | Excel export |

### 1.4 Client Dev Dependencies

| Package | Version | Category |
|---------|---------|----------|
| `typescript` | ~5.9.3 | Language |
| `vite` | ^7.2.4 | Build tool |
| `@vitejs/plugin-react` | ^5.1.1 | Vite React plugin |
| `tailwindcss` | ^4.1.17 | Utility CSS |
| `postcss` | ^8.5.6 | CSS processing |
| `eslint` | ^9.39.1 | Linting |
| `typescript-eslint` | ^8.46.4 | TS lint rules |
| `@eslint/js` | ^9.39.1 | ESLint JS rules |
| `eslint-plugin-react-hooks` | ^7.0.1 | React hooks rules |
| `eslint-plugin-react-refresh` | ^0.4.24 | Fast refresh rules |
| `globals` | ^16.5.0 | Global vars for ESLint |
| `@types/node` | ^24.10.1 | Node types |
| `@types/react` | ^19.2.5 | React types |
| `@types/react-dom` | ^19.2.3 | React DOM types |

---

## 2. Overlapping / Hoistable Dependencies

The following packages appear in both apps and are candidates for hoisting to the
workspace root (installed once, shared):

| Package | Server Version | Client Version | Action |
|---------|---------------|---------------|--------|
| `typescript` | ^5.7.2 | ~5.9.3 | Hoist to root — align to `^5.9` |
| `eslint` | ^9.16.0 | ^9.39.1 | Hoist to root — align to `^9.39` |
| `typescript-eslint` | ^8.17.0 | ^8.46.4 | Hoist to root — align to `^8.46` |
| `@eslint/js` | ^9.16.0 | ^9.39.1 | Hoist to root — align to `^9.39` |
| `@types/node` | ^22.10.1 | ^24.10.1 | Keep per-app (different runtime targets) |

**Note on TypeScript version skew:** server is on 5.7, client on 5.9. Aligning both to
5.9 before migration avoids TypeScript version mismatch errors inside shared packages.

---

## 3. Shared Code Candidates

The following code is duplicated across apps and should be extracted into `packages/`:

### 3.1 → `packages/shared-types` (`@repo/shared-types`)

**File:** `client/src/services/types.ts`  
These types describe the API contract and must match the server's response shape exactly.
Moving them to a shared package makes both sides consume the same definition.

| Type / Export | Current location | Used in |
|--------------|-----------------|---------|
| `ApiResponse<T>` | `client/src/services/types.ts` | All RTK Query endpoints |
| `PaginationMeta` | `client/src/services/types.ts` | All list endpoints |
| `Paginated<T>` | `client/src/services/types.ts` | All list endpoints |
| `ListQuery` | `client/src/services/types.ts` | All list endpoints |
| `DateRangeQuery` | `client/src/services/types.ts` | Dashboard, reports |
| `toPaginated<T>()` | `client/src/services/types.ts` | RTK Query `transformResponse` |
| `cleanParams()` | `client/src/services/types.ts` | RTK Query `params` |

**Server mirror:** The server's response envelope in `sendResponse.ts` and module
interfaces implicitly match `ApiResponse<T>` — extracting this type provides a
single source of truth for both sides.

### 3.2 → `packages/shared-types` — Timezone constant

| Export | Current location | Used in |
|--------|-----------------|---------|
| `CENTRE_TIMEZONE = 'Asia/Dhaka'` | `server/src/app/utils/dateRange.ts` | Server date grouping |

The client uses Dhaka-aware date inputs (`toDhakaDateInput` in `format.ts`).
The timezone string should be a shared constant so both sides stay in sync.

### 3.3 → `packages/utils` (`@repo/utils`) — Date utilities

| Export | Server file | Client file | Notes |
|--------|------------|------------|-------|
| `parseDhakaDate()` | `server/utils/dateRange.ts` | indirectly via `format.ts` | Pure function — no deps |
| `dhakaDateParts()` | `server/utils/dateRange.ts` | `format.ts:toDhakaDateInput` | Same logic, different names |
| `startOfDhakaDay()` | `server/utils/dateRange.ts` | — | Server-only (MongoDB query) |
| `endOfDhakaDay()` | `server/utils/dateRange.ts` | — | Server-only (MongoDB query) |
| `rangeForDays()` | — | `client/src/lib/dateRange.ts` | Client-only (UI date picker) |

**Decision:** Extract only `CENTRE_TIMEZONE`, `parseDhakaDate`, and `dhakaDateParts` into
`@repo/utils`. Keep Mongoose-specific helpers (`dateRangeFilter`, `groupByExpression`)
in `apps/server`. Keep UI-only helpers (`rangeForDays`) in `apps/client`.

---

## 4. Environment Variable Audit

### 4.1 Server Variables (from `.env.example`)

| Variable | Category | Shared? |
|---------|---------|---------|
| `NODE_ENV` | Runtime | No — per-app |
| `PORT` | Runtime | No — server only (5000) |
| `DB_URL` | Database | No — server only |
| `BCRYPT_SALT_ROUNDS` | Auth | No — server only |
| `JWT_ACCESS_SECRET` | Auth | No — server only |
| `JWT_ACCESS_EXPIRES_IN` | Auth | No — server only |
| `JWT_REFRESH_SECRET` | Auth | No — server only |
| `JWT_REFRESH_EXPIRES_IN` | Auth | No — server only |
| `CLOUDINARY_CLOUD_NAME` | Storage | No — server only |
| `CLOUDINARY_API_KEY` | Storage | No — server only |
| `CLOUDINARY_API_SECRET` | Storage | No — server only |
| `ADMIN_EMAIL` | Seeding | No — server only |
| `ADMIN_PASSWORD` | Seeding | No — server only |
| `ADMIN_NAME` | Seeding | No — server only |
| `ADMIN_MOBILE_NUMBER` | Seeding | No — server only |
| `CLIENT_URL` | CORS | **Shared** — server reads this; client IS this |

### 4.2 Client Variables (inferred from `apiBase.ts`)

| Variable | Category | Shared? |
|---------|---------|---------|
| `VITE_API_BASE_URL` | API URL | **Shared** — client reads the server's URL |

### 4.3 Shared / Inter-App Variables

| Variable | Server | Client | Root `.env.example` value |
|---------|--------|--------|--------------------------|
| `CLIENT_URL` | `CLIENT_URL=http://localhost:5173` | — | `http://localhost:5173` |
| `VITE_API_BASE_URL` | — | `VITE_API_BASE_URL=http://localhost:5000/api/v1` | `http://localhost:5000/api/v1` |

These two variables are the only cross-app coupling at the env level. In Docker Compose
they become service-to-service names (e.g. `http://server:5000/api/v1`).

---

## 5. API Contract Map

### 5.1 Base URL
- Local dev: `http://localhost:5000/api/v1`
- Production: `https://api.newlabdiagnostic.com/api/v1`
- Client reads from: `VITE_API_BASE_URL` → `client/src/lib/apiBase.ts`

### 5.2 Endpoint Groups

| Prefix | Module | Auth required |
|--------|--------|--------------|
| `/api/v1/auth` | Auth | Public (login/logout) |
| `/api/v1/users` | User | Admin |
| `/api/v1/patients` | Patient | Staff+ |
| `/api/v1/invoices` | Invoice | Staff+ |
| `/api/v1/payments` | Payment | Staff+ |
| `/api/v1/tests` | Test catalogue | Admin |
| `/api/v1/test-categories` | TestCategory | Admin |
| `/api/v1/referrers` | Referrer | Staff+ |
| `/api/v1/commission-payouts` | CommissionPayout | Admin |
| `/api/v1/dashboard` | Dashboard stats | Staff+ |
| `/api/v1/reports` | Reports | Admin |
| `/api/v1/activity-logs` | ActivityLog | Admin |
| `/api/v1/public-reports/:token` | PublicReport | **Public** (token-gated) |

### 5.3 CORS Configuration
- Server reads `CLIENT_URL` from env for CORS origin
- In monorepo: both apps run locally; Compose proxies client → server removing CORS entirely

---

## 6. Existing Test Audit

### 6.1 Server
- **No Jest/Vitest tests exist**
- Has verify scripts: `verify-money.js`, `verify-e2e.js`, `verify-routes.js`, `verify-cloudinary.js`
- These are build-time smoke tests, not unit/integration tests
- `mongodb-memory-server` is already installed — ready for Jest integration tests
- **Gap:** 0% test coverage; all module logic (services, validation, utils) untested

### 6.2 Client
- **No Jest/Vitest tests exist**
- No test setup files, no test imports found
- **Gap:** 0% test coverage; components, hooks, and services untested

### 6.3 Recommendation for Phase 5
Start with the highest-value targets:
1. `@repo/utils` and `@repo/shared-types` — pure functions, easiest to test to 100%
2. `server/src/app/utils/money.ts` — financial logic, must be deterministic
3. `server/src/app/utils/dateRange.ts` — timezone logic, subtle bug surface
4. `client` RTK Query services — mock API, verify query/mutation shapes

---

## 7. Migration Readiness Summary

| Area | Status | Notes |
|------|--------|-------|
| Dependencies | Ready | Version skew on TS/ESLint — align before Phase 3 |
| Shared types | Ready | `client/src/services/types.ts` is the primary candidate |
| Shared utils | Partial | Only pure date helpers are safe to share |
| Env vars | Ready | Only 2 cross-app vars; straightforward |
| API coupling | Ready | Single base URL env var; no deep coupling |
| Tests | Not started | 0% coverage in both apps; Phase 5 addresses this |
| Docker | Not started | No Dockerfile in either app |
| CI/CD | Not started | No `.github/workflows` directory |

**Overall: Green — safe to proceed to Phase 2 scaffold.**
