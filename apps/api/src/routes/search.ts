import type { PrismaClient } from "@prisma/client";
import { Router, type Request } from "express";
import { prisma as defaultPrisma } from "../db";
import { requireAuth, tenantIdFromRequest } from "../middleware/auth";
import {
  archiveEmail,
  deleteEmail,
  getEmail,
  getEmailAttachment,
  starEmail,
} from "../services/email-service";
import { searchEmails, type EmailSearchFilters, type EmailVisibility } from "../services/search-service";

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function visibility(value: unknown, includeValue: unknown, trueValue: "archived" | "deleted"): EmailVisibility {
  const normalized = queryString(value)?.trim().toLowerCase();
  if (normalized === "all") return "all";
  if (normalized === "archived" || normalized === "deleted" || normalized === "true") {
    return normalized === "true" ? trueValue : (normalized as EmailVisibility);
  }
  if (normalized === "active" || normalized === "false") return "active";
  if (includeValue === "true" || includeValue === "1") return "all";
  return "active";
}

function searchFilters(req: Request): EmailSearchFilters {
  return {
    archived: visibility(req.query.archived, req.query.includeArchived, "archived"),
    deleted: visibility(req.query.deleted, req.query.includeDeleted, "deleted"),
  };
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export function searchRouter(database: PrismaClient = defaultPrisma): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    const query = queryString(req.query.q) ?? queryString(req.query.search) ?? "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const requestedStatus = queryString(req.query.status)?.toLowerCase();
    const status = requestedStatus === "scheduled" || requestedStatus === "sent" ? requestedStatus : undefined;
    const filters = searchFilters(req);
    const tenantId = tenantIdFromRequest(req);

    try {
      const result = await searchEmails(tenantId, query, page, pageSize, status, filters);
      res.json({ query, page, pageSize, status, ...result });
    } catch (searchError) {
      // PostgreSQL remains the source of truth. This fallback keeps the
      // dashboard usable during an Elasticsearch restart while indexing is
      // repaired asynchronously.
      try {
        const statuses = status === "scheduled" ? ["PENDING", "SENDING"] : status === "sent" ? ["SENT", "FAILED", "NEEDS_REVIEW"] : undefined;
        const archivedAt = filters.archived === "archived" ? { not: null } : filters.archived === "active" ? null : undefined;
        const deletedAt = filters.deleted === "deleted" ? { not: null } : filters.deleted === "active" ? null : undefined;
        const where = {
          tenantId,
          ...(statuses ? { status: { in: statuses as never[] } } : {}),
          ...(archivedAt !== undefined ? { archivedAt } : {}),
          ...(deletedAt !== undefined ? { deletedAt } : {}),
          ...(query.trim()
            ? {
                OR: [
                  { toAddress: { contains: query.trim(), mode: "insensitive" as const } },
                  { fromAddress: { contains: query.trim(), mode: "insensitive" as const } },
                  { subject: { contains: query.trim(), mode: "insensitive" as const } },
                  { bodyText: { contains: query.trim(), mode: "insensitive" as const } },
                ],
              }
            : {}),
        };
        const [total, emails] = await Promise.all([
          database.scheduledEmail.count({ where }),
          database.scheduledEmail.findMany({
            where,
            orderBy: { scheduledAt: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);
        res.json({
          query,
          page,
          pageSize,
          status,
          total,
          items: emails.map((email) => ({
            id: email.id,
            tenantId: email.tenantId,
            scheduleId: email.scheduleId,
            toAddress: email.toAddress,
            fromAddress: email.fromAddress,
            subject: email.subject,
            bodyText: email.bodyText,
            bodyHtml: email.bodyHtml,
            scheduledAt: email.scheduledAt.toISOString(),
            nextAttemptAt: email.nextAttemptAt?.toISOString() || null,
            sentAt: email.sentAt?.toISOString() || null,
            previewUrl: email.previewUrl,
            isStarred: email.isStarred,
            archivedAt: email.archivedAt?.toISOString() || null,
            deletedAt: email.deletedAt?.toISOString() || null,
            status: email.status,
            score: null,
          })),
        });
        void searchError;
      } catch (error) {
        res.status(503).json({
          error: "search_unavailable",
          message: error instanceof Error ? error.message : "Elasticsearch and PostgreSQL search are unavailable",
        });
        void searchError;
      }
    }
  });

  router.get("/:emailId/attachments/:attachmentId", async (req, res, next) => {
    try {
      const attachment = await getEmailAttachment(
        database,
        tenantIdFromRequest(req),
        req.params.emailId,
        req.params.attachmentId,
      );
      if (!attachment) {
        res.status(404).json({ error: "attachment_not_found" });
        return;
      }
      const safeFilename = attachment.filename.replace(/[\"\r\n]/g, "_");
      res
        .type(attachment.contentType)
        .setHeader("Content-Length", String(attachment.sizeBytes))
        .setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`)
        .send(attachment.content);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:emailId", async (req, res, next) => {
    try {
      const email = await getEmail(database, tenantIdFromRequest(req), req.params.emailId);
      if (!email) {
        res.status(404).json({ error: "email_not_found" });
        return;
      }
      res.json(email);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:emailId/star", async (req, res, next) => {
    try {
      const requestedStarred = optionalBoolean(req.body?.starred);
      const email = await starEmail(database, tenantIdFromRequest(req), req.params.emailId, requestedStarred);
      if (!email) {
        res.status(404).json({ error: "email_not_found" });
        return;
      }
      res.json(email);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:emailId/archive", async (req, res, next) => {
    try {
      const requestedArchived = optionalBoolean(req.body?.archived);
      const email = await archiveEmail(
        database,
        tenantIdFromRequest(req),
        req.params.emailId,
        requestedArchived ?? true,
      );
      if (!email) {
        res.status(404).json({ error: "email_not_found" });
        return;
      }
      res.json(email);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:emailId", async (req, res, next) => {
    try {
      const deleted = await deleteEmail(database, tenantIdFromRequest(req), req.params.emailId);
      if (!deleted) {
        res.status(404).json({ error: "email_not_found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
