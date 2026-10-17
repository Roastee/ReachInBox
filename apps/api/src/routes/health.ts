import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { checkSearchConnection } from "../services/search-service";

export function healthRouter(database: PrismaClient, redis: Redis): Router {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.json({ status: "ok", service: "reachinbox-api" });
  });

  router.get("/readyz", async (_req, res) => {
    const checks: Record<string, string> = {};
    let ready = true;
    try {
      await database.$queryRaw`SELECT 1`;
      checks.postgres = "ok";
    } catch (error) {
      ready = false;
      checks.postgres = error instanceof Error ? error.message : "unavailable";
    }
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch (error) {
      ready = false;
      checks.redis = error instanceof Error ? error.message : "unavailable";
    }
    try {
      await checkSearchConnection();
      checks.elasticsearch = "ok";
    } catch (error) {
      // Elasticsearch is an optional indexing dependency for the scheduler's
      // core send path, so it is reported but does not make the API unready.
      checks.elasticsearch = error instanceof Error ? error.message : "unavailable";
    }
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks });
  });

  return router;
}
