import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import transactionsRouter from "./transactions";
import categoriesRouter from "./categories";
import budgetsRouter from "./budgets";
import locationsRouter from "./locations";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import plaidRouter from "./plaid";
import planRouter from "./plan";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(transactionsRouter);
router.use(categoriesRouter);
router.use(budgetsRouter);
router.use(locationsRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(plaidRouter);
router.use(planRouter);

export default router;
