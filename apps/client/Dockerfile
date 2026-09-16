# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ─── Prune workspace to client-only files ─────────────────────────────────────
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune @repo/client --docker

# ─── Install dependencies (cached unless lockfile / package.json changes) ─────
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

# VITE_API_BASE_URL is baked into the bundle at build time
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm dlx turbo run build --filter=@repo/client

# ─── Production image (nginx) ─────────────────────────────────────────────────
FROM nginx:stable-alpine AS runner

COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
COPY --from=pruner /app/out/full/apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
