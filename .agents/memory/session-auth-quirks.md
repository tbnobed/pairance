---
name: Session Auth Quirks
description: Known issues and fixes for express-session + connect-pg-simple in this project
---

## connect-pg-simple table.sql missing after esbuild bundle

**Rule:** The session table (`user_sessions`) must be created manually before the API server starts — never rely on `createTableIfMissing: true` because esbuild bundles the package and excludes `table.sql`, causing a runtime ENOENT error.

**Why:** connect-pg-simple reads its bundled `table.sql` to bootstrap the schema. esbuild strips non-JS assets from the bundle, so the file is never present in `dist/`.

**How to apply:** After any fresh DB reset or new environment, run:
```sql
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
```
Keep `createTableIfMissing: false` in app.ts.

## credentials: "include" required for session cookies

**Rule:** The custom-fetch in `lib/api-client-react/src/custom-fetch.ts` must pass `credentials: "include"` as default so the browser sends session cookies.

**Why:** Frontend (Vite, port 18541) and API server (port 8080) are on different origins in Replit. Without `credentials: "include"`, the browser never sends the session cookie.

**How to apply:** Vite proxy (`/api → localhost:8080`) must also be set in `vite.config.ts` so cookies are scoped to the same origin as the page.

## retry: false on useGetMe for public pages

**Rule:** Any page that calls `useGetMe` while the user may be unauthenticated must pass `{ query: { retry: false } }`. Applies to login, register, and home pages.

**Why:** React Query retries failed queries 3× with exponential backoff. A 401 on `/api/auth/me` keeps `isLoading` true for ~30 seconds, causing a blank screen when the page does `if (isLoading) return null`.
