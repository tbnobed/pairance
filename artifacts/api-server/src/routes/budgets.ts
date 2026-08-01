import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, budgetsTable, categoriesTable, transactionsTable } from "@workspace/db";
import {
  CreateBudgetBody,
  UpdateBudgetBody,
  UpdateBudgetParams,
  DeleteBudgetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function serializeBudget(b: typeof budgetsTable.$inferSelect, householdId: number) {
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, b.categoryId)).limit(1);

  // Calculate spent for this month
  const [spentRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.householdId, householdId),
        eq(transactionsTable.categoryId, b.categoryId),
        sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${b.month}`,
      ),
    );

  return {
    id: b.id,
    categoryId: b.categoryId,
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    monthlyLimit: Number(b.monthlyLimit),
    spent: Number(spentRow?.total ?? 0),
    month: b.month,
    householdId: b.householdId,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/budgets", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;
  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.householdId, householdId));
  const serialized = await Promise.all(budgets.map((b) => serializeBudget(b, householdId)));
  res.json(serialized);
});

router.post("/budgets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [b] = await db.insert(budgetsTable).values({
    categoryId: parsed.data.categoryId,
    monthlyLimit: String(parsed.data.monthlyLimit),
    month: parsed.data.month,
    householdId,
  }).returning();
  res.status(201).json(await serializeBudget(b, householdId));
});

router.patch("/budgets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const updates: Record<string, unknown> = {};
  if (parsed.data.monthlyLimit !== undefined) updates.monthlyLimit = String(parsed.data.monthlyLimit);

  const [b] = await db
    .update(budgetsTable)
    .set(updates)
    .where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.householdId, householdId)))
    .returning();

  if (!b) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.json(await serializeBudget(b, householdId));
});

router.delete("/budgets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [b] = await db
    .delete(budgetsTable)
    .where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.householdId, householdId)))
    .returning();

  if (!b) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
