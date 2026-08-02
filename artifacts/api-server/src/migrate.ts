import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Idempotent startup migrations. docker/init.sql only runs on a brand-new
 * Postgres volume, so existing Docker deployments pick up schema additions
 * here instead. Every statement must be safe to re-run.
 */
export async function runStartupMigrations(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE households ADD COLUMN IF NOT EXISTS monthly_plan jsonb
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id serial PRIMARY KEY,
      description text NOT NULL,
      amount numeric(12,2) NOT NULL,
      category_id integer NOT NULL,
      user_id integer NOT NULL,
      household_id integer NOT NULL,
      day_of_month integer NOT NULL DEFAULT 1,
      active boolean NOT NULL DEFAULT true,
      last_posted_month text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}
