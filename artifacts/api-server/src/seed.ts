import bcrypt from "bcrypt";
import { db, usersTable, householdsTable, categoriesTable } from "@workspace/db";
import { logger } from "./lib/logger";

/**
 * Seed the first account on a fresh deployment (no public registration page).
 * Runs at startup: only acts when the users table is EMPTY and
 * SEED_EMAIL + SEED_PASSWORD env vars are set. SEED_NAME is optional.
 */
export async function seedInitialAccount(): Promise<void> {
  const email = process.env.SEED_EMAIL?.trim();
  const password = process.env.SEED_PASSWORD;
  const name = process.env.SEED_NAME?.trim() || "Me";

  if (!email || !password) return;

  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing.length > 0) return; // already have users — never overwrite

  if (password.length < 8) {
    logger.warn("SEED_PASSWORD must be at least 8 characters — skipping account seed");
    return;
  }

  const [household] = await db.insert(householdsTable).values({}).returning();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(usersTable).values({ name, email, passwordHash, householdId: household.id });

  await db.insert(categoriesTable).values([
    { name: "Groceries", color: "#22c55e", icon: "🛒", householdId: household.id },
    { name: "Dining Out", color: "#f97316", icon: "🍽️", householdId: household.id },
    { name: "Transport", color: "#3b82f6", icon: "🚗", householdId: household.id },
    { name: "Entertainment", color: "#a855f7", icon: "🎬", householdId: household.id },
    { name: "Shopping", color: "#ec4899", icon: "🛍️", householdId: household.id },
    { name: "Bills & Utilities", color: "#eab308", icon: "💡", householdId: household.id },
    { name: "Health", color: "#14b8a6", icon: "💊", householdId: household.id },
    { name: "Other", color: "#6b7280", icon: "📦", householdId: household.id },
  ]);

  logger.info({ email }, "Seeded initial account");
}
