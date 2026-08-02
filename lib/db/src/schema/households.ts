import { pgTable, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const householdsTable = pgTable("households", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  monthlyPlan: jsonb("monthly_plan").$type<Record<string, string>>(),
});

export const insertHouseholdSchema = createInsertSchema(householdsTable).omit({ id: true, createdAt: true });
export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;
export type Household = typeof householdsTable.$inferSelect;
