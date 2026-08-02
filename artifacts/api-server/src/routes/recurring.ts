import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, recurringTransactionsTable, categoriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serialize(r: typeof recurringTransactionsTable.$inferSelect, categoryName?: string | null) {
  return {
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    categoryId: r.categoryId,
    categoryName: categoryName ?? null,
    dayOfMonth: r.dayOfMonth,
    active: r.active,
    lastPostedMonth: r.lastPostedMonth,
  };
}

router.get("/recurring", requireAuth, async (req, res) => {
  const householdId = (req as any).householdId;
  const rows = await db
    .select({ r: recurringTransactionsTable, categoryName: categoriesTable.name })
    .from(recurringTransactionsTable)
    .leftJoin(categoriesTable, eq(categoriesTable.id, recurringTransactionsTable.categoryId))
    .where(eq(recurringTransactionsTable.householdId, householdId));
  res.json(rows.map(({ r, categoryName }) => serialize(r, categoryName)));
});

router.post("/recurring", requireAuth, async (req, res) => {
  const householdId = (req as any).householdId;
  const userId = (req as any).userId;
  const { description, amount, categoryId, dayOfMonth } = req.body ?? {};
  if (typeof description !== "string" || !description.trim()) {
    res.status(400).json({ error: "description is required" });
    return;
  }
  if (typeof amount !== "number" || !(amount > 0)) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }
  if (typeof categoryId !== "number") {
    res.status(400).json({ error: "categoryId is required" });
    return;
  }
  const day = typeof dayOfMonth === "number" && dayOfMonth >= 1 && dayOfMonth <= 31 ? Math.floor(dayOfMonth) : 1;
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.householdId, householdId)))
    .limit(1);
  if (!cat) {
    res.status(400).json({ error: "Unknown category" });
    return;
  }
  const [r] = await db
    .insert(recurringTransactionsTable)
    .values({
      description: description.trim(),
      amount: String(amount),
      categoryId,
      userId,
      householdId,
      dayOfMonth: day,
    })
    .returning();
  res.status(201).json(serialize(r, cat.name));
});

router.patch("/recurring/:id", requireAuth, async (req, res) => {
  const householdId = (req as any).householdId;
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const { description, amount, categoryId, dayOfMonth, active } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (typeof description === "string" && description.trim()) updates.description = description.trim();
  if (typeof amount === "number" && amount > 0) updates.amount = String(amount);
  if (typeof categoryId === "number") {
    const [cat] = await db
      .select()
      .from(categoriesTable)
      .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.householdId, householdId)))
      .limit(1);
    if (!cat) {
      res.status(400).json({ error: "Unknown category" });
      return;
    }
    updates.categoryId = categoryId;
  }
  if (typeof dayOfMonth === "number" && dayOfMonth >= 1 && dayOfMonth <= 31) updates.dayOfMonth = Math.floor(dayOfMonth);
  if (typeof active === "boolean") updates.active = active;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no valid fields to update" });
    return;
  }
  const [r] = await db
    .update(recurringTransactionsTable)
    .set(updates)
    .where(and(eq(recurringTransactionsTable.id, id), eq(recurringTransactionsTable.householdId, householdId)))
    .returning();
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(r));
});

router.delete("/recurring/:id", requireAuth, async (req, res) => {
  const householdId = (req as any).householdId;
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const [r] = await db
    .delete(recurringTransactionsTable)
    .where(and(eq(recurringTransactionsTable.id, id), eq(recurringTransactionsTable.householdId, householdId)))
    .returning();
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
