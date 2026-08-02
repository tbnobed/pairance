import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPgSimple(session);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Trust proxy for cookie security when behind a reverse proxy
app.set("trust proxy", 1);

app.use(
  cors({
    credentials: true,
    origin: true,
  }),
);

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // The web app and API are same-origin everywhere (Vite proxy in dev,
      // nginx proxy in Docker), so "lax" always works. Secure cookies are
      // opt-in via COOKIE_SECURE=true — required only when serving over
      // HTTPS; over plain HTTP the browser would reject them and login
      // would silently fail.
      secure: process.env.COOKIE_SECURE === "true",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
  }),
);

// 10mb limit to allow base64 receipt photos on /ai/scan-receipt
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
