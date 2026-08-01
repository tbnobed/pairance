import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, locationVisitsTable, transactionsTable } from "@workspace/db";
import { LocationCheckInBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Distance in meters between two GPS coords (Haversine)
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post("/locations/check-in", requireAuth, async (req, res): Promise<void> => {
  const parsed = LocationCheckInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as any).userId;
  const householdId = (req as any).householdId;
  const { lat, lng, locationName } = parsed.data;

  // Find recent visits nearby (within 200m) in the last 4 hours — suppress re-prompt
  const recentVisits = await db
    .select()
    .from(locationVisitsTable)
    .where(
      and(
        eq(locationVisitsTable.userId, userId),
        sql`${locationVisitsTable.visitedAt} > NOW() - INTERVAL '4 hours'`,
      ),
    )
    .orderBy(desc(locationVisitsTable.visitedAt))
    .limit(20);

  const nearbyRecent = recentVisits.find(
    (v) => haversineMeters(lat, lng, v.lat, v.lng) < 200,
  );

  if (nearbyRecent) {
    // Already checked in here recently — don't prompt again
    res.json({
      shouldPrompt: false,
      locationName: nearbyRecent.locationName ?? null,
      lastVisitedAt: nearbyRecent.visitedAt.toISOString(),
      suggestedCategory: null,
      suggestedCategoryName: null,
    });
    return;
  }

  // Look for historical visits at this location to suggest a category
  const historicalVisits = await db
    .select()
    .from(locationVisitsTable)
    .where(eq(locationVisitsTable.householdId, householdId))
    .orderBy(desc(locationVisitsTable.visitedAt))
    .limit(50);

  const historicalNearby = historicalVisits.find(
    (v) => haversineMeters(lat, lng, v.lat, v.lng) < 200,
  );

  let suggestedCategoryId: number | null = historicalNearby?.suggestedCategoryId ?? null;
  let suggestedCategoryName: string | null = null;

  // If no historical suggestion, look at most common category used at this location from transactions
  if (!suggestedCategoryId) {
    const nearbyTxs = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.householdId, householdId),
          sql`${transactionsTable.locationLat} IS NOT NULL`,
        ),
      )
      .limit(100);

    const nearby = nearbyTxs.filter(
      (t) => t.locationLat != null && t.locationLng != null &&
        haversineMeters(lat, lng, t.locationLat!, t.locationLng!) < 200,
    );

    if (nearby.length > 0) {
      const categoryCounts = nearby.reduce<Record<number, number>>((acc, t) => {
        acc[t.categoryId] = (acc[t.categoryId] ?? 0) + 1;
        return acc;
      }, {});
      const topCategoryId = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topCategoryId) suggestedCategoryId = Number(topCategoryId);
    }
  }

  // Record this visit
  await db.insert(locationVisitsTable).values({
    userId,
    householdId,
    lat,
    lng,
    locationName: locationName ?? null,
    suggestedCategoryId,
  });

  res.json({
    shouldPrompt: true,
    locationName: locationName ?? null,
    lastVisitedAt: historicalNearby?.visitedAt.toISOString() ?? null,
    suggestedCategory: suggestedCategoryId,
    suggestedCategoryName,
  });
});

export default router;
