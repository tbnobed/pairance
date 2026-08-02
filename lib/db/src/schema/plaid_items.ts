import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const plaidItemsTable = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull(),
  itemId: text("item_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name").notNull(),
  /** Plaid transactions cursor — tracks the sync position */
  cursor: text("cursor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlaidItem = typeof plaidItemsTable.$inferSelect;
