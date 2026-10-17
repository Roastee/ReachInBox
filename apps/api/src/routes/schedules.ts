import type { PrismaClient } from "@prisma/client";
import { Router, type Request } from "express";
import multer from "multer";
import { env } from "../config/env";
import { prisma as defaultPrisma } from "../db";
import { requireAuth, tenantIdFromRequest } from "../middleware/auth";
import {
  cancelSchedule,
  createSchedule,
  getSchedule,
  listSchedules,
} from "../services/schedule-service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(env.MAX_UPLOAD_BYTES, env.MAX_ATTACHMENT_BYTES),
    files: 1 + env.MAX_ATTACHMENT_COUNT,
  },
});

function bodyValue(body: unknown, name: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

function numberValue(body: unknown, name: string): number | undefined {
  const value = bodyValue(body, name);
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function uploadedFiles(req: Request): {
  source?: Express.Multer.File;
  attachments: Express.Multer.File[];
} {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  return {
    source: files?.file?.[0],
    attachments: [...(files?.attachments || []), ...(files?.["attachments[]"] || [])],
  };
}

export function schedulesRouter(database: PrismaClient = defaultPrisma): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    "/",
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "attachments", maxCount: env.MAX_ATTACHMENT_COUNT },
      { name: "attachments[]", maxCount: env.MAX_ATTACHMENT_COUNT },
    ]),
    async (req, res, next) => {
      try {
        const idempotencyKey = req.header("Idempotency-Key")?.trim();
        if (!idempotencyKey) {
          res.status(400).json({
            error: "idempotency_key_required",
            message: "Every schedule request must include an Idempotency-Key header.",
          });
          return;
        }
        if (idempotencyKey.length > 200) {
          res.status(400).json({
            error: "idempotency_key_too_long",
            message: "Idempotency-Key must be 200 characters or fewer.",
          });
          return;
        }

        const files = uploadedFiles(req);
        let csv: string | undefined;
        if (files.source && files.source.size > env.MAX_UPLOAD_BYTES) {
          res.status(413).json({ error: "upload_too_large", message: `The schedule file cannot exceed ${env.MAX_UPLOAD_BYTES} bytes.` });
          return;
        }
        if (files.source) csv = files.source.buffer.toString("utf8");
        else if (typeof req.body === "string") csv = req.body;
        else csv = bodyValue(req.body, "csv") || bodyValue(req.body, "text") || bodyValue(req.body, "content");

        if (!csv?.trim()) {
          res.status(400).json({ error: "csv_or_text_required" });
          return;
        }

        const result = await createSchedule(database, {
          tenantId: tenantIdFromRequest(req),
          createdById: req.user!.id,
          name: bodyValue(req.body, "name"),
          sourceName: files.source?.originalname || bodyValue(req.body, "sourceName"),
          defaultFrom: bodyValue(req.body, "from") || bodyValue(req.body, "defaultFrom"),
          defaultScheduledAt: bodyValue(req.body, "scheduledAt") || bodyValue(req.body, "defaultScheduledAt"),
          defaultSubject: bodyValue(req.body, "subject") || bodyValue(req.body, "defaultSubject"),
          defaultBody: bodyValue(req.body, "body") || bodyValue(req.body, "defaultBody"),
          defaultBodyHtml: bodyValue(req.body, "bodyHtml") || bodyValue(req.body, "html"),
          delayMs: numberValue(req.body, "delayMs") ?? (() => {
            const delaySeconds = numberValue(req.body, "delaySeconds");
            return delaySeconds === undefined ? undefined : delaySeconds * 1000;
          })(),
          hourlyLimit: numberValue(req.body, "hourlyLimit"),
          idempotencyKey,
          attachments: files.attachments.map((file) => ({
            filename: file.originalname,
            contentType: file.mimetype || "application/octet-stream",
            sizeBytes: file.size,
            content: file.buffer,
          })),
          csv,
        });
        res.status(201).json({ schedule: result });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/", async (req, res, next) => {
    try {
      const schedules = await listSchedules(database, tenantIdFromRequest(req));
      res.json({ schedules });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:scheduleId", async (req, res, next) => {
    try {
      const schedule = await getSchedule(database, tenantIdFromRequest(req), req.params.scheduleId);
      if (!schedule) {
        res.status(404).json({ error: "schedule_not_found" });
        return;
      }
      res.json({ schedule });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:scheduleId/cancel", async (req, res, next) => {
    try {
      const cancelled = await cancelSchedule(database, tenantIdFromRequest(req), req.params.scheduleId);
      if (!cancelled) {
        res.status(404).json({ error: "schedule_not_found" });
        return;
      }
      res.json({ status: "CANCELLED" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
