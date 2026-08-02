import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

export const recurringTransactionsTable = pgTable("recurring_transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  categoryId: integer("category_id").notNull(),
  userId: integer("user_id").notNull(),
  householdId: integer("household_id").notNull(),
  /** Day of month the transaction posts (1-28 recommended; clamped to month length) */
  dayOfMonth: integer("day_of_month").notNull().default(1),
  active: boolean("active").notNull().default(true),
  /** "YYYY-MM" of the last month this rule auto-posted, to prevent duplicates */
  lastPostedMonth: text("last_posted_month"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecurringTransaction = typeof recurringTransactionsTable.$inferSelect;
