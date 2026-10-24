import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import session from "express-session";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import passport from "passport";
import { PrismaClient } from "@prisma/client";
import { env } from "./config/env";
import { prisma as defaultPrisma } from "./db";
import { redis as defaultRedis } from "./redis";
import { allowDevAuthHeaders } from "./middleware/auth";
import { configureGoogleAuth } from "./auth/google";
import { authRouter } from "./routes/auth";
import { bullBoardRouter } from "./routes/bull-board";
import { healthRouter } from "./routes/health";
import { schedulesRouter } from "./routes/schedules";
import { searchRouter } from "./routes/search";
import { slackRouter } from "./routes/slack";
import { CsvInputError } from "./utils/csv";
import { RedisSessionStore } from "./session-store";

export interface AppDependencies {
  prisma?: PrismaClient;
  redis?: typeof defaultRedis;
}

export function createApp(dependencies: AppDependencies = {}) {
  const database = dependencies.prisma || defaultPrisma;
  const redis = dependencies.redis || defaultRedis;
  const allowedOrigins = new Set(
    [env.WEB_ORIGIN, ...env.WEB_ORIGINS.split(",")]
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  configureGoogleAuth(database);

  const app = express();
  app.disable("x-powered-by");
  // Railway/Vercel-style deployments terminate TLS at a reverse proxy. Tell
  // Express to trust that hop so secure session cookies are emitted correctly
  // in production.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Keep non-browser requests usable for health checks and server calls.
        callback(null, !origin || allowedOrigins.has(origin));
      },
      credentials: true,
    }),
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.text({ type: ["text/csv", "text/plain"], limit: env.MAX_UPLOAD_BYTES }));
  app.use(
    session({
      secret: env.SESSION_SECRET,
      store: new RedisSessionStore(redis),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // Vercel and Railway are different sites, so production sessions need
        // SameSite=None for credentialed browser fetches to work.
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(allowDevAuthHeaders);

  app.use(healthRouter(database, redis));
  const authenticationRouter = authRouter(database);
  app.use("/auth", authenticationRouter);
  app.use("/api/auth", authenticationRouter);
  app.use("/api/schedules", schedulesRouter(database));
  const emailRouter = searchRouter(database);
  app.use("/api/search", emailRouter);
  app.use("/api/emails", emailRouter);
  app.use("/auth/slack", slackRouter());
  app.use("/api/slack", slackRouter());
  app.use("/admin/queues", bullBoardRouter());

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof CsvInputError) {
      res.status(400).json({ error: "invalid_csv", message: error.message });
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "invalid_upload", message: error.message });
      return;
    }
    console.error("request failed", error);
    res.status(500).json({ error: "internal_server_error" });
  };
  app.use(errorHandler);

  return app;
}
