# Monorepo Migration Plan

**Project:** new_lab  
**Package Manager:** pnpm  
**Stack:** Turborepo · pnpm Workspaces · Jest · SonarQube · Docker · GitHub Actions CI/CD  

**Current Structure:** Modular monolithic — `server` (Express) + `client` (React)  
**Target Structure:** Turborepo monorepo with shared packages, full test coverage, containerization, and automated pipelines

---

## Table of Contents

1. [Pre-Migration Audit](#phase-1--pre-migration-audit)
2. [Turborepo Monorepo Scaffold](#phase-2--turborepo-monorepo-scaffold)
3. [Move & Refactor Apps](#phase-3--move--refactor-apps)
4. [Shared Packages Extraction](#phase-4--shared-packages-extraction)
5. [Jest Test Setup](#phase-5--jest-test-setup)
6. [Docker Setup](#phase-6--docker-setup)
7. [SonarQube Integration](#phase-7--sonarqube-integration)
8. [GitHub Actions CI/CD](#phase-8--github-actions-cicd)
9. [Developer Experience Polish](#phase-9--developer-experience-polish)
10. [Migration Execution Order](#migration-execution-order)
11. [File Structure Reference](#file-structure-reference)

---

## Phase 1 — Pre-Migration Audit

### 1.1 Dependency Inventory
- Open `server/package.json` — list all `dependencies` and `devDependencies`
- Open `client/package.json` — list all `dependencies` and `devDependencies`
- Highlight overlapping packages (e.g. `zod`, `axios`, `lodash`, `typescript`, `eslint`)
- These overlapping packages become candidates for hoisting to the root or moving to a shared package

### 1.2 Shared Code Identification
- Scan for TypeScript interfaces and types defined in `server/` that are also used or duplicated in `client/`
- Scan for validation schemas (e.g. Zod) used in both apps — these become `@repo/validators`
- Scan for utility/helper functions duplicated across both apps — these become `@repo/utils`
- Scan for any constants or enums duplicated — these become `@repo/constants`
- Document every identified shared artifact before moving anything

### 1.3 Environment Variable Audit
- List every variable in `server/.env` / `server/.env.example`
- List every variable in `client/.env` / `client/.env.example`
- Categorize: server-only, client-only, shared (e.g. API URL)
- This list feeds directly into Phase 6 (Docker env config) and Phase 8 (CI secrets)

### 1.4 API Contract Map
- Document every API endpoint exposed by `server`
- Note how `client` calls them — base URL, proxy config, CORS settings
- This ensures nothing breaks when both apps live inside the same monorepo

### 1.5 Existing Test Audit
- Identify any existing test files in `server/` and `client/`
- Note the test framework currently used (if any)
- Note coverage gaps — these are addressed in Phase 5

---

## Phase 2 — Turborepo Monorepo Scaffold

### 2.1 Install pnpm Globally
- Install pnpm: `npm install -g pnpm`
- Verify: `pnpm --version` (target: v9+)
- pnpm is chosen for: workspace hoisting, strict lockfile, disk-efficient node_modules, native Turborepo support

### 2.2 Root `package.json`
- Create root `package.json` with:
  - `"private": true` — prevents accidental publish of the root
  - `"packageManager": "pnpm@9.x.x"` — enforces consistent pnpm version
  - `"workspaces": ["apps/*", "packages/*"]` — declares workspace members
  - Root-level scripts: `dev`, `build`, `test`, `lint`, `type-check`

### 2.3 pnpm Workspace Config
- Create `pnpm-workspace.yaml` at root:
  ```yaml
  packages:
    - "apps/*"
    - "packages/*"
  ```
- This is pnpm's native workspace declaration — required alongside `package.json` workspaces

### 2.4 `turbo.json` Pipeline
- Create `turbo.json` at root defining the task pipeline:

  | Task | Depends On | Cache | Output |
  |------|-----------|-------|--------|
  | `build` | `^build` (upstream packages first) | Yes | `dist/**` |
  | `dev` | none | No | none |
  | `test` | `^build` | Yes | `coverage/**` |
  | `lint` | none | Yes | none |
  | `type-check` | `^build` | Yes | none |

- `^build` means: build all workspace dependencies before building this package
- Caching on `test` means: if source hasn't changed, skip re-running tests

### 2.5 Root TypeScript Config
- Create `tsconfig.base.json` at root with shared compiler options:
  - `"strict": true`
  - `"moduleResolution": "bundler"`
  - `"target": "ES2022"`
  - `"lib": ["ES2022"]`
- Each app and package extends this with `"extends": "../../tsconfig.base.json"`

### 2.6 Root ESLint / Biome Config
- Create a shared lint config in `packages/eslint-config/`
- All apps import and extend it — ensures consistent rules across the monorepo
- Alternatively use Biome for unified format + lint in one tool

### 2.7 `.gitignore` at Root
- Add: `node_modules`, `.turbo`, `dist`, `coverage`, `.env*.local`, `*.sonarwork`

---

## Phase 3 — Move & Refactor Apps

### 3.1 Create Directory Structure
- Create `apps/` and `packages/` directories at the repo root
- Move `server/` → `apps/server/`
- Move `client/` → `apps/client/`
- Do NOT delete the originals until the moved versions run successfully

### 3.2 Update `apps/server/package.json`
- Set `"name": "@repo/server"`
- Add `"private": true`
- Remove any packages that will be hoisted to root or moved to shared packages
- Update the `tsconfig.json` to extend `../../tsconfig.base.json`

### 3.3 Update `apps/client/package.json`
- Set `"name": "@repo/client"`
- Add `"private": true`
- Remove packages moving to shared
- Update `tsconfig.json` to extend `../../tsconfig.base.json`
- Update any API base URL references to use environment variables

### 3.4 Run pnpm Install from Root
- From the repo root run `pnpm install`
- pnpm resolves all workspace packages and hoists shared deps
- Verify `node_modules/.pnpm/` is populated at root
- Verify symlinks exist under `apps/server/node_modules/@repo/*`

### 3.5 Verify Local Dev Still Works
- Run `pnpm --filter @repo/server dev` — verify Express server starts
- Run `pnpm --filter @repo/client dev` — verify React app starts
- Fix any broken imports before proceeding

---

## Phase 4 — Shared Packages Extraction

### 4.1 `packages/shared-types`
- **Name:** `@repo/shared-types`
- **Contents:** All TypeScript interfaces and types shared between client and server
  - API request/response types
  - Domain entity types (User, Product, Order, etc.)
  - Enum definitions
- **Build:** `tsc` only, outputs to `dist/`
- **Consumers:** `@repo/server`, `@repo/client`

### 4.2 `packages/validators`
- **Name:** `@repo/validators`
- **Contents:** Zod schemas (or equivalent) that validate both API payloads and form inputs
- **Why shared:** Server validates incoming requests; client validates form input — same schema, single source of truth
- **Consumers:** `@repo/server`, `@repo/client`

### 4.3 `packages/utils`
- **Name:** `@repo/utils`
- **Contents:** Pure utility functions with no app-specific dependencies
  - Date formatting
  - String helpers
  - Number formatting
  - Error parsing utilities
- **No side effects** — these are pure functions only

### 4.4 `packages/constants`
- **Name:** `@repo/constants`
- **Contents:** Shared constants and configuration values
  - HTTP status codes
  - Route path constants
  - Pagination defaults
  - Feature flags (static)

### 4.5 `packages/eslint-config`
- **Name:** `@repo/eslint-config`
- **Contents:** Shared ESLint rules extending recommended configs
- All apps import this to stay in sync on code style

### 4.6 `packages/tsconfig`
- **Name:** `@repo/tsconfig`
- **Contents:** Base TypeScript configs (base, react, node)
- All apps extend from here

### 4.7 Wiring Internal Imports
- In `apps/server/package.json` add: `"@repo/shared-types": "workspace:*"`
- In `apps/client/package.json` add: `"@repo/shared-types": "workspace:*"`, `"@repo/validators": "workspace:*"`
- Replace all duplicated type/util imports with `@repo/` workspace imports
- Run `pnpm install` again to resolve the new workspace links

---

## Phase 5 — Jest Test Setup

### 5.1 Root Jest Config Strategy
- Use a root `jest.config.ts` with `projects` pointing to each app/package
- Each workspace defines its own `jest.config.ts` that inherits root presets
- This allows `pnpm test` from root to run all tests via Turborepo

### 5.2 `apps/server` Jest Config
- **Transform:** `ts-jest` for TypeScript
- **Test environment:** `node`
- **Coverage:** `lcov` + `json` reporters (required for SonarQube)
- **Coverage thresholds:** 
  - Statements: 80%
  - Branches: 75%
  - Functions: 80%
  - Lines: 80%
- **Coverage output:** `coverage/lcov.info`
- **Test pattern:** `**/*.test.ts`, `**/*.spec.ts`

### 5.3 `apps/client` Jest Config
- **Transform:** `babel-jest` or `ts-jest` with React preset
- **Test environment:** `jsdom`
- **Setup files:** `jest.setup.ts` (imports `@testing-library/jest-dom`)
- **Coverage:** same reporters as server
- **Coverage output:** `coverage/lcov.info`
- **Module name mapper:** maps `@repo/*` paths to their dist outputs

### 5.4 `packages/*` Jest Config
- Each shared package has its own minimal `jest.config.ts`
- Environment: `node`
- These packages should have near 100% coverage since they are pure utilities

### 5.5 Test Folder Conventions
```
apps/server/
  src/
    routes/
      user.routes.ts
      user.routes.test.ts      ← unit test beside the source
    services/
      user.service.ts
      user.service.test.ts
  __tests__/
    integration/               ← integration tests separate from units
      user.api.test.ts

apps/client/
  src/
    components/
      Button/
        Button.tsx
        Button.test.tsx
    hooks/
      useAuth.ts
      useAuth.test.ts
    __tests__/
      e2e/                     ← e2e tests (optional Playwright)
```

### 5.6 Coverage Report Merge (Optional)
- For a single monorepo coverage report, use `jest-junit` or `nyc` to merge
- Coverage artifacts are uploaded to SonarQube per-app in CI

---

## Phase 6 — Docker Setup

### 6.1 Docker Strategy
- Use **multi-stage builds** to keep production images small
- Use `turbo prune` to create minimal Docker build contexts per app
- Separate Dockerfile per app — `apps/server/Dockerfile`, `apps/client/Dockerfile`
- Root `docker-compose.yml` for local development
- Root `docker-compose.prod.yml` for production overrides

### 6.2 `apps/server/Dockerfile` — Multi-Stage Build
**Stage 1 — base:** `node:22-alpine`, set working dir, install pnpm  
**Stage 2 — deps:** Copy `pnpm-lock.yaml` + `pnpm-workspace.yaml`, run `pnpm install --frozen-lockfile`  
**Stage 3 — build:** Copy source, run `turbo run build --filter=@repo/server`  
**Stage 4 — production:** Copy only the built output + production deps, set `NODE_ENV=production`, expose port, set entrypoint

### 6.3 `apps/client/Dockerfile` — Multi-Stage Build
**Stage 1 — base:** `node:22-alpine`, set working dir, install pnpm  
**Stage 2 — deps:** Install all dependencies  
**Stage 3 — build:** Run `turbo run build --filter=@repo/client`  
**Stage 4 — production:** Use `nginx:alpine`, copy built static files from Stage 3 into nginx html dir, copy custom `nginx.conf`

### 6.4 `turbo prune` Pattern (Recommended for Docker)
- Before copying source in each Dockerfile, run:  
  `RUN npx turbo prune --scope=@repo/server --docker`
- This outputs a pruned monorepo with only the files needed for that specific app
- Dramatically reduces Docker build context size and improves layer caching

### 6.5 `.dockerignore` (Root + Per-App)
Exclude from all Docker contexts:
- `node_modules`
- `.turbo`
- `dist`
- `coverage`
- `.env.local`, `.env.*.local`
- `.git`
- `*.md`

### 6.6 `docker-compose.yml` — Local Development
Services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `server` | builds from `apps/server/Dockerfile` | 5000:5000 | Express API |
| `client` | builds from `apps/client/Dockerfile` | 3000:80 | React (nginx) |
| `db` | `postgres:16-alpine` | 5432:5432 | Primary database |
| `redis` | `redis:7-alpine` | 6379:6379 | Cache / sessions |
| `sonarqube` | `sonarqube:lts-community` | 9000:9000 | Code quality |
| `sonardb` | `postgres:16-alpine` | (internal) | SonarQube DB |

- All services share a `app-network` bridge network
- `db` and `sonardb` use named volumes for data persistence
- `server` and `client` depend on `db` with health checks
- Env vars loaded from `.env` at root via `env_file`

### 6.7 Environment Variable Files
```
root/
  .env               ← local dev secrets (gitignored)
  .env.example       ← committed template with placeholder values
  apps/server/.env   ← server-only overrides (gitignored)
  apps/client/.env   ← client-only overrides (gitignored)
```

### 6.8 `nginx.conf` for Client
- Serve static files from `/usr/share/nginx/html`
- All routes fallback to `index.html` (handles React Router)
- Gzip compression enabled
- Cache headers for static assets (`/static/` → 1 year immutable)
- Proxy `/api/` requests to `server:5000` (eliminates CORS in production)

---

## Phase 7 — SonarQube Integration

### 7.1 SonarQube Server Setup
- Runs as a Docker Compose service (`sonarqube:lts-community`)
- Backed by its own PostgreSQL instance (`sonardb`)
- Accessible at `http://localhost:9000` in local dev
- Default credentials: `admin` / `admin` → **change immediately on first login**
- Create two projects in SonarQube UI: `new_lab-server` and `new_lab-client`
- Generate a token per project — store as GitHub secret (`SONAR_TOKEN_SERVER`, `SONAR_TOKEN_CLIENT`)

### 7.2 `apps/server/sonar-project.properties`
```properties
sonar.projectKey=new_lab-server
sonar.projectName=new_lab Server
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.tsconfigPath=tsconfig.json
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**
```

### 7.3 `apps/client/sonar-project.properties`
```properties
sonar.projectKey=new_lab-client
sonar.projectName=new_lab Client
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.tsx,**/*.test.ts,**/*.spec.tsx
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.tsconfigPath=tsconfig.json
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/*.stories.tsx
```

### 7.4 Quality Gate Definition
Create a custom Quality Gate named `new_lab Gate` in SonarQube with these conditions:

| Metric | Operator | Threshold |
|--------|---------|-----------|
| Coverage on New Code | Less than | 80% |
| Duplicated Lines on New Code | Greater than | 3% |
| Maintainability Rating on New Code | Worse than | A |
| Reliability Rating on New Code | Worse than | A |
| Security Rating on New Code | Worse than | A |
| Security Hotspots Reviewed | Less than | 100% |

- Set this gate as default for both projects
- CI pipeline fails if this gate is not passed

### 7.5 Running SonarQube Scan Locally
- Install `sonar-scanner` CLI: `brew install sonar-scanner` (macOS)
- From `apps/server/`: `sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.login=<token>`
- From `apps/client/`: same command
- Requires test coverage to be generated first: `pnpm --filter @repo/server test -- --coverage`

---

## Phase 8 — GitHub Actions CI/CD

### 8.1 Workflow File Structure
```
.github/
  workflows/
    ci.yml               ← runs on every push and PR
    cd-preview.yml       ← deploys preview on pull_request
    cd-production.yml    ← deploys to production on push to main
```

### 8.2 Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `SONAR_TOKEN_SERVER` | SonarQube token for server project |
| `SONAR_TOKEN_CLIENT` | SonarQube token for client project |
| `SONAR_HOST_URL` | SonarQube server URL (e.g. https://sonar.yourdomain.com) |
| `DOCKER_REGISTRY` | Container registry (GHCR or Docker Hub) |
| `DOCKER_USERNAME` | Registry username |
| `DOCKER_PASSWORD` | Registry password or token |
| `PRODUCTION_HOST` | Production server IP/hostname |
| `PRODUCTION_SSH_KEY` | SSH private key for production deploy |
| `TURBO_TOKEN` | Vercel Remote Cache token for Turborepo |
| `TURBO_TEAM` | Vercel team slug for remote cache |

### 8.3 `ci.yml` — Continuous Integration

**Trigger:** `push` to any branch + `pull_request` to `main` or `develop`

**Steps in order:**

1. **Checkout** — `actions/checkout@v4` with `fetch-depth: 0` (SonarQube needs full history)
2. **Setup pnpm** — `pnpm/action-setup@v4` with version pinned
3. **Setup Node.js** — `actions/setup-node@v4` with `cache: 'pnpm'`
4. **Restore Turborepo Cache** — `actions/cache@v4` keyed on `turbo` + OS + lockfile hash
5. **Install dependencies** — `pnpm install --frozen-lockfile`
6. **Type Check** — `pnpm turbo run type-check` (parallel across all workspaces)
7. **Lint** — `pnpm turbo run lint` (parallel across all workspaces)
8. **Run Tests with Coverage** — `pnpm turbo run test -- --coverage --ci`
9. **Upload Coverage Artifacts** — `actions/upload-artifact@v4` for `apps/*/coverage/lcov.info`
10. **SonarQube Scan — Server** — `sonarsource/sonarqube-scan-action` pointed at `apps/server/`
11. **SonarQube Scan — Client** — `sonarsource/sonarqube-scan-action` pointed at `apps/client/`
12. **SonarQube Quality Gate Check** — `sonarsource/sonarqube-quality-gate-action` — fails CI if gate fails
13. **Build** — `pnpm turbo run build` — verifies production build succeeds

**Turborepo Remote Cache in CI:**
- Set env vars `TURBO_TOKEN` and `TURBO_TEAM` from secrets
- Unchanged workspaces are skipped automatically
- Typical CI time reduction: 40–70% after first warm run

### 8.4 `cd-preview.yml` — Preview Deployment

**Trigger:** `pull_request` opened, synchronized, or reopened against `main`

**Steps in order:**

1. Checkout + setup pnpm + install
2. Run `pnpm turbo run build` (uses remote cache from CI run)
3. **Log in to container registry** (GHCR)
4. **Build Docker image — server** — tagged `ghcr.io/org/new_lab-server:pr-${{ github.event.number }}`
5. **Build Docker image — client** — tagged `ghcr.io/org/new_lab-client:pr-${{ github.event.number }}`
6. **Push both images** to registry
7. **Deploy to preview environment** — SSH into staging server, pull new images, run `docker compose up -d`
8. **Comment on PR** with preview URL using `actions/github-script`

### 8.5 `cd-production.yml` — Production Deployment

**Trigger:** `push` to `main` (after PR merge)

**Steps in order:**

1. Checkout + setup pnpm + install
2. **Run full CI pipeline** (reuse job from `ci.yml` via `needs:` or inline)
3. **Build Docker image — server** — tagged with git SHA + `latest`
   - `ghcr.io/org/new_lab-server:${{ github.sha }}`
   - `ghcr.io/org/new_lab-server:latest`
4. **Build Docker image — client** — same tagging pattern
5. **Push all tags** to registry
6. **SSH to production server:**
   - Pull new images: `docker compose pull`
   - Roll out with zero downtime: `docker compose up -d --no-deps server client`
   - Wait for health checks to pass
7. **Smoke test** — `curl https://api.yourdomain.com/health` — fail if non-200
8. **Notify on failure** — optional Slack/email notification on deployment failure

### 8.6 Branch Strategy

| Branch | CI | CD |
|--------|----|----|
| `main` | Full CI + Sonar | Deploy to production |
| `develop` | Full CI + Sonar | Deploy to staging |
| `feature/*` | Lint + Type-check + Test | Deploy preview |
| `fix/*` | Lint + Type-check + Test | Deploy preview |

---

## Phase 9 — Developer Experience Polish

### 9.1 Root `Makefile` (Optional Convenience)
Shorthand commands for common operations:
- `make dev` → `pnpm turbo run dev`
- `make test` → `pnpm turbo run test`
- `make build` → `pnpm turbo run build`
- `make docker-up` → `docker compose up -d`
- `make docker-down` → `docker compose down`
- `make sonar` → run sonar-scanner on both apps

### 9.2 Git Hooks — Husky + lint-staged
- **Pre-commit hook:** Run `lint-staged` — lints and formats only staged files (fast)
- **Commit-msg hook:** Enforce Conventional Commits format: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- Conventional commits enable automatic changelog generation via `standard-version` or `release-please`

### 9.3 VSCode Workspace Config
- `.vscode/settings.json` at root — shared formatter, ESLint auto-fix on save, path aliases
- `.vscode/extensions.json` — recommended extensions:
  - ESLint
  - Prettier
  - TypeScript Hero
  - Docker
  - GitLens
  - Jest Runner

### 9.4 `README.md` Updates
- Document new monorepo structure
- Getting started: prerequisites (Node 22+, pnpm 9+, Docker)
- Local dev setup: `pnpm install` → `pnpm dev`
- Running tests: `pnpm test`
- Running with Docker: `docker compose up`

### 9.5 Turborepo Remote Cache
- Sign up for Vercel Remote Cache (free for individuals)
- Set `TURBO_TOKEN` and `TURBO_TEAM` locally via `.env` or `turbo login`
- Developers share a cache — first person to build primes it for everyone
- CI also shares this cache pool

---

## Migration Execution Order

Execute phases in this sequence to minimize risk. Each phase should be fully verified before proceeding.

| # | Phase | Duration Estimate | Risk Level | Rollback Plan |
|---|-------|------------------|------------|---------------|
| 1 | Pre-migration audit (Phase 1) | 0.5 day | None | N/A |
| 2 | Scaffold monorepo structure (Phase 2) | 0.5 day | Low | Delete scaffold, nothing moved yet |
| 3 | Move apps into `apps/` (Phase 3.1–3.3) | 1 day | Low | Keep originals until verified |
| 4 | Verify local dev works post-move (Phase 3.4–3.5) | 0.5 day | Low | Revert file moves |
| 5 | Extract shared packages (Phase 4) | 1–2 days | Medium | Revert to duplicated code temporarily |
| 6 | Wire Turborepo pipelines (Phase 2.4) | 0.5 day | Low | Run apps directly with npm scripts |
| 7 | Jest setup across all workspaces (Phase 5) | 1–2 days | Medium | Tests are additive, no regression risk |
| 8 | Dockerfiles + Compose (Phase 6.1–6.6) | 1 day | Medium | Existing non-docker dev path unchanged |
| 9 | SonarQube server + project setup (Phase 7.1–7.2) | 0.5 day | Low | Sonar is additive, doesn't affect app |
| 10 | Fix all SonarQube issues to pass Quality Gate (Phase 7.4) | 1–3 days | Medium | Gate can be set to warning initially |
| 11 | `ci.yml` — CI pipeline (Phase 8.3) | 0.5 day | Low | CI is additive |
| 12 | `cd-preview.yml` — preview deploys (Phase 8.4) | 0.5 day | Medium | Test on feature branch first |
| 13 | `cd-production.yml` — production deploy (Phase 8.5) | 1 day | High | Keep manual deploy process as fallback |
| 14 | Husky hooks + VSCode config (Phase 9.2–9.3) | 0.25 day | Low | Hooks are opt-in per developer |
| 15 | Turborepo remote cache (Phase 9.5) | 0.25 day | Low | Cache miss just slows CI, never breaks it |

**Total Estimated Duration:** 9–14 days (solo) / 5–8 days (team of 2–3)

---

## File Structure Reference

Target directory layout after full migration:

```
new_lab/                               ← repo root
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd-preview.yml
│       └── cd-production.yml
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── apps/
│   ├── server/                        ← Express API (@repo/server)
│   │   ├── src/
│   │   ├── __tests__/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── jest.config.ts
│   │   ├── sonar-project.properties
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── client/                        ← React App (@repo/client)
│       ├── src/
│       ├── __tests__/
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── nginx.conf
│       ├── jest.config.ts
│       ├── sonar-project.properties
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── shared-types/                  ← @repo/shared-types
│   │   ├── src/
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── validators/                    ← @repo/validators
│   │   ├── src/
│   │   ├── jest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── utils/                         ← @repo/utils
│   │   ├── src/
│   │   ├── jest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── constants/                     ← @repo/constants
│   │   ├── src/
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── eslint-config/                 ← @repo/eslint-config
│   │   └── package.json
│   └── tsconfig/                      ← @repo/tsconfig
│       ├── base.json
│       ├── react.json
│       └── node.json
├── docs/
│   └── MONOREPO_MIGRATION_PLAN.md     ← this file
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
└── README.md
```

---

## Key Decisions Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| Package manager | pnpm | Best Turborepo support, strict lockfile, disk efficient |
| Monorepo tool | Turborepo | Native pnpm support, remote cache, incremental builds |
| Test framework | Jest | Widest ecosystem support, works for both Node and jsdom |
| Containerization | Docker multi-stage + Compose | Lean images, consistent environments |
| Code quality | SonarQube LTS Community | Self-hosted, full TypeScript support, quality gates |
| CI/CD | GitHub Actions | Native to GitHub, generous free tier, matrix builds |
| Base Node image | `node:22-alpine` | LTS, minimal footprint |
| Nginx image | `nginx:alpine` | Minimal footprint for serving React static files |
| Shared package naming | `@repo/*` | Standard Turborepo convention, no npm publish needed |

---

*Document version: 1.0 — Created for new_lab monorepo migration*
