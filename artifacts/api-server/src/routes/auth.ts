import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, usersTable, householdsTable, categoriesTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  InviteSpouseBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function serializeUser(user: typeof usersTable.$inferSelect, spouseName?: string | null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    householdId: user.householdId,
    spouseName: spouseName ?? null,
    theme: (user as any).theme ?? "light",
    createdAt: user.createdAt.toISOString(),
  };
}

async function getSpouseName(user: typeof usersTable.$inferSelect): Promise<string | null> {
  if (!user.householdId) return null;
  const spouse = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.householdId, user.householdId))
    .limit(2);
  const other = spouse.find((u) => u.id !== user.id);
  return other?.name ?? null;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  // Create a new household for this user
  const [household] = await db.insert(householdsTable).values({}).returning();
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    householdId: household.id,
  }).returning();

  // Seed default categories for the household
  const defaultCategories = [
    { name: "Groceries", color: "#22c55e", icon: "🛒", householdId: household.id },
    { name: "Dining Out", color: "#f97316", icon: "🍽️", householdId: household.id },
    { name: "Transport", color: "#3b82f6", icon: "🚗", householdId: household.id },
    { name: "Entertainment", color: "#a855f7", icon: "🎬", householdId: household.id },
    { name: "Shopping", color: "#ec4899", icon: "🛍️", householdId: household.id },
    { name: "Bills & Utilities", color: "#eab308", icon: "💡", householdId: household.id },
    { name: "Health", color: "#14b8a6", icon: "💊", householdId: household.id },
    { name: "Other", color: "#6b7280", icon: "📦", householdId: household.id },
  ];
  await db.insert(categoriesTable).values(defaultCategories);

  const session = (req as any).session;
  session.userId = user.id;
  session.householdId = user.householdId;

  res.status(201).json({ user: serializeUser(user, null) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const session = (req as any).session;
  session.userId = user.id;
  session.householdId = user.householdId;

  const spouseName = await getSpouseName(user);
  res.json({ user: serializeUser(user, spouseName) });
});

router.post("/auth/logout", (req, res): void => {
  (req as any).session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const spouseName = await getSpouseName(user);
  res.json(serializeUser(user, spouseName));
});

router.put("/auth/theme", requireAuth, async (req, res): Promise<void> => {
  const theme = req.body?.theme;
  if (theme !== "light" && theme !== "dark") {
    res.status(400).json({ error: "theme must be 'light' or 'dark'" });
    return;
  }
  const userId = (req as any).userId;
  const [user] = await db
    .update(usersTable)
    .set({ theme })
    .where(eq(usersTable.id, userId))
    .returning();
  const spouseName = await getSpouseName(user);
  res.json(serializeUser(user, spouseName));
});

// Create the partner's account directly (no public registration).
// The logged-in user sets their partner's name/email/password; the new
// account is placed into the same household immediately.
router.post("/auth/create-partner", requireAuth, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password } = parsed.data;
  const userId = (req as any).userId;

  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!currentUser?.householdId) {
    res.status(400).json({ error: "No household found" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    householdId: currentUser.householdId,
  });

  const spouseName = await getSpouseName(currentUser);
  res.status(201).json(serializeUser(currentUser, spouseName));
});

router.post("/auth/invite", requireAuth, async (req, res): Promise<void> => {
  const parsed = InviteSpouseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { spouseEmail } = parsed.data;
  const userId = (req as any).userId;

  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!currentUser?.householdId) {
    res.status(400).json({ error: "No household found" });
    return;
  }

  const [spouse] = await db.select().from(usersTable).where(eq(usersTable.email, spouseEmail)).limit(1);
  if (!spouse) {
    res.status(404).json({ error: "No account found with that email" });
    return;
  }
  if (spouse.id === userId) {
    res.status(400).json({ error: "Cannot invite yourself" });
    return;
  }

  // Move spouse into the current user's household
  await db.update(usersTable).set({ householdId: currentUser.householdId }).where(eq(usersTable.id, spouse.id));

  const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const spouseName = await getSpouseName(updatedUser[0]);
  res.json(serializeUser(updatedUser[0], spouseName));
});

export default router;
