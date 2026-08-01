import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    householdId: c.householdId,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.householdId, householdId));
  res.json(cats.map(serializeCategory));
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [cat] = await db.insert(categoriesTable).values({ ...parsed.data, householdId }).returning();
  res.status(201).json(serializeCategory(cat));
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [cat] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.householdId, householdId)))
    .returning();

  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(serializeCategory(cat));
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const householdId = (req as any).householdId;
  const [cat] = await db
    .delete(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.householdId, householdId)))
    .returning();

  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
