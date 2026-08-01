# Multi-stage Docker build for CouplesBudget
# Stage 1: Build the frontend
FROM node:24-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copy all packages
COPY lib/ lib/
COPY artifacts/budget-tracker/ artifacts/budget-tracker/
COPY artifacts/api-server/ artifacts/api-server/

# Install dependencies (frozen lockfile)
RUN pnpm install --frozen-lockfile

# Run codegen
RUN pnpm --filter @workspace/api-spec run codegen

# Build the frontend
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ARG PORT=3000
ENV PORT=${PORT}
RUN pnpm --filter @workspace/budget-tracker run build

# Stage 2: Build the API server
FROM node:24-alpine AS api-builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-spec run codegen 2>/dev/null || true
RUN pnpm --filter @workspace/api-server run build

# Stage 3: Production runtime
FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built API
COPY --from=api-builder /app/artifacts/api-server/dist ./server/dist
COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=api-builder /app/artifacts/api-server/package.json ./server/

# Copy built frontend static files
COPY --from=frontend-builder /app/artifacts/budget-tracker/dist/public ./server/public

# Copy serve script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

ENTRYPOINT ["./docker-entrypoint.sh"]
