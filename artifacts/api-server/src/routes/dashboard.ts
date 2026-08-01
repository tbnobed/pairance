import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, transactionsTable, categoriesTable, budgetsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;
  const month = currentMonth();

  // Total spent this month
  const [totalRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.householdId, householdId),
        sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`,
      ),
    );

  // Total budget this month
  const [budgetRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${budgetsTable.monthlyLimit}), 0)` })
    .from(budgetsTable)
    .where(and(eq(budgetsTable.householdId, householdId), eq(budgetsTable.month, month)));

  // Spending by category this month
  const categoryRows = await db
    .select({
      categoryId: transactionsTable.categoryId,
      spent: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.householdId, householdId),
        sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`,
      ),
    )
    .groupBy(transactionsTable.categoryId);

  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.householdId, householdId));

  const budgets = await db
    .select()
    .from(budgetsTable)
    .where(and(eq(budgetsTable.householdId, householdId), eq(budgetsTable.month, month)));

  const totalSpent = Number(totalRow?.total ?? 0);
  const totalBudget = Number(budgetRow?.total ?? 0);

  const categoryBreakdown = categoryRows.map((row) => {
    const cat = categories.find((c) => c.id === row.categoryId);
    const budget = budgets.find((b) => b.categoryId === row.categoryId);
    const spent = Number(row.spent);
    const budgetAmt = budget ? Number(budget.monthlyLimit) : null;
    return {
      categoryId: row.categoryId,
      categoryName: cat?.name ?? "Unknown",
      categoryColor: cat?.color ?? "#6b7280",
      spent,
      budget: budgetAmt,
      percentage: budgetAmt ? Math.round((spent / budgetAmt) * 100) : 0,
    };
  });

  // Partner breakdown
  const partnerRows = await db
    .select({
      userId: transactionsTable.userId,
      spent: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.householdId, householdId),
        sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`,
      ),
    )
    .groupBy(transactionsTable.userId);

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.householdId, householdId));

  const partnerBreakdown = partnerRows.map((row) => {
    const user = users.find((u) => u.id === row.userId);
    return {
      userId: row.userId,
      userName: user?.name ?? "Unknown",
      spent: Number(row.spent),
    };
  });

  res.json({
    totalSpentThisMonth: totalSpent,
    totalBudgetThisMonth: totalBudget,
    categoryBreakdown,
    partnerBreakdown,
  });
});

router.get("/dashboard/recent", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.householdId, householdId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(10);

  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.householdId, householdId));

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.householdId, householdId));

  const enriched = rows.map((t) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    const user = users.find((u) => u.id === t.userId);
    return {
      id: t.id,
      amount: Number(t.amount),
      description: t.description,
      categoryId: t.categoryId,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      userId: t.userId,
      userName: user?.name ?? null,
      locationName: t.locationName ?? null,
      locationLat: t.locationLat ?? null,
      locationLng: t.locationLng ?? null,
      date: t.date,
      createdAt: t.createdAt.toISOString(),
    };
  });

  res.json(enriched);
});

router.get("/dashboard/spending-by-day", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;
  const month = currentMonth();

  const rows = await db
    .select({
      date: transactionsTable.date,
      total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.householdId, householdId),
        sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`,
      ),
    )
    .groupBy(transactionsTable.date)
    .orderBy(transactionsTable.date);

  res.json(rows.map((r) => ({ date: r.date, total: Number(r.total) })));
});

export default router;
