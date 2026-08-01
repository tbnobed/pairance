# CouplesBudget

A shared budgeting app for couples to track spending together. Features GPS-triggered spending prompts, shared category management, monthly budget limits, and a joint dashboard for both partners.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/budget-tracker run dev` — run the frontend (dev, port 18541)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — random secret for session signing

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, Wouter, Recharts
- API: Express 5
- Auth: Local email/password with bcrypt + express-session (PostgreSQL session store)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v3), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions (users, households, categories, transactions, budgets, location_visits)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, transactions, categories, budgets, locations, dashboard)
- `artifacts/budget-tracker/src/` — React frontend (pages: home, login, register, dashboard, transactions, categories, budgets, settings)

## Architecture decisions

- **Local auth only**: bcrypt password hashing + express-session with PostgreSQL session store. No third-party auth services.
- **Household model**: Each user belongs to a household. Partners share a household_id which scopes all their data together.
- **GPS prompting**: Browser Geolocation API triggers a check-in endpoint that uses Haversine distance to detect if the user is at a new location and suggests logging spending. Suppresses re-prompts within 4 hours at the same spot.
- **Cookie-based sessions**: Credentials travel as HttpOnly session cookies — no token handling in the frontend.
- **Docker deployment**: `Dockerfile` + `docker-compose.yml` at project root for self-hosting.

## Docker Deployment

```bash
# Copy and configure .env
cp .env.example .env  # set POSTGRES_PASSWORD and SESSION_SECRET

# Build and start
docker compose up -d
```

App runs on port 8080. Set `SESSION_SECRET` to a long random string in production.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any `lib/db/src/schema/` change, run `pnpm run typecheck:libs` before typechecking server routes — stale declarations cause false import errors.
- OpenAPI spec must use `type: number` (not `type: integer`) — Orval 8.23+ generates `zod.int()` for `integer` types which is Zod v4 only; the workspace uses Zod v3.
- `useGetMe` on unauthenticated pages must use `retry: false` — default 3 retries + backoff causes ~30s blank screen while React Query retries the 401.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
