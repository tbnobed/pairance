# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-slim AS build

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace manifests + lib sources (lib packages are consumed from source)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY lib lib
COPY artifacts/api-server artifacts/api-server

RUN pnpm install --frozen-lockfile --filter @workspace/api-server...

RUN pnpm --filter @workspace/api-server run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:24-slim

WORKDIR /app

# bcrypt is externalized from the esbuild bundle (native module) — install it here
RUN npm install bcrypt@6.0.0

COPY --from=build /app/artifacts/api-server/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
