import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, categoriesTable, transactionsTable, budgetsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/suggest-budgets", requireAuth, async (req, res) => {
  const {
    monthlyIncome,
    zipCode,
    rent,
    carPayment,
    insurance,
    utilities,
    savings,
  } = req.body as {
    monthlyIncome?: unknown;
    zipCode?: unknown;
    rent?: unknown;
    carPayment?: unknown;
    insurance?: unknown;
    utilities?: unknown;
    savings?: unknown;
  };

  if (!monthlyIncome || typeof monthlyIncome !== "number" || monthlyIncome <= 0) {
    res.status(400).json({ error: "monthlyIncome must be a positive number" });
    return;
  }

  const zipStr = typeof zipCode === "string" && /^\d{5}$/.test(zipCode.trim())
    ? zipCode.trim()
    : null;

  const fixedExpenses: { label: string; amount: number }[] = [];
  if (typeof rent === "number" && rent > 0) fixedExpenses.push({ label: "Rent/Mortgage", amount: rent });
  if (typeof carPayment === "number" && carPayment > 0) fixedExpenses.push({ label: "Car Payment(s)", amount: carPayment });
  if (typeof insurance === "number" && insurance > 0) fixedExpenses.push({ label: "Insurance (health/auto/home)", amount: insurance });
  if (typeof utilities === "number" && utilities > 0) fixedExpenses.push({ label: "Utilities (electric/internet/phone)", amount: utilities });
  if (typeof savings === "number" && savings > 0) fixedExpenses.push({ label: "Desired Savings (set aside before spending)", amount: savings });

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const discretionary = monthlyIncome - totalFixed;

  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.householdId, (req as any).householdId));

  if (categories.length === 0) {
    res.status(400).json({ error: "No categories found for this household" });
    return;
  }

  const categoryList = categories.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");

  let completion;
  try {
    completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content:
          "You are a personal finance advisor helping couples allocate their monthly budget. " +
          "Respond ONLY with a valid JSON array. No markdown, no explanation, just the raw JSON array.",
      },
      {
        role: "user",
        content: [
          `Our combined monthly take-home income is $${monthlyIncome.toFixed(2)}.`,
          zipStr ? `We live in zip code ${zipStr} — use local cost-of-living data to calibrate grocery and gas estimates for that area.` : "",
          fixedExpenses.length > 0
            ? `We already have these fixed monthly commitments (do NOT include these in your suggestions — they are already paid):\n` +
              fixedExpenses.map(e => `  - ${e.label}: $${e.amount.toFixed(2)}`).join("\n") +
              `\n  Total fixed: $${totalFixed.toFixed(2)}\n  Remaining to allocate: $${discretionary.toFixed(2)}`
            : "",
          `We have these spending categories:\n${categoryList}`,
          `Suggest a realistic monthly budget for each category based on typical couple spending` +
            (zipStr ? ` in zip code ${zipStr}` : "") + `.`,
          `The total of ALL suggestions combined must not exceed $${Math.max(0, discretionary).toFixed(2)} (the discretionary amount after fixed expenses).`,
          `Return ONLY a JSON array like: [{"categoryId": 1, "monthlyLimit": 500}, ...]. Include every category id. No markdown, no extra text.`,
        ].filter(Boolean).join("\n"),
      },
    ],
    });
  } catch (err) {
    res.status(502).json({ error: "AI service is unavailable right now. Try again shortly." });
    return;
  }

  const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";

  let suggestions: { categoryId: number; monthlyLimit: number }[];
  try {
    suggestions = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "AI returned an unparseable response", raw });
    return;
  }

  // Attach category names for display
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const result = suggestions.map((s) => ({
    categoryId: s.categoryId,
    categoryName: categoryMap.get(s.categoryId) ?? "Unknown",
    monthlyLimit: s.monthlyLimit,
  }));

  res.json({ suggestions: result });
});

router.post("/ai/monthly-review", requireAuth, async (req, res) => {
  const month = typeof req.body?.month === "string" && /^\d{4}-\d{2}$/.test(req.body.month)
    ? req.body.month
    : null;
  if (!month) {
    res.status(400).json({ error: "month must be in YYYY-MM format" });
    return;
  }
  const householdId = (req as any).householdId;

  // Previous month key
  const [y, m] = month.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.householdId, householdId));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const spendFor = async (mo: string) =>
    db
      .select({
        categoryId: transactionsTable.categoryId,
        total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.householdId, householdId),
          sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${mo}`,
        ),
      )
      .groupBy(transactionsTable.categoryId);

  const [thisMonth, lastMonth] = await Promise.all([spendFor(month), spendFor(prevMonth)]);

  if (thisMonth.length === 0) {
    res.status(400).json({ error: "No transactions found for that month" });
    return;
  }

  // Effective (carry-forward) budgets: latest row per category with month <= target
  const allBudgets = await db
    .select()
    .from(budgetsTable)
    .where(eq(budgetsTable.householdId, householdId));
  const effBudget = new Map<number, number>();
  const effMonth = new Map<number, string>();
  for (const b of allBudgets) {
    const bKey = b.month.slice(0, 7);
    if (bKey > month) continue;
    if (!effMonth.has(b.categoryId) || bKey > effMonth.get(b.categoryId)!) {
      effMonth.set(b.categoryId, bKey);
      effBudget.set(b.categoryId, Number(b.monthlyLimit));
    }
  }

  const prevMap = new Map(lastMonth.map((r) => [r.categoryId, Number(r.total)]));
  const lines = thisMonth.map((r) => {
    const name = catName.get(r.categoryId) ?? "Unknown";
    const spent = Number(r.total);
    const budget = effBudget.get(r.categoryId);
    const prev = prevMap.get(r.categoryId);
    return `- ${name}: spent $${spent.toFixed(2)} across ${r.count} transactions` +
      (budget !== undefined ? `, budget $${budget.toFixed(2)}` : ", no budget set") +
      (prev !== undefined ? `, previous month $${prev.toFixed(2)}` : "");
  }).join("\n");

  let completion;
  try {
    completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 1500,
    messages: [
      {
        role: "system",
        content:
          "You are a warm, practical personal finance advisor reviewing a couple's monthly spending. " +
          "Respond ONLY with valid JSON in this exact shape, no markdown: " +
          '{"summary": "2-3 sentence overview", "wins": ["..."], "concerns": ["..."], "tips": ["..."]}. ' +
          "Keep wins/concerns/tips to 2-4 short items each. Be specific — reference their actual numbers and category names.",
      },
      {
        role: "user",
        content: `Here is our household spending for ${month}:\n${lines}\n\nGive us honest feedback on how we did against our budgets and versus the previous month, and practical tips for next month.`,
      },
    ],
    });
  } catch (err) {
    res.status(502).json({ error: "AI service is unavailable right now. Try again shortly." });
    return;
  }

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  try {
    const parsed = JSON.parse(raw);
    res.json({
      month,
      summary: String(parsed.summary ?? ""),
      wins: Array.isArray(parsed.wins) ? parsed.wins.map(String) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips.map(String) : [],
    });
  } catch {
    res.status(500).json({ error: "AI returned an unparseable response" });
  }
});

export default router;
