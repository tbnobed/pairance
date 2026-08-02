import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import { db, plaidItemsTable, plaidAccountsTable, transactionsTable, categoriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const plaidEnv = process.env.PLAID_ENV ?? "sandbox";
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// POST /plaid/create-link-token
// Creates a Plaid Link token so the frontend can open the Link dialog
router.post("/plaid/create-link-token", requireAuth, async (req, res): Promise<void> => {
  const userId = String((req as any).userId);
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Pairance",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ linkToken: response.data.link_token });
  } catch (err: any) {
    console.error("Plaid create-link-token error:", err?.response?.data ?? err);
    res.status(500).json({ error: "Failed to create Plaid link token" });
  }
});

// POST /plaid/exchange-token
// Exchanges the public_token from Plaid Link for a permanent access_token, stores the item
router.post("/plaid/exchange-token", requireAuth, async (req, res): Promise<void> => {
  const { publicToken, institutionId, institutionName } = req.body as {
    publicToken: string;
    institutionId?: string;
    institutionName: string;
  };
  const householdId = (req as any).householdId;

  if (!publicToken || !institutionName) {
    res.status(400).json({ error: "publicToken and institutionName are required" });
    return;
  }

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchangeRes.data;

    // Fetch accounts
    const accountsRes = await plaidClient.accountsGet({ access_token });

    // Upsert item (in case they reconnect the same institution)
    const [item] = await db
      .insert(plaidItemsTable)
      .values({ householdId, itemId: item_id, accessToken: access_token, institutionId: institutionId ?? null, institutionName })
      .onConflictDoUpdate({
        target: plaidItemsTable.itemId,
        set: { accessToken: access_token, institutionName },
      })
      .returning();

    // Upsert accounts for this item
    const accounts = accountsRes.data.accounts;
    if (accounts.length > 0) {
      await db
        .insert(plaidAccountsTable)
        .values(
          accounts.map((a) => ({
            itemId: item.id,
            accountId: a.account_id,
            name: a.name,
            officialName: a.official_name ?? null,
            type: a.type,
            subtype: a.subtype ?? null,
            mask: a.mask ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: plaidAccountsTable.accountId,
          set: { name: accounts[0].name }, // minimal update to satisfy ON CONFLICT
        });
    }

    res.json({
      item: {
        id: item.id,
        institutionName: item.institutionName,
        accountCount: accounts.length,
      },
    });
  } catch (err: any) {
    console.error("Plaid exchange-token error:", err?.response?.data ?? err);
    res.status(500).json({ error: "Failed to exchange Plaid token" });
  }
});

// GET /plaid/items
// List all connected institutions for the household
router.get("/plaid/items", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;
  const items = await db.select().from(plaidItemsTable).where(eq(plaidItemsTable.householdId, householdId));

  const result = await Promise.all(
    items.map(async (item) => {
      const accounts = await db
        .select()
        .from(plaidAccountsTable)
        .where(eq(plaidAccountsTable.itemId, item.id));
      return {
        id: item.id,
        institutionId: item.institutionId,
        institutionName: item.institutionName,
        createdAt: item.createdAt.toISOString(),
        accounts: accounts.map((a) => ({
          id: a.id,
          accountId: a.accountId,
          name: a.name,
          officialName: a.officialName,
          type: a.type,
          subtype: a.subtype,
          mask: a.mask,
        })),
      };
    }),
  );

  res.json(result);
});

// POST /plaid/sync
// Pull new/updated/removed transactions from Plaid and upsert them into the transactions table
router.post("/plaid/sync", requireAuth, async (req, res): Promise<void> => {
  const householdId = (req as any).householdId;
  const userId = (req as any).userId;

  // Optionally sync a single item; otherwise sync all for household
  const { itemId } = req.body as { itemId?: number };

  const items = await db
    .select()
    .from(plaidItemsTable)
    .where(
      and(
        eq(plaidItemsTable.householdId, householdId),
        ...(itemId ? [eq(plaidItemsTable.id, itemId)] : []),
      ),
    );

  if (items.length === 0) {
    res.json({ added: 0, modified: 0, removed: 0 });
    return;
  }

  // Find (or create) an "Uncategorized" category for Plaid imports
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.householdId, householdId));
  let uncategorizedId = categories.find((c) => c.name.toLowerCase() === "uncategorized")?.id;
  if (!uncategorizedId) {
    const [newCat] = await db
      .insert(categoriesTable)
      .values({ name: "Uncategorized", color: "#94a3b8", icon: "tag", householdId })
      .returning();
    uncategorizedId = newCat.id;
  }

  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  for (const item of items) {
    let cursor = item.cursor ?? undefined;
    let hasMore = true;

    while (hasMore) {
      const syncRes = await plaidClient.transactionsSync({
        access_token: item.accessToken,
        cursor,
      });
      const { added, modified, removed, next_cursor, has_more } = syncRes.data;

      // Insert new transactions (skip if plaid_transaction_id already exists)
      for (const t of added) {
        if (t.amount <= 0) continue; // skip credits / refunds
        try {
          await db.insert(transactionsTable).values({
            amount: String(t.amount),
            description: t.name,
            categoryId: uncategorizedId!,
            userId,
            householdId,
            date: t.date,
            plaidTransactionId: t.transaction_id,
          }).onConflictDoNothing();
          totalAdded++;
        } catch {
          // duplicate — already exists
        }
      }

      // Update modified transactions (amount / description / date)
      for (const t of modified) {
        if (t.amount <= 0) continue;
        await db
          .update(transactionsTable)
          .set({ amount: String(t.amount), description: t.name, date: t.date })
          .where(eq(transactionsTable.plaidTransactionId, t.transaction_id));
        totalModified++;
      }

      // Remove deleted transactions
      for (const t of removed) {
        if (!t.transaction_id) continue;
        await db.delete(transactionsTable).where(eq(transactionsTable.plaidTransactionId, t.transaction_id));
        totalRemoved++;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    // Persist updated cursor
    await db
      .update(plaidItemsTable)
      .set({ cursor })
      .where(eq(plaidItemsTable.id, item.id));
  }

  res.json({ added: totalAdded, modified: totalModified, removed: totalRemoved });
});

// DELETE /plaid/items/:id
// Unlink a connected institution
router.delete("/plaid/items/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const householdId = (req as any).householdId;

  const [item] = await db
    .select()
    .from(plaidItemsTable)
    .where(and(eq(plaidItemsTable.id, id), eq(plaidItemsTable.householdId, householdId)))
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  // Tell Plaid to remove the item (best-effort)
  try {
    await plaidClient.itemRemove({ access_token: item.accessToken });
  } catch (err) {
    console.warn("Plaid itemRemove failed (continuing):", err);
  }

  // Delete accounts then item
  await db.delete(plaidAccountsTable).where(eq(plaidAccountsTable.itemId, item.id));
  await db.delete(plaidItemsTable).where(eq(plaidItemsTable.id, item.id));

  res.sendStatus(204);
});

export default router;
