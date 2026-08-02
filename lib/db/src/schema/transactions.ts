import { pgTable, serial, text, integer, numeric, date, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id").notNull(),
  userId: integer("user_id").notNull(),
  householdId: integer("household_id").notNull(),
  locationName: text("location_name"),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  date: date("date", { mode: "string" }).notNull(),
  /** Set when the transaction was imported from Plaid — used for deduplication */
  plaidTransactionId: text("plaid_transaction_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
