# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-slim AS build

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY lib lib
COPY artifacts/budget-tracker artifacts/budget-tracker

RUN pnpm install --frozen-lockfile --filter @workspace/budget-tracker...

# BASE_PATH=/ because in Docker the app is served at the root (no Replit path prefix).
# PORT is required by vite.config.ts even though it's unused for a static build.
ENV BASE_PATH=/
ENV PORT=5000
ENV NODE_ENV=production
RUN pnpm --filter @workspace/budget-tracker run build

# ── Runtime stage: nginx serves static files + proxies /api to the API server ─
FROM nginx:1.27-alpine

COPY --from=build /app/artifacts/budget-tracker/dist/public /usr/share/nginx/html
COPY artifacts/budget-tracker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
