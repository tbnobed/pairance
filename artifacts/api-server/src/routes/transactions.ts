import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, transactionsTable, categoriesTable, usersTable } from "@workspace/db";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  GetTransactionParams,
  UpdateTransactionParams,
  DeleteTransactionParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeTransaction(
  t: typeof transactionsTable.$inferSelect,
  categoryName?: string | null,
  categoryColor?: string | null,
  userName?: string | null,
) {
  return {
    id: t.id,
    amount: Number(t.amount),
    description: t.description,
    categoryId: t.categoryId,
    categoryName: categoryName ?? null,
    categoryColor: categoryColor ?? null,
    userId: t.userId,
    userName: userName ?? null,
    locationName: t.locationName ?? null,
    locationLat: t.locationLat ?? null,
    locationLng: t.locationLng ?? null,
    date: t.date,
    createdAt: t.createdAt.toISOString(),
  };
}

async function enrichTransaction(t: typeof transactionsTable.$inferSelect) {
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId)).limit(1);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.userId)).limit(1);
  return serializeTransaction(t, cat?.name, cat?.color, user?.name);
}

router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const qp = ListTransactionsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const { categoryId, userId, limit = 50, offset = 0 } = qp.data;

  let query = db.select().from(transactionsTable).where(eq(transactionsTable.householdId, householdId));

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.householdId, householdId),
        ...(categoryId ? [eq(transactionsTable.categoryId, categoryId)] : []),
        ...(userId ? [eq(transactionsTable.userId, userId)] : []),
      ),
    )
    .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  const enriched = await Promise.all(rows.map(enrichTransaction));
  res.json(enriched);
});

router.post("/transactions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as any).userId;
  const householdId = (req as any).householdId;
  const { amount, description, categoryId, date, locationName, locationLat, locationLng } = parsed.data;

  const [t] = await db.insert(transactionsTable).values({
    amount: String(amount),
    description,
    categoryId,
    userId,
    householdId,
    date,
    locationName: locationName ?? null,
    locationLat: locationLat ?? null,
    locationLng: locationLng ?? null,
  }).returning();

  res.status(201).json(await enrichTransaction(t));
});

router.get("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [t] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.householdId, householdId)))
    .limit(1);

  if (!t) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(await enrichTransaction(t));
});

router.patch("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const updates: Record<string, unknown> = {};
  if (parsed.data.amount !== undefined) updates.amount = String(parsed.data.amount);
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;
  if (parsed.data.locationName !== undefined) updates.locationName = parsed.data.locationName;
  if (parsed.data.locationLat !== undefined) updates.locationLat = parsed.data.locationLat;
  if (parsed.data.locationLng !== undefined) updates.locationLng = parsed.data.locationLng;

  const [t] = await db
    .update(transactionsTable)
    .set(updates)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.householdId, householdId)))
    .returning();

  if (!t) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(await enrichTransaction(t));
});

router.delete("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [t] = await db
    .delete(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.householdId, householdId)))
    .returning();

  if (!t) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
