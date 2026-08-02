import { Router } from "express";
import { db, householdsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: Router = Router();

// The monthly plan (income + fixed expenses) is shared by the household.
router.get("/plan", requireAuth, async (req, res) => {
  const householdId = (req as any).householdId;
  const [household] = await db
    .select({ monthlyPlan: householdsTable.monthlyPlan })
    .from(householdsTable)
    .where(eq(householdsTable.id, householdId))
    .limit(1);
  res.json({ plan: household?.monthlyPlan ?? null });
});

router.put("/plan", requireAuth, async (req, res) => {
  const householdId = (req as any).householdId;
  const plan = req.body?.plan;
  if (typeof plan !== "object" || plan === null || Array.isArray(plan)) {
    res.status(400).json({ error: "plan must be an object" });
    return;
  }
  // Only accept known string fields
  const allowed = ["income", "rent", "carPayment", "insurance", "utilities", "tithes", "savings"];
  const clean: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof plan[key] === "string") clean[key] = plan[key].slice(0, 20);
  }
  await db
    .update(householdsTable)
    .set({ monthlyPlan: clean })
    .where(eq(householdsTable.id, householdId));
  res.json({ plan: clean });
});

export default router;
