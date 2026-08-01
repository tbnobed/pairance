import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const locationVisitsTable = pgTable("location_visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  householdId: integer("household_id").notNull(),
  locationName: text("location_name"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  suggestedCategoryId: integer("suggested_category_id"),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLocationVisitSchema = createInsertSchema(locationVisitsTable).omit({ id: true, visitedAt: true });
export type InsertLocationVisit = z.infer<typeof insertLocationVisitSchema>;
export type LocationVisit = typeof locationVisitsTable.$inferSelect;
