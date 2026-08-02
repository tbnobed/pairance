---
name: DB Schema Migrations
description: How to apply schema changes non-interactively in this project
---

## Rule
Use `psql "$DATABASE_URL" << 'SQL' ... SQL` for all schema changes run from ShellExec.

**Why:** `drizzle-kit push` (and `push-force`) both require an interactive TTY and crash with "Interactive prompts require a TTY terminal" in non-interactive shells. The `--force` flag does not bypass the TTY requirement in drizzle-kit 0.31.x.

**How to apply:** Any time a new table or column needs to be added, write it as a `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` block and run it directly via psql. Then let Drizzle's runtime schema (TypeScript) stay as the source of truth for queries.
