import { eq, and, ne, or, isNull } from "drizzle-orm";
import { db, recurringTransactionsTable, transactionsTable } from "@workspace/db";

/**
 * Posts due recurring transactions. A rule posts once per month, on or after
 * its dayOfMonth (clamped to the month's length). Runs at startup and then
 * hourly, so the app catches up even if the server was off on the due day.
 */
export async function postDueRecurringTransactions(): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const due = await db
    .select()
    .from(recurringTransactionsTable)
    .where(
      and(
        eq(recurringTransactionsTable.active, true),
        or(
          isNull(recurringTransactionsTable.lastPostedMonth),
          ne(recurringTransactionsTable.lastPostedMonth, monthKey),
        ),
      ),
    );

  for (const rule of due) {
    const postDay = Math.min(rule.dayOfMonth, daysInMonth);
    if (today < postDay) continue;
    const date = `${monthKey}-${String(postDay).padStart(2, "0")}`;
    try {
      // Claim + insert atomically: if either fails, both roll back and the
      // next hourly run retries. The conditional claim also guards against
      // concurrent runs double-posting.
      await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(recurringTransactionsTable)
          .set({ lastPostedMonth: monthKey })
          .where(
            and(
              eq(recurringTransactionsTable.id, rule.id),
              or(
                isNull(recurringTransactionsTable.lastPostedMonth),
                ne(recurringTransactionsTable.lastPostedMonth, monthKey),
              ),
            ),
          )
          .returning();
        if (!claimed) return; // another instance claimed it
        await tx.insert(transactionsTable).values({
          amount: rule.amount,
          description: rule.description,
          categoryId: rule.categoryId,
          userId: rule.userId,
          householdId: rule.householdId,
          date,
        });
      });
    } catch (err) {
      console.error("Failed to post recurring transaction", rule.id, err);
    }
  }
}

export function startRecurringPoster(): void {
  postDueRecurringTransactions().catch((err) => console.error("recurring poster failed", err));
  setInterval(() => {
    postDueRecurringTransactions().catch((err) => console.error("recurring poster failed", err));
  }, 60 * 60 * 1000).unref();
}
