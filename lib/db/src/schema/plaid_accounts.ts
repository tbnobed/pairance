import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const plaidAccountsTable = pgTable("plaid_accounts", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  accountId: text("account_id").notNull().unique(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  mask: text("mask"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlaidAccount = typeof plaidAccountsTable.$inferSelect;
