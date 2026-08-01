import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/api/ai/suggest-budgets", requireAuth, async (req, res) => {
  const { monthlyIncome, zipCode } = req.body as { monthlyIncome?: unknown; zipCode?: unknown };

  if (!monthlyIncome || typeof monthlyIncome !== "number" || monthlyIncome <= 0) {
    res.status(400).json({ error: "monthlyIncome must be a positive number" });
    return;
  }

  const zipStr = typeof zipCode === "string" && /^\d{5}$/.test(zipCode.trim())
    ? zipCode.trim()
    : null;

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
        content:
          `Our combined monthly take-home income is $${monthlyIncome.toFixed(2)}.\n` +
          (zipStr ? `We live in zip code ${zipStr} — use local cost-of-living data for that area to calibrate grocery and gas estimates accurately.\n` : "") +
          `We have these spending categories:\n${categoryList}\n\n` +
          `Suggest a realistic monthly budget for each category based on typical couple spending` +
          (zipStr ? ` in zip code ${zipStr}` : "") + `. ` +
          `The total of all suggestions must not exceed the monthly income. ` +
          `Return ONLY a JSON array like: [{"categoryId": 1, "monthlyLimit": 500}, ...] ` +
          `Include every category id from the list above. No markdown, no extra text.`,
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
