import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  } = req.body as {
    monthlyIncome?: unknown;
    zipCode?: unknown;
    rent?: unknown;
    carPayment?: unknown;
    insurance?: unknown;
    utilities?: unknown;
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

  const completion = await openai.chat.completions.create({
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

export default router;
